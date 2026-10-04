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


class QuestionResponseType(str, Enum):
    """Question response format types supported in Question V2."""

    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    MATCHING = "matching"
    ORDERING = "ordering"
    GAP_FILL = "gap_fill"
    SHORT_TEXT = "short_text"
    LONG_TEXT = "long_text"
    SPOKEN_RESPONSE = "spoken_response"
    INTERACTION = "interaction"


class ScoringStatus(str, Enum):
    """Evaluation status for a candidate response in Question V2."""

    CORRECT = "correct"
    INCORRECT = "incorrect"
    PARTIAL = "partial"
    MISSING = "missing"
    PENDING_EVALUATION = "pending_evaluation"
    INVALID_RESPONSE = "invalid_response"


class CognitiveComplexityLevel(str, Enum):
    """Depth of knowledge and cognitive processing complexity."""

    RECALL_RECOGNITION = "recall_recognition"
    INTERPRETATION = "interpretation"
    INFERENCING_SYNTHESIS = "inferencing_synthesis"
    CRITICAL_EVALUATION = "critical_evaluation"


class QuestionAuthorType(str, Enum):
    """Provenance author classification."""

    HUMAN = "human"
    AI = "ai"
    IMPORTED = "imported"


class QuestionValidationStatus(str, Enum):
    """Outcome of automated quality and lint verification."""

    VALID = "valid"
    WARNING = "warning"
    BLOCKING = "blocking"
