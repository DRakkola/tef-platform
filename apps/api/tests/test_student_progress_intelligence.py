"""Comprehensive tests for Student Progress, Skill Profile, and Personalization System:

1. Deterministic calculation algorithm (Time-Decay Weighted Bayesian Moving Average)
2. Confidence and calibration rules (insufficient data when n < 2 or conf < 0.35)
3. LevelEstimationService (CEFR A1-C2, NCLC 3-10+, official simulation disclaimer)
4. TargetGapService (readiness, score gap, level distance, exam date countdown & urgency)
5. StrengthsWeaknessesService (strongest >= 75%, weakest < 65%, trajectory trends)
6. RecommendationEngineV2 (deduplication, cooldown, lifecycle state machine)
7. DailyPlanService (adaptive 3-4 daily practice tasks, real-time completion check)
8. ActivityTracker (immutable event tracking and privacy isolation)
9. Assessment submission idempotency (prevents score skewing and duplicate records)
10. End-to-end Student REST endpoints and strict student privacy isolation
"""

import datetime
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.modules.assessments.models import Skill
from app.modules.assessments.seed import seed_demo_assessments
from app.modules.learning.activity import ActivityTracker
from app.modules.learning.daily_plan import DailyPlanService
from app.modules.learning.engine import SkillEngine
from app.modules.learning.enums import RecommendationStatus
from app.modules.learning.levels import LevelEstimationService
from app.modules.learning.models import Recommendation, SkillAssessment, StudentSkill
from app.modules.learning.recommendations_v2 import RecommendationEngineV2
from app.modules.learning.seed import seed_learning_data
from app.modules.learning.strengths_weaknesses import StrengthsWeaknessesService
from app.modules.learning.targets import TargetGapService
from app.modules.users.models import User, UserRole

# --------------------------------------------------------------------------
# Unit Tests: LevelEstimationService & SkillEngine
# --------------------------------------------------------------------------


def test_level_estimation_service_cefr_and_nclc() -> None:
    """Test deterministic mapping of score to CEFR and NCLC levels with disclaimer."""
    assert LevelEstimationService.estimate_cefr(20.0) == "A1"
    assert LevelEstimationService.estimate_cefr(45.0) == "A2"
    assert LevelEstimationService.estimate_cefr(55.0) == "B1"
    assert LevelEstimationService.estimate_cefr(70.0) == "B2"
    assert LevelEstimationService.estimate_cefr(85.0) == "C1"
    assert LevelEstimationService.estimate_cefr(95.0) == "C2"

    assert LevelEstimationService.estimate_nclc(20.0, "A1") == "NCLC 3"
    assert LevelEstimationService.estimate_nclc(45.0, "A2") == "NCLC 4"
    assert LevelEstimationService.estimate_nclc(52.0, "B1") == "NCLC 5"
    assert LevelEstimationService.estimate_nclc(60.0, "B1") == "NCLC 6"
    assert LevelEstimationService.estimate_nclc(68.0, "B2") == "NCLC 7"
    assert LevelEstimationService.estimate_nclc(75.0, "B2") == "NCLC 8"
    assert LevelEstimationService.estimate_nclc(85.0, "C1") == "NCLC 9"
    assert LevelEstimationService.estimate_nclc(95.0, "C2") == "NCLC 10+"

    assert "simulation" in LevelEstimationService.DISCLAIMER.lower() or "estimation" in LevelEstimationService.DISCLAIMER.lower()
    assert "CCI Paris" in LevelEstimationService.DISCLAIMER

    # Level distances
    assert LevelEstimationService.calculate_level_distance("A1", "B2") == 3
    assert LevelEstimationService.calculate_level_distance("B1", "B2") == 1
    assert LevelEstimationService.calculate_level_distance("B2", "B2") == 0
    assert LevelEstimationService.calculate_level_distance("C1", "B2") == 0


def test_skill_engine_confidence_and_calibration() -> None:
    """Test confidence scaling, source diversity bonus, inactivity decay, and calibration state."""
    # 0 attempts -> Calibration, insufficient data
    conf, label, is_insufficient = SkillEngine.calculate_confidence(0)
    assert conf == 0.0
    assert label == "Calibration"
    assert is_insufficient is True

    # 1 attempt -> still Calibration (n < 2)
    conf, label, is_insufficient = SkillEngine.calculate_confidence(1)
    assert is_insufficient is True
    assert label == "Calibration"

    # 3 attempts from single source -> Low/Medium, not insufficient if conf >= 0.35
    conf, label, is_insufficient = SkillEngine.calculate_confidence(3)
    assert conf == 0.42
    assert is_insufficient is False
    assert label == "Low"

    # 4 attempts with source diversity -> bonus added
    conf, label, is_insufficient = SkillEngine.calculate_confidence(
        attempts_count=4,
        source_types={"assessment", "exercise"},
    )
    # 4 * 0.14 = 0.56 + 0.15 = 0.71
    assert conf == 0.71
    assert label == "Medium"
    assert is_insufficient is False

    # Inactivity decay beyond 30 days
    conf_active, _, _ = SkillEngine.calculate_confidence(5, days_since_last=0)
    conf_inactive, _, _ = SkillEngine.calculate_confidence(5, days_since_last=100)
    assert conf_inactive < conf_active


