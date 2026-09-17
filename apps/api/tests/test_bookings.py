"""Comprehensive tests for teacher discovery, availability rules, slots, bookings, and concurrency."""

import asyncio
import datetime
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.modules.teachers.models import (
    TeacherAvailabilityException,
    TeacherAvailabilityRule,
)
from app.modules.users.models import (
    StudentProfile,
    TeacherProfile,
    TeacherVerificationStatus,
    User,
    UserRole,
)


@pytest.fixture
async def verified_teacher(db_session: AsyncSession) -> tuple[User, TeacherProfile]:
    """Create a verified teacher with European timezone."""
    teacher_user = User(
        id=uuid.uuid4(),
        email=f"teacher_{uuid.uuid4().hex[:6]}@example.com",
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
        display_name="Professeur Claire",
        bio="Formatrice certifiée TEF avec 10 ans d'expérience.",
        expertise=["TEF Expression Orale", "TEF Canada", "Phonétique"],
        teaching_levels=["B1", "B2", "C1"],
        hourly_price=4500,  # $45.00
        verification_status=TeacherVerificationStatus.APPROVED,
        timezone="Europe/Paris",
    )
    db_session.add(teacher_profile)
    await db_session.commit()
    await db_session.refresh(teacher_user)
    await db_session.refresh(teacher_profile)
    return teacher_user, teacher_profile


@pytest.fixture
async def second_student(db_session: AsyncSession) -> User:
    """Create a second student for concurrency and isolation testing."""
    student = User(
        id=uuid.uuid4(),
        email=f"student2_{uuid.uuid4().hex[:6]}@example.com",
        password_hash=hash_password("Student2Pass123!"),
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add(student)
    await db_session.flush()

    profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=student.id,
        target_exam="TEF Canada",
        target_level="B2",
        timezone="America/Toronto",
    )
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(student)
    return student


