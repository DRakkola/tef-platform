"""Pydantic schemas for speaking sessions, participants, WebRTC signaling, and evaluations."""

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.speaking.enums import (
    ConversationState,
    ExamSectionType,
    SpeakingEvaluatorType,
    SpeakingExamState,
    SpeakingParticipantRole,
    SpeakingSectionState,
    SpeakingSessionState,
    SpeakingSessionType,
    SpeakingTurnSpeaker,
    SpeakingTurnState,
    TranscriptStatus,
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
    session_id: uuid.UUID | None = None
    exam_id: uuid.UUID | None = None
    student_id: uuid.UUID
    evaluator_user_id: uuid.UUID | None = None
    evaluator_type: SpeakingEvaluatorType
    evaluator_model: str | None = None
    evaluation_version: str | None = None
    evaluation_prompt: str | None = None
    evidence_snapshot: dict[str, Any] | None = None
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
    exam_id: uuid.UUID | None = None
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


class SpeakingTurnResponse(BaseModel):
    """Conversational exchange turn."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    section_id: uuid.UUID
    turn_number: int
    speaker: SpeakingTurnSpeaker
    state: SpeakingTurnState
    content_text: str | None = None
    transcript_status: TranscriptStatus = TranscriptStatus.COMPLETED
    audio_storage_key: str | None = None
    audio_key: str | None = None
    audio_duration_seconds: float | None = None
    duration_seconds: float | None = None
    interrupted: bool = False
    interruption_reason: str | None = None
    transcription_confidence: float | None = None
    turn_metadata: dict[str, Any] | None = None
    started_at: datetime.datetime
    completed_at: datetime.datetime | None = None
    client_turn_id: str | None = None

    @model_validator(mode="after")
    def populate_turn_aliases(self) -> SpeakingTurnResponse:
        if self.audio_key is None and self.audio_storage_key is not None:
            self.audio_key = self.audio_storage_key
        elif self.audio_storage_key is None and self.audio_key is not None:
            self.audio_storage_key = self.audio_key

        if self.duration_seconds is None and self.audio_duration_seconds is not None:
            self.duration_seconds = self.audio_duration_seconds
        elif self.audio_duration_seconds is None and self.duration_seconds is not None:
            self.audio_duration_seconds = self.duration_seconds

        return self


class SpeakingTurnCreate(BaseModel):
    """Payload to record or finalize a turn."""

    speaker: SpeakingTurnSpeaker
    content_text: str | None = None
    transcript_status: TranscriptStatus = TranscriptStatus.COMPLETED
    audio_storage_key: str | None = None
    audio_key: str | None = None
    audio_duration_seconds: float | None = None
    duration_seconds: float | None = None
    interrupted: bool = False
    interruption_reason: str | None = None
    transcription_confidence: float | None = None
    turn_metadata: dict[str, Any] | None = None
    client_turn_id: str | None = None


class SpeakingTurnAudioResponse(BaseModel):
    """Response containing temporary presigned audio download URL."""

    audio_url: str
    expires_in: int = 3600
    audio_storage_key: str


class SpeakingSectionResponse(BaseModel):
    """Section task information with duration, status, and turn exchanges."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    exam_id: uuid.UUID
    section_type: ExamSectionType
    sequence: int
    title: str
    description: str | None = None
    prompt_topic: str
    topic: str | None = None
    prompt_context: str | None = None
    examiner_persona: str
    duration_seconds: int
    target_duration_seconds: int | None = None
    status: SpeakingSectionState
    state: SpeakingSectionState | None = None
    started_at: datetime.datetime | None = None
    expires_at: datetime.datetime | None = None
    completed_at: datetime.datetime | None = None
    remaining_seconds: int | None = None
    turns: list[SpeakingTurnResponse] = Field(default_factory=list)

    @model_validator(mode="after")
    def populate_section_aliases(self) -> SpeakingSectionResponse:
        if self.topic is None:
            self.topic = self.prompt_topic
        if self.target_duration_seconds is None:
            self.target_duration_seconds = self.duration_seconds
        if self.state is None:
            self.state = self.status
        return self


class SpeakingExamCreate(BaseModel):
    """Payload to create a structured TEF Speaking Exam."""

    topic: str | None = Field(
        default="TEF Expression Orale — Épreuve Officielle Simulée",
        max_length=255,
        description="Exam scenario title",
    )
    title: str | None = None
    target_level: str = Field(default="B2", max_length=10, description="Target CEFR level")
    level: str | None = None
    section_a_topic: str | None = Field(
        default=None,
        description="Optional custom topic for Section A (demande d'informations)",
    )
    topic_a: str | None = None
    section_b_topic: str | None = Field(
        default=None,
        description="Optional custom topic for Section B (argumentation et persuasion)",
    )
    topic_b: str | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if data.get("title") and (not data.get("topic") or data.get("topic") == "TEF Expression Orale — Épreuve Officielle Simulée"):
                data["topic"] = data["title"]
            if data.get("level") and not data.get("target_level"):
                data["target_level"] = data["level"]
            if data.get("topic_a") and not data.get("section_a_topic"):
                data["section_a_topic"] = data["topic_a"]
            if data.get("topic_b") and not data.get("section_b_topic"):
                data["section_b_topic"] = data["topic_b"]
        return data


class SpeakingExamResponse(BaseModel):
    """Full detail of a structured TEF Speaking Exam."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    student_id: uuid.UUID
    session_id: uuid.UUID | None = None
    status: SpeakingExamState
    state: SpeakingExamState | None = None
    current_section_type: ExamSectionType | None = None
    active_section: ExamSectionType | None = None
    topic: str
    title: str | None = None
    target_level: str
    level: str | None = None
    total_duration_minutes: int
    started_at: datetime.datetime | None = None
    completed_at: datetime.datetime | None = None
    room_id: str | None = None
    sections: list[SpeakingSectionResponse] = Field(default_factory=list)
    evaluation: SpeakingEvaluationResponse | None = None
    created_at: datetime.datetime

    @model_validator(mode="after")
    def populate_response_aliases(self) -> SpeakingExamResponse:
        if self.state is None:
            self.state = self.status
        if self.active_section is None:
            self.active_section = self.current_section_type
        if self.title is None:
            self.title = self.topic
        if self.level is None:
            self.level = self.target_level
        return self


class SpeakingExamStateResponse(BaseModel):
    """Realtime authoritative status, active section, timing, and conversation state."""

    exam_id: uuid.UUID
    status: SpeakingExamState
    state: SpeakingExamState | None = None
    current_section_type: ExamSectionType | None = None
    active_section: ExamSectionType | None = None
    current_section: SpeakingSectionResponse | None = None
    conversation_state: ConversationState
    remaining_section_seconds: int
    active_section_remaining_seconds: int | None = None
    prep_remaining_seconds: int | None = None
    total_remaining_seconds: int
    can_submit_turn: bool
    can_advance_section: bool

    @model_validator(mode="after")
    def populate_state_aliases(self) -> SpeakingExamStateResponse:
        if self.state is None:
            self.state = self.status
        if self.active_section is None:
            self.active_section = self.current_section_type
        if self.active_section_remaining_seconds is None:
            self.active_section_remaining_seconds = self.remaining_section_seconds
        return self


class SpeakingExamListResponse(BaseModel):
    """Paginated list of student speaking exams."""

    items: list[SpeakingExamResponse]
    total: int

