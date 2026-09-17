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
    validate_password_policy,
    verify_password,
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

        hashed_pw = hash_password(req.password)
        new_user = User(
            email=clean_email,
            password_hash=hashed_pw,
            role=role,
            is_active=True,
            is_verified=False,
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

        stmt = (
            select(User)
            .where(User.email == clean_email)
            .options(selectinload(User.student_profile), selectinload(User.teacher_profile))
        )
        user = (await db.execute(stmt)).scalar_one_or_none()

        # Generic failure message for timing and enumeration protection
        if not user or not verify_password(req.password, user.password_hash):
            logger.warning("audit_login_failed", email=clean_email)
            raise AppException(
                message="Invalid email or password",
                code="INVALID_CREDENTIALS",
                status_code=401,
            )

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
    async def logout(db: AsyncSession, plaintext_refresh_token: str | None) -> None:
        """Revoke active refresh token session."""
        if not plaintext_refresh_token:
            return

        token_hash = hash_token(plaintext_refresh_token)
        now = datetime.datetime.now(datetime.UTC)

        stmt = (
            update(RefreshToken)
            .where(RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        await db.execute(stmt)
        logger.info("audit_user_logged_out")

    @staticmethod
    async def change_password(
        db: AsyncSession,
        user: User,
        req: ChangePasswordRequest,
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
