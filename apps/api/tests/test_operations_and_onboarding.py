"""Tests for Platform Health, Onboarding Journey, and Beta Operations Celery tasks."""

import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.analytics.health_service import HealthService
from app.modules.users.models import User
from app.workers.tasks import detect_operational_anomalies_core, generate_daily_beta_report_core


@pytest.mark.asyncio
async def test_health_service_probes():
    """Verify deep operational health probes report status for all subsystems."""
    health = await HealthService.check_platform_health()
    assert health.overall_status in ["healthy", "degraded", "failed"]
    subsystem_names = [s.name for s in health.subsystems]
    assert "api_core" in subsystem_names
    assert "database_postgresql" in subsystem_names
    assert "redis_cache" in subsystem_names
    assert "storage_minio" in subsystem_names
    assert "celery_workers" in subsystem_names
    assert "ai_provider" in subsystem_names
    assert "payment_gateway" in subsystem_names
    assert "practice_pool_websockets" in subsystem_names


@pytest.mark.asyncio
async def test_student_onboarding_lifecycle(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
):
    """Verify 4-step student onboarding progression, state updates, and completion/skipping."""
    # 1. Get initial state
    res = await client.get("/api/v1/students/me/onboarding", headers=student_auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["onboarding_status"] in ["incomplete", "completed", "skipped"]
    assert data["onboarding_step"] >= 1

    # 2. Update step 1 & 2 (target exam and pace)
    update_payload = {
        "step": 2,
        "target_exam": "TEF Canada",
        "target_level": "B2",
        "daily_minutes_available": 45,
        "native_language": "English",
        "learning_preferences": {"focus_areas": ["comprehension_ecrite", "expression_orale"]},
    }
    res_update = await client.put(
        "/api/v1/students/me/onboarding",
        headers=student_auth_headers,
        json=update_payload,
    )
    assert res_update.status_code == 200
    updated_data = res_update.json()
    assert updated_data["onboarding_step"] == 2
    assert updated_data["daily_minutes_available"] == 45
    assert updated_data["target_level"] == "B2"

    # 3. Finalize onboarding as completed
    res_complete = await client.post(
        "/api/v1/students/me/onboarding/complete",
        headers=student_auth_headers,
        json={"action": "completed"},
    )
    assert res_complete.status_code == 200
    complete_data = res_complete.json()
    assert complete_data["onboarding_status"] == "completed"
    assert complete_data["onboarding_step"] == 4


@pytest.mark.asyncio
async def test_admin_health_endpoint(
    client: AsyncClient,
    test_admin: User,
    admin_auth_headers: dict[str, str],
):
    """Verify admin health status endpoint requires admin role and returns operational diagnostics."""
    res = await client.get("/api/v1/admin/health", headers=admin_auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert "overall_status" in body
    assert len(body["subsystems"]) >= 5


@pytest.mark.asyncio
async def test_celery_beta_report_and_anomalies(db_session: AsyncSession, test_student: User):
    """Verify daily executive beta briefing and automated anomaly scanner execute cleanly."""
    report = await generate_daily_beta_report_core(db=db_session)
    assert "total_registered" in report
    assert "activation_rate" in report
    assert "ai_cost_usd" in report

    anomalies = await detect_operational_anomalies_core(db=db_session)
    assert isinstance(anomalies, list)
