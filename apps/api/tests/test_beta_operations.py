"""Tests for Private Beta Operations, Access Control, Invitations, Quotas, and Kill-Switches."""

import datetime
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.beta_limits import BetaLimitsService
from app.core.config import settings
from app.core.exceptions import AppException
from app.core.feature_flags import FeatureFlagManager
from app.modules.admin.beta_models import BetaCohort, BetaInvitation
from app.modules.admin.models import AuditEvent
from app.modules.users.models import User, UserRole


@pytest.mark.asyncio
async def test_create_beta_cohort_and_invitation(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    """Admin can create cohorts and generate cryptographic invitations."""
    # 1. Create cohort
    cohort_res = await client.post(
        "/api/v1/admin/beta/cohorts",
        headers=admin_auth_headers,
        json={
            "name": "Cohorte Bêta Octobre 2026",
            "description": "Première cohorte de validation pilote",
            "max_students": 50,
            "max_teachers": 15,
        },
    )
    assert cohort_res.status_code == 201
    cohort_data = cohort_res.json()
    cohort_id = cohort_data["id"]
    assert cohort_data["name"] == "Cohorte Bêta Octobre 2026"

    # 2. Generate invitation
    invite_res = await client.post(
        "/api/v1/admin/beta/invitations",
        headers=admin_auth_headers,
        json={
            "cohort_id": cohort_id,
            "role": "student",
            "max_uses": 1,
            "valid_days": 14,
        },
    )
    assert invite_res.status_code == 201
    invite_data = invite_res.json()
    assert "plaintext_token" in invite_data
    raw_token = invite_data["plaintext_token"]
    assert raw_token.startswith("tef_beta_")

    # Verify audit event was logged
    audit_stmt = select(AuditEvent).where(AuditEvent.action == "GENERATE_BETA_INVITATION")
    audit = (await db_session.execute(audit_stmt)).scalar_one_or_none()
    assert audit is not None


@pytest.mark.asyncio
async def test_redeem_beta_invitation_registration(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    """Student registration redeems invitation code and joins cohort."""
    # 1. Generate invitation
    invite_res = await client.post(
        "/api/v1/admin/beta/invitations",
        headers=admin_auth_headers,
        json={"role": "student", "max_uses": 1, "valid_days": 7},
    )
    assert invite_res.status_code == 201
    raw_token = invite_res.json()["plaintext_token"]

    # 2. Register using the invitation token
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "beta_student_pilot@example.com",
            "password": "SecurePassword2026!",
            "role": "student",
            "invitation_code": raw_token,
        },
    )
    assert reg_res.status_code == 201
    user_data = reg_res.json()["user"]
    assert user_data["email"] == "beta_student_pilot@example.com"

    # Verify user state in DB
    user_stmt = select(User).where(User.email == "beta_student_pilot@example.com")
    user = (await db_session.execute(user_stmt)).scalar_one()
    assert user.is_beta_user is True

    # 3. Attempt to reuse exhausted single-use invitation should fail
    fail_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "another_pilot@example.com",
            "password": "SecurePassword2026!",
            "role": "student",
            "invitation_code": raw_token,
        },
    )
    assert fail_res.status_code == 400
    err_body = fail_res.json()
    assert "BETA_INVITATION_EXHAUSTED" in (err_body.get("error", {}).get("code") or err_body.get("code", ""))


@pytest.mark.asyncio
async def test_beta_limits_quota_enforcement() -> None:
    """Server-side beta limits enforce quotas and raise 429 when exhausted."""
    import uuid

    test_user_id = str(uuid.uuid4())

    # AI Oral limit is 5/day
    for _ in range(5):
        current = await BetaLimitsService.check_and_increment(test_user_id, "ai_oral", amount=1)
        assert current <= 5

    # 6th attempt must raise 429
    with pytest.raises(AppException) as exc_info:
        await BetaLimitsService.check_and_increment(test_user_id, "ai_oral", amount=1)
    assert exc_info.value.status_code == 429
    assert exc_info.value.code == "BETA_QUOTA_EXCEEDED"

    # Check status inspection
    status = await BetaLimitsService.get_user_status(test_user_id)
    assert "ai_oral" in status
    assert status["ai_oral"]["limit"] == 5
    assert status["ai_oral"]["remaining"] == 0


@pytest.mark.asyncio
async def test_emergency_kill_switch_and_user_suspension(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    """Admin can toggle feature flags and suspend abusive users with audit trail."""
    # 1. Toggle AI Writing feature
    toggle_res = await client.post(
        "/api/v1/admin/beta/controls/toggle-feature",
        headers=admin_auth_headers,
        json={"feature_name": "ai_writing", "enabled": False},
    )
    assert toggle_res.status_code == 200
    assert toggle_res.json()["flags"]["ai_writing"] is False

    # Check feature flag manager reflects this
    assert await FeatureFlagManager.is_enabled("ai_writing") is False

    # Re-enable
    await client.post(
        "/api/v1/admin/beta/controls/toggle-feature",
        headers=admin_auth_headers,
        json={"feature_name": "ai_writing", "enabled": True},
    )
    assert await FeatureFlagManager.is_enabled("ai_writing") is True

    # 2. Suspend a student
    student = User(
        email="spammer@example.com",
        password_hash="hash",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db_session.add(student)
    await db_session.commit()
    await db_session.refresh(student)

    suspend_res = await client.post(
        "/api/v1/admin/beta/controls/suspend-user",
        headers=admin_auth_headers,
        json={
            "user_id": str(student.id),
            "suspended": True,
            "reason": "Abusive requests in practice pool",
        },
    )
    assert suspend_res.status_code == 200
    assert suspend_res.json()["is_active"] is False

    await db_session.refresh(student)
    assert student.is_active is False


@pytest.mark.asyncio
async def test_admin_beta_overview(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
) -> None:
    """Admin beta overview endpoint returns operational metrics."""
    res = await client.get("/api/v1/admin/beta/overview", headers=admin_auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_beta_users" in data
    assert "feature_flags" in data
    assert "ai_total_cost_usd" in data
    assert "server_timestamp" in data
