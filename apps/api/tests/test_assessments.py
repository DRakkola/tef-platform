"""Comprehensive tests for the generic assessment engine:
- Server-side time enforcement and expiry
- Idempotent answer submission
- Transaction-safe submission and duplicate submits
- Isolated scoring engine verification
- Authorization and attempt isolation
- Concealment of correct answers prior to submission
- Concurrency during submission
"""

import asyncio
import datetime
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import create_access_token, hash_password
from app.modules.assessments.enums import (
    AssessmentType,
    AttemptStatus,
    QuestionType,
    ScoringPolicy,
)
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    Attempt,
    AttemptAnswer,
    Question,
    QuestionOption,
)
from app.modules.assessments.scoring import ScoringEngine
from app.modules.assessments.seed import seed_demo_assessments
from app.modules.users.models import User, UserRole


@pytest_asyncio.fixture
async def seeded_assessments(db_session: AsyncSession) -> tuple[Assessment, Assessment]:
    """Seed demo assessments and return (reading_assessment, listening_assessment)."""
    await seed_demo_assessments(db_session)
    reading = await db_session.scalar(
        select(Assessment).where(Assessment.assessment_type == AssessmentType.READING)
    )
    listening = await db_session.scalar(
        select(Assessment).where(Assessment.assessment_type == AssessmentType.LISTENING)
    )
    assert reading is not None
    assert listening is not None
    return reading, listening


