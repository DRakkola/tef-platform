"""Rate limiting for authentication endpoints using Redis with in-memory fallback."""

import time
from collections import defaultdict

import structlog
from fastapi import Request

from app.core.exceptions import AppException
from app.core.redis import redis_service

logger = structlog.get_logger("tef-api.rate_limit")

# In-memory fallback tracking: key -> list of timestamps
_in_memory_limits: dict[str, list[float]] = defaultdict(list)


async def check_rate_limit(
    request: Request,
    key_prefix: str = "auth_rate",
    limit: int = 10,
    window_seconds: int = 60,
) -> None:
    """Enforce rate limiting by client IP address.

    Raises AppException 429 if the request limit is exceeded within window_seconds.
    """
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{key_prefix}:{client_ip}"

    # Try Redis first
    try:
        redis_client = redis_service.client
        current_count = await redis_client.incr(rate_key)
        if current_count == 1:
            await redis_client.expire(rate_key, window_seconds)

        if current_count > limit:
            logger.warning("rate_limit_exceeded_redis", ip=client_ip, count=current_count)
            raise AppException(
                message="Too many requests. Please try again later.",
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
    # Prune expired timestamps
    _in_memory_limits[rate_key] = [t for t in timestamps if now - t < window_seconds]

    if len(_in_memory_limits[rate_key]) >= limit:
        logger.warning("rate_limit_exceeded_in_memory", ip=client_ip)
        raise AppException(
            message="Too many requests. Please try again later.",
            code="RATE_LIMIT_EXCEEDED",
            status_code=429,
        )

    _in_memory_limits[rate_key].append(now)
