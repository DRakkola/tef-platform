"""Comprehensive tests for Practice Pool: queue, matching, requests, sessions, safety, and signaling."""

import datetime
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.core.security import create_access_token, hash_password
from app.modules.practice_pool.enums import (
    PracticeRequestStatus,
    PracticeSessionStatus,
    PracticeType,
)
from app.modules.practice_pool.matching import are_students_compatible, is_level_compatible
from app.modules.practice_pool.models import (
    PracticeRequest,
    PracticeSession,
)
from app.modules.practice_pool.presence import (
    InMemoryPracticePresenceManager,
    get_presence_manager,
    set_presence_manager,
)
from app.modules.practice_pool.service import PracticePoolService
from app.modules.users.models import StudentProfile, User, UserRole


@pytest.fixture(autouse=True)
def reset_presence_manager():
    """Ensure clean in-memory presence manager for each test run."""
    manager = InMemoryPracticePresenceManager()
    set_presence_manager(manager)
    yield
    set_presence_manager(InMemoryPracticePresenceManager())


@pytest.fixture
async def student_b(db_session: AsyncSession) -> User:
    """Create a second verified student for peer practice matching."""
    user = User(
        id=uuid.uuid4(),
        email=f"student_b_{uuid.uuid4().hex[:6]}@example.com",
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
        timezone="Europe/Paris",
        native_language="Spanish",
    )
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def student_b_auth_headers(student_b: User) -> dict[str, str]:
    """Provide Bearer auth header for Student B."""
    token = create_access_token(student_b.id, student_b.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def student_c(db_session: AsyncSession) -> User:
    """Create a third student with beginner level for compatibility tests."""
    user = User(
        id=uuid.uuid4(),
        email=f"student_c_{uuid.uuid4().hex[:6]}@example.com",
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
        target_level="A1",
        timezone="America/Montreal",
        native_language="Arabic",
    )
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def student_c_auth_headers(student_c: User) -> dict[str, str]:
    """Provide Bearer auth header for Student C."""
    token = create_access_token(student_c.id, student_c.role.value)
    return {"Authorization": f"Bearer {token}"}


# --- 1. Matching Logic & Compatibility Tests ---


def test_level_compatibility_matrix() -> None:
    """Validate CEFR adjacent step matching logic."""
    assert is_level_compatible("B1", "B1") is True
    assert is_level_compatible("B1", "B2") is True
    assert is_level_compatible("B1", "A2") is True
    assert is_level_compatible("B1", "C1") is False
    assert is_level_compatible("B1", "C2") is False
    assert is_level_compatible("A1", "A2") is True
    assert is_level_compatible("A1", "B1") is False


def test_student_compatibility_rules() -> None:
    """Validate language, practice type, self-matching, and block constraints."""
    u1, u2 = uuid.uuid4(), uuid.uuid4()

    # Self-matching rejected
    assert (
        are_students_compatible(
            u1,
            "fr",
            "B2",
            PracticeType.FREE_CONVERSATION,
            u1,
            "fr",
            "B2",
            PracticeType.FREE_CONVERSATION,
        )
        is False
    )

    # Language mismatch rejected
    assert (
        are_students_compatible(
            u1,
            "fr",
            "B2",
            PracticeType.FREE_CONVERSATION,
            u2,
            "en",
            "B2",
            PracticeType.FREE_CONVERSATION,
        )
        is False
    )

    # Blocked user rejected
    assert (
        are_students_compatible(
            u1,
            "fr",
            "B2",
            PracticeType.FREE_CONVERSATION,
            u2,
            "fr",
            "B2",
            PracticeType.FREE_CONVERSATION,
            blocked_user_ids={u2},
        )
        is False
    )

    # Compatible pair with GENERAL_PRACTICE wildcard
    assert (
        are_students_compatible(
            u1,
            "fr",
            "B1",
            PracticeType.TEF_SECTION_A,
            u2,
            "fr",
            "B2",
            PracticeType.GENERAL_PRACTICE,
        )
        is True
    )


# --- 2. Queue Lifecycle & Candidate Discovery Tests ---


@pytest.mark.asyncio
async def test_join_and_leave_practice_queue(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
) -> None:
    """Student joins queue, receives anonymous alias, and leaves cleanly."""
    join_payload = {
        "language": "fr",
        "level": "B2",
        "practice_type": "free_conversation",
    }
    res = await client.post(
        "/api/v1/practice/queue/join",
        json=join_payload,
        headers=student_auth_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["in_queue"] is True
    assert data["status"] == "waiting"
    assert data["language"] == "fr"
    assert data["level"] == "B2"
    assert data["anonymous_alias"] is not None
    # Verify anonymity: alias does NOT leak real name or email
    assert test_student.email not in data["anonymous_alias"]

    # Check status endpoint
    status_res = await client.get("/api/v1/practice/queue/status", headers=student_auth_headers)
    assert status_res.status_code == 200
    assert status_res.json()["in_queue"] is True

    # Leave queue
    leave_res = await client.post("/api/v1/practice/queue/leave", headers=student_auth_headers)
    assert leave_res.status_code == 200

    # Verify status is now out of queue
    status_after = await client.get("/api/v1/practice/queue/status", headers=student_auth_headers)
    assert status_after.status_code == 200
    assert status_after.json()["in_queue"] is False


@pytest.mark.asyncio
async def test_queue_candidate_discovery_and_level_filtering(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    student_b_auth_headers: dict[str, str],
    student_c_auth_headers: dict[str, str],
) -> None:
    """Compatible candidates appear in candidate search; incompatible levels do not."""
    # 1. Student A (B2) joins
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2", "practice_type": "free_conversation"},
        headers=student_auth_headers,
    )

    # 2. Student C (A1 - incompatible with B2) joins
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "A1", "practice_type": "free_conversation"},
        headers=student_c_auth_headers,
    )

    # 3. Student B (B1 - compatible with B2) joins
    res_b = await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B1", "practice_type": "free_conversation"},
        headers=student_b_auth_headers,
    )
    assert res_b.status_code == 201
    candidates_b = res_b.json()["candidates"]

    # Student B should see Student A (B2), but NOT Student C (A1)
    assert len(candidates_b) == 1
    assert candidates_b[0]["level"] == "B2"


