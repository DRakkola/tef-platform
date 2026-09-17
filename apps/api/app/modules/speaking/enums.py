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