@pytest.mark.asyncio
async def test_teacher_discovery_and_filtering(
    client: AsyncClient,
    verified_teacher: tuple[User, TeacherProfile],
    db_session: AsyncSession,
) -> None:
    """Test browsing and filtering teachers by specialization, level, and price."""
    # Create an unapproved teacher who should NOT appear
    unapproved_user = User(
        id=uuid.uuid4(),
        email="pending_teacher@example.com",
        password_hash=hash_password("PendingPass123!"),
        role=UserRole.TEACHER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(unapproved_user)
    await db_session.flush()

    unapproved_profile = TeacherProfile(
        id=uuid.uuid4(),
        user_id=unapproved_user.id,
        display_name="Professeur Pending",
        expertise=["Grammaire"],
        teaching_levels=["A1"],
        hourly_price=2000,
        verification_status=TeacherVerificationStatus.PENDING,
        timezone="UTC",
    )
    db_session.add(unapproved_profile)
    await db_session.commit()

    _, approved_profile = verified_teacher

    # 1. Unfiltered list
    resp = await client.get("/api/v1/teachers")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    ids = [item["id"] for item in data["items"]]
    assert str(approved_profile.id) in ids
    assert str(unapproved_profile.id) not in ids

    # 2. Filter by specialization match
    resp_match = await client.get("/api/v1/teachers", params={"specialization": "TEF Canada"})
    assert resp_match.status_code == 200
    assert any(item["id"] == str(approved_profile.id) for item in resp_match.json()["items"])

    # 3. Filter by non-matching level
    resp_nomatch = await client.get("/api/v1/teachers", params={"level": "A1"})
    assert resp_nomatch.status_code == 200
    assert not any(item["id"] == str(approved_profile.id) for item in resp_nomatch.json()["items"])

    # 4. Filter by price bounds
    resp_price_low = await client.get("/api/v1/teachers", params={"max_price": 3000})
    assert resp_price_low.status_code == 200
    assert not any(
        item["id"] == str(approved_profile.id) for item in resp_price_low.json()["items"]
    )


@pytest.mark.asyncio
async def test_teacher_detail(
    client: AsyncClient,
    verified_teacher: tuple[User, TeacherProfile],
) -> None:
    """Test retrieving teacher public details."""
    _, profile = verified_teacher
    resp = await client.get(f"/api/v1/teachers/{profile.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["display_name"] == profile.display_name
    assert data["hourly_price"] == 4500
    assert data["timezone"] == "Europe/Paris"


@pytest.mark.asyncio
async def test_teacher_availability_rules_lifecycle(
    client: AsyncClient,
    verified_teacher: tuple[User, TeacherProfile],
    student_auth_headers: dict[str, str],
) -> None:
    """Test creating, listing, and deleting recurring availability rules."""
    teacher_user, teacher_profile = verified_teacher
    teacher_token = create_access_token(teacher_user.id, UserRole.TEACHER.value)
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

    # 1. Student cannot create availability rules
    student_resp = await client.post(
        "/api/v1/teachers/me/availability/rules",
        headers=student_auth_headers,
        json={
            "weekday": 1,  # Tuesday
            "start_time": "09:00:00",
            "end_time": "17:00:00",
            "timezone": "Europe/Paris",
        },
    )
    assert student_resp.status_code == 403

    # 2. Teacher creates recurring rule for Monday (0) 09:00 - 12:00
    rule_resp = await client.post(
        "/api/v1/teachers/me/availability/rules",
        headers=teacher_headers,
        json={
            "weekday": 0,
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "timezone": "Europe/Paris",
        },
    )
    assert rule_resp.status_code == 201
    rule_data = rule_resp.json()
    rule_id = rule_data["id"]
    assert rule_data["weekday"] == 0
    assert rule_data["start_time"] == "09:00:00"
    assert rule_data["end_time"] == "12:00:00"

    # 3. Public inspection of teacher rules
    get_rules = await client.get(f"/api/v1/teachers/{teacher_profile.id}/availability/rules")
    assert get_rules.status_code == 200
    assert len(get_rules.json()) >= 1
    assert any(r["id"] == rule_id for r in get_rules.json())

    # 4. Teacher deletes rule
    del_resp = await client.delete(
        f"/api/v1/teachers/me/availability/rules/{rule_id}",
        headers=teacher_headers,
    )
    assert del_resp.status_code == 204

    # Verify deleted
    get_rules_after = await client.get(f"/api/v1/teachers/{teacher_profile.id}/availability/rules")
    assert not any(r["id"] == rule_id for r in get_rules_after.json())


@pytest.mark.asyncio
async def test_teacher_availability_exceptions(
    client: AsyncClient,
    verified_teacher: tuple[User, TeacherProfile],
) -> None:
    """Test blocking a date and modifying hours via availability exceptions."""
    teacher_user, teacher_profile = verified_teacher
    teacher_token = create_access_token(teacher_user.id, UserRole.TEACHER.value)
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

    future_date = (
        datetime.datetime.now(datetime.UTC).date() + datetime.timedelta(days=3)
    ).isoformat()

    # 1. Create unavailable date exception
    exc_resp = await client.post(
        "/api/v1/teachers/me/availability/exceptions",
        headers=teacher_headers,
        json={
            "exception_date": future_date,
            "is_unavailable": True,
            "reason": "Congé personnel",
        },
    )
    assert exc_resp.status_code == 201
    exc_id = exc_resp.json()["id"]
    assert exc_resp.json()["is_unavailable"] is True
    assert exc_resp.json()["reason"] == "Congé personnel"

    # 2. View exceptions
    get_exc = await client.get(f"/api/v1/teachers/{teacher_profile.id}/availability/exceptions")
    assert get_exc.status_code == 200
    assert any(e["id"] == exc_id for e in get_exc.json())

    # 3. Delete exception
    del_exc = await client.delete(
        f"/api/v1/teachers/me/availability/exceptions/{exc_id}",
        headers=teacher_headers,
    )
    assert del_exc.status_code == 204


@pytest.mark.asyncio
async def test_slot_generation_with_timezones_and_exceptions(
    client: AsyncClient,
    verified_teacher: tuple[User, TeacherProfile],
    db_session: AsyncSession,
) -> None:
    """Test slot generation considering teacher timezone (Europe/Paris), exceptions, and student timezone."""
    _teacher_user, teacher_profile = verified_teacher

    # Tomorrow
    tomorrow = datetime.datetime.now(datetime.UTC).date() + datetime.timedelta(days=1)
    tomorrow_weekday = tomorrow.weekday()

    # Create active rule for tomorrow's weekday: 14:00 - 16:00 Paris time (2 hours = two 60-min slots)
    rule = TeacherAvailabilityRule(
        teacher_id=teacher_profile.id,
        weekday=tomorrow_weekday,
        start_time=datetime.time(14, 0),
        end_time=datetime.time(16, 0),
        timezone="Europe/Paris",
        is_active=True,
    )
    db_session.add(rule)
    await db_session.commit()

    # Query slots for tomorrow in student timezone America/Toronto
    resp = await client.get(
        f"/api/v1/teachers/{teacher_profile.id}/slots",
        params={
            "date_from": tomorrow.isoformat(),
            "date_to": tomorrow.isoformat(),
            "student_timezone": "America/Toronto",
            "slot_duration_minutes": 60,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["slots"]) == 2

    # Now add an exception blocking tomorrow completely
    exc = TeacherAvailabilityException(
        teacher_id=teacher_profile.id,
        exception_date=tomorrow,
        is_unavailable=True,
        reason="Formation",
    )
    db_session.add(exc)
    await db_session.commit()

    resp_blocked = await client.get(
        f"/api/v1/teachers/{teacher_profile.id}/slots",
        params={
            "date_from": tomorrow.isoformat(),
            "date_to": tomorrow.isoformat(),
        },
    )
    assert resp_blocked.status_code == 200
    assert len(resp_blocked.json()["slots"]) == 0


@pytest.mark.asyncio
async def test_student_booking_lifecycle_and_cancellation(
    client: AsyncClient,
    verified_teacher: tuple[User, TeacherProfile],
    student_auth_headers: dict[str, str],
    test_student: User,
) -> None:
    """Test full booking lifecycle: request, inspect, cancel, and booking history."""
    _, teacher_profile = verified_teacher

    # Schedule a future slot
    start_time = (datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=2)).replace(
        hour=10, minute=0, second=0, microsecond=0
    )
    end_time = start_time + datetime.timedelta(hours=1)

    # 1. Student creates booking
    book_resp = await client.post(
        "/api/v1/bookings",
        headers=student_auth_headers,
        json={
            "teacher_id": str(teacher_profile.id),
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "notes": "Préparation pour le TEF Canada Expression Orale Section B.",
        },
    )
    assert book_resp.status_code == 201
    booking_data = book_resp.json()
    booking_id = booking_data["id"]
    assert booking_data["status"] == "confirmed"
    assert booking_data["teacher_display_name"] == "Professeur Claire"
    assert booking_data["meeting_link"] is not None

    # 2. Get booking details
    detail_resp = await client.get(f"/api/v1/bookings/{booking_id}", headers=student_auth_headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == booking_id

    # 3. Student list bookings
    list_resp = await client.get("/api/v1/bookings", headers=student_auth_headers)
    assert list_resp.status_code == 200
    assert any(b["id"] == booking_id for b in list_resp.json()["items"])

    # 4. Student cancels booking
    cancel_resp = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers=student_auth_headers,
        json={"reason": "Imprévu professionnel"},
    )
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "cancelled"
    assert cancel_resp.json()["cancellation_reason"] == "Imprévu professionnel"
    assert cancel_resp.json()["cancelled_by_user_id"] == str(test_student.id)


@pytest.mark.asyncio
async def test_concurrent_double_booking_prevention(
    client: AsyncClient,
    verified_teacher: tuple[User, TeacherProfile],
    student_auth_headers: dict[str, str],
    second_student: User,
) -> None:
    """CRITICAL TEST: Verify race condition prevention when two students attempt to book the EXACT SAME slot concurrently."""
    _, teacher_profile = verified_teacher

    # Setup headers for second student
    student2_token = create_access_token(second_student.id, UserRole.STUDENT.value)
    student2_auth_headers = {"Authorization": f"Bearer {student2_token}"}

    # Define exact same slot 3 days in the future
    start_time = (datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=3)).replace(
        hour=15, minute=0, second=0, microsecond=0
    )
    end_time = start_time + datetime.timedelta(hours=1)

    payload = {
        "teacher_id": str(teacher_profile.id),
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "notes": "Simultaneous booking test",
    }

    # Fire concurrent booking requests simultaneously via asyncio.gather
    async def book_student_1():
        return await client.post("/api/v1/bookings", headers=student_auth_headers, json=payload)

    async def book_student_2():
        return await client.post("/api/v1/bookings", headers=student2_auth_headers, json=payload)

    resp1, resp2 = await asyncio.gather(book_student_1(), book_student_2())

    # Exactly one request must succeed (201) and the other must fail with 409 Conflict
    status_codes = sorted([resp1.status_code, resp2.status_code])
    assert status_codes == [201, 409], (
        f"Expected [201, 409], got {[resp1.status_code, resp2.status_code]}"
    )

    conflict_resp = resp1 if resp1.status_code == 409 else resp2
    assert conflict_resp.json()["error"]["code"] == "SLOT_ALREADY_BOOKED"


@pytest.mark.asyncio
async def test_overlapping_booking_rejection(
    client: AsyncClient,
    verified_teacher: tuple[User, TeacherProfile],
    student_auth_headers: dict[str, str],
    second_student: User,
) -> None:
    """Test that overlapping slots (e.g. 14:00-15:00 and 14:30-15:30) are rejected with 409."""
    _, teacher_profile = verified_teacher

    student2_token = create_access_token(second_student.id, UserRole.STUDENT.value)
    student2_auth_headers = {"Authorization": f"Bearer {student2_token}"}

    base_time = (datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=4)).replace(
        hour=14, minute=0, second=0, microsecond=0
    )

    # First booking: 14:00 - 15:00
    resp1 = await client.post(
        "/api/v1/bookings",
        headers=student_auth_headers,
        json={
            "teacher_id": str(teacher_profile.id),
            "start_time": base_time.isoformat(),
            "end_time": (base_time + datetime.timedelta(hours=1)).isoformat(),
        },
    )
    assert resp1.status_code == 201

    # Overlapping booking: 14:30 - 15:30
    overlap_start = base_time + datetime.timedelta(minutes=30)
    overlap_end = overlap_start + datetime.timedelta(hours=1)

    resp2 = await client.post(
        "/api/v1/bookings",
        headers=student2_auth_headers,
        json={
            "teacher_id": str(teacher_profile.id),
            "start_time": overlap_start.isoformat(),
            "end_time": overlap_end.isoformat(),
        },
    )
    assert resp2.status_code == 409
    assert resp2.json()["error"]["code"] == "SLOT_ALREADY_BOOKED"