# --- 3. Practice Request Workflow Tests ---


@pytest.mark.asyncio
async def test_practice_request_accept_creates_authoritative_session(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    student_b_auth_headers: dict[str, str],
) -> None:
    """Student A requests candidate Student B, Student B accepts, creating session."""
    # 1. Student A and B join queue
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_auth_headers,
    )
    join_b = await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_b_auth_headers,
    )
    cand_b_queue_id = join_b.json()["queue_id"]

    # 2. Student A sends request to Student B
    req_res = await client.post(
        "/api/v1/practice/requests",
        json={"candidate_queue_id": cand_b_queue_id},
        headers=student_auth_headers,
    )
    assert req_res.status_code == 201
    request_id = req_res.json()["id"]
    assert req_res.json()["status"] == "pending"

    # 3. Student B checks incoming requests
    incoming_res = await client.get(
        "/api/v1/practice/requests/incoming",
        headers=student_b_auth_headers,
    )
    assert incoming_res.status_code == 200
    inc_items = incoming_res.json()
    assert len(inc_items) == 1
    assert inc_items[0]["id"] == request_id

    # 4. Student B accepts request
    accept_res = await client.post(
        f"/api/v1/practice/requests/{request_id}/accept",
        headers=student_b_auth_headers,
    )
    assert accept_res.status_code == 200
    session_data = accept_res.json()
    assert session_data["status"] == "active"
    assert session_data["duration_minutes"] == 25
    assert session_data["audio_only"] is True
    assert session_data["room_id"].startswith("practice_room_")
    assert session_data["my_alias"] is not None
    assert session_data["peer_alias"] is not None

    # Both students should now be out of the waiting queue
    status_a = await client.get("/api/v1/practice/queue/status", headers=student_auth_headers)
    status_b = await client.get("/api/v1/practice/queue/status", headers=student_b_auth_headers)
    assert status_a.json()["in_queue"] is False
    assert status_b.json()["in_queue"] is False


