"""Server-enforced operational quotas and daily limits for the Private Beta.

Guarantees safety against resource abuse and unconstrained AI spend.
Frontend displays remaining quota for information only; backend is strictly authoritative.
Supports dynamic administrative adjustments: User override -> Cohort override -> Global override -> Defaults.
"""

import datetime
import uuid
from collections import defaultdict
from typing import TYPE_CHECKING, Any

import structlog

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.redis import redis_service

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger("tef-api.beta_limits")

# Fallback in-memory tracking: key -> count
_in_memory_quotas: dict[str, int] = defaultdict(int)

# In-memory effective limit cache: key -> limit_value
_in_memory_eff_limits: dict[str, int] = {}
_cache_version: int = 1

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

    _cache_version: int = 1
    _in_memory_eff_limits: dict[str, int] = _in_memory_eff_limits

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
    def _get_default_limit_value(cls, action: str) -> int:
        config = LIMIT_DEFINITIONS.get(action)
        if not config:
            return 9999
        attr = config["limit_attr"]
        return getattr(settings, attr, config["default"])

    @classmethod
    def _get_limit_value(cls, action: str) -> int:
        """Backward-compatible synchronous accessor returning default/configured limit."""
        return cls._get_default_limit_value(action)

    @classmethod
    async def get_effective_limit(
        cls,
        user_id: uuid.UUID | str,
        action: str,
        db: AsyncSession | None = None,
    ) -> int:
        """Determines the effective rate limit for a user with resolution hierarchy:

        1. Student User Override (in DB)
        2. Cohort Override (in DB)
        3. Global Override (in DB)
        4. Application Default (in settings/config)
        """
        if action not in LIMIT_DEFINITIONS:
            return 9999

        cache_key = f"{user_id}:{action}:{cls._cache_version}"
        if cache_key in cls._in_memory_eff_limits:
            return cls._in_memory_eff_limits[cache_key]

        # Try Redis cache
        redis_cache_key = f"tef:beta:eff_limit:{user_id}:{action}:{cls._cache_version}"
        try:
            cached_val = await redis_service.client.get(redis_cache_key)
            if cached_val is not None:
                val = int(cached_val)
                cls._in_memory_eff_limits[cache_key] = val
                return val
        except Exception as exc:  # noqa: BLE001
            logger.debug("redis_eff_limit_get_failed", error=str(exc))

        # Query database for overrides
        db_val: int | None = await cls._resolve_from_db(user_id, action, db=db)
        effective_val = db_val if db_val is not None else cls._get_default_limit_value(action)

        cls._in_memory_eff_limits[cache_key] = effective_val
        try:
            await redis_service.client.set(redis_cache_key, str(effective_val), ex=300)
        except Exception as exc:  # noqa: BLE001
            logger.debug("redis_eff_limit_set_failed", error=str(exc))

        return effective_val

    @classmethod
    async def _resolve_from_db(
        cls,
        user_id: uuid.UUID | str,
        action: str,
        db: AsyncSession | None = None,
    ) -> int | None:
        if db is not None:
            return await cls._query_db_hierarchy(db, user_id, action)

        try:
            from app.core.database import async_session_factory

            async with async_session_factory() as session:
                return await cls._query_db_hierarchy(session, user_id, action)
        except Exception as exc:  # noqa: BLE001
            logger.debug("resolve_limit_db_query_error", error=str(exc))
            return None

    @classmethod
    async def _query_db_hierarchy(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID | str,
        action: str,
    ) -> int | None:
        from sqlalchemy import select

        from app.modules.admin.beta_models import BetaRateLimit
        from app.modules.users.models import User

        user_uuid: uuid.UUID | None = None
        try:
            user_uuid = uuid.UUID(str(user_id))
        except (ValueError, TypeError):
            pass

        if user_uuid:
            # 1. User level override
            user_stmt = select(BetaRateLimit.limit_value).where(
                BetaRateLimit.scope == "user",
                BetaRateLimit.user_id == user_uuid,
                BetaRateLimit.action == action,
            )
            user_res = (await session.execute(user_stmt)).scalar_one_or_none()
            if user_res is not None:
                return user_res

            # 2. Cohort level override
            cohort_stmt = select(User.beta_cohort_id).where(User.id == user_uuid)
            cohort_id = (await session.execute(cohort_stmt)).scalar_one_or_none()
            if cohort_id:
                c_limit_stmt = select(BetaRateLimit.limit_value).where(
                    BetaRateLimit.scope == "cohort",
                    BetaRateLimit.cohort_id == cohort_id,
                    BetaRateLimit.action == action,
                )
                cohort_res = (await session.execute(c_limit_stmt)).scalar_one_or_none()
                if cohort_res is not None:
                    return cohort_res

        # 3. Global level override
        global_stmt = select(BetaRateLimit.limit_value).where(
            BetaRateLimit.scope == "global",
            BetaRateLimit.action == action,
        )
        return (await session.execute(global_stmt)).scalar_one_or_none()

    @classmethod
    def set_in_memory_override(
        cls,
        user_id: uuid.UUID | str,
        action: str,
        limit_value: int,
    ) -> None:
        """Directly set in-memory cached limit (useful for testing and fast sync)."""
        cache_key = f"{user_id}:{action}:{cls._cache_version}"
        cls._in_memory_eff_limits[cache_key] = limit_value

    @classmethod
    async def invalidate_cache(
        cls,
        user_id: uuid.UUID | str | None = None,
        action: str | None = None,
    ) -> None:
        """Invalidates cached rate limits across memory and Redis."""
        cls._cache_version += 1
        cls._in_memory_eff_limits.clear()
        try:
            if user_id and action:
                await redis_service.client.delete(
                    f"tef:beta:eff_limit:{user_id}:{action}:{cls._cache_version - 1}"
                )
        except Exception as exc:  # noqa: BLE001
            logger.debug("redis_invalidate_failed", error=str(exc))

    @classmethod
    async def reset_user_consumption(
        cls,
        user_id: uuid.UUID | str,
        action: str | None = None,
    ) -> None:
        """Resets quota usage for a user today/this week for a specific action or all actions."""
        actions_to_reset = [action] if action else list(LIMIT_DEFINITIONS.keys())
        for act in actions_to_reset:
            cfg = LIMIT_DEFINITIONS.get(act)
            if not cfg:
                continue
            window = cfg["window"]
            window_str = cls._get_window_key(window)
            rate_key = f"tef:beta:quota:{act}:{user_id}:{window_str}"
            _in_memory_quotas.pop(rate_key, None)
            try:
                await redis_service.client.delete(rate_key)
            except Exception as exc:  # noqa: BLE001
                logger.debug("redis_reset_quota_failed", error=str(exc))

    @classmethod
    async def check_and_increment(
        cls,
        user_id: uuid.UUID | str,
        action: str,
        amount: int = 1,
        db: AsyncSession | None = None,
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

        limit = await cls.get_effective_limit(user_id, action, db=db)
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
    async def get_user_status(
        cls,
        user_id: uuid.UUID | str,
        db: AsyncSession | None = None,
    ) -> dict[str, Any]:
        """Returns current quota consumption for all actions for this user."""
        status: dict[str, Any] = {}
        for action, config in LIMIT_DEFINITIONS.items():
            limit = await cls.get_effective_limit(user_id, action, db=db)
            window = config["window"]
            window_str = cls._get_window_key(window)
            rate_key = f"tef:beta:quota:{action}:{user_id}:{window_str}"

            consumed = 0
            try:
                redis_client = redis_service.client
                val = await redis_client.get(rate_key)
                if val:
                    consumed = int(val)
            except Exception as exc:  # noqa: BLE001
                logger.debug("redis_get_status_failed", error=str(exc))
                consumed = _in_memory_quotas.get(rate_key, 0)

            default_val = cls._get_default_limit_value(action)
            is_custom = limit != default_val

            status[action] = {
                "name": config["name_fr"],
                "limit": limit,
                "consumed": consumed,
                "remaining": max(0, limit - consumed),
                "window": window,
                "is_custom": is_custom,
            }

        return status
