"""Pydantic schemas for Admin Content Management, Media Assets, Versioning, and Audit Logging."""

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.modules.admin.enums import ContentStatus, MediaType, ReviewStatus
from app.modules.assessments.enums import (
    AssessmentType,
    NavigationPolicy,
    QuestionType,
    ScoringPolicy,
)
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
    bucket: str = "tef-private"
    checksum: str | None = None
    duration_seconds: float | None = None
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


# --- SubSkill & Skill Schemas ---
class SubSkillCreate(BaseModel):
    code: str
    name: str
    description: str | None = None


class SubSkillUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    description: str | None = None


class SubSkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    skill_id: uuid.UUID
    code: str
    name: str
    description: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class SkillUsageCounts(BaseModel):
    questions: int = 0
    exercises: int = 0
    assessments: int = 0
    student_mastery: int = 0
    skill_assessments: int = 0
    skill_evidence: int = 0
    writing_evaluations: int = 0
    speaking_evaluations: int = 0
    total_dependencies: int = 0


class AdminSkillCreate(BaseModel):
    code: str
    name: str
    category: str | None = None
    description: str | None = None
    parent_id: uuid.UUID | None = None
    is_active: bool = True


class AdminSkillUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    category: str | None = None
    description: str | None = None
    is_active: bool | None = None


class AdminSkillResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    category: str | None = None
    description: str | None = None
    parent_id: uuid.UUID | None = None
    is_active: bool = True
    created_at: datetime.datetime
    updated_at: datetime.datetime
    subskills: list[SubSkillResponse] = Field(default_factory=list)
    usage_counts: SkillUsageCounts = Field(default_factory=SkillUsageCounts)


class AdminSkillMetricsSummary(BaseModel):
    total_skills: int
    total_subskills: int
    domains_count: int
    domain_breakdown: dict[str, int] = Field(default_factory=dict)
    taxonomy_warnings_count: int = 0
    issues: list[dict[str, Any]] = Field(default_factory=list)


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
    role: str = "primary"  # SkillTagRole.PRIMARY
    subskill_id: uuid.UUID | None = None
    subskill: str | None = None  # Deprecated: use subskill_id
    weight: float = 1.0
    context: dict | None = None


class AdminExerciseSkillTagCreate(BaseModel):
    skill_id: uuid.UUID
    role: str = "primary"  # SkillTagRole.PRIMARY
    subskill_id: uuid.UUID | None = None
    subskill: str | None = None  # Deprecated: use subskill_id
    weight: float = 1.0
    context: dict | None = None


class AdminQuestionCreate(BaseModel):
    question_type: QuestionType = QuestionType.SINGLE_CHOICE
    prompt: str
    stimulus_text: str | None = None
    audio_url: str | None = None
    media_url: str | None = None
    order_index: int = 0
    difficulty: int = 3
    level: str = "B1"
    explanation: str | None = None
    points: int = 1
    penalty_points: int = 0
    task_type_id: uuid.UUID | None = None
    options: list[AdminOptionCreate] = Field(default_factory=list)
    skill_tags: list[AdminQuestionSkillTagCreate] = Field(default_factory=list)


class AdminStandaloneQuestionCreate(BaseModel):
    section_id: uuid.UUID
    question_type: QuestionType = QuestionType.SINGLE_CHOICE
    prompt: str
    stimulus_text: str | None = None
    audio_url: str | None = None
    media_url: str | None = None
    order_index: int = 0
    difficulty: int = 3
    level: str = "B1"
    explanation: str | None = None
    points: int = 1
    penalty_points: int = 0
    task_type_id: uuid.UUID | None = None
    options: list[AdminOptionCreate] = Field(default_factory=list)
    skill_tags: list[AdminQuestionSkillTagCreate] = Field(default_factory=list)


class AdminStandaloneQuestionUpdate(BaseModel):
    prompt: str | None = None
    question_type: QuestionType | None = None
    difficulty: int | None = None
    level: str | None = None
    explanation: str | None = None
    points: int | None = None
    penalty_points: int | None = None
    media_url: str | None = None
    order_index: int | None = None
    status: ContentStatus | None = None
    task_type_id: uuid.UUID | None = None
    options: list[AdminOptionCreate] | None = None
    skill_tags: list[AdminQuestionSkillTagCreate] | None = None


class AdminQuestionSkillTagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    skill_id: uuid.UUID
    subskill_id: uuid.UUID | None = None
    subskill: str | None = None
    role: str = "primary"
    weight: float = 1.0
    context: dict | None = None


class AdminQuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    section_id: uuid.UUID
    question_type: QuestionType
    prompt: str
    stimulus_text: str | None = None
    audio_url: str | None = None
    media_url: str | None = None
    order_index: int
    difficulty: int
    level: str = "B1"
    explanation: str | None = None
    points: int
    penalty_points: int
    status: str = "published"
    version: int = 1
    task_type_id: uuid.UUID | None = None
    created_by_user_id: uuid.UUID | None = None
    updated_by_user_id: uuid.UUID | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    options: list[AdminOptionResponse] = Field(default_factory=list)
    skill_tags: list[AdminQuestionSkillTagResponse] = Field(default_factory=list)


class AdminQuestionListResponse(BaseModel):
    items: list[AdminQuestionResponse]
    total: int
    page: int
    page_size: int


# --- Section Admin Schemas ---
class AdminSectionCreate(BaseModel):
    title: str
    instructions: str | None = None
    order_index: int = 0
    time_limit_seconds: int | None = None
    media_url: str | None = None
    passage_text: str | None = None


class AdminSectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assessment_id: uuid.UUID
    title: str
    instructions: str | None = None
    order_index: int
    duration_seconds: int | None = None
    time_limit_seconds: int | None = None
    media_url: str | None = None
    passage_text: str | None = None
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
    description: str | None = None
    assessment_type: AssessmentType
    duration_seconds: int
    navigation_policy: NavigationPolicy
    scoring_policy: ScoringPolicy
    max_attempts: int | None = None
    pass_percentage: float | None = None
    status: str
    version: int
    is_published: bool
    created_by_user_id: uuid.UUID | None = None
    updated_by_user_id: uuid.UUID | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    sections: list[AdminSectionResponse] = Field(default_factory=list)


class AdminAssessmentListResponse(BaseModel):
    items: list[AdminAssessmentResponse]
    total: int
    page: int
    page_size: int


# --- Version History Snapshots ---
class AssessmentVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assessment_id: uuid.UUID
    version: int
    title: str
    description: str | None = None
    assessment_type: str
    duration_seconds: int
    navigation_policy: str
    scoring_policy: str
    pass_percentage: float | None = None
    sections_snapshot: list[dict[str, Any]] = Field(default_factory=list)
    created_by_user_id: uuid.UUID | None = None
    created_at: datetime.datetime


class QuestionVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question_id: uuid.UUID
    version: int
    prompt: str
    explanation: str | None = None
    question_type: str
    difficulty: int
    level: str
    points: int
    options_snapshot: list[dict[str, Any]] = Field(default_factory=list)
    media_asset_id: uuid.UUID | None = None
    created_by_user_id: uuid.UUID | None = None
    created_at: datetime.datetime


class ExerciseVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    exercise_id: uuid.UUID
    version: int
    title: str
    instructions: str | None = None
    category: str
    level: str
    difficulty: int
    prompt: str
    explanation: str | None = None
    points: int
    options_payload: list[dict[str, Any]] = Field(default_factory=list)
    created_by_user_id: uuid.UUID | None = None
    created_at: datetime.datetime


class WritingTaskVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    writing_task_id: uuid.UUID
    version: int
    title: str
    instructions: str | None = None
    prompt: str
    task_type: str
    level: str
    min_words: int
    max_words: int
    duration_minutes: int
    evaluation_criteria: list[dict[str, Any]] = Field(default_factory=list)
    created_by_user_id: uuid.UUID | None = None
    created_at: datetime.datetime


# --- Content Review Schemas ---
class ContentReviewCreate(BaseModel):
    comments: str | None = None


