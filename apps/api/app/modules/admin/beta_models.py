"""SQLAlchemy models for Controlled Beta Cohorts and Cryptographic Invitations."""

import datetime
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import TimeStampedUUIDModel
from app.modules.users.models import UserRole

if TYPE_CHECKING:
    from app.modules.users.models import User


class BetaCohort(TimeStampedUUIDModel):
    """Logical grouping for controlled private beta participants."""

    __tablename__ = "beta_cohorts"

    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    max_students: Mapped[int] = mapped_column(
        Integer,
        default=50,
        nullable=False,
    )
    max_teachers: Mapped[int] = mapped_column(
        Integer,
        default=15,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )
    feature_overrides: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )

    # Relationships
    invitations: Mapped[list[BetaInvitation]] = relationship(
        "BetaInvitation",
        back_populates="cohort",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    users: Mapped[list[User]] = relationship(
        "User",
        back_populates="beta_cohort",
        lazy="selectin",
    )


class BetaInvitation(TimeStampedUUIDModel):
    """Cryptographic single-use or multi-use invitation token for private beta onboarding."""

    __tablename__ = "beta_invitations"

    token_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )
    token_prefix: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
    )
    cohort_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("beta_cohorts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole, name="user_role", native_enum=False),
        default=UserRole.STUDENT,
        nullable=False,
    )
    max_uses: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    used_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    expires_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    environment: Mapped[str] = mapped_column(
        String(20),
        default="production",
        nullable=False,
    )
    is_revoked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    cohort: Mapped[BetaCohort | None] = relationship(
        "BetaCohort",
        back_populates="invitations",
        lazy="selectin",
    )
    created_by: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[created_by_user_id],
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_beta_invitations_token_active", "token_hash", "is_revoked", "expires_at"),
    )


class BetaRateLimit(TimeStampedUUIDModel):
    """Authoritative rate limits and consumption quotas for Private Beta.

    Can be scoped to:
    - 'global': Applies to all beta users unless overridden.
    - 'cohort': Applies to all members of a specific BetaCohort.
    - 'user': Applies to a specific student User.
    """

    __tablename__ = "beta_rate_limits"

    scope: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )  # 'global', 'cohort', 'user'
    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )  # e.g. 'ai_oral', 'ai_writing', 'practice_pool', 'teacher_booking', 'file_upload'
    limit_value: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    window: Mapped[str] = mapped_column(
        String(20),
        default="daily",
        nullable=False,
    )  # 'daily', 'weekly'
    cohort_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("beta_cohorts.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    cohort: Mapped[BetaCohort | None] = relationship(
        "BetaCohort",
        foreign_keys=[cohort_id],
        lazy="selectin",
    )
    user: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="selectin",
    )
    created_by: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[created_by_user_id],
        lazy="selectin",
    )

    __table_args__ = (
        Index(
            "uq_beta_rate_limits_global",
            "action",
            unique=True,
            postgresql_where=text("scope = 'global'"),
            sqlite_where=text("scope = 'global'"),
        ),
        Index(
            "uq_beta_rate_limits_cohort",
            "cohort_id",
            "action",
            unique=True,
            postgresql_where=text("scope = 'cohort'"),
            sqlite_where=text("scope = 'cohort'"),
        ),
        Index(
            "uq_beta_rate_limits_user",
            "user_id",
            "action",
            unique=True,
            postgresql_where=text("scope = 'user'"),
            sqlite_where=text("scope = 'user'"),
        ),
    )