@pytest_asyncio.fixture
async def second_student(db_session: AsyncSession) -> User:
    """Fixture providing a second student for isolation and RBAC tests."""
    user = User(
        email=f"other_student_{uuid.uuid4().hex[:8]}@example.com",
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


@pytest.mark.asyncio
async def test_list_assessments(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_assessments: tuple[Assessment, Assessment],
) -> None:
    """Verify listing assessments returns published exams with section and question counts."""
    response = await client.get("/api/v1/assessments", headers=student_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2
    assert len(data["items"]) >= 2
    for item in data["items"]:
        assert "id" in item
        assert "title" in item
        assert item["question_count"] > 0
        assert item["section_count"] > 0


@pytest.mark.asyncio
async def test_get_assessment_conceals_answers_and_explanations(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_assessments: tuple[Assessment, Assessment],
) -> None:
    """Verify correct answers and explanations are strictly omitted before submission."""
    reading_assessment, _ = seeded_assessments
    response = await client.get(
        f"/api/v1/assessments/{reading_assessment.id}",
        headers=student_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(reading_assessment.id)
    assert len(data["sections"]) > 0

    for section in data["sections"]:
        for question in section["questions"]:
            # Explanation must be hidden from student taking view
            assert "explanation" not in question or question.get("explanation") is None
            for option in question["options"]:
                # is_correct must NOT be in the option schema
                assert "is_correct" not in option
                assert "explanation" not in option


@pytest.mark.asyncio
async def test_start_attempt_server_side_timing(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_assessments: tuple[Assessment, Assessment],
) -> None:
    """Verify attempt start initializes server-side started_at, expires_at, and status=started."""
    reading_assessment, _ = seeded_assessments
    response = await client.post(
        f"/api/v1/assessments/{reading_assessment.id}/attempts",
        headers=student_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == AttemptStatus.STARTED.value
    assert data["started_at"] is not None
    assert data["expires_at"] is not None
    assert data["remaining_seconds"] > 0
    # Remaining seconds should be approximately 3600
    assert 3500 <= data["remaining_seconds"] <= 3600


@pytest.mark.asyncio
async def test_answer_submission_idempotency(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_assessments: tuple[Assessment, Assessment],
    db_session: AsyncSession,
) -> None:
    """Verify submitting an answer is idempotent and updates the existing answer record."""
    reading_assessment, _ = seeded_assessments

    # Start attempt
    start_resp = await client.post(
        f"/api/v1/assessments/{reading_assessment.id}/attempts",
        headers=student_auth_headers,
    )
    attempt_id = start_resp.json()["id"]

    # Get questions
    assessment_resp = await client.get(
        f"/api/v1/assessments/{reading_assessment.id}",
        headers=student_auth_headers,
    )
    question = assessment_resp.json()["sections"][0]["questions"][0]
    opt1 = question["options"][0]["id"]
    opt2 = question["options"][1]["id"]

    # Submit option 1
    ans_resp1 = await client.post(
        f"/api/v1/attempts/{attempt_id}/answers",
        json={"question_id": question["id"], "selected_option_id": opt1},
        headers=student_auth_headers,
    )
    assert ans_resp1.status_code == 200
    assert ans_resp1.json()["selected_option_id"] == opt1

    # Update to option 2 (idempotent overwrite)
    ans_resp2 = await client.post(
        f"/api/v1/attempts/{attempt_id}/answers",
        json={"question_id": question["id"], "selected_option_id": opt2},
        headers=student_auth_headers,
    )
    assert ans_resp2.status_code == 200
    assert ans_resp2.json()["selected_option_id"] == opt2

    # Verify attempt only has 1 answer recorded
    get_resp = await client.get(
        f"/api/v1/attempts/{attempt_id}",
        headers=student_auth_headers,
    )
    assert len(get_resp.json()["answers"]) == 1
    assert get_resp.json()["answers"][0]["selected_option_id"] == opt2


@pytest.mark.asyncio
async def test_answer_rejected_when_expired(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_assessments: tuple[Assessment, Assessment],
    db_session: AsyncSession,
) -> None:
    """Verify answers are strictly rejected when server expiration timestamp has passed."""
    reading_assessment, _ = seeded_assessments

    start_resp = await client.post(
        f"/api/v1/assessments/{reading_assessment.id}/attempts",
        headers=student_auth_headers,
    )
    attempt_id = uuid.UUID(start_resp.json()["id"])

    # Manually expire attempt in DB
    attempt = await db_session.get(Attempt, attempt_id)
    assert attempt is not None
    attempt.expires_at = datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=60)
    await db_session.commit()

    # Attempt to answer
    assessment_resp = await client.get(
        f"/api/v1/assessments/{reading_assessment.id}",
        headers=student_auth_headers,
    )
    question = assessment_resp.json()["sections"][0]["questions"][0]

    ans_resp = await client.post(
        f"/api/v1/attempts/{attempt_id}/answers",
        json={
            "question_id": question["id"],
            "selected_option_id": question["options"][0]["id"],
        },
        headers=student_auth_headers,
    )
    assert ans_resp.status_code == 400
    assert ans_resp.json()["error"]["code"] == "ATTEMPT_EXPIRED"


@pytest.mark.asyncio
async def test_answer_rejected_for_invalid_question(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_assessments: tuple[Assessment, Assessment],
) -> None:
    """Verify answering with a question not belonging to the assessment is rejected."""
    reading_assessment, listening_assessment = seeded_assessments

    # Start attempt on reading
    start_resp = await client.post(
        f"/api/v1/assessments/{reading_assessment.id}/attempts",
        headers=student_auth_headers,
    )
    attempt_id = start_resp.json()["id"]

    # Get question from listening assessment
    listening_resp = await client.get(
        f"/api/v1/assessments/{listening_assessment.id}",
        headers=student_auth_headers,
    )
    listening_q = listening_resp.json()["sections"][0]["questions"][0]

    # Try to answer listening question inside reading attempt
    ans_resp = await client.post(
        f"/api/v1/attempts/{attempt_id}/answers",
        json={
            "question_id": listening_q["id"],
            "selected_option_id": listening_q["options"][0]["id"],
        },
        headers=student_auth_headers,
    )
    assert ans_resp.status_code == 400
    assert ans_resp.json()["error"]["code"] == "INVALID_QUESTION"


@pytest.mark.asyncio
async def test_unauthorized_attempt_access(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    second_student_headers: dict[str, str],
    seeded_assessments: tuple[Assessment, Assessment],
) -> None:
    """Verify Student B cannot access, answer, or submit Student A's attempt."""
    reading_assessment, _ = seeded_assessments

    # Student A starts attempt
    start_resp = await client.post(
        f"/api/v1/assessments/{reading_assessment.id}/attempts",
        headers=student_auth_headers,
    )
    attempt_id = start_resp.json()["id"]

    # Student B tries to get attempt
    get_resp = await client.get(
        f"/api/v1/attempts/{attempt_id}",
        headers=second_student_headers,
    )
    assert get_resp.status_code == 403
    assert get_resp.json()["error"]["code"] == "FORBIDDEN_RESOURCE"

    # Student B tries to submit an answer
    ans_resp = await client.post(
        f"/api/v1/attempts/{attempt_id}/answers",
        json={"question_id": str(uuid.uuid4())},
        headers=second_student_headers,
    )
    assert ans_resp.status_code == 403

    # Student B tries to submit attempt
    submit_resp = await client.post(
        f"/api/v1/attempts/{attempt_id}/submit",
        headers=second_student_headers,
    )
    assert submit_resp.status_code == 403


@pytest.mark.asyncio
async def test_results_forbidden_before_submission(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_assessments: tuple[Assessment, Assessment],
) -> None:
    """Verify GET /attempts/{id}/results fails if attempt is still started and active."""
    reading_assessment, _ = seeded_assessments

    start_resp = await client.post(
        f"/api/v1/assessments/{reading_assessment.id}/attempts",
        headers=student_auth_headers,
    )
    attempt_id = start_resp.json()["id"]

    results_resp = await client.get(
        f"/api/v1/attempts/{attempt_id}/results",
        headers=student_auth_headers,
    )
    assert results_resp.status_code == 400
    assert results_resp.json()["error"]["code"] == "ATTEMPT_NOT_SUBMITTED"


@pytest.mark.asyncio
async def test_successful_attempt_submission_and_scoring(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_assessments: tuple[Assessment, Assessment],
    db_session: AsyncSession,
) -> None:
    """End-to-end test: start attempt, answer questions, submit, verify score & explanations."""
    reading_assessment, _ = seeded_assessments

    # Start attempt
    start_resp = await client.post(
        f"/api/v1/assessments/{reading_assessment.id}/attempts",
        headers=student_auth_headers,
    )
    attempt_id = start_resp.json()["id"]

    # Load correct options directly from database for grading verification
    assessment_full = await db_session.scalar(
        select(Assessment)
        .where(Assessment.id == reading_assessment.id)
        .options(
            selectinload(Assessment.sections)
            .selectinload(AssessmentSection.questions)
            .selectinload(Question.options)
        )
    )
    assert assessment_full is not None

    # Answer all questions correctly
    for section in assessment_full.sections:
        for q in section.questions:
            correct_opt = next(opt for opt in q.options if opt.is_correct)
            ans_resp = await client.post(
                f"/api/v1/attempts/{attempt_id}/answers",
                json={"question_id": str(q.id), "selected_option_id": str(correct_opt.id)},
                headers=student_auth_headers,
            )
            assert ans_resp.status_code == 200

    # Submit attempt
    submit_resp = await client.post(
        f"/api/v1/attempts/{attempt_id}/submit",
        headers=student_auth_headers,
    )
    assert submit_resp.status_code == 200
    data = submit_resp.json()
    assert data["status"] == AttemptStatus.SUBMITTED.value
    assert data["score"]["percentage"] == 100.0
    assert data["score"]["is_passed"] is True
    assert data["score"]["estimated_level"] == "C2"
    assert (
        "reading_comprehension" in data["score"]["skill_scores"]
        or len(data["score"]["skill_scores"]) > 0
    )

    # Post-submission: Explanations and is_correct are now visible in results!
    assert len(data["sections"]) > 0
    first_q = data["sections"][0]["questions"][0]
    assert first_q["explanation"] is not None
    assert first_q["options"][0]["is_correct"] is not None


@pytest.mark.asyncio
async def test_duplicate_submission_is_idempotent(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_assessments: tuple[Assessment, Assessment],
) -> None:
    """Verify submitting an already submitted attempt returns the existing score cleanly."""
    reading_assessment, _ = seeded_assessments

    start_resp = await client.post(
        f"/api/v1/assessments/{reading_assessment.id}/attempts",
        headers=student_auth_headers,
    )
    attempt_id = start_resp.json()["id"]

    # First submit
    sub1 = await client.post(
        f"/api/v1/attempts/{attempt_id}/submit",
        headers=student_auth_headers,
    )
    assert sub1.status_code == 200

    # Second submit (duplicate submit)
    sub2 = await client.post(
        f"/api/v1/attempts/{attempt_id}/submit",
        headers=student_auth_headers,
    )
    assert sub2.status_code == 200
    assert sub2.json()["score"]["total_points"] == sub1.json()["score"]["total_points"]


@pytest.mark.asyncio
async def test_concurrent_submissions(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_assessments: tuple[Assessment, Assessment],
) -> None:
    """Verify parallel concurrent submit requests do not cause race conditions or duplicate scores."""
    reading_assessment, _ = seeded_assessments

    start_resp = await client.post(
        f"/api/v1/assessments/{reading_assessment.id}/attempts",
        headers=student_auth_headers,
    )
    attempt_id = start_resp.json()["id"]

    # Launch 3 simultaneous submit requests
    tasks = [
        client.post(f"/api/v1/attempts/{attempt_id}/submit", headers=student_auth_headers)
        for _ in range(3)
    ]
    results = await asyncio.gather(*tasks)

    # All should return 200 successfully
    for res in results:
        assert res.status_code == 200
        assert res.json()["status"] == AttemptStatus.SUBMITTED.value


@pytest.mark.asyncio
async def test_cannot_modify_submitted_attempt(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_assessments: tuple[Assessment, Assessment],
) -> None:
    """Verify answering questions after submission is strictly rejected."""
    reading_assessment, _ = seeded_assessments

    start_resp = await client.post(
        f"/api/v1/assessments/{reading_assessment.id}/attempts",
        headers=student_auth_headers,
    )
    attempt_id = start_resp.json()["id"]

    # Submit attempt
    await client.post(
        f"/api/v1/attempts/{attempt_id}/submit",
        headers=student_auth_headers,
    )

    # Try to modify answer
    assessment_resp = await client.get(
        f"/api/v1/assessments/{reading_assessment.id}",
        headers=student_auth_headers,
    )
    question = assessment_resp.json()["sections"][0]["questions"][0]

    ans_resp = await client.post(
        f"/api/v1/attempts/{attempt_id}/answers",
        json={
            "question_id": question["id"],
            "selected_option_id": question["options"][0]["id"],
        },
        headers=student_auth_headers,
    )
    assert ans_resp.status_code == 400
    assert ans_resp.json()["error"]["code"] == "ATTEMPT_ALREADY_SUBMITTED"


def test_scoring_engine_unit() -> None:
    """Pure unit test of ScoringEngine without database."""
    # Build in-memory mock assessment
    assessment = Assessment(
        title="Mock Test",
        assessment_type=AssessmentType.READING,
        duration_seconds=1800,
        scoring_policy=ScoringPolicy.STANDARD_POINTS,
        pass_percentage=60.0,
    )
    sec = AssessmentSection(
        title="Sec 1",
        order_index=0,
    )
    q1_id = uuid.uuid4()
    opt1_id = uuid.uuid4()
    opt2_id = uuid.uuid4()
    q1 = Question(
        id=q1_id,
        prompt="Q1",
        points=2,
        question_type=QuestionType.SINGLE_CHOICE,
    )
    opt1 = QuestionOption(id=opt1_id, content="A", is_correct=True)
    opt2 = QuestionOption(id=opt2_id, content="B", is_correct=False)
    q1.options = [opt1, opt2]

    q2_id = uuid.uuid4()
    opt3_id = uuid.uuid4()
    opt4_id = uuid.uuid4()
    q2 = Question(
        id=q2_id,
        prompt="Q2",
        points=2,
        question_type=QuestionType.SINGLE_CHOICE,
    )
    opt3 = QuestionOption(id=opt3_id, content="C", is_correct=True)
    opt4 = QuestionOption(id=opt4_id, content="D", is_correct=False)
    q2.options = [opt3, opt4]

    sec.questions = [q1, q2]
    assessment.sections = [sec]

    # Case 1: All correct -> 100%
    ans1 = AttemptAnswer(question_id=q1_id, selected_option_id=opt1_id)
    ans2 = AttemptAnswer(question_id=q2_id, selected_option_id=opt3_id)
    res_full = ScoringEngine.calculate_score(assessment, [ans1, ans2])
    assert res_full.total_points == 4.0
    assert res_full.max_points == 4.0
    assert res_full.percentage == 100.0
    assert res_full.is_passed is True
    assert res_full.estimated_level == "C2"

    # Case 2: One correct, one wrong -> 50%
    ans_wrong = AttemptAnswer(question_id=q2_id, selected_option_id=opt4_id)
    res_half = ScoringEngine.calculate_score(assessment, [ans1, ans_wrong])
    assert res_half.total_points == 2.0
    assert res_half.percentage == 50.0
    assert res_half.is_passed is False
    assert res_half.estimated_level == "B1"

    # Case 3: Empty answers -> 0%
    res_zero = ScoringEngine.calculate_score(assessment, [])
    assert res_zero.total_points == 0.0
    assert res_zero.percentage == 0.0
    assert res_zero.is_passed is False
    assert res_zero.estimated_level == "A1"
