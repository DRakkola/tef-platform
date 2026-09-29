"""Core security utilities: Argon2 password hashing, JWT operations, and token hashing."""

import hashlib
import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
import structlog
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.config import settings
from app.core.exceptions import AppException

logger = structlog.get_logger("tef-api.security")

# Argon2id password hasher
password_hasher = PasswordHash((Argon2Hasher(),))

# Pre-computed dummy Argon2id hash for timing-safe account enumeration defense
DUMMY_PASSWORD_HASH = password_hasher.hash("DummyPasswordForTimingSafety123!")

# In-memory fallback for revoked token JTIs when Redis is unreachable
_revoked_tokens_in_memory: set[str] = set()


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


def verify_password_timing_safe(plain_password: str, hashed_password: str | None) -> bool:
    """Verify password in constant-time against a dummy hash when account does not exist.

    Eliminates side-channel timing differences preventing account enumeration.
    """
    if hashed_password is None:
        # Compute Argon2 on dummy hash to consume equivalent CPU/time (~80ms)
        password_hasher.verify(plain_password, DUMMY_PASSWORD_HASH)
        return False
    return password_hasher.verify(plain_password, hashed_password)


async def revoke_token_jti(jti: str, ttl_seconds: int = 900) -> None:
    """Blacklist a JWT JTI in Redis (with in-memory fallback) until natural expiry."""
    _revoked_tokens_in_memory.add(jti)
    try:
        from app.core.redis import redis_service

        await redis_service.set(f"revoked_token:{jti}", "1", expire=ttl_seconds)
    except Exception as exc:  # noqa: BLE001
        logger.debug("redis_revoke_token_fallback", error=str(exc))


async def is_token_revoked(jti: str | None) -> bool:
    """Check if a JWT JTI has been revoked prior to expiration."""
    if not jti:
        return False
    if jti in _revoked_tokens_in_memory:
        return True
    try:
        from app.core.redis import redis_service

        val = await redis_service.get(f"revoked_token:{jti}")
        return val is not None
    except Exception:  # noqa: BLE001
        return False


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


_jwks_client: jwt.PyJWKClient | None = None


def get_jwks_client() -> jwt.PyJWKClient:
    """Return cached PyJWKClient instance for Supabase JWKS verification."""
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(
            settings.supabase_jwks_endpoint,
            cache_keys=True,
            max_cached_keys=16,
        )
    return _jwks_client


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT access token from Supabase Auth or internal signer.

    Supports:
    1. Supabase GoTrue ES256/RS256 asymmetric JWKS
    2. Supabase symmetric HS256 secret (if configured)
    3. Internal platform HS256 secret (for testing & backward compatibility)

    Raises AppException on expiration, tampering, or invalid token structure.
    """
    try:
        header = jwt.get_unverified_header(token)
    except Exception as exc:
        raise AppException(
            message="Invalid authentication credentials",
            code="INVALID_TOKEN",
            status_code=401,
        ) from exc

    # Path 1: Check Supabase JWKS if token has key ID ('kid') or asymmetric algorithm
    if header.get("kid") or header.get("alg") in ("ES256", "RS256"):
        try:
            jwks_client = get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256"],
                options={"require": ["sub", "exp"], "verify_aud": False},
            )
            # Verify audience if present in claims
            aud = payload.get("aud")
            if aud:
                aud_list = [aud] if isinstance(aud, str) else aud
                if "authenticated" not in aud_list:
                    raise AppException(
                        message="Invalid token audience",
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
        except AppException:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.debug("supabase_jwks_verification_fallback", error=str(exc))

    # Path 2: Check Supabase JWT secret if configured (HS256)
    if settings.SUPABASE_JWT_SECRET and header.get("alg") == "HS256":
        try:
            return jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"require": ["sub", "exp"], "verify_aud": False},
            )
        except jwt.ExpiredSignatureError as exc:
            raise AppException(
                message="Authentication token has expired",
                code="TOKEN_EXPIRED",
                status_code=401,
            ) from exc
        except Exception:  # noqa: S110, BLE001
            pass

    # Path 3: Internal platform secret verification (HS256)
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["sub", "exp"]},
        )
        if payload.get("type") and payload.get("type") != "access":
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
    except AppException:
        raise
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
