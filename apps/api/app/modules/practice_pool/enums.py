"""Enumerations for the Practice Pool subsystem."""

from enum import StrEnum


class PracticeType(StrEnum):
    """Audio practice modes supported by the platform."""

    FREE_CONVERSATION = "free_conversation"
    TEF_SECTION_A = "tef_section_a"  # Demande de renseignements / formal inquiry
    TEF_SECTION_B = "tef_section_b"  # Convaincre un ami / persuasion
    GENERAL_PRACTICE = "general_practice"


class PracticeQueueStatus(StrEnum):
    """Lifecycle status of a student queue entry."""

    WAITING = "waiting"
    MATCHED = "matched"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class PracticeRequestStatus(StrEnum):
    """Lifecycle status of a 1-to-1 practice invitation."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class PracticeMatchStatus(StrEnum):
    """Lifecycle status of a formed practice match."""

    MATCHED = "matched"
    SESSION_CREATED = "session_created"
    CANCELLED = "cancelled"
    FAILED = "failed"


class PracticeSessionStatus(StrEnum):
    """Lifecycle status of an authoritative practice session."""

    CREATED = "created"
    WAITING = "waiting"
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class PracticeReportReason(StrEnum):
    """Standardized reasons for reporting an anonymous peer."""

    INAPPROPRIATE_BEHAVIOR = "inappropriate_behavior"
    HARASSMENT = "harassment"
    SPAM = "spam"
    AUDIO_ISSUES = "audio_issues"
    OFFENSIVE_LANGUAGE = "offensive_language"
    TECHNICAL_ABUSE = "technical_abuse"
    OTHER = "other"


class PracticeReportStatus(StrEnum):
    """Lifecycle status of a moderation report."""

    OPEN = "open"
    REVIEWING = "reviewing"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"

