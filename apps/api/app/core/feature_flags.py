"""Dynamic feature flags and emergency kill-switch manager.

Allows disabling high-cost or unstable features at runtime without requiring deployments.
State is stored in Redis with fallback to config.py defaults.
"""

import json
from typing import Any

import structlog
from fastapi import HTTPException

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.redis import redis_service

logger = structlog.get_logger("tef-api.feature_flags")

# Default feature flags defined from static settings
DEFAULT_FLAGS: dict[str, bool] = {
    "ai_speaking": settings.FEATURE_FLAG_AI_SPEAKING,
    "ai_writing": settings.FEATURE_FLAG_AI_WRITING,
    "practice_pool": settings.FEATURE_FLAG_PRACTICE_POOL,
    "teacher_bookings": settings.FEATURE_FLAG_TEACHER_BOOKINGS,
    "checkout": settings.FEATURE_FLAG_CHECKOUT,
    "maintenance_mode": settings.MAINTENANCE_MODE,
}

REDIS_FLAGS_KEY = "tef:system:feature_flags"


class FeatureFlagManager:
    """Manages dynamic feature flag state via Redis with graceful in-memory fallback."""

    @classmethod
    async def get_all_flags(cls) -> dict[str, bool]:
        """Retrieve all active feature flags."""
        flags = dict(DEFAULT_FLAGS)
        try:
            cached = await redis_service.get(REDIS_FLAGS_KEY)
            if cached:
                overrides = json.loads(cached)
                if isinstance(overrides, dict):
                    flags.update({k: bool(v) for k, v in overrides.items() if k in DEFAULT_FLAGS})
        except Exception:
            pass

        return flags

    @classmethod
    async def is_enabled(cls, flag_name: str) -> bool:
        """Check whether a given feature flag is enabled."""
        all_flags = await cls.get_all_flags()
        return all_flags.get(flag_name, False)

    @classmethod
    async def set_flag(cls, flag_name: str, enabled: bool) -> dict[str, bool]:
        """Update a feature flag state in Redis with memory fallback."""
        if flag_name not in DEFAULT_FLAGS:
            raise AppException(
                message=f"Unknown feature flag: '{flag_name}'. Valid flags: {list(DEFAULT_FLAGS.keys())}",
                code="INVALID_FEATURE_FLAG",
                status_code=400,
            )

        current_flags = await cls.get_all_flags()
        current_flags[flag_name] = enabled

        try:
            await redis_service.set(REDIS_FLAGS_KEY, json.dumps(current_flags))
        except Exception:
            pass

        # Also update in-memory defaults for fallback
        DEFAULT_FLAGS[flag_name] = enabled
        logger.info("feature_flag_updated", flag=flag_name, enabled=enabled)
        return current_flags


def require_feature(flag_name: str):
    """FastAPI dependency to reject requests when a feature is toggled off."""

    async def _dependency():
        # Maintenance mode check
        if await FeatureFlagManager.is_enabled("maintenance_mode"):
            raise AppException(
                message="Platform is currently undergoing scheduled maintenance. Please try again shortly.",
                code="MAINTENANCE_MODE",
                status_code=503,
            )

        if not await FeatureFlagManager.is_enabled(flag_name):
            raise AppException(
                message=f"Feature '{flag_name}' is temporarily disabled for operational maintenance.",
                code="FEATURE_DISABLED",
                status_code=503,
            )

    return _dependency
