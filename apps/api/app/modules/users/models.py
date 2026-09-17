"""SQLAlchemy models for Users, Refresh Tokens, and Profiles."""

import datetime
import uuid
from enum import Enum
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.modules.teachers.models import (
        TeacherAvailabilityException,
        TeacherAvailabilityRule,
        TeacherBooking,
    )

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
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


class UserRole(str, Enum):
    """User roles supported across the TEF platform."""

    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class TeacherVerificationStatus(str, Enum):
    """Teacher verification status for onboarding and bookings."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class User(TimeStampedUUIDModel):
    """User entity representing platform accounts."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole, name="user_role", native_enum=False),
        default=UserRole.STUDENT,
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    last_login_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # 1-to-1 Profile Relationships
    student_profile: Mapped[StudentProfile | None] = relationship(
        "StudentProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    teacher_profile: Mapped[TeacherProfile | None] = relationship(
        "TeacherProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # 1-to-many Session / Refresh Tokens
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # Bookings made as a student
    student_bookings: Mapped[list[TeacherBooking]] = relationship(
        "TeacherBooking",
        foreign_keys="TeacherBooking.student_id",
        back_populates="student",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class RefreshToken(TimeStampedUUIDModel):
    """Persistent store for cryptographic refresh token hashes.

    Plaintext tokens are NEVER stored in the database.
    """

    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    expires_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    revoked_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
    )
    user_agent: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    user: Mapped[User] = relationship("User", back_populates="refresh_tokens")


class StudentProfile(TimeStampedUUIDModel):
    """Student profile capturing target exam goals and learning preferences."""

    __tablename__ = "student_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    target_exam: Mapped[str] = mapped_column(
        String(50),
        default="TEF Canada",
        nullable=False,
    )
    target_level: Mapped[str] = mapped_column(
        String(10),
        default="B2",
        nullable=False,
    )
    timezone: Mapped[str] = mapped_column(
        String(50),
        default="UTC",
        nullable=False,
    )
    native_language: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    learning_preferences: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )

    user: Mapped[User] = relationship("User", back_populates="student_profile")


class TeacherProfile(TimeStampedUUIDModel):
    """Teacher profile capturing teaching credentials, expertise, and pricing."""

    __tablename__ = "teacher_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    display_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    bio: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    expertise: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    teaching_levels: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    hourly_price: Mapped[int] = mapped_column(
        Integer,
        default=3500,  # in cents: $35.00
        nullable=False,
    )
    verification_status: Mapped[TeacherVerificationStatus] = mapped_column(
        SQLEnum(TeacherVerificationStatus, name="teacher_verification_status", native_enum=False),
        default=TeacherVerificationStatus.PENDING,
        nullable=False,
        index=True,
    )
    timezone: Mapped[str] = mapped_column(
        String(50),
        default="UTC",
        nullable=False,
    )

    user: Mapped[User] = relationship("User", back_populates="teacher_profile")

    # Availability & Bookings relationships
    availability_rules: Mapped[list[TeacherAvailabilityRule]] = relationship(
        "TeacherAvailabilityRule",
        back_populates="teacher",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    availability_exceptions: Mapped[list[TeacherAvailabilityException]] = relationship(
        "TeacherAvailabilityException",
        back_populates="teacher",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    bookings: Mapped[list[TeacherBooking]] = relationship(
        "TeacherBooking",
        back_populates="teacher",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
