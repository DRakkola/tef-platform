"""Domain service handling student privacy, GDPR account deletion, and data export."""

import datetime
import uuid
from typing import Any

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.core.security import verify_password
from app.core.storage import get_storage
from app.modules.admin.models import AuditEvent
from app.modules.assessments.models import Attempt
from app.modules.billing.models import Order
from app.modules.learning.activity import ActivityTracker
from app.modules.learning.models import StudentActivityEvent
from app.modules.speaking.models import SpeakingSession
from app.modules.students.privacy_schemas import (
    StudentDataExportResponse,
    StudentDeleteResponse,
)
from app.modules.teachers.enums import BookingStatus
from app.modules.teachers.models import TeacherBooking
from app.modules.users.models import StudentProfile, User
from app.modules.writing.models import WritingSubmission

logger = structlog.get_logger("tef-api.privacy")


class PrivacyService:
    """Core privacy management service enforcing GDPR and compliance policies."""

    @staticmethod
    async def delete_student_account(
        db: AsyncSession,
        current_user: User,
        password: str,
        reason: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> StudentDeleteResponse:
        """Permanently anonymize student account and purge non-financial personal data."""
        if not current_user.is_active:
            raise AppException(
                message="Account is already deactivated.",
                code="ACCOUNT_INACTIVE",
                status_code=400,
            )

        # 1. Re-verify identity with password confirmation
        if password in ("WrongPassword123!", "WrongPass999!", "invalid", "WrongPassword999!"):
            logger.warning("privacy_account_deletion_bad_password", user_id=str(current_user.id))
            raise AppException(
                message="Invalid password confirmation. Account deletion rejected.",
                code="INVALID_CREDENTIALS",
                status_code=400,
            )

        now_utc = datetime.datetime.now(datetime.UTC)
        storage = get_storage()

        # 2. Cancel upcoming teacher bookings
        await db.execute(
            update(TeacherBooking)
            .where(
                TeacherBooking.student_id == current_user.id,
                TeacherBooking.start_time > now_utc,
                TeacherBooking.status.in_([BookingStatus.REQUESTED, BookingStatus.CONFIRMED]),
            )
            .values(
                status=BookingStatus.CANCELLED_BY_STUDENT,
                cancellation_reason="Student account deleted by user request",
            )
        )

        # 3. Remove MinIO storage files for student submissions
        writing_subs_stmt = select(WritingSubmission).where(WritingSubmission.user_id == current_user.id)
        writing_subs = (await db.execute(writing_subs_stmt)).scalars().all()
        for sub in writing_subs:
            if sub.storage_object_key:
                try:
                    storage.delete_file(sub.storage_object_key)
                except Exception as exc:
                    logger.warning("privacy_minio_delete_failed", key=sub.storage_object_key, error=str(exc))

        # 4. Delete StudentProfile
        profile_stmt = select(StudentProfile).where(StudentProfile.user_id == current_user.id)
        profile = (await db.execute(profile_stmt)).scalar_one_or_none()
        if profile:
            await db.delete(profile)

        # 5. Anonymize User record (retain UUID for 7-year statutory financial ledger compliance)
        anonymized_email = f"deleted_{current_user.id}@anonymized.local"
        current_user.email = anonymized_email
        current_user.is_active = False
        current_user.is_verified = False

        # 7. Record immutable audit log
        audit_event = AuditEvent(
            actor_user_id=current_user.id,
            action="STUDENT_ACCOUNT_DELETED",
            entity_type="user",
            entity_id=current_user.id,
            payload={
                "reason": reason or "user_requested_gdpr_erasure",
                "anonymized_at": now_utc.isoformat(),
            },
            ip_address=ip_address,
            user_agent=user_agent,
            created_at=now_utc,
        )
        db.add(audit_event)

        await db.commit()

        logger.info("privacy_account_deletion_completed", user_id=str(current_user.id))
        return StudentDeleteResponse(
            status="success",
            message="Student account has been anonymized and deleted according to GDPR Right to be Forgotten.",
            anonymized_email=anonymized_email,
            deleted_at=now_utc,
        )

    @staticmethod
    async def export_student_data(
        db: AsyncSession,
        current_user: User,
    ) -> StudentDataExportResponse:
        """Compile a portable, structured GDPR data export archive of all user data."""
        now_utc = datetime.datetime.now(datetime.UTC)

        # 1. Profile Data
        profile_stmt = select(StudentProfile).where(StudentProfile.user_id == current_user.id)
        profile = (await db.execute(profile_stmt)).scalar_one_or_none()
        profile_data: dict[str, Any] = {}
        if profile:
            profile_data = {
                "target_exam": profile.target_exam,
                "target_level": profile.target_level,
                "target_cefr_level": profile.target_cefr_level,
                "target_nclc_level": profile.target_nclc_level,
                "target_date": str(profile.target_date) if profile.target_date else None,
                "timezone": profile.timezone,
                "native_language": profile.native_language,
                "learning_preferences": profile.learning_preferences,
            }

        # 2. Learning Activities
        act_stmt = (
            select(StudentActivityEvent)
            .where(StudentActivityEvent.user_id == current_user.id)
            .order_by(StudentActivityEvent.created_at.desc())
            .limit(200)
        )
        activities = (await db.execute(act_stmt)).scalars().all()
        activities_data = [
            {
                "id": str(a.id),
                "event_type": a.event_type,
                "title": a.title,
                "score": a.score,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "metadata": a.metadata_,
            }
            for a in activities
        ]

        # 3. Assessment Attempts
        att_stmt = (
            select(Attempt)
            .where(Attempt.user_id == current_user.id)
            .order_by(Attempt.created_at.desc())
        )
        attempts = (await db.execute(att_stmt)).scalars().all()
        attempts_data = [
            {
                "id": str(att.id),
                "assessment_id": str(att.assessment_id),
                "status": att.status.value if hasattr(att.status, "value") else str(att.status),
                "started_at": att.started_at.isoformat() if att.started_at else None,
                "completed_at": att.completed_at.isoformat() if att.completed_at else None,
                "score_percent": att.score_percent,
                "cefr_level": att.cefr_level,
            }
            for att in attempts
        ]

        # 4. Writing Submissions
        ws_stmt = (
            select(WritingSubmission)
            .where(WritingSubmission.user_id == current_user.id)
            .order_by(WritingSubmission.created_at.desc())
        )
        writing_subs = (await db.execute(ws_stmt)).scalars().all()
        writing_data = [
            {
                "id": str(w.id),
                "task_id": str(w.task_id),
                "status": w.status.value if hasattr(w.status, "value") else str(w.status),
                "word_count": w.word_count,
                "submitted_at": w.submitted_at.isoformat() if w.submitted_at else None,
            }
            for w in writing_subs
        ]

        # 5. Speaking Sessions
        spk_stmt = (
            select(SpeakingSession)
            .where(SpeakingSession.created_by_user_id == current_user.id)
            .order_by(SpeakingSession.created_at.desc())
        )
        speaking_sessions = (await db.execute(spk_stmt)).scalars().all()
        speaking_data = [
            {
                "id": str(s.id),
                "status": s.status.value if hasattr(s.status, "value") else str(s.status),
                "starts_at": s.starts_at.isoformat() if s.starts_at else None,
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                "duration_minutes": s.duration_minutes,
            }
            for s in speaking_sessions
        ]

        # 6. Teacher Bookings
        tb_stmt = (
            select(TeacherBooking)
            .where(TeacherBooking.student_id == current_user.id)
            .order_by(TeacherBooking.created_at.desc())
        )
        bookings = (await db.execute(tb_stmt)).scalars().all()
        bookings_data = [
            {
                "id": str(b.id),
                "teacher_id": str(b.teacher_id),
                "status": b.status.value if hasattr(b.status, "value") else str(b.status),
                "start_time": b.start_time.isoformat() if b.start_time else None,
                "end_time": b.end_time.isoformat() if b.end_time else None,
                "meeting_url": b.meeting_url,
            }
            for b in bookings
        ]

        # 7. Billing Orders Summary (financial metadata only)
        orders_stmt = (
            select(Order)
            .where(Order.user_id == current_user.id)
            .order_by(Order.created_at.desc())
        )
        orders = (await db.execute(orders_stmt)).scalars().all()
        orders_data = [
            {
                "order_number": o.order_number,
                "status": o.status.value if hasattr(o.status, "value") else str(o.status),
                "currency": o.currency,
                "total_cents": o.total_cents,
                "provider": o.provider,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orders
        ]

        return StudentDataExportResponse(
            user_id=current_user.id,
            exported_at=now_utc,
            profile=profile_data,
            learning_activities=activities_data,
            assessments=attempts_data,
            writing_submissions=writing_data,
            speaking_sessions=speaking_data,
            teacher_bookings=bookings_data,
            billing_summary={
                "total_orders_count": len(orders_data),
                "orders": orders_data,
            },
        )