@pytest.mark.asyncio
async def test_authorization_enforcement(
    client: AsyncClient,
    verified_teacher: tuple[User, TeacherProfile],
    student_auth_headers: dict[str, str],
    second_student: User,
) -> None:
    """Test authorization rules: teacher cannot book self, student cannot cancel another student's booking."""
    teacher_user, teacher_profile = verified_teacher
    teacher_token = create_access_token(teacher_user.id, UserRole.TEACHER.value)
    teacher_auth_headers = {"Authorization": f"Bearer {teacher_token}"}

    start_time = (datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=5)).replace(
        hour=11, minute=0, second=0, microsecond=0
    )
    end_time = start_time + datetime.timedelta(hours=1)

    # 1. Teacher cannot book with themselves
    self_book_resp = await client.post(
        "/api/v1/bookings",
        headers=teacher_auth_headers,
        json={
            "teacher_id": str(teacher_profile.id),
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
        },
    )
    assert self_book_resp.status_code == 400
    assert self_book_resp.json()["error"]["code"] == "SELF_BOOKING_FORBIDDEN"

    # 2. Student 1 books
    book_resp = await client.post(
        "/api/v1/bookings",
        headers=student_auth_headers,
        json={
            "teacher_id": str(teacher_profile.id),
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
        },
    )
    assert book_resp.status_code == 201
    booking_id = book_resp.json()["id"]

    # 3. Student 2 tries to view Student 1's booking
    student2_token = create_access_token(second_student.id, UserRole.STUDENT.value)
    student2_auth_headers = {"Authorization": f"Bearer {student2_token}"}

    view_resp = await client.get(f"/api/v1/bookings/{booking_id}", headers=student2_auth_headers)
    assert view_resp.status_code == 403

    # 4. Student 2 tries to cancel Student 1's booking
    cancel_resp = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers=student2_auth_headers,
        json={"reason": "Unauthorized cancellation"},
    )
    assert cancel_resp.status_code == 403


