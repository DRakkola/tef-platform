"""Enumerations for writing assessment domain."""

from enum import StrEnum


class WritingTaskType(StrEnum):
    """Types of TEF writing tasks."""

    SECTION_A = "section_a"  # Fait divers / factual report (80-120 words)
    SECTION_B = "section_b"  # Argumentative letter / opinion piece (200-250 words)
    GENERAL = "general"


class WritingAttemptStatus(StrEnum):
    """Lifecycle status of a student's writing attempt."""

    CREATED = "created"
    STARTED = "started"
    DRAFT = "draft"  # Backward compatibility alias
    SUBMITTED = "submitted"
    EXPIRED = "expired"
    ABANDONED = "abandoned"


class WritingSubmissionStatus(StrEnum):
    """Status of a submitted writing text across correction workflows."""

    SUBMITTED = "submitted"
    QUEUED = "queued"
    ASSIGNED = "assigned"
    IN_REVIEW = "in_review"
    PROCESSING = "processing"  # Backward compatibility alias
    REVIEWING = "reviewing"  # Backward compatibility alias
    CORRECTED = "corrected"
    RETURNED = "returned"


class WritingCorrectionStatus(StrEnum):
    """Lifecycle status of a teacher or provider writing correction."""

    DRAFT = "draft"
    SUBMITTED = "submitted"
    RETURNED = "returned"


class CorrectionProviderType(StrEnum):
    """Provenance and type of correction provider."""

    MOCK = "mock"
    TEACHER = "teacher"
    AI = "ai"
