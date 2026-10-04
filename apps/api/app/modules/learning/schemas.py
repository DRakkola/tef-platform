"""Pydantic request and response schemas for learning intelligence."""

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.modules.assessments.enums import QuestionType
from app.modules.learning.enums import (
    RecommendationStatus,
    RecommendationType,
    SkillCategory,
)


class StudentSkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    skill_id: uuid.UUID
    skill_code: str
    skill_name: str
    dimension: str | None = None
    domain: str | None = None
    category: SkillCategory | None = None
    mastery_score: float
    confidence: float
    confidence_label: str | None = None
    attempts_count: int
    successful_attempts: int = 0
    accuracy: float = 0.0
    recency_days: float | None = None
    evidence_count: int = 0
    estimated_level: str | None = None
    last_assessed_at: datetime.datetime
    descriptor: str | None = None


class SkillAssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    skill_id: uuid.UUID
    skill_code: str
    skill_name: str
    source_type: str
    source_id: uuid.UUID
    score: float
    points_earned: float
    points_possible: float
    estimated_level: str | None = None
    confidence: float = 0.0
    assessed_at: datetime.datetime


class MistakeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    skill_id: uuid.UUID
    skill_code: str
    skill_name: str
    subskill: str | None = None
    source_type: str
    source_id: uuid.UUID
    question_id: uuid.UUID | None = None
    exercise_id: uuid.UUID | None = None
    user_answer: str | None = None
    correct_answer: str | None = None
    explanation: str | None = None
    error_count: int
    last_occurred_at: datetime.datetime


class ExerciseOptionTakingView(BaseModel):
    content: str
    order_index: int


class ExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    instructions: str | None = None
    category: SkillCategory
    level: str
    difficulty: int
    question_type: QuestionType
    prompt: str
    points: int
    options: list[ExerciseOptionTakingView] = []
    skills: list[str] = []


class ExerciseAttemptRequest(BaseModel):
    selected_option_index: int | None = None
    user_response: str | None = None


class ExerciseAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    exercise_id: uuid.UUID
    is_correct: bool
    points_awarded: float
    user_response: str | None = None
    correct_answer: str | None = None
    explanation: str | None = None
    attempted_at: datetime.datetime


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    skill_id: uuid.UUID
    skill_code: str
    skill_name: str
    dimension: str | None = None
    domain: str | None = None
    applicable_modalities: list[str] = Field(default_factory=list)
    recommendation_type: RecommendationType
    entity_type: str
    entity_id: uuid.UUID
    title: str | None = None
    category: str | None = None
    level: str | None = None
    difficulty: int | None = None
    descriptor: str | None = None
    evidence_guidance: str | None = None
    reason: str
    priority: int
    priority_label: str | None = None
    status: RecommendationStatus
    generated_at: datetime.datetime
    expires_at: datetime.datetime | None = None


class RecommendationStatusUpdateRequest(BaseModel):
    status: RecommendationStatus


class RecommendationFeedbackRequest(BaseModel):
    relevance_rating: int = Field(..., ge=1, le=5, description="1 to 5 rating on recommendation relevance")
    reason: str | None = Field(None, max_length=500, description="Optional text feedback or reason")
    dismiss_recommendation: bool = Field(False, description="Whether to also dismiss this recommendation")


class RecommendationFeedbackResponse(BaseModel):
    recommendation_id: uuid.UUID
    relevance_rating: int
    reason: str | None = None
    status: RecommendationStatus
    message: str


class StudentActivityEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    event_type: str
    entity_type: str | None = None
    entity_id: uuid.UUID | None = None
    title: str
    metadata: dict[str, Any] = {}
    created_at: datetime.datetime


class ActivityListResponse(BaseModel):
    items: list[StudentActivityEventResponse]
    total: int
    limit: int
    offset: int


class PrioritySkillDeficit(BaseModel):
    skill_id: uuid.UUID
    skill_name: str
    category: str
    current_score: float
    deficit: float
    attempts_count: int


class TargetGapResponse(BaseModel):
    target_exam: str
    target_cefr_level: str
    target_nclc_level: str
    target_date: str | None = None
    days_remaining: int | None = None
    urgency: str
    current_score: float
    current_cefr_level: str
    current_nclc_level: str
    target_threshold_score: float
    score_gap: float
    level_distance: int
    is_target_met: bool
    priority_deficits: list[PrioritySkillDeficit] = []
    disclaimer: str


class TargetUpdateRequest(BaseModel):
    target_exam: str | None = None
    target_cefr_level: str | None = None
    target_nclc_level: str | None = None
    target_date: datetime.date | None = None


class DailyTaskItem(BaseModel):
    id: str
    title: str
    description: str
    task_type: str
    target_entity_id: uuid.UUID | None = None
    estimated_minutes: int
    priority: str
    is_completed: bool


class DailyPlanResponse(BaseModel):
    date: str
    daily_minutes_available: int = 30
    total_tasks: int
    completed_tasks: int
    completion_percentage: float
    estimated_minutes_total: int
    total_estimated_minutes: int = 0
    tasks: list[DailyTaskItem]


class SkillTrajectoryItem(BaseModel):
    skill_id: uuid.UUID
    skill_name: str
    category: str
    mastery_score: float
    confidence: float
    confidence_label: str
    insufficient_data: bool
    previous_score: float | None = None
    change: float | None = None
    trend: str
    attempts_count: int
    last_assessed_at: datetime.datetime | None = None


class StrengthsWeaknessesResponse(BaseModel):
    strongest_skills: list[SkillTrajectoryItem] = []
    weakest_skills: list[SkillTrajectoryItem] = []
    improving_skills: list[SkillTrajectoryItem] = []
    declining_skills: list[SkillTrajectoryItem] = []
    calibrating_skills: list[SkillTrajectoryItem] = []
    total_tracked: int = 0

