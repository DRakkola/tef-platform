"""Enums for speaking sessions, participant roles, states, and evaluations."""

from enum import Enum


class SpeakingSessionType(str, Enum):
    """Type of speaking session."""

    AI = "ai"
    TEACHER = "teacher"


class SpeakingSessionState(str, Enum):
    """Lifecycle state of a speaking session."""

    SCHEDULED = "scheduled"
    WAITING = "waiting"
    ACTIVE = "active"
    COMPLETED = "completed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class SpeakingParticipantRole(str, Enum):
    """Role of a participant in a speaking session."""

    STUDENT = "student"
    TEACHER = "teacher"
    AI_ASSISTANT = "ai_assistant"


class SpeakingEvaluatorType(str, Enum):
    """Type of evaluator producing session evaluation."""

    AI = "ai"
    TEACHER = "teacher"
    MOCK = "mock"


class SpeakingExamState(str, Enum):
    """Authoritative lifecycle state of a TEF Speaking Examination."""

    CREATED = "created"
    READY = "ready"
    SECTION_A_ACTIVE = "section_a_active"
    SECTION_A_COMPLETED = "section_a_completed"
    SECTION_B_PREPARING = "section_b_preparing"
    SECTION_B_ACTIVE = "section_b_active"
    COMPLETED = "completed"
    EVALUATING = "evaluating"
    EVALUATED = "evaluated"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    FAILED = "failed"


class ExamSectionType(str, Enum):
    """TEF oral exam section type."""

    SECTION_A = "section_a"
    SECTION_B = "section_b"


class SpeakingSectionState(str, Enum):
    """Lifecycle state of an individual exam section."""

    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    EXPIRED = "expired"


class SpeakingTurnSpeaker(str, Enum):
    """Speaker role for conversational turns."""

    EXAMINER = "examiner"
    CANDIDATE = "candidate"


class SpeakingTurnState(str, Enum):
    """Lifecycle state of a turn."""

    STARTED = "started"
    PROCESSING = "processing"
    COMPLETED = "completed"
    INTERRUPTED = "interrupted"


class ConversationState(str, Enum):
    """Realtime duplex conversation state for the active turn and audio transport."""

    IDLE = "idle"
    PREPARING = "preparing"
    EXAMINER_SPEAKING = "examiner_speaking"
    CANDIDATE_SPEAKING = "candidate_speaking"
    PROCESSING = "processing"
    WAITING_FOR_CANDIDATE = "waiting_for_candidate"
    SECTION_ENDING = "section_ending"
    COMPLETED = "completed"
    ERROR = "error"


class TranscriptStatus(str, Enum):
    """Status of transcript generation for a conversational turn."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    EMPTY = "empty"
