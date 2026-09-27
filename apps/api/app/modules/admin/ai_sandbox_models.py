"""SQLAlchemy models for AI Sandbox & Benchmarking Studio."""

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    Boolean,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import TimeStampedUUIDModel

if TYPE_CHECKING:
    from app.modules.users.models import User


class AIPromptTemplate(TimeStampedUUIDModel):
    """Reusable prompt template and system instruction preset for AI capabilities."""

    __tablename__ = "ai_prompt_templates"

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    feature_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
        doc="'writing', 'speaking', or 'raw'",
    )
    system_prompt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    user_prompt_template: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    default_model: Mapped[str] = mapped_column(
        String(50),
        default="models/gemini-3.5-flash",
        nullable=False,
    )
    default_temperature: Mapped[float] = mapped_column(
        Float,
        default=0.7,
        nullable=False,
    )
    is_system_preset: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    created_by: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[created_by_id],
    )
    runs: Mapped[list[AISandboxRun]] = relationship(
        "AISandboxRun",
        back_populates="template",
        cascade="all, delete-orphan",
    )


class AISandboxRun(TimeStampedUUIDModel):
    """Historical record of an AI test execution in the Admin Sandbox."""

    __tablename__ = "ai_sandbox_runs"

    feature_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
        doc="'writing', 'speaking', or 'raw'",
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_prompt_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    model: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    temperature: Mapped[float] = mapped_column(
        Float,
        default=0.7,
        nullable=False,
    )
    system_prompt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    user_prompt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    input_context: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    raw_output: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    parsed_result: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )
    latency_ms: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    prompt_tokens: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    completion_tokens: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    total_tokens: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    estimated_cost_usd: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    is_simulation: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    created_by: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[created_by_id],
    )
    template: Mapped[AIPromptTemplate | None] = relationship(
        "AIPromptTemplate",
        back_populates="runs",
    )


# Indexes for rapid retrieval and comparison
Index("ix_ai_sandbox_runs_created_at_desc", AISandboxRun.created_at.desc())
Index("ix_ai_sandbox_runs_feature_created_at", AISandboxRun.feature_type, AISandboxRun.created_at.desc())