@pytest.mark.asyncio
async def test_practice_request_reject(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    student_b_auth_headers: dict[str, str],
) -> None:
    """Student B rejects Student A's invitation."""
    join_b = await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_b_auth_headers,
    )
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_auth_headers,
    )

    req_res = await client.post(
        "/api/v1/practice/requests",
        json={"candidate_queue_id": join_b.json()["queue_id"]},
        headers=student_auth_headers,
    )
    request_id = req_res.json()["id"]

    reject_res = await client.post(
        f"/api/v1/practice/requests/{request_id}/reject",
        headers=student_b_auth_headers,
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["message"] == "Practice request rejected"


@pytest.mark.asyncio
async def test_practice_request_cancel(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    student_b_auth_headers: dict[str, str],
) -> None:
    """Student A cancels their sent invitation."""
    join_b = await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_b_auth_headers,
    )
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_auth_headers,
    )

    req_res = await client.post(
        "/api/v1/practice/requests",
        json={"candidate_queue_id": join_b.json()["queue_id"]},
        headers=student_auth_headers,
    )
    request_id = req_res.json()["id"]

    cancel_res = await client.post(
        f"/api/v1/practice/requests/{request_id}/cancel",
        headers=student_auth_headers,
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["message"] == "Practice request cancelled"


@pytest.mark.asyncio
async def test_practice_request_expired_timeout(
    db_session: AsyncSession,
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    student_b_auth_headers: dict[str, str],
) -> None:
    """Accepting a timed-out request fails with 400."""
    join_b = await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_b_auth_headers,
    )
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_auth_headers,
    )

    req_res = await client.post(
        "/api/v1/practice/requests",
        json={"candidate_queue_id": join_b.json()["queue_id"]},
        headers=student_auth_headers,
    )
    request_id = uuid.UUID(req_res.json()["id"])

    # Simulate expiration in DB
    req = await db_session.get(PracticeRequest, request_id)
    assert req is not None
    req.expires_at = datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=10)
    await db_session.commit()

    accept_res = await client.post(
        f"/api/v1/practice/requests/{request_id}/accept",
        headers=student_b_auth_headers,
    )
    assert accept_res.status_code == 400
    assert accept_res.json()["error"]["code"] == "REQUEST_EXPIRED"


# --- 4. Concurrency & Single Active Session Enforcement Tests ---


@pytest.mark.asyncio
async def test_single_active_session_enforcement(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    student_b_auth_headers: dict[str, str],
) -> None:
    """Student in active session cannot join queue or start another session."""
    # Match student A and B into an active session
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_auth_headers,
    )
    join_b = await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_b_auth_headers,
    )
    req_res = await client.post(
        "/api/v1/practice/requests",
        json={"candidate_queue_id": join_b.json()["queue_id"]},
        headers=student_auth_headers,
    )
    await client.post(
        f"/api/v1/practice/requests/{req_res.json()['id']}/accept",
        headers=student_b_auth_headers,
    )

    # Student A attempts to join queue while session is active -> 409
    rejoin_res = await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_auth_headers,
    )
    assert rejoin_res.status_code == 409
    assert rejoin_res.json()["error"]["code"] == "USER_ALREADY_IN_ACTIVE_SESSION"


@pytest.mark.asyncio
async def test_concurrent_match_lock_prevents_race_condition(
    db_session: AsyncSession,
    test_student: User,
    student_b: User,
) -> None:
    """Simulating match lock contention rejects competing request with 409."""
    presence = get_presence_manager()

    # Pre-acquire lock for this student pair
    locked = await presence.acquire_match_lock(test_student.id, student_b.id)
    assert locked is True

    # Attempting to accept a request with lock held raises 409
    now = datetime.datetime.now(datetime.UTC)
    req = PracticeRequest(
        id=uuid.uuid4(),
        sender_id=test_student.id,
        receiver_id=student_b.id,
        sender_alias="Sender #1",
        receiver_alias="Receiver #2",
        status=PracticeRequestStatus.PENDING,
        expires_at=now + datetime.timedelta(seconds=60),
    )
    db_session.add(req)
    await db_session.commit()

    with pytest.raises(AppException) as exc_info:
        await PracticePoolService.accept_request(db_session, student_b, req.id)
    assert exc_info.value.code == "CONCURRENT_MATCH_IN_PROGRESS"
    assert exc_info.value.status_code == 409


# --- 5. Session Details, Timer, Leave & Expiry Tests ---


