"""SQLAlchemy models for the writing assessment module."""

import datetime
import uuid
from typing import TYPE_CHECKING

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
from app.modules.writing.enums import (
    CorrectionProviderType,
    WritingAttemptStatus,
    WritingCorrectionStatus,
    WritingSubmissionStatus,
    WritingTaskType,
)

if TYPE_CHECKING:
    from app.modules.admin.models import WritingTaskVersion
    from app.modules.learning.models import Skill
    from app.modules.users.models import User


class WritingTask(TimeStampedUUIDModel):
    """Writing prompt/task definition (e.g. TEF Section A or Section B)."""

    __tablename__ = "writing_tasks"

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    task_type: Mapped[WritingTaskType] = mapped_column(
        SQLEnum(WritingTaskType, name="writing_task_type", native_enum=False),
        default=WritingTaskType.SECTION_A,
        nullable=False,
        index=True,
    )
    prompt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    stimulus_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    min_words: Mapped[int] = mapped_column(
        Integer,
        default=80,
        nullable=False,
    )
    max_words: Mapped[int] = mapped_column(
        Integer,
        default=120,
        nullable=False,
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer,
        default=60,
        nullable=False,
    )
    target_level: Mapped[str] = mapped_column(
        String(20),
        default="B2",
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

    attempts: Mapped[list[WritingAttempt]] = relationship(
        "WritingAttempt",
        back_populates="task",
        cascade="all, delete-orphan",
    )
    submissions: Mapped[list[WritingSubmission]] = relationship(
        "WritingSubmission",
        back_populates="task",
        cascade="all, delete-orphan",
    )
    versions: Mapped[list[WritingTaskVersion]] = relationship(
        "WritingTaskVersion",
        back_populates="writing_task",
        cascade="all, delete-orphan",
    )


class WritingAttempt(TimeStampedUUIDModel):
    """Student's timed session for drafting and editing a writing essay."""

    __tablename__ = "writing_attempts"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("writing_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[WritingAttemptStatus] = mapped_column(
        SQLEnum(WritingAttemptStatus, name="writing_attempt_status", native_enum=False),
        default=WritingAttemptStatus.DRAFT,
        nullable=False,
        index=True,
    )
    content: Mapped[str] = mapped_column(
        Text,
        default="",
        nullable=False,
    )
    word_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    writing_task_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("writing_task_versions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    current_revision: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    started_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    expires_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    submitted_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    task: Mapped[WritingTask] = relationship(
        "WritingTask",
        back_populates="attempts",
    )
    task_version: Mapped[WritingTaskVersion | None] = relationship(
        "WritingTaskVersion",
    )
    user: Mapped[User] = relationship("User")
    submission: Mapped[WritingSubmission | None] = relationship(
        "WritingSubmission",
        back_populates="attempt",
        uselist=False,
        cascade="all, delete-orphan",
    )
    draft_revisions: Mapped[list[WritingDraftRevision]] = relationship(
        "WritingDraftRevision",
        back_populates="attempt",
        cascade="all, delete-orphan",
    )


class WritingSubmission(TimeStampedUUIDModel):
    """Submitted writing essay stored in MinIO and queued/assigned for correction."""

    __tablename__ = "writing_submissions"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("writing_attempts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("writing_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    writing_task_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("writing_task_versions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assigned_teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[WritingSubmissionStatus] = mapped_column(
        SQLEnum(WritingSubmissionStatus, name="writing_submission_status", native_enum=False),
        default=WritingSubmissionStatus.SUBMITTED,
        nullable=False,
        index=True,
    )
    word_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    storage_object_key: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    submitted_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    attempt: Mapped[WritingAttempt] = relationship(
        "WritingAttempt",
        back_populates="submission",
    )
    task: Mapped[WritingTask] = relationship(
        "WritingTask",
        back_populates="submissions",
    )
    task_version: Mapped[WritingTaskVersion | None] = relationship(
        "WritingTaskVersion",
    )
    student: Mapped[User] = relationship(
        "User",
        foreign_keys=[user_id],
    )
    assigned_teacher: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[assigned_teacher_id],
    )
    correction: Mapped[WritingCorrection | None] = relationship(
        "WritingCorrection",
        back_populates="submission",
        uselist=False,
        cascade="all, delete-orphan",
    )
    assignments: Mapped[list[WritingAssignment]] = relationship(
        "WritingAssignment",
        back_populates="submission",
        cascade="all, delete-orphan",
    )


class WritingCorrection(TimeStampedUUIDModel):
    """Graded evaluation with provenance, scores, criteria breakdown, and linguistic recommendations."""

    __tablename__ = "writing_corrections"

    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("writing_submissions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    provider: Mapped[CorrectionProviderType] = mapped_column(
        SQLEnum(CorrectionProviderType, name="correction_provider_type", native_enum=False),
        nullable=False,
        index=True,
    )
    corrected_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[WritingCorrectionStatus] = mapped_column(
        SQLEnum(WritingCorrectionStatus, name="writing_correction_status", native_enum=False),
        default=WritingCorrectionStatus.SUBMITTED,
        nullable=False,
        index=True,
    )
    score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    estimated_level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    task_completion: Mapped[float | None] = mapped_column(Float, nullable=True)
    coherence: Mapped[float | None] = mapped_column(Float, nullable=True)
    vocabulary: Mapped[float | None] = mapped_column(Float, nullable=True)
    grammar: Mapped[float | None] = mapped_column(Float, nullable=True)
    syntax: Mapped[float | None] = mapped_column(Float, nullable=True)
    spelling: Mapped[float | None] = mapped_column(Float, nullable=True)
    register: Mapped[float | None] = mapped_column(Float, nullable=True)

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
    comments: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    corrected_content: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    recommendations: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )

    submission: Mapped[WritingSubmission] = relationship(
        "WritingSubmission",
        back_populates="correction",
    )
    corrected_by: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[corrected_by_user_id],
    )
    items: Mapped[list[WritingCorrectionItem]] = relationship(
        "WritingCorrectionItem",
        back_populates="correction",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    skills: Mapped[list[WritingCorrectionSkill]] = relationship(
        "WritingCorrectionSkill",
        back_populates="correction",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class WritingDraftRevision(TimeStampedUUIDModel):
    """Immutable snapshot of student draft autosaves protecting against stale writes."""

    __tablename__ = "writing_draft_revisions"
    __table_args__ = (
        UniqueConstraint("attempt_id", "revision_number", name="uq_draft_revision_attempt_number"),
    )

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("writing_attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    revision_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    word_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    attempt: Mapped[WritingAttempt] = relationship(
        "WritingAttempt",
        back_populates="draft_revisions",
    )


class WritingCorrectionItem(TimeStampedUUIDModel):
    """Fine-grained linguistic correction item for inline suggestions and mistake analysis."""

    __tablename__ = "writing_correction_items"

    correction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("writing_corrections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    original_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    corrected_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    skill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    explanation: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    correction: Mapped[WritingCorrection] = relationship(
        "WritingCorrection",
        back_populates="items",
    )


class WritingCorrectionSkill(TimeStampedUUIDModel):
    """Skill-level evaluation score and qualitative feedback."""

    __tablename__ = "writing_correction_skills"

    correction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("writing_corrections.id", ondelete="CASCADE"),
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
    level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    feedback: Mapped[str] = mapped_column(
        Text,
        default="",
        nullable=False,
    )

    correction: Mapped[WritingCorrection] = relationship(
        "WritingCorrection",
        back_populates="skills",
    )


class WritingAssignment(TimeStampedUUIDModel):
    """Assignment audit log tracking teacher claiming and workflow transitions."""

    __tablename__ = "writing_assignments"

    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("writing_submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="assigned",
        nullable=False,
        index=True,
    )
    assigned_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )
    claimed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    submission: Mapped[WritingSubmission] = relationship(
        "WritingSubmission",
        back_populates="assignments",
    )
    teacher: Mapped[User] = relationship(
        "User",
        foreign_keys=[teacher_id],
    )
