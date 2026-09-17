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
    WritingSubmissionStatus,
    WritingTaskType,
)

if TYPE_CHECKING:
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
    user: Mapped[User] = relationship("User")
    submission: Mapped[WritingSubmission | None] = relationship(
        "WritingSubmission",
        back_populates="attempt",
        uselist=False,
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


class WritingCorrection(TimeStampedUUIDModel):
    """Graded evaluation with provenance, scores, and linguistic recommendations."""

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
    score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    estimated_level: Mapped[str] = mapped_column(
        String(20),
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
