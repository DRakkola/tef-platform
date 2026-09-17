"""Smoke tests verifying the complete suite of domain modules are mounted and responsive."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_notifications_endpoints(
    client: AsyncClient, student_auth_headers: dict[str, str]
) -> None:
    """Notifications endpoints return valid responses for authenticated users."""
    resp = await client.get(
        "/api/v1/notifications",
        headers=student_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "unread_count" in data


@pytest.mark.asyncio
async def test_billing_endpoints(client: AsyncClient, student_auth_headers: dict[str, str]) -> None:
    """Billing endpoints return subscription and credit information."""
    sub_resp = await client.get(
        "/api/v1/billing/subscription",
        headers=student_auth_headers,
    )
    assert sub_resp.status_code == 200
    sub_data = sub_resp.json()
    assert sub_data["plan_tier"] == "free"
    assert sub_data["status"] == "active"

    cred_resp = await client.get(
        "/api/v1/billing/credits",
        headers=student_auth_headers,
    )
    assert cred_resp.status_code == 200
    cred_data = cred_resp.json()
    assert "speaking_credits" in cred_data
    assert "writing_credits" in cred_data


@pytest.mark.asyncio
async def test_exercises_module_endpoint(
    client: AsyncClient, student_auth_headers: dict[str, str]
) -> None:
    """Exercises endpoint returns published exercises."""
    resp = await client.get(
        "/api/v1/exercises",
        headers=student_auth_headers,
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_admin_system_overview_rbac(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    admin_auth_headers: dict[str, str],
) -> None:
    """Admin endpoints reject standard students with 403 Forbidden, but allow admin."""
    forbidden_resp = await client.get(
        "/api/v1/admin/system-overview",
        headers=student_auth_headers,
    )
    assert forbidden_resp.status_code == 403

    allowed_resp = await client.get(
        "/api/v1/admin/system-overview",
        headers=admin_auth_headers,
    )
    assert allowed_resp.status_code == 200
    assert allowed_resp.json()["status"] == "operational"