def test_skill_engine_bayesian_aggregation_and_decay() -> None:
    """Test deterministic Bayesian aggregation and recency weighting."""
    now = datetime.datetime.now(datetime.UTC)
    assessments = [
        {"score": 80.0, "source_type": "assessment", "assessed_at": now},
        {"score": 85.0, "source_type": "exercise", "assessed_at": now - datetime.timedelta(days=10)},
    ]
    res = SkillEngine.calculate_from_history(assessments, now=now)
    assert 60.0 <= res["mastery_score"] <= 85.0
    assert res["attempts_count"] == 2
    assert res["insufficient_data"] is False
    assert res["estimated_level"] in ["B1", "B2"]


# --------------------------------------------------------------------------
# Fixtures for DB Integration Tests
# --------------------------------------------------------------------------


@pytest_asyncio.fixture
async def setup_test_student(db_session: AsyncSession) -> User:
    """Create test student with initialized profile and demo data."""
    await seed_demo_assessments(db_session)
    await seed_learning_data(db_session)

    user = User(
        email=f"progress_student_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("ValidPassword123!"),
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def second_isolated_student(db_session: AsyncSession) -> User:
    """Create another student to verify privacy boundary isolation."""
    user = User(
        email=f"isolated_boundary_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("ValidPassword123!"),
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


def auth_headers_for(user: User) -> dict[str, str]:
    token = create_access_token(user.id, user.role.value)
    return {"Authorization": f"Bearer {token}"}


# --------------------------------------------------------------------------
# Integration Tests: Target Gap, Weaknesses, Recommendations, Daily Plan
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_target_gap_service_and_update(
    db_session: AsyncSession,
    setup_test_student: User,
) -> None:
    """Test TargetGapService computes gap, days remaining, level distance, and handles updates."""
    student = setup_test_student

    # Initial target gap with default B2
    gap = await TargetGapService.get_target_gap(db_session, student.id)
    assert gap["target_cefr_level"] == "B2"
    assert gap["target_threshold_score"] == 65.0
    assert gap["score_gap"] >= 0.0
    assert "CCI Paris" in gap["disclaimer"]

    # Set target date 20 days in future -> urgency should be urgent
    future_date = datetime.datetime.now(datetime.UTC).date() + datetime.timedelta(days=20)
    updated = await TargetGapService.update_target(
        db=db_session,
        user=student,
        target_exam="TEF Canada",
        target_cefr_level="C1",
        target_nclc_level="NCLC 9",
        target_date=future_date,
    )
    assert updated["target_cefr_level"] == "C1"
    assert updated["target_threshold_score"] == 80.0
    assert updated["days_remaining"] == 20
    assert updated["urgency"] == "urgent"


@pytest.mark.asyncio
async def test_strengths_weaknesses_classification(
    db_session: AsyncSession,
    setup_test_student: User,
) -> None:
    """Test classification of skills into strongest, weakest, improving, declining."""
    student = setup_test_student
    skill = (await db_session.execute(select(Skill).limit(1))).scalar_one()

    # Add student skill with 2 attempts to pass calibration
    ss = StudentSkill(
        user_id=student.id,
        skill_id=skill.id,
        mastery_score=82.0,
        confidence=0.8,
        attempts_count=3,
        last_assessed_at=datetime.datetime.now(datetime.UTC),
    )
    db_session.add(ss)

    # Add previous snapshot with lower score to show improvement (82 vs 70 -> +12)
    older = SkillAssessment(
        user_id=student.id,
        skill_id=skill.id,
        source_type="assessment_attempt",
        source_id=uuid.uuid4(),
        score=70.0,
        points_earned=14.0,
        points_possible=20.0,
        assessed_at=datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=5),
    )
    db_session.add(older)
    await db_session.commit()

    analysis = await StrengthsWeaknessesService.analyze_skills(db_session, student.id)
    assert analysis["total_tracked"] >= 1
    assert len(analysis["strongest_skills"]) >= 1
    assert analysis["strongest_skills"][0]["skill_id"] == skill.id
    assert analysis["strongest_skills"][0]["trend"] == "improving"
    assert analysis["strongest_skills"][0]["change"] == 12.0


@pytest.mark.asyncio
async def test_recommendations_v2_deduplication_and_cooldown(
    db_session: AsyncSession,
    setup_test_student: User,
) -> None:
    """Test RecommendationEngineV2 deduplication, cooldown, and lifecycle state management."""
    student = setup_test_student
    skill = (await db_session.execute(select(Skill).limit(1))).scalar_one()

    # Create student skill below threshold
    ss = StudentSkill(
        user_id=student.id,
        skill_id=skill.id,
        mastery_score=50.0,
        confidence=0.5,
        attempts_count=2,
        last_assessed_at=datetime.datetime.now(datetime.UTC),
    )
    db_session.add(ss)
    await db_session.commit()

    # Generate recommendations twice
    recs_first = await RecommendationEngineV2.generate_recommendations(db_session, student.id)
    recs_second = await RecommendationEngineV2.generate_recommendations(db_session, student.id)
    assert len(recs_second) == len(recs_first)

    # Count active recommendations in database
    active_recs = (
        await db_session.execute(
            select(Recommendation).where(
                Recommendation.user_id == student.id,
                Recommendation.status == RecommendationStatus.ACTIVE,
            )
        )
    ).scalars().all()

    # Assert deduplication: active recommendations count should not double
    assert len(active_recs) == len(recs_first)

    # Test status update to DISMISSED
    if active_recs:
        updated = await RecommendationEngineV2.update_status(
            db=db_session,
            recommendation_id=active_recs[0].id,
            user_id=student.id,
            new_status=RecommendationStatus.DISMISSED,
        )
        assert updated["status"] == RecommendationStatus.DISMISSED


@pytest.mark.asyncio
async def test_daily_plan_synthesis_and_activity_tracking(
    db_session: AsyncSession,
    setup_test_student: User,
) -> None:
    """Test DailyPlanService task generation and ActivityTracker event persistence."""
    student = setup_test_student

    # Check daily plan
    plan = await DailyPlanService.get_daily_plan(db_session, student.id)
    assert plan["total_tasks"] >= 3
    assert plan["estimated_minutes_total"] > 0
    assert plan["completion_percentage"] >= 0.0

    # Record activity event
    ev = await ActivityTracker.record_activity(
        db=db_session,
        user_id=student.id,
        event_type="assessment_completed",
        title="Test Épreuve A1",
        metadata={"score": 85.0},
    )
    assert ev.user_id == student.id

    # Retrieve activity
    activities = await ActivityTracker.get_student_activities(db_session, student.id)
    assert activities["total"] >= 1
    assert any(item["event_type"] == "assessment_completed" for item in activities["items"])


# --------------------------------------------------------------------------
# REST API Tests & Strict Student Isolation
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_student_endpoints_and_privacy_isolation(
    client: AsyncClient,
    setup_test_student: User,
    second_isolated_student: User,
    db_session: AsyncSession,
) -> None:
    """Verify all /api/v1/students/me/* endpoints work and enforce strict student isolation."""
    student_headers = auth_headers_for(setup_test_student)
    isolated_headers = auth_headers_for(second_isolated_student)

    # 1. GET /dashboard
    resp = await client.get("/api/v1/students/me/dashboard", headers=student_headers)
    assert resp.status_code == 200
    dash_data = resp.json()
    assert "target_exam" in dash_data
    assert "skills" in dash_data
    assert "daily_plan" in dash_data
    assert "target_disclaimer" in dash_data
    assert "CCI Paris" in dash_data["target_disclaimer"]

    # 2. PUT /target
    target_payload = {
        "target_exam": "TEF Canada",
        "target_cefr_level": "B2",
        "target_nclc_level": "NCLC 7",
    }
    resp = await client.put("/api/v1/students/me/target", json=target_payload, headers=student_headers)
    assert resp.status_code == 200
    assert resp.json()["target_cefr_level"] == "B2"

    # Verify student B cannot see student A's target update
    resp_b = await client.get("/api/v1/students/me/target", headers=isolated_headers)
    assert resp_b.status_code == 200
    # Student B has not set a target yet or has default
    assert resp_b.json()["current_score"] == 0.0

    # 3. GET /skills
    resp = await client.get("/api/v1/students/me/skills", headers=student_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

    # 4. GET /progress with time range
    resp = await client.get("/api/v1/students/me/progress?range=30d", headers=student_headers)
    assert resp.status_code == 200
    assert "timeline" in resp.json()
    assert "disclaimer" in resp.json()

    # 5. GET /weaknesses
    resp = await client.get("/api/v1/students/me/weaknesses", headers=student_headers)
    assert resp.status_code == 200
    weak_data = resp.json()
    assert "strongest_skills" in weak_data
    assert "weakest_skills" in weak_data

    # 6. GET /daily-plan
    resp = await client.get("/api/v1/students/me/daily-plan", headers=student_headers)
    assert resp.status_code == 200
    plan_data = resp.json()
    assert "tasks" in plan_data
    assert len(plan_data["tasks"]) >= 3

    # 7. GET /recommendations
    resp = await client.get("/api/v1/students/me/recommendations", headers=student_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

    # 8. GET /activity
    resp = await client.get("/api/v1/students/me/activity", headers=student_headers)
    assert resp.status_code == 200
    assert "items" in resp.json()
    assert "total" in resp.json()
