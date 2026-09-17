"""SQLAlchemy models for the generic assessment domain."""

import datetime
import uuid
from typing import Any

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

from app.core.database import TimeStampedUUIDModel
from app.modules.assessments.enums import (
    AssessmentType,
    AttemptStatus,
    NavigationPolicy,
    QuestionType,
    ScoringPolicy,
)
from app.modules.users.models import User


class Skill(TimeStampedUUIDModel):
    """Linguistic skill or subskill (e.g. reading comprehension, lexical structure)."""

    __tablename__ = "skills"

    code: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    parent: Mapped[Skill | None] = relationship(
        "Skill",
        remote_side="Skill.id",
        back_populates="subskills",
    )
    subskills: Mapped[list[Skill]] = relationship(
        "Skill",
        back_populates="parent",
    )
    question_tags: Mapped[list[QuestionSkillTag]] = relationship(
        "QuestionSkillTag",
        back_populates="skill",
    )


class Assessment(TimeStampedUUIDModel):
    """Reusable assessment definition for Reading, Listening, or Mixed mock exams."""

    __tablename__ = "assessments"

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    assessment_type: Mapped[AssessmentType] = mapped_column(
        SQLEnum(AssessmentType, name="assessment_type", native_enum=False),
        nullable=False,
        index=True,
    )
    duration_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    navigation_policy: Mapped[NavigationPolicy] = mapped_column(
        SQLEnum(NavigationPolicy, name="navigation_policy", native_enum=False),
        default=NavigationPolicy.FREE,
        nullable=False,
    )
    scoring_policy: Mapped[ScoringPolicy] = mapped_column(
        SQLEnum(ScoringPolicy, name="scoring_policy", native_enum=False),
        default=ScoringPolicy.STANDARD_POINTS,
        nullable=False,
    )
    max_attempts: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    pass_percentage: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    sections: Mapped[list[AssessmentSection]] = relationship(
        "AssessmentSection",
        back_populates="assessment",
        cascade="all, delete-orphan",
        order_by="AssessmentSection.order_index",
    )
    attempts: Mapped[list[Attempt]] = relationship(
        "Attempt",
        back_populates="assessment",
        cascade="all, delete-orphan",
    )


class AssessmentSection(TimeStampedUUIDModel):
    """Section of an assessment grouping questions (e.g. reading passage, audio snippet)."""

    __tablename__ = "assessment_sections"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assessments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    instructions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    order_index: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    duration_seconds: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    media_url: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )
    passage_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    assessment: Mapped[Assessment] = relationship(
        "Assessment",
        back_populates="sections",
    )
    questions: Mapped[list[Question]] = relationship(
        "Question",
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="Question.order_index",
    )


class Question(TimeStampedUUIDModel):
    """Assessment question with metadata, points, difficulty, and options."""

    __tablename__ = "questions"

    section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assessment_sections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    prompt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    question_type: Mapped[QuestionType] = mapped_column(
        SQLEnum(QuestionType, name="question_type", native_enum=False),
        default=QuestionType.SINGLE_CHOICE,
        nullable=False,
    )
    order_index: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
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
    explanation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    points: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    penalty_points: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    media_url: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )

    section: Mapped[AssessmentSection] = relationship(
        "AssessmentSection",
        back_populates="questions",
    )
    options: Mapped[list[QuestionOption]] = relationship(
        "QuestionOption",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="QuestionOption.order_index",
    )
    skill_tags: Mapped[list[QuestionSkillTag]] = relationship(
        "QuestionSkillTag",
        back_populates="question",
        cascade="all, delete-orphan",
    )


class QuestionOption(TimeStampedUUIDModel):
    """Possible answer choice for a question."""

    __tablename__ = "question_options"

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    order_index: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    is_correct: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    explanation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    question: Mapped[Question] = relationship(
        "Question",
        back_populates="options",
    )


class QuestionSkillTag(TimeStampedUUIDModel):
    """Associates a question with a primary skill or subskill with weight."""

    __tablename__ = "question_skill_tags"

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subskill: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    weight: Mapped[float] = mapped_column(
        Float,
        default=1.0,
        nullable=False,
    )

    question: Mapped[Question] = relationship(
        "Question",
        back_populates="skill_tags",
    )
    skill: Mapped[Skill] = relationship(
        "Skill",
        back_populates="question_tags",
    )


class Attempt(TimeStampedUUIDModel):
    """A student's exam attempt with server-controlled lifecycle and timestamps."""

    __tablename__ = "attempts"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assessments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[AttemptStatus] = mapped_column(
        SQLEnum(AttemptStatus, name="attempt_status", native_enum=False),
        default=AttemptStatus.CREATED,
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    expires_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    submitted_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    assessment: Mapped[Assessment] = relationship(
        "Assessment",
        back_populates="attempts",
    )
    user: Mapped[User] = relationship(
        "User",
    )
    answers: Mapped[list[AttemptAnswer]] = relationship(
        "AttemptAnswer",
        back_populates="attempt",
        cascade="all, delete-orphan",
    )
    score: Mapped[AttemptScore | None] = relationship(
        "AttemptScore",
        back_populates="attempt",
        uselist=False,
        cascade="all, delete-orphan",
    )


class AttemptAnswer(TimeStampedUUIDModel):
    """Answer submitted by a user for a question within an attempt."""

    __tablename__ = "attempt_answers"
    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_attempt_question_answer"),
    )

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    selected_option_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("question_options.id", ondelete="SET NULL"),
        nullable=True,
    )
    selected_option_ids: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    text_response: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    is_correct: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )
    points_awarded: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    answered_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    attempt: Mapped[Attempt] = relationship(
        "Attempt",
        back_populates="answers",
    )
    question: Mapped[Question] = relationship(
        "Question",
    )
    selected_option: Mapped[QuestionOption | None] = relationship(
        "QuestionOption",
    )


class AttemptScore(TimeStampedUUIDModel):
    """Calculated score and skill assessment result for a completed attempt."""

    __tablename__ = "attempt_scores"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attempts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    total_points: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    max_points: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    percentage: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    is_passed: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )
    estimated_level: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )
    skill_scores: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    scored_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    attempt: Mapped[Attempt] = relationship(
        "Attempt",
        back_populates="score",
    )
