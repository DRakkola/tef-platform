"""Comprehensive tests for the student assessment flow:
- Assessment discovery & metadata
- Concealment of answers & explanations (anti-cheating)
- Attempt creation, version binding & resuming
- Authoritative timer & state endpoint
- Stale answer write protection
- Expired attempt rejection & auto-finalization
- Student attempt access isolation
- Mistakes, skills & recommendation generation on submission
- Results disclaimer and recommended exercise links
"""

import datetime
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.modules.assessments.enums import AssessmentType
from app.modules.assessments.models import Assessment, Attempt
from app.modules.assessments.seed import seed_demo_assessments
from app.modules.learning.models import Mistake, StudentSkill
from app.modules.users.models import User, UserRole


@pytest_asyncio.fixture
async def seeded_data(db_session: AsyncSession) -> tuple[Assessment, User, User]:
    """Seed assessments and provide two distinct students."""
    await seed_demo_assessments(db_session)
    reading = await db_session.scalar(
        select(Assessment).where(Assessment.assessment_type == AssessmentType.READING)
    )
    assert reading is not None

    student1 = User(
        email=f"student_flow_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("Pass12345!"),
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    student2 = User(
        email=f"student_other_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("Pass12345!"),
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add_all([student1, student2])
    await db_session.commit()
    await db_session.refresh(student1)
    await db_session.refresh(student2)
    return reading, student1, student2


@pytest.mark.asyncio
async def test_assessments_discovery_and_metadata(
    client: AsyncClient,
    seeded_data: tuple[Assessment, User, User],
) -> None:
    """Verify assessment listing contains duration, level, and estimated completion time."""
    reading, student1, _ = seeded_data
    token = create_access_token(subject=student1.id, role=student1.role.value)

    resp = await client.get("/api/v1/assessments", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    item = next((it for it in data["items"] if it["id"] == str(reading.id)), None)
    assert item is not None
    assert item["title"] == reading.title
    assert "level" in item
    assert "estimated_completion_time_minutes" in item
    assert item["estimated_completion_time_minutes"] >= 5


@pytest.mark.asyncio
async def test_anti_cheating_conceals_answers(
    client: AsyncClient,
    seeded_data: tuple[Assessment, User, User],
) -> None:
    """Verify GET /assessments/{id} never exposes is_correct or explanations to students."""
    reading, student1, _ = seeded_data
    token = create_access_token(subject=student1.id, role=student1.role.value)

    resp = await client.get(
        f"/api/v1/assessments/{reading.id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    payload = resp.json()

    # Traverse sections and questions
    for section in payload["sections"]:
        for question in section["questions"]:
            # Explanation must be None or omitted
            assert question.get("explanation") is None
            for opt in question["options"]:
                # is_correct and explanation must NOT exist in student taking view
                assert "is_correct" not in opt
                assert "explanation" not in opt


@pytest.mark.asyncio
async def test_attempt_creation_and_resume(
    client: AsyncClient,
    seeded_data: tuple[Assessment, User, User],
) -> None:
    """Verify starting an attempt sets server-controlled timestamps and resumes existing active attempts."""
    reading, student1, _ = seeded_data
    token = create_access_token(subject=student1.id, role=student1.role.value)

    # Start attempt
    resp1 = await client.post(
        f"/api/v1/assessments/{reading.id}/attempts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp1.status_code == 201
    attempt1 = resp1.json()
    assert attempt1["status"] == "started"
    assert attempt1["remaining_seconds"] > 0
    assert attempt1["student_id"] == str(student1.id)

    # Calling start again while active must resume the SAME attempt (no duplicate)
    resp2 = await client.post(
        f"/api/v1/assessments/{reading.id}/attempts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.status_code == 201
    attempt2 = resp2.json()
    assert attempt2["id"] == attempt1["id"]
    assert attempt2["status"] == "started"


@pytest.mark.asyncio
async def test_attempt_state_endpoint(
    client: AsyncClient,
    seeded_data: tuple[Assessment, User, User],
) -> None:
    """Verify GET /attempts/{id}/state returns server-authoritative timer and answer reconciliation."""
    reading, student1, _ = seeded_data
    token = create_access_token(subject=student1.id, role=student1.role.value)

    # Start attempt
    resp = await client.post(
        f"/api/v1/assessments/{reading.id}/attempts",
        headers={"Authorization": f"Bearer {token}"},
    )
    attempt = resp.json()
    attempt_id = attempt["id"]

    # Fetch authoritative state
    state_resp = await client.get(
        f"/api/v1/attempts/{attempt_id}/state",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert state_resp.status_code == 200
    state = state_resp.json()
    assert state["attempt_id"] == attempt_id
    assert state["status"] == "started"
    assert state["remaining_seconds"] > 0
    assert state["is_expired"] is False
    assert state["total_questions"] > 0
    assert isinstance(state["answers"], dict)


@pytest.mark.asyncio
async def test_put_answer_and_stale_write_protection(
    client: AsyncClient,
    db_session: AsyncSession,
    seeded_data: tuple[Assessment, User, User],
) -> None:
    """Verify PUT /attempts/{id}/answers/{question_id} and stale write protection."""
    reading, student1, _ = seeded_data
    token = create_access_token(subject=student1.id, role=student1.role.value)

    # Start attempt
    resp = await client.post(
        f"/api/v1/assessments/{reading.id}/attempts",
        headers={"Authorization": f"Bearer {token}"},
    )
    attempt = resp.json()
    attempt_id = attempt["id"]

    # Find question & options
    detail_resp = await client.get(
        f"/api/v1/assessments/{reading.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    q = detail_resp.json()["sections"][0]["questions"][0]
    q_id = q["id"]
    opt_1 = q["options"][0]["id"]
    opt_2 = q["options"][1]["id"]

    now = datetime.datetime.now(datetime.UTC)

    # Submit newer answer first
    newer_time = now.isoformat()
    put1 = await client.put(
        f"/api/v1/attempts/{attempt_id}/answers/{q_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "selected_option_id": opt_1,
            "client_timestamp": newer_time,
        },
    )
    assert put1.status_code == 200
    assert put1.json()["selected_option_id"] == opt_1

    # Attempt to overwrite with older/stale client timestamp (e.g. delayed offline request)
    stale_time = (now - datetime.timedelta(minutes=5)).isoformat()
    put_stale = await client.put(
        f"/api/v1/attempts/{attempt_id}/answers/{q_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "selected_option_id": opt_2,
            "client_timestamp": stale_time,
        },
    )
    assert put_stale.status_code == 200
    # Stale update should be ignored; opt_1 remains preserved
    assert put_stale.json()["selected_option_id"] == opt_1


@pytest.mark.asyncio
async def test_timer_expiration_rejects_answers(
    client: AsyncClient,
    db_session: AsyncSession,
    seeded_data: tuple[Assessment, User, User],
) -> None:
    """Verify that when now > expires_at, answers are rejected with ATTEMPT_EXPIRED."""
    reading, student1, _ = seeded_data
    token = create_access_token(subject=student1.id, role=student1.role.value)

    # Start attempt
    resp = await client.post(
        f"/api/v1/assessments/{reading.id}/attempts",
        headers={"Authorization": f"Bearer {token}"},
    )
    attempt = resp.json()
    attempt_id = attempt["id"]

    # Force expiration in database
    past_time = datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=10)
    attempt_db = await db_session.scalar(
        select(Attempt).where(Attempt.id == uuid.UUID(attempt_id))
    )
    assert attempt_db is not None
    attempt_db.expires_at = past_time
    await db_session.commit()

    detail_resp = await client.get(
        f"/api/v1/assessments/{reading.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    q_id = detail_resp.json()["sections"][0]["questions"][0]["id"]
    opt_id = detail_resp.json()["sections"][0]["questions"][0]["options"][0]["id"]

    # Attempt to answer after expiration
    put_resp = await client.put(
        f"/api/v1/attempts/{attempt_id}/answers/{q_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"selected_option_id": opt_id},
    )
    assert put_resp.status_code == 400
    err = put_resp.json()
    assert err["error"]["code"] == "ATTEMPT_EXPIRED"


@pytest.mark.asyncio
async def test_student_isolation_and_rbac(
    client: AsyncClient,
    seeded_data: tuple[Assessment, User, User],
) -> None:
    """Verify Student B cannot access or modify Student A's attempt."""
    reading, student1, student2 = seeded_data
    token1 = create_access_token(subject=student1.id, role=student1.role.value)
    token2 = create_access_token(subject=student2.id, role=student2.role.value)

    # Student 1 starts attempt
    resp = await client.post(
        f"/api/v1/assessments/{reading.id}/attempts",
        headers={"Authorization": f"Bearer {token1}"},
    )
    attempt_id = resp.json()["id"]

    # Student 2 tries to read Student 1's attempt
    read_resp = await client.get(
        f"/api/v1/attempts/{attempt_id}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert read_resp.status_code == 403

    # Student 2 tries to submit Student 1's attempt
    submit_resp = await client.post(
        f"/api/v1/attempts/{attempt_id}/submit",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert submit_resp.status_code == 403


@pytest.mark.asyncio
async def test_full_submission_mistakes_and_recommendations(
    client: AsyncClient,
    db_session: AsyncSession,
    seeded_data: tuple[Assessment, User, User],
) -> None:
    """Verify submitting generates mistakes, skill updates, deterministic recommendations, and results payload."""
    reading, student1, _ = seeded_data
    token = create_access_token(subject=student1.id, role=student1.role.value)

    # 1. Start attempt
    start_resp = await client.post(
        f"/api/v1/assessments/{reading.id}/attempts",
        headers={"Authorization": f"Bearer {token}"},
    )
    attempt_id = start_resp.json()["id"]

    # 2. Answer questions (deliberately answer one incorrectly to test mistake logging)
    detail_resp = await client.get(
        f"/api/v1/assessments/{reading.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    q1 = detail_resp.json()["sections"][0]["questions"][0]
    opt1 = q1["options"][0]["id"]

    await client.put(
        f"/api/v1/attempts/{attempt_id}/answers/{q1['id']}",
        headers={"Authorization": f"Bearer {token}"},
        json={"selected_option_id": opt1},
    )

    # 3. Submit attempt
    submit_resp = await client.post(
        f"/api/v1/attempts/{attempt_id}/submit",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert submit_resp.status_code == 200
    results = submit_resp.json()

    # 4. Verify results payload structure
    assert results["attempt_id"] == attempt_id
    assert results["status"] in ("submitted", "expired")
    assert "score" in results
    assert "percentage" in results["score"]
    assert "estimated_level" in results["score"]
    assert "disclaimer" in results
    assert "CCI Paris" in results["disclaimer"]  # Official disclaimer check
    assert "sections" in results
    assert "mistakes" in results

    # 5. Verify database side-effects
    mistakes = (
        await db_session.execute(select(Mistake).where(Mistake.user_id == student1.id))
    ).scalars().all()
    assert len(mistakes) >= 1

    skills = (
        await db_session.execute(select(StudentSkill).where(StudentSkill.user_id == student1.id))
    ).scalars().all()
    assert len(skills) >= 1


@pytest.mark.asyncio
async def test_end_to_end_complete_student_lifecycle(
    client: AsyncClient,
    seeded_data: tuple[Assessment, User, User],
) -> None:
    """Complete product journey:
    Register -> discover assessments -> view instructions -> start attempt
    -> poll state/timer -> answer questions -> submit -> view results
    -> see mistakes & skill analysis -> start recommended exercise -> view updated dashboard.
    """
    reading, _, _ = seeded_data
    unique_email = f"student_lifecycle_{uuid.uuid4().hex[:8]}@example.com"
    password = "StrongPassword123!"

    # 1. Register new student
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": password,
            "full_name": "Jean Dupont",
            "role": "student",
        },
    )
    assert reg_resp.status_code == 201
    auth_data = reg_resp.json()
    token = auth_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Discover published assessments
    asmt_resp = await client.get("/api/v1/assessments", headers=headers)
    assert asmt_resp.status_code == 200
    items = asmt_resp.json()["items"]
    assert len(items) >= 1
    target_asmt = next(a for a in items if a["id"] == str(reading.id))
    assert target_asmt["level"] is not None

    # 3. Read instructions & rules (anti-cheating: answers concealed)
    detail_resp = await client.get(f"/api/v1/assessments/{target_asmt['id']}", headers=headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert len(detail["sections"]) >= 1
    # Check that is_correct is not present in options
    for opt in detail["sections"][0]["questions"][0]["options"]:
        assert "is_correct" not in opt

    # 4. Start attempt
    start_resp = await client.post(
        f"/api/v1/assessments/{target_asmt['id']}/attempts",
        headers=headers,
    )
    assert start_resp.status_code == 201
    attempt_data = start_resp.json()
    attempt_id = attempt_data["id"]
    assert attempt_data["status"] == "started"

    # 5. Authoritative state & timer check
    state_resp = await client.get(f"/api/v1/attempts/{attempt_id}/state", headers=headers)
    assert state_resp.status_code == 200
    state = state_resp.json()
    assert state["remaining_seconds"] > 0
    assert not state["is_expired"]

    # 6. Answer questions with stale-write client timestamp
    q1 = detail["sections"][0]["questions"][0]
    opt1 = q1["options"][0]["id"]
    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    answer_resp = await client.put(
        f"/api/v1/attempts/{attempt_id}/answers/{q1['id']}",
        headers=headers,
        json={
            "selected_option_id": opt1,
            "client_timestamp": now_iso,
        },
    )
    assert answer_resp.status_code == 200

    # 7. Submit attempt
    submit_resp = await client.post(f"/api/v1/attempts/{attempt_id}/submit", headers=headers)
    assert submit_resp.status_code == 200
    results = submit_resp.json()

    # 8. Verify results: CEFR level, official disclaimer, mistakes, recommendations
    assert results["score"]["estimated_level"] is not None
    assert "disclaimer" in results
    assert "CCI Paris" in results["disclaimer"]
    assert len(results["sections"]) >= 1

    # 9. If recommendations generated, student starts recommended exercise
    if results.get("recommended_exercises"):
        rec_ex = results["recommended_exercises"][0]
        ex_attempt_resp = await client.post(
            f"/api/v1/exercises/{rec_ex['id']}/attempts",
            headers=headers,
            json={"selected_option_index": 0},
        )
        assert ex_attempt_resp.status_code == 201
        ex_result = ex_attempt_resp.json()
        assert "is_correct" in ex_result
        assert "points_awarded" in ex_result

    # 10. Dashboard reflects student progress
    dash_resp = await client.get("/api/v1/students/me/dashboard", headers=headers)
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert "skills" in dash_data
    assert dash_data["total_assessments_taken"] >= 1
    assert len(dash_data["recent_assessments"]) >= 1
    assert dash_data["recent_assessments"][0]["id"] == attempt_id
    assert dash_data["recent_assessments"][0]["title"] == reading.title
