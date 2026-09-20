"""Enums for teacher availability and booking domain."""

from enum import Enum


class BookingStatus(str, Enum):
    """Lifecycle status for a teacher booking session."""

    REQUESTED = "requested"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"  # Generic fallback
    CANCELLED_BY_STUDENT = "cancelled_by_student"
    CANCELLED_BY_TEACHER = "cancelled_by_teacher"
    COMPLETED = "completed"
    NO_SHOW = "no_show"
