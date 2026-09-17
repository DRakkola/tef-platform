"""Core security utilities: Argon2 password hashing, JWT operations, and token hashing."""

import hashlib
import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.config import settings
from app.core.exceptions import AppException

# Argon2id password hasher
password_hasher = PasswordHash((Argon2Hasher(),))


def validate_password_policy(password: str) -> None:
    """Enforce a strong password policy as specified in AGENTS.md.

    Requirements:
    - Minimum 12 characters
    - Maximum 128 characters (DoS protection)
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special symbol
    """
    if len(password) < 12:
        raise AppException(
            message="Password must be at least 12 characters long",
            code="WEAK_PASSWORD",
            status_code=422,
        )
    if len(password) > 128:
        raise AppException(
            message="Password must not exceed 128 characters",
            code="WEAK_PASSWORD",
            status_code=422,
        )
    if not re.search(r"[A-Z]", password):
        raise AppException(
            message="Password must contain at least one uppercase letter",
            code="WEAK_PASSWORD",
            status_code=422,
        )
    if not re.search(r"[a-z]", password):
        raise AppException(
            message="Password must contain at least one lowercase letter",
            code="WEAK_PASSWORD",
            status_code=422,
        )
    if not re.search(r"\d", password):
        raise AppException(
            message="Password must contain at least one digit",
            code="WEAK_PASSWORD",
            status_code=422,
        )
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=/~`\[\]\\]", password):
        raise AppException(
            message="Password must contain at least one special character",
            code="WEAK_PASSWORD",
            status_code=422,
        )


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2id hash."""
    return password_hasher.verify(plain_password, hashed_password)


def create_access_token(
    subject: str | uuid.UUID,
    role: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Generate a signed short-lived JWT access token."""
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))

    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": str(uuid.uuid4()),
    }

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT access token.

    Raises AppException on expiration, tampering, or invalid token structure.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["sub", "exp", "role"]},
        )
        if payload.get("type") != "access":
            raise AppException(
                message="Invalid token type",
                code="INVALID_TOKEN",
                status_code=401,
            )
        return payload
    except jwt.ExpiredSignatureError as exc:
        raise AppException(
            message="Authentication token has expired",
            code="TOKEN_EXPIRED",
            status_code=401,
        ) from exc
    except (jwt.InvalidTokenError, jwt.DecodeError) as exc:
        raise AppException(
            message="Invalid authentication credentials",
            code="INVALID_TOKEN",
            status_code=401,
        ) from exc


def generate_secure_token(num_bytes: int = 48) -> str:
    """Generate a high-entropy URL-safe cryptographic token (for refresh/CSRF tokens)."""
    return secrets.token_urlsafe(num_bytes)


def hash_token(token: str) -> str:
    """Generate a SHA-256 hash of a token for persistent storage.

    Plaintext tokens are NEVER persisted in PostgreSQL.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
