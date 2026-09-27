"""Pydantic schemas for Speaking Exam Scenarios and Guardrail configurations."""

import datetime
import uuid
import warnings
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

warnings.filterwarnings("ignore", message=r'Field name "register" in .* shadows an attribute in parent "BaseModel"')


class SpeakingScenarioResponse(BaseModel):
    """Full schema for a Speaking Exam Scenario."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    code: str
    section: str
    target_level: str
    difficulty: str
    is_active: bool

    # Stimulus document
    document_title: str
    document_content: str
    document_image_url: str | None = None

    # Persona & voice
    role_title: str
    persona_name: str
    voice_persona: str
    register: str
    temperament: str | None = None
    scepticism_level: float

    # Ground truth & objections
    known_facts: list[dict[str, Any]] = Field(default_factory=list)
    omitted_facts: list[str] = Field(default_factory=list)
    objection_cards: list[dict[str, Any]] = Field(default_factory=list)

    # Scope limits & guardrails
    scope_description: str | None = None
    forbidden_topics: list[str] = Field(default_factory=list)
    redirection_phrases: list[str] = Field(default_factory=list)
    custom_instructions: str | None = None

    created_at: datetime.datetime
    updated_at: datetime.datetime


class SpeakingScenarioCreateRequest(BaseModel):
    """Request schema for creating a new speaking scenario."""

    title: str = Field(..., min_length=2, max_length=255, description="Titre du scénario")
    code: str = Field(..., min_length=2, max_length=50, description="Code unique (ex: SCEN-A-01)")
    section: str = Field(..., description="'section_a' ou 'section_b'")
    target_level: str = Field(default="B2", description="Niveau CEFR visé (A2, B1, B2, C1)")
    difficulty: str = Field(default="standard", description="Difficulté ('standard', 'challenging', 'lenient')")
    is_active: bool = Field(default=True, description="Actif pour les épreuves étudiantes")

    # Stimulus document
    document_title: str = Field(..., min_length=2, max_length=255)
    document_content: str = Field(..., min_length=10, description="Texte de l'annonce ou de l'article")
    document_image_url: str | None = None

    # Persona & voice
    role_title: str = Field(..., description="Rôle incarné (ex: Responsable d'accueil)")
    persona_name: str = Field(..., description="Nom de l'interlocuteur (ex: M. Duval)")
    voice_persona: str = Field(default="Aoede", description="Aoede, Charon, Fenrir, Kore, Puck")
    register: str = Field(default="formal", description="'formal' (vouvoiement) ou 'informal' (tutoiement)")
    temperament: str | None = None
    scepticism_level: float = Field(default=0.5, ge=0.0, le=1.0)

    # Ground truth & objections
    known_facts: list[dict[str, Any]] = Field(default_factory=list)
    omitted_facts: list[str] = Field(default_factory=list)
    objection_cards: list[dict[str, Any]] = Field(default_factory=list)

    # Scope limits & guardrails
    scope_description: str | None = None
    forbidden_topics: list[str] = Field(default_factory=list)
    redirection_phrases: list[str] = Field(default_factory=list)
    custom_instructions: str | None = None


class SpeakingScenarioUpdateRequest(BaseModel):
    """Request schema for updating an existing speaking scenario."""

    title: str | None = None
    code: str | None = None
    section: str | None = None
    target_level: str | None = None
    difficulty: str | None = None
    is_active: bool | None = None

    document_title: str | None = None
    document_content: str | None = None
    document_image_url: str | None = None

    role_title: str | None = None
    persona_name: str | None = None
    voice_persona: str | None = None
    register: str | None = None
    temperament: str | None = None
    scepticism_level: float | None = Field(default=None, ge=0.0, le=1.0)

    known_facts: list[dict[str, Any]] | None = None
    omitted_facts: list[str] | None = None
    objection_cards: list[dict[str, Any]] | None = None

    scope_description: str | None = None
    forbidden_topics: list[str] | None = None
    redirection_phrases: list[str] | None = None
    custom_instructions: str | None = None


class SpeakingScenarioListResponse(BaseModel):
    """Paginated or listed response for scenarios."""

    items: list[SpeakingScenarioResponse]
    total: int
