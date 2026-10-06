"""Canonical Question Validation Engine (V2).

Performs comprehensive automated linting, psychometric validation, taxonomy alignment,
and quality auditing for TEF questions.
"""

from __future__ import annotations

import datetime
import re
import uuid
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import inspect as sa_inspect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.question_formats import standard_option_count_for
from app.modules.admin.tagging_service import TaggingValidationEngine
from app.modules.assessments.enums import (
    CognitiveComplexityLevel,
    QuestionAuthorType,
    QuestionResponseType,
    QuestionType,
    QuestionValidationStatus,
)
from app.modules.assessments.models import (
    Question,
    QuestionOption,
    QuestionProvenance,
    QuestionSkillTag,
    QuestionValidation,
    Stimulus,
    TaskType,
)


class ValidationSeverity(str, Enum):
    """Validation issue severity levels."""

    BLOCKING = "blocking"
    WARNING = "warning"
    INFO = "info"


class ValidationIssue(BaseModel):
    """Structured validation finding."""

    model_config = ConfigDict(from_attributes=True)

    code: str
    severity: ValidationSeverity
    field: str | None = None
    message: str
    rule: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ValidationResult(BaseModel):
    """Aggregated validation audit report."""

    model_config = ConfigDict(from_attributes=True)

    valid: bool = True
    status: str = QuestionValidationStatus.VALID.value
    errors: list[ValidationIssue] = Field(default_factory=list)
    warnings: list[ValidationIssue] = Field(default_factory=list)
    informational: list[ValidationIssue] = Field(default_factory=list)
    validator_version: str = "v2.0.0"
    validated_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC)
    )
    question_id: uuid.UUID | None = None

    def add_issue(self, issue: ValidationIssue) -> None:
        """Add an issue and update validity and status."""
        if issue.severity == ValidationSeverity.BLOCKING:
            self.errors.append(issue)
            self.valid = False
            self.status = QuestionValidationStatus.BLOCKING.value
        elif issue.severity == ValidationSeverity.WARNING:
            self.warnings.append(issue)
            if self.valid:
                self.status = QuestionValidationStatus.WARNING.value
        else:
            self.informational.append(issue)

    def add_error(
        self,
        code: str,
        message: str,
        rule: str,
        field: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ValidationIssue:
        """Create and add a BLOCKING error."""
        issue = ValidationIssue(
            code=code,
            severity=ValidationSeverity.BLOCKING,
            field=field,
            message=message,
            rule=rule,
            metadata=metadata or {},
        )
        self.add_issue(issue)
        return issue

    def add_warning(
        self,
        code: str,
        message: str,
        rule: str,
        field: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ValidationIssue:
        """Create and add a WARNING."""
        issue = ValidationIssue(
            code=code,
            severity=ValidationSeverity.WARNING,
            field=field,
            message=message,
            rule=rule,
            metadata=metadata or {},
        )
        self.add_issue(issue)
        return issue

    def add_info(
        self,
        code: str,
        message: str,
        rule: str,
        field: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ValidationIssue:
        """Create and add an INFORMATIONAL finding."""
        issue = ValidationIssue(
            code=code,
            severity=ValidationSeverity.INFO,
            field=field,
            message=message,
            rule=rule,
            metadata=metadata or {},
        )
        self.add_issue(issue)
        return issue

    def to_payload(self) -> list[dict[str, Any]]:
        """Serialize all issues for database json storage."""
        all_issues = self.errors + self.warnings + self.informational
        return [i.model_dump(mode="json") for i in all_issues]

    @property
    def blocking_error_count(self) -> int:
        """Count of blocking errors."""
        return len(self.errors)

    @property
    def warning_count(self) -> int:
        """Count of warnings."""
        return len(self.warnings)

    @property
    def info_count(self) -> int:
        """Count of informational findings."""
        return len(self.informational)


# CEFR expected bands for difficulty rating checks
CEFR_DIFFICULTY_BANDS: dict[str, tuple[int, int]] = {
    "A1": (100, 199),
    "A2": (200, 299),
    "B1": (300, 399),
    "B2": (400, 499),
    "C1": (500, 599),
    "C2": (600, 699),
}

# Task types that require a stimulus or stimulus text in TEF Reading
STIMULUS_REQUIRED_TASK_TYPES: frozenset[str] = frozenset({
    "press_article",
    "daily_document",
    "administrative_document",
    "professional_document",
    "document_matching",
    "graph_matching",
    "fait_divers",
})

# Suspicious "all / none of the above" phrasing patterns
ALL_OR_NONE_PATTERNS: tuple[re.Pattern, ...] = (
    re.compile(r"\btoutes?\s+les\s+(réponses|affirmations|options|propositions)\b", re.IGNORECASE),
    re.compile(r"\baucune?\s+(de\s+ces|des)\s+(réponses|affirmations|options|propositions)\b", re.IGNORECASE),
    re.compile(r"\baucun\s+des\s+choix\b", re.IGNORECASE),
    re.compile(r"\btous\s+les\s+choix\b", re.IGNORECASE),
    re.compile(r"\ball\s+of\s+the\s+above\b", re.IGNORECASE),
    re.compile(r"\bnone\s+of\s+the\s+above\b", re.IGNORECASE),
)


class _NormalizedQuestionData:
    """Internal adapter normalizing ORM models, Pydantic schemas, and dicts."""

    def __init__(
        self,
        id: uuid.UUID | None,
        prompt: str,
        instructions: str | None,
        response_type: str,
        target_cefr: str | None,
        difficulty_rating: int | None,
        cognitive_complexity: str | None,
        scoring_payload: dict[str, Any] | None,
        author_type: str | None,
        options: list[Any],
        skill_tags: list[Any],
        stimulus_id: uuid.UUID | None,
        stimulus_text: str | None,
        task_type_id: uuid.UUID | None,
        provenance: Any | None,
    ):
        self.id = id
        self.prompt = prompt
        self.instructions = instructions
        self.response_type = response_type
        self.target_cefr = target_cefr
        self.difficulty_rating = difficulty_rating
        self.cognitive_complexity = cognitive_complexity
        self.scoring_payload = scoring_payload
        self.author_type = author_type
        self.options = options
        self.skill_tags = skill_tags
        self.stimulus_id = stimulus_id
        self.stimulus_text = stimulus_text
        self.task_type_id = task_type_id
        self.provenance = provenance


class QuestionValidationEngine:
    """Canonical validation and quality audit engine for questions."""

    VALIDATOR_VERSION: str = "v2.0.0"

    @classmethod
    async def validate_question(
        cls,
        db: AsyncSession,
        question: Question | Any,
        task_type_id: uuid.UUID | None = None,
        check_duplication: bool = True,
    ) -> ValidationResult:
        """Validate a question against all structural, pedagogical, and quality rules."""
        data = await cls._extract_question_data(db, question, task_type_id)
        result = ValidationResult(
            validator_version=cls.VALIDATOR_VERSION,
            question_id=data.id,
        )

        # 1. Structural checks
        cls._validate_structural(data, result)

        # 2. Option quality checks
        cls._validate_options(data, result)

        # 3. Answer clueing checks
        cls._validate_clueing(data, result)

        # 4. CEFR & Difficulty consistency checks
        cls._validate_cefr_difficulty(data, result)

        # 5. Provenance checks
        cls._validate_provenance(data, result)

        # 6. Task Type & Stimulus checks (async DB queries)
        task_type = await cls._validate_task_type(db, data, result)
        await cls._validate_stimulus(db, data, result, task_type)

        # 7. Taxonomy & Skills checks (calls canonical TaggingValidationEngine)
        await cls._validate_skills(db, data, result, task_type)

        # 8. Duplicate detection check (if enabled)
        if check_duplication and data.prompt and data.prompt.strip():
            await cls._validate_duplication(db, data, result)

        return result

    @classmethod
    async def validate_and_persist(
        cls,
        db: AsyncSession,
        question: Question,
        actor_id: uuid.UUID | None = None,
        check_duplication: bool = True,
    ) -> ValidationResult:
        """Validate a Question ORM instance and persist an immutable QuestionValidation audit record."""
        result = await cls.validate_question(
            db=db,
            question=question,
            task_type_id=getattr(question, "task_type_id", None),
            check_duplication=check_duplication,
        )

        # Write immutable audit record to question_validations
        val_status_str = (
            result.status.value
            if hasattr(result.status, "value")
            else str(result.status)
        )
        record = QuestionValidation(
            question_id=question.id,
            validation_status=val_status_str,
            blocking_error_count=len(result.errors),
            warning_count=len(result.warnings),
            issues_payload=result.to_payload(),
            checked_at=result.validated_at,
            validated_by_system_version=result.validator_version,
        )
        db.add(record)
        await db.flush()

        return result

    @classmethod
    async def check_duplicates(
        cls,
        db: AsyncSession,
        prompt: str,
        exclude_question_id: uuid.UUID | None = None,
    ) -> list[tuple[str, uuid.UUID, float]]:
        """Check for exact and near duplicate questions in the database.

        Returns list of (match_type, question_id, similarity) tuples.
        match_type: "exact" | "near"
        """
        norm_prompt = re.sub(r"\s+", " ", prompt.strip().lower())
        words_target = set(re.findall(r"\b[a-zà-ÿ0-9]{3,}\b", norm_prompt))

        stmt = select(Question.id, Question.prompt).where(Question.prompt.is_not(None))
        if exclude_question_id is not None:
            stmt = stmt.where(Question.id != exclude_question_id)

        rows = (await db.execute(stmt)).all()
        matches: list[tuple[str, uuid.UUID, float]] = []

        for q_id, q_prompt in rows:
            if not q_prompt:
                continue
            norm_other = re.sub(r"\s+", " ", q_prompt.strip().lower())
            if norm_prompt == norm_other:
                matches.append(("exact", q_id, 1.0))
                continue

            # Token Jaccard similarity for near duplicates
            if len(words_target) >= 4:
                words_other = set(re.findall(r"\b[a-zà-ÿ0-9]{3,}\b", norm_other))
                if words_other:
                    union_len = len(words_target | words_other)
                    if union_len > 0:
                        sim = len(words_target & words_other) / union_len
                        if sim >= 0.85:
                            matches.append(("near", q_id, round(sim, 3)))

        return matches

    # -------------------------------------------------------------------------
    # Internal Extractors and Sub-Validators
    # -------------------------------------------------------------------------

    @classmethod
    async def _extract_question_data(
        cls,
        db: AsyncSession,
        question: Any,
        task_type_id: uuid.UUID | None,
    ) -> _NormalizedQuestionData:
        """Extract and normalize question attributes from ORM model, Pydantic schema, or dict."""
        q_id: uuid.UUID | None = None
        prompt: str = ""
        instructions: str | None = None
        response_type: str = QuestionResponseType.SINGLE_CHOICE.value
        target_cefr: str | None = None
        difficulty_rating: int | None = None
        cognitive_complexity: str | None = None
        scoring_payload: dict[str, Any] | None = None
        author_type: str | None = None
        options: list[Any] = []
        skill_tags: list[Any] = []
        stimulus_id: uuid.UUID | None = None
        stimulus_text: str | None = None
        extracted_task_type_id: uuid.UUID | None = task_type_id
        provenance: Any | None = None

        if isinstance(question, Question):
            q_id = question.id
            prompt = question.prompt or ""
            instructions = getattr(question, "instructions", None)
            resp = getattr(question, "response_type", None) or getattr(question, "question_type", None)
            response_type = (
                resp.value
                if hasattr(resp, "value")
                else (resp or QuestionResponseType.SINGLE_CHOICE.value)
            )
            target_cefr = getattr(question, "target_cefr", None) or getattr(question, "level", None)
            difficulty_rating = getattr(question, "difficulty_rating", None)
            cog = getattr(question, "cognitive_complexity", None)
            cognitive_complexity = cog.value if hasattr(cog, "value") else cog
            scoring_payload = getattr(question, "scoring_payload", None)
            raw_author = getattr(question, "author_type", None)
            author_type = raw_author.value if hasattr(raw_author, "value") else raw_author
            stimulus_id = getattr(question, "stimulus_id", None)
            stimulus_text = getattr(question, "stimulus_text", None)
            extracted_task_type_id = task_type_id or getattr(question, "task_type_id", None)

            # Safe relationship inspection to avoid MissingGreenlet
            state = sa_inspect(question)
            if "options" not in state.unloaded:
                options = list(question.options or [])
            elif q_id is not None:
                opt_stmt = (
                    select(QuestionOption)
                    .where(QuestionOption.question_id == q_id)
                    .order_by(QuestionOption.order_index)
                )
                options = list((await db.execute(opt_stmt)).scalars().all())

            if "skill_tags" not in state.unloaded:
                skill_tags = list(question.skill_tags or [])
            elif q_id is not None:
                tag_stmt = select(QuestionSkillTag).where(QuestionSkillTag.question_id == q_id)
                skill_tags = list((await db.execute(tag_stmt)).scalars().all())

            if "provenance" not in state.unloaded:
                provenance = question.provenance
            elif q_id is not None:
                prov_stmt = select(QuestionProvenance).where(QuestionProvenance.question_id == q_id)
                provenance = (await db.execute(prov_stmt)).scalar_one_or_none()

            if not author_type and provenance:
                prov_author = getattr(provenance, "author_type", None)
                author_type = prov_author.value if hasattr(prov_author, "value") else prov_author
        elif isinstance(question, dict):
            q_id = question.get("id")
            prompt = question.get("prompt", "")
            instructions = question.get("instructions")
            response_type = question.get("response_type") or question.get("question_type") or QuestionResponseType.SINGLE_CHOICE.value
            target_cefr = question.get("target_cefr") or question.get("level")
            difficulty_rating = question.get("difficulty_rating")
            cognitive_complexity = question.get("cognitive_complexity")
            scoring_payload = question.get("scoring_payload")
            author_type = question.get("author_type")
            options = list(question.get("options", []))
            skill_tags = list(question.get("skill_tags", []))
            stimulus_id = question.get("stimulus_id")
            stimulus_text = question.get("stimulus_text")
            extracted_task_type_id = task_type_id or question.get("task_type_id")
            provenance = question.get("provenance")
        else:
            # Pydantic schema (e.g. AdminQuestionCreate, AdminStandaloneQuestionCreate)
            q_id = getattr(question, "id", None)
            prompt = getattr(question, "prompt", "")
            instructions = getattr(question, "instructions", None)
            resp = getattr(question, "response_type", None) or getattr(question, "question_type", None)
            response_type = resp.value if hasattr(resp, "value") else (str(resp) if resp else QuestionResponseType.SINGLE_CHOICE.value)
            target_cefr = getattr(question, "target_cefr", None) or getattr(question, "level", None)
            difficulty_rating = getattr(question, "difficulty_rating", None)
            cog = getattr(question, "cognitive_complexity", None)
            cognitive_complexity = cog.value if hasattr(cog, "value") else (str(cog) if cog else None)
            scoring_payload = getattr(question, "scoring_payload", None)
            auth = getattr(question, "author_type", None)
            author_type = auth.value if hasattr(auth, "value") else (str(auth) if auth else None)
            options = list(getattr(question, "options", []))
            skill_tags = list(getattr(question, "skill_tags", []))
            stimulus_id = getattr(question, "stimulus_id", None)
            stimulus_text = getattr(question, "stimulus_text", None)
            extracted_task_type_id = task_type_id or getattr(question, "task_type_id", None)
            provenance = getattr(question, "provenance", None)

        return _NormalizedQuestionData(
            id=q_id,
            prompt=prompt,
            instructions=instructions,
            response_type=response_type,
            target_cefr=target_cefr,
            difficulty_rating=difficulty_rating,
            cognitive_complexity=cognitive_complexity,
            scoring_payload=scoring_payload,
            author_type=author_type,
            options=options,
            skill_tags=skill_tags,
            stimulus_id=stimulus_id,
            stimulus_text=stimulus_text,
            task_type_id=extracted_task_type_id,
            provenance=provenance,
        )

    @classmethod
    def _validate_structural(
        cls,
        data: _NormalizedQuestionData,
        result: ValidationResult,
    ) -> None:
        """Validate basic question structure, types, and answerability."""
        # 1. Prompt existence & length
        if not data.prompt or not data.prompt.strip():
            result.add_error(
                code="ERR_PROMPT_EMPTY",
                message="Question prompt cannot be empty.",
                rule="structural",
                field="prompt",
            )
        elif len(data.prompt.strip()) < 10:
            result.add_warning(
                code="WARN_PROMPT_TOO_SHORT",
                message=f"Question prompt is unusually short ({len(data.prompt.strip())} chars). Expected >= 10 chars.",
                rule="structural",
                field="prompt",
            )

        # 2. Response type validity
        valid_response_types = {e.value for e in QuestionResponseType} | {e.value for e in QuestionType}
        if data.response_type not in valid_response_types:
            result.add_error(
                code="ERR_INVALID_RESPONSE_TYPE",
                message=f"Invalid response type '{data.response_type}'.",
                rule="structural",
                field="response_type",
            )

        # 3. Target CEFR validity
        if data.target_cefr is not None:
            norm_cefr = data.target_cefr.upper().strip()
            if norm_cefr not in CEFR_DIFFICULTY_BANDS:
                result.add_error(
                    code="ERR_INVALID_CEFR_LEVEL",
                    message=f"Invalid CEFR level '{data.target_cefr}'. Expected one of {sorted(CEFR_DIFFICULTY_BANDS.keys())}.",
                    rule="structural",
                    field="target_cefr",
                )

        # 4. Difficulty rating bounds [100, 699]
        if data.difficulty_rating is not None and (
            not isinstance(data.difficulty_rating, int) or not (100 <= data.difficulty_rating <= 699)
        ):
            result.add_error(
                code="ERR_INVALID_DIFFICULTY_RATING",
                message=f"Difficulty rating {data.difficulty_rating} is out of bounds [100, 699].",
                rule="structural",
                field="difficulty_rating",
            )

        # 5. Cognitive complexity validity
        if data.cognitive_complexity is not None:
            valid_complexities = {e.value for e in CognitiveComplexityLevel}
            if data.cognitive_complexity not in valid_complexities:
                result.add_error(
                    code="ERR_INVALID_COGNITIVE_COMPLEXITY",
                    message=f"Invalid cognitive complexity '{data.cognitive_complexity}'. Expected one of {sorted(valid_complexities)}.",
                    rule="structural",
                    field="cognitive_complexity",
                )

        # 6. Response type specific answer config
        if data.response_type in (QuestionResponseType.SINGLE_CHOICE.value, QuestionResponseType.MULTIPLE_CHOICE.value):
            correct_opts = [
                o for o in data.options
                if getattr(o, "is_correct", False) or (isinstance(o, dict) and o.get("is_correct"))
            ]
            if len(correct_opts) == 0:
                result.add_error(
                    code="ERR_NO_CORRECT_ANSWER",
                    message="Objective choice question must have at least one correct option.",
                    rule="structural",
                    field="options",
                )
            if data.response_type == QuestionResponseType.SINGLE_CHOICE.value and len(correct_opts) > 1:
                result.add_error(
                    code="ERR_SINGLE_CHOICE_MULTIPLE_CORRECT",
                    message=f"Single-choice question has {len(correct_opts)} correct options; exactly 1 required.",
                    rule="structural",
                    field="options",
                    metadata={"correct_count": len(correct_opts)},
                )
        elif data.response_type == QuestionResponseType.MATCHING.value:
            payload = data.scoring_payload or {}
            # ScoringStrategyRegistry reads "pairs"; "matching_pairs" is legacy input.
            if not (payload.get("pairs") or payload.get("matching_pairs")) and len(data.options) < 2:
                result.add_error(
                    code="ERR_INVALID_MATCHING_CONFIG",
                    message="Matching question must define matching pairs in scoring payload or options.",
                    rule="structural",
                    field="scoring_payload",
                )
        elif data.response_type == QuestionResponseType.ORDERING.value:
            payload = data.scoring_payload or {}
            # OrderingStrategy reads "sequence" and falls back to option order_index.
            if not (payload.get("sequence") or payload.get("correct_sequence")) and len(data.options) < 2:
                result.add_error(
                    code="ERR_INVALID_ORDERING_CONFIG",
                    message="Ordering question must define a valid sequence in scoring payload or options.",
                    rule="structural",
                    field="scoring_payload",
                )
        elif data.response_type == QuestionResponseType.GAP_FILL.value:
            payload = data.scoring_payload or {}
            accepted = payload.get("accepted_answers") or payload.get("gaps")
            if not accepted and len(data.options) == 0:
                result.add_error(
                    code="ERR_INVALID_GAP_FILL_CONFIG",
                    message="Gap-fill question must define accepted answers or gaps in scoring payload.",
                    rule="structural",
                    field="scoring_payload",
                )
        elif data.response_type == QuestionResponseType.SHORT_TEXT.value:
            payload = data.scoring_payload or {}
            if not (payload.get("accepted_answers") or payload.get("answer_key")) and len(data.options) == 0:
                result.add_error(
                    code="ERR_INVALID_SHORT_TEXT_CONFIG",
                    message="Short-text question must define accepted answers in scoring payload.",
                    rule="structural",
                    field="scoring_payload",
                )
        elif data.response_type in (
            QuestionResponseType.LONG_TEXT.value,
            QuestionResponseType.SPOKEN_RESPONSE.value,
        ):
            payload = data.scoring_payload or {}
            if not (payload.get("rubric") or payload.get("criteria")):
                result.add_warning(
                    code="WARN_NO_RUBRIC",
                    message=(
                        f"{data.response_type} question has no rubric in its scoring payload; "
                        "AI correction will fall back to a generic rubric."
                    ),
                    rule="structural",
                    field="scoring_payload",
                )

    @classmethod
    def _validate_options(
        cls,
        data: _NormalizedQuestionData,
        result: ValidationResult,
    ) -> None:
        """Validate option quality, duplicates, distractors, and clueing anomalies."""
        if data.response_type not in (
            QuestionResponseType.SINGLE_CHOICE.value,
            QuestionResponseType.MULTIPLE_CHOICE.value,
        ):
            return

        # 1. Option count. The expected range comes from the task-format registry
        #    rather than a hardcoded four, because some TEF families genuinely
        #    use 2-3 (phonological recognition) or 4-5 (lexique et structure) choices.
        total_options = len(data.options)
        expected_min, expected_max = standard_option_count_for(data.response_type)
        if total_options < 2:
            result.add_error(
                code="ERR_INSUFFICIENT_OPTIONS",
                message=f"Choice question has {total_options} options; minimum 2 required.",
                rule="option_quality",
                field="options",
            )
        elif not expected_min <= total_options <= expected_max:
            expectation = (
                f"exactly {expected_min}"
                if expected_min == expected_max
                else f"{expected_min} to {expected_max}"
            )
            result.add_warning(
                code="WARN_DISTRACTOR_COUNT",
                message=(
                    f"Question has {total_options} options; the standard format for this "
                    f"task type expects {expectation} choices."
                ),
                rule="option_quality",
                field="options",
                metadata={"option_count": total_options, "expected_min": expected_min, "expected_max": expected_max},
            )

        # 2. Empty options and duplicate option text
        seen_texts: dict[str, int] = {}
        seen_orders: set[int] = set()

        for i, opt in enumerate(data.options):
            content = getattr(opt, "content", "") or (opt.get("content") if isinstance(opt, dict) else "")
            text_str = str(content).strip()

            if not text_str:
                result.add_error(
                    code="ERR_EMPTY_OPTION",
                    message=f"Option at index {i} has empty content.",
                    rule="option_quality",
                    field=f"options[{i}].content",
                )
                continue

            norm_text = re.sub(r"\s+", " ", text_str.lower())
            if norm_text in seen_texts:
                result.add_error(
                    code="ERR_DUPLICATE_OPTION_TEXT",
                    message=f"Duplicate option text '{text_str}' matches option at index {seen_texts[norm_text]}.",
                    rule="option_quality",
                    field="options",
                    metadata={"duplicate_text": text_str, "indices": [seen_texts[norm_text], i]},
                )
            else:
                seen_texts[norm_text] = i

            # Order index uniqueness
            order = getattr(opt, "order_index", None) or (opt.get("order_index") if isinstance(opt, dict) else None)
            if order is not None:
                if order in seen_orders:
                    result.add_error(
                        code="ERR_DUPLICATE_OPTION_ORDER",
                        message=f"Duplicate order_index {order} detected across options.",
                        rule="option_quality",
                        field="options",
                    )
                seen_orders.add(order)

            # Distractor rationale on incorrect options
            is_corr = getattr(opt, "is_correct", False) or (opt.get("is_correct") if isinstance(opt, dict) else False)
            if not is_corr:
                rationale = getattr(opt, "distractor_rationale", None) or (opt.get("distractor_rationale") if isinstance(opt, dict) else None)
                misconception = getattr(opt, "misconception_type", None) or (opt.get("misconception_type") if isinstance(opt, dict) else None)
                if not rationale and not misconception:
                    result.add_warning(
                        code="WARN_MISSING_DISTRACTOR_RATIONALE",
                        message=f"Distractor at index {i} is missing distractor_rationale or misconception_type.",
                        rule="option_quality",
                        field=f"options[{i}]",
                    )
                elif misconception:
                    result.add_info(
                        code="INFO_DISTRACTOR_MISCONCEPTION_TAGGED",
                        message=f"Distractor at index {i} tagged with misconception: {misconception}.",
                        rule="option_quality",
                        field=f"options[{i}]",
                    )

            # All / None of the above phrase detection
            for pattern in ALL_OR_NONE_PATTERNS:
                if pattern.search(text_str):
                    result.add_warning(
                        code="WARN_ALL_OR_NONE_OPTION",
                        message=f"Option at index {i} contains an 'all/none of the above' phrasing: '{text_str}'.",
                        rule="option_quality",
                        field=f"options[{i}]",
                        metadata={"phrase": text_str},
                    )
                    break

        # 3. Unbalanced option length (clueing bias)
        correct_opts = [
            o for o in data.options
            if getattr(o, "is_correct", False) or (isinstance(o, dict) and o.get("is_correct"))
        ]
        distractors = [
            o for o in data.options
            if not (getattr(o, "is_correct", False) or (isinstance(o, dict) and o.get("is_correct")))
        ]
        if len(correct_opts) == 1 and distractors:
            corr_content = getattr(correct_opts[0], "content", "") or (correct_opts[0].get("content") if isinstance(correct_opts[0], dict) else "")
            corr_len = len(str(corr_content).strip())
            dist_lens = [
                len(str(getattr(d, "content", "") or (d.get("content") if isinstance(d, dict) else "")).strip())
                for d in distractors
            ]
            dist_lens = [d for d in dist_lens if d > 0]
            if dist_lens:
                mean_dist = sum(dist_lens) / len(dist_lens)
                if mean_dist > 0 and (corr_len / mean_dist) >= 1.8:
                    result.add_warning(
                        code="WARN_UNBALANCED_OPTION_LENGTH",
                        message=(
                            f"Correct option length ({corr_len} chars) is significantly longer than "
                            f"average distractor length ({mean_dist:.1f} chars; ratio {corr_len / mean_dist:.2f}x)."
                        ),
                        rule="option_quality",
                        field="options",
                        metadata={
                            "correct_length": corr_len,
                            "distractor_avg_length": round(mean_dist, 1),
                            "ratio": round(corr_len / mean_dist, 2),
                        },
                    )

        # 4. Subset option anomaly
        for i, opt_a in enumerate(data.options):
            cnt_a = getattr(opt_a, "content", "") or (opt_a.get("content") if isinstance(opt_a, dict) else "")
            str_a = str(cnt_a).strip().lower()
            if len(str_a) < 5:
                continue
            for j, opt_b in enumerate(data.options):
                if i == j:
                    continue
                cnt_b = getattr(opt_b, "content", "") or (opt_b.get("content") if isinstance(opt_b, dict) else "")
                str_b = str(cnt_b).strip().lower()
                if str_a != str_b and str_a in str_b:
                    result.add_warning(
                        code="WARN_SUBSET_OPTION",
                        message=f"Option at index {i} ('{cnt_a}') is a subset of option at index {j} ('{cnt_b}').",
                        rule="option_quality",
                        field=f"options[{i}]",
                        metadata={"subset": str(cnt_a), "superset": str(cnt_b)},
                    )
                    break

    @classmethod
    def _validate_clueing(
        cls,
        data: _NormalizedQuestionData,
        result: ValidationResult,
    ) -> None:
        """Validate answerability and check for obvious answer leaks in the prompt stem."""
        if not data.prompt or not data.prompt.strip():
            return

        norm_prompt = re.sub(r"\s+", " ", data.prompt.strip().lower())

        for opt in data.options:
            is_corr = getattr(opt, "is_correct", False) or (opt.get("is_correct") if isinstance(opt, dict) else False)
            if not is_corr:
                continue
            cnt = getattr(opt, "content", "") or (opt.get("content") if isinstance(opt, dict) else "")
            cnt_str = str(cnt).strip()
            if len(cnt_str) >= 4:
                norm_cnt = re.sub(r"\s+", " ", cnt_str.lower())
                # Exact phrase in prompt
                if norm_cnt in norm_prompt:
                    result.add_warning(
                        code="WARN_ANSWER_LEAK_IN_PROMPT",
                        message=f"Correct answer '{cnt_str}' appears verbatim in the prompt stem.",
                        rule="clueing",
                        field="prompt",
                        metadata={"leaked_text": cnt_str},
                    )

    @classmethod
    def _validate_cefr_difficulty(
        cls,
        data: _NormalizedQuestionData,
        result: ValidationResult,
    ) -> None:
        """Validate consistency across target CEFR, difficulty rating, and cognitive complexity."""
        if not data.target_cefr:
            return

        cefr = data.target_cefr.upper().strip()
        if cefr not in CEFR_DIFFICULTY_BANDS:
            return

        min_band, max_band = CEFR_DIFFICULTY_BANDS[cefr]

        # 1. Difficulty rating band check
        if data.difficulty_rating is not None and (
            data.difficulty_rating < (min_band - 50) or data.difficulty_rating > (max_band + 50)
        ):
            result.add_warning(
                code="WARN_DIFFICULTY_RATING_BAND_MISMATCH",
                message=(
                    f"Difficulty rating {data.difficulty_rating} deviates significantly from "
                    f"CEFR {cefr} expected band ({min_band}-{max_band})."
                ),
                rule="cefr_difficulty",
                    field="difficulty_rating",
                    metadata={
                        "difficulty_rating": data.difficulty_rating,
                        "target_cefr": cefr,
                        "expected_band": [min_band, max_band],
                    },
                )

        # 2. Cognitive complexity vs CEFR check
        if data.cognitive_complexity:
            if cefr in ("A1", "A2") and data.cognitive_complexity == CognitiveComplexityLevel.CRITICAL_EVALUATION.value:
                result.add_warning(
                    code="WARN_COGNITIVE_CEFR_MISMATCH",
                    message=f"Beginner level {cefr} question assigned high-order 'critical_evaluation' cognitive complexity.",
                    rule="cefr_difficulty",
                    field="cognitive_complexity",
                )
            elif cefr in ("C1", "C2") and data.cognitive_complexity == CognitiveComplexityLevel.RECALL_RECOGNITION.value:
                result.add_warning(
                    code="WARN_COGNITIVE_CEFR_MISMATCH",
                    message=f"Advanced level {cefr} question assigned elementary 'recall_recognition' cognitive complexity.",
                    rule="cefr_difficulty",
                    field="cognitive_complexity",
                )

    @classmethod
    def _validate_provenance(
        cls,
        data: _NormalizedQuestionData,
        result: ValidationResult,
    ) -> None:
        """Validate item provenance rules for AI vs human authored questions."""
        auth_type = str(data.author_type).lower() if data.author_type else QuestionAuthorType.HUMAN.value

        if auth_type in (QuestionAuthorType.AI.value, "ai"):
            if not data.provenance:
                result.add_error(
                    code="ERR_AI_PROVENANCE_MISSING_MODEL",
                    message="AI-authored question requires generator_model in provenance.",
                    rule="provenance",
                    field="provenance.generator_model",
                )
            else:
                model = (
                    getattr(data.provenance, "generator_model", None)
                    or (data.provenance.get("generator_model") if isinstance(data.provenance, dict) else None)
                )
                if not model or not str(model).strip():
                    result.add_error(
                        code="ERR_AI_PROVENANCE_MISSING_MODEL",
                        message="AI-authored question requires generator_model in provenance.",
                        rule="provenance",
                        field="provenance.generator_model",
                    )
                prompt_ver = (
                    getattr(data.provenance, "generator_prompt_version", None)
                    or (data.provenance.get("generator_prompt_version") if isinstance(data.provenance, dict) else None)
                )
                params = (
                    getattr(data.provenance, "generator_parameters", None)
                    or (data.provenance.get("generator_parameters") if isinstance(data.provenance, dict) else None)
                )
                if not prompt_ver or not params:
                    result.add_warning(
                        code="WARN_AI_PROVENANCE_INCOMPLETE",
                        message="AI-authored question is missing generator_prompt_version or generator_parameters.",
                        rule="provenance",
                        field="provenance",
                    )

    @classmethod
    async def _validate_task_type(
        cls,
        db: AsyncSession,
        data: _NormalizedQuestionData,
        result: ValidationResult,
    ) -> TaskType | None:
        """Validate task type existence and metadata."""
        if data.task_type_id is None:
            return None

        task_type = await db.scalar(select(TaskType).where(TaskType.id == data.task_type_id))
        if task_type is None:
            result.add_error(
                code="ERR_INVALID_TASK_TYPE",
                message=f"Task type {data.task_type_id} does not exist.",
                rule="structural",
                field="task_type_id",
            )
            return None

        return task_type

    @classmethod
    async def _validate_stimulus(
        cls,
        db: AsyncSession,
        data: _NormalizedQuestionData,
        result: ValidationResult,
        task_type: TaskType | None,
    ) -> None:
        """Validate stimulus presence, content, and modality alignment."""
        if data.stimulus_id is not None:
            stimulus = await db.scalar(select(Stimulus).where(Stimulus.id == data.stimulus_id))
            if stimulus is None:
                result.add_error(
                    code="ERR_STIMULUS_NOT_FOUND",
                    message=f"Referenced stimulus {data.stimulus_id} does not exist.",
                    rule="stimulus",
                    field="stimulus_id",
                )
            else:
                has_text = bool(stimulus.content_text and stimulus.content_text.strip())
                has_media = bool(stimulus.media_url or stimulus.media_asset_id)
                if not has_text and not has_media:
                    result.add_error(
                        code="ERR_STIMULUS_EMPTY",
                        message="Referenced stimulus contains neither text content nor media asset.",
                        rule="stimulus",
                        field="stimulus_id",
                    )
                if (
                    task_type
                    and task_type.modality
                    and stimulus.modality
                    and task_type.modality.lower() != stimulus.modality.lower()
                ):
                    result.add_error(
                        code="ERR_STIMULUS_MODALITY_MISMATCH",
                        message=(
                            f"Stimulus modality '{stimulus.modality}' does not match "
                            f"task type modality '{task_type.modality}'."
                        ),
                        rule="stimulus",
                        field="stimulus_id",
                    )
        else:
            # Stimulus not linked via stimulus_id: check if task type strictly requires a stimulus
            if (
                task_type
                and task_type.code in STIMULUS_REQUIRED_TASK_TYPES
                and not (data.stimulus_text and data.stimulus_text.strip())
            ):
                result.add_error(
                    code="ERR_MISSING_REQUIRED_STIMULUS",
                    message=f"Task type '{task_type.name}' ({task_type.code}) requires a referenced stimulus or stimulus text.",
                    rule="stimulus",
                    field="stimulus_id",
                )

    @classmethod
    async def _validate_skills(
        cls,
        db: AsyncSession,
        data: _NormalizedQuestionData,
        result: ValidationResult,
        task_type: TaskType | None,
    ) -> None:
        """Validate taxonomy skill mappings via canonical TaggingValidationEngine."""
        if not data.skill_tags:
            result.add_error(
                code="ERR_TAXONOMY_TAG_MISSING",
                message="Question must have at least one canonical skill tag.",
                rule="taxonomy",
                field="skill_tags",
            )
            return

        resolved, issues = await TaggingValidationEngine.audit_skill_tags(
            db=db,
            tags=data.skill_tags,
            task_type_id=data.task_type_id,
        )

        for issue in issues:
            code = issue["code"]
            # Map codes to canonical ERR_* formats
            if code == "DUPLICATE_SKILL_TAG":
                err_code = "ERR_DUPLICATE_SKILL_TAG"
            elif code == "INACTIVE_OR_MISSING_SKILL":
                err_code = "ERR_INACTIVE_OR_MISSING_SKILL"
            elif code == "INVALID_TAG_WEIGHT":
                if "sum to" in issue["message"]:
                    err_code = "ERR_WEIGHT_SUM_INVALID"
                else:
                    err_code = "ERR_INVALID_TAG_WEIGHT"
            elif code == "MULTIPLE_PRIMARY_PER_DIMENSION":
                err_code = "ERR_MULTIPLE_PRIMARY_PER_DIMENSION"
            elif code == "INCOMPATIBLE_SKILL_TASK_TYPE":
                err_code = "ERR_INCOMPATIBLE_SKILL_TASK_TYPE"
            else:
                err_code = code

            result.add_error(
                code=err_code,
                message=issue["message"],
                rule="taxonomy",
                field="skill_tags",
                metadata=issue.get("metadata", {}),
            )

        if not issues and resolved:
            result.add_info(
                code="INFO_TAXONOMY_TAGS_CONFIRMED",
                message=f"Successfully validated {len(resolved)} canonical skill mappings.",
                rule="taxonomy",
                field="skill_tags",
            )

    @classmethod
    async def _validate_duplication(
        cls,
        db: AsyncSession,
        data: _NormalizedQuestionData,
        result: ValidationResult,
    ) -> None:
        """Validate prompt duplication against existing database items."""
        matches = await cls.check_duplicates(
            db=db,
            prompt=data.prompt,
            exclude_question_id=data.id,
        )

        for match_type, matched_id, sim in matches:
            if match_type == "exact":
                result.add_warning(
                    code="WARN_EXACT_DUPLICATE",
                    message=f"Question prompt is an exact duplicate of existing question {matched_id}.",
                    rule="duplication",
                    field="prompt",
                    metadata={"matching_question_id": str(matched_id), "similarity": 1.0},
                )
                break
            elif match_type == "near":
                result.add_warning(
                    code="WARN_NEAR_DUPLICATE",
                    message=f"Question prompt has high similarity ({sim:.0%}) to existing question {matched_id}.",
                    rule="duplication",
                    field="prompt",
                    metadata={"matching_question_id": str(matched_id), "similarity": sim},
                )
                break
