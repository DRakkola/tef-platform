"""Tests for dynamic feature flags, operational switches, and support tickets."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.core.feature_flags import FeatureFlagManager, require_feature
from app.modules.admin.models import AuditEvent
from app.modules.users.models import User, UserRole


@pytest.mark.asyncio
async def test_feature_flag_manager_defaults_and_toggle():
    """Verify feature flag query and toggle in FeatureFlagManager."""
    flags = await FeatureFlagManager.get_all_flags()
    assert "ai_speaking" in flags
    assert "practice_pool" in flags
    assert "checkout" in flags

    # Toggle a flag
    prev_state = await FeatureFlagManager.is_enabled("ai_speaking")
    await FeatureFlagManager.set_flag("ai_speaking", not prev_state)
    assert await FeatureFlagManager.is_enabled("ai_speaking") == (not prev_state)

    # Revert flag
    await FeatureFlagManager.set_flag("ai_speaking", prev_state)
    assert await FeatureFlagManager.is_enabled("ai_speaking") == prev_state


@pytest.mark.asyncio
async def test_require_feature_dependency():
    """Verify require_feature dependency blocks execution when flag is disabled."""
    dep = require_feature("checkout")

    # When enabled, no exception is raised
    await FeatureFlagManager.set_flag("checkout", True)
    await dep()

    # When disabled, raises 503 FEATURE_DISABLED
    await FeatureFlagManager.set_flag("checkout", False)
    with pytest.raises(AppException) as exc_info:
        await dep()
    assert exc_info.value.status_code == 503
    assert exc_info.value.code == "FEATURE_DISABLED"

    # Restore checkout flag
    await FeatureFlagManager.set_flag("checkout", True)


@pytest.mark.asyncio
async def test_public_system_flags_endpoint(client: AsyncClient):
    """Verify GET /api/v1/system/flags returns active capability switches."""
    resp = await client.get("/api/v1/system/flags")
    assert resp.status_code == 200
    data = resp.json()
    assert "flags" in data
    assert "practice_pool" in data["flags"]
    assert "ai_writing" in data["flags"]


@pytest.mark.asyncio
async def test_admin_system_flags_endpoint(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    student_auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    """Verify PATCH /api/v1/admin/system/flags requires admin and records audit event."""
    # 1. Non-admin forbidden
    unauth_resp = await client.patch(
        "/api/v1/admin/system/flags",
        headers=student_auth_headers,
        json={"flag_name": "ai_speaking", "enabled": False},
    )
    assert unauth_resp.status_code == 403

    # 2. Admin successfully updates flag
    admin_resp = await client.patch(
        "/api/v1/admin/system/flags",
        headers=admin_auth_headers,
        json={
            "flag_name": "ai_speaking",
            "enabled": False,
            "reason": "Temporary upstream outage",
        },
    )
    assert admin_resp.status_code == 200
    data = admin_resp.json()
    assert data["flags"]["ai_speaking"] is False

    # 3. Verify AuditEvent created
    stmt = (
        select(AuditEvent)
        .where(
            AuditEvent.action == "FEATURE_FLAG_UPDATED",
            AuditEvent.entity_type == "system_feature_flag",
        )
        .order_by(AuditEvent.created_at.desc())
    )
    audit = (await db_session.execute(stmt)).scalars().first()
    assert audit is not None
    assert audit.payload["flag"] == "ai_speaking"
    assert audit.payload["enabled"] is False
    assert audit.payload["reason"] == "Temporary upstream outage"

    # 4. Restore flag
    await FeatureFlagManager.set_flag("ai_speaking", True)


@pytest.mark.asyncio
async def test_submit_support_ticket(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    """Verify POST /api/v1/support/tickets stores user feedback with diagnostic metadata."""
    payload = {
        "category": "audio_issue",
        "subject": "Microphone latency in speaking drill",
        "description": "Noticeable 2-second lag when recording responses in Chrome 128.",
        "client_metadata": {
            "browser": "Chrome",
            "os": "Windows 11",
            "sample_rate": 48000,
        },
    }
    resp = await client.post(
        "/api/v1/support/tickets",
        headers=student_auth_headers,
        json=payload,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "received"
    assert "ticket_id" in data

    # Verify audit event recorded
    ticket_id = uuid.UUID(data["ticket_id"])
    stmt = select(AuditEvent).where(AuditEvent.id == ticket_id)
    ev = (await db_session.execute(stmt)).scalar_one_or_none()
    assert ev is not None
    assert ev.action == "SUPPORT_TICKET_SUBMITTED"
    assert ev.payload["category"] == "audio_issue"
    assert ev.payload["client_metadata"]["browser"] == "Chrome"

    # Clean up test audit record
    await db_session.delete(ev)
    await db_session.commit()
