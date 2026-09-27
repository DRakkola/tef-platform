"""Pydantic schemas for Speaking Examiner active model configurations."""

import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field


class SpeakingExaminerConfigResponse(BaseModel):
    """Response schema for active Speaking Examiner configuration."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    section: str
    model: str
    voice_persona: str
    system_prompt: str
    scepticism_level: float
    temperature: float
    top_p: float
    created_at: datetime.datetime
    updated_at: datetime.datetime


class SpeakingExaminerConfigUpdateRequest(BaseModel):
    """Request schema for deploying tuned examiner settings to production."""

    section: str = Field(..., description="TEF Section ('section_a' or 'section_b')")
    model: str = Field(default="models/gemini-3.8-live", description="Gemini model identifier")
    voice_persona: str = Field(default="Aoede", description="Voice persona: Aoede, Charon, Fenrir, Kore, Puck")
    system_prompt: str = Field(..., description="Examiner system instructions")
    scepticism_level: float = Field(default=0.5, ge=0.0, le=1.0, description="Resistance level for Section B")
    temperature: float = Field(default=0.7, ge=0.0, le=1.5, description="Generation temperature")
    top_p: float = Field(default=0.95, ge=0.0, le=1.0, description="Nucleus sampling top_p")
