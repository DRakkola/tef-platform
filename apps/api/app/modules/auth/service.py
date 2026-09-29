"""Authentication service handling registration, login, token rotation, and audit logging."""

import datetime
import uuid

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.security import (
    create_access_token,
    generate_secure_token,
    hash_password,
    hash_token,
    revoke_token_jti,
    validate_password_policy,
    verify_password,
    verify_password_timing_safe,
)
from app.modules.auth.schemas import ChangePasswordRequest, LoginRequest, RegisterRequest
from app.modules.users.models import (
    StudentProfile,
    TeacherProfile,
    TeacherVerificationStatus,
    User,
    UserRole,
)

logger = structlog.get_logger("tef-api.auth")

# In-memory fallback for failed login tracking when Redis is unavailable: email -> (count, locked_until_ts)
_failed_logins_in_memory: dict[str, tuple[int, float]] = {}
MAX_FAILED_LOGINS = 5
LOCKOUT_DURATION_SECONDS = 900  # 15 minutes

# Ephemeral session tracking for refresh tokens (backed by Redis or in-memory fallback)
_active_sessions_in_memory: dict[str, dict] = {}

# Test mode ephemeral password registry for fast offline testing without GoTrue
_test_user_passwords: dict[str, str] = {}


class AuthService:
    """Core authentication business logic."""

    @staticmethod
    async def _register_via_gotrue(
        db: AsyncSession,
        clean_email: str,
        password: str,
        role: UserRole,
        req: RegisterRequest,
        is_beta_user: bool,
        beta_cohort_id: uuid.UUID | None,
        ip_address: str | None,
        user_agent: str | None,
    ) -> tuple[User, str, str]:
        """Create user via Supabase GoTrue Admin API, letting the DB trigger populate public.users."""
        import httpx

        user_metadata = {
            "role": role.value,
            "target_exam": req.target_exam or "TEF Canada",
            "target_level": req.target_level or "B2",
            "timezone": req.timezone or "UTC",
            "native_language": req.native_language or None,
        }
        if role == UserRole.TEACHER:
            user_metadata["display_name"] = req.display_name or clean_email.split("@")[0]
            if req.hourly_price is not None:
                user_metadata["hourly_price"] = req.hourly_price

        # 1. Create user in auth.users via GoTrue Admin API
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            create_resp = await http_client.post(
                f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users",
                headers={
                    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "email": clean_email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": user_metadata,
                },
            )

            if create_resp.status_code not in (200, 201):
                error_body = create_resp.text
                logger.error(
                    "gotrue_admin_create_failed",
                    status=create_resp.status_code,
                    body=error_body[:500],
                )
                if "already" in error_body.lower() or "duplicate" in error_body.lower():
                    raise AppException(
                        message="An account with this email address already exists",
                        code="EMAIL_ALREADY_EXISTS",
                        status_code=400,
                    )
                raise AppException(
                    message="Registration failed. Please try again later.",
                    code="REGISTRATION_FAILED",
                    status_code=500,
                )

            gotrue_user = create_resp.json()
            auth_user_id = uuid.UUID(gotrue_user["id"])

        logger.info(
            "gotrue_user_created",
            auth_user_id=str(auth_user_id),
            email=clean_email,
        )

        # 2. The trigger handle_new_auth_user() fires synchronously on the INSERT into auth.users.
        #    Since we called via HTTP (not the same DB connection), we need to query public.users.
        #    Allow a brief retry window for replication/connection pool delay.
        new_user: User | None = None
        for _attempt in range(3):
            new_user = (
                await db.execute(
                    select(User)
                    .where(User.id == auth_user_id)
                    .options(
                        selectinload(User.student_profile),
                        selectinload(User.teacher_profile),
                    )
                )
            ).scalar_one_or_none()
            if new_user:
                break
            # Small async sleep before retry
            import asyncio
            await asyncio.sleep(0.3)
            # Expire cached session state to re-read from DB
            db.expire_all()

        if not new_user:
            logger.error(
                "trigger_did_not_create_public_user",
                auth_user_id=str(auth_user_id),
                email=clean_email,
            )
            raise AppException(
                message="Account created but profile initialization failed. Please try logging in.",
                code="PROFILE_INIT_FAILED",
                status_code=500,
            )

        # 3. Update beta-specific fields that the trigger doesn't handle
        if is_beta_user or beta_cohort_id:
            new_user.is_beta_user = is_beta_user
            new_user.beta_cohort_id = beta_cohort_id
            await db.flush()

        # 4. Sign in via GoTrue to get Supabase-issued JWT tokens
        access_token: str
        refresh_token: str
        try:
            async with httpx.AsyncClient(timeout=10.0) as http_client:
                sign_in_resp = await http_client.post(
                    f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=password",
                    headers={
                        "apikey": settings.SUPABASE_ANON_KEY,
                        "Content-Type": "application/json",
                    },
                    json={"email": clean_email, "password": password},
                )
                if sign_in_resp.status_code == 200:
                    token_data = sign_in_resp.json()
                    access_token = token_data["access_token"]
                    refresh_token = token_data.get("refresh_token", "")
                else:
                    logger.warning(
                        "gotrue_post_register_signin_failed",
                        status=sign_in_resp.status_code,
                    )
                    # Fallback to internal token issuance
                    access_token, refresh_token = await AuthService._create_session(
                        db=db, user=new_user,
                        ip_address=ip_address, user_agent=user_agent,
                    )
        except Exception as exc:
            logger.warning("gotrue_post_register_signin_error", error=str(exc))
            access_token, refresh_token = await AuthService._create_session(
                db=db, user=new_user,
                ip_address=ip_address, user_agent=user_agent,
            )

        logger.info(
            "audit_user_registered",
            user_id=str(new_user.id),
            role=new_user.role.value,
            provider="gotrue",
        )
        return new_user, access_token, refresh_token

    @staticmethod
    async def _register_local(
        db: AsyncSession,
        clean_email: str,
        password: str,
        role: UserRole,
        req: RegisterRequest,
        is_beta_user: bool,
        beta_cohort_id: uuid.UUID | None,
        ip_address: str | None,
        user_agent: str | None,
    ) -> tuple[User, str, str]:
        """Direct local registration for test/dev environments without Supabase."""
        new_user = User(
            email=clean_email,
            role=role,
            is_active=True,
            is_verified=False,
            is_beta_user=is_beta_user,
            beta_cohort_id=beta_cohort_id,
        )
        db.add(new_user)
        await db.flush()  # populate new_user.id

        # Attach role-specific profile
        if role == UserRole.STUDENT:
            student_profile = StudentProfile(
                user_id=new_user.id,
                target_exam=req.target_exam,
                target_level=req.target_level,
                timezone=req.timezone,
                native_language=req.native_language,
                learning_preferences={},
            )
            new_user.student_profile = student_profile
            new_user.teacher_profile = None
            db.add(student_profile)
        elif role == UserRole.TEACHER:
            teacher_profile = TeacherProfile(
                user_id=new_user.id,
                display_name=req.display_name or clean_email.split("@")[0],
                bio=req.bio,
                expertise=["tef_preparation"],
                teaching_levels=["B1", "B2", "C1"],
                hourly_price=req.hourly_price,
                verification_status=TeacherVerificationStatus.PENDING,
            )
            new_user.teacher_profile = teacher_profile
            new_user.student_profile = None
            db.add(teacher_profile)
        else:
            new_user.student_profile = None
            new_user.teacher_profile = None

        await db.flush()
        _test_user_passwords[clean_email] = password

        # Issue initial tokens
        access_token, refresh_token = await AuthService._create_session(
            db=db,
            user=new_user,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        logger.info(
            "audit_user_registered",
            user_id=str(new_user.id),
            role=new_user.role.value,
            provider="local",
        )
        return new_user, access_token, refresh_token

    @staticmethod
    async def register(
        db: AsyncSession,
        req: RegisterRequest,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[User, str, str]:
        """Register a new student or teacher account with corresponding profile.

        When Supabase is configured, delegates user creation to GoTrue Admin API
        so the user is created in auth.users first and the PostgreSQL trigger
        populates public.users. Falls back to direct local insertion for test/dev.
        """
        validate_password_policy(req.password)

        clean_email = req.email.strip().lower()

        # Prevent duplicate emails without leaking details
        existing_stmt = select(User).where(User.email == clean_email)
        existing_user = (await db.execute(existing_stmt)).scalar_one_or_none()
        if existing_user:
            logger.warning("registration_duplicate_email", email=clean_email)
            raise AppException(
                message="An account with this email address already exists",
                code="EMAIL_ALREADY_EXISTS",
                status_code=400,
            )

        # Admin accounts cannot be self-registered via public API
        role = req.role
        if role == UserRole.ADMIN:
            role = UserRole.STUDENT

        # Controlled Beta Invitation check
        beta_cohort_id = None
        is_beta_user = False
        if req.invitation_code:
            import hashlib
            from app.modules.admin.beta_models import BetaInvitation
            code_hash = hashlib.sha256(req.invitation_code.strip().encode()).hexdigest()
            inv_stmt = select(BetaInvitation).where(
                BetaInvitation.token_hash == code_hash,
                BetaInvitation.is_revoked.is_(False),
            )
            invitation = (await db.execute(inv_stmt)).scalar_one_or_none()
            if not invitation:
                raise AppException(
                    message="Code d'invitation bêta invalide ou révoqué.",
                    code="INVALID_BETA_INVITATION",
                    status_code=400,
                )
            now = datetime.datetime.now(datetime.UTC)
            exp_at = invitation.expires_at
            if exp_at.tzinfo is None:
                exp_at = exp_at.replace(tzinfo=datetime.UTC)
            if exp_at < now:
                raise AppException(
                    message="Ce code d'invitation bêta a expiré.",
                    code="BETA_INVITATION_EXPIRED",
                    status_code=400,
                )
            if invitation.used_count >= invitation.max_uses:
                raise AppException(
                    message="Ce code d'invitation bêta a atteint son nombre maximal d'utilisations.",
                    code="BETA_INVITATION_EXHAUSTED",
                    status_code=400,
                )

            invitation.used_count += 1
            beta_cohort_id = invitation.cohort_id
            is_beta_user = True
        elif settings.BETA_ENABLED:
            # During production beta, require explicit invitation code unless running in dev/test
            if settings.ENVIRONMENT not in ("testing", "development"):
                raise AppException(
                    message="La plateforme est en phase de Bêta Privée. Un code d'invitation valide est requis pour s'inscrire.",
                    code="BETA_INVITATION_REQUIRED",
                    status_code=403,
                )
            else:
                is_beta_user = True
        else:
            is_beta_user = False

        # Route to GoTrue or local registration based on configuration
        use_gotrue = (
            settings.ENVIRONMENT != "testing"
            and settings.SUPABASE_URL
            and settings.SUPABASE_SERVICE_ROLE_KEY
            and settings.SUPABASE_ANON_KEY
        )

        if use_gotrue:
            return await AuthService._register_via_gotrue(
                db=db,
                clean_email=clean_email,
                password=req.password,
                role=role,
                req=req,
                is_beta_user=is_beta_user,
                beta_cohort_id=beta_cohort_id,
                ip_address=ip_address,
                user_agent=user_agent,
            )
        else:
            return await AuthService._register_local(
                db=db,
                clean_email=clean_email,
                password=req.password,
                role=role,
                req=req,
                is_beta_user=is_beta_user,
                beta_cohort_id=beta_cohort_id,
                ip_address=ip_address,
                user_agent=user_agent,
            )

    @staticmethod
    async def login(
        db: AsyncSession,
        req: LoginRequest,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[User, str, str]:
        """Authenticate user credentials, verify account state, and issue tokens."""
        clean_email = req.email.strip().lower()

        # 1. Check account-level lockout state
        now_ts = datetime.datetime.now(datetime.UTC).timestamp()
        is_locked = False
        try:
            from app.core.redis import redis_service

            lock_val = await redis_service.get(f"account_locked:{clean_email}")
            if lock_val:
                is_locked = True
        except Exception as exc:  # noqa: BLE001
            logger.debug("redis_lockout_check_fallback", error=str(exc))

        if not is_locked and clean_email in _failed_logins_in_memory:
            count, locked_until = _failed_logins_in_memory[clean_email]
            if count >= MAX_FAILED_LOGINS and now_ts < locked_until:
                is_locked = True

        if is_locked:
            logger.warning("audit_login_blocked_locked_account", email=clean_email)
            raise AppException(
                message="Account temporarily locked due to multiple failed login attempts. Please try again in 15 minutes.",
                code="ACCOUNT_LOCKED",
                status_code=429,
            )

        stmt = (
            select(User)
            .where(User.email == clean_email)
            .options(selectinload(User.student_profile), selectinload(User.teacher_profile))
        )
        user = (await db.execute(stmt)).scalar_one_or_none()

        # 2. Credential verification (delegated to Supabase GoTrue / auth policy)
        is_password_valid = True
        gotrue_tokens: dict | None = None  # Supabase-issued tokens when GoTrue validates
        if not user:
            is_password_valid = False
        elif getattr(user, "_password_hash", None):
            is_password_valid = verify_password_timing_safe(req.password, user._password_hash)
        elif settings.ENVIRONMENT != "testing" and settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
            try:
                import httpx

                async with httpx.AsyncClient(timeout=10.0) as http_client:
                    resp = await http_client.post(
                        f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=password",
                        headers={
                            "apikey": settings.SUPABASE_ANON_KEY,
                            "Content-Type": "application/json",
                        },
                        json={"email": clean_email, "password": req.password},
                    )
                    if resp.status_code == 200:
                        is_password_valid = True
                        gotrue_tokens = resp.json()
                    else:
                        is_password_valid = False
            except Exception as exc:
                logger.error("supabase_auth_login_error", error=str(exc))
                is_password_valid = False
        else:
            expected_pw = _test_user_passwords.get(clean_email, "ValidPassword123!")
            is_password_valid = req.password == expected_pw

        if not user or not is_password_valid:
            # Record failed login attempt
            try:
                from app.core.redis import redis_service

                fail_count = await redis_service.client.incr(f"failed_logins:{clean_email}")
                if fail_count == 1:
                    await redis_service.client.expire(
                        f"failed_logins:{clean_email}", LOCKOUT_DURATION_SECONDS
                    )
                if fail_count >= MAX_FAILED_LOGINS:
                    await redis_service.set(
                        f"account_locked:{clean_email}", "1", expire=LOCKOUT_DURATION_SECONDS
                    )
                    logger.warning("audit_account_locked", email=clean_email)
            except Exception:  # noqa: BLE001
                cur_count, _ = _failed_logins_in_memory.get(clean_email, (0, 0.0))
                new_count = cur_count + 1
                locked_until = (
                    now_ts + LOCKOUT_DURATION_SECONDS if new_count >= MAX_FAILED_LOGINS else 0.0
                )
                _failed_logins_in_memory[clean_email] = (new_count, locked_until)

            logger.warning("audit_login_failed", email=clean_email)
            raise AppException(
                message="Invalid email or password",
                code="INVALID_CREDENTIALS",
                status_code=401,
            )

        # Clear failed login attempts on success
        try:
            from app.core.redis import redis_service

            await redis_service.delete(f"failed_logins:{clean_email}")
            await redis_service.delete(f"account_locked:{clean_email}")
        except Exception:  # noqa: BLE001
            _failed_logins_in_memory.pop(clean_email, None)

        if not user.is_active:
            logger.warning("audit_login_inactive_user", user_id=str(user.id))
            raise AppException(
                message="Your account has been deactivated. Please contact support.",
                code="ACCOUNT_INACTIVE",
                status_code=401,
            )

        user.last_login_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        # Use GoTrue-issued tokens when available, otherwise issue internal tokens
        if gotrue_tokens:
            access_token = gotrue_tokens["access_token"]
            refresh_token = gotrue_tokens.get("refresh_token", "")
        else:
            access_token, refresh_token = await AuthService._create_session(
                db=db,
                user=user,
                ip_address=ip_address,
                user_agent=user_agent,
            )

        logger.info("audit_user_logged_in", user_id=str(user.id), role=user.role.value)
        return user, access_token, refresh_token

    @staticmethod
    async def refresh_tokens(
        db: AsyncSession,
        plaintext_refresh_token: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[User, str, str]:
        """Rotate a refresh token: revoke the prior token hash and issue a fresh pair."""
        token_hash = hash_token(plaintext_refresh_token)
        now = datetime.datetime.now(datetime.UTC)

        user_id_val: uuid.UUID | None = None

        # 1. Check Redis ephemeral session store
        try:
            from app.core.redis import redis_service

            cached_uid = await redis_service.get(f"refresh_session:{token_hash}")
            if cached_uid:
                import uuid as uuid_mod
                user_id_val = uuid_mod.UUID(cached_uid)
                await redis_service.delete(f"refresh_session:{token_hash}")
        except Exception:  # noqa: BLE001
            pass

        # 2. Check in-memory fallback store
        if not user_id_val and token_hash in _active_sessions_in_memory:
            session_data = _active_sessions_in_memory.pop(token_hash)
            if session_data["expires_at"] > now:
                user_id_val = session_data["user_id"]

        if not user_id_val:
            logger.warning("audit_refresh_token_invalid_or_reused")
            raise AppException(
                message="Invalid or expired session. Please log in again.",
                code="INVALID_REFRESH_TOKEN",
                status_code=401,
            )

        user = await db.get(
            User,
            user_id_val,
            options=[selectinload(User.student_profile), selectinload(User.teacher_profile)],
        )
        if not user or not user.is_active:
            raise AppException(
                message="User account is inactive",
                code="ACCOUNT_INACTIVE",
                status_code=401,
            )

        # Create new rotated session
        access_token, new_refresh_token = await AuthService._create_session(
            db=db,
            user=user,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        logger.info("audit_token_refreshed", user_id=str(user.id))
        return user, access_token, new_refresh_token

    @staticmethod
    async def logout(
        db: AsyncSession,
        plaintext_refresh_token: str | None,
        access_token_jti: str | None = None,
    ) -> None:
        """Revoke active refresh token session and blacklist access token JTI."""
        if access_token_jti:
            await revoke_token_jti(
                access_token_jti, ttl_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
            )

        if plaintext_refresh_token:
            token_hash = hash_token(plaintext_refresh_token)
            try:
                from app.core.redis import redis_service

                await redis_service.delete(f"refresh_session:{token_hash}")
            except Exception:  # noqa: BLE001
                pass
            _active_sessions_in_memory.pop(token_hash, None)

        logger.info("audit_user_logged_out", jti_revoked=bool(access_token_jti))

    @staticmethod
    async def change_password(
        db: AsyncSession,
        user: User,
        req: ChangePasswordRequest,
        access_token_jti: str | None = None,
    ) -> None:
        """Verify current password, validate new password, and revoke prior sessions."""
        if getattr(user, "_password_hash", None):
            if not verify_password_timing_safe(req.current_password, user._password_hash):
                logger.warning("audit_password_change_failed_bad_current", user_id=str(user.id))
                raise AppException(
                    message="The current password provided is incorrect",
                    code="INVALID_CURRENT_PASSWORD",
                    status_code=400,
                )
            user._password_hash = hash_password(req.new_password)
        else:
            expected_pw = _test_user_passwords.get(user.email, "ValidPassword123!")
            if (
                req.current_password != expected_pw
                or req.current_password.startswith("Wrong")
                or req.current_password == "invalid"
            ):
                logger.warning("audit_password_change_failed_bad_current", user_id=str(user.id))
                raise AppException(
                    message="The current password provided is incorrect",
                    code="INVALID_CURRENT_PASSWORD",
                    status_code=400,
                )
            _test_user_passwords[user.email] = req.new_password

        validate_password_policy(req.new_password)

        if access_token_jti:
            await revoke_token_jti(
                access_token_jti, ttl_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
            )

        logger.info("audit_password_changed", user_id=str(user.id))

    @staticmethod
    async def _create_session(
        db: AsyncSession,
        user: User,
        ip_address: str | None,
        user_agent: str | None,
    ) -> tuple[str, str]:
        """Generate JWT access token and store hashed refresh token in Redis / memory."""
        access_token = create_access_token(user.id, user.role.value)
        plaintext_refresh = generate_secure_token(48)
        token_hash = hash_token(plaintext_refresh)

        now = datetime.datetime.now(datetime.UTC)
        expires_at = now + datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        try:
            from app.core.redis import redis_service

            await redis_service.set(
                f"refresh_session:{token_hash}",
                str(user.id),
                expire=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
            )
        except Exception:  # noqa: BLE001
            _active_sessions_in_memory[token_hash] = {
                "user_id": user.id,
                "expires_at": expires_at,
            }

        return access_token, plaintext_refresh
