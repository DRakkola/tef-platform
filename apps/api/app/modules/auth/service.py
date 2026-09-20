"""Authentication service handling registration, login, token rotation, and audit logging."""

import datetime

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
    RefreshToken,
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


class AuthService:
    """Core authentication business logic."""

    @staticmethod
    async def register(
        db: AsyncSession,
        req: RegisterRequest,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[User, str, str]:
        """Register a new student or teacher account with corresponding profile."""
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

        hashed_pw = hash_password(req.password)
        new_user = User(
            email=clean_email,
            password_hash=hashed_pw,
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
        )

        return new_user, access_token, refresh_token

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

        # 2. Timing-safe password verification preventing enumeration
        is_password_valid = verify_password_timing_safe(
            req.password, user.password_hash if user else None
        )

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

        stmt = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        session_record = (await db.execute(stmt)).scalar_one_or_none()

        if not session_record:
            logger.warning("audit_refresh_token_invalid_or_reused")
            raise AppException(
                message="Invalid or expired session. Please log in again.",
                code="INVALID_REFRESH_TOKEN",
                status_code=401,
            )

        user = await db.get(
            User,
            session_record.user_id,
            options=[selectinload(User.student_profile), selectinload(User.teacher_profile)],
        )
        if not user or not user.is_active:
            raise AppException(
                message="User account is inactive",
                code="ACCOUNT_INACTIVE",
                status_code=401,
            )

        # Invalidate old token (Rotation)
        session_record.revoked_at = now

        # Create new session
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
            now = datetime.datetime.now(datetime.UTC)

            stmt = (
                update(RefreshToken)
                .where(RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None))
                .values(revoked_at=now)
            )
            await db.execute(stmt)
        logger.info("audit_user_logged_out", jti_revoked=bool(access_token_jti))

    @staticmethod
    async def change_password(
        db: AsyncSession,
        user: User,
        req: ChangePasswordRequest,
        access_token_jti: str | None = None,
    ) -> None:
        """Verify current password, update password hash, and revoke all active sessions."""
        if not verify_password(req.current_password, user.password_hash):
            logger.warning("audit_password_change_failed_bad_current", user_id=str(user.id))
            raise AppException(
                message="The current password provided is incorrect",
                code="INVALID_CURRENT_PASSWORD",
                status_code=400,
            )

        validate_password_policy(req.new_password)

        user.password_hash = hash_password(req.new_password)

        if access_token_jti:
            await revoke_token_jti(
                access_token_jti, ttl_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
            )

        # Revoke all active sessions on password change
        now = datetime.datetime.now(datetime.UTC)
        revoke_all = (
            update(RefreshToken)
            .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        await db.execute(revoke_all)

        logger.info("audit_password_changed", user_id=str(user.id))

    @staticmethod
    async def _create_session(
        db: AsyncSession,
        user: User,
        ip_address: str | None,
        user_agent: str | None,
    ) -> tuple[str, str]:
        """Generate JWT access token and store hashed refresh token."""
        access_token = create_access_token(user.id, user.role.value)
        plaintext_refresh = generate_secure_token(48)
        token_hash = hash_token(plaintext_refresh)

        now = datetime.datetime.now(datetime.UTC)
        expires_at = now + datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        refresh_record = RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            ip_address=ip_address[:45] if ip_address else None,
            user_agent=user_agent[:255] if user_agent else None,
        )
        db.add(refresh_record)
        await db.flush()

        return access_token, plaintext_refresh
