"""Pydantic request and response schemas for learning intelligence."""

import datetime
import uuid

from pydantic import BaseModel, ConfigDict

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
    category: SkillCategory | None = None
    mastery_score: float
    confidence: float
    attempts_count: int
    last_assessed_at: datetime.datetime


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
    recommendation_type: RecommendationType
    entity_type: str
    entity_id: uuid.UUID
    reason: str
    priority: int
    status: RecommendationStatus
    generated_at: datetime.datetime
