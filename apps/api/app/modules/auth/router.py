"""FastAPI Router for authentication endpoints: /api/v1/auth."""

import structlog
from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.rate_limit import check_rate_limit
from app.core.security import decode_access_token, generate_secure_token
from app.modules.auth.dependencies import get_current_user, verify_csrf_if_cookie
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
)
from app.modules.auth.service import AuthService
from app.modules.users.models import User
from app.modules.users.schemas import UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = structlog.get_logger("tef-api.auth")


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set secure HttpOnly cookies for access and refresh tokens along with CSRF token."""
    csrf_token = generate_secure_token(32)

    # 1. Access token cookie (short-lived)
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )

    # 2. Refresh token cookie (session duration)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/api/v1/auth",
    )

    # 3. Double-submit CSRF cookie (readable by JS to include in X-CSRF-Token header)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=False,
        secure=settings.cookie_secure,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    """Clear all authentication cookies on logout."""
    response.delete_cookie(key="access_token", path="/", domain=settings.COOKIE_DOMAIN)
    response.delete_cookie(key="refresh_token", path="/api/v1/auth", domain=settings.COOKIE_DOMAIN)
    response.delete_cookie(key="csrf_token", path="/", domain=settings.COOKIE_DOMAIN)


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def register(
    req: RegisterRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    await check_rate_limit(
        request, key_prefix="auth_register", limit=settings.RATE_LIMIT_AUTH_PER_MINUTE
    )

    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")

    user, access_token, refresh_token = await AuthService.register(
        db=db,
        req=req,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    _set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate with email and password",
)
async def login(
    req: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    await check_rate_limit(
        request, key_prefix="auth_login", limit=settings.RATE_LIMIT_AUTH_PER_MINUTE
    )

    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")

    user, access_token, refresh_token = await AuthService.login(
        db=db,
        req=req,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    _set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Renew access token using refresh token",
)
async def refresh(
    request: Request,
    response: Response,
    body: RefreshTokenRequest | None = None,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    # Read token from cookie or request body
    token = (body.refresh_token if body else None) or request.cookies.get("refresh_token")
    if not token:
        raise AppException(
            message="Refresh token is required",
            code="REFRESH_TOKEN_REQUIRED",
            status_code=401,
        )

    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")

    user, access_token, new_refresh_token = await AuthService.refresh_tokens(
        db=db,
        plaintext_refresh_token=token,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    _set_auth_cookies(response, access_token, new_refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Revoke active session and logout",
)
async def logout(
    request: Request,
    response: Response,
    body: RefreshTokenRequest | None = None,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    token = (body.refresh_token if body else None) or request.cookies.get("refresh_token")

    access_jti: str | None = None
    auth_header = request.headers.get("Authorization")
    raw_access_token: str | None = None
    if auth_header and auth_header.startswith("Bearer "):
        raw_access_token = auth_header.removeprefix("Bearer ").strip()
    elif "access_token" in request.cookies:
        raw_access_token = request.cookies["access_token"]

    if raw_access_token:
        try:
            payload = decode_access_token(raw_access_token)
            access_jti = payload.get("jti")
        except Exception as exc:  # noqa: BLE001
            logger.debug("access_token_decode_skipped_for_logout", error=str(exc))

    await AuthService.logout(db=db, plaintext_refresh_token=token, access_token_jti=access_jti)
    _clear_auth_cookies(response)
    return MessageResponse(message="Successfully logged out")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get authenticated user profile",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change user password and invalidate prior sessions",
)
async def change_password(
    req: ChangePasswordRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await verify_csrf_if_cookie(request)
    access_jti = getattr(request.state, "access_token_jti", None)
    await AuthService.change_password(
        db=db, user=current_user, req=req, access_token_jti=access_jti
    )
    _clear_auth_cookies(response)
    return MessageResponse(message="Password changed successfully. Please log in again.")
