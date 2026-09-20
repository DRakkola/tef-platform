"""Server-enforced operational quotas and daily limits for the Private Beta.

Guarantees safety against resource abuse and unconstrained AI spend.
Frontend displays remaining quota for information only; backend is strictly authoritative.
"""

import datetime
import uuid
from collections import defaultdict
from typing import Any

import structlog

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.redis import redis_service

logger = structlog.get_logger("tef-api.beta_limits")

# Fallback in-memory tracking: key -> count
_in_memory_quotas: dict[str, int] = defaultdict(int)

# Default limit mapping
LIMIT_DEFINITIONS: dict[str, dict[str, Any]] = {
    "ai_oral": {
        "limit_attr": "BETA_MAX_AI_SESSIONS_PER_DAY",
        "default": 5,
        "window": "daily",
        "name_fr": "Sessions orales avec jury IA",
    },
    "ai_writing": {
        "limit_attr": "BETA_MAX_AI_WRITING_PER_DAY",
        "default": 3,
        "window": "daily",
        "name_fr": "Corrections de rédaction par IA",
    },
    "practice_pool": {
        "limit_attr": "BETA_MAX_PRACTICE_POOL_PER_DAY",
        "default": 4,
        "window": "daily",
        "name_fr": "Sessions audio entre pairs (Practice Pool)",
    },
    "teacher_booking": {
        "limit_attr": "BETA_MAX_TEACHER_BOOKINGS_PER_WEEK",
        "default": 2,
        "window": "weekly",
        "name_fr": "Réservations de tuteurs par semaine",
    },
    "file_upload": {
        "limit_attr": "BETA_MAX_UPLOADS_PER_DAY",
        "default": 10,
        "window": "daily",
        "name_fr": "Téléversements de fichiers / enregistrements audio",
    },
}


class BetaLimitsService:
    """Manages and enforces server-side private beta consumption quotas."""

    @classmethod
    def _get_window_key(cls, window: str) -> str:
        now = datetime.datetime.now(datetime.UTC)
        if window == "daily":
            return now.strftime("%Y-%m-%d")
        if window == "weekly":
            # Year + ISO week number
            return f"{now.year}-W{now.isocalendar().week:02d}"
        return now.strftime("%Y-%m-%d")

    @classmethod
    def _get_limit_value(cls, action: str) -> int:
        config = LIMIT_DEFINITIONS.get(action)
        if not config:
            return 9999
        attr = config["limit_attr"]
        return getattr(settings, attr, config["default"])

    @classmethod
    async def check_and_increment(
        cls,
        user_id: uuid.UUID | str,
        action: str,
        amount: int = 1,
    ) -> int:
        """Atomically checks and increments user quota for an action.

        Raises:
            AppException(429, 'BETA_QUOTA_EXCEEDED') if quota is exhausted.
        """
        # In testing environment with bypass, skip
        if settings.ENVIRONMENT == "testing" and getattr(settings, "SKIP_BETA_LIMITS", False):
            return 0

        config = LIMIT_DEFINITIONS.get(action)
        if not config:
            return 0

        limit = cls._get_limit_value(action)
        window = config["window"]
        window_str = cls._get_window_key(window)
        ttl = 86400 * 2 if window == "daily" else 86400 * 8
        rate_key = f"tef:beta:quota:{action}:{user_id}:{window_str}"

        # 1. Try Redis
        try:
            redis_client = redis_service.client
            current = await redis_client.incrby(rate_key, amount)
            if current == amount:
                await redis_client.expire(rate_key, ttl)

            if current > limit:
                logger.warning(
                    "beta_quota_exceeded_redis",
                    user_id=str(user_id),
                    action=action,
                    current=current,
                    limit=limit,
                )
                raise AppException(
                    message=f"Plafond d'utilisation bêta atteint pour '{config['name_fr']}'. Limite autorisée : {limit} par {'jour' if window == 'daily' else 'semaine'}.",
                    code="BETA_QUOTA_EXCEEDED",
                    status_code=429,
                )
            return current
        except AppException:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.debug("redis_beta_limit_fallback", error=str(exc))

        # 2. In-memory fallback
        current_mem = _in_memory_quotas[rate_key] + amount
        if current_mem > limit:
            logger.warning(
                "beta_quota_exceeded_in_memory",
                user_id=str(user_id),
                action=action,
                current=current_mem,
                limit=limit,
            )
            raise AppException(
                message=f"Plafond d'utilisation bêta atteint pour '{config['name_fr']}'. Limite autorisée : {limit} par {'jour' if window == 'daily' else 'semaine'}.",
                code="BETA_QUOTA_EXCEEDED",
                status_code=429,
            )

        _in_memory_quotas[rate_key] = current_mem
        return current_mem

    @classmethod
    async def get_user_status(cls, user_id: uuid.UUID | str) -> dict[str, Any]:
        """Returns current quota consumption for all actions for this user."""
        status: dict[str, Any] = {}
        for action, config in LIMIT_DEFINITIONS.items():
            limit = cls._get_limit_value(action)
            window = config["window"]
            window_str = cls._get_window_key(window)
            rate_key = f"tef:beta:quota:{action}:{user_id}:{window_str}"

            consumed = 0
            try:
                redis_client = redis_service.client
                val = await redis_client.get(rate_key)
                if val:
                    consumed = int(val)
            except Exception:
                consumed = _in_memory_quotas.get(rate_key, 0)

            status[action] = {
                "name": config["name_fr"],
                "limit": limit,
                "consumed": consumed,
                "remaining": max(0, limit - consumed),
                "window": window,
            }

        return status
