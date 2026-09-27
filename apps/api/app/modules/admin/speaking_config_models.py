"""SQLAlchemy model for active Speaking Examiner production model configurations."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import TimeStampedUUIDModel

if TYPE_CHECKING:
    from app.modules.users.models import User


class SpeakingExaminerConfig(TimeStampedUUIDModel):
    """Stores the active production examiner configuration per TEF speaking section."""

    __tablename__ = "speaking_examiner_configs"

    section: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )  # 'section_a', 'section_b'

    model: Mapped[str] = mapped_column(
        String(100),
        default="models/gemini-3.8-live",
        nullable=False,
    )

    voice_persona: Mapped[str] = mapped_column(
        String(50),
        default="Aoede",
        nullable=False,
    )

    system_prompt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    scepticism_level: Mapped[float] = mapped_column(
        Float,
        default=0.5,
        nullable=False,
    )

    temperature: Mapped[float] = mapped_column(
        Float,
        default=0.7,
        nullable=False,
    )

    top_p: Mapped[float] = mapped_column(
        Float,
        default=0.95,
        nullable=False,
    )

    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    updated_by: Mapped[User | None] = relationship("User", foreign_keys=[updated_by_id])
