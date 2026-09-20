"""Pydantic schemas for authentication requests and responses."""

from pydantic import BaseModel, EmailStr, Field

from app.modules.users.models import UserRole
from app.modules.users.schemas import UserResponse


class RegisterRequest(BaseModel):
    """User registration payload."""

    email: EmailStr
    password: str = Field(..., min_length=12, max_length=128)
    role: UserRole = Field(default=UserRole.STUDENT)

    # Optional Student profile fields
    target_exam: str = "TEF Canada"
    target_level: str = "B2"
    timezone: str = "UTC"
    native_language: str | None = None

    # Optional Teacher profile fields
    display_name: str | None = None
    bio: str | None = None
    hourly_price: int = 3500

    # Controlled Beta Access Token
    invitation_code: str | None = None


class LoginRequest(BaseModel):
    """User login credentials."""

    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    """Token refresh payload (optional fallback when cookies are not used)."""

    refresh_token: str | None = None


class ChangePasswordRequest(BaseModel):
    """Password modification payload."""

    current_password: str
    new_password: str = Field(..., min_length=12, max_length=128)


class TokenResponse(BaseModel):
    """Successful authentication response containing JWT and user profile."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class MessageResponse(BaseModel):
    """Standard message response."""

    message: str
