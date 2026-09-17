"""Tests for liveness, readiness, and system status endpoints."""

from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_live(client: AsyncClient):
    """Test that /health/live reports 200 OK."""
    response = await client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "live"
    assert data["service"] == "tef-api"
    assert "X-Request-ID" in response.headers


@pytest.mark.asyncio
async def test_health_ready_all_healthy(client: AsyncClient):
    """Test that /health/ready returns 200 when all dependencies are healthy."""
    with (
        patch("app.main.check_db_health", return_value=True),
        patch("app.main.check_redis_health", return_value=True),
        patch("app.main.check_storage_health", return_value=True),
    ):
        response = await client.get("/health/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert data["dependencies"]["database"] == "healthy"
        assert data["dependencies"]["redis"] == "healthy"
        assert data["dependencies"]["storage"] == "healthy"


@pytest.mark.asyncio
async def test_health_ready_degraded(client: AsyncClient):
    """Test that /health/ready returns 503 when a dependency is unhealthy."""
    with (
        patch("app.main.check_db_health", return_value=True),
        patch("app.main.check_redis_health", return_value=False),
        patch("app.main.check_storage_health", return_value=True),
    ):
        response = await client.get("/health/ready")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "degraded"
        assert data["dependencies"]["redis"] == "unhealthy"
        assert data["dependencies"]["database"] == "healthy"


@pytest.mark.asyncio
async def test_api_v1_status(client: AsyncClient):
    """Test that /api/v1/status returns system platform metadata."""
    response = await client.get("/api/v1/status")
    assert response.status_code == 200
    data = response.json()
    assert data["platform"] == "tef-platform"
    assert data["baselines"]["postgres"] == "18"
    assert data["baselines"]["python"] == "3.14"