class ContentReviewDecision(BaseModel):
    status: ReviewStatus  # APPROVED or REJECTED
    comments: str | None = None


class ContentReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    version: int
    reviewer_id: uuid.UUID | None = None
    status: str
    comments: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class ContentReviewListResponse(BaseModel):
    items: list[ContentReviewResponse]
    total: int
    page: int
    page_size: int


# --- Publishing Validation Engine Schemas ---
class ValidationIssue(BaseModel):
    field: str
    message: str
    severity: str = "error"  # "error" or "warning"


class PublishValidationResponse(BaseModel):
    is_valid: bool
    errors: list[ValidationIssue] = Field(default_factory=list)
    warnings: list[ValidationIssue] = Field(default_factory=list)


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
    task_type_id: uuid.UUID | None = None
    skill_ids: list[uuid.UUID] = Field(default_factory=list)  # Deprecated: use skill_tags
    skill_tags: list[AdminExerciseSkillTagCreate] = Field(default_factory=list)


class AdminExerciseUpdate(BaseModel):
    title: str | None = None
    prompt: str | None = None
    category: SkillCategory | None = None
    level: str | None = None
    difficulty: int | None = None
    question_type: QuestionType | None = None
    instructions: str | None = None
    explanation: str | None = None
    points: int | None = None
    options_payload: list[dict[str, Any]] | None = None
    status: ContentStatus | None = None
    task_type_id: uuid.UUID | None = None
    skill_ids: list[uuid.UUID] | None = None  # Deprecated: use skill_tags
    skill_tags: list[AdminExerciseSkillTagCreate] | None = None


class AdminExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    prompt: str
    category: SkillCategory
    level: str
    difficulty: int
    question_type: QuestionType
    instructions: str | None = None
    explanation: str | None = None
    points: int
    options_payload: list[dict[str, Any]]
    status: str
    version: int
    is_published: bool
    created_by_user_id: uuid.UUID | None = None
    updated_by_user_id: uuid.UUID | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class AdminExerciseListResponse(BaseModel):
    items: list[AdminExerciseResponse]
    total: int
    page: int
    page_size: int


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
    evaluation_criteria: list[dict[str, Any]] = Field(default_factory=list)


class AdminWritingTaskUpdate(BaseModel):
    title: str | None = None
    task_type: WritingTaskType | None = None
    prompt: str | None = None
    stimulus_text: str | None = None
    min_words: int | None = None
    max_words: int | None = None
    duration_minutes: int | None = None
    target_level: str | None = None
    status: ContentStatus | None = None
    evaluation_criteria: list[dict[str, Any]] | None = None


class AdminWritingTaskResponse(BaseModel):
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
    status: str
    version: int
    is_published: bool
    created_by_user_id: uuid.UUID | None = None
    updated_by_user_id: uuid.UUID | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class AdminWritingTaskListResponse(BaseModel):
    items: list[AdminWritingTaskResponse]
    total: int
    page: int
    page_size: int


# --- User Admin Schemas ---
class AdminUserRoleUpdate(BaseModel):
    role: UserRole


class AdminUserStatusUpdate(BaseModel):
    is_active: bool


# --- Taxonomy V2 Schemas Re-export ---
from app.modules.admin.taxonomy_schemas import (  # noqa: F401
    AdminSkillSummaryResponse,
    SkillLevelDescriptorCreate,
    SkillLevelDescriptorResponse,
    SkillLevelDescriptorUpdate,
    SkillRelationCreate,
    SkillRelationResponse,
    SkillRelationsListResponse,
    TaskTypeCreate,
    TaskTypeResponse,
    TaskTypeUpdate,
    TaxonomyChildSkillCreate,
    TaxonomyMetadataResponse,
    TaxonomyMetricsSummary,
    TaxonomyReparentRequest,
    TaxonomySkillCreate,
    TaxonomySkillDetailResponse,
    TaxonomySkillListItemResponse,
    TaxonomySkillListResponse,
    TaxonomySkillUpdate,
    TaxonomyTreeNodeResponse,
    TaxonomyVersionCreate,
    TaxonomyVersionResponse,
    TaxonomyVersionUpdate,
)
