"""SQLAlchemy models for Practice Pool: queue entries, requests, matches, sessions, reports, and blocks."""

import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
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
from app.modules.practice_pool.enums import (
    PracticeMatchStatus,
    PracticeQueueStatus,
    PracticeReportReason,
    PracticeRequestStatus,
    PracticeSessionStatus,
    PracticeType,
)

if TYPE_CHECKING:
    from app.modules.users.models import User


class PracticeQueueEntry(TimeStampedUUIDModel):
    """Historical and active queue log for student audio practice matchmaking."""

    __tablename__ = "practice_queue_entries"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    language: Mapped[str] = mapped_column(
        String(10),
        default="fr",
        nullable=False,
        index=True,
    )
    level: Mapped[str] = mapped_column(
        String(10),
        default="B2",
        nullable=False,
        index=True,
    )
    practice_type: Mapped[PracticeType] = mapped_column(
        SQLEnum(PracticeType, name="practice_type", native_enum=False),
        default=PracticeType.FREE_CONVERSATION,
        nullable=False,
        index=True,
    )
    status: Mapped[PracticeQueueStatus] = mapped_column(
        SQLEnum(PracticeQueueStatus, name="practice_queue_status", native_enum=False),
        default=PracticeQueueStatus.WAITING,
        nullable=False,
        index=True,
    )
    anonymous_alias: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    joined_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    left_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user: Mapped[User] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="selectin",
    )

    __table_args__ = (Index("ix_practice_queue_status_lang_level", "status", "language", "level"),)


class PracticeRequest(TimeStampedUUIDModel):
    """1-to-1 invitation sent between compatible candidates in the practice queue."""

    __tablename__ = "practice_requests"

    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    receiver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_alias: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    receiver_alias: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    language: Mapped[str] = mapped_column(
        String(10),
        default="fr",
        nullable=False,
    )
    level: Mapped[str] = mapped_column(
        String(10),
        default="B2",
        nullable=False,
    )
    practice_type: Mapped[PracticeType] = mapped_column(
        SQLEnum(PracticeType, name="practice_type", native_enum=False),
        default=PracticeType.FREE_CONVERSATION,
        nullable=False,
    )
    status: Mapped[PracticeRequestStatus] = mapped_column(
        SQLEnum(PracticeRequestStatus, name="practice_request_status", native_enum=False),
        default=PracticeRequestStatus.PENDING,
        nullable=False,
        index=True,
    )
    expires_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    # Relationships
    sender: Mapped[User] = relationship(
        "User",
        foreign_keys=[sender_id],
        lazy="selectin",
    )
    receiver: Mapped[User] = relationship(
        "User",
        foreign_keys=[receiver_id],
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_practice_requests_receiver_status", "receiver_id", "status"),
        Index("ix_practice_requests_sender_status", "sender_id", "status"),
    )


class PracticeMatch(TimeStampedUUIDModel):
    """Matched pair record representing accepted practice invitation."""

    __tablename__ = "practice_matches"

    request_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("practice_requests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    student_a_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_b_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_a_alias: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    student_b_alias: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    language: Mapped[str] = mapped_column(
        String(10),
        default="fr",
        nullable=False,
    )
    level: Mapped[str] = mapped_column(
        String(10),
        default="B2",
        nullable=False,
    )
    practice_type: Mapped[PracticeType] = mapped_column(
        SQLEnum(PracticeType, name="practice_type", native_enum=False),
        default=PracticeType.FREE_CONVERSATION,
        nullable=False,
    )
    status: Mapped[PracticeMatchStatus] = mapped_column(
        SQLEnum(PracticeMatchStatus, name="practice_match_status", native_enum=False),
        default=PracticeMatchStatus.MATCHED,
        nullable=False,
        index=True,
    )

    # Relationships
    student_a: Mapped[User] = relationship(
        "User",
        foreign_keys=[student_a_id],
        lazy="selectin",
    )
    student_b: Mapped[User] = relationship(
        "User",
        foreign_keys=[student_b_id],
        lazy="selectin",
    )
    request: Mapped[PracticeRequest | None] = relationship(
        "PracticeRequest",
        foreign_keys=[request_id],
        lazy="selectin",
    )
    session: Mapped[PracticeSession | None] = relationship(
        "PracticeSession",
        back_populates="match",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class PracticeSession(TimeStampedUUIDModel):
    """Authoritative audio-only practice session between two anonymous students.

    Server strictly owns starts_at, expires_at, remaining time, and single-active-session
    enforcement.
    """

    __tablename__ = "practice_sessions"

    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("practice_matches.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    room_id: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )
    student_a_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_b_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_a_alias: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    student_b_alias: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    student_a_connected: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    student_b_connected: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    language: Mapped[str] = mapped_column(
        String(10),
        default="fr",
        nullable=False,
    )
    level: Mapped[str] = mapped_column(
        String(10),
        default="B2",
        nullable=False,
    )
    practice_type: Mapped[PracticeType] = mapped_column(
        SQLEnum(PracticeType, name="practice_type", native_enum=False),
        default=PracticeType.FREE_CONVERSATION,
        nullable=False,
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer,
        default=15,
        nullable=False,
    )
    status: Mapped[PracticeSessionStatus] = mapped_column(
        SQLEnum(PracticeSessionStatus, name="practice_session_status", native_enum=False),
        default=PracticeSessionStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    starts_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    expires_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    ended_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    audio_only: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Relationships
    match: Mapped[PracticeMatch] = relationship(
        "PracticeMatch",
        back_populates="session",
    )
    student_a: Mapped[User] = relationship(
        "User",
        foreign_keys=[student_a_id],
        lazy="selectin",
    )
    student_b: Mapped[User] = relationship(
        "User",
        foreign_keys=[student_b_id],
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_practice_sessions_status_expires", "status", "expires_at"),
        Index("ix_practice_sessions_student_a_status", "student_a_id", "status"),
        Index("ix_practice_sessions_student_b_status", "student_b_id", "status"),
    )


class PracticeReport(TimeStampedUUIDModel):
    """Anonymous report submitted regarding an unruly peer."""

    __tablename__ = "practice_reports"

    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reported_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("practice_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reason: Mapped[PracticeReportReason] = mapped_column(
        SQLEnum(PracticeReportReason, name="practice_report_reason", native_enum=False),
        default=PracticeReportReason.INAPPROPRIATE_BEHAVIOR,
        nullable=False,
        index=True,
    )
    details: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False,
    )

    # Relationships
    reporter: Mapped[User] = relationship(
        "User",
        foreign_keys=[reporter_id],
        lazy="selectin",
    )
    reported_user: Mapped[User] = relationship(
        "User",
        foreign_keys=[reported_user_id],
        lazy="selectin",
    )
    session: Mapped[PracticeSession | None] = relationship(
        "PracticeSession",
        foreign_keys=[session_id],
        lazy="selectin",
    )


class PracticeBlock(TimeStampedUUIDModel):
    """Safety block preventing two students from ever matching or requesting each other."""

    __tablename__ = "practice_blocks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    blocked_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reason: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # Relationships
    user: Mapped[User] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="selectin",
    )
    blocked_user: Mapped[User] = relationship(
        "User",
        foreign_keys=[blocked_user_id],
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("user_id", "blocked_user_id", name="uq_practice_blocks_user_blocked"),
        Index("ix_practice_blocks_user_blocked", "user_id", "blocked_user_id"),
    )
