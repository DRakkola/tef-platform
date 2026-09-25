"""Pydantic schemas for teacher profiles, availability, and bookings."""

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.teachers.enums import BookingStatus
from app.modules.users.models import TeacherVerificationStatus


class TeacherSummaryResponse(BaseModel):
    """Summary card for teacher discovery and marketplace browsing."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    display_name: str
    bio: str | None = None
    expertise: list[str] = Field(default_factory=list)
    teaching_levels: list[str] = Field(default_factory=list)
    hourly_price: int
    verification_status: TeacherVerificationStatus
    timezone: str = "UTC"


class TeacherListResponse(BaseModel):
    """Paginated list of teachers."""

    items: list[TeacherSummaryResponse]
    total: int
    page: int
    page_size: int


# Availability Rules Schemas
class AvailabilityRuleCreate(BaseModel):
    """Payload to create or update a recurring weekly availability rule."""

    weekday: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    start_time: datetime.time = Field(..., description="Start time (e.g. 09:00)")
    end_time: datetime.time = Field(..., description="End time (e.g. 17:00)")
    timezone: str = Field(default="UTC", description="IANA timezone string (e.g. Europe/Paris)")

    @field_validator("end_time")
    @classmethod
    def validate_times(cls, end_time: datetime.time, info: Any) -> datetime.time:
        start_time = info.data.get("start_time")
        if start_time and end_time <= start_time:
            raise ValueError("end_time must be strictly after start_time")
        return end_time


class AvailabilityRuleResponse(BaseModel):
    """Recurring availability rule response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    teacher_id: uuid.UUID
    weekday: int
    start_time: datetime.time
    end_time: datetime.time
    timezone: str
    is_active: bool
    created_at: datetime.datetime


# Availability Exceptions Schemas
class AvailabilityExceptionCreate(BaseModel):
    """Payload to block a date or define modified hours."""

    exception_date: datetime.date
    is_unavailable: bool = True
    start_time: datetime.time | None = None
    end_time: datetime.time | None = None
    reason: str | None = Field(None, max_length=255)

    @field_validator("end_time")
    @classmethod
    def validate_exception_times(
        cls, end_time: datetime.time | None, info: Any
    ) -> datetime.time | None:
        is_unavailable = info.data.get("is_unavailable", True)
        start_time = info.data.get("start_time")
        if not is_unavailable:
            if not start_time or not end_time:
                raise ValueError(
                    "start_time and end_time are required when is_unavailable is False"
                )
            if end_time <= start_time:
                raise ValueError("end_time must be strictly after start_time")
        return end_time


class AvailabilityExceptionResponse(BaseModel):
    """Availability exception response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    teacher_id: uuid.UUID
    exception_date: datetime.date
    is_unavailable: bool
    start_time: datetime.time | None
    end_time: datetime.time | None
    reason: str | None
    created_at: datetime.datetime


# Availability Override Schemas
class AvailabilityOverrideCreate(BaseModel):
    """Payload to create a date-specific custom availability window or blackout."""

    override_date: datetime.date
    start_time: datetime.time
    end_time: datetime.time
    timezone: str = Field(default="UTC", description="IANA timezone string")
    is_available: bool = True
    notes: str | None = Field(None, max_length=255)

    @field_validator("end_time")
    @classmethod
    def validate_override_times(cls, end_time: datetime.time, info: Any) -> datetime.time:
        start_time = info.data.get("start_time")
        if start_time and end_time <= start_time:
            raise ValueError("end_time must be strictly after start_time")
        return end_time


class AvailabilityOverrideResponse(BaseModel):
    """Availability override response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    teacher_id: uuid.UUID
    override_date: datetime.date
    start_time: datetime.time
    end_time: datetime.time
    timezone: str
    is_available: bool
    notes: str | None
    created_at: datetime.datetime


# Slot Inspection Schemas
class TimeSlot(BaseModel):
    """Individual available bookable slot."""

    start_time: datetime.datetime = Field(..., description="UTC start time")
    end_time: datetime.datetime = Field(..., description="UTC end time")
    start_time_local: str = Field(..., description="Formatted in target timezone")
    end_time_local: str = Field(..., description="Formatted in target timezone")
    duration_minutes: int


class TeacherSlotsResponse(BaseModel):
    """Response containing available slots for a teacher."""

    teacher_id: uuid.UUID
    teacher_timezone: str
    student_timezone: str
    date_from: datetime.date
    date_to: datetime.date
    slots: list[TimeSlot]


# Booking Schemas
class BookingCreateRequest(BaseModel):
    """Payload to book an available slot with a teacher."""

    teacher_id: uuid.UUID
    start_time: datetime.datetime
    end_time: datetime.datetime
    notes: str | None = Field(None, max_length=2000)

    @field_validator("start_time", "end_time")
    @classmethod
    def ensure_timezone_aware(cls, dt: datetime.datetime) -> datetime.datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=datetime.UTC)
        return dt.astimezone(datetime.UTC)

    @field_validator("end_time")
    @classmethod
    def validate_booking_duration(cls, end_time: datetime.datetime, info: Any) -> datetime.datetime:
        start_time = info.data.get("start_time")
        if start_time:
            if end_time <= start_time:
                raise ValueError("end_time must be strictly after start_time")
            duration = (end_time - start_time).total_seconds() / 60
            if duration < 15 or duration > 180:
                raise ValueError("Booking duration must be between 15 and 180 minutes")
        return end_time


class BookingCancelRequest(BaseModel):
    """Payload to cancel an existing booking."""

    reason: str = Field(..., min_length=3, max_length=500, description="Reason for cancellation")


class BookingRescheduleRequest(BaseModel):
    """Payload to reschedule an existing booking."""

    new_start_time: datetime.datetime = Field(..., description="New UTC start time")
    new_end_time: datetime.datetime = Field(..., description="New UTC end time")
    reason: str | None = Field(None, max_length=500, description="Optional reason for rescheduling")

    @field_validator("new_start_time", "new_end_time")
    @classmethod
    def ensure_timezone_aware(cls, dt: datetime.datetime) -> datetime.datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=datetime.UTC)
        return dt.astimezone(datetime.UTC)

    @field_validator("new_end_time")
    @classmethod
    def validate_reschedule_times(
        cls, new_end_time: datetime.datetime, info: Any
    ) -> datetime.datetime:
        new_start_time = info.data.get("new_start_time")
        if new_start_time:
            if new_end_time <= new_start_time:
                raise ValueError("new_end_time must be strictly after new_start_time")
            duration = (new_end_time - new_start_time).total_seconds() / 60
            if duration < 15 or duration > 180:
                raise ValueError("Booking duration must be between 15 and 180 minutes")
        return new_end_time


class TeacherBookingResponse(BaseModel):
    """Comprehensive booking details."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    teacher_id: uuid.UUID
    student_id: uuid.UUID
    teacher_display_name: str | None = None
    student_display_name: str | None = None
    student_email: str | None = None
    start_time: datetime.datetime
    end_time: datetime.datetime
    status: BookingStatus
    timezone: str = "UTC"
    payment_status: str = "unpaid"
    notes: str | None = None
    meeting_link: str | None = None
    cancellation_reason: str | None = None
    cancelled_by_user_id: uuid.UUID | None = None
    cancelled_at: datetime.datetime | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class BookingListResponse(BaseModel):
    """List of bookings."""

    items: list[TeacherBookingResponse]
    total: int
