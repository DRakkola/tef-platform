"""SQLAlchemy models for TEF Readiness Engine and Adaptive Learning Engine."""

import datetime
import enum
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import TimeStampedUUIDModel, UUIDModel

if TYPE_CHECKING:
    from app.modules.assessments.models import Skill
    from app.modules.learning.models import Exercise
    from app.modules.users.models import User


class ReadinessBand(str, enum.Enum):
    """Controlled readiness band categories.

    Do not use misleading claims such as 'guaranteed_pass' or 'ready_for_tef'.
    """

    INSUFFICIENT_DATA = "insufficient_data"
    DEVELOPING = "developing"
    PROGRESSING = "progressing"
    NEAR_TARGET = "near_target"
    TARGET_CONSISTENT = "target_consistent"


class SkillEvidenceSourceType(str, enum.Enum):
    """Recognized evaluation source types for skill evidence."""

    ASSESSMENT = "assessment"
    EXERCISE = "exercise"
    WRITING = "writing"
    SPEAKING = "speaking"
    TEACHER_EVALUATION = "teacher_evaluation"
    AI_EVALUATION = "ai_evaluation"
    PRACTICE = "practice"


class SkillTrendState(str, enum.Enum):
    """Trend direction classification."""

    IMPROVING = "improving"
    STABLE = "stable"
    DECLINING = "declining"
    INSUFFICIENT_DATA = "insufficient_data"


class ReadinessProfile(TimeStampedUUIDModel):
    """Authoritative student readiness state and target tracking."""

    __tablename__ = "readiness_profiles"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    target_exam: Mapped[str] = mapped_column(
        String(100),
        default="TEF Canada",
        nullable=False,
    )
    target_level: Mapped[str] = mapped_column(
        String(20),
        default="B2",
        nullable=False,
    )
    target_date: Mapped[datetime.date | None] = mapped_column(
        Date,
        nullable=True,
    )
    overall_estimate: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    estimated_level: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )
    confidence: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    confidence_label: Mapped[str] = mapped_column(
        String(50),
        default="insufficient_data",
        nullable=False,
    )
    readiness_band: Mapped[ReadinessBand] = mapped_column(
        SQLEnum(ReadinessBand, name="readiness_band", native_enum=False),
        default=ReadinessBand.INSUFFICIENT_DATA,
        nullable=False,
        index=True,
    )
    summary_skills: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    summary_gaps: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    summary_blockers: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    last_calculated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )
    calculation_version: Mapped[str] = mapped_column(
        String(50),
        default="v1.0.0",
        nullable=False,
        index=True,
    )

    # Relationships
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])


class SkillEvidence(UUIDModel):
    """Append-only, immutable historical evidence stream.

    Records every evaluation observation from assessments, exercises, writing, speaking,
    teacher reviews, AI evaluations, or peer practice.
    """

    __tablename__ = "skill_evidences"
    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "skill_id",
            "source_type",
            "source_id",
            name="uq_skill_evidence_student_source_skill",
        ),
        Index("ix_skill_evidences_student_observed", "student_id", "observed_at"),
        Index("ix_skill_evidences_student_skill", "student_id", "skill_id"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    raw_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    normalized_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    confidence: Mapped[float] = mapped_column(
        Float,
        default=1.0,
        nullable=False,
    )
    weight: Mapped[float] = mapped_column(
        Float,
        default=1.0,
        nullable=False,
    )
    observed_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )
    calculation_version: Mapped[str] = mapped_column(
        String(50),
        default="v1.0.0",
        nullable=False,
    )
    metadata_payload: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )

    # Relationships
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
    skill: Mapped["Skill"] = relationship("Skill", foreign_keys=[skill_id])


class ReadinessSnapshot(UUIDModel):
    """Immutable historical point-in-time calculation snapshot.

    Enables historical reproducibility and 'How did we calculate readiness on date X?' queries.
    """

    __tablename__ = "readiness_snapshots"
    __table_args__ = (
        Index("ix_readiness_snapshots_student_gen", "student_id", "generated_at"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    overall_estimate: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    estimated_level: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )
    confidence: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    confidence_label: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    readiness_band: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    skills: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    gaps: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    blockers: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    recommendations: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    calculation_version: Mapped[str] = mapped_column(
        String(50),
        default="v1.0.0",
        nullable=False,
    )
    generated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])


class ExerciseEffectiveness(TimeStampedUUIDModel):
    """Aggregated effectiveness metrics for targeted practice exercises.

    Tracks observed improvement after practice without claiming direct causation.
    """

    __tablename__ = "exercise_effectiveness"
    __table_args__ = (
        UniqueConstraint("exercise_id", "skill_id", name="uq_exercise_effectiveness_exercise_skill"),
    )

    exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("exercises.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    completion_rate: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    average_pre_score: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    average_post_score: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    observed_improvement: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    calculation_version: Mapped[str] = mapped_column(
        String(50),
        default="v1.0.0",
        nullable=False,
    )

    exercise: Mapped["Exercise"] = relationship("Exercise", foreign_keys=[exercise_id])
    skill: Mapped["Skill"] = relationship("Skill", foreign_keys=[skill_id])


class SpacedReviewItem(TimeStampedUUIDModel):
    """Spaced repetition foundation entity tracking review intervals and schedule."""

    __tablename__ = "spaced_review_items"
    __table_args__ = (
        Index("ix_spaced_review_user_next", "user_id", "next_review_at"),
        UniqueConstraint("user_id", "entity_type", "entity_id", name="uq_spaced_review_user_entity"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_type: Mapped[str] = mapped_column(
        String(50),
        default="exercise",
        nullable=False,
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    next_review_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    review_interval_days: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    review_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    mastery: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    last_reviewed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    skill: Mapped["Skill"] = relationship("Skill", foreign_keys=[skill_id])
