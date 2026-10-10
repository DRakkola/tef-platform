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


class BulkImportQuestionItem(BaseModel):
    temp_id: str | None = None
    prompt: str
    question_type: str = "single_choice"
    response_type: str = "single_choice"
    modality: str = "reading"
    level: str = "B1"
    target_cefr: str | None = None
    difficulty: int = 3
    cognitive_complexity: str | None = "understand"
    points: int = 1
    penalty_points: int = 0
    explanation: str | None = None
    stimulus_title: str | None = None
    stimulus_text: str | None = None
    stimulus_id: uuid.UUID | None = None
    media_url: str | None = None
    options: list[BulkOptionPayload] = []
    skill_codes: list[str] = []
    is_valid: bool = True
    validation_errors: list[str] = []


class BulkParseResponse(BaseModel):
    items: list[BulkImportQuestionItem]
    total_parsed: int
    valid_count: int
    invalid_count: int
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


class BulkImportCommitResponse(BaseModel):
    created_count: int
    created_ids: list[uuid.UUID] = []
    errors: list[dict[str, Any]] = []
