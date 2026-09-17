"""Booking service managing concurrency, transactions, authorization, and lifecycle states."""

import asyncio
import datetime
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.modules.teachers.enums import BookingStatus
from app.modules.teachers.models import TeacherBooking
from app.modules.teachers.schemas import BookingCreateRequest
from app.modules.users.models import TeacherProfile, TeacherVerificationStatus, User, UserRole

_teacher_locks: dict[uuid.UUID, asyncio.Lock] = {}


def _get_teacher_lock(teacher_id: uuid.UUID) -> asyncio.Lock:
    """Retrieve or initialize an asyncio.Lock for the specified teacher."""
    if teacher_id not in _teacher_locks:
        _teacher_locks[teacher_id] = asyncio.Lock()
    return _teacher_locks[teacher_id]


class BookingService:
    """Service handling teacher booking transactions and authorization."""

    @staticmethod
    async def create_booking(
        db: AsyncSession,
        student: User,
        payload: BookingCreateRequest,
    ) -> TeacherBooking:
        """Create a booking using pessimistic row locking to prevent double-booking."""
        start_utc = (
            payload.start_time.astimezone(datetime.UTC)
            if payload.start_time.tzinfo
            else payload.start_time.replace(tzinfo=datetime.UTC)
        )
        end_utc = (
            payload.end_time.astimezone(datetime.UTC)
            if payload.end_time.tzinfo
            else payload.end_time.replace(tzinfo=datetime.UTC)
        )

        now_utc = datetime.datetime.now(datetime.UTC)
        if start_utc <= now_utc:
            raise AppException(
                message="Cannot book a slot in the past",
                code="CANNOT_BOOK_PAST_SLOT",
                status_code=400,
            )

        # Acquire process-level teacher lock to prevent race conditions on single-threaded/in-memory test engines,
        # complemented by database row-level locking (with_for_update) and exclusion constraints on PostgreSQL.
        async with _get_teacher_lock(payload.teacher_id):
            # 1. Acquire pessimistic row-level lock on the teacher profile
            teacher_stmt = (
                select(TeacherProfile)
                .where(TeacherProfile.id == payload.teacher_id)
                .with_for_update()
            )
            teacher = (await db.execute(teacher_stmt)).scalar_one_or_none()

            if not teacher:
                raise AppException(
                    message="Teacher profile not found",
                    code="TEACHER_NOT_FOUND",
                    status_code=404,
                )

            if (
                teacher.verification_status != TeacherVerificationStatus.APPROVED
                and student.role != UserRole.ADMIN
            ):
                raise AppException(
                    message="Teacher is not verified for public bookings",
                    code="TEACHER_NOT_AVAILABLE",
                    status_code=400,
                )

            if teacher.user_id == student.id:
                raise AppException(
                    message="Teachers cannot book sessions with themselves",
                    code="SELF_BOOKING_FORBIDDEN",
                    status_code=400,
                )

            # 2. Check for overlapping teacher bookings: max(start1, start2) < min(end1, end2)
            # In SQL: (start_time < new_end) AND (end_time > new_start)
            teacher_overlap_stmt = select(TeacherBooking).where(
                TeacherBooking.teacher_id == teacher.id,
                TeacherBooking.status.in_([BookingStatus.REQUESTED, BookingStatus.CONFIRMED]),
                TeacherBooking.start_time < end_utc,
                TeacherBooking.end_time > start_utc,
            )
            existing_teacher_booking = (await db.execute(teacher_overlap_stmt)).scalars().first()
            if existing_teacher_booking:
                raise AppException(
                    message="This slot has already been booked or is pending confirmation",
                    code="SLOT_ALREADY_BOOKED",
                    status_code=409,
                )

            # 3. Check for overlapping student bookings (student cannot double-book themselves)
            student_overlap_stmt = select(TeacherBooking).where(
                TeacherBooking.student_id == student.id,
                TeacherBooking.status.in_([BookingStatus.REQUESTED, BookingStatus.CONFIRMED]),
                TeacherBooking.start_time < end_utc,
                TeacherBooking.end_time > start_utc,
            )
            existing_student_booking = (await db.execute(student_overlap_stmt)).scalars().first()
            if existing_student_booking:
                raise AppException(
                    message="You already have an active booking during this time slot",
                    code="STUDENT_SCHEDULE_CONFLICT",
                    status_code=409,
                )

            # 4. Create and commit the booking
            booking = TeacherBooking(
                teacher_id=teacher.id,
                student_id=student.id,
                start_time=start_utc,
                end_time=end_utc,
                status=BookingStatus.CONFIRMED,
                notes=payload.notes,
                meeting_link=f"https://meet.tef-platform.internal/{uuid.uuid4().hex[:12]}",
            )
            db.add(booking)
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                raise AppException(
                    message="This slot has already been booked or is pending confirmation",
                    code="SLOT_ALREADY_BOOKED",
                    status_code=409,
                )

            # Eager load relationships for clean serialization
            reload_stmt = (
                select(TeacherBooking)
                .where(TeacherBooking.id == booking.id)
                .options(selectinload(TeacherBooking.teacher), selectinload(TeacherBooking.student))
            )
            return (await db.execute(reload_stmt)).scalar_one()

    @staticmethod
    async def cancel_booking(
        db: AsyncSession,
        booking_id: uuid.UUID,
        user: User,
        reason: str,
    ) -> TeacherBooking:
        """Cancel a booking verifying authorization."""
        stmt = (
            select(TeacherBooking)
            .where(TeacherBooking.id == booking_id)
            .options(selectinload(TeacherBooking.teacher), selectinload(TeacherBooking.student))
        )
        booking = (await db.execute(stmt)).scalar_one_or_none()

        if not booking:
            raise AppException(
                message="Booking not found",
                code="BOOKING_NOT_FOUND",
                status_code=404,
            )

        # Authorization check: must be the student, the teacher, or an admin
        is_student = booking.student_id == user.id
        is_teacher = booking.teacher.user_id == user.id
        is_admin = user.role == UserRole.ADMIN

        if not (is_student or is_teacher or is_admin):
            raise AppException(
                message="Not authorized to cancel this booking",
                code="FORBIDDEN",
                status_code=403,
            )

        if booking.status in (
            BookingStatus.CANCELLED,
            BookingStatus.COMPLETED,
            BookingStatus.NO_SHOW,
        ):
            raise AppException(
                message=f"Cannot cancel a booking with status '{booking.status.value}'",
                code="INVALID_BOOKING_STATE",
                status_code=400,
            )

        booking.status = BookingStatus.CANCELLED
        booking.cancellation_reason = reason
        booking.cancelled_by_user_id = user.id
        booking.cancelled_at = datetime.datetime.now(datetime.UTC)

        await db.commit()
        reload_stmt = (
            select(TeacherBooking)
            .where(TeacherBooking.id == booking.id)
            .options(selectinload(TeacherBooking.teacher), selectinload(TeacherBooking.student))
        )
        return (await db.execute(reload_stmt)).scalar_one()

    @staticmethod
    async def confirm_booking(
        db: AsyncSession,
        booking_id: uuid.UUID,
        user: User,
    ) -> TeacherBooking:
        """Teacher or admin confirms a requested booking."""
        stmt = (
            select(TeacherBooking)
            .where(TeacherBooking.id == booking_id)
            .options(selectinload(TeacherBooking.teacher), selectinload(TeacherBooking.student))
        )
        booking = (await db.execute(stmt)).scalar_one_or_none()

        if not booking:
            raise AppException(
                message="Booking not found",
                code="BOOKING_NOT_FOUND",
                status_code=404,
            )

        is_teacher = booking.teacher.user_id == user.id
        is_admin = user.role == UserRole.ADMIN

        if not (is_teacher or is_admin):
            raise AppException(
                message="Only the assigned teacher or admin can confirm this booking",
                code="FORBIDDEN",
                status_code=403,
            )

        if booking.status != BookingStatus.REQUESTED:
            raise AppException(
                message=f"Only requested bookings can be confirmed; current status is '{booking.status.value}'",
                code="INVALID_BOOKING_STATE",
                status_code=400,
            )

        booking.status = BookingStatus.CONFIRMED
        await db.commit()
        reload_stmt = (
            select(TeacherBooking)
            .where(TeacherBooking.id == booking.id)
            .options(selectinload(TeacherBooking.teacher), selectinload(TeacherBooking.student))
        )
        return (await db.execute(reload_stmt)).scalar_one()

    @staticmethod
    async def complete_booking(
        db: AsyncSession,
        booking_id: uuid.UUID,
        user: User,
    ) -> TeacherBooking:
        """Teacher or admin marks a booking as completed."""
        stmt = (
            select(TeacherBooking)
            .where(TeacherBooking.id == booking_id)
            .options(selectinload(TeacherBooking.teacher), selectinload(TeacherBooking.student))
        )
        booking = (await db.execute(stmt)).scalar_one_or_none()

        if not booking:
            raise AppException(
                message="Booking not found",
                code="BOOKING_NOT_FOUND",
                status_code=404,
            )

        is_teacher = booking.teacher.user_id == user.id
        is_admin = user.role == UserRole.ADMIN

        if not (is_teacher or is_admin):
            raise AppException(
                message="Only the assigned teacher or admin can complete this booking",
                code="FORBIDDEN",
                status_code=403,
            )

        if booking.status != BookingStatus.CONFIRMED:
            raise AppException(
                message=f"Only confirmed bookings can be completed; current status is '{booking.status.value}'",
                code="INVALID_BOOKING_STATE",
                status_code=400,
            )

        booking.status = BookingStatus.COMPLETED
        await db.commit()
        reload_stmt = (
            select(TeacherBooking)
            .where(TeacherBooking.id == booking.id)
            .options(selectinload(TeacherBooking.teacher), selectinload(TeacherBooking.student))
        )
        return (await db.execute(reload_stmt)).scalar_one()

    @staticmethod
    async def mark_no_show(
        db: AsyncSession,
        booking_id: uuid.UUID,
        user: User,
    ) -> TeacherBooking:
        """Teacher or admin marks a booking as no-show."""
        stmt = (
            select(TeacherBooking)
            .where(TeacherBooking.id == booking_id)
            .options(selectinload(TeacherBooking.teacher), selectinload(TeacherBooking.student))
        )
        booking = (await db.execute(stmt)).scalar_one_or_none()

        if not booking:
            raise AppException(
                message="Booking not found",
                code="BOOKING_NOT_FOUND",
                status_code=404,
            )

        is_teacher = booking.teacher.user_id == user.id
        is_admin = user.role == UserRole.ADMIN

        if not (is_teacher or is_admin):
            raise AppException(
                message="Only the assigned teacher or admin can mark a no-show",
                code="FORBIDDEN",
                status_code=403,
            )

        if booking.status != BookingStatus.CONFIRMED:
            raise AppException(
                message=f"Only confirmed bookings can be marked as no-show; current status is '{booking.status.value}'",
                code="INVALID_BOOKING_STATE",
                status_code=400,
            )

        booking.status = BookingStatus.NO_SHOW
        await db.commit()
        reload_stmt = (
            select(TeacherBooking)
            .where(TeacherBooking.id == booking.id)
            .options(selectinload(TeacherBooking.teacher), selectinload(TeacherBooking.student))
        )
        return (await db.execute(reload_stmt)).scalar_one()

    @staticmethod
    async def get_booking(
        db: AsyncSession,
        booking_id: uuid.UUID,
        user: User,
    ) -> TeacherBooking:
        """Retrieve booking detail verifying participant authorization."""
        stmt = (
            select(TeacherBooking)
            .where(TeacherBooking.id == booking_id)
            .options(selectinload(TeacherBooking.teacher), selectinload(TeacherBooking.student))
        )
        booking = (await db.execute(stmt)).scalar_one_or_none()

        if not booking:
            raise AppException(
                message="Booking not found",
                code="BOOKING_NOT_FOUND",
                status_code=404,
            )

        is_student = booking.student_id == user.id
        is_teacher = booking.teacher.user_id == user.id
        is_admin = user.role == UserRole.ADMIN

        if not (is_student or is_teacher or is_admin):
            raise AppException(
                message="Not authorized to view this booking",
                code="FORBIDDEN",
                status_code=403,
            )

        return booking

    @staticmethod
    async def list_bookings(
        db: AsyncSession,
        user: User,
        status_filter: BookingStatus | None = None,
        from_date: datetime.datetime | None = None,
        to_date: datetime.datetime | None = None,
    ) -> list[TeacherBooking]:
        """List bookings for the current user according to their role."""
        stmt = (
            select(TeacherBooking)
            .options(selectinload(TeacherBooking.teacher), selectinload(TeacherBooking.student))
            .order_by(TeacherBooking.start_time.desc())
        )

        if user.role == UserRole.STUDENT:
            stmt = stmt.where(TeacherBooking.student_id == user.id)
        elif user.role == UserRole.TEACHER:
            teacher_profile_stmt = select(TeacherProfile.id).where(
                TeacherProfile.user_id == user.id
            )
            teacher_profile_id = (await db.execute(teacher_profile_stmt)).scalar_one_or_none()
            if not teacher_profile_id:
                return []
            stmt = stmt.where(TeacherBooking.teacher_id == teacher_profile_id)
        # Admin sees all unless specific user filters apply

        if status_filter:
            stmt = stmt.where(TeacherBooking.status == status_filter)
        if from_date:
            stmt = stmt.where(TeacherBooking.start_time >= from_date)
        if to_date:
            stmt = stmt.where(TeacherBooking.end_time <= to_date)

        result = await db.execute(stmt)
        return list(result.scalars().all())
