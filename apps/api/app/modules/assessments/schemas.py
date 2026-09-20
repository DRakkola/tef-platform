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
    estimated_completion_time_minutes: int = 40
    level: str = "B1-C1"
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
    estimated_completion_time_minutes: int = 40
    level: str = "B1-C1"
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
    client_timestamp: datetime.datetime | None = None


class PutAnswerRequest(BaseModel):
    """Payload for PUT /api/v1/attempts/{id}/answers/{question_id}."""

    selected_option_id: uuid.UUID | None = None
    selected_option_ids: list[uuid.UUID] = Field(default_factory=list)
    text_response: str | None = None
    client_timestamp: datetime.datetime | None = None


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
    assessment_version_id: uuid.UUID | None = None
    user_id: uuid.UUID
    student_id: uuid.UUID | None = None
    status: AttemptStatus
    started_at: datetime.datetime | None = None
    expires_at: datetime.datetime | None = None
    submitted_at: datetime.datetime | None = None
    remaining_seconds: int
    answers: list[AttemptAnswerStudentResponse] = []


class AttemptStateResponse(BaseModel):
    """Server-authoritative state for active attempt sync and reconnection."""

    attempt_id: uuid.UUID
    assessment_id: uuid.UUID
    assessment_version_id: uuid.UUID | None = None
    user_id: uuid.UUID
    student_id: uuid.UUID
    status: AttemptStatus
    started_at: datetime.datetime | None = None
    expires_at: datetime.datetime | None = None
    server_time: datetime.datetime
    remaining_seconds: int
    is_expired: bool
    answered_count: int
    total_questions: int
    answers: dict[str, str | list[str] | None] = Field(default_factory=dict)


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


class MistakeItemResponse(BaseModel):
    """Educational breakdown of an incorrectly answered question."""

    question_id: uuid.UUID
    prompt: str
    level: str
    points: int
    user_answer: str | None = None
    correct_answer: str | None = None
    explanation: str | None = None
    skill_name: str | None = None
    subskill: str | None = None


class RecommendedExerciseResultResponse(BaseModel):
    """Targeted exercise suggestion generated after grading."""

    id: uuid.UUID
    title: str
    category: str
    difficulty: int
    level: str
    target_skill_name: str
    reason: str
    priority: str = "medium"


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
    disclaimer: str = (
        "Ce résultat constitue une estimation indicative de performance basée sur notre algorithme de simulation. "
        "Il ne s'agit en aucun cas d'une attestation ou certification officielle TEF délivrée par la CCI Paris Île-de-France."
    )
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    mistakes: list[MistakeItemResponse] = Field(default_factory=list)
    recommended_exercises: list[RecommendedExerciseResultResponse] = Field(default_factory=list)


class ActiveAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assessment_id: uuid.UUID
    title: str
    assessment_type: AssessmentType
    level: str = "B1-C1"
    duration_seconds: int
    remaining_seconds: int
    started_at: datetime.datetime
    expires_at: datetime.datetime
    total_questions: int = 0
    answered_count: int = 0


class AttemptHistoryItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assessment_id: uuid.UUID
    title: str
    assessment_type: AssessmentType
    level: str = "B1-C1"
    score_percentage: float | None = None
    passed: bool | None = None
    estimated_level: str | None = None
    status: AttemptStatus
    started_at: datetime.datetime
    submitted_at: datetime.datetime | None = None
    duration_seconds: int | None = None


class AssessmentRecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    assessment_id: uuid.UUID
    title: str
    assessment_type: AssessmentType
    level: str = "B2"
    duration_seconds: int
    estimated_completion_time_minutes: int
    question_count: int = 0
    section_count: int = 0
    reason: str
    recommendation_type: str = "simulation"
