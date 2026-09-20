"""Pydantic schemas for the TEF Readiness Engine and Adaptive Learning Engine."""

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ReadinessProfileResponse(BaseModel):
    """Authoritative student readiness evaluation summary."""

    model_config = ConfigDict(from_attributes=True)

    student_id: uuid.UUID
    target_exam: str = "TEF Canada"
    target_level: str = "B2"
    target_date: str | None = None
    days_remaining: int | None = None
    urgency: str = "none"
    overall_estimate: float | None = None
    estimated_level: str | None = None
    confidence: float
    confidence_label: str
    readiness_band: str
    summary_skills: dict[str, Any] = Field(default_factory=dict)
    summary_gaps: list[dict[str, Any]] = Field(default_factory=list)
    summary_blockers: list[dict[str, Any]] = Field(default_factory=list)
    last_calculated_at: datetime.datetime
    calculation_version: str = "v1.0.0"
    disclaimer: str = (
        "Cette estimation indicative reflète les observations d'entraînement internes "
        "et ne constitue pas une certification officielle TEF délivrée par la CCI Paris Île-de-France."
    )


class SkillEstimateResponse(BaseModel):
    """Granular linguistic skill estimate with confidence and explainability."""

    model_config = ConfigDict(from_attributes=True)

    skill_id: uuid.UUID
    skill_code: str
    skill_name: str
    category: str
    estimate: float | None = None
    estimated_level: str | None = None
    confidence: float
    confidence_label: str
    insufficient_data: bool
    observation_count: int
    trend: str
    last_observed_at: datetime.datetime | None = None
    sources_summary: dict[str, int] = Field(default_factory=dict)
    explanation: str


class TargetGapResponse(BaseModel):
    """Gap analysis between current estimated mastery and target exam threshold."""

    model_config = ConfigDict(from_attributes=True)

    skill_id: uuid.UUID
    skill_name: str
    category: str
    current_estimate: float | None = None
    target_estimate: float
    gap: float
    confidence: float
    priority: int
    urgency: str
    explanation: str


class BlockingSkillResponse(BaseModel):
    """Competency materially limiting student progress toward target."""

    model_config = ConfigDict(from_attributes=True)

    skill_id: uuid.UUID
    skill_name: str
    category: str
    current_estimate: float | None = None
    target_estimate: float
    gap: float
    confidence: float
    priority: int
    blocker_reason: str
    recommended_action: str


class SkillTrendResponse(BaseModel):
    """Historical progression trend across time windows and learning velocity."""

    model_config = ConfigDict(from_attributes=True)

    skill_id: uuid.UUID
    skill_name: str
    category: str
    trend_7d: str
    trend_30d: str
    trend_90d: str
    trend_all_time: str
    score_change_per_week: float | None = None
    level_change_estimate: str | None = None
    data_points_count: int
    sufficient_data_for_velocity: bool


class SkillEvidenceResponse(BaseModel):
    """Granular observation from the immutable append-only evidence stream."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    skill_id: uuid.UUID
    skill_name: str
    source_type: str
    source_id: uuid.UUID
    raw_score: float
    normalized_score: float
    confidence: float
    weight: float
    observed_at: datetime.datetime
    calculation_version: str


class ReadinessSnapshotResponse(BaseModel):
    """Historical snapshot record for auditability and timeline comparison."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    overall_estimate: float | None = None
    estimated_level: str | None = None
    confidence: float
    confidence_label: str
    readiness_band: str
    calculation_version: str
    generated_at: datetime.datetime
    skills_count: int = 0
    blockers_count: int = 0


class LearningPathMilestoneResponse(BaseModel):
    """Milestone step on the student's personalized learning path."""

    milestone_number: int
    title: str
    description: str
    focus_skills: list[str] = Field(default_factory=list)
    suggested_activities: list[dict[str, Any]] = Field(default_factory=list)
    is_completed: bool = False


class LearningPathResponse(BaseModel):
    """Adaptive learning path toward target exam goals."""

    target_exam: str
    target_level: str
    current_estimated_level: str | None = None
    readiness_band: str
    milestones: list[LearningPathMilestoneResponse] = Field(default_factory=list)
    generated_at: datetime.datetime


class DailyPlanTaskResponse(BaseModel):
    """Individual practice activity in today's personalized plan."""

    id: str
    title: str
    description: str
    task_type: str
    target_entity_id: uuid.UUID | None = None
    skill_name: str
    estimated_minutes: int
    priority: str
    is_completed: bool


class DailyPlanV2Response(BaseModel):
    """Time-budgeted personalized daily learning plan."""

    daily_minutes_available: int
    total_estimated_minutes: int
    tasks: list[DailyPlanTaskResponse] = Field(default_factory=list)
    completed_count: int = 0
    total_count: int = 0
    date: str


class ReassessmentRecommendationResponse(BaseModel):
    """Smart assessment recommendation trigger."""

    should_reassess: bool
    reason: str | None = None
    skill_id: uuid.UUID | None = None
    skill_name: str | None = None
    suggested_assessment_id: uuid.UUID | None = None
    suggested_assessment_title: str | None = None
    generated_at: datetime.datetime | None = None


class AdminReadinessStatsResponse(BaseModel):
    """Operational and pedagogical metrics for administrative oversight."""

    calculation_version: str
    total_profiles: int
    insufficient_data_count: int
    insufficient_data_rate: float
    developing_count: int
    progressing_count: int
    near_target_count: int
    target_consistent_count: int
    total_evidence_records: int
    average_evidence_per_student: float
    average_confidence: float
