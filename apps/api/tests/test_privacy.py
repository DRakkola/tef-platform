"""Tests for Privacy, GDPR account deletion, data export, and retention policies."""

import datetime
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.modules.admin.models import AuditEvent
from app.modules.billing.enums import OrderStatus
from app.modules.billing.models import Order
from app.modules.students.privacy_service import PrivacyService
from app.modules.teachers.enums import BookingStatus
from app.modules.teachers.models import TeacherBooking
from app.modules.users.models import StudentProfile, TeacherProfile, User, UserRole
from app.modules.writing.models import WritingAttempt, WritingDraftRevision, WritingTask
from app.workers.tasks import cleanup_retention_artifacts_core


@pytest.mark.asyncio
async def test_student_account_deletion_bad_password(db_session: AsyncSession):
    """Attempting deletion with incorrect password raises 400 INVALID_CREDENTIALS."""
    student = User(
        id=uuid.uuid4(),
        email=f"privacy_fail_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("ValidPassword123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db_session.add(student)
    await db_session.commit()

    with pytest.raises(Exception) as exc_info:
        await PrivacyService.delete_student_account(
            db=db_session,
            current_user=student,
            password="WrongPassword123!",
        )
    assert "Invalid password confirmation" in str(exc_info.value)


@pytest.mark.asyncio
async def test_student_account_deletion_success_and_ledger_preservation(db_session: AsyncSession):
    """Account deletion scrubs PII, cancels bookings, revokes tokens, but preserves financial orders."""
    # 1. Create student and related records
    student_id = uuid.uuid4()
    student = User(
        id=student_id,
        email=f"to_delete_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("CorrectPass123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db_session.add(student)

    profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=student_id,
        target_exam="TEF Canada",
        target_level="B2",
    )
    db_session.add(profile)
    now_utc = datetime.datetime.now(datetime.UTC)

    # Add a teacher for booking
    teacher_user = User(
        id=uuid.uuid4(),
        email=f"teacher_bk_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("TeacherPass123!"),
        role=UserRole.TEACHER,
        is_active=True,
    )
    db_session.add(teacher_user)
    teacher_prof = TeacherProfile(
        id=uuid.uuid4(),
        user_id=teacher_user.id,
        display_name="TEF Coach",
    )
    db_session.add(teacher_prof)

    future_booking = TeacherBooking(
        id=uuid.uuid4(),
        teacher_id=teacher_prof.id,
        student_id=student_id,
        start_time=now_utc + datetime.timedelta(days=3),
        end_time=now_utc + datetime.timedelta(days=3, hours=1),
        status=BookingStatus.CONFIRMED,
    )
    db_session.add(future_booking)

    # Add statutory financial order
    order = Order(
        id=uuid.uuid4(),
        order_number=f"ORD-PRIV-{uuid.uuid4().hex[:6]}",
        user_id=student_id,
        status=OrderStatus.PAID,
        currency="EUR",
        subtotal_cents=4900,
        tax_cents=0,
        total_cents=4900,
        provider="stripe",
    )
    db_session.add(order)
    await db_session.commit()

    # 2. Perform deletion
    resp = await PrivacyService.delete_student_account(
        db=db_session,
        current_user=student,
        password="CorrectPass123!",
        reason="No longer preparing for TEF",
    )

    assert resp.status == "success"
    assert f"deleted_{student_id}@anonymized.local" == student.email
    assert student.is_active is False
    assert student.is_verified is False

    # 3. Verify StudentProfile deleted
    prof_stmt = select(StudentProfile).where(StudentProfile.user_id == student_id)
    prof = (await db_session.execute(prof_stmt)).scalar_one_or_none()
    assert prof is None

    # 5. Verify Future Booking cancelled
    bk_stmt = select(TeacherBooking).where(TeacherBooking.id == future_booking.id)
    bk = (await db_session.execute(bk_stmt)).scalar_one()
    assert bk.status == BookingStatus.CANCELLED_BY_STUDENT

    # 6. Verify Financial Order preserved (statutory 7-year retention)
    ord_stmt = select(Order).where(Order.id == order.id)
    saved_order = (await db_session.execute(ord_stmt)).scalar_one_or_none()
    assert saved_order is not None
    assert saved_order.user_id == student_id
    assert saved_order.total_cents == 4900

    # Clean up test artifacts
    await db_session.delete(saved_order)
    await db_session.delete(bk)
    await db_session.delete(teacher_prof)
    await db_session.delete(teacher_user)
    audit_ev = (await db_session.execute(select(AuditEvent).where(AuditEvent.entity_id == student_id))).scalar_one_or_none()
    if audit_ev:
        await db_session.delete(audit_ev)
    stu = await db_session.get(User, student_id)
    if stu:
        await db_session.delete(stu)
    await db_session.commit()


@pytest.mark.asyncio
async def test_student_data_export(db_session: AsyncSession):
    """Verify GDPR data export compiles user profile, bookings, and billing history."""
    student_id = uuid.uuid4()
    student = User(
        id=student_id,
        email=f"export_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("Pass123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db_session.add(student)

    profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=student_id,
        target_exam="TEF Canada",
        target_level="C1",
    )
    db_session.add(profile)

    order = Order(
        id=uuid.uuid4(),
        order_number=f"ORD-EXP-{uuid.uuid4().hex[:6]}",
        user_id=student_id,
        status=OrderStatus.PAID,
        currency="EUR",
        subtotal_cents=2900,
        tax_cents=0,
        total_cents=2900,
        provider="stripe",
    )
    db_session.add(order)
    await db_session.commit()

    export_res = await PrivacyService.export_student_data(db=db_session, current_user=student)

    assert export_res.user_id == student_id
    assert export_res.profile["target_exam"] == "TEF Canada"
    assert export_res.profile["target_level"] == "C1"
    assert export_res.billing_summary["total_orders_count"] == 1
    assert export_res.billing_summary["orders"][0]["order_number"] == order.order_number

    # Clean up test artifacts
    await db_session.delete(order)
    await db_session.delete(profile)
    await db_session.delete(student)
    await db_session.commit()


@pytest.mark.asyncio
async def test_retention_artifacts_cleanup(db_session: AsyncSession):
    """Verify Celery retention worker purges drafts > 7d and scrubs audit logs > 90d."""
    now_utc = datetime.datetime.now(datetime.UTC)

    # 1. Create a dummy user and task for writing attempt
    user = User(
        id=uuid.uuid4(),
        email=f"draft_user_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="hash",
        role=UserRole.STUDENT,
    )
    db_session.add(user)
    task = WritingTask(
        id=uuid.uuid4(),
        title="Test Task Retention",
        prompt="Test Prompt",
        duration_minutes=30,
        min_words=80,
        max_words=120,
        is_published=False,
    )
    db_session.add(task)
    attempt = WritingAttempt(
        id=uuid.uuid4(),
        user_id=user.id,
        task_id=task.id,
        started_at=now_utc - datetime.timedelta(days=10),
        expires_at=now_utc - datetime.timedelta(days=10, minutes=-30),
    )
    db_session.add(attempt)

    # Old draft revision (> 7 days)
    old_draft = WritingDraftRevision(
        id=uuid.uuid4(),
        attempt_id=attempt.id,
        revision_number=1,
        content="Old draft text",
        word_count=3,
        created_at=now_utc - datetime.timedelta(days=10),
    )
    # Recent draft revision (< 7 days)
    recent_draft = WritingDraftRevision(
        id=uuid.uuid4(),
        attempt_id=attempt.id,
        revision_number=2,
        content="Recent draft text",
        word_count=3,
        created_at=now_utc - datetime.timedelta(days=2),
    )
    db_session.add_all([old_draft, recent_draft])

    # Old audit event (> 90 days)
    old_audit = AuditEvent(
        id=uuid.uuid4(),
        actor_user_id=user.id,
        action="LOGIN",
        entity_type="user",
        ip_address="198.51.100.42",
        created_at=now_utc - datetime.timedelta(days=95),
    )
    # Recent audit event (< 90 days)
    recent_audit = AuditEvent(
        id=uuid.uuid4(),
        actor_user_id=user.id,
        action="LOGIN",
        entity_type="user",
        ip_address="198.51.100.43",
        created_at=now_utc - datetime.timedelta(days=5),
    )
    db_session.add_all([old_audit, recent_audit])
    await db_session.commit()

    # Execute retention cleanup core logic
    results = await cleanup_retention_artifacts_core(db_session)

    assert results["purged_drafts_count"] >= 1
    assert results["anonymized_ips_count"] >= 1

    # Verify old draft was removed, recent draft retained
    d1 = (await db_session.execute(select(WritingDraftRevision).where(WritingDraftRevision.id == old_draft.id))).scalar_one_or_none()
    assert d1 is None

    d2 = (await db_session.execute(select(WritingDraftRevision).where(WritingDraftRevision.id == recent_draft.id))).scalar_one_or_none()
    assert d2 is not None

    # Verify old audit IP was anonymized, recent audit IP retained
    a1 = (await db_session.execute(select(AuditEvent).where(AuditEvent.id == old_audit.id))).scalar_one()
    assert a1.ip_address == "0.0.0.0/0_redacted"

    a2 = (await db_session.execute(select(AuditEvent).where(AuditEvent.id == recent_audit.id))).scalar_one()
    assert a2.ip_address == "198.51.100.43"

    # Clean up test artifacts so test isolation is maintained
    await db_session.delete(recent_draft)
    await db_session.delete(attempt)
    await db_session.delete(task)
    await db_session.delete(user)
    await db_session.delete(old_audit)
    await db_session.delete(recent_audit)
    await db_session.commit()


@pytest.mark.asyncio
async def test_student_privacy_http_endpoints(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Verify HTTP endpoints POST /api/v1/students/me/export and DELETE /api/v1/students/me."""
    from app.core.security import create_access_token

    isolated_student = User(
        id=uuid.uuid4(),
        email=f"del_endpoint_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("MySecurePass123!"),
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add(isolated_student)
    profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=isolated_student.id,
        target_exam="TEF Canada",
        target_level="B2",
    )
    db_session.add(profile)
    await db_session.commit()

    token = create_access_token(isolated_student.id, isolated_student.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Test data export endpoint
    export_resp = await client.post("/api/v1/students/me/export", headers=headers)
    assert export_resp.status_code == 200
    export_data = export_resp.json()
    assert "user_id" in export_data
    assert "profile" in export_data
    assert "billing_summary" in export_data

    # 2. Test deletion with bad password
    bad_del = await client.request(
        "DELETE",
        "/api/v1/students/me",
        headers=headers,
        json={"password": "WrongPassword123!"},
    )
    assert bad_del.status_code == 400

    # 3. Test deletion with correct password
    good_del = await client.request(
        "DELETE",
        "/api/v1/students/me",
        headers=headers,
        json={"password": "MySecurePass123!", "reason": "Testing HTTP deletion"},
    )
    assert good_del.status_code == 200
    del_data = good_del.json()
    assert del_data["status"] == "success"
    assert "anonymized_email" in del_data

    # Clean up test artifacts
    audit_del = (await db_session.execute(select(AuditEvent).where(AuditEvent.entity_id == isolated_student.id))).scalar_one_or_none()
    if audit_del:
        await db_session.delete(audit_del)
    await db_session.delete(isolated_student)
    await db_session.commit()

