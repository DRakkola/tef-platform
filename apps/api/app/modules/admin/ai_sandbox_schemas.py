"""Pydantic request and response schemas for AI Sandbox & Benchmarking Studio."""

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Prompt Template Schemas
# ---------------------------------------------------------------------------
class AIPromptTemplateBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: str | None = None
    feature_type: str = Field(..., pattern="^(writing|speaking|raw)$")
    system_prompt: str
    user_prompt_template: str | None = None
    default_model: str = "models/gemini-3.5-flash"
    default_temperature: float = Field(0.7, ge=0.0, le=2.0)


class AIPromptTemplateCreate(AIPromptTemplateBase):
    pass


class AIPromptTemplateUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    description: str | None = None
    feature_type: str | None = Field(None, pattern="^(writing|speaking|raw)$")
    system_prompt: str | None = None
    user_prompt_template: str | None = None
    default_model: str | None = None
    default_temperature: float | None = Field(None, ge=0.0, le=2.0)


class AIPromptTemplateResponse(AIPromptTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_system_preset: bool
    created_by_id: uuid.UUID | None
    created_at: datetime.datetime
    updated_at: datetime.datetime


# ---------------------------------------------------------------------------
# Writing Sandbox Schemas
# ---------------------------------------------------------------------------
class WritingCriteriaBreakdown(BaseModel):
    task_completion: float = Field(..., description="Respect de la consigne et volume (0-25)")
    coherence_cohesion: float = Field(..., description="Structure et connecteurs logiques (0-25)")
    vocabulary_range_accuracy: float = Field(..., description="Richesse lexicale et précision (0-25)")
    grammatical_range_accuracy: float = Field(..., description="Morphosyntaxe et orthographe (0-25)")
    detailed_notes: dict[str, str] | None = None


class WritingErrorSpan(BaseModel):
    error_text: str
    start_index: int = 0
    end_index: int = 0
    error_type: str  # 'grammar', 'orthography', 'syntax', 'vocabulary', 'register'
    suggestion: str
    explanation: str


class WritingTestResult(BaseModel):
    score: float = Field(..., ge=0, le=100)
    tef_points: int = Field(..., ge=0, le=698)
    cefr_level: str
    criteria: WritingCriteriaBreakdown
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    errors: list[WritingErrorSpan] = Field(default_factory=list)
    corrected_text: str
    recommendations: list[str] = Field(default_factory=list)
    overall_feedback: str


class WritingTestRunRequest(BaseModel):
    task_prompt: str
    section: str = Field("section_b", pattern="^(section_a|section_b)$")
    target_level: str = "B2"
    student_draft: str
    system_prompt: str | None = None
    model: str = "models/gemini-3.5-flash"
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    template_id: uuid.UUID | None = None
    force_simulation: bool = False
    api_key_override: str | None = None


# ---------------------------------------------------------------------------
# Speaking Sandbox Schemas
# ---------------------------------------------------------------------------
class SpeakingTurnMessage(BaseModel):
    role: str = Field(..., pattern="^(examiner|candidate)$")
    content: str


class SpeakingTurnTestRequest(BaseModel):
    section: str = Field("section_a", pattern="^(section_a|section_b)$")
    topic: str
    target_level: str = "B2"
    candidate_message: str
    dialogue_history: list[SpeakingTurnMessage] = Field(default_factory=list)
    system_prompt: str | None = None
    voice_persona: str = "Aoede"
    scepticism_level: float = Field(0.5, ge=0.0, le=1.0)
    model: str = "models/gemini-3.5-flash"
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    top_p: float = Field(0.95, ge=0.0, le=1.0)
    template_id: uuid.UUID | None = None
    force_simulation: bool = False
    api_key_override: str | None = None


class SpeakingTurnTestResponse(BaseModel):
    examiner_reply: str
    voice_persona: str = "Aoede"
    audio_base64: str | None = None
    latency_ms: int
    tokens_used: int
    is_simulation: bool
    notes: str | None = None


class SpeakingEvaluationTestRequest(BaseModel):
    section: str = Field("section_a", pattern="^(section_a|section_b)$")
    topic: str
    target_level: str = "B2"
    transcription: str
    system_prompt: str | None = None
    model: str = "models/gemini-3.5-flash"
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    template_id: uuid.UUID | None = None
    force_simulation: bool = False
    api_key_override: str | None = None


class SpeakingEvaluationTestResult(BaseModel):
    tef_points: int = Field(..., ge=0, le=698)
    cefr_level: str
    score: float = Field(..., ge=0, le=100)
    pronunciation_fluency: float = Field(..., ge=0, le=25)
    lexical_resource: float = Field(..., ge=0, le=25)
    grammatical_accuracy: float = Field(..., ge=0, le=25)
    interaction_coherence: float = Field(..., ge=0, le=25)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    examiner_feedback: str


# ---------------------------------------------------------------------------
# Raw Prompt Schemas
# ---------------------------------------------------------------------------
class RawPromptTestRequest(BaseModel):
    system_prompt: str
    user_prompt: str
    model: str = "models/gemini-3.5-flash"
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(2048, ge=64, le=8192)
    template_id: uuid.UUID | None = None
    force_simulation: bool = False
    api_key_override: str | None = None


class RawPromptTestResponse(BaseModel):
    output_text: str
    latency_ms: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    is_simulation: bool


# ---------------------------------------------------------------------------
# Execution Run & Comparison Schemas
# ---------------------------------------------------------------------------
class AISandboxRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    feature_type: str
    template_id: uuid.UUID | None
    model: str
    temperature: float
    system_prompt: str
    user_prompt: str
    input_context: dict[str, Any]
    raw_output: str
    parsed_result: dict[str, Any] | None
    latency_ms: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float
    is_simulation: bool
    created_by_id: uuid.UUID | None
    created_at: datetime.datetime


class AISandboxRunListResponse(BaseModel):
    items: list[AISandboxRunResponse]
    total: int
    page: int
    page_size: int


class AISandboxCompareRequest(BaseModel):
    run_id_a: uuid.UUID
    run_id_b: uuid.UUID


class AISandboxCompareResponse(BaseModel):
    run_a: AISandboxRunResponse
    run_b: AISandboxRunResponse
    score_difference: float | None
    latency_difference_ms: int
    token_difference: int
    prompt_diff_summary: str
    evaluation_diff_summary: str


# ---------------------------------------------------------------------------
# Curated Benchmarks & Live Submission Import
# ---------------------------------------------------------------------------
class BenchmarkSample(BaseModel):
    id: str
    title: str
    feature_type: str
    section: str
    cefr_level: str
    task_prompt: str
    sample_content: str
    description: str
    expected_score_range: str


class BenchmarkListResponse(BaseModel):
    samples: list[BenchmarkSample]


class ImportedSubmissionResponse(BaseModel):
    submission_id: uuid.UUID
    task_id: uuid.UUID
    task_title: str
    task_prompt: str
    section: str
    student_draft: str
    word_count: int
    submitted_at: datetime.datetime
