import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SkillSummaryMetric(BaseModel):
    """Summarized skill metric with rolling change and confidence calibration."""

    model_config = ConfigDict(from_attributes=True)

    skill_id: uuid.UUID
    skill_name: str
    category: str
    current_score: float
    previous_score: float | None = None
    change: float | None = None
    confidence: float
    confidence_label: str = "Low"  # High, Medium, Low, Calibration
    insufficient_data: bool = False
    trend: str = "stable"  # improving, declining, stable, insufficient_data
    estimated_level: str | None = None
    attempts_count: int = 0
    successful_attempts: int = 0
    last_assessed_at: datetime.datetime | None = None


class ProgressDataPoint(BaseModel):
    """Historical measurement data point for timeline charts (never overwritten)."""

    timestamp: datetime.datetime
    overall_score: float
    assessment_title: str
    source_type: str
    category: str | None = None


class RecentAssessmentSummary(BaseModel):
    """Summary of recent completed assessment attempt."""

    id: uuid.UUID
    title: str
    assessment_type: str
    score_percentage: float
    passed: bool
    estimated_level: str | None = None
    submitted_at: datetime.datetime


class WeakestSkillSummary(BaseModel):
    """Identified focus skill requiring targeted improvement."""

    skill_id: uuid.UUID
    skill_name: str
    category: str
    mastery_score: float
    reason: str
    recommended_exercise_id: uuid.UUID | None = None


class RecommendedExerciseSummary(BaseModel):
    """Tailored exercise recommendation based on diagnostic weaknesses."""

    id: uuid.UUID
    title: str
    category: str
    difficulty: int
    level: str
    target_skill_name: str
    reason: str
    priority: str


class RecentWritingSummary(BaseModel):
    """Summary of recent writing attempt and correction outcome."""

    id: uuid.UUID
    task_title: str
    overall_score: float | None = None
    estimated_level: str | None = None
    submitted_at: datetime.datetime
    status: str
    corrected_at: datetime.datetime | None = None


class UpcomingBookingSummary(BaseModel):
    """Scheduled teacher lesson."""

    id: uuid.UUID
    teacher_name: str
    start_time: datetime.datetime
    end_time: datetime.datetime
    status: str
    meeting_link: str | None = None


class RecentSpeakingSummary(BaseModel):
    """Summary of recent oral session (AI simulation, teacher lesson, or peer practice)."""

    id: uuid.UUID
    session_type: str  # ai, teacher, peer
    topic: str
    status: str
    duration_minutes: int
    starts_at: datetime.datetime | None = None
    overall_score: float | None = None
    estimated_level: str | None = None


class StudentDashboardResponse(BaseModel):
    """Aggregated dashboard payload optimized for single-call loading."""

    target_exam: str | None = None
    target_level: str | None = None
    target_cefr_level: str | None = None
    target_nclc_level: str | None = None
    target_date: str | None = None
    days_remaining: int | None = None
    target_urgency: str = "none"
    score_gap: float = 0.0
    level_distance: int = 0
    is_target_met: bool = False
    target_disclaimer: str = ""
    native_language: str | None = None
    overall_readiness: float | None = None
    current_cefr_level: str | None = None
    current_nclc_level: str | None = None
    total_assessments_taken: int = 0
    total_practice_minutes: int = 0
    skills: list[SkillSummaryMetric] = Field(default_factory=list)
    progress_history: list[ProgressDataPoint] = Field(default_factory=list)
    weakest_skills: list[WeakestSkillSummary] = Field(default_factory=list)
    strongest_skills: list[WeakestSkillSummary] = Field(default_factory=list)
    daily_plan: dict[str, Any] | None = None
    recommended_exercises: list[RecommendedExerciseSummary] = Field(default_factory=list)
    recent_assessments: list[RecentAssessmentSummary] = Field(default_factory=list)
    recent_writing_corrections: list[RecentWritingSummary] = Field(default_factory=list)
    upcoming_bookings: list[UpcomingBookingSummary] = Field(default_factory=list)
    recent_speaking_sessions: list[RecentSpeakingSummary] = Field(default_factory=list)
    recent_activity: list[dict[str, Any]] = Field(default_factory=list)
    segment: str = "new_student"
    engagement_status: dict[str, Any] = Field(default_factory=dict)


class StudentProgressResponse(BaseModel):
    """Historical progress and skill trajectories over time."""

    timeline: list[ProgressDataPoint] = Field(default_factory=list)
    skills: list[SkillSummaryMetric] = Field(default_factory=list)
    overall_score: float | None = None
    estimated_cefr_level: str | None = None
    estimated_nclc_level: str | None = None
    disclaimer: str = ""

