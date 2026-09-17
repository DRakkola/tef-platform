"""Tests proving Redis client abstraction and health checks."""

from unittest.mock import AsyncMock

import pytest

from app.core.redis import RedisService


@pytest.mark.asyncio
async def test_redis_service_operations():
    """Test Redis set, get, delete methods with mocked connection."""
    service = RedisService("redis://mock:6379/0")
    mock_client = AsyncMock()
    mock_client.set.return_value = True
    mock_client.get.return_value = "test_value"
    mock_client.delete.return_value = 1
    mock_client.ping.return_value = True

    service._client = mock_client

    assert await service.set("key", "val") is True
    mock_client.set.assert_awaited_once_with("key", "val", ex=None)

    assert await service.get("key") == "test_value"
    mock_client.get.assert_awaited_once_with("key")

    assert await service.delete("key") == 1
    mock_client.delete.assert_awaited_once_with("key")

    assert await service.check_health() is True
    mock_client.ping.assert_awaited_once()


@pytest.mark.asyncio
async def test_redis_health_failure():
    """Test Redis health returns False when connection raises an error."""
    service = RedisService("redis://mock:6379/0")
    mock_client = AsyncMock()
    mock_client.ping.side_effect = ConnectionError("Redis down")
    service._client = mock_client

    assert await service.check_health() is False
