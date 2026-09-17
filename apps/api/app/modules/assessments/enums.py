"""Enums for the generic assessment engine."""

from enum import Enum


class AssessmentType(str, Enum):
    """Types of assessments supported by the platform."""

    READING = "reading"
    LISTENING = "listening"
    MIXED = "mixed"


class QuestionType(str, Enum):
    """Extensible question types."""

    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    TEXT_INPUT = "text_input"


class NavigationPolicy(str, Enum):
    """Section and question navigation constraints."""

    FREE = "free"  # Student can navigate back and forth freely
    LINEAR = "linear"  # Student can only advance forward


class ScoringPolicy(str, Enum):
    """Scoring algorithms applied to the assessment."""

    STANDARD_POINTS = "standard_points"  # Raw points and percentage
    TEF_CLB = "tef_clb"  # Benchmark against Canadian Language Benchmarks (CLB / NCLC)


class AttemptStatus(str, Enum):
    """Lifecycle states of an assessment attempt."""

    CREATED = "created"
    STARTED = "started"
    SUBMITTED = "submitted"
    EXPIRED = "expired"
    ABANDONED = "abandoned"


class CEFRLevel(str, Enum):
    """Common European Framework of Reference for Languages (CEFR) levels."""

    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"
