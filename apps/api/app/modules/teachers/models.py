"""SQLAlchemy models for Teacher Availability Rules, Exceptions, and Bookings."""

import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    column,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import TimeStampedUUIDModel
from app.modules.teachers.enums import BookingStatus

if TYPE_CHECKING:
    from app.modules.users.models import TeacherProfile, User


class TeacherAvailabilityRule(TimeStampedUUIDModel):
    """Recurring weekly availability rule for a teacher.

    weekday: 0 = Monday, 1 = Tuesday, ..., 6 = Sunday.
    start_time & end_time define the available window in local timezone.
    """

    __tablename__ = "teacher_availability_rules"

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teacher_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    weekday: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )
    start_time: Mapped[datetime.time] = mapped_column(
        Time,
        nullable=False,
    )
    end_time: Mapped[datetime.time] = mapped_column(
        Time,
        nullable=False,
    )
    timezone: Mapped[str] = mapped_column(
        String(50),
        default="UTC",
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    teacher: Mapped[TeacherProfile] = relationship(
        "TeacherProfile",
        back_populates="availability_rules",
    )

    __table_args__ = (
        Index("ix_teacher_rules_weekday_active", "teacher_id", "weekday", "is_active"),
    )


class TeacherAvailabilityException(TimeStampedUUIDModel):
    """Specific date exception overriding standard recurring availability.

    Either completely unavailable (e.g. vacation / sick leave)
    or modified hours for that specific date.
    """

    __tablename__ = "teacher_availability_exceptions"

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teacher_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    exception_date: Mapped[datetime.date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )
    is_unavailable: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    start_time: Mapped[datetime.time | None] = mapped_column(
        Time,
        nullable=True,
    )
    end_time: Mapped[datetime.time | None] = mapped_column(
        Time,
        nullable=True,
    )
    reason: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    teacher: Mapped[TeacherProfile] = relationship(
        "TeacherProfile",
        back_populates="availability_exceptions",
    )

    __table_args__ = (Index("ix_teacher_exception_date", "teacher_id", "exception_date"),)


class TeacherBooking(TimeStampedUUIDModel):
    """Booking session between a student and a teacher.

    Timestamps start_time and end_time are always stored in timezone-aware UTC.
    """

    __tablename__ = "teacher_bookings"

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teacher_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    start_time: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    end_time: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    status: Mapped[BookingStatus] = mapped_column(
        SQLEnum(BookingStatus, name="booking_status", native_enum=False),
        default=BookingStatus.CONFIRMED,
        nullable=False,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    cancellation_reason: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    cancelled_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    cancelled_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    meeting_link: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # Relationships
    teacher: Mapped[TeacherProfile] = relationship(
        "TeacherProfile",
        back_populates="bookings",
        lazy="selectin",
    )
    student: Mapped[User] = relationship(
        "User",
        foreign_keys=[student_id],
        back_populates="student_bookings",
        lazy="selectin",
    )
    cancelled_by: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[cancelled_by_user_id],
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_bookings_teacher_times", "teacher_id", "start_time", "end_time"),
        Index("ix_bookings_student_times", "student_id", "start_time", "end_time"),
        Index("ix_bookings_teacher_status", "teacher_id", "status"),
        Index(
            "uq_teacher_booking_active",
            "teacher_id",
            "start_time",
            unique=True,
            sqlite_where=(column("status") != "cancelled"),
            postgresql_where=(column("status") != "cancelled"),
        ),
    )
