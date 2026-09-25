"""Comprehensive tests for speaking sessions, server timer ownership, WebRTC signaling, and evaluations."""

import datetime
import uuid
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.core.security import create_access_token, hash_password
from app.modules.assessments.models import Skill, SkillCategory
from app.modules.speaking.enums import (
    SpeakingParticipantRole,
    SpeakingSessionState,
    SpeakingSessionType,
)
from app.modules.speaking.models import (
    SpeakingSession,
)
from app.modules.speaking.service import SpeakingService
from app.modules.speaking.signaling import SignalingConnectionManager
from app.modules.teachers.models import TeacherBooking
from app.modules.users.models import TeacherProfile, TeacherVerificationStatus, User, UserRole


@pytest.fixture
async def sample_skill(db_session: AsyncSession) -> Skill:
    """Create a sample skill for speaking diagnostic evaluation."""
    skill = Skill(
        id=uuid.uuid4(),
        name="Prononciation et intonation",
        code=f"SPK_PRON_{uuid.uuid4().hex[:4]}",
        category=SkillCategory.SPEAKING,
        description="Maîtrise des phonèmes du français et accent d'insistance",
    )
    db_session.add(skill)
    await db_session.commit()
    await db_session.refresh(skill)
    return skill


@pytest.fixture
async def verified_speaking_teacher(db_session: AsyncSession) -> tuple[User, TeacherProfile]:
    """Create a verified teacher for speaking practice."""
    teacher_user = User(
        id=uuid.uuid4(),
        email=f"teacher_spk_{uuid.uuid4().hex[:6]}@example.com",
        password_hash=hash_password("TeacherSecurePass123!"),
        role=UserRole.TEACHER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(teacher_user)
    await db_session.flush()

    teacher_profile = TeacherProfile(
        id=uuid.uuid4(),
        user_id=teacher_user.id,
        display_name="Professeur Pierre",
        bio="Examinateur TEF agréé avec spécialisation Expression Orale.",
        expertise=["expression_orale", "TEF Canada"],
        teaching_levels=["B1", "B2", "C1"],
        hourly_price=5000,
        verification_status=TeacherVerificationStatus.APPROVED,
        timezone="Europe/Paris",
    )
    db_session.add(teacher_profile)
    await db_session.commit()
    await db_session.refresh(teacher_user)
    await db_session.refresh(teacher_profile)
    return teacher_user, teacher_profile


@pytest.fixture
async def sample_booking(
    db_session: AsyncSession,
    test_student: User,
    verified_speaking_teacher: tuple[User, TeacherProfile],
) -> TeacherBooking:
    """Create a teacher booking for speaking session test."""
    _, teacher_profile = verified_speaking_teacher
    now = datetime.datetime.now(datetime.UTC)
    booking = TeacherBooking(
        id=uuid.uuid4(),
        teacher_id=teacher_profile.id,
        student_id=test_student.id,
        start_time=now + datetime.timedelta(hours=1),
        end_time=now + datetime.timedelta(hours=1, minutes=30),
        status="confirmed",
        meeting_link="https://meet.tefplatform.local/test-booking",
    )
    db_session.add(booking)
    await db_session.commit()
    await db_session.refresh(booking)
    return booking


# --- 1. Session Creation & Details Tests ---


@pytest.mark.asyncio
async def test_create_ai_speaking_session(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
) -> None:
    """Student creates an AI speaking session with default 25 minutes duration."""
    payload = {
        "session_type": "ai",
        "topic": "TEF Section A — Demande de renseignements pour un voyage",
        "level": "B2",
        "duration_minutes": 25,
    }
    response = await client.post(
        "/api/v1/speaking/sessions",
        json=payload,
        headers=student_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["session_type"] == "ai"
    assert data["status"] == "scheduled"
    assert data["topic"] == payload["topic"]
    assert data["level"] == "B2"
    assert data["duration_minutes"] == 25
    assert data["starts_at"] is None
    assert data["expires_at"] is None
    assert data["room_id"].startswith("room_")

    # Verify participants: 1 student + 1 AI assistant
    participants = data["participants"]
    assert len(participants) == 2
    roles = [p["role"] for p in participants]
    assert SpeakingParticipantRole.STUDENT.value in roles
    assert SpeakingParticipantRole.AI_ASSISTANT.value in roles


@pytest.mark.asyncio
async def test_create_teacher_speaking_session(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
    sample_booking: TeacherBooking,
) -> None:
    """Student creates a speaking session linked to a confirmed teacher booking."""
    payload = {
        "session_type": "teacher",
        "topic": "TEF Section B — Convaincre un ami",
        "level": "B2",
        "duration_minutes": 25,
        "booking_id": str(sample_booking.id),
    }
    response = await client.post(
        "/api/v1/speaking/sessions",
        json=payload,
        headers=student_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["session_type"] == "teacher"
    assert len(data["participants"]) == 2
    roles = [p["role"] for p in data["participants"]]
    assert SpeakingParticipantRole.STUDENT.value in roles
    assert SpeakingParticipantRole.TEACHER.value in roles


@pytest.mark.asyncio
async def test_list_speaking_sessions(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
    teacher_auth_headers: dict[str, str],
) -> None:
    """User lists their speaking sessions, respecting isolation."""
    # Create session as student
    create_res = await client.post(
        "/api/v1/speaking/sessions",
        json={"session_type": "ai", "topic": "Session 1"},
        headers=student_auth_headers,
    )
    assert create_res.status_code == 201

    # Student list should contain the session
    res_student = await client.get("/api/v1/speaking/sessions", headers=student_auth_headers)
    assert res_student.status_code == 200
    student_data = res_student.json()
    assert student_data["total"] >= 1

    # Teacher list should not contain the student's AI session
    res_teacher = await client.get("/api/v1/speaking/sessions", headers=teacher_auth_headers)
    assert res_teacher.status_code == 200
    teacher_data = res_teacher.json()
    teacher_session_ids = [s["id"] for s in teacher_data["items"]]
    assert create_res.json()["id"] not in teacher_session_ids


@pytest.mark.asyncio
async def test_get_speaking_session_detail_and_ice_servers(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
) -> None:
    """Fetch session details including ICE candidate configuration."""
    create_res = await client.post(
        "/api/v1/speaking/sessions",
        json={"session_type": "ai", "topic": "ICE Server Check"},
        headers=student_auth_headers,
    )
    session_id = create_res.json()["id"]

    res = await client.get(f"/api/v1/speaking/sessions/{session_id}", headers=student_auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == session_id
    assert "ice_servers" in data
    assert len(data["ice_servers"]) > 0
    # Must include standard STUN server
    stun_found = any(any("stun:" in u for u in s.get("urls", [])) for s in data["ice_servers"])
    assert stun_found is True


@pytest.mark.asyncio
async def test_unauthorized_user_forbidden_from_session(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
    teacher_auth_headers: dict[str, str],
) -> None:
    """User not part of the session cannot view session details."""
    create_res = await client.post(
        "/api/v1/speaking/sessions",
        json={"session_type": "ai", "topic": "Private session"},
        headers=student_auth_headers,
    )
    session_id = create_res.json()["id"]

    # Teacher who is not a participant tries to view it
    res = await client.get(f"/api/v1/speaking/sessions/{session_id}", headers=teacher_auth_headers)
    assert res.status_code == 403


# --- 2. Server Timer Ownership & Lifecycle Tests ---


@pytest.mark.asyncio
async def test_server_timer_ownership_on_start(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
) -> None:
    """Backend strictly controls starts_at, expires_at, and remaining_seconds."""
    create_res = await client.post(
        "/api/v1/speaking/sessions",
        json={"session_type": "ai", "duration_minutes": 25},
        headers=student_auth_headers,
    )
    session_id = create_res.json()["id"]

    # Start the session
    start_res = await client.post(
        f"/api/v1/speaking/sessions/{session_id}/start",
        headers=student_auth_headers,
    )
    assert start_res.status_code == 200
    data = start_res.json()
    assert data["status"] == "active"
    assert data["starts_at"] is not None
    assert data["expires_at"] is not None
    assert data["remaining_seconds"] is not None
    # 25 minutes = 1500 seconds (allow slight network skew)
    assert 1450 <= data["remaining_seconds"] <= 1500


@pytest.mark.asyncio
async def test_cannot_start_completed_or_cancelled_session(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
) -> None:
    """Cannot start a session that has already been cancelled or completed."""
    create_res = await client.post(
        "/api/v1/speaking/sessions",
        json={"session_type": "ai"},
        headers=student_auth_headers,
    )
    session_id = create_res.json()["id"]

    # Cancel session
    cancel_res = await client.post(
        f"/api/v1/speaking/sessions/{session_id}/cancel",
        headers=student_auth_headers,
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"

    # Attempting to start cancelled session fails with 400
    res = await client.post(
        f"/api/v1/speaking/sessions/{session_id}/start",
        headers=student_auth_headers,
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "INVALID_SESSION_STATE"


@pytest.mark.asyncio
async def test_server_enforces_session_expiration(
    db_session: AsyncSession,
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
) -> None:
    """When expires_at is in the past, backend automatically expires the session."""
    create_res = await client.post(
        "/api/v1/speaking/sessions",
        json={"session_type": "ai", "duration_minutes": 25},
        headers=student_auth_headers,
    )
    session_id = uuid.UUID(create_res.json()["id"])

    # Simulate expired session directly in database
    session = await db_session.get(SpeakingSession, session_id)
    assert session is not None
    session.status = SpeakingSessionState.ACTIVE
    session.starts_at = datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=30)
    session.expires_at = datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=5)
    await db_session.commit()

    # Accessing the session should detect expiry and transition to expired
    get_res = await client.get(
        f"/api/v1/speaking/sessions/{session_id}",
        headers=student_auth_headers,
    )
    assert get_res.status_code == 200
    assert get_res.json()["status"] == "expired"


# --- 3. Session Completion & AI Evaluation Tests ---


@pytest.mark.asyncio
async def test_complete_ai_speaking_session_auto_evaluates(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
    sample_skill: Skill,
) -> None:
    """Completing an AI speaking session triggers mock evaluation with regulatory compliance."""
    create_res = await client.post(
        "/api/v1/speaking/sessions",
        json={"session_type": "ai", "topic": "Épreuve d'expression orale B2", "level": "B2"},
        headers=student_auth_headers,
    )
    session_id = create_res.json()["id"]

    # Start session
    await client.post(
        f"/api/v1/speaking/sessions/{session_id}/start",
        headers=student_auth_headers,
    )

    # Complete session
    complete_res = await client.post(
        f"/api/v1/speaking/sessions/{session_id}/complete",
        headers=student_auth_headers,
    )
    assert complete_res.status_code == 200
    assert complete_res.json()["status"] == "completed"

    # Fetch evaluation
    eval_res = await client.get(
        f"/api/v1/speaking/sessions/{session_id}/evaluation",
        headers=student_auth_headers,
    )
    assert eval_res.status_code == 200
    eval_data = eval_res.json()

    # Verify structured criteria
    assert eval_data["session_id"] == session_id
    assert eval_data["student_id"] == str(test_student.id)
    assert eval_data["evaluator_type"] in ("ai", "mock")
    assert eval_data["estimated_level"] == "B2"
    assert 0.0 <= eval_data["fluency"] <= 100.0
    assert 0.0 <= eval_data["vocabulary"] <= 100.0
    assert 0.0 <= eval_data["grammar"] <= 100.0
    assert 0.0 <= eval_data["coherence"] <= 100.0
    assert 0.0 <= eval_data["pronunciation"] <= 100.0
    assert 0.0 <= eval_data["overall_score"] <= 100.0
    assert len(eval_data["strengths"]) > 0
    assert len(eval_data["weaknesses"]) > 0
    assert len(eval_data["recommendations"]) > 0
    assert eval_data["detailed_feedback"] is not None

    # Regulatory compliance: Must be False
    assert eval_data["is_official_tef"] is False


# --- 4. Teacher Evaluation Submission Tests ---


@pytest.mark.asyncio
async def test_teacher_submits_speaking_evaluation(
    client: AsyncClient,
    db_session: AsyncSession,
    test_student: User,
    verified_speaking_teacher: tuple[User, TeacherProfile],
    sample_booking: TeacherBooking,
    student_auth_headers: dict[str, str],
) -> None:
    """Assigned certified teacher submits structured evaluation for speaking session."""
    teacher_user, _ = verified_speaking_teacher
    teacher_token = create_access_token(teacher_user.id, teacher_user.role.value)
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

    # Student creates teacher session
    create_res = await client.post(
        "/api/v1/speaking/sessions",
        json={
            "session_type": "teacher",
            "topic": "TEF Section B — Simulation avec Enseignant",
            "duration_minutes": 25,
            "booking_id": str(sample_booking.id),
        },
        headers=student_auth_headers,
    )
    assert create_res.status_code == 201
    session_id = create_res.json()["id"]

    # Teacher submits evaluation
    eval_payload = {
        "estimated_level": "B2",
        "fluency": 80.0,
        "vocabulary": 82.5,
        "grammar": 75.0,
        "coherence": 85.0,
        "pronunciation": 78.0,
        "overall_score": 80.1,
        "strengths": ["Excellente intonation", "Bonne réactivité aux objections"],
        "weaknesses": ["Accords des participes passés avec avoir"],
        "recommendations": ["Revoir la règle d'accord du COD antéposé"],
        "detailed_feedback": "Très bonne séance, prête pour le niveau B2.",
    }
    submit_res = await client.post(
        f"/api/v1/speaking/sessions/{session_id}/evaluation",
        json=eval_payload,
        headers=teacher_headers,
    )
    assert submit_res.status_code == 201
    eval_data = submit_res.json()
    assert eval_data["evaluator_type"] == "teacher"
    assert eval_data["evaluator_user_id"] == str(teacher_user.id)
    assert eval_data["overall_score"] == 80.1
    assert eval_data["is_official_tef"] is False


@pytest.mark.asyncio
async def test_non_teacher_cannot_submit_teacher_evaluation(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    sample_booking: TeacherBooking,
) -> None:
    """Student cannot submit a teacher evaluation (forbidden)."""
    create_res = await client.post(
        "/api/v1/speaking/sessions",
        json={
            "session_type": "teacher",
            "topic": "Teacher session",
            "booking_id": str(sample_booking.id),
        },
        headers=student_auth_headers,
    )
    session_id = create_res.json()["id"]

    eval_payload = {
        "estimated_level": "C1",
        "fluency": 90.0,
        "vocabulary": 90.0,
        "grammar": 90.0,
        "coherence": 90.0,
        "pronunciation": 90.0,
        "overall_score": 90.0,
    }
    # Student attempts to submit teacher evaluation
    res = await client.post(
        f"/api/v1/speaking/sessions/{session_id}/evaluation",
        json=eval_payload,
        headers=student_auth_headers,
    )
    assert res.status_code == 403


# --- 5. Room Authorization Security Tests ---


@pytest.mark.asyncio
async def test_room_authorization_valid_participant(
    db_session: AsyncSession,
    test_student: User,
) -> None:
    """Valid participant token is successfully authorized for the media room."""
    # Create session via service
    from app.modules.speaking.schemas import SpeakingSessionCreate

    session = await SpeakingService.create_session(
        db_session,
        test_student,
        SpeakingSessionCreate(session_type=SpeakingSessionType.AI),
    )
    token = create_access_token(test_student.id, test_student.role.value)

    authed_session, user, participant = await SpeakingService.authorize_room_connection(
        db=db_session,
        room_id=session.room_id,
        token=token,
    )
    assert authed_session.id == session.id
    assert user.id == test_student.id
    assert participant.user_id == test_student.id


@pytest.mark.asyncio
async def test_room_authorization_invalid_token_fails(
    db_session: AsyncSession,
    test_student: User,
) -> None:
    """Invalid token raises 401 AppException."""
    from app.modules.speaking.schemas import SpeakingSessionCreate

    session = await SpeakingService.create_session(
        db_session,
        test_student,
        SpeakingSessionCreate(session_type=SpeakingSessionType.AI),
    )

    with pytest.raises(AppException) as exc_info:
        await SpeakingService.authorize_room_connection(
            db=db_session,
            room_id=session.room_id,
            token="invalid.token.string",
        )
    assert exc_info.value.code == "INVALID_TOKEN"
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_room_authorization_non_participant_fails(
    db_session: AsyncSession,
    test_student: User,
    test_teacher: User,
) -> None:
    """User not part of the session is rejected with 403 FORBIDDEN."""
    from app.modules.speaking.schemas import SpeakingSessionCreate

    session = await SpeakingService.create_session(
        db_session,
        test_student,
        SpeakingSessionCreate(session_type=SpeakingSessionType.AI),
    )
    # Token for a teacher who is NOT a participant in this AI session
    other_token = create_access_token(test_teacher.id, test_teacher.role.value)

    with pytest.raises(AppException) as exc_info:
        await SpeakingService.authorize_room_connection(
            db=db_session,
            room_id=session.room_id,
            token=other_token,
        )
    assert exc_info.value.code == "FORBIDDEN"
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_room_authorization_closed_session_fails(
    db_session: AsyncSession,
    test_student: User,
) -> None:
    """Completed or cancelled session rejects new room connections."""
    from app.modules.speaking.schemas import SpeakingSessionCreate

    session = await SpeakingService.create_session(
        db_session,
        test_student,
        SpeakingSessionCreate(session_type=SpeakingSessionType.AI),
    )
    await SpeakingService.complete_session(db_session, session.id, test_student)

    token = create_access_token(test_student.id, test_student.role.value)

    with pytest.raises(AppException) as exc_info:
        await SpeakingService.authorize_room_connection(
            db=db_session,
            room_id=session.room_id,
            token=token,
        )
    assert exc_info.value.code == "SESSION_CLOSED"
    assert exc_info.value.status_code == 400


# --- 6. WebRTC Signaling Connection Manager Tests ---


@pytest.mark.asyncio
async def test_signaling_manager_peer_routing_and_broadcast() -> None:
    """Signaling manager routes directed messages to peer and broadcasts to room."""
    manager = SignalingConnectionManager()
    room_id = f"test_room_{uuid.uuid4().hex[:8]}"

    # Mock WebSockets for Alice and Bob
    alice_ws = AsyncMock()
    bob_ws = AsyncMock()

    # 1. Alice connects
    await manager.connect(
        room_id=room_id,
        connection_id="conn_alice",
        websocket=alice_ws,
        user_id="user_alice",
        display_name="Alice",
    )
    alice_ws.accept.assert_awaited_once()

    # 2. Bob connects -> Alice should receive participant_joined event
    await manager.connect(
        room_id=room_id,
        connection_id="conn_bob",
        websocket=bob_ws,
        user_id="user_bob",
        display_name="Bob",
    )
    alice_ws.send_json.assert_awaited_with(
        {
            "action": "participant_joined",
            "connection_id": "conn_bob",
            "user_id": "user_bob",
            "display_name": "Bob",
        }
    )

    # 3. Alice sends SDP offer directly to Bob
    offer_msg = {
        "action": "offer",
        "sender_id": "conn_alice",
        "data": {"sdp": "v=0...mock_sdp"},
    }
    sent = await manager.send_to_peer(
        room_id=room_id,
        target_connection_id="conn_bob",
        message=offer_msg,
    )
    assert sent is True
    bob_ws.send_json.assert_awaited_with(offer_msg)

    # 4. Bob sends ICE candidate directly to Alice
    candidate_msg = {
        "action": "ice_candidate",
        "sender_id": "conn_bob",
        "data": {"candidate": "candidate:1..."},
    }
    sent = await manager.send_to_peer(
        room_id=room_id,
        target_connection_id="conn_alice",
        message=candidate_msg,
    )
    assert sent is True
    alice_ws.send_json.assert_awaited_with(candidate_msg)

    # 5. Room broadcast excluding sender
    broadcast_msg = {"action": "session_timer_tick", "seconds_left": 1200}
    await manager.broadcast(
        room_id=room_id, message=broadcast_msg, exclude_connection_id="conn_alice"
    )
    bob_ws.send_json.assert_awaited_with(broadcast_msg)

    # 6. Bob disconnects -> Alice notified with participant_left
    await manager.disconnect(room_id=room_id, connection_id="conn_bob")
    alice_ws.send_json.assert_awaited_with(
        {
            "action": "participant_left",
            "connection_id": "conn_bob",
            "user_id": "user_bob",
        }
    )
    assert "conn_bob" not in manager.rooms[room_id]
