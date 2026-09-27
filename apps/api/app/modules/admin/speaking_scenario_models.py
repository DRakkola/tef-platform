"""SQLAlchemy model for authentic TEF Oral Exam Scenarios with guardrail definitions."""

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import TimeStampedUUIDModel

if TYPE_CHECKING:
    from app.modules.users.models import User


class SpeakingScenario(TimeStampedUUIDModel):
    """Stores authentic TEF Section A / Section B oral examination scenarios.

    Each scenario encapsulates the stimulus document (advertisement or opinion article),
    the examiner persona, factual knowledge ground truth, Section B objection cards,
    and rigid scope limits / in-character pedagogical guardrails.
    """

    __tablename__ = "speaking_scenarios"

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )  # e.g. 'SCEN-A-01', 'SCEN-B-03'
    section: Mapped[str] = mapped_column(
        String(50),
        index=True,
        nullable=False,
    )  # 'section_a', 'section_b'
    target_level: Mapped[str] = mapped_column(
        String(10),
        default="B2",
        nullable=False,
    )  # 'A2', 'B1', 'B2', 'C1'
    difficulty: Mapped[str] = mapped_column(
        String(50),
        default="standard",
        nullable=False,
    )  # 'standard', 'challenging', 'lenient'
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        index=True,
        nullable=False,
    )

    # 1. Stimulus Document (shown to candidate)
    document_title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    document_content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    document_image_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # 2. Examiner Persona & Stance
    role_title: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )  # e.g. "Responsable des inscriptions", "Colocataire économe"
    persona_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )  # e.g. "M. Lambert", "Lucas"
    voice_persona: Mapped[str] = mapped_column(
        String(50),
        default="Aoede",
        nullable=False,
    )  # Aoede, Charon, Fenrir, Kore, Puck
    register: Mapped[str] = mapped_column(
        String(20),
        default="formal",
        nullable=False,
    )  # 'formal' (vouvoiement) | 'informal' (tutoiement)
    temperament: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )  # e.g. "Professionnel, poli mais pressé. Ne donne pas d'informations non sollicitées."
    scepticism_level: Mapped[float] = mapped_column(
        Float,
        default=0.5,
        nullable=False,
    )  # Resistance level for Section B (0.0 - 1.0)

    # 3. Factual Ground Truth & Objection Trees
    known_facts: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )  # e.g. [{"category": "tarifs", "fact": "45€ / séance", "detail": "Réduction de 10% pour étudiants"}]
    omitted_facts: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )  # Details missing from the ad that candidate is expected to ask
    objection_cards: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )  # Section B objections: [{"trigger": "prix", "objection": "C'est beaucoup trop cher", "concession": "Si paiement en 3 fois..."}]

    # 4. Scope Limits & Pedagogical Guardrails
    scope_description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )  # Explicit scope: "Uniquement l'inscription et le fonctionnement du club de plongée"
    forbidden_topics: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )  # Out-of-bounds topics to refuse
    redirection_phrases: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )  # In-character French redirection phrases
    custom_instructions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by: Mapped[User | None] = relationship("User", foreign_keys=[created_by_id])

    __table_args__ = (
        Index("ix_speaking_scenarios_section_level", "section", "target_level"),
        Index("ix_speaking_scenarios_active_section", "is_active", "section"),
    )
