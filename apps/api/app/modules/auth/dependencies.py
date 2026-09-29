"""Reusable authorization dependencies: current_user, require_role, ownership, and CSRF."""

import hmac
import uuid
from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.security import decode_access_token, is_token_revoked
from app.modules.users.models import StudentProfile, TeacherProfile, User, UserRole

# HTTP Bearer authentication scheme (auto_error=False to allow fallback to HttpOnly cookie)
security_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    auth: HTTPAuthorizationCredentials | None = Depends(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate JWT token from Bearer header or HttpOnly cookie."""
    token: str | None = None
    is_cookie_auth = False

    if auth and auth.credentials:
        token = auth.credentials
    elif "access_token" in request.cookies:
        token = request.cookies["access_token"]
        is_cookie_auth = True

    if not token:
        raise AppException(
            message="Authentication credentials were not provided",
            code="UNAUTHORIZED",
            status_code=401,
        )

    payload = decode_access_token(token)
    jti = payload.get("jti")
    if jti and await is_token_revoked(jti):
        raise AppException(
            message="Token has been revoked",
            code="TOKEN_REVOKED",
            status_code=401,
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise AppException(
            message="Invalid authentication token claims",
            code="INVALID_TOKEN",
            status_code=401,
        )

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError as exc:
        raise AppException(
            message="Invalid user identifier in token",
            code="INVALID_TOKEN",
            status_code=401,
        ) from exc

    user = await db.get(
        User,
        user_uuid,
        options=[selectinload(User.student_profile), selectinload(User.teacher_profile)],
    )
    if not user and payload.get("email"):
        # Just-in-Time provisioning from verified Supabase token
        email = str(payload.get("email")).strip().lower()
        user_metadata = payload.get("user_metadata") or {}
        role_str = str(user_metadata.get("role", "student")).upper()
        role = UserRole.TEACHER if role_str == "TEACHER" else UserRole.STUDENT

        new_user = User(
            id=user_uuid,
            email=email,
            role=role,
            is_active=True,
            is_verified=True,
        )
        db.add(new_user)
        if role == UserRole.STUDENT:
            db.add(
                StudentProfile(
                    user_id=user_uuid,
                    target_exam=user_metadata.get("target_exam", "TEF Canada"),
                    target_level=user_metadata.get("target_level", "B2"),
                    timezone=user_metadata.get("timezone", "UTC"),
                )
            )
        elif role == UserRole.TEACHER:
            db.add(
                TeacherProfile(
                    user_id=user_uuid,
                    display_name=user_metadata.get("display_name", email.split("@")[0]),
                    hourly_price=int(user_metadata.get("hourly_price", 3500)),
                    timezone=user_metadata.get("timezone", "UTC"),
                )
            )
        try:
            await db.commit()
            user = await db.get(
                User,
                user_uuid,
                options=[selectinload(User.student_profile), selectinload(User.teacher_profile)],
            )
        except Exception:  # noqa: BLE001
            await db.rollback()
            user = await db.get(
                User,
                user_uuid,
                options=[selectinload(User.student_profile), selectinload(User.teacher_profile)],
            )

    if not user:
        raise AppException(
            message="User not found",
            code="USER_NOT_FOUND",
            status_code=401,
        )

    if not user.is_active:
        raise AppException(
            message="User account is inactive",
            code="ACCOUNT_INACTIVE",
            status_code=401,
        )

    # Attach auth context to request state
    request.state.is_cookie_auth = is_cookie_auth
    request.state.current_user = user
    request.state.access_token_jti = jti

    return user


def require_role(*roles: UserRole) -> Callable[..., Coroutine[Any, Any, User]]:
    """Dependency factory ensuring the current user holds one of the specified roles."""

    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise AppException(
                message=f"Access forbidden: requires one of [{', '.join(r.value for r in roles)}]",
                code="INSUFFICIENT_PERMISSIONS",
                status_code=403,
            )
        return current_user

    return role_checker


def check_resource_ownership(
    resource_user_id: uuid.UUID,
    current_user: User,
) -> None:
    """Enforce that a user cannot access or mutate another user's resources unless admin."""
    if current_user.role == UserRole.ADMIN:
        return

    if resource_user_id != current_user.id:
        raise AppException(
            message="You do not have permission to access or modify this user's resource",
            code="FORBIDDEN_RESOURCE",
            status_code=403,
        )


async def verify_csrf_if_cookie(request: Request) -> None:
    """CSRF protection for state-changing requests when authenticated via cookies."""
    # If request used Bearer token authentication, CSRF is not required
    if getattr(request.state, "is_cookie_auth", None) is False:
        return

    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return

    # Only enforce if request relies on cookie authentication
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and (
        getattr(request.state, "is_cookie_auth", False)
        or "access_token" in request.cookies
        or "refresh_token" in request.cookies
    ):
        cookie_csrf = request.cookies.get("csrf_token")
        header_csrf = request.headers.get("X-CSRF-Token")

        if not cookie_csrf or not header_csrf:
            raise AppException(
                message="Missing CSRF token for cookie-authenticated request",
                code="CSRF_TOKEN_MISSING",
                status_code=403,
            )

        if not hmac.compare_digest(cookie_csrf, header_csrf):
            raise AppException(
                message="CSRF validation failed",
                code="CSRF_VALIDATION_FAILED",
                status_code=403,
            )


async def require_beta_access(
    current_user: User = Depends(get_current_user),
) -> User:
    """Verify that the user is authorized for private beta features."""
    from app.core.config import settings

    if not settings.BETA_ENABLED:
        return current_user

    if current_user.role in (UserRole.ADMIN, UserRole.TEACHER):
        return current_user

    if not getattr(current_user, "is_beta_user", False):
        raise AppException(
            message="Accès réservé aux participants de la Bêta Privée TEF Canada.",
            code="BETA_ACCESS_REQUIRED",
            status_code=403,
        )

    return current_user
