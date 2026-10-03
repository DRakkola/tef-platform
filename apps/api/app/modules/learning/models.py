"""SQLAlchemy models for learning intelligence: StudentSkills, Mistakes, Exercises, and Recommendations."""

import datetime
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
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

from app.core.database import SQLEnumValues, TimeStampedUUIDModel, UUIDModel
from app.modules.admin.enums import SkillTagRole
from app.modules.assessments.enums import QuestionType

if TYPE_CHECKING:
    from app.modules.admin.models import ExerciseVersion
    from app.modules.assessments.models import Skill
from app.modules.learning.enums import (
    RecommendationStatus,
    RecommendationType,
    SkillCategory,
)
from app.modules.users.models import User


class StudentSkill(TimeStampedUUIDModel):
    """Dynamic estimated mastery and confidence of a student for a linguistic skill."""

    __tablename__ = "student_skills"
    __table_args__ = (UniqueConstraint("user_id", "skill_id", name="uq_student_skills_user_skill"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    mastery_score: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    confidence: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    attempts_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    last_assessed_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )
    estimated_level: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )
    successful_attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    user: Mapped[User] = relationship("User")
    skill: Mapped[Skill] = relationship("Skill")

    @property
    def student_id(self) -> uuid.UUID:
        return self.user_id

    @property
    def score(self) -> float:
        return self.mastery_score


class SkillAssessment(UUIDModel):
    """Immutable historical log of a skill evaluation event (never overwritten)."""

    __tablename__ = "skill_assessments"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    source_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    points_earned: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    points_possible: Mapped[float] = mapped_column(
        Float,
        nullable=False,
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
    assessed_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    user: Mapped[User] = relationship("User")
    skill: Mapped[Skill] = relationship("Skill")

    @property
    def student_id(self) -> uuid.UUID:
        return self.user_id


class Mistake(UUIDModel):
    """Structured error log for questions or exercises answered incorrectly."""

    __tablename__ = "mistakes"

    user_id: Mapped[uuid.UUID] = mapped_column(
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
    subskill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    subskill: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    source_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    question_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="SET NULL"),
        nullable=True,
    )
    exercise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("exercises.id", ondelete="SET NULL"),
        nullable=True,
    )
    user_answer: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    correct_answer: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    explanation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    error_count: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    last_occurred_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    user: Mapped[User] = relationship("User")
    skill: Mapped[Skill] = relationship("Skill", foreign_keys=[skill_id])
    subskill_ref: Mapped[Skill | None] = relationship("Skill", foreign_keys=[subskill_id])


class Exercise(TimeStampedUUIDModel):
    """Targeted learning activity or drill mapped to skills."""

    __tablename__ = "exercises"

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    instructions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    category: Mapped[SkillCategory] = mapped_column(
        SQLEnum(SkillCategory, name="skill_category", native_enum=False),
        nullable=False,
        index=True,
    )
    level: Mapped[str] = mapped_column(
        String(10),
        default="B1",
        nullable=False,
    )
    difficulty: Mapped[int] = mapped_column(
        Integer,
        default=3,
        nullable=False,
    )
    question_type: Mapped[QuestionType] = mapped_column(
        SQLEnum(QuestionType, name="question_type", native_enum=False),
        default=QuestionType.SINGLE_CHOICE,
        nullable=False,
    )
    prompt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    explanation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    points: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    options_payload: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="published",
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    task_type_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_types.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    skills: Mapped[list[ExerciseSkill]] = relationship(
        "ExerciseSkill",
        back_populates="exercise",
        cascade="all, delete-orphan",
    )
    attempts: Mapped[list[ExerciseAttempt]] = relationship(
        "ExerciseAttempt",
        back_populates="exercise",
        cascade="all, delete-orphan",
    )
    versions: Mapped[list[ExerciseVersion]] = relationship(
        "ExerciseVersion",
        back_populates="exercise",
        cascade="all, delete-orphan",
    )


class ExerciseSkill(UUIDModel):
    """Association table linking exercises with primary/secondary skills and subskills."""

    __tablename__ = "exercise_skills"

    exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("exercises.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    subskill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    subskill: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    role: Mapped[SkillTagRole] = mapped_column(
        SQLEnumValues(SkillTagRole, name="skill_tag_role", native_enum=False),
        default=SkillTagRole.PRIMARY,
        nullable=False,
        index=True,
    )
    weight: Mapped[float] = mapped_column(
        Float,
        default=1.0,
        nullable=False,
    )
    context: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    exercise: Mapped[Exercise] = relationship(
        "Exercise",
        back_populates="skills",
    )
    skill: Mapped[Skill] = relationship("Skill", foreign_keys=[skill_id])
    subskill_ref: Mapped[Skill | None] = relationship("Skill", foreign_keys=[subskill_id])


class ExerciseAttempt(UUIDModel):
    """A student's attempt to complete a practice exercise."""

    __tablename__ = "exercise_attempts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("exercises.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_correct: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
    )
    points_awarded: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    user_response: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    attempted_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    user: Mapped[User] = relationship("User")
    exercise: Mapped[Exercise] = relationship(
        "Exercise",
        back_populates="attempts",
    )


class Recommendation(UUIDModel):
    """Personalized learning recommendation generated by the deterministic engine."""

    __tablename__ = "recommendations"

    user_id: Mapped[uuid.UUID] = mapped_column(
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
    recommendation_type: Mapped[RecommendationType] = mapped_column(
        SQLEnum(RecommendationType, name="recommendation_type", native_enum=False),
        default=RecommendationType.EXERCISE,
        nullable=False,
    )
    entity_type: Mapped[str] = mapped_column(
        String(50),
        default="exercise",
        nullable=False,
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    priority: Mapped[int] = mapped_column(
        Integer,
        default=50,
        nullable=False,
        index=True,
    )
    status: Mapped[RecommendationStatus] = mapped_column(
        SQLEnum(RecommendationStatus, name="recommendation_status", native_enum=False),
        default=RecommendationStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    expires_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    generated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    user: Mapped[User] = relationship("User")
    skill: Mapped[Skill] = relationship("Skill")


class StudentActivityEvent(UUIDModel):
    """Event log capturing student learning activities for timeline and audit."""

    __tablename__ = "student_activity_events"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    entity_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    metadata_payload: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
        index=True,
    )

    user: Mapped[User] = relationship("User")


# Re-export readiness and adaptive models
from app.modules.learning.readiness_models import (
    ExerciseEffectiveness,
    ReadinessBand,
    ReadinessProfile,
    ReadinessSnapshot,
    SkillEvidence,
    SkillEvidenceSourceType,
    SkillTrendState,
    SpacedReviewItem,
)

__all__ = [
    "Exercise",
    "ExerciseAttempt",
    "ExerciseEffectiveness",
    "ExerciseSkill",
    "Mistake",
    "ReadinessBand",
    "ReadinessProfile",
    "ReadinessSnapshot",
    "Recommendation",
    "SkillAssessment",
    "SkillEvidence",
    "SkillEvidenceSourceType",
    "SkillTrendState",
    "SpacedReviewItem",
    "StudentActivityEvent",
    "StudentSkill",
]

