"""FastAPI Router for booking operations: /api/v1/bookings."""

import datetime
import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.teachers.booking_service import BookingService
from app.modules.teachers.enums import BookingStatus
from app.modules.teachers.models import TeacherBooking
from app.modules.teachers.schemas import (
    BookingCancelRequest,
    BookingCreateRequest,
    BookingListResponse,
    TeacherBookingResponse,
)
from app.modules.users.models import User

router = APIRouter(prefix="/bookings", tags=["Bookings"])


def serialize_booking(b: TeacherBooking) -> TeacherBookingResponse:
    """Helper to convert TeacherBooking to response schema with related attributes."""
    return TeacherBookingResponse(
        id=b.id,
        teacher_id=b.teacher_id,
        student_id=b.student_id,
        teacher_display_name=b.teacher.display_name if b.teacher else None,
        student_email=b.student.email if b.student else None,
        start_time=b.start_time,
        end_time=b.end_time,
        status=b.status,
        notes=b.notes,
        meeting_link=b.meeting_link,
        cancellation_reason=b.cancellation_reason,
        cancelled_by_user_id=b.cancelled_by_user_id,
        cancelled_at=b.cancelled_at,
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


@router.post(
    "",
    response_model=TeacherBookingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book an available slot with a teacher",
)
async def create_booking(
    payload: BookingCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeacherBookingResponse:
    """Create a new booking using atomic database locking to prevent double bookings."""
    booking = await BookingService.create_booking(
        db=db,
        student=current_user,
        payload=payload,
    )
    return serialize_booking(booking)


@router.get(
    "",
    response_model=BookingListResponse,
    summary="List bookings for current user",
)
async def list_bookings(
    status_filter: BookingStatus | None = Query(
        None, alias="status", description="Filter by booking status"
    ),
    from_date: datetime.datetime | None = Query(
        None, description="Filter bookings starting on/after"
    ),
    to_date: datetime.datetime | None = Query(None, description="Filter bookings ending on/before"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BookingListResponse:
    """Retrieve booking history / upcoming sessions for the current authenticated user."""
    bookings = await BookingService.list_bookings(
        db=db,
        user=current_user,
        status_filter=status_filter,
        from_date=from_date,
        to_date=to_date,
    )
    items = [serialize_booking(b) for b in bookings]
    return BookingListResponse(items=items, total=len(items))


@router.get(
    "/{booking_id}",
    response_model=TeacherBookingResponse,
    summary="Get booking details",
)
async def get_booking(
    booking_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeacherBookingResponse:
    """Retrieve detailed session booking information verifying participant authorization."""
    booking = await BookingService.get_booking(
        db=db,
        booking_id=booking_id,
        user=current_user,
    )
    return serialize_booking(booking)


@router.post(
    "/{booking_id}/confirm",
    response_model=TeacherBookingResponse,
    summary="Teacher confirms requested booking",
)
async def confirm_booking(
    booking_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeacherBookingResponse:
    """Teacher confirms a requested booking session."""
    booking = await BookingService.confirm_booking(
        db=db,
        booking_id=booking_id,
        user=current_user,
    )
    return serialize_booking(booking)


@router.post(
    "/{booking_id}/cancel",
    response_model=TeacherBookingResponse,
    summary="Cancel booking session",
)
async def cancel_booking(
    booking_id: uuid.UUID,
    payload: BookingCancelRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeacherBookingResponse:
    """Cancel a booking session. Only the student, teacher, or admin may cancel."""
    booking = await BookingService.cancel_booking(
        db=db,
        booking_id=booking_id,
        user=current_user,
        reason=payload.reason,
    )
    return serialize_booking(booking)


@router.post(
    "/{booking_id}/complete",
    response_model=TeacherBookingResponse,
    summary="Complete booking session",
)
async def complete_booking(
    booking_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeacherBookingResponse:
    """Teacher marks a booking as completed."""
    booking = await BookingService.complete_booking(
        db=db,
        booking_id=booking_id,
        user=current_user,
    )
    return serialize_booking(booking)


@router.post(
    "/{booking_id}/no-show",
    response_model=TeacherBookingResponse,
    summary="Mark booking session as no-show",
)
async def mark_no_show(
    booking_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeacherBookingResponse:
    """Teacher marks student as no-show."""
    booking = await BookingService.mark_no_show(
        db=db,
        booking_id=booking_id,
        user=current_user,
    )
    return serialize_booking(booking)
