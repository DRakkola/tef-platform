"""Pydantic schemas for analytics ingestion, dashboards, feedback, experiments, and health."""

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, Field

from app.modules.analytics.enums import (
    ExperimentStatus,
    FeedbackCategory,
    SupportTicketPriority,
    SupportTicketStatus,
)


class AnalyticsEventIngestItem(BaseModel):
    """Single analytics event payload for ingestion."""

    event_id: uuid.UUID | None = Field(None, description="Client idempotency key")
    event_type: str = Field(..., min_length=2, max_length=64)
    actor_id: uuid.UUID | None = None
    session_id: str | None = Field(None, max_length=64)
    entity_type: str | None = Field(None, max_length=64)
    entity_id: uuid.UUID | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    schema_version: str = Field("v1.0.0", max_length=16)
    occurred_at: datetime.datetime | None = None


class AnalyticsEventBatchRequest(BaseModel):
    """Batch ingestion payload for high-throughput or buffered telemetry."""

    events: list[AnalyticsEventIngestItem] = Field(..., max_length=100)


class AnalyticsEventResponse(BaseModel):
    """Event ingestion response acknowledging receipt and idempotency."""

    event_id: uuid.UUID
    status: str = "accepted"
    received_at: datetime.datetime


class UserFeedbackCreateRequest(BaseModel):
    """Student feedback submission."""

    category: FeedbackCategory = FeedbackCategory.GENERAL
    rating: int | None = Field(None, ge=1, le=5, description="1 to 5 star rating or scale")
    message: str = Field(..., min_length=1, max_length=5000)
    context_url: str | None = Field(None, max_length=255)
    metadata: dict[str, Any] = Field(default_factory=dict)


class UserFeedbackResponse(BaseModel):
    """Persisted user feedback response."""

    id: uuid.UUID
    user_id: uuid.UUID
    category: str
    rating: int | None
    message: str
    context_url: str | None
    created_at: datetime.datetime


class SupportTicketCreateRequest(BaseModel):
    """Student support or technical issue report."""

    category: str = Field("general", max_length=32)
    subject: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=10, max_length=10000)
    priority: SupportTicketPriority = SupportTicketPriority.MEDIUM
    context: dict[str, Any] = Field(default_factory=dict)


class SupportTicketUpdateRequest(BaseModel):
    """Administrative update to ticket lifecycle and triage."""

    status: SupportTicketStatus | None = None
    priority: SupportTicketPriority | None = None
    internal_notes: str | None = Field(None, max_length=10000)


class SupportTicketResponse(BaseModel):
    """Support ticket detail schema."""

    id: uuid.UUID
    user_id: uuid.UUID | None = None
    category: str
    subject: str
    description: str
    status: str
    priority: str
    internal_notes: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class ExperimentVariantConfig(BaseModel):
    """Configuration for an experiment variant."""

    key: str = Field(..., min_length=1, max_length=32)
    weight: int = Field(50, ge=0, le=100)
    config: dict[str, Any] = Field(default_factory=dict)


class ExperimentCreateRequest(BaseModel):
    """Admin experiment creation."""

    key: str = Field(..., min_length=3, max_length=64)
    name: str = Field(..., min_length=3, max_length=128)
    description: str | None = None
    variants: list[ExperimentVariantConfig] = Field(..., min_length=2)
    target_audience: dict[str, Any] = Field(default_factory=dict)


class ExperimentUpdateRequest(BaseModel):
    """Admin experiment status update."""

    name: str | None = None
    description: str | None = None
    status: ExperimentStatus | None = None


class ExperimentVariantResponse(BaseModel):
    """Experiment variant response schema."""

    id: uuid.UUID
    key: str
    weight: int
    config_payload: dict[str, Any]


class ExperimentResponse(BaseModel):
    """Complete experiment details."""

    id: uuid.UUID
    key: str
    name: str
    description: str | None
    status: str
    variants: list[ExperimentVariantResponse] = Field(default_factory=list)
    created_at: datetime.datetime
    updated_at: datetime.datetime


class ExperimentResultItem(BaseModel):
    """Conversion statistics for an experiment variant."""

    variant_key: str
    assigned_count: int
    conversion_count: int
    conversion_rate: float


class ExperimentResultsResponse(BaseModel):
    """Aggregated evaluation results of a product experiment."""

    experiment_key: str
    status: str
    total_assignments: int
    variants: list[ExperimentResultItem]


# ---------------------------------------------------------------------------
# Aggregated Analytics & Operational Dashboards
# ---------------------------------------------------------------------------


