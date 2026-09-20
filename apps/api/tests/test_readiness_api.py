"""Comprehensive API integration and RBAC/isolation tests for the TEF Readiness Engine endpoints."""

import datetime
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.modules.assessments.models import Skill
from app.modules.learning.enums import SkillCategory
from app.modules.learning.readiness_engine import ReadinessEngine
from app.modules.learning.readiness_models import SkillEvidenceSourceType
from app.modules.users.models import StudentProfile, User, UserRole


@pytest.fixture
async def test_student(db_session: AsyncSession) -> User:
    """Create a verified student."""
    user = User(
        id=uuid.uuid4(),
        email=f"readiness_student_{uuid.uuid4().hex[:6]}@example.com",
        password_hash=hash_password("ValidPassword123!"),
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=user.id,
        target_exam="TEF Canada",
        target_level="B2",
        daily_minutes_available=30,
        target_date=datetime.date.today() + datetime.timedelta(days=60),
    )
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_admin(db_session: AsyncSession) -> User:
    """Create a verified admin user."""
    user = User(
        id=uuid.uuid4(),
        email=f"readiness_admin_{uuid.uuid4().hex[:6]}@example.com",
        password_hash=hash_password("AdminPassword123!"),
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def sample_skills(db_session: AsyncSession) -> dict[str, Skill]:
    """Create core exam skills for reading, listening, writing, speaking."""
    skills = {
        "reading": Skill(
            id=uuid.uuid4(),
            name="Compréhension écrite",
            code=f"CE_{uuid.uuid4().hex[:4]}",
            category=SkillCategory.READING,
        ),
        "listening": Skill(
            id=uuid.uuid4(),
            name="Compréhension orale",
            code=f"CO_{uuid.uuid4().hex[:4]}",
            category=SkillCategory.LISTENING,
        ),
        "writing": Skill(
            id=uuid.uuid4(),
            name="Expression écrite",
            code=f"EE_{uuid.uuid4().hex[:4]}",
            category=SkillCategory.WRITING,
        ),
        "speaking": Skill(
            id=uuid.uuid4(),
            name="Expression orale",
            code=f"EO_{uuid.uuid4().hex[:4]}",
            category=SkillCategory.SPEAKING,
        ),
    }
    db_session.add_all(list(skills.values()))
    await db_session.commit()
    return skills


@pytest.mark.asyncio
async def test_get_readiness_profile_unassessed_student(
    client: AsyncClient,
    test_student: User,
):
    """An unassessed student should return insufficient_data band and safe disclaimer."""
    token = create_access_token(str(test_student.id), role=UserRole.STUDENT.value)
    resp = await client.get(
        "/api/v1/students/me/readiness",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["readiness_band"] == "insufficient_data"
    assert data["overall_estimate"] is None
    assert data["confidence"] == 0.0
    assert "estimation" in data["disclaimer"].lower() or "officielle" in data["disclaimer"].lower()
    assert data["calculation_version"] == ReadinessEngine.CALCULATION_VERSION
    assert data["target_exam"] == "TEF Canada"
    assert data["target_level"] == "B2"


@pytest.mark.asyncio
async def test_get_readiness_profile_with_assessed_skills(
    client: AsyncClient,
    db_session: AsyncSession,
    test_student: User,
    sample_skills: dict[str, Skill],
):
    """Student with sufficient evidence across modalities returns estimated performance and band."""
    now = datetime.datetime.now(datetime.UTC)

    # Ingest multiple pieces of evidence across core skills
    for i in range(3):
        await ReadinessEngine.ingest_evidence(
            db=db_session,
            student_id=test_student.id,
            skill_id=sample_skills["reading"].id,
            source_type=SkillEvidenceSourceType.ASSESSMENT.value,
            source_id=uuid.uuid4(),
            raw_score=75.0,
            normalized_score=75.0,
            confidence=0.85,
            observed_at=now - datetime.timedelta(days=i),
        )

    for i in range(3):
        await ReadinessEngine.ingest_evidence(
            db=db_session,
            student_id=test_student.id,
            skill_id=sample_skills["listening"].id,
            source_type=SkillEvidenceSourceType.TEACHER_EVALUATION.value,
            source_id=uuid.uuid4(),
            raw_score=50.0,  # Below target threshold
            normalized_score=50.0,
            confidence=0.90,
            observed_at=now - datetime.timedelta(days=i),
        )

    await db_session.commit()

    token = create_access_token(str(test_student.id), role=UserRole.STUDENT.value)
    resp = await client.get(
        "/api/v1/students/me/readiness",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["readiness_band"] in ["developing", "progressing", "near_target", "target_consistent"]
    assert data["overall_estimate"] is not None
    assert 50.0 <= data["overall_estimate"] <= 80.0
    assert data["confidence"] > 0.35
    assert len(data["summary_skills"]) >= 2

    # Verify listening skill is identified as a blocking skill (gap 65 - 50 = 15 >= 10)
    blocking_names = [b["skill_name"] for b in data["summary_blockers"]]
    assert sample_skills["listening"].name in blocking_names


@pytest.mark.asyncio
async def test_get_readiness_gaps_endpoint(
    client: AsyncClient,
    db_session: AsyncSession,
    test_student: User,
    sample_skills: dict[str, Skill],
):
    """GET /readiness/gaps returns properly ranked gaps as a list."""
    # Ingest evidence
    await ReadinessEngine.ingest_evidence(
        db=db_session,
        student_id=test_student.id,
        skill_id=sample_skills["reading"].id,
        source_type=SkillEvidenceSourceType.ASSESSMENT.value,
        source_id=uuid.uuid4(),
        raw_score=68.0,
        normalized_score=68.0,
    )
    await ReadinessEngine.ingest_evidence(
        db=db_session,
        student_id=test_student.id,
        skill_id=sample_skills["listening"].id,
        source_type=SkillEvidenceSourceType.ASSESSMENT.value,
        source_id=uuid.uuid4(),
        raw_score=50.0,
        normalized_score=50.0,
    )
    await db_session.commit()

    token = create_access_token(str(test_student.id), role=UserRole.STUDENT.value)
    resp = await client.get(
        "/api/v1/students/me/readiness/gaps",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    # Gaps are sorted by priority descending
    assert data[0]["priority"] >= data[1]["priority"]


@pytest.mark.asyncio
async def test_get_blocking_skills_endpoint(
    client: AsyncClient,
    db_session: AsyncSession,
    test_student: User,
    sample_skills: dict[str, Skill],
):
    """GET /readiness/blockers returns blocking skills with material deficits."""
    # 2 observations of low score on speaking -> confidence >= 0.35, gap >= 10 -> blocker
    for _ in range(2):
        await ReadinessEngine.ingest_evidence(
            db=db_session,
            student_id=test_student.id,
            skill_id=sample_skills["speaking"].id,
            source_type=SkillEvidenceSourceType.TEACHER_EVALUATION.value,
            source_id=uuid.uuid4(),
            raw_score=45.0,
            normalized_score=45.0,
        )
    await db_session.commit()

    token = create_access_token(str(test_student.id), role=UserRole.STUDENT.value)
    resp = await client.get(
        "/api/v1/students/me/readiness/blockers",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["gap"] >= 10.0
    assert "blocker_reason" in data[0]
    assert "recommended_action" in data[0]


@pytest.mark.asyncio
async def test_get_readiness_trends_endpoint(
    client: AsyncClient,
    test_student: User,
):
    """GET /readiness/trends returns structured multi-window trajectory per skill."""
    token = create_access_token(str(test_student.id), role=UserRole.STUDENT.value)
    resp = await client.get(
        "/api/v1/students/me/readiness/trends",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    if data:
        assert "trend_7d" in data[0]
        assert "trend_30d" in data[0]
        assert "trend_all_time" in data[0]
        assert "sufficient_data_for_velocity" in data[0]


@pytest.mark.asyncio
async def test_recent_evidence_endpoint(
    client: AsyncClient,
    db_session: AsyncSession,
    test_student: User,
    sample_skills: dict[str, Skill],
):
    """GET /readiness/evidence returns append-only immutable observations."""
    for i in range(3):
        await ReadinessEngine.ingest_evidence(
            db=db_session,
            student_id=test_student.id,
            skill_id=sample_skills["writing"].id,
            source_type=SkillEvidenceSourceType.AI_EVALUATION.value,
            source_id=uuid.uuid4(),
            raw_score=70.0 + i,
            normalized_score=70.0 + i,
        )
    await db_session.commit()

    token = create_access_token(str(test_student.id), role=UserRole.STUDENT.value)
    resp = await client.get(
        "/api/v1/students/me/readiness/evidence?page_size=10",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 3


@pytest.mark.asyncio
async def test_recalculate_readiness_endpoint(
    client: AsyncClient,
    test_student: User,
):
    """POST /readiness/recalculate triggers on-demand recalculation."""
    token = create_access_token(str(test_student.id), role=UserRole.STUDENT.value)
    resp = await client.post(
        "/api/v1/students/me/readiness/recalculate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "readiness_band" in data
    assert "calculation_version" in data
    assert data["calculation_version"] == ReadinessEngine.CALCULATION_VERSION


@pytest.mark.asyncio
async def test_daily_plan_budget_update(
    client: AsyncClient,
    test_student: User,
):
    """Daily plan respects available minutes budget and updates via PUT endpoint."""
    token = create_access_token(str(test_student.id), role=UserRole.STUDENT.value)

    # 1. Fetch current daily plan
    resp = await client.get(
        "/api/v1/students/me/daily-plan",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    plan_data = resp.json()
    assert plan_data["daily_minutes_available"] == 30
    assert plan_data["total_estimated_minutes"] <= 30

    # 2. Update budget to 45 minutes
    resp_update = await client.put(
        "/api/v1/students/me/daily-plan/budget",
        headers={"Authorization": f"Bearer {token}"},
        json={"daily_minutes_available": 45},
    )
    assert resp_update.status_code == 200
    assert resp_update.json()["daily_minutes_budget"] == 45

    # 3. Check updated daily plan reflects 45 min
    resp_updated = await client.get(
        "/api/v1/students/me/daily-plan",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_updated.status_code == 200
    assert resp_updated.json()["daily_minutes_available"] == 45


@pytest.mark.asyncio
async def test_reassessment_status_endpoint(
    client: AsyncClient,
    test_student: User,
):
    """GET /readiness/reassessment returns status and cooldown flags."""
    token = create_access_token(str(test_student.id), role=UserRole.STUDENT.value)
    resp = await client.get(
        "/api/v1/students/me/readiness/reassessment",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "should_reassess" in data


@pytest.mark.asyncio
async def test_admin_stats_rbac(
    client: AsyncClient,
    test_student: User,
    test_admin: User,
):
    """GET /admin/readiness/stats allows admin but rejects student with 403."""
    student_token = create_access_token(str(test_student.id), role=UserRole.STUDENT.value)
    admin_token = create_access_token(str(test_admin.id), role=UserRole.ADMIN.value)

    # Student request -> 403 Forbidden
    resp_student = await client.get(
        "/api/v1/admin/readiness/stats",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert resp_student.status_code == 403

    # Admin request -> 200 OK
    resp_admin = await client.get(
        "/api/v1/admin/readiness/stats",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp_admin.status_code == 200
    data = resp_admin.json()
    assert "total_profiles" in data
    assert "calculation_version" in data
    assert data["calculation_version"] == ReadinessEngine.CALCULATION_VERSION
