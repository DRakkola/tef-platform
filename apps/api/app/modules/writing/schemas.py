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
    """Payload sent by student editor while drafting."""

    content: str = Field(..., max_length=50000)


class WritingAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    user_id: uuid.UUID
    status: WritingAttemptStatus
    content: str
    word_count: int
    started_at: datetime.datetime
    expires_at: datetime.datetime
    remaining_seconds: int
    submitted_at: datetime.datetime | None = None


# ---------------------------------------------------------------------------
# Correction Schemas
# ---------------------------------------------------------------------------


class TeacherCorrectionRequest(BaseModel):
    """Payload submitted by a teacher when correcting a student submission."""

    score: float = Field(..., ge=0.0, le=100.0)
    estimated_level: str = Field(..., min_length=2, max_length=10)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    comments: str = Field(..., min_length=5)
    corrected_content: str | None = None
    recommendations: list[str] = Field(default_factory=list)


class WritingCorrectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    submission_id: uuid.UUID
    provider: CorrectionProviderType
    corrected_by_user_id: uuid.UUID | None = None
    score: float
    estimated_level: str
    strengths: list[str]
    weaknesses: list[str]
    comments: str
    corrected_content: str | None = None
    recommendations: list[str]
    created_at: datetime.datetime


# ---------------------------------------------------------------------------
# Submission Schemas
# ---------------------------------------------------------------------------


class WritingSubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    attempt_id: uuid.UUID
    task_id: uuid.UUID
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
    user_id: uuid.UUID
    assigned_teacher_id: uuid.UUID | None = None
    status: WritingSubmissionStatus
    word_count: int
    submitted_at: datetime.datetime
    content: str
    task: WritingTaskDetail
    correction: WritingCorrectionResponse | None = None
