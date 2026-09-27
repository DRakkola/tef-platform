"""Tests for TEF Speaking Exam hierarchy, sections, turns, and state machine."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.modules.speaking.enums import (
    ExamSectionType,
    SpeakingExamState,
    SpeakingSectionState,
    SpeakingTurnSpeaker,
)
from app.modules.users.models import StudentProfile, User, UserRole


@pytest.fixture
async def second_student(db_session: AsyncSession) -> User:
    """Create a second student for authorization isolation tests."""
    user = User(
        id=uuid.uuid4(),
        email=f"student2_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("ValidPassword123!"),
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    profile = StudentProfile(
        user_id=user.id,
        target_exam="TEF Canada",
        target_level="B2",
    )
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def second_student_headers(second_student: User) -> dict[str, str]:
    token = create_access_token(second_student.id, second_student.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_speaking_exam_with_sections(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
) -> None:
    """Student creates a full TEF speaking exam with Section A and Section B."""
    payload = {
        "level": "B2",
        "title": "TEF Canada Expression Orale — Épreuve Complète",
        "topic_a": "Demande de renseignements pour des cours de peinture",
        "topic_b": "Convaincre un ami de participer à un défi sportif zéro déchet",
    }
    response = await client.post(
        "/api/v1/speaking/exams",
        json=payload,
        headers=student_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()

    assert data["state"] == SpeakingExamState.CREATED.value
    assert data["level"] == "B2"
    assert data["student_id"] == str(test_student.id)
    assert data["session_id"] is not None

    sections = data["sections"]
    assert len(sections) == 2

    sec_a = next(s for s in sections if s["section_type"] == ExamSectionType.SECTION_A.value)
    assert sec_a["sequence"] == 1
    assert sec_a["target_duration_seconds"] == 600
    assert sec_a["state"] == SpeakingSectionState.PENDING.value
    assert sec_a["topic"] == payload["topic_a"]
    assert "formelle" in sec_a["title"].lower()

    sec_b = next(s for s in sections if s["section_type"] == ExamSectionType.SECTION_B.value)
    assert sec_b["sequence"] == 2
    assert sec_b["target_duration_seconds"] == 900
    assert sec_b["state"] == SpeakingSectionState.PENDING.value
    assert sec_b["topic"] == payload["topic_b"]
    assert "persuasion" in sec_b["title"].lower()


@pytest.mark.asyncio
async def test_start_speaking_exam_initializes_section_a(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
) -> None:
    """Starting an exam activates Section A and sets the 600s server countdown timer."""
    # 1. Create exam
    create_res = await client.post(
        "/api/v1/speaking/exams",
        json={"level": "B2"},
        headers=student_auth_headers,
    )
    assert create_res.status_code == 201
    exam_id = create_res.json()["id"]

    # 2. Start exam
    start_res = await client.post(
        f"/api/v1/speaking/exams/{exam_id}/start",
        headers=student_auth_headers,
    )
    assert start_res.status_code == 200
    exam_data = start_res.json()
    assert exam_data["state"] == SpeakingExamState.SECTION_A_ACTIVE.value
    assert exam_data["started_at"] is not None

    sec_a = next(s for s in exam_data["sections"] if s["section_type"] == ExamSectionType.SECTION_A.value)
    assert sec_a["state"] == SpeakingSectionState.ACTIVE.value
    assert sec_a["started_at"] is not None
    assert sec_a["expires_at"] is not None

    # Verify state inspection endpoint
    state_res = await client.get(
        f"/api/v1/speaking/exams/{exam_id}/state",
        headers=student_auth_headers,
    )
    assert state_res.status_code == 200
    state_data = state_res.json()
    assert state_data["state"] == SpeakingExamState.SECTION_A_ACTIVE.value
    assert state_data["active_section"] == ExamSectionType.SECTION_A.value
    assert 0 < state_data["active_section_remaining_seconds"] <= 600

    # 3. Idempotency: Calling start again does NOT change started_at or crash
    first_started_at = exam_data["started_at"]
    start_res2 = await client.post(
        f"/api/v1/speaking/exams/{exam_id}/start",
        headers=student_auth_headers,
    )
    assert start_res2.status_code == 200
    assert start_res2.json()["started_at"] == first_started_at


@pytest.mark.asyncio
async def test_full_exam_section_transitions(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
) -> None:
    """Test the complete state progression: Section A -> Section B Prep -> Section B -> Completed."""
    # 1. Create and Start
    create_res = await client.post(
        "/api/v1/speaking/exams",
        json={"level": "B2"},
        headers=student_auth_headers,
    )
    exam_id = create_res.json()["id"]

    await client.post(f"/api/v1/speaking/exams/{exam_id}/start", headers=student_auth_headers)

    # 2. Complete Section A
    comp_a_res = await client.post(
        f"/api/v1/speaking/exams/{exam_id}/sections/section_a/complete",
        headers=student_auth_headers,
    )
    assert comp_a_res.status_code == 200
    exam_data = comp_a_res.json()
    assert exam_data["state"] == SpeakingExamState.SECTION_B_PREPARING.value

    sec_a = next(s for s in exam_data["sections"] if s["section_type"] == ExamSectionType.SECTION_A.value)
    assert sec_a["state"] == SpeakingSectionState.COMPLETED.value

    # Check state endpoint reflects preparation window
    state_res = await client.get(
        f"/api/v1/speaking/exams/{exam_id}/state",
        headers=student_auth_headers,
    )
    assert state_res.json()["state"] == SpeakingExamState.SECTION_B_PREPARING.value
    assert state_res.json()["prep_remaining_seconds"] is not None
    assert 0 < state_res.json()["prep_remaining_seconds"] <= 60

    # 3. Start Section B
    start_b_res = await client.post(
        f"/api/v1/speaking/exams/{exam_id}/sections/section_b/start",
        headers=student_auth_headers,
    )
    assert start_b_res.status_code == 200
    exam_data = start_b_res.json()
    assert exam_data["state"] == SpeakingExamState.SECTION_B_ACTIVE.value

    sec_b = next(s for s in exam_data["sections"] if s["section_type"] == ExamSectionType.SECTION_B.value)
    assert sec_b["state"] == SpeakingSectionState.ACTIVE.value
    assert sec_b["started_at"] is not None
    assert sec_b["expires_at"] is not None

    # Check state endpoint reflects section B active
    state_res = await client.get(
        f"/api/v1/speaking/exams/{exam_id}/state",
        headers=student_auth_headers,
    )
    assert state_res.json()["state"] == SpeakingExamState.SECTION_B_ACTIVE.value
    assert state_res.json()["active_section"] == ExamSectionType.SECTION_B.value
    assert 0 < state_res.json()["active_section_remaining_seconds"] <= 900

    # 4. Complete Section B -> Completes Exam
    comp_b_res = await client.post(
        f"/api/v1/speaking/exams/{exam_id}/sections/section_b/complete",
        headers=student_auth_headers,
    )
    assert comp_b_res.status_code == 200
    exam_data = comp_b_res.json()
    assert exam_data["state"] == SpeakingExamState.COMPLETED.value
    assert exam_data["completed_at"] is not None

    sec_b_final = next(s for s in exam_data["sections"] if s["section_type"] == ExamSectionType.SECTION_B.value)
    assert sec_b_final["state"] == SpeakingSectionState.COMPLETED.value


@pytest.mark.asyncio
async def test_record_and_list_speaking_turns(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
) -> None:
    """Turns are persisted per section, numbered chronologically, and support idempotent submission."""
    create_res = await client.post(
        "/api/v1/speaking/exams",
        json={"level": "B2"},
        headers=student_auth_headers,
    )
    exam_id = create_res.json()["id"]
    await client.post(f"/api/v1/speaking/exams/{exam_id}/start", headers=student_auth_headers)

    # 1. Record Examiner Turn
    turn_1_client_id = str(uuid.uuid4())
    t1_res = await client.post(
        f"/api/v1/speaking/exams/{exam_id}/sections/section_a/turns",
        json={
            "speaker": SpeakingTurnSpeaker.EXAMINER.value,
            "content_text": "Bonjour, je vous écoute pour vos questions.",
            "duration_seconds": 3.5,
            "client_turn_id": turn_1_client_id,
        },
        headers=student_auth_headers,
    )
    assert t1_res.status_code == 201
    t1_data = t1_res.json()
    assert t1_data["turn_number"] == 1
    assert t1_data["speaker"] == SpeakingTurnSpeaker.EXAMINER.value
    assert t1_data["content_text"] == "Bonjour, je vous écoute pour vos questions."

    # Idempotent re-send of same client_turn_id
    t1_dup = await client.post(
        f"/api/v1/speaking/exams/{exam_id}/sections/section_a/turns",
        json={
            "speaker": SpeakingTurnSpeaker.EXAMINER.value,
            "content_text": "Bonjour, je vous écoute pour vos questions.",
            "duration_seconds": 3.5,
            "client_turn_id": turn_1_client_id,
        },
        headers=student_auth_headers,
    )
    assert t1_dup.status_code == 201
    assert t1_dup.json()["id"] == t1_data["id"]
    assert t1_dup.json()["turn_number"] == 1

    # 2. Record Candidate Turn
    t2_res = await client.post(
        f"/api/v1/speaking/exams/{exam_id}/sections/section_a/turns",
        json={
            "speaker": SpeakingTurnSpeaker.CANDIDATE.value,
            "content_text": "Bonjour madame, quels sont les horaires des cours du soir ?",
            "duration_seconds": 4.2,
        },
        headers=student_auth_headers,
    )
    assert t2_res.status_code == 201
    assert t2_res.json()["turn_number"] == 2
    assert t2_res.json()["speaker"] == SpeakingTurnSpeaker.CANDIDATE.value

    # 3. List turns for Section A
    list_res = await client.get(
        f"/api/v1/speaking/exams/{exam_id}/sections/section_a/turns",
        headers=student_auth_headers,
    )
    assert list_res.status_code == 200
    turns = list_res.json()
    assert len(turns) == 2
    assert turns[0]["turn_number"] == 1
    assert turns[1]["turn_number"] == 2


@pytest.mark.asyncio
async def test_exam_authorization_isolation(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
    second_student: User,
    second_student_headers: dict[str, str],
) -> None:
    """A student cannot access or modify another student's exam."""
    # Student 1 creates an exam
    create_res = await client.post(
        "/api/v1/speaking/exams",
        json={"level": "B2"},
        headers=student_auth_headers,
    )
    exam_id = create_res.json()["id"]

    # Student 2 attempts to get exam details
    get_res = await client.get(
        f"/api/v1/speaking/exams/{exam_id}",
        headers=second_student_headers,
    )
    assert get_res.status_code in (403, 404)

    # Student 2 attempts to start exam
    start_res = await client.post(
        f"/api/v1/speaking/exams/{exam_id}/start",
        headers=second_student_headers,
    )
    assert start_res.status_code in (403, 404)

    # Student 2 attempts to add turn
    turn_res = await client.post(
        f"/api/v1/speaking/exams/{exam_id}/sections/section_a/turns",
        json={
            "speaker": "candidate",
            "content_text": "Unauthorized turn",
        },
        headers=second_student_headers,
    )
    assert turn_res.status_code in (403, 404)
