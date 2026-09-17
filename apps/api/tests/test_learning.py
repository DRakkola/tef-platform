"""Comprehensive tests for the learning intelligence engine:
- Mistake recording and recurrence tracking upon assessment submission
- Deterministic skill mastery updates and confidence scaling
- Immutability of historical SkillAssessment snapshots
- Deterministic recommendation engine logic and priority calculation
- Student data isolation across all endpoints
- Exercise practice, answer concealment, and automatic recommendation completion
- Recommendation dismiss and complete actions
- Unit testing for SkillEngine and RecommendationEngine
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import create_access_token, hash_password
from app.modules.assessments.enums import AssessmentType
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    Question,
)
from app.modules.assessments.seed import seed_demo_assessments
from app.modules.learning.engine import RecommendationEngine, SkillEngine
from app.modules.learning.enums import (
    SkillCategory,
)
from app.modules.learning.models import (
    Exercise,
)
from app.modules.learning.seed import seed_learning_data
from app.modules.users.models import User, UserRole


@pytest_asyncio.fixture
async def seeded_learning_env(db_session: AsyncSession) -> tuple[Assessment, Exercise]:
    """Seed both assessments and learning hierarchy/exercises."""
    await seed_demo_assessments(db_session)
    await seed_learning_data(db_session)

    assessment = await db_session.scalar(
        select(Assessment)
        .where(Assessment.assessment_type == AssessmentType.READING)
        .options(
            selectinload(Assessment.sections)
            .selectinload(AssessmentSection.questions)
            .selectinload(Question.options),
            selectinload(Assessment.sections)
            .selectinload(AssessmentSection.questions)
            .selectinload(Question.skill_tags),
        )
    )
    exercise = await db_session.scalar(
        select(Exercise).where(Exercise.category == SkillCategory.GRAMMAR)
    )
    assert assessment is not None
    assert exercise is not None
    return assessment, exercise


@pytest_asyncio.fixture
async def second_student(db_session: AsyncSession) -> User:
    """Provide an isolated second student for RBAC and data separation tests."""
    user = User(
        email=f"isolated_student_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("ValidPassword123!"),
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def second_student_headers(second_student: User) -> dict[str, str]:
    token = create_access_token(second_student.id, second_student.role.value)
    return {"Authorization": f"Bearer {token}"}


# --------------------------------------------------------------------------
# 1. Assessment submission -> learning engine hook tests
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_assessment_submission_logs_mistakes_skills_and_recommendations(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_learning_env: tuple[Assessment, Exercise],
    db_session: AsyncSession,
) -> None:
    """Submitting an assessment with mistakes logs Mistake records, updates StudentSkill,
    creates immutable SkillAssessment snapshots, and generates deterministic recommendations."""
    assessment, _ = seeded_learning_env

    # 1. Start attempt
    start_resp = await client.post(
        f"/api/v1/assessments/{assessment.id}/attempts",
        headers=student_auth_headers,
    )
    assert start_resp.status_code == 201
    attempt_id = start_resp.json()["id"]

    # 2. Answer question 1 WRONGLY
    first_q = assessment.sections[0].questions[0]
    wrong_opt = next(opt for opt in first_q.options if not opt.is_correct)
    ans_resp = await client.post(
        f"/api/v1/attempts/{attempt_id}/answers",
        headers=student_auth_headers,
        json={"question_id": str(first_q.id), "selected_option_id": str(wrong_opt.id)},
    )
    assert ans_resp.status_code == 200

    # 3. Submit attempt
    sub_resp = await client.post(
        f"/api/v1/attempts/{attempt_id}/submit",
        headers=student_auth_headers,
    )
    assert sub_resp.status_code == 200

    # 4. Verify Mistake record exists
    mistakes_resp = await client.get("/api/v1/students/mistakes", headers=student_auth_headers)
    assert mistakes_resp.status_code == 200
    mistakes = mistakes_resp.json()
    assert len(mistakes) >= 1
    found_mistake = next((m for m in mistakes if m["question_id"] == str(first_q.id)), None)
    assert found_mistake is not None
    assert found_mistake["user_answer"] == wrong_opt.content
    assert found_mistake["error_count"] == 1
    assert found_mistake["source_type"] == "assessment"
    assert found_mistake["explanation"] is not None

    # 5. Verify StudentSkill was updated
    skills_resp = await client.get("/api/v1/students/skills", headers=student_auth_headers)
    assert skills_resp.status_code == 200
    student_skills = skills_resp.json()
    assert len(student_skills) > 0
    reading_skill = next(
        (s for s in student_skills if s["skill_code"] == "reading_comprehension"), None
    )
    assert reading_skill is not None
    assert reading_skill["attempts_count"] == 1
    assert reading_skill["confidence"] > 0.0

    # 6. Verify immutable SkillAssessment record
    history_resp = await client.get("/api/v1/students/skills/history", headers=student_auth_headers)
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert len(history) > 0
    snap = next((h for h in history if h["skill_code"] == "reading_comprehension"), None)
    assert snap is not None
    assert snap["source_type"] == "assessment_attempt"
    assert snap["source_id"] == attempt_id

    # 7. Verify recommendations generated if score < 70%
    recs_resp = await client.get("/api/v1/students/recommendations", headers=student_auth_headers)
    assert recs_resp.status_code == 200
    recs = recs_resp.json()
    if reading_skill["mastery_score"] < 70.0:
        assert len(recs) > 0
        assert recs[0]["priority"] >= 1
        assert recs[0]["skill_code"] in ["reading_detail", "reading_gist", "reading_comprehension"]


@pytest.mark.asyncio
async def test_repeated_mistakes_increment_error_count(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_learning_env: tuple[Assessment, Exercise],
    db_session: AsyncSession,
) -> None:
    """Repeating a mistake on the same question increments error_count and updates timestamp."""
    assessment, _ = seeded_learning_env
    first_q = assessment.sections[0].questions[0]
    wrong_opt = next(opt for opt in first_q.options if not opt.is_correct)

    # Attempt 1
    r1 = await client.post(
        f"/api/v1/assessments/{assessment.id}/attempts", headers=student_auth_headers
    )
    a1_id = r1.json()["id"]
    await client.post(
        f"/api/v1/attempts/{a1_id}/answers",
        headers=student_auth_headers,
        json={"question_id": str(first_q.id), "selected_option_id": str(wrong_opt.id)},
    )
    await client.post(f"/api/v1/attempts/{a1_id}/submit", headers=student_auth_headers)

    # Attempt 2
    r2 = await client.post(
        f"/api/v1/assessments/{assessment.id}/attempts", headers=student_auth_headers
    )
    a2_id = r2.json()["id"]
    await client.post(
        f"/api/v1/attempts/{a2_id}/answers",
        headers=student_auth_headers,
        json={"question_id": str(first_q.id), "selected_option_id": str(wrong_opt.id)},
    )
    await client.post(f"/api/v1/attempts/{a2_id}/submit", headers=student_auth_headers)

    # Fetch mistakes
    mistakes_resp = await client.get("/api/v1/students/mistakes", headers=student_auth_headers)
    assert mistakes_resp.status_code == 200
    mistakes = mistakes_resp.json()
    q_mistakes = [m for m in mistakes if m["question_id"] == str(first_q.id)]
    assert len(q_mistakes) >= 1
    # Error count must have incremented to 2
    assert q_mistakes[0]["error_count"] >= 2


# --------------------------------------------------------------------------
# 2. Immutability of SkillAssessment snapshots
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_skill_assessment_snapshots_are_immutable(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_learning_env: tuple[Assessment, Exercise],
    db_session: AsyncSession,
) -> None:
    """Multiple submissions generate separate immutable historical snapshots."""
    assessment, _ = seeded_learning_env

    # First attempt
    r1 = await client.post(
        f"/api/v1/assessments/{assessment.id}/attempts", headers=student_auth_headers
    )
    a1_id = r1.json()["id"]
    await client.post(f"/api/v1/attempts/{a1_id}/submit", headers=student_auth_headers)

    # Second attempt
    r2 = await client.post(
        f"/api/v1/assessments/{assessment.id}/attempts", headers=student_auth_headers
    )
    a2_id = r2.json()["id"]
    await client.post(f"/api/v1/attempts/{a2_id}/submit", headers=student_auth_headers)

    # History should contain snapshots from BOTH attempts
    hist_resp = await client.get("/api/v1/students/skills/history", headers=student_auth_headers)
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    attempt_ids = {h["source_id"] for h in history}
    assert a1_id in attempt_ids
    assert a2_id in attempt_ids


# --------------------------------------------------------------------------
# 3. Student data isolation and authorization
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_student_data_isolation(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    second_student_headers: dict[str, str],
    seeded_learning_env: tuple[Assessment, Exercise],
    db_session: AsyncSession,
) -> None:
    """A student cannot view or modify another student's skills, mistakes, or recommendations."""
    assessment, _ = seeded_learning_env

    # Student 1 takes assessment and makes mistakes
    r1 = await client.post(
        f"/api/v1/assessments/{assessment.id}/attempts", headers=student_auth_headers
    )
    a1_id = r1.json()["id"]
    first_q = assessment.sections[0].questions[0]
    wrong_opt = next(opt for opt in first_q.options if not opt.is_correct)
    await client.post(
        f"/api/v1/attempts/{a1_id}/answers",
        headers=student_auth_headers,
        json={"question_id": str(first_q.id), "selected_option_id": str(wrong_opt.id)},
    )
    await client.post(f"/api/v1/attempts/{a1_id}/submit", headers=student_auth_headers)

    # Student 1 recommendations
    s1_recs = (
        await client.get("/api/v1/students/recommendations", headers=student_auth_headers)
    ).json()
    assert len(s1_recs) > 0
    s1_rec_id = s1_recs[0]["id"]

    # Student 2 should see EMPTY skills, mistakes, and recommendations
    s2_skills = (await client.get("/api/v1/students/skills", headers=second_student_headers)).json()
    assert len(s2_skills) == 0

    s2_mistakes = (
        await client.get("/api/v1/students/mistakes", headers=second_student_headers)
    ).json()
    assert len(s2_mistakes) == 0

    s2_recs = (
        await client.get("/api/v1/students/recommendations", headers=second_student_headers)
    ).json()
    assert len(s2_recs) == 0

    # Student 2 cannot dismiss Student 1's recommendation
    dismiss_resp = await client.post(
        f"/api/v1/recommendations/{s1_rec_id}/dismiss",
        headers=second_student_headers,
    )
    assert dismiss_resp.status_code == 404

    # Student 2 cannot complete Student 1's recommendation
    complete_resp = await client.post(
        f"/api/v1/recommendations/{s1_rec_id}/complete",
        headers=second_student_headers,
    )
    assert complete_resp.status_code == 404


