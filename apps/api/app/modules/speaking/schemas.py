"""Pydantic schemas for speaking sessions, participants, WebRTC signaling, and evaluations."""

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.modules.speaking.enums import (
    SpeakingEvaluatorType,
    SpeakingParticipantRole,
    SpeakingSessionState,
    SpeakingSessionType,
)


class SpeakingSessionCreate(BaseModel):
    """Payload to schedule or start a speaking session."""

    session_type: SpeakingSessionType = SpeakingSessionType.AI
    topic: str = Field(
        default="TEF Expression Orale — Épreuve d'entraînement",
        max_length=255,
        description="Exam topic or simulation scenario",
    )
    level: str = Field(default="B2", max_length=10, description="CEFR level (A1-C2)")
    duration_minutes: int = Field(
        default=25, ge=5, le=60, description="Session duration in minutes (default 25)"
    )
    booking_id: uuid.UUID | None = Field(
        default=None, description="Optional teacher booking reference"
    )


class SpeakingParticipantResponse(BaseModel):
    """Participant information in a speaking session."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None = None
    role: SpeakingParticipantRole
    display_name: str
    is_connected: bool
    joined_at: datetime.datetime | None = None


class SpeakingEvaluationSkillResponse(BaseModel):
    """Granular skill score attached to speaking evaluation."""

    model_config = ConfigDict(from_attributes=True)

    skill_id: uuid.UUID
    score: float
    notes: str | None = None


class SpeakingEvaluationResponse(BaseModel):
    """Structured post-session evaluation."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    student_id: uuid.UUID
    evaluator_user_id: uuid.UUID | None = None
    evaluator_type: SpeakingEvaluatorType
    estimated_level: str
    fluency: float
    vocabulary: float
    grammar: float
    coherence: float
    pronunciation: float
    overall_score: float
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    detailed_feedback: str | None = None
    is_official_tef: bool = False
    created_at: datetime.datetime


class SpeakingSessionResponse(BaseModel):
    """Summary of speaking session."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_type: SpeakingSessionType
    status: SpeakingSessionState
    topic: str
    level: str
    duration_minutes: int
    starts_at: datetime.datetime | None = None
    expires_at: datetime.datetime | None = None
    remaining_seconds: int | None = None
    room_id: str
    participants: list[SpeakingParticipantResponse] = Field(default_factory=list)
    created_at: datetime.datetime


class SpeakingSessionDetailResponse(SpeakingSessionResponse):
    """Full speaking session details including ICE server candidates."""

    ice_servers: list[dict[str, Any]] = Field(default_factory=list)
    evaluation: SpeakingEvaluationResponse | None = None


class SpeakingSessionListResponse(BaseModel):
    """List of speaking sessions."""

    items: list[SpeakingSessionResponse]
    total: int


class TeacherEvaluationCreate(BaseModel):
    """Payload for teacher submitting evaluation for speaking session."""

    estimated_level: str = Field(default="B2", max_length=10)
    fluency: float = Field(..., ge=0.0, le=100.0)
    vocabulary: float = Field(..., ge=0.0, le=100.0)
    grammar: float = Field(..., ge=0.0, le=100.0)
    coherence: float = Field(..., ge=0.0, le=100.0)
    pronunciation: float = Field(..., ge=0.0, le=100.0)
    overall_score: float = Field(..., ge=0.0, le=100.0)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    detailed_feedback: str | None = Field(None, max_length=5000)