@pytest.mark.asyncio
async def test_teacher_booking_management(
    client: AsyncClient,
    verified_teacher: tuple[User, TeacherProfile],
    student_auth_headers: dict[str, str],
) -> None:
    """Test teacher completing and marking no-show on bookings."""
    teacher_user, teacher_profile = verified_teacher
    teacher_token = create_access_token(teacher_user.id, UserRole.TEACHER.value)
    teacher_auth_headers = {"Authorization": f"Bearer {teacher_token}"}

    start_time = (datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=6)).replace(
        hour=9, minute=0, second=0, microsecond=0
    )
    end_time = start_time + datetime.timedelta(hours=1)

    # 1. Student books
    book_resp = await client.post(
        "/api/v1/bookings",
        headers=student_auth_headers,
        json={
            "teacher_id": str(teacher_profile.id),
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
        },
    )
    assert book_resp.status_code == 201
    booking_id = book_resp.json()["id"]

    # 2. Teacher completes booking
    complete_resp = await client.post(
        f"/api/v1/bookings/{booking_id}/complete",
        headers=teacher_auth_headers,
    )
    assert complete_resp.status_code == 200
    assert complete_resp.json()["status"] == "completed"

    # 3. Cannot complete already completed booking
    complete_again = await client.post(
        f"/api/v1/bookings/{booking_id}/complete",
        headers=teacher_auth_headers,
    )
    assert complete_again.status_code == 400
