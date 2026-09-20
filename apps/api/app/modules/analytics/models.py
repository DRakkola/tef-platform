"""SQLAlchemy models for Analytics, Feedback, Support Tickets, and Product Experiments."""

import datetime
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
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

from app.core.database import TimeStampedUUIDModel, UUIDModel
from app.modules.analytics.enums import (
    ExperimentStatus,
    FeedbackCategory,
    SupportTicketPriority,
    SupportTicketStatus,
)

if TYPE_CHECKING:
    from app.modules.users.models import User


class AnalyticsEvent(UUIDModel):
    """Immutable structured product telemetry event."""

    __tablename__ = "analytics_events"

    # event_id acts as primary key and idempotency token
    event_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    session_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )
    entity_type: Mapped[str | None] = mapped_column(
        String(64),
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
    schema_version: Mapped[str] = mapped_column(
        String(16),
        default="v1.0.0",
        nullable=False,
    )
    occurred_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    received_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_analytics_event_type_occurred", "event_type", "occurred_at"),
        Index("ix_analytics_actor_occurred", "actor_id", "occurred_at"),
    )


class UserFeedback(UUIDModel):
    """Structured student or user feedback and ratings."""

    __tablename__ = "user_feedback"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category: Mapped[FeedbackCategory] = mapped_column(
        SQLEnum(FeedbackCategory, name="feedback_category", native_enum=False),
        default=FeedbackCategory.GENERAL,
        nullable=False,
        index=True,
    )
    rating: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    context_url: Mapped[str | None] = mapped_column(
        String(255),
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
    )

    user: Mapped["User"] = relationship("User")


class SupportTicket(TimeStampedUUIDModel):
    """Customer and beta operational support tickets."""

    __tablename__ = "support_tickets"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    category: Mapped[str] = mapped_column(
        String(32),
        default="general",
        nullable=False,
        index=True,
    )
    subject: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    status: Mapped[SupportTicketStatus] = mapped_column(
        SQLEnum(SupportTicketStatus, name="support_ticket_status", native_enum=False),
        default=SupportTicketStatus.OPEN,
        nullable=False,
        index=True,
    )
    priority: Mapped[SupportTicketPriority] = mapped_column(
        SQLEnum(SupportTicketPriority, name="support_ticket_priority", native_enum=False),
        default=SupportTicketPriority.MEDIUM,
        nullable=False,
        index=True,
    )
    context_payload: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    internal_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    user: Mapped["User"] = relationship("User")


class Experiment(TimeStampedUUIDModel):
    """Controlled feature experiment for A/B testing product improvements."""

    __tablename__ = "experiments"

    key: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[ExperimentStatus] = mapped_column(
        SQLEnum(ExperimentStatus, name="experiment_status", native_enum=False),
        default=ExperimentStatus.DRAFT,
        nullable=False,
        index=True,
    )
    target_audience: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )

    variants: Mapped[list["ExperimentVariant"]] = relationship(
        "ExperimentVariant",
        back_populates="experiment",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ExperimentVariant(UUIDModel):
    """Specific variant within an experiment."""

    __tablename__ = "experiment_variants"

    experiment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("experiments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    key: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
    )
    weight: Mapped[int] = mapped_column(
        Integer,
        default=50,
        nullable=False,
    )
    config_payload: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    experiment: Mapped["Experiment"] = relationship("Experiment", back_populates="variants")

    __table_args__ = (
        UniqueConstraint("experiment_id", "key", name="uq_experiment_variant_key"),
    )


class ExperimentAssignment(UUIDModel):
    """User assignment to an experiment variant."""

    __tablename__ = "experiment_assignments"

    experiment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("experiments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    variant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("experiment_variants.id", ondelete="CASCADE"),
        nullable=False,
    )
    assigned_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("experiment_id", "user_id", name="uq_experiment_user_assignment"),
    )
