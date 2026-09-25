"""Pydantic request and response schemas for the writing assessment module."""

import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.modules.writing.enums import (
    CorrectionProviderType,
    WritingAttemptStatus,
    WritingSubmissionStatus,
    WritingTaskType,
)

# ---------------------------------------------------------------------------
# Task Schemas
# ---------------------------------------------------------------------------


class WritingTaskListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    task_type: WritingTaskType
    min_words: int
    max_words: int
    duration_minutes: int
    target_level: str


class WritingTaskDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    task_type: WritingTaskType
    prompt: str
    stimulus_text: str | None = None
    min_words: int
    max_words: int
    duration_minutes: int
    target_level: str


# ---------------------------------------------------------------------------
# Attempt Schemas
# ---------------------------------------------------------------------------


class WritingAttemptDraftUpdate(BaseModel):
    """Payload sent by student editor while drafting.
    Includes client revision_number for stale revision rejection.
    """

    revision_number: int = Field(default=0, ge=0, description="Sequential revision number from editor (0 for auto-assign)")
    content: str = Field(..., max_length=50000)
    word_count: int | None = None


class WritingDraftRevisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    attempt_id: uuid.UUID
    revision_number: int
    content: str
    word_count: int
    created_at: datetime.datetime


class WritingAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    writing_task_version_id: uuid.UUID | None = None
    user_id: uuid.UUID
    status: WritingAttemptStatus
    content: str
    word_count: int
    current_revision: int = 0
    started_at: datetime.datetime
    expires_at: datetime.datetime
    remaining_seconds: int
    submitted_at: datetime.datetime | None = None
    task: WritingTaskDetail | None = None


# ---------------------------------------------------------------------------
# Correction Schemas
# ---------------------------------------------------------------------------


class CorrectionItemCreate(BaseModel):
    original_text: str = Field(..., min_length=1)
    corrected_text: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1, max_length=50, description="grammar, spelling, vocabulary, register, syntax")
    explanation: str = Field(..., min_length=1)
    skill_id: uuid.UUID | None = None


class CorrectionItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    correction_id: uuid.UUID
    original_text: str
    corrected_text: str
    category: str
    explanation: str
    skill_id: uuid.UUID | None = None
    created_at: datetime.datetime


class CorrectionSkillCreate(BaseModel):
    skill_id: uuid.UUID
    score: float = Field(..., ge=0.0, le=100.0)
    level: str = Field(..., min_length=2, max_length=20)
    feedback: str = Field(default="")


class CorrectionSkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    correction_id: uuid.UUID
    skill_id: uuid.UUID
    score: float
    level: str
    feedback: str
    created_at: datetime.datetime


class TeacherCorrectionRequest(BaseModel):
    """Payload submitted by a teacher when correcting a student submission."""

    model_config = ConfigDict(populate_by_name=True)

    score: float = Field(..., ge=0.0, le=100.0)
    estimated_level: str = Field(..., min_length=2, max_length=10)
    task_completion: float | None = Field(None, ge=0.0, le=100.0)
    coherence: float | None = Field(None, ge=0.0, le=100.0)
    vocabulary: float | None = Field(None, ge=0.0, le=100.0)
    grammar: float | None = Field(None, ge=0.0, le=100.0)
    syntax: float | None = Field(None, ge=0.0, le=100.0)
    spelling: float | None = Field(None, ge=0.0, le=100.0)
    language_register: float | None = Field(None, ge=0.0, le=100.0, alias="register")
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    comments: str = Field(..., min_length=5)
    corrected_content: str | None = None
    recommendations: list[str] = Field(default_factory=list)
    items: list[CorrectionItemCreate] = Field(default_factory=list)
    skills: list[CorrectionSkillCreate] = Field(default_factory=list)

    @property
    def register(self) -> float | None:
        return self.language_register


class WritingCorrectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    submission_id: uuid.UUID
    provider: CorrectionProviderType
    corrected_by_user_id: uuid.UUID | None = None
    status: str = "submitted"
    score: float
    estimated_level: str
    task_completion: float | None = None
    coherence: float | None = None
    vocabulary: float | None = None
    grammar: float | None = None
    spelling: float | None = None
    language_register: float | None = Field(None, alias="register")
    strengths: list[str]
    weaknesses: list[str]
    comments: str
    corrected_content: str | None = None
    recommendations: list[str]
    items: list[CorrectionItemResponse] = Field(default_factory=list)
    skills: list[CorrectionSkillResponse] = Field(default_factory=list)
    is_simulated: bool = True
    disclaimer: str = "Simulation score only. Not an official TEF score."
    created_at: datetime.datetime

    @property
    def register(self) -> float | None:
        return self.language_register


# ---------------------------------------------------------------------------
# Assignment & Submission Schemas
# ---------------------------------------------------------------------------


class WritingAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    submission_id: uuid.UUID
    teacher_id: uuid.UUID
    status: str
    assigned_at: datetime.datetime
    claimed_at: datetime.datetime | None = None
    completed_at: datetime.datetime | None = None


class WritingSubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    attempt_id: uuid.UUID
    task_id: uuid.UUID
    writing_task_version_id: uuid.UUID | None = None
    user_id: uuid.UUID
    assigned_teacher_id: uuid.UUID | None = None
    status: WritingSubmissionStatus
    word_count: int
    submitted_at: datetime.datetime
    correction: WritingCorrectionResponse | None = None


class WritingSubmissionDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    attempt_id: uuid.UUID
    task_id: uuid.UUID
    writing_task_version_id: uuid.UUID | None = None
    user_id: uuid.UUID
    assigned_teacher_id: uuid.UUID | None = None
    status: WritingSubmissionStatus
    word_count: int
    submitted_at: datetime.datetime
    content: str
    task: WritingTaskDetail
    correction: WritingCorrectionResponse | None = None


class WritingResultResponse(BaseModel):
    """Returned on /writing/attempts/:id/result."""

    attempt_id: uuid.UUID
    submission_id: uuid.UUID
    status: WritingSubmissionStatus
    word_count: int
    submitted_at: datetime.datetime
    task: WritingTaskDetail
    content: str
    correction: WritingCorrectionResponse | None = None
    is_simulated: bool = True
    disclaimer: str = "Simulation score only. Not an official TEF score."
