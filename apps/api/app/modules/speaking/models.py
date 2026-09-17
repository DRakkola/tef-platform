"""SQLAlchemy models for Speaking Sessions, Participants, and Structured Evaluations."""

import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import TimeStampedUUIDModel
from app.modules.speaking.enums import (
    SpeakingEvaluatorType,
    SpeakingParticipantRole,
    SpeakingSessionState,
    SpeakingSessionType,
)

if TYPE_CHECKING:
    from app.modules.assessments.models import Skill
    from app.modules.teachers.models import TeacherBooking
    from app.modules.users.models import User


class SpeakingSession(TimeStampedUUIDModel):
    """Speaking session entity managing AI or teacher oral examination sessions.

    Default duration is 25 minutes. Backend strictly controls starts_at, expires_at,
    and state transitions.
    """

    __tablename__ = "speaking_sessions"

    session_type: Mapped[SpeakingSessionType] = mapped_column(
        SQLEnum(SpeakingSessionType, name="speaking_session_type", native_enum=False),
        default=SpeakingSessionType.AI,
        nullable=False,
        index=True,
    )
    status: Mapped[SpeakingSessionState] = mapped_column(
        SQLEnum(SpeakingSessionState, name="speaking_session_state", native_enum=False),
        default=SpeakingSessionState.SCHEDULED,
        nullable=False,
        index=True,
    )
    topic: Mapped[str] = mapped_column(
        String(255),
        default="TEF Expression Orale — Épreuve d'entraînement",
        nullable=False,
    )
    level: Mapped[str] = mapped_column(
        String(10),
        default="B2",
        nullable=False,
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer,
        default=25,
        nullable=False,
    )
    starts_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    expires_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    ended_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    room_id: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teacher_bookings.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    participants: Mapped[list[SpeakingParticipant]] = relationship(
        "SpeakingParticipant",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    evaluation: Mapped[SpeakingEvaluation | None] = relationship(
        "SpeakingEvaluation",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    created_by: Mapped[User] = relationship(
        "User",
        foreign_keys=[created_by_user_id],
        lazy="selectin",
    )
    booking: Mapped[TeacherBooking | None] = relationship(
        "TeacherBooking",
        foreign_keys=[booking_id],
        lazy="selectin",
    )

    __table_args__ = (Index("ix_speaking_sessions_status_expires", "status", "expires_at"),)


class SpeakingParticipant(TimeStampedUUIDModel):
    """Participant attached to a speaking session (student, teacher, or AI assistant)."""

    __tablename__ = "speaking_participants"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("speaking_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    role: Mapped[SpeakingParticipantRole] = mapped_column(
        SQLEnum(SpeakingParticipantRole, name="speaking_participant_role", native_enum=False),
        nullable=False,
        index=True,
    )
    display_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    joined_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    left_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    is_connected: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    connection_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    # Relationships
    session: Mapped[SpeakingSession] = relationship(
        "SpeakingSession",
        back_populates="participants",
    )
    user: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="selectin",
    )

    __table_args__ = (Index("ix_speaking_participants_session_user", "session_id", "user_id"),)


class SpeakingEvaluation(TimeStampedUUIDModel):
    """Post-session structured evaluation.

    Explicitly records is_official_tef=False per compliance guidelines.
    """

    __tablename__ = "speaking_evaluations"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("speaking_sessions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    evaluator_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    evaluator_type: Mapped[SpeakingEvaluatorType] = mapped_column(
        SQLEnum(SpeakingEvaluatorType, name="speaking_evaluator_type", native_enum=False),
        default=SpeakingEvaluatorType.MOCK,
        nullable=False,
    )
    estimated_level: Mapped[str] = mapped_column(
        String(10),
        default="B2",
        nullable=False,
    )
    fluency: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    vocabulary: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    grammar: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    coherence: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    pronunciation: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    overall_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    strengths: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    weaknesses: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    recommendations: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    detailed_feedback: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    is_official_tef: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Relationships
    session: Mapped[SpeakingSession] = relationship(
        "SpeakingSession",
        back_populates="evaluation",
    )
    student: Mapped[User] = relationship(
        "User",
        foreign_keys=[student_id],
        lazy="selectin",
    )
    evaluator: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[evaluator_user_id],
        lazy="selectin",
    )
    skills: Mapped[list[SpeakingEvaluationSkill]] = relationship(
        "SpeakingEvaluationSkill",
        back_populates="evaluation",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class SpeakingEvaluationSkill(TimeStampedUUIDModel):
    """Granular skill score associated with speaking evaluation."""

    __tablename__ = "speaking_evaluation_skills"

    evaluation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("speaking_evaluations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # Relationships
    evaluation: Mapped[SpeakingEvaluation] = relationship(
        "SpeakingEvaluation",
        back_populates="skills",
    )
    skill: Mapped[Skill] = relationship(
        "Skill",
        lazy="selectin",
    )

    __table_args__ = (Index("ix_speaking_eval_skills_eval_skill", "evaluation_id", "skill_id"),)