@pytest.mark.asyncio
async def test_practice_session_details_and_ice_servers(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    student_b_auth_headers: dict[str, str],
) -> None:
    """Session details contain STUN ice servers, remaining seconds, and privacy alias."""
    join_b = await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_b_auth_headers,
    )
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_auth_headers,
    )
    req = await client.post(
        "/api/v1/practice/requests",
        json={"candidate_queue_id": join_b.json()["queue_id"]},
        headers=student_auth_headers,
    )
    session_res = await client.post(
        f"/api/v1/practice/requests/{req.json()['id']}/accept",
        headers=student_b_auth_headers,
    )
    session_id = session_res.json()["id"]

    res = await client.get(f"/api/v1/practice/sessions/{session_id}", headers=student_auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["audio_only"] is True
    assert len(data["ice_servers"]) > 0
    assert 1400 <= data["remaining_seconds"] <= 1500  # 25 minutes = 1500s


@pytest.mark.asyncio
async def test_leave_practice_session(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    student_b_auth_headers: dict[str, str],
) -> None:
    """Participant leaves session, transitioning status to COMPLETED."""
    join_b = await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_b_auth_headers,
    )
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_auth_headers,
    )
    req = await client.post(
        "/api/v1/practice/requests",
        json={"candidate_queue_id": join_b.json()["queue_id"]},
        headers=student_auth_headers,
    )
    session_res = await client.post(
        f"/api/v1/practice/requests/{req.json()['id']}/accept",
        headers=student_b_auth_headers,
    )
    session_id = session_res.json()["id"]

    leave_res = await client.post(
        f"/api/v1/practice/sessions/{session_id}/leave",
        headers=student_auth_headers,
    )
    assert leave_res.status_code == 200
    assert leave_res.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_server_enforces_practice_session_expiration(
    db_session: AsyncSession,
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    student_b_auth_headers: dict[str, str],
) -> None:
    """Expired practice session automatically transitions to EXPIRED."""
    join_b = await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_b_auth_headers,
    )
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_auth_headers,
    )
    req = await client.post(
        "/api/v1/practice/requests",
        json={"candidate_queue_id": join_b.json()["queue_id"]},
        headers=student_auth_headers,
    )
    session_res = await client.post(
        f"/api/v1/practice/requests/{req.json()['id']}/accept",
        headers=student_b_auth_headers,
    )
    session_id = uuid.UUID(session_res.json()["id"])

    # Simulate past expires_at
    session = await db_session.get(PracticeSession, session_id)
    assert session is not None
    session.expires_at = datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=5)
    await db_session.commit()

    get_res = await client.get(
        f"/api/v1/practice/sessions/{session_id}",
        headers=student_auth_headers,
    )
    assert get_res.status_code == 200
    assert get_res.json()["status"] == "expired"


# --- 6. Safety: Report & Block Tests ---


@pytest.mark.asyncio
async def test_report_and_block_peer(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    student_b_auth_headers: dict[str, str],
) -> None:
    """Student files an anonymous safety report and blocks the peer."""
    join_b = await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_b_auth_headers,
    )
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2"},
        headers=student_auth_headers,
    )
    req = await client.post(
        "/api/v1/practice/requests",
        json={"candidate_queue_id": join_b.json()["queue_id"]},
        headers=student_auth_headers,
    )
    session_res = await client.post(
        f"/api/v1/practice/requests/{req.json()['id']}/accept",
        headers=student_b_auth_headers,
    )
    session_id = session_res.json()["id"]

    # 1. Report peer
    report_res = await client.post(
        f"/api/v1/practice/sessions/{session_id}/report",
        json={
            "reason": "inappropriate_behavior",
            "details": "Peer made inappropriate remarks.",
        },
        headers=student_auth_headers,
    )
    assert report_res.status_code == 201
    assert report_res.json()["reason"] == "inappropriate_behavior"

    # 2. Block peer
    block_res = await client.post(
        f"/api/v1/practice/sessions/{session_id}/block-peer",
        json={"reason": "Inappropriate remarks"},
        headers=student_auth_headers,
    )
    assert block_res.status_code == 201
    blocked_user_id = block_res.json()["blocked_user_id"]

    # 3. List blocks
    blocks_list = await client.get("/api/v1/practice/blocks", headers=student_auth_headers)
    assert blocks_list.status_code == 200
    assert any(b["blocked_user_id"] == blocked_user_id for b in blocks_list.json())

    # 4. Unblock peer
    unblock_res = await client.delete(
        f"/api/v1/practice/blocks/{blocked_user_id}",
        headers=student_auth_headers,
    )
    assert unblock_res.status_code == 200


# --- 7. Audio-Only WebRTC Signaling & Room Authorization Tests ---


