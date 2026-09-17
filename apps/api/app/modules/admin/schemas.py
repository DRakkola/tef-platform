"""Pydantic schemas for Admin Content Management, Media Assets, and Audit Logging."""

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.modules.admin.enums import AuditAction, ContentStatus, MediaType
from app.modules.assessments.enums import AssessmentType, NavigationPolicy, QuestionType, ScoringPolicy
from app.modules.learning.enums import SkillCategory
from app.modules.users.models import UserRole
from app.modules.writing.enums import WritingTaskType


# --- Audit Schemas ---
class AuditEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    actor_user_id: uuid.UUID | None
    action: str
    entity_type: str
    entity_id: uuid.UUID | None
    payload: dict[str, Any]
    ip_address: str | None
    user_agent: str | None
    created_at: datetime.datetime


class AuditLogListResponse(BaseModel):
    items: list[AuditEventResponse]
    total: int
    page: int
    page_size: int


# --- Media Asset Schemas ---
class MediaAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    filename: str
    content_type: str
    file_size: int
    storage_object_key: str
    media_type: MediaType
    is_public: bool
    uploaded_by_user_id: uuid.UUID | None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class MediaAssetListResponse(BaseModel):
    items: list[MediaAssetResponse]
    total: int
    page: int
    page_size: int


class MediaPresignedUrlResponse(BaseModel):
    asset_id: uuid.UUID
    download_url: str
    expires_in_seconds: int


# --- Question & Option Admin Schemas ---
class AdminOptionCreate(BaseModel):
    content: str
    order_index: int = 0
    is_correct: bool = False
    explanation: str | None = None


class AdminOptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question_id: uuid.UUID
    content: str
    order_index: int
    is_correct: bool
    explanation: str | None = None


class AdminQuestionSkillTagCreate(BaseModel):
    skill_id: uuid.UUID
    subskill: str | None = None
    weight: float = 1.0


class AdminQuestionCreate(BaseModel):
    question_type: QuestionType = QuestionType.SINGLE_CHOICE
    prompt: str
    stimulus_text: str | None = None
    audio_url: str | None = None
    media_url: str | None = None
    order_index: int = 0
    difficulty: int = 3
    explanation: str | None = None
    points: int = 1
    penalty_points: int = 0
    options: list[AdminOptionCreate] = Field(default_factory=list)
    skill_tags: list[AdminQuestionSkillTagCreate] = Field(default_factory=list)


class AdminQuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    section_id: uuid.UUID
    question_type: QuestionType
    prompt: str
    stimulus_text: str | None
    audio_url: str | None
    media_url: str | None
    order_index: int
    difficulty: int
    explanation: str | None
    points: int
    penalty_points: int
    options: list[AdminOptionResponse] = Field(default_factory=list)


# --- Section Admin Schemas ---
class AdminSectionCreate(BaseModel):
    title: str
    instructions: str | None = None
    order_index: int = 0
    time_limit_seconds: int | None = None


class AdminSectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assessment_id: uuid.UUID
    title: str
    instructions: str | None
    order_index: int
    time_limit_seconds: int | None
    questions: list[AdminQuestionResponse] = Field(default_factory=list)


# --- Assessment Admin Schemas ---
class AdminAssessmentCreate(BaseModel):
    title: str
    description: str | None = None
    assessment_type: AssessmentType
    duration_seconds: int = 3600
    navigation_policy: NavigationPolicy = NavigationPolicy.FREE
    scoring_policy: ScoringPolicy = ScoringPolicy.STANDARD_POINTS
    max_attempts: int | None = None
    pass_percentage: float | None = 60.0
    status: ContentStatus = ContentStatus.DRAFT


class AdminAssessmentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    duration_seconds: int | None = None
    navigation_policy: NavigationPolicy | None = None
    scoring_policy: ScoringPolicy | None = None
    max_attempts: int | None = None
    pass_percentage: float | None = None
    status: ContentStatus | None = None


class AdminAssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    assessment_type: AssessmentType
    duration_seconds: int
    navigation_policy: NavigationPolicy
    scoring_policy: ScoringPolicy
    max_attempts: int | None
    pass_percentage: float | None
    status: str
    version: int
    is_published: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    sections: list[AdminSectionResponse] = Field(default_factory=list)


class AdminAssessmentListResponse(BaseModel):
    items: list[AdminAssessmentResponse]
    total: int
    page: int
    page_size: int


# --- Skill Admin Schemas ---
class AdminSkillCreate(BaseModel):
    code: str
    name: str
    category: str | None = None
    description: str | None = None
    parent_id: uuid.UUID | None = None


class AdminSkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    category: str | None
    description: str | None
    parent_id: uuid.UUID | None
    created_at: datetime.datetime
    updated_at: datetime.datetime


# --- Exercise Admin Schemas ---
class AdminExerciseCreate(BaseModel):
    title: str
    prompt: str
    category: SkillCategory
    level: str = "B1"
    difficulty: int = 3
    question_type: QuestionType = QuestionType.SINGLE_CHOICE
    instructions: str | None = None
    explanation: str | None = None
    points: int = 10
    options_payload: list[dict[str, Any]] = Field(default_factory=list)
    status: ContentStatus = ContentStatus.DRAFT
    skill_ids: list[uuid.UUID] = Field(default_factory=list)


class AdminExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    prompt: str
    category: SkillCategory
    level: str
    difficulty: int
    question_type: QuestionType
    instructions: str | None
    explanation: str | None
    points: int
    options_payload: list[dict[str, Any]]
    status: str
    version: int
    is_published: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime


# --- Writing Task Admin Schemas ---
class AdminWritingTaskCreate(BaseModel):
    title: str
    task_type: WritingTaskType = WritingTaskType.SECTION_A
    prompt: str
    stimulus_text: str | None = None
    min_words: int = 80
    max_words: int = 120
    duration_minutes: int = 60
    target_level: str = "B2"
    status: ContentStatus = ContentStatus.DRAFT


class AdminWritingTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    task_type: WritingTaskType
    prompt: str
    stimulus_text: str | None
    min_words: int
    max_words: int
    duration_minutes: int
    target_level: str
    status: str
    version: int
    is_published: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime


# --- User Admin Schemas ---
class AdminUserRoleUpdate(BaseModel):
    role: UserRole


class AdminUserStatusUpdate(BaseModel):
    is_active: bool