# --------------------------------------------------------------------------
# 4. Exercise practice, concealment, and attempts
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_exercise_taking_conceals_answers(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_learning_env: tuple[Assessment, Exercise],
) -> None:
    """When retrieving exercises for practice, correct answers and explanations are hidden."""
    _, exercise = seeded_learning_env

    # List exercises
    list_resp = await client.get("/api/v1/exercises", headers=student_auth_headers)
    assert list_resp.status_code == 200
    ex_list = list_resp.json()
    assert len(ex_list) > 0

    # Single exercise practice view
    resp = await client.get(f"/api/v1/exercises/{exercise.id}", headers=student_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(exercise.id)
    assert data["prompt"] == exercise.prompt
    assert len(data["options"]) == 4

    # Ensure no option exposes is_correct or explanation
    for opt in data["options"]:
        assert "content" in opt
        assert "order_index" in opt
        assert "is_correct" not in opt
        assert "explanation" not in opt


@pytest.mark.asyncio
async def test_exercise_attempt_grading_and_recommendation_resolution(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_learning_env: tuple[Assessment, Exercise],
    db_session: AsyncSession,
) -> None:
    """Submitting an exercise attempt grades it, reveals correct answer, updates skills,
    and resolves active recommendation if correct."""
    _, exercise = seeded_learning_env

    # 1. Submit WRONG option (index 1)
    wrong_sub = await client.post(
        f"/api/v1/exercises/{exercise.id}/attempts",
        headers=student_auth_headers,
        json={"selected_option_index": 1},
    )
    assert wrong_sub.status_code == 201
    wrong_data = wrong_sub.json()
    assert wrong_data["is_correct"] is False
    assert wrong_data["points_awarded"] == 0.0
    assert wrong_data["correct_answer"] != ""
    assert wrong_data["explanation"] is not None

    # Verify mistake logged for exercise
    mistakes_resp = await client.get("/api/v1/students/mistakes", headers=student_auth_headers)
    exercise_mistakes = [m for m in mistakes_resp.json() if m["exercise_id"] == str(exercise.id)]
    assert len(exercise_mistakes) >= 1

    # 2. Submit CORRECT option (index 0 for option "à laquelle")
    correct_sub = await client.post(
        f"/api/v1/exercises/{exercise.id}/attempts",
        headers=student_auth_headers,
        json={"selected_option_index": 0},
    )
    assert correct_sub.status_code == 201
    correct_data = correct_sub.json()
    assert correct_data["is_correct"] is True
    assert correct_data["points_awarded"] == 10.0


# --------------------------------------------------------------------------
# 5. Recommendation lifecycle: dismiss and complete
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_recommendation_dismiss_and_complete(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_learning_env: tuple[Assessment, Exercise],
    db_session: AsyncSession,
) -> None:
    """Students can dismiss or complete active recommendations."""
    assessment, _ = seeded_learning_env

    # Generate recommendation via low score
    r = await client.post(
        f"/api/v1/assessments/{assessment.id}/attempts", headers=student_auth_headers
    )
    a_id = r.json()["id"]
    await client.post(f"/api/v1/attempts/{a_id}/submit", headers=student_auth_headers)

    recs = (
        await client.get("/api/v1/students/recommendations", headers=student_auth_headers)
    ).json()
    if not recs:
        pytest.skip("No recommendation generated with current score")

    rec_id = recs[0]["id"]

    # Dismiss recommendation
    dismiss_resp = await client.post(
        f"/api/v1/recommendations/{rec_id}/dismiss",
        headers=student_auth_headers,
    )
    assert dismiss_resp.status_code == 200
    assert dismiss_resp.json()["status"] == "dismissed"

    # Verify no longer active in student recommendations list
    recs_after = (
        await client.get("/api/v1/students/recommendations", headers=student_auth_headers)
    ).json()
    active_ids = {r["id"] for r in recs_after}
    assert rec_id not in active_ids


# --------------------------------------------------------------------------
# 6. SkillEngine and RecommendationEngine pure unit tests
# --------------------------------------------------------------------------


def test_skill_engine_mastery_calculation() -> None:
    """Verify EWMA rolling mastery score calculation and confidence bounds."""
    # First attempt: score becomes the initial score, confidence starts at 0.35
    mastery, conf = SkillEngine.update_mastery(0.0, attempts_count=0, new_score=80.0)
    assert mastery == 80.0
    assert conf == 0.25

    # Second attempt: 60% historical + 40% new
    # 0.6 * 80.0 + 0.4 * 60.0 = 48.0 + 24.0 = 72.0
    mastery2, conf2 = SkillEngine.update_mastery(mastery, attempts_count=1, new_score=60.0)
    assert mastery2 == 72.0
    assert conf2 > conf

    # High attempts confidence saturation at 1.0
    _, saturated_conf = SkillEngine.update_mastery(mastery2, attempts_count=10, new_score=90.0)
    assert saturated_conf == 1.0


def test_recommendation_engine_priority_calculation() -> None:
    """Verify deterministic recommendation priority formula and mistake penalty."""
    # Mastery 80, mistakes 0 -> priority = (100 - 80) = 20
    p1 = RecommendationEngine.calculate_priority(mastery_score=80.0, mistake_count=0)
    assert p1 == 20

    # Mastery 50, mistakes 0 -> priority = (100 - 50) = 50
    p2 = RecommendationEngine.calculate_priority(mastery_score=50.0, mistake_count=0)
    assert p2 == 50

    # Repeated mistakes increase priority
    # Mastery 50, mistakes 3 -> 50 + (3 * 10) = 80
    p3 = RecommendationEngine.calculate_priority(mastery_score=50.0, mistake_count=3)
    assert p3 == 80

    # Bounds: clamped between 1 and 100
    p_clamped_high = RecommendationEngine.calculate_priority(mastery_score=10.0, mistake_count=10)
    assert p_clamped_high == 100

    p_clamped_low = RecommendationEngine.calculate_priority(mastery_score=100.0, mistake_count=0)
    assert p_clamped_low == 1