@pytest.mark.asyncio
async def test_practice_room_authorization_valid_participant(
    db_session: AsyncSession,
    test_student: User,
    student_b: User,
) -> None:
    """Participant token successfully authorizes for practice room."""
    # Create practice session directly
    now = datetime.datetime.now(datetime.UTC)
    room_id = f"practice_room_{uuid.uuid4().hex[:12]}"
    session = PracticeSession(
        id=uuid.uuid4(),
        match_id=uuid.uuid4(),
        room_id=room_id,
        student_a_id=test_student.id,
        student_b_id=student_b.id,
        student_a_alias="Voyageur #101",
        student_b_alias="Observateur #202",
        status=PracticeSessionStatus.ACTIVE,
        starts_at=now,
        expires_at=now + datetime.timedelta(minutes=15),
        audio_only=True,
    )
    db_session.add(session)
    await db_session.commit()

    token = create_access_token(test_student.id, test_student.role.value)
    authed_session, user, alias = await PracticePoolService.authorize_room_connection(
        db=db_session,
        room_id=room_id,
        token=token,
    )
    assert authed_session.id == session.id
    assert user.id == test_student.id
    assert alias == "Voyageur #101"


@pytest.mark.asyncio
async def test_practice_room_authorization_unauthorized_fails(
    db_session: AsyncSession,
    test_student: User,
    student_b: User,
    student_c: User,
) -> None:
    """User not part of the practice session is rejected with 403."""
    now = datetime.datetime.now(datetime.UTC)
    room_id = f"practice_room_{uuid.uuid4().hex[:12]}"
    session = PracticeSession(
        id=uuid.uuid4(),
        match_id=uuid.uuid4(),
        room_id=room_id,
        student_a_id=test_student.id,
        student_b_id=student_b.id,
        student_a_alias="Voyageur #101",
        student_b_alias="Observateur #202",
        status=PracticeSessionStatus.ACTIVE,
        starts_at=now,
        expires_at=now + datetime.timedelta(minutes=15),
        audio_only=True,
    )
    db_session.add(session)
    await db_session.commit()

    # Token for student_c who is not a participant
    token_c = create_access_token(student_c.id, student_c.role.value)
    with pytest.raises(AppException) as exc_info:
        await PracticePoolService.authorize_room_connection(
            db=db_session,
            room_id=room_id,
            token=token_c,
        )
    assert exc_info.value.code == "FORBIDDEN"
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_list_practice_topics(client: AsyncClient, db_session: AsyncSession) -> None:
    """Can list seeded practice topics with level filter."""
    from app.modules.practice_pool.models import PracticeTopic

    topic = PracticeTopic(
        id=uuid.uuid4(),
        title="Voyage en train",
        description="Acheter un billet à la gare",
        level="B1",
        category="Transport",
        prompts=["Bonjour, un billet pour Lyon svp"],
        is_active=True,
    )
    db_session.add(topic)
    await db_session.commit()

    res = await client.get("/api/v1/practice/topics?level=B1")
    assert res.status_code == 200
    topics = res.json()
    assert len(topics) >= 1
    assert any(t["title"] == "Voyage en train" for t in topics)


@pytest.mark.asyncio
async def test_practice_queue_heartbeat(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
) -> None:
    """Queue heartbeat returns renewal confirmation."""
    # First join queue
    join_res = await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2", "practice_type": "free_conversation"},
        headers=student_auth_headers,
    )
    assert join_res.status_code == 201

    hb_res = await client.post(
        "/api/v1/practice/queue/heartbeat",
        headers=student_auth_headers,
    )
    assert hb_res.status_code == 200
    hb_data = hb_res.json()
    assert hb_data["in_queue"] is True
    assert hb_data["status"] == "waiting"
    assert hb_data["ttl_seconds"] == 60


@pytest.mark.asyncio
async def test_list_practice_candidates_endpoint(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    student_b_auth_headers: dict[str, str],
) -> None:
    """GET /candidates endpoint returns compatible peers in queue."""
    # Student B joins queue
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2", "practice_type": "free_conversation"},
        headers=student_b_auth_headers,
    )
    # Student A joins queue
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2", "practice_type": "free_conversation"},
        headers=student_auth_headers,
    )

    cand_res = await client.get("/api/v1/practice/candidates", headers=student_auth_headers)
    assert cand_res.status_code == 200
    candidates = cand_res.json()
    assert len(candidates) == 1
    assert candidates[0]["level"] == "B2"


