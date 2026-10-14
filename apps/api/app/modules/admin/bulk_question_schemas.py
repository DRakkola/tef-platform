"""Pydantic schemas for Question Bank Bulk Operations, File Parsing, AI Auto-Tagging, and Bulk Import."""

from __future__ import annotations

import uuid
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class BulkActionType(str, Enum):
    PUBLISH = "publish"
    ARCHIVE = "archive"
    DELETE = "delete"
    VALIDATE = "validate"


class BulkActionRequest(BaseModel):
    question_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=500)
    action: BulkActionType
    notes: str | None = Field(default=None, max_length=500)


class BulkActionErrorDetail(BaseModel):
    question_id: uuid.UUID
    code: str
    message: str


class BulkActionResponse(BaseModel):
    action: BulkActionType
    total_requested: int
    success_count: int
    failure_count: int
    affected_ids: list[uuid.UUID] = []
    errors: list[BulkActionErrorDetail] = []


class BulkOptionPayload(BaseModel):
    content: str
    is_correct: bool = False
    explanation: str | None = None
    order_index: int = 0
    misconception_type: str | None = None
    distractor_rationale: str | None = None


class BulkGapChoiceOption(BaseModel):
    content: str
    is_correct: bool = False
    order_index: int = 0
    misconception_type: str | None = None
    distractor_rationale: str | None = None
    explanation: str | None = None


class BulkGapItem(BaseModel):
    gap_id: str = "1"
    order_index: int = 0
    cue_text: str | None = None
    options: list[BulkGapChoiceOption] = []
    expected_answers: list[str] = []
    case_sensitive: bool = False


class BulkImportQuestionItem(BaseModel):
    temp_id: str | None = None
    prompt: str
    question_type: str = "single_choice"
    response_type: str = "single_choice"
    task_type_code: str | None = None
    modality: str = "reading"
    level: str = "B1"
    target_cefr: str | None = None
    difficulty: int = 3
    cognitive_complexity: str | None = "interpretation"
    points: int = 1
    penalty_points: int = 0
    explanation: str | None = None
    stimulus_title: str | None = None
    stimulus_text: str | None = None
    stimulus_id: uuid.UUID | None = None
    media_url: str | None = None
    options: list[BulkOptionPayload] = []
    gaps: list[BulkGapItem] = []
    scoring_payload: dict[str, Any] | None = None
    skill_codes: list[str] = []
    is_valid: bool = True
    validation_errors: list[str] = []
    is_duplicate: bool = False
    duplicate_reason: str | None = None
    duplicate_similarity: float = 0.0


class BulkParseResponse(BaseModel):
    items: list[BulkImportQuestionItem]
    total_parsed: int
    valid_count: int
    invalid_count: int
    duplicate_count: int = 0
    parse_errors: list[str] = []


class AIAutoTagAndFormatRequest(BaseModel):
    items: list[BulkImportQuestionItem] = Field(..., max_length=100)
    auto_tag_skills: bool = True
    auto_format_rich_text: bool = True


class AIAutoTagAndFormatResponse(BaseModel):
    items: list[BulkImportQuestionItem]
    enriched_count: int


class BulkImportCommitRequest(BaseModel):
    items: list[BulkImportQuestionItem] = Field(..., min_length=1, max_length=500)
    default_status: str = Field(default="draft", pattern=r"^(draft|in_review|approved|published)$")
    skip_duplicates: bool = True


class BulkImportCommitResponse(BaseModel):
    created_count: int
    skipped_duplicates_count: int = 0
    created_ids: list[uuid.UUID] = []
    errors: list[dict[str, Any]] = []
