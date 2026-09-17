"""Enumerations for writing assessment domain."""

from enum import StrEnum


class WritingTaskType(StrEnum):
    """Types of TEF writing tasks."""

    SECTION_A = "section_a"  # Fait divers / factual report (80-120 words)
    SECTION_B = "section_b"  # Argumentative letter / opinion piece (200-250 words)
    GENERAL = "general"


class WritingAttemptStatus(StrEnum):
    """Lifecycle status of a student's writing attempt."""

    DRAFT = "draft"
    SUBMITTED = "submitted"
    EXPIRED = "expired"
    ABANDONED = "abandoned"


class WritingSubmissionStatus(StrEnum):
    """Status of a submitted writing text across correction workflows."""

    SUBMITTED = "submitted"
    QUEUED = "queued"
    ASSIGNED = "assigned"
    PROCESSING = "processing"
    REVIEWING = "reviewing"
    CORRECTED = "corrected"
    RETURNED = "returned"


class CorrectionProviderType(StrEnum):
    """Provenance and type of correction provider."""

    MOCK = "mock"
    TEACHER = "teacher"
    AI = "ai"
