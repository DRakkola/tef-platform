"""Enums for teacher availability and booking domain."""

from enum import Enum


class BookingStatus(str, Enum):
    """Lifecycle status for a teacher booking session."""

    REQUESTED = "requested"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    NO_SHOW = "no_show"
