"""SQLAlchemy models for Speaking Sessions, Participants, and Structured Evaluations."""

import datetime
import uuid
from typing import TYPE_CHECKING, Any

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
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import TimeStampedUUIDModel
from app.modules.speaking.enums import (
    ExamSectionType,
    SpeakingEvaluatorType,
    SpeakingExamState,
    SpeakingParticipantRole,
    SpeakingSectionState,
    SpeakingSessionState,
    SpeakingSessionType,
    SpeakingTurnSpeaker,
    SpeakingTurnState,
    TranscriptStatus,
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
    exam: Mapped[SpeakingExam | None] = relationship(
        "SpeakingExam",
        back_populates="session",
        uselist=False,
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

    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("speaking_sessions.id", ondelete="CASCADE"),
        unique=True,
        nullable=True,
        index=True,
    )
    exam_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("speaking_exams.id", ondelete="CASCADE", use_alter=True),
        nullable=True,
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
    evaluator_model: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )
    evaluation_version: Mapped[str | None] = mapped_column(
        String(32),
        default="v1",
        nullable=True,
    )
    evaluation_prompt: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    evidence_snapshot: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )

    # Relationships
    session: Mapped[SpeakingSession | None] = relationship(
        "SpeakingSession",
        back_populates="evaluation",
    )
    exam: Mapped[Any | None] = relationship(
        "SpeakingExam",
        foreign_keys=[exam_id],
        lazy="selectin",
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


class SpeakingExam(TimeStampedUUIDModel):
    """Authoritative TEF Speaking Examination entity.

    Represents the full student oral examination owning Section A and Section B,
    each with their own server-authoritative timer, examiner configuration, and turns.
    """

    __tablename__ = "speaking_exams"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("speaking_sessions.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
        index=True,
    )
    status: Mapped[SpeakingExamState] = mapped_column(
        SQLEnum(SpeakingExamState, name="speaking_exam_state", native_enum=False),
        default=SpeakingExamState.CREATED,
        nullable=False,
        index=True,
    )
    current_section_type: Mapped[ExamSectionType | None] = mapped_column(
        SQLEnum(ExamSectionType, name="exam_section_type", native_enum=False),
        default=ExamSectionType.SECTION_A,
        nullable=True,
        index=True,
    )
    topic: Mapped[str] = mapped_column(
        String(255),
        default="TEF Expression Orale — Épreuve Officielle Simulée",
        nullable=False,
    )
    target_level: Mapped[str] = mapped_column(
        String(10),
        default="B2",
        nullable=False,
    )
    total_duration_minutes: Mapped[int] = mapped_column(
        Integer,
        default=25,
        nullable=False,
    )
    config_version: Mapped[str] = mapped_column(
        String(32),
        default="v1",
        nullable=False,
    )
    started_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    completed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    evaluation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("speaking_evaluations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    student: Mapped[User] = relationship(
        "User",
        foreign_keys=[student_id],
        lazy="selectin",
    )
    session: Mapped[SpeakingSession | None] = relationship(
        "SpeakingSession",
        back_populates="exam",
        foreign_keys=[session_id],
        lazy="selectin",
    )
    sections: Mapped[list[SpeakingSection]] = relationship(
        "SpeakingSection",
        back_populates="exam",
        cascade="all, delete-orphan",
        order_by="SpeakingSection.sequence",
        lazy="selectin",
    )
    evaluation: Mapped[SpeakingEvaluation | None] = relationship(
        "SpeakingEvaluation",
        foreign_keys=[evaluation_id],
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_speaking_exams_student_status", "student_id", "status"),
    )


class SpeakingSection(TimeStampedUUIDModel):
    """Individual section task within a TEF Speaking Exam (Section A or Section B)."""

    __tablename__ = "speaking_sections"

    exam_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("speaking_exams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    section_type: Mapped[ExamSectionType] = mapped_column(
        SQLEnum(ExamSectionType, name="exam_section_type", native_enum=False),
        nullable=False,
        index=True,
    )
    sequence: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    prompt_topic: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    prompt_context: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    examiner_persona: Mapped[str] = mapped_column(
        String(64),
        default="Aoede",
        nullable=False,
    )
    system_prompt: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    duration_seconds: Mapped[int] = mapped_column(
        Integer,
        default=600,
        nullable=False,
    )
    status: Mapped[SpeakingSectionState] = mapped_column(
        SQLEnum(SpeakingSectionState, name="speaking_section_state", native_enum=False),
        default=SpeakingSectionState.PENDING,
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    expires_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    completed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    exam: Mapped[SpeakingExam] = relationship(
        "SpeakingExam",
        back_populates="sections",
    )
    turns: Mapped[list[SpeakingTurn]] = relationship(
        "SpeakingTurn",
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="SpeakingTurn.turn_number",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("exam_id", "sequence", name="uq_speaking_sections_exam_sequence"),
        UniqueConstraint("exam_id", "section_type", name="uq_speaking_sections_exam_type"),
        Index("ix_speaking_sections_status_expires", "status", "expires_at"),
    )


class SpeakingTurn(TimeStampedUUIDModel):
    """An individual conversational exchange turn within an exam section."""

    __tablename__ = "speaking_turns"

    section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("speaking_sections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    turn_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    speaker: Mapped[SpeakingTurnSpeaker] = mapped_column(
        SQLEnum(SpeakingTurnSpeaker, name="speaking_turn_speaker", native_enum=False),
        nullable=False,
        index=True,
    )
    state: Mapped[SpeakingTurnState] = mapped_column(
        SQLEnum(SpeakingTurnState, name="speaking_turn_state", native_enum=False),
        default=SpeakingTurnState.COMPLETED,
        nullable=False,
    )
    content_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    transcript_status: Mapped[TranscriptStatus] = mapped_column(
        SQLEnum(TranscriptStatus, name="transcript_status", native_enum=False),
        default=TranscriptStatus.COMPLETED,
        nullable=False,
        index=True,
    )
    audio_storage_key: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    audio_duration_seconds: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    interrupted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    interruption_reason: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
    )
    transcription_confidence: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    turn_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )
    started_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    completed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    client_turn_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )

    # Relationships
    section: Mapped[SpeakingSection] = relationship(
        "SpeakingSection",
        back_populates="turns",
    )

    __table_args__ = (
        UniqueConstraint("section_id", "turn_number", name="uq_speaking_turns_section_turn"),
        UniqueConstraint("section_id", "client_turn_id", name="uq_speaking_turns_section_client_turn_id"),
        Index("ix_speaking_turns_section_order", "section_id", "turn_number"),
    )

    @property
    def audio_key(self) -> str | None:
        return self.audio_storage_key

    @audio_key.setter
    def audio_key(self, value: str | None) -> None:
        self.audio_storage_key = value

    @property
    def duration_seconds(self) -> float | None:
        return self.audio_duration_seconds

    @duration_seconds.setter
    def duration_seconds(self, value: float | None) -> None:
        self.audio_duration_seconds = value
