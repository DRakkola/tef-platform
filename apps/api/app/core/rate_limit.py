"""Rate limiting for authentication endpoints using Redis with in-memory fallback."""

import time
from collections import defaultdict

import structlog
from fastapi import Request

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.redis import redis_service

logger = structlog.get_logger("tef-api.rate_limit")

# In-memory fallback tracking: key -> list of timestamps
_in_memory_limits: dict[str, list[float]] = defaultdict(list)


def get_client_ip(request: Request) -> str:
    """Extract real client IP address respecting trusted reverse proxy headers."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # First IP in X-Forwarded-For is the originating client address
        client_ip = forwarded_for.split(",")[0].strip()
        if client_ip:
            return client_ip

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    return request.client.host if request.client else "unknown"


# Default limits per minute by category
DEFAULT_CATEGORY_LIMITS: dict[str, int] = {
    "auth": 10,
    "password_reset": 3,
    "assessment_mutations": 60,
    "writing_submissions": 10,
    "ai_operations": 10,
    "speaking_sessions": 5,
    "practice_pool": 15,
    "booking": 10,
    "billing": 15,
    "admin_apis": 60,
    "default": 30,
}


async def check_rate_limit(
    request: Request,
    key_prefix: str = "auth_rate",
    limit: int | None = None,
    window_seconds: int = 60,
    identifier: str | None = None,
) -> None:
    """Enforce rate limiting by client IP or authenticated entity identifier.

    Raises AppException 429 if the request limit is exceeded within window_seconds.
    """
    if settings.ENVIRONMENT == "testing":
        return

    client_id = identifier or get_client_ip(request)
    effective_limit = limit or DEFAULT_CATEGORY_LIMITS.get(key_prefix, DEFAULT_CATEGORY_LIMITS["default"])
    rate_key = f"{key_prefix}:{client_id}"

    # Try Redis first
    try:
        redis_client = redis_service.client
        current_count = await redis_client.incr(rate_key)
        if current_count == 1:
            await redis_client.expire(rate_key, window_seconds)

        if current_count > effective_limit:
            logger.warning(
                "rate_limit_exceeded_redis",
                key_prefix=key_prefix,
                identifier=client_id,
                count=current_count,
                limit=effective_limit,
            )
            raise AppException(
                message=f"Too many requests for {key_prefix.replace('_', ' ')}. Please try again later.",
                code="RATE_LIMIT_EXCEEDED",
                status_code=429,
            )
        return
    except AppException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.debug("redis_rate_limit_fallback", error=str(exc))

    # In-memory fallback
    now = time.time()
    timestamps = _in_memory_limits[rate_key]
    _in_memory_limits[rate_key] = [t for t in timestamps if now - t < window_seconds]

    if len(_in_memory_limits[rate_key]) >= effective_limit:
        logger.warning(
            "rate_limit_exceeded_in_memory",
            key_prefix=key_prefix,
            identifier=client_id,
            limit=effective_limit,
        )
        raise AppException(
            message=f"Too many requests for {key_prefix.replace('_', ' ')}. Please try again later.",
            code="RATE_LIMIT_EXCEEDED",
            status_code=429,
        )

    _in_memory_limits[rate_key].append(now)

