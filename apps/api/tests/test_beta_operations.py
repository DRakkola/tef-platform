"""Tests for Private Beta Operations, Access Control, Invitations, Quotas, and Kill-Switches."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.beta_limits import BetaLimitsService
from app.core.exceptions import AppException
from app.core.feature_flags import FeatureFlagManager
from app.modules.admin.beta_models import BetaCohort
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


@pytest.mark.asyncio
async def test_admin_beta_rates_config_and_authorization(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    student_auth_headers: dict[str, str],
) -> None:
    """Admin can get beta rate configurations; students are forbidden."""
    # Forbidden for students
    forbidden_res = await client.get("/api/v1/admin/beta/rates", headers=student_auth_headers)
    assert forbidden_res.status_code == 403

    # Success for admin
    res = await client.get("/api/v1/admin/beta/rates", headers=admin_auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "actions" in data
    assert "ai_oral" in data["actions"]
    assert "ai_writing" in data["actions"]
    assert "global_limits" in data
    assert "cohort_limits" in data
    assert "student_overrides" in data


@pytest.mark.asyncio
async def test_admin_adjust_global_rate(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    """Admin can adjust global beta rates, persist in DB, and reset to defaults."""
    # 1. Update global rate for ai_writing to 8
    res = await client.put(
        "/api/v1/admin/beta/rates/global",
        headers=admin_auth_headers,
        json={"action": "ai_writing", "limit_value": 8},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["scope"] == "global"
    assert data["action"] == "ai_writing"
    assert data["limit_value"] == 8

    # Verify effective limit reflects new global rate
    fake_user_id = str(uuid.uuid4())
    effective = await BetaLimitsService.get_effective_limit(fake_user_id, "ai_writing", db=db_session)
    assert effective == 8

    # 2. Check audit log
    audit_stmt = select(AuditEvent).where(AuditEvent.action == "UPDATE_BETA_GLOBAL_RATE")
    audit = (await db_session.execute(audit_stmt)).scalars().all()
    assert len(audit) >= 1

    # 3. Delete global override (revert to default)
    del_res = await client.delete("/api/v1/admin/beta/rates/global/ai_writing", headers=admin_auth_headers)
    assert del_res.status_code == 200

    effective_after = await BetaLimitsService.get_effective_limit(fake_user_id, "ai_writing", db=db_session)
    assert effective_after == 3  # Default value


@pytest.mark.asyncio
async def test_admin_adjust_cohort_rate(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    """Admin can adjust rate limit for a specific cohort."""
    # 1. Create a test cohort
    cohort = BetaCohort(
        name="Cohorte Quota Test",
        max_students=20,
        max_teachers=5,
        is_active=True,
    )
    db_session.add(cohort)
    await db_session.flush()

    # 2. Student in this cohort
    student = User(
        email="cohort_student_quota@example.com",
        password_hash="hashed",
        role=UserRole.STUDENT,
        beta_cohort_id=cohort.id,
        is_active=True,
    )
    db_session.add(student)
    await db_session.commit()

    # 3. Set cohort rate for ai_oral = 15
    res = await client.put(
        "/api/v1/admin/beta/rates/cohort",
        headers=admin_auth_headers,
        json={
            "cohort_id": str(cohort.id),
            "action": "ai_oral",
            "limit_value": 15,
        },
    )
    assert res.status_code == 200
    assert res.json()["limit_value"] == 15

    # Member student gets 15
    student_limit = await BetaLimitsService.get_effective_limit(student.id, "ai_oral", db=db_session)
    assert student_limit == 15

    # Other student outside cohort gets default 5
    other_user_id = str(uuid.uuid4())
    other_limit = await BetaLimitsService.get_effective_limit(other_user_id, "ai_oral", db=db_session)
    assert other_limit == 5

    # 4. Clean up cohort override
    del_res = await client.delete(
        f"/api/v1/admin/beta/rates/cohort/{cohort.id}/ai_oral",
        headers=admin_auth_headers,
    )
    assert del_res.status_code == 200


@pytest.mark.asyncio
async def test_admin_adjust_student_rate_enforcement_and_reset(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    """Admin sets custom student rate, quota enforces it, and admin can reset consumption."""

    student = User(
        email="custom_limit_student@example.com",
        password_hash="hashed",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db_session.add(student)
    await db_session.commit()
    await db_session.refresh(student)

    # 1. Admin sets student rate for ai_writing = 2
    res = await client.put(
        "/api/v1/admin/beta/rates/student",
        headers=admin_auth_headers,
        json={
            "user_id": str(student.id),
            "action": "ai_writing",
            "limit_value": 2,
            "notes": "Plan spécial entraînement intensif",
        },
    )
    assert res.status_code == 200
    assert res.json()["limit_value"] == 2
    assert res.json()["user_email"] == "custom_limit_student@example.com"

    # 2. Check effective limit
    eff = await BetaLimitsService.get_effective_limit(student.id, "ai_writing", db=db_session)
    assert eff == 2

    # 3. Consume quota
    c1 = await BetaLimitsService.check_and_increment(student.id, "ai_writing", 1, db=db_session)
    assert c1 == 1
    c2 = await BetaLimitsService.check_and_increment(student.id, "ai_writing", 1, db=db_session)
    assert c2 == 2

    # 3rd consumption must fail with 429
    with pytest.raises(AppException) as exc_info:
        await BetaLimitsService.check_and_increment(student.id, "ai_writing", 1, db=db_session)
    assert exc_info.value.status_code == 429

    # 4. Admin resets student quota
    reset_res = await client.post(
        f"/api/v1/admin/beta/rates/student/{student.id}/reset",
        headers=admin_auth_headers,
        json={"action": "ai_writing", "reason": "Accident technique réinitialisé"},
    )
    assert reset_res.status_code == 200
    data = reset_res.json()
    assert data["quotas"]["ai_writing"]["consumed"] == 0
    assert data["quotas"]["ai_writing"]["remaining"] == 2

    # 5. After reset, student can consume again!
    c_after = await BetaLimitsService.check_and_increment(student.id, "ai_writing", 1, db=db_session)
    assert c_after == 1


@pytest.mark.asyncio
async def test_admin_list_students_rates_status(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    """Admin can list all students with live consumption rates."""
    res = await client.get("/api/v1/admin/beta/rates/students?limit=10", headers=admin_auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "students" in data
    assert isinstance(data["students"], list)
    if data["students"]:
        student_obj = data["students"][0]
        assert "quotas" in student_obj
        assert "ai_oral" in student_obj["quotas"]
        assert "limit" in student_obj["quotas"]["ai_oral"]