@pytest.mark.asyncio
async def test_list_all_practice_requests(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    student_b_auth_headers: dict[str, str],
) -> None:
    """GET /requests returns both incoming and outgoing pending requests."""
    # Both join queue
    b_join = await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2", "practice_type": "free_conversation"},
        headers=student_b_auth_headers,
    )
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2", "practice_type": "free_conversation"},
        headers=student_auth_headers,
    )
    # Student A sends request to B
    req = await client.post(
        "/api/v1/practice/requests",
        json={"candidate_queue_id": b_join.json()["queue_id"]},
        headers=student_auth_headers,
    )
    assert req.status_code == 201

    # Student A lists requests (outgoing)
    a_reqs = await client.get("/api/v1/practice/requests", headers=student_auth_headers)
    assert a_reqs.status_code == 200
    assert len(a_reqs.json()) == 1
    assert a_reqs.json()[0]["is_incoming"] is False

    # Student B lists requests (incoming)
    b_reqs = await client.get("/api/v1/practice/requests", headers=student_b_auth_headers)
    assert b_reqs.status_code == 200
    assert len(b_reqs.json()) == 1
    assert b_reqs.json()[0]["is_incoming"] is True


@pytest.mark.asyncio
async def test_end_practice_session_alias(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    student_b_auth_headers: dict[str, str],
) -> None:
    """POST /sessions/{id}/end concludes session identically to leave."""
    b_join = await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2", "practice_type": "free_conversation"},
        headers=student_b_auth_headers,
    )
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2", "practice_type": "free_conversation"},
        headers=student_auth_headers,
    )
    req = await client.post(
        "/api/v1/practice/requests",
        json={"candidate_queue_id": b_join.json()["queue_id"]},
        headers=student_auth_headers,
    )
    session_res = await client.post(
        f"/api/v1/practice/requests/{req.json()['id']}/accept",
        headers=student_b_auth_headers,
    )
    session_id = session_res.json()["id"]

    end_res = await client.post(
        f"/api/v1/practice/sessions/{session_id}/end",
        headers=student_auth_headers,
    )
    assert end_res.status_code == 200
    assert end_res.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_direct_report_and_block(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    student_b_auth_headers: dict[str, str],
    student_b: User,
) -> None:
    """Direct POST /reports and POST /blocks endpoints succeed."""
    b_join = await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2", "practice_type": "free_conversation"},
        headers=student_b_auth_headers,
    )
    await client.post(
        "/api/v1/practice/queue/join",
        json={"language": "fr", "level": "B2", "practice_type": "free_conversation"},
        headers=student_auth_headers,
    )
    req = await client.post(
        "/api/v1/practice/requests",
        json={"candidate_queue_id": b_join.json()["queue_id"]},
        headers=student_auth_headers,
    )
    session_res = await client.post(
        f"/api/v1/practice/requests/{req.json()['id']}/accept",
        headers=student_b_auth_headers,
    )
    session_id = session_res.json()["id"]

    # Direct report
    report_res = await client.post(
        "/api/v1/practice/reports",
        json={"session_id": session_id, "reason": "inappropriate_behavior", "details": "Peer was rude"},
        headers=student_auth_headers,
    )
    assert report_res.status_code == 201
    assert report_res.json()["status"] == "open"

    # Direct block
    block_res = await client.post(
        "/api/v1/practice/blocks",
        json={"blocked_user_id": str(student_b.id), "reason": "Do not match"},
        headers=student_auth_headers,
    )
    assert block_res.status_code == 201
    assert block_res.json()["blocked_user_id"] == str(student_b.id)


@pytest.mark.asyncio
async def test_celery_cleanup_tasks_execution(db_session: AsyncSession) -> None:
    """Practice Pool cleanup logic executes successfully and tasks are registered."""
    from app.core.celery_app import celery_app
    from app.workers.tasks import (
        cleanup_abandoned_practice_sessions_core,
        cleanup_expired_practice_requests_core,
        cleanup_expired_practice_sessions_core,
        cleanup_stale_practice_queue_core,
    )

    c1 = await cleanup_expired_practice_requests_core(db_session)
    assert isinstance(c1, int)

    c2 = await cleanup_stale_practice_queue_core(db_session)
    assert isinstance(c2, int)

    c3 = await cleanup_expired_practice_sessions_core(db_session)
    assert isinstance(c3, int)

    c4 = await cleanup_abandoned_practice_sessions_core(db_session)
    assert isinstance(c4, int)

    # Verify task registration in Celery app
    registered_tasks = celery_app.tasks.keys()
    assert "tasks.cleanup_expired_practice_requests" in registered_tasks
    assert "tasks.cleanup_stale_practice_queue" in registered_tasks
    assert "tasks.cleanup_expired_practice_sessions" in registered_tasks
    assert "tasks.cleanup_abandoned_practice_sessions" in registered_tasks



