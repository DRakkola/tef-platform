"""Pydantic schemas for the generic assessment domain."""

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.modules.assessments.enums import (
    AssessmentType,
    AttemptStatus,
    NavigationPolicy,
    QuestionType,
    ScoringPolicy,
)

# ==========================================
# Student / In-Progress Taking Views
# (NO correct answers or explanations leaked)
# ==========================================


class QuestionOptionStudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    content: str
    order_index: int


class QuestionSkillTagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    skill_id: uuid.UUID
    subskill: str | None = None
    weight: float = 1.0


class QuestionStudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    section_id: uuid.UUID
    prompt: str
    question_type: QuestionType
    order_index: int
    level: str
    difficulty: int
    points: int
    media_url: str | None = None
    options: list[QuestionOptionStudentResponse] = []
    skill_tags: list[QuestionSkillTagResponse] = []


class AssessmentSectionStudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assessment_id: uuid.UUID
    title: str
    instructions: str | None = None
    order_index: int
    duration_seconds: int | None = None
    media_url: str | None = None
    passage_text: str | None = None
    questions: list[QuestionStudentResponse] = []


class AssessmentListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None = None
    assessment_type: AssessmentType
    duration_seconds: int
    navigation_policy: NavigationPolicy
    scoring_policy: ScoringPolicy
    max_attempts: int | None = None
    pass_percentage: float | None = None
    section_count: int = 0
    question_count: int = 0
    total_points: int = 0


class PaginatedAssessmentsResponse(BaseModel):
    items: list[AssessmentListItemResponse]
    total: int
    page: int
    page_size: int


class AssessmentDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None = None
    assessment_type: AssessmentType
    duration_seconds: int
    navigation_policy: NavigationPolicy
    scoring_policy: ScoringPolicy
    max_attempts: int | None = None
    pass_percentage: float | None = None
    sections: list[AssessmentSectionStudentResponse] = []


class AnswerSubmitRequest(BaseModel):
    """Payload for submitting or updating an answer within an attempt."""

    question_id: uuid.UUID
    selected_option_id: uuid.UUID | None = None
    selected_option_ids: list[uuid.UUID] = Field(default_factory=list)
    text_response: str | None = None


class AttemptAnswerStudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    attempt_id: uuid.UUID
    question_id: uuid.UUID
    selected_option_id: uuid.UUID | None = None
    selected_option_ids: list[str] = []
    text_response: str | None = None
    answered_at: datetime.datetime


class AttemptDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assessment_id: uuid.UUID
    user_id: uuid.UUID
    status: AttemptStatus
    started_at: datetime.datetime | None = None
    expires_at: datetime.datetime | None = None
    submitted_at: datetime.datetime | None = None
    remaining_seconds: int
    answers: list[AttemptAnswerStudentResponse] = []


# ==========================================
# Post-Submission Results Views
# (Full breakdown, explanations, scores)
# ==========================================


class QuestionOptionResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    content: str
    order_index: int
    is_correct: bool
    explanation: str | None = None


class AttemptAnswerResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question_id: uuid.UUID
    selected_option_id: uuid.UUID | None = None
    selected_option_ids: list[str] = []
    text_response: str | None = None
    is_correct: bool | None = None
    points_awarded: float = 0.0
    answered_at: datetime.datetime


class QuestionResultResponse(BaseModel):
    id: uuid.UUID
    section_id: uuid.UUID
    prompt: str
    question_type: QuestionType
    order_index: int
    level: str
    difficulty: int
    points: int
    explanation: str | None = None
    media_url: str | None = None
    options: list[QuestionOptionResultResponse] = []
    user_answer: AttemptAnswerResultResponse | None = None


class SectionResultResponse(BaseModel):
    id: uuid.UUID
    title: str
    instructions: str | None = None
    order_index: int
    passage_text: str | None = None
    media_url: str | None = None
    questions: list[QuestionResultResponse] = []


class AttemptScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    attempt_id: uuid.UUID
    total_points: float
    max_points: float
    percentage: float
    is_passed: bool | None = None
    estimated_level: str | None = None
    skill_scores: dict[str, Any] = {}
    scored_at: datetime.datetime


class AttemptResultsResponse(BaseModel):
    attempt_id: uuid.UUID
    assessment_id: uuid.UUID
    user_id: uuid.UUID
    status: AttemptStatus
    started_at: datetime.datetime | None = None
    expires_at: datetime.datetime | None = None
    submitted_at: datetime.datetime | None = None
    score: AttemptScoreResponse
    sections: list[SectionResultResponse] = []