class AnalyticsOverviewResponse(BaseModel):
    """Key metric overview for the executive / admin dashboard."""

    total_registered_users: int
    active_users: int
    activated_users: int
    activation_rate: float
    assessments_completed: int
    exercises_completed: int
    writing_submissions: int
    speaking_sessions: int
    practice_pool_sessions: int
    teacher_bookings: int
    active_subscriptions: int
    total_revenue: float
    ai_estimated_cost: float
    date_range: str


class FunnelStageResponse(BaseModel):
    """Individual milestone in the student activation and conversion funnel."""

    stage: str
    name: str
    count: int
    conversion_from_previous: float
    conversion_from_start: float


class FunnelResponse(BaseModel):
    """Comprehensive multi-step product conversion funnel."""

    stages: list[FunnelStageResponse]
    total_visitors: int
    total_converted: int
    overall_conversion_rate: float


class RetentionCohortItem(BaseModel):
    """Cohort retention breakdown across D1, D7, D14, and D30."""

    cohort_date: str
    cohort_size: int
    d1_rate: float
    d7_rate: float
    d14_rate: float
    d30_rate: float


class RetentionResponse(BaseModel):
    """Product cohort retention analysis."""

    definition: str
    cohorts: list[RetentionCohortItem]


class LearningAnalyticsResponse(BaseModel):
    """Empirical observed learning outcomes and common skill blockers."""

    total_skills_tracked: int
    average_observed_improvement: float
    common_blocking_skills: list[dict[str, Any]] = Field(default_factory=list)
    top_improving_skills: list[dict[str, Any]] = Field(default_factory=list)
    insufficient_data: bool = False


class ContentAnalyticsResponse(BaseModel):
    """Assessment, exercise, and question diagnostic error analysis."""

    most_attempted_assessments: list[dict[str, Any]] = Field(default_factory=list)
    least_attempted_assessments: list[dict[str, Any]] = Field(default_factory=list)
    average_completion_rate: float
    average_expiration_rate: float
    flagged_questions_for_review: list[dict[str, Any]] = Field(default_factory=list)


class TeacherAnalyticsResponse(BaseModel):
    """Marketplace utilization and turnaround metrics."""

    available_slots: int
    booked_slots: int
    slot_utilization_rate: float
    completed_bookings: int
    cancellation_rate: float
    average_correction_turnaround_hours: float


class AIAnalyticsResponse(BaseModel):
    """Server-side tracked AI usage, cost, and latency metrics."""

    total_ai_writing_jobs: int
    total_ai_speaking_sessions: int
    total_ai_cost_usd: float
    cost_per_active_student_usd: float
    average_latency_seconds: float
    ai_failure_rate: float


class BillingAnalyticsResponse(BaseModel):
    """Financial transaction conversion and commercial operations."""

    checkout_starts: int
    checkout_conversion_rate: float
    successful_payments: int
    failed_payments: int
    active_subscriptions: int
    credits_sold: int
    credits_consumed: int
    total_gmv: float
    platform_commission: float


class PracticePoolAnalyticsResponse(BaseModel):
    """Practice Pool liquidity, queuing, and peer match rates."""

    queue_joins: int
    match_success_rate: float
    median_time_to_match_seconds: float
    session_completion_rate: float
    liquidity_status: str


class HealthCheckSubsystem(BaseModel):
    """Individual infrastructure or provider health probe."""

    name: str
    status: str  # "healthy", "degraded", "failed", "unknown"
    latency_ms: float | None = None
    message: str | None = None
    last_checked_at: datetime.datetime


class HealthDashboardResponse(BaseModel):
    """Unified operational health cockpit."""

    overall_status: str
    subsystems: list[HealthCheckSubsystem]
    server_timestamp: datetime.datetime


# ---------------------------------------------------------------------------
# Student Onboarding Schemas
# ---------------------------------------------------------------------------


class OnboardingStateResponse(BaseModel):
    """Current onboarding state for the logged-in student."""

    onboarding_status: str
    onboarding_step: int
    target_exam: str
    target_level: str
    target_date: str | None = None
    daily_minutes_available: int
    timezone: str = "UTC"
    native_language: str | None = None
    learning_preferences: dict[str, Any] = Field(default_factory=dict)


class OnboardingUpdateRequest(BaseModel):
    """Update student onboarding preferences and step."""

    step: int | None = Field(None, ge=1, le=4)
    target_exam: str | None = None
    target_level: str | None = None
    target_date: datetime.date | None = None
    daily_minutes_available: int | None = Field(None, ge=15, le=60)
    native_language: str | None = None
    timezone: str | None = None
    learning_preferences: dict[str, Any] | None = None


class OnboardingCompleteRequest(BaseModel):
    """Action to finalize or skip onboarding."""

    action: str = Field("completed", pattern="^(completed|skipped)$")
