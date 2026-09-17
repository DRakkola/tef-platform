"""Centralized async Redis client abstraction and health checks."""

from typing import Any

import redis.asyncio as aioredis
import structlog

from app.core.config import settings

logger = structlog.get_logger("tef-api.redis")


class RedisService:
    """Centralized wrapper around async Redis connection pool."""

    def __init__(self, url: str) -> None:
        self.url = url
        self._pool: aioredis.ConnectionPool | None = None
        self._client: aioredis.Redis | None = None

    @property
    def client(self) -> aioredis.Redis:
        if self._client is None:
            self._pool = aioredis.ConnectionPool.from_url(
                self.url,
                decode_responses=True,
                max_connections=20,
            )
            self._client = aioredis.Redis(connection_pool=self._pool)
        return self._client

    async def get(self, key: str) -> Any:
        return await self.client.get(key)

    async def set(
        self,
        key: str,
        value: str,
        expire: int | None = None,
    ) -> bool:
        return bool(await self.client.set(key, value, ex=expire))

    async def delete(self, key: str) -> int:
        return int(await self.client.delete(key))

    async def check_health(self) -> bool:
        """Ping Redis to verify server connectivity."""
        try:
            return bool(await self.client.ping())
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_health_check_failed", error=str(exc))
            return False

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
        if self._pool:
            await self._pool.disconnect()


redis_service = RedisService(settings.REDIS_URL)


async def check_redis_health() -> bool:
    """Helper for FastAPI readiness probes."""
    return await redis_service.check_health()
