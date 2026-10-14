"""Service implementation for Question Bank Bulk Operations, File Parsing, AI Auto-Tagging, and Bulk Import."""

from __future__ import annotations

import csv
import datetime
import io
import json
import re
import uuid
from typing import Any, ClassVar

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from app.modules.admin.bulk_question_schemas import (
    AIAutoTagAndFormatRequest,
    AIAutoTagAndFormatResponse,
    BulkActionErrorDetail,
    BulkActionRequest,
    BulkActionResponse,
    BulkActionType,
    BulkGapChoiceOption,
    BulkGapItem,
    BulkImportCommitRequest,
    BulkImportCommitResponse,
    BulkImportQuestionItem,
    BulkOptionPayload,
    BulkParseResponse,
)
from app.modules.admin.enums import AuditAction, ContentStatus, SkillTagRole
from app.modules.admin.models import QuestionVersion
from app.modules.admin.service import AdminContentService, AuditService
from app.modules.assessments.enums import QuestionAuthorType, QuestionType
from app.modules.assessments.item_hash import compute_item_hash
from app.modules.assessments.models import (
    Question,
    QuestionOption,
    QuestionProvenance,
    QuestionSkillTag,
    Skill,
    TaskType,
)
from app.modules.assessments.question_validation import QuestionValidationEngine

logger = structlog.get_logger("tef-api.admin.bulk_question_service")


class BulkQuestionService:
    """Orchestrates bulk actions, file parsing, AI enrichment, and bulk database persistence."""

    # ---------------------------------------------------------------------------
    # 1. Bulk Lifecycle Actions
    # ---------------------------------------------------------------------------
    @classmethod
    async def execute_bulk_action(
        cls,
        db: AsyncSession,
        payload: BulkActionRequest,
        actor_id: uuid.UUID | None = None,
    ) -> BulkActionResponse:
        """Executes bulk status transitions or validation checks across selected questions."""
        stmt = (
            select(Question)
            .where(Question.id.in_(payload.question_ids))
            .options(
                selectinload(Question.options),
                selectinload(Question.skill_tags),
                selectinload(Question.stimulus),
                selectinload(Question.validations),
                selectinload(Question.provenance),
            )
        )
        questions = list((await db.execute(stmt)).scalars().all())
        found_ids = {q.id for q in questions}

        affected_ids: list[uuid.UUID] = []
        errors: list[BulkActionErrorDetail] = []

        # Check for missing questions
        for qid in payload.question_ids:
            if qid not in found_ids:
                errors.append(
                    BulkActionErrorDetail(
                        question_id=qid,
                        code="QUESTION_NOT_FOUND",
                        message=f"Question {qid} does not exist.",
                    )
                )

        now = datetime.datetime.now(datetime.UTC)

        for q in questions:
            try:
                if payload.action == BulkActionType.PUBLISH:
                    # Validate first
                    val = await QuestionValidationEngine.validate_and_persist(
                        db=db, question=q, actor_id=actor_id, check_duplication=False
                    )
                    if not val.valid:
                        blocking_msgs = [iss.message for iss in val.errors]
                        errors.append(
                            BulkActionErrorDetail(
                                question_id=q.id,
                                code="VALIDATION_FAILED",
                                message=f"Question cannot be published: {'; '.join(blocking_msgs[:2])}",
                            )
                        )
                        continue

                    old_status = q.status
                    q.status = ContentStatus.PUBLISHED.value
                    q.is_live_delivered = True
                    q.updated_by_user_id = actor_id
                    q.updated_at = now

                    # Save version snapshot
                    snap = QuestionVersion(
                        question_id=q.id,
                        version=q.version,
                        prompt=q.prompt,
                        explanation=q.explanation,
                        question_type=q.question_type.value if hasattr(q.question_type, "value") else str(q.question_type),
                        difficulty=q.difficulty,
                        level=q.level,
                        points=q.points,
                        options_snapshot=[
                            {
                                "id": str(opt.id),
                                "content": opt.content,
                                "is_correct": opt.is_correct,
                                "order_index": opt.order_index,
                                "explanation": opt.explanation,
                            }
                            for opt in q.options
                        ],
                        snapshot_payload={"published_at": now.isoformat(), "notes": payload.notes},
                        changelog=payload.notes or "Bulk published via question bank table",
                        created_by_user_id=actor_id,
                        created_at=now,
                    )
                    db.add(snap)

                    await AuditService.log_event(
                        db=db,
                        actor_user_id=actor_id,
                        action=AuditAction.PUBLISH,
                        entity_type="question",
                        entity_id=q.id,
                        payload={"old_status": old_status, "new_status": q.status, "notes": payload.notes},
                    )
                    affected_ids.append(q.id)

                elif payload.action == BulkActionType.ARCHIVE:
                    old_status = q.status
                    q.status = ContentStatus.ARCHIVED.value
                    q.updated_by_user_id = actor_id
                    q.updated_at = now

                    await AuditService.log_event(
                        db=db,
                        actor_user_id=actor_id,
                        action=AuditAction.ARCHIVE,
                        entity_type="question",
                        entity_id=q.id,
                        payload={"old_status": old_status, "new_status": q.status, "notes": payload.notes},
                    )
                    affected_ids.append(q.id)

                elif payload.action == BulkActionType.VALIDATE:
                    val = await QuestionValidationEngine.validate_and_persist(
                        db=db, question=q, actor_id=actor_id, check_duplication=False
                    )
                    affected_ids.append(q.id)

                elif payload.action == BulkActionType.DELETE:
                    if q.is_live_delivered or q.status == ContentStatus.PUBLISHED.value:
                        errors.append(
                            BulkActionErrorDetail(
                                question_id=q.id,
                                code="CANNOT_DELETE_PUBLISHED",
                                message="Cannot delete a published or delivered question. Archive it instead.",
                            )
                        )
                        continue

                    # Soft or hard delete draft/rejected items
                    await AuditService.log_event(
                        db=db,
                        actor_user_id=actor_id,
                        action=AuditAction.DELETE,
                        entity_type="question",
                        entity_id=q.id,
                        payload={"status": q.status, "prompt": q.prompt[:100]},
                    )
                    await db.delete(q)
                    affected_ids.append(q.id)

            except Exception as ex:  # noqa: BLE001
                logger.error("bulk_action_item_error", question_id=str(q.id), error=str(ex))
                errors.append(
                    BulkActionErrorDetail(
                        question_id=q.id,
                        code="ACTION_ERROR",
                        message=str(ex),
                    )
                )

        await db.commit()

        return BulkActionResponse(
            action=payload.action,
            total_requested=len(payload.question_ids),
            success_count=len(affected_ids),
            failure_count=len(errors),
            affected_ids=affected_ids,
            errors=errors,
        )

    # ---------------------------------------------------------------------------
    # 2. File Parsing (CSV, XLSX, JSON)
    # ---------------------------------------------------------------------------
    LEGACY_SKILL_ALIASES: ClassVar[dict[str, str]] = {
        "ce-l1-comp-glob": "identify_main_idea",
        "ce-l2-comp-fin": "identify_specific_detail",
        "ce-l1-rep-info": "locate_information",
        "ce-l2-gram": "grammatical_agreement",
        "grammar_structures": "grammatical_agreement",
        "ce-l2-lex": "vocabulary_in_context",
        "co-l1-comp-glob": "identify_main_idea",
        "co-l2-comp-fin": "identify_specific_detail",
        "co-l2-intent": "identify_communicative_intention",
    }

    COGNITIVE_COMPLEXITY_ALIASES: ClassVar[dict[str, str]] = {
        "recall_recognition": "recall_recognition",
        "recall": "recall_recognition",
        "remember": "recall_recognition",
        "locate": "recall_recognition",
        "interpretation": "interpretation",
        "understand": "interpretation",
        "comprehension": "interpretation",
        "apply": "interpretation",
        "inferencing_synthesis": "inferencing_synthesis",
        "infer": "inferencing_synthesis",
        "inference": "inferencing_synthesis",
        "analyze": "inferencing_synthesis",
        "analysis": "inferencing_synthesis",
        "synthesis": "inferencing_synthesis",
        "critical_evaluation": "critical_evaluation",
        "evaluate": "critical_evaluation",
        "evaluation": "critical_evaluation",
        "critical": "critical_evaluation",
    }

    CEFR_BASE_RATING: ClassVar[dict[str, int]] = {
        "A1": 100,
        "A2": 200,
        "B1": 300,
        "B2": 400,
        "C1": 500,
        "C2": 600,
    }

    @classmethod
    def _normalize_cognitive_complexity(cls, raw_val: str | None) -> str:
        if not raw_val:
            return "interpretation"
        key = str(raw_val).strip().lower()
        return cls.COGNITIVE_COMPLEXITY_ALIASES.get(key, "interpretation")

    @classmethod
    def _normalize_question_and_response_type(
        cls,
        raw_q_type: str | None,
        raw_r_type: str | None,
        task_type_code: str | None = None,
        has_gaps: bool = False,
    ) -> tuple[str, str]:
        """Normalizes raw question_type and response_type into (QuestionType, QuestionResponseType)."""
        q_raw = (raw_q_type or "").strip().lower()
        r_raw = (raw_r_type or q_raw).strip().lower()

        # If question has gaps or task type is gap-based, prioritize gap_fill
        if has_gaps or (task_type_code and str(task_type_code).strip().lower() in ("text_gap", "sentence_gap")):
            if r_raw not in ("matching", "ordering", "long_text", "spoken_response", "interaction"):
                return ("text_input", "gap_fill")

        if r_raw in ("text_gap", "sentence_gap", "gap_fill", "cloze", "texte_a_trous", "texte_à_trous", "trous", "lacunes"):
            return ("text_input", "gap_fill")

        if not r_raw:
            if task_type_code and str(task_type_code).strip().lower() in ("document_matching", "graph_matching"):
                return ("multiple_choice", "matching")
            if task_type_code and str(task_type_code).strip().lower() in ("text_ordering",):
                return ("multiple_choice", "ordering")
            r_raw = "single_choice"

        if r_raw == "single_choice":
            return ("single_choice", "single_choice")
        if r_raw == "multiple_choice":
            return ("multiple_choice", "multiple_choice")
        if r_raw in ("text_input", "short_text"):
            return ("text_input", "short_text")
        if r_raw == "matching":
            return ("multiple_choice", "matching")
        if r_raw == "ordering":
            return ("multiple_choice", "ordering")
        if r_raw == "long_text":
            return ("text_input", "long_text")
        if r_raw == "spoken_response":
            return ("text_input", "spoken_response")
        if r_raw == "interaction":
            return ("text_input", "interaction")
        return ("single_choice", "single_choice")


    @classmethod
    def _compute_difficulty_rating(cls, cefr: str | None, difficulty: int) -> int:
        norm_cefr = (cefr or "B1").strip().upper()
        base = cls.CEFR_BASE_RATING.get(norm_cefr, 300)
        clamped_diff = max(1, min(5, int(difficulty)))
        # Maps 1..5 -> base+10, base+30, base+50, base+70, base+90 (strictly inside [base, base+99])
        return base + (clamped_diff - 1) * 20 + 10

    @staticmethod
    def _decode_text_bytes(content_bytes: bytes) -> str:
        for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
            try:
                return content_bytes.decode(encoding)
            except UnicodeDecodeError:
                continue
        return content_bytes.decode("utf-8", errors="replace")

    @staticmethod
    def _detect_csv_delimiter(decoded: str) -> str:
        first_line = next((line for line in decoded.splitlines() if line.strip()), "")
        if not first_line:
            return ","
        try:
            dialect = csv.Sniffer().sniff(first_line, delimiters=",;\t")
            return dialect.delimiter
        except csv.Error:
            if first_line.count(";") > first_line.count(","):
                return ";"
            if first_line.count("\t") > first_line.count(","):
                return "\t"
            return ","

    @classmethod
    def parse_import_file(cls, content_bytes: bytes, filename: str) -> BulkParseResponse:
        """Parses question batch file into standardized preview items."""
        ext = filename.lower().split(".")[-1] if "." in filename else ""
        items: list[BulkImportQuestionItem] = []
        parse_errors: list[str] = []

        if ext == "json":
            try:
                decoded = cls._decode_text_bytes(content_bytes)
                data = json.loads(decoded)
                raw_list = data if isinstance(data, list) else (data.get("items") or data.get("questions") or [])
                for idx, raw in enumerate(raw_list):
                    try:
                        item = cls._dict_to_import_item(raw, f"row_{idx + 1}")
                        items.append(item)
                    except Exception as row_err:  # noqa: BLE001
                        parse_errors.append(f"JSON item {idx + 1}: {row_err!s}")
            except Exception as e:  # noqa: BLE001
                parse_errors.append(f"Invalid JSON format: {e!s}")

        elif ext in ("csv", "txt"):
            try:
                decoded = cls._decode_text_bytes(content_bytes)
                delimiter = cls._detect_csv_delimiter(decoded)
                reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
                for idx, row in enumerate(reader):
                    if not row or not any(v is not None and str(v).strip() for v in row.values()):
                        continue
                    try:
                        item = cls._csv_row_to_import_item(row, f"row_{idx + 1}")
                        items.append(item)
                    except Exception as row_err:  # noqa: BLE001
                        parse_errors.append(f"CSV row {idx + 2}: {row_err!s}")
            except Exception as e:  # noqa: BLE001
                parse_errors.append(f"Invalid CSV file: {e!s}")

        elif ext in ("xlsx", "xls"):
            try:
                import openpyxl  # type: ignore

                wb = openpyxl.load_workbook(filename=io.BytesIO(content_bytes), data_only=True)
                sheet = wb.active
                rows = list(sheet.iter_rows(values_only=True))
                if len(rows) > 1:
                    headers = [str(h).strip().lower() if h else "" for h in rows[0]]
                    for idx, row_vals in enumerate(rows[1:]):
                        row_dict = {
                            headers[c_idx]: (row_vals[c_idx] if c_idx < len(row_vals) else None)
                            for c_idx in range(len(headers))
                            if headers[c_idx]
                        }
                        # Skip empty rows
                        if not any(v is not None and str(v).strip() for v in row_dict.values()):
                            continue
                        try:
                            item = cls._csv_row_to_import_item(row_dict, f"row_{idx + 1}")
                            items.append(item)
                        except Exception as row_err:  # noqa: BLE001
                            parse_errors.append(f"Excel row {idx + 2}: {row_err!s}")
                else:
                    parse_errors.append("Excel sheet is empty or contains no headers.")
            except ImportError:
                parse_errors.append("Excel parser is not installed on this system. Please upload CSV or JSON instead.")
            except Exception as e:  # noqa: BLE001
                parse_errors.append(f"Invalid Excel file: {e!s}")
        else:
            parse_errors.append(f"Unsupported file format: '.{ext}'. Supported formats are: CSV, XLSX, JSON.")

        # Check intra-batch duplicates and mark them
        seen_hashes: dict[str, int] = {}
        duplicate_count = 0
        for idx, it in enumerate(items):
            if it.prompt and it.prompt.strip():
                h = compute_item_hash(
                    it.prompt,
                    stimulus_text=it.stimulus_text,
                    stimulus_title=it.stimulus_title,
                    stimulus_id=it.stimulus_id,
                    options=it.options,
                    gaps=it.gaps,
                )
                if h in seen_hashes:
                    it.is_duplicate = True
                    it.duplicate_reason = f"Doublon avec l'élément #{seen_hashes[h]}"
                    it.duplicate_similarity = 1.0
                    duplicate_count += 1
                else:
                    seen_hashes[h] = idx + 1

        valid_count = sum(1 for item in items if item.is_valid)
        invalid_count = len(items) - valid_count

        return BulkParseResponse(
            items=items,
            total_parsed=len(items),
            valid_count=valid_count,
            invalid_count=invalid_count,
            duplicate_count=duplicate_count,
            parse_errors=parse_errors,
        )

    @classmethod
    def _csv_row_to_import_item(cls, row: dict[str, Any], temp_id: str) -> BulkImportQuestionItem:
        """Transforms a flat CSV/Excel dictionary into a structured BulkImportQuestionItem."""
        # Normalize keys (ignore None keys injected by csv.DictReader when row has extra commas)
        clean = {
            k.strip().lower().replace(" ", "_"): ("" if v is None else str(v).strip())
            for k, v in row.items()
            if k and isinstance(k, str)
        }

        prompt = clean.get("prompt") or clean.get("question") or clean.get("enonce") or clean.get("énoncé") or ""
        modality = (clean.get("modality") or clean.get("modalite") or clean.get("modalité") or "reading").lower()
        if modality not in ("reading", "listening", "lexique_structure", "writing", "speaking"):
            modality = "reading"

        level = clean.get("level") or clean.get("target_cefr") or clean.get("cefr") or clean.get("niveau") or "B1"
        level = level.upper()
        if level not in ("A1", "A2", "B1", "B2", "C1", "C2"):
            level = "B1"

        try:
            diff = int(clean.get("difficulty") or clean.get("difficulte") or "3")
            diff = max(1, min(5, diff))
        except ValueError:
            diff = 3

        try:
            points = int(clean.get("points") or "1")
            points = max(1, points)
        except ValueError:
            points = 1

        try:
            penalty = int(clean.get("penalty_points") or "0")
        except ValueError:
            penalty = 0

        task_type_code = (
            clean.get("task_type_code")
            or clean.get("task_type")
            or clean.get("type_tache")
            or clean.get("type_de_tache")
            or None
        )
        has_gaps = bool(clean.get("gaps") or clean.get("trous") or clean.get("lacunes"))
        q_type, r_type = cls._normalize_question_and_response_type(
            clean.get("question_type"),
            clean.get("response_type"),
            task_type_code=task_type_code,
            has_gaps=has_gaps,
        )

        # Build options
        options: list[BulkOptionPayload] = []
        correct_col_keys = ("correct_option", "correct_answer", "reponse_correcte", "réponse_correcte")
        has_correct_col = any(k in clean for k in correct_col_keys)
        correct_raw = (
            clean.get("correct_option")
            or clean.get("correct_answer")
            or clean.get("reponse_correcte")
            or clean.get("réponse_correcte")
            or ("" if has_correct_col else "A")
        ).strip()

        # Support multiple correct answers for multiple_choice, matching, ordering, short_text, gap_fill
        if r_type in ("multiple_choice", "matching", "ordering", "short_text", "gap_fill"):
            correct_tokens = {t.strip().lower() for t in re.split(r"[,;|/]\s*", correct_raw) if t.strip()}
        else:
            correct_tokens = {correct_raw.lower()} if correct_raw else set()

        # Collect options with both letter ('a'..'d') and number ('1'..'4') aliases
        opt_slots = [
            ("a", "1", clean.get("option_a") or clean.get("opt_a") or clean.get("choice_a") or clean.get("option_1") or clean.get("choice_1")),
            ("b", "2", clean.get("option_b") or clean.get("opt_b") or clean.get("choice_b") or clean.get("option_2") or clean.get("choice_2")),
            ("c", "3", clean.get("option_c") or clean.get("opt_c") or clean.get("choice_c") or clean.get("option_3") or clean.get("choice_3")),
            ("d", "4", clean.get("option_d") or clean.get("opt_d") or clean.get("choice_d") or clean.get("option_4") or clean.get("choice_4")),
        ]

        for letter, num, opt_text in opt_slots:
            if opt_text:
                opt_lower = opt_text.lower()
                is_corr = bool(
                    correct_tokens
                    & {
                        letter,
                        num,
                        opt_lower,
                        f"option {letter}",
                        f"option_{letter}",
                        f"option {num}",
                        f"option_{num}",
                        f"choix {letter}",
                        f"choix {num}",
                    }
                )
                options.append(
                    BulkOptionPayload(
                        content=opt_text,
                        is_correct=is_corr,
                        order_index=len(options),
                        explanation=(
                            clean.get(f"explanation_{letter}")
                            or clean.get(f"explication_{letter}")
                            or clean.get(f"explanation_{num}")
                            or clean.get(f"explication_{num}")
                        ),
                        misconception_type=(
                            clean.get(f"misconception_{letter}")
                            or clean.get(f"misconception_type_{letter}")
                            or clean.get(f"piege_{letter}")
                            or clean.get(f"piège_{letter}")
                            or clean.get(f"misconception_{num}")
                            or clean.get(f"piege_{num}")
                        ) if not is_corr else None,
                        distractor_rationale=(
                            clean.get(f"rationale_{letter}")
                            or clean.get(f"distractor_rationale_{letter}")
                            or clean.get(f"justification_{letter}")
                            or clean.get(f"justification_piege_{letter}")
                            or clean.get(f"rationale_{num}")
                            or clean.get(f"justification_{num}")
                        ) if not is_corr else None,
                    )
                )

        # Gaps parsing for CSV
        gaps_raw = clean.get("gaps") or clean.get("trous") or clean.get("lacunes")
        gaps: list[BulkGapItem] = []
        if gaps_raw:
            try:
                parsed_g = json.loads(gaps_raw)
                if isinstance(parsed_g, list):
                    for g_idx, g in enumerate(parsed_g):
                        if isinstance(g, dict):
                            gap_id = str(g.get("gap_id") or g.get("id") or (g_idx + 1))
                            opts_list = []
                            for o_idx, o in enumerate(g.get("options") or []):
                                if isinstance(o, dict):
                                    opts_list.append(
                                        BulkGapChoiceOption(
                                            content=str(o.get("content") or "").strip(),
                                            is_correct=bool(o.get("is_correct", False)),
                                            order_index=int(o.get("order_index", o_idx)),
                                            misconception_type=o.get("misconception_type"),
                                            distractor_rationale=o.get("distractor_rationale"),
                                            explanation=o.get("explanation"),
                                        )
                                    )
                            gaps.append(
                                BulkGapItem(
                                    gap_id=gap_id,
                                    order_index=g_idx,
                                    cue_text=g.get("cue_text"),
                                    options=opts_list,
                                    expected_answers=[str(x) for x in g.get("expected_answers") or []],
                                    case_sensitive=bool(g.get("case_sensitive", False)),
                                )
                            )
            except Exception:
                pass

        if gaps and not options:
            for g in gaps:
                if g.options:
                    for o in g.options:
                        options.append(
                            BulkOptionPayload(
                                content=f"[{g.gap_id}] {o.content}",
                                is_correct=o.is_correct,
                                order_index=len(options),
                                misconception_type=o.misconception_type,
                                distractor_rationale=o.distractor_rationale,
                                explanation=o.explanation,
                            )
                        )
                elif g.expected_answers:
                    for ans in g.expected_answers:
                        options.append(
                            BulkOptionPayload(
                                content=f"[{g.gap_id}] {ans}",
                                is_correct=True,
                                order_index=len(options),
                            )
                        )

        # For matching/ordering/short_text/gap_fill, auto-handle options or direct correct_option text
        if r_type in ("matching", "ordering") and options and not any(o.is_correct for o in options):
            for o in options:
                o.is_correct = True
        elif r_type in ("short_text", "gap_fill"):
            if not options and not gaps and correct_raw and correct_raw.lower() not in ("a", "b", "c", "d", "1", "2", "3", "4"):
                options.append(BulkOptionPayload(content=correct_raw, is_correct=True, order_index=0))
            elif options and not any(o.is_correct for o in options) and not correct_raw:
                options[0].is_correct = True

        validation_errors: list[str] = []
        if not prompt:
            validation_errors.append("Le champ 'prompt' (énoncé de la question) est obligatoire.")
        if r_type in ("single_choice", "multiple_choice", "matching", "ordering") and len(options) < 2:
            validation_errors.append("Au moins 2 options de réponse sont obligatoires pour ce type de question.")
        if r_type == "gap_fill":
            if gaps:
                for g in gaps:
                    if g.options:
                        if len(g.options) < 2:
                            validation_errors.append(f"Le trou [{g.gap_id}] doit comporter au moins 2 options.")
                        if not any(o.is_correct for o in g.options):
                            validation_errors.append(f"Le trou [{g.gap_id}] doit comporter une option correcte.")
                    elif not g.expected_answers:
                        validation_errors.append(f"Le trou [{g.gap_id}] doit définir des options ou des réponses attendues.")
            elif len(options) < 1:
                validation_errors.append("Cette question de type texte à trous ne comporte aucun trou configuré (champ 'gaps' ou option_a..d).")
        elif r_type == "short_text" and len(options) < 1 and not gaps:
            validation_errors.append("Au moins 1 réponse attendue (option_a ou correct_option) est obligatoire.")
        if options and not gaps and not any(o.is_correct for o in options):
            validation_errors.append("Au moins une réponse correcte est obligatoire (vérifiez 'correct_option').")
        if r_type == "single_choice" and not gaps and sum(1 for o in options if o.is_correct) > 1:
            validation_errors.append("Une question à choix unique ne peut avoir qu'une seule réponse correcte.")

        skill_codes_raw = clean.get("skill_codes") or clean.get("skills") or clean.get("competences") or clean.get("compétences") or ""
        raw_codes = [s.strip() for s in re.split(r"[,;]\s*", skill_codes_raw) if s.strip()]
        skill_codes = [cls.LEGACY_SKILL_ALIASES.get(c.lower(), c) for c in raw_codes]

        task_type_code = (
            clean.get("task_type_code")
            or clean.get("task_type")
            or clean.get("type_tache")
            or clean.get("type_de_tache")
            or None
        )

        return BulkImportQuestionItem(
            temp_id=temp_id,
            prompt=prompt,
            question_type=q_type,
            response_type=r_type,
            task_type_code=task_type_code,
            modality=modality,
            level=level,
            target_cefr=level,
            difficulty=diff,
            cognitive_complexity=cls._normalize_cognitive_complexity(clean.get("cognitive_complexity")),
            points=points,
            penalty_points=penalty,
            explanation=clean.get("explanation") or clean.get("explication"),
            stimulus_title=clean.get("stimulus_title") or clean.get("titre_document"),
            stimulus_text=clean.get("stimulus_text") or clean.get("texte_document") or clean.get("passage"),
            media_url=clean.get("media_url") or clean.get("audio_url"),
            options=options,
            gaps=gaps,
            skill_codes=skill_codes,
            is_valid=(len(validation_errors) == 0),
            validation_errors=validation_errors,
        )

    @classmethod
    def _dict_to_import_item(cls, raw: dict[str, Any], temp_id: str) -> BulkImportQuestionItem:
        """Transforms a raw JSON dictionary into a BulkImportQuestionItem."""
        prompt = str(raw.get("prompt") or raw.get("question") or "").strip()
        options_data = raw.get("options") or []
        options: list[BulkOptionPayload] = []

        if isinstance(options_data, list):
            for idx, opt in enumerate(options_data):
                if isinstance(opt, dict):
                    content_str = str(opt.get("content") or opt.get("text") or "").strip()
                    if content_str:
                        options.append(
                            BulkOptionPayload(
                                content=content_str,
                                is_correct=bool(opt.get("is_correct", False)),
                                explanation=opt.get("explanation"),
                                order_index=int(opt.get("order_index", len(options))),
                                misconception_type=opt.get("misconception_type"),
                                distractor_rationale=opt.get("distractor_rationale"),
                            )
                        )
                elif isinstance(opt, str) and opt.strip():
                    options.append(
                        BulkOptionPayload(
                            content=opt.strip(),
                            is_correct=(idx == 0),
                            order_index=len(options),
                        )
                    )

        # Parse gaps if present with aliases (trous, lacunes, blanks, gap_items, scoring_payload, response_metadata, metadata)
        raw_gaps = (
            raw.get("gaps")
            or raw.get("gap")
            or raw.get("trous")
            or raw.get("trou")
            or raw.get("lacunes")
            or raw.get("lacune")
            or raw.get("blanks")
            or raw.get("blank")
            or raw.get("gap_items")
        )
        if not raw_gaps:
            for container_key in ("scoring_payload", "response_metadata", "metadata"):
                container = raw.get(container_key)
                if isinstance(container, str):
                    try:
                        container = json.loads(container)
                    except Exception:
                        container = None
                if isinstance(container, dict):
                    raw_gaps = (
                        container.get("gaps")
                        or container.get("gap")
                        or container.get("trous")
                        or container.get("trou")
                        or container.get("lacunes")
                        or container.get("lacune")
                        or container.get("blanks")
                        or container.get("blank")
                        or container.get("gap_items")
                        or container.get("gap_solutions")
                    )
                    if raw_gaps:
                        break

        # Parse stringified JSON if needed
        if isinstance(raw_gaps, str):
            try:
                raw_gaps = json.loads(raw_gaps)
            except Exception:
                raw_gaps = []

        # If raw_gaps is a dictionary (e.g. {"1": {...}, "2": {...}} or {"gaps": [...]})
        # Unpack nested dictionary until we get a list of gap dicts
        while isinstance(raw_gaps, dict):
            found_inner = False
            for k in ("gaps", "gap", "trous", "trou", "lacunes", "lacune", "blanks", "blank", "gap_items", "gap_solutions"):
                if k in raw_gaps and isinstance(raw_gaps[k], (list, dict)):
                    raw_gaps = raw_gaps[k]
                    found_inner = True
                    break
            if not found_inner:
                # Key-value map like {"1": {...}, "2": {...}} or {"gap_1": {...}}
                sorted_vals = []
                for k, v in sorted(raw_gaps.items(), key=lambda x: str(x[0])):
                    if isinstance(v, dict):
                        if "gap_id" not in v and "id" not in v:
                            v = {**v, "gap_id": str(k)}
                        sorted_vals.append(v)
                raw_gaps = sorted_vals
                break

        gaps: list[BulkGapItem] = []
        if isinstance(raw_gaps, list):
            for g_idx, g in enumerate(raw_gaps):
                if isinstance(g, dict):
                    gap_id = str(g.get("gap_id") or g.get("id") or g.get("numero") or g.get("num") or g.get("trou") or (g_idx + 1))
                    opts_list: list[BulkGapChoiceOption] = []
                    raw_opts = (
                        g.get("options")
                        or g.get("option")
                        or g.get("choices")
                        or g.get("choix")
                        or g.get("propositions")
                        or g.get("answers")
                        or g.get("reponses")
                        or g.get("réponses")
                        or []
                    )
                    # Check for flat options on the gap dict (option_a..option_d)
                    if not raw_opts and any(g.get(f"option_{k}") or g.get(f"opt_{k}") or g.get(f"choice_{k}") for k in ("a", "b", "c", "d")):
                        flat_opts = []
                        for k in ("a", "b", "c", "d"):
                            val = g.get(f"option_{k}") or g.get(f"opt_{k}") or g.get(f"choice_{k}")
                            if val:
                                flat_opts.append({"content": str(val).strip(), "key": k.upper()})
                        raw_opts = flat_opts

                    # If options is a dict like {"A": "...", "B": "..."} or {"A": {"content": ...}}
                    if isinstance(raw_opts, dict):
                        dict_opts = []
                        for opt_key, opt_val in sorted(raw_opts.items(), key=lambda x: str(x[0])):
                            if isinstance(opt_val, dict):
                                dict_opts.append({**opt_val, "key": str(opt_key).upper()})
                            elif isinstance(opt_val, str) and opt_val.strip():
                                dict_opts.append({"content": opt_val.strip(), "key": str(opt_key).upper()})
                        raw_opts = dict_opts

                    # Gap-level correct answer indicator
                    gap_correct_ref = str(
                        g.get("correct_option")
                        or g.get("correct_answer")
                        or g.get("reponse_correcte")
                        or g.get("solution")
                        or g.get("bonne_reponse")
                        or ""
                    ).strip().upper()

                    if isinstance(raw_opts, list):
                        for o_idx, o in enumerate(raw_opts):
                            opt_letter = chr(65 + o_idx)
                            opt_num = str(o_idx + 1)
                            if isinstance(o, dict):
                                content_str = str(
                                    o.get("content")
                                    or o.get("text")
                                    or o.get("texte")
                                    or o.get("label")
                                    or o.get("value")
                                    or o.get("option")
                                    or o.get("answer")
                                    or o.get("reponse")
                                    or o.get("proposition")
                                    or ""
                                ).strip()
                                if content_str:
                                    is_corr = bool(o.get("is_correct") or o.get("correct") or o.get("est_correct", False))
                                    # Fallback to gap-level correct_option if not explicitly marked
                                    if not is_corr and gap_correct_ref:
                                        o_key = str(o.get("key", "")).strip().upper()
                                        if gap_correct_ref in (opt_letter, opt_num, o_key, content_str.upper()):
                                            is_corr = True

                                    opts_list.append(
                                        BulkGapChoiceOption(
                                            content=content_str,
                                            is_correct=is_corr,
                                            order_index=int(o.get("order_index", o_idx)),
                                            misconception_type=o.get("misconception_type") or o.get("piege") or o.get("piège"),
                                            distractor_rationale=o.get("distractor_rationale") or o.get("rationale") or o.get("justification_piege"),
                                            explanation=o.get("explanation") or o.get("explication"),
                                        )
                                    )
                            elif isinstance(o, str) and o.strip():
                                is_corr = (o_idx == 0)
                                if gap_correct_ref:
                                    is_corr = gap_correct_ref in (opt_letter, opt_num, o.strip().upper())
                                opts_list.append(
                                    BulkGapChoiceOption(
                                        content=o.strip(),
                                        is_correct=is_corr,
                                        order_index=o_idx,
                                    )
                                )

                    exp_answers_raw = (
                        g.get("expected_answers")
                        or g.get("expected_answer")
                        or g.get("accepted_answers")
                        or g.get("accepted_answer")
                        or g.get("reponses_attendues")
                        or g.get("reponse_attendue")
                        or g.get("correct_answers")
                        or []
                    )
                    if isinstance(exp_answers_raw, str):
                        exp_answers = [exp_answers_raw.strip()] if exp_answers_raw.strip() else []
                    elif isinstance(exp_answers_raw, list):
                        exp_answers = [str(x).strip() for x in exp_answers_raw if x is not None and str(x).strip()]
                    else:
                        exp_answers = []

                    gaps.append(
                        BulkGapItem(
                            gap_id=gap_id,
                            order_index=int(g.get("order_index", g_idx)),
                            cue_text=g.get("cue_text") or g.get("hint") or g.get("description"),
                            options=opts_list,
                            expected_answers=exp_answers,
                            case_sensitive=bool(g.get("case_sensitive", False)),
                        )
                    )

        # Bidirectional synthesis:
        # Case 1: Gaps exist -> synthesize flattened options for downstream UI, AI enrichment, and storage
        if gaps:
            synth_options: list[BulkOptionPayload] = []
            for g in gaps:
                if g.options:
                    for o in g.options:
                        synth_options.append(
                            BulkOptionPayload(
                                content=f"[{g.gap_id}] {o.content}",
                                is_correct=o.is_correct,
                                order_index=len(synth_options),
                                misconception_type=o.misconception_type,
                                distractor_rationale=o.distractor_rationale,
                                explanation=o.explanation,
                            )
                        )
                elif g.expected_answers:
                    for ans in g.expected_answers:
                        synth_options.append(
                            BulkOptionPayload(
                                content=f"[{g.gap_id}] {ans}",
                                is_correct=True,
                                order_index=len(synth_options),
                            )
                        )
            if synth_options and (not options or not any(o.content.startswith("[") for o in options)):
                options = synth_options

        # Case 2: No gaps, but options contain gap markers like '[1] ...', '[2] ...' or '(1) ...'
        elif options and not gaps:
            gap_marker_pattern = re.compile(r"^\s*([\[\(](\d+)[\]\)])\s*(.*)$")
            grouped_by_gap: dict[str, list[tuple[BulkOptionPayload, str]]] = {}
            has_markers = False
            for opt in options:
                m = gap_marker_pattern.match(opt.content)
                if m:
                    has_markers = True
                    gid = m.group(2)
                    clean_content = m.group(3).strip()
                    grouped_by_gap.setdefault(gid, []).append((opt, clean_content))

            if has_markers and len(grouped_by_gap) >= 1:
                for g_idx, (gid, opt_pairs) in enumerate(sorted(grouped_by_gap.items(), key=lambda x: int(x[0]))):
                    gap_opts = []
                    for o_idx, (orig_opt, clean_c) in enumerate(opt_pairs):
                        gap_opts.append(
                            BulkGapChoiceOption(
                                content=clean_c or orig_opt.content,
                                is_correct=orig_opt.is_correct,
                                order_index=o_idx,
                                misconception_type=orig_opt.misconception_type,
                                distractor_rationale=orig_opt.distractor_rationale,
                                explanation=orig_opt.explanation,
                            )
                        )
                    gaps.append(
                        BulkGapItem(
                            gap_id=gid,
                            order_index=g_idx,
                            options=gap_opts,
                            expected_answers=[],
                        )
                    )

        task_type_code_raw = raw.get("task_type_code") or raw.get("task_type") or raw.get("task_type_id")
        task_type_code = str(task_type_code_raw).strip() if task_type_code_raw else None

        q_type, r_type = cls._normalize_question_and_response_type(
            str(raw.get("question_type", "")) if raw.get("question_type") else None,
            str(raw.get("response_type", "")) if raw.get("response_type") else None,
            task_type_code=task_type_code,
            has_gaps=bool(gaps),
        )
        if r_type in ("matching", "ordering") and options and not any(o.is_correct for o in options):
            for o in options:
                o.is_correct = True

        validation_errors: list[str] = []
        if not prompt:
            validation_errors.append("Le champ 'prompt' (énoncé de la question) est obligatoire.")
        if r_type in ("single_choice", "multiple_choice", "matching", "ordering") and len(options) < 2:
            validation_errors.append("Au moins 2 options de réponse sont obligatoires pour ce type de question.")
        if r_type == "gap_fill":
            if gaps:
                for g in gaps:
                    if g.options:
                        if len(g.options) < 2:
                            validation_errors.append(f"Le trou [{g.gap_id}] doit comporter au moins 2 options.")
                        if not any(o.is_correct for o in g.options):
                            validation_errors.append(f"Le trou [{g.gap_id}] doit comporter une option correcte.")
                    elif not g.expected_answers:
                        validation_errors.append(f"Le trou [{g.gap_id}] doit définir des options ou des réponses attendues.")
            elif len(options) < 1:
                validation_errors.append("Cette question de type texte à trous ne comporte aucun trou configuré (champ 'gaps').")
        elif r_type == "short_text" and len(options) < 1 and not gaps:
            validation_errors.append("Au moins 1 réponse attendue est obligatoire.")
        if options and not gaps and not any(o.is_correct for o in options):
            validation_errors.append("Au moins une réponse correcte est obligatoire.")
        if r_type == "single_choice" and not gaps and sum(1 for o in options if o.is_correct) > 1:
            validation_errors.append("Une question à choix unique ne peut avoir qu'une seule réponse correcte.")

        modality = str(raw.get("modality", "reading")).lower()
        if modality not in ("reading", "listening", "lexique_structure", "writing", "speaking"):
            modality = "reading"

        level = str(raw.get("level") or raw.get("target_cefr") or "B1").upper()
        if level not in ("A1", "A2", "B1", "B2", "C1", "C2"):
            level = "B1"

        raw_codes = raw.get("skill_codes") or []
        skill_codes = [cls.LEGACY_SKILL_ALIASES.get(str(c).strip().lower(), str(c).strip()) for c in raw_codes if str(c).strip()]

        task_type_code_raw = raw.get("task_type_code") or raw.get("task_type") or raw.get("task_type_id")
        task_type_code = str(task_type_code_raw).strip() if task_type_code_raw else None

        scoring_payload_dict = raw.get("scoring_payload")
        if isinstance(scoring_payload_dict, str):
            try:
                scoring_payload_dict = json.loads(scoring_payload_dict)
            except Exception:
                scoring_payload_dict = None
        elif not isinstance(scoring_payload_dict, dict):
            scoring_payload_dict = None

        return BulkImportQuestionItem(
            temp_id=temp_id,
            prompt=prompt,
            question_type=q_type,
            response_type=r_type,
            task_type_code=task_type_code,
            modality=modality,
            level=level,
            target_cefr=level,
            difficulty=max(1, min(5, int(raw.get("difficulty", 3)))),
            cognitive_complexity=cls._normalize_cognitive_complexity(raw.get("cognitive_complexity")),
            points=max(1, int(raw.get("points", 1))),
            penalty_points=int(raw.get("penalty_points", 0)),
            explanation=raw.get("explanation"),
            stimulus_title=raw.get("stimulus_title"),
            stimulus_text=raw.get("stimulus_text"),
            stimulus_id=uuid.UUID(raw["stimulus_id"]) if raw.get("stimulus_id") else None,
            media_url=raw.get("media_url"),
            options=options,
            gaps=gaps,
            scoring_payload=scoring_payload_dict,
            skill_codes=skill_codes,
            is_valid=(len(validation_errors) == 0),
            validation_errors=validation_errors,
        )

    # ---------------------------------------------------------------------------
    # 3. AI Auto-Tagging & Auto Rich-Text Formatting
    # ---------------------------------------------------------------------------
    @classmethod
    async def ai_auto_tag_and_format_items(
        cls,
        db: AsyncSession,
        payload: AIAutoTagAndFormatRequest,
        actor_id: uuid.UUID | None = None,
    ) -> AIAutoTagAndFormatResponse:
        """Enriches items with auto-formatted Markdown and canonical skill mappings."""
        stmt = (
            select(Skill)
            .where(Skill.is_active.is_(True), Skill.is_assessable.is_(True))
            .order_by(Skill.order_index)
        )
        skills = list((await db.execute(stmt)).scalars().all())
        skills_by_code = {s.code: s for s in skills}

        tt_stmt = select(TaskType)
        task_types = list((await db.execute(tt_stmt)).scalars().all())
        task_types_by_code = {tt.code: tt for tt in task_types}

        enriched_items: list[BulkImportQuestionItem] = []

        for item in payload.items:
            # 1. Resolve task_type_code if omitted
            if not item.task_type_code:
                item.task_type_code = cls._match_canonical_task(
                    prompt=item.prompt,
                    stimulus_text=item.stimulus_text,
                    modality=item.modality,
                    level=item.level,
                    response_type=item.response_type,
                    task_types_by_code=task_types_by_code,
                )

            # 2. Rich Text Formatting
            if payload.auto_format_rich_text and item.stimulus_text:
                item.stimulus_text = cls._format_document_markdown(
                    raw_text=item.stimulus_text,
                    title=item.stimulus_title,
                )

            # 3. Skill & CEFR Auto-tagging
            if payload.auto_tag_skills:
                inferred_cefr = cls._infer_cefr_level(item.prompt, item.stimulus_text)
                if not item.target_cefr or item.target_cefr == "B1":
                    item.target_cefr = inferred_cefr
                    item.level = inferred_cefr

                # If item already has valid canonical skills, retain them; otherwise match
                valid_existing = [c for c in item.skill_codes if c in skills_by_code]
                if valid_existing:
                    item.skill_codes = valid_existing
                else:
                    suggested_codes = cls._match_canonical_skills(
                        prompt=item.prompt,
                        stimulus_text=item.stimulus_text,
                        modality=item.modality,
                        skills_by_code=skills_by_code,
                        task_type_code=item.task_type_code,
                    )
                    if suggested_codes:
                        item.skill_codes = suggested_codes

            item.question_type, item.response_type = cls._normalize_question_and_response_type(
                item.question_type,
                item.response_type,
                task_type_code=item.task_type_code,
                has_gaps=bool(item.gaps),
            )
            item.cognitive_complexity = cls._normalize_cognitive_complexity(item.cognitive_complexity)

            # Revalidate
            item.validation_errors = []
            if not item.prompt:
                item.validation_errors.append("Le champ 'prompt' est obligatoire.")
            if item.response_type in ("single_choice", "multiple_choice", "matching", "ordering") and len(item.options) < 2:
                item.validation_errors.append("Au moins 2 options de réponse sont obligatoires pour ce type de question.")
            if item.response_type == "gap_fill":
                if item.gaps:
                    for g in item.gaps:
                        if g.options:
                            if len(g.options) < 2:
                                item.validation_errors.append(f"Le trou [{g.gap_id}] doit comporter au moins 2 options.")
                            if not any(o.is_correct for o in g.options):
                                item.validation_errors.append(f"Le trou [{g.gap_id}] doit comporter une option correcte.")
                        elif not g.expected_answers:
                            item.validation_errors.append(f"Le trou [{g.gap_id}] doit définir des options ou des réponses attendues.")
                elif len(item.options) < 1:
                    item.validation_errors.append("Cette question de type texte à trous ne comporte aucun trou configuré (champ 'gaps').")
            elif item.response_type == "short_text" and len(item.options) < 1 and not item.gaps:
                item.validation_errors.append("Au moins 1 réponse attendue est obligatoire.")
            if item.options and not item.gaps and not any(o.is_correct for o in item.options):
                item.validation_errors.append("Au moins une réponse correcte est obligatoire.")
            if item.response_type == "single_choice" and not item.gaps and sum(1 for o in item.options if o.is_correct) > 1:
                item.validation_errors.append("Une question à choix unique ne peut avoir qu'une seule réponse correcte.")
            item.is_valid = len(item.validation_errors) == 0

            enriched_items.append(item)

        # Refresh intra-batch duplicate detection on enriched items
        seen_enriched_hashes: dict[str, int] = {}
        for idx, it in enumerate(enriched_items):
            if it.prompt and it.prompt.strip():
                h = compute_item_hash(
                    it.prompt,
                    stimulus_text=it.stimulus_text,
                    stimulus_title=it.stimulus_title,
                    stimulus_id=it.stimulus_id,
                    options=it.options,
                    gaps=it.gaps,
                )
                if h in seen_enriched_hashes:
                    it.is_duplicate = True
                    it.duplicate_reason = f"Doublon avec l'élément #{seen_enriched_hashes[h]}"
                    it.duplicate_similarity = 1.0
                else:
                    seen_enriched_hashes[h] = idx + 1
                    it.is_duplicate = False
                    it.duplicate_reason = None
                    it.duplicate_similarity = 0.0

        return AIAutoTagAndFormatResponse(
            items=enriched_items,
            enriched_count=len(enriched_items),
        )

    @classmethod
    def _format_document_markdown(cls, raw_text: str, title: str | None = None) -> str:
        """Transforms unformatted or plain document text into structured Markdown."""
        text = raw_text.strip()
        lines = [line.strip() for line in text.splitlines() if line.strip()]

        if not lines:
            return raw_text

        formatted_lines: list[str] = []

        # If title provided and not already header
        if title and not text.startswith("#"):
            formatted_lines.append(f"### {title}\n")

        for line in lines:
            # Dialogues: "A: ...", "B: ..." or "- ..."
            if re.match(r"^[A-Z]\s*:\s*", line):
                formatted_lines.append(f"> **{line[:2]}** {line[2:].strip()}")
            elif line.startswith("- ") or re.match(r"^[0-9]+\.\s+", line):
                formatted_lines.append(line)
            else:
                formatted_lines.append(f"{line}\n")

        return "\n".join(formatted_lines).strip()

    @classmethod
    def _infer_cefr_level(cls, prompt: str, stimulus_text: str | None = None) -> str:
        """Heuristic and lexical CEFR estimation (fast deterministic fallback)."""
        combined = f"{prompt} {stimulus_text or ''}".lower()
        word_count = len(combined.split())

        # Lexical markers
        c1_c2_markers = ["nonobstant", "d'ores et déjà", "implicite", "ambiguïté", "corollaire", "envergure", "paradoxe", "controverse"]
        b2_markers = ["considérablement", "néanmoins", "par conséquent", "toutefois", "en outre", "aboutir", "nuance"]
        b1_markers = ["cependant", "puisque", "avis", "opinion", "événement", "quotidien", "participer"]
        a2_markers = ["parce que", "toujours", "souvent", "famille", "vacances", "ville", "magasin"]

        if any(w in combined for w in c1_c2_markers) or word_count > 300:
            return "C1"
        if any(w in combined for w in b2_markers) or word_count > 180:
            return "B2"
        if any(w in combined for w in b1_markers) or word_count > 90:
            return "B1"
        if any(w in combined for w in a2_markers) or word_count > 40:
            return "A2"
        return "A1"

    TASK_TYPE_ALLOWED_SKILLS: dict[str, list[str]] = {
        "daily_document": [
            "locate_information",
            "identify_specific_detail",
            "understand_context",
            "vocabulary_in_context",
            "register_and_formality",
            "preposition_usage",
        ],
        "press_article": [
            "identify_main_idea",
            "identify_stance_and_perspective",
            "identify_tone",
            "identify_communicative_intention",
            "infer_implicit_information",
            "infer_pragmatic_meaning",
            "identify_claim",
            "identify_supporting_reason",
            "handle_counterargument",
            "vocabulary_in_context",
            "paraphrase_and_synonym_recognition",
            "relative_clauses",
            "discourse_connectors",
            "reference_resolution",
        ],
        "administrative_document": [
            "locate_information",
            "identify_specific_detail",
            "understand_context",
            "vocabulary_in_context",
            "register_and_formality",
            "conditional_structures",
            "negation_structures",
        ],
        "professional_document": [
            "identify_main_idea",
            "identify_specific_detail",
            "understand_context",
            "identify_communicative_intention",
            "vocabulary_in_context",
            "register_and_formality",
            "discourse_connectors",
        ],
        "sentence_gap": [
            "vocabulary_in_context",
            "collocations",
            "grammatical_agreement",
            "articles_and_determiners",
            "pronoun_usage",
            "preposition_usage",
            "negation_structures",
            "verb_conjugation",
            "tense_selection",
            "mood_selection",
            "relative_clauses",
        ],
        "text_gap": [
            "understand_sequence",
            "understand_cause_consequence",
            "vocabulary_in_context",
            "word_formation",
            "discourse_connectors",
            "reference_resolution",
            "subordination_and_coordination",
        ],
        "document_matching": [
            "locate_information",
            "identify_specific_detail",
            "compare_information",
            "vocabulary_in_context",
            "paraphrase_and_synonym_recognition",
        ],
        "graph_matching": [
            "locate_information",
            "interpret_data_trends",
            "correlate_data_and_text",
            "compare_information",
            "vocabulary_in_context",
        ],
        "text_ordering": [
            "understand_sequence",
            "textual_cohesion_and_coherence",
            "discourse_connectors",
            "identify_main_idea",
        ],
        "reformulation": [
            "paraphrase_and_synonym_recognition",
            "lexical_precision",
            "collocations",
            "register_and_formality",
        ],
        "short_announcement": [
            "locate_information",
            "identify_specific_detail",
            "understand_context",
            "identify_communicative_intention",
            "vocabulary_in_context",
            "register_and_formality",
        ],
        "radio_broadcast": [
            "identify_main_idea",
            "understand_sequence",
            "understand_cause_consequence",
            "synthesize_information",
            "infer_implicit_information",
            "identify_stance_and_perspective",
            "vocabulary_in_context",
            "paraphrase_and_synonym_recognition",
            "discourse_connectors",
        ],
        "public_survey": [
            "compare_information",
            "identify_stance_and_perspective",
            "identify_tone",
            "infer_pragmatic_meaning",
            "vocabulary_in_context",
            "register_and_formality",
        ],
        "conversation_extract": [
            "locate_information",
            "identify_specific_detail",
            "understand_context",
            "infer_implicit_information",
            "identify_communicative_intention",
        ],
        "phonological_recognition": [
            "vocabulary_in_context",
            "pronoun_usage",
            "negation_structures",
            "sentence_structure",
        ],
        "message_association": [
            "locate_information",
            "identify_specific_detail",
            "understand_context",
        ],
        "word_formation": [
            "word_formation",
            "lexical_precision",
            "vocabulary_in_context",
            "collocations",
            "orthography",
        ],
        "adjective_agreement": [
            "grammatical_agreement",
            "orthography",
            "sentence_structure",
        ],
        "pronoun_reference": [
            "reference_resolution",
            "pronoun_usage",
            "discourse_connectors",
            "textual_cohesion_and_coherence",
        ],
        "syntax_construction": [
            "sentence_structure",
            "subordination_and_coordination",
            "relative_clauses",
            "conditional_structures",
            "negation_structures",
            "grammatical_agreement",
            "discourse_connectors",
        ],
        "fait_divers": [
            "understand_sequence",
            "understand_cause_consequence",
            "verb_conjugation",
            "tense_selection",
            "grammatical_agreement",
            "lexical_precision",
            "orthography",
            "punctuation",
            "textual_cohesion_and_coherence",
        ],
        "opinion_letter": [
            "identify_claim",
            "identify_supporting_reason",
            "handle_counterargument",
            "synthesize_information",
            "discourse_connectors",
            "mood_selection",
            "conditional_structures",
            "subordination_and_coordination",
            "lexical_precision",
            "register_and_formality",
            "textual_cohesion_and_coherence",
            "orthography",
            "punctuation",
        ],
        "information_gathering": [
            "understand_context",
            "locate_information",
            "sentence_structure",
            "register_and_formality",
            "phonological_control",
            "oral_fluency",
            "articles_and_determiners",
            "preposition_usage",
        ],
        "persuasive_argumentation": [
            "identify_claim",
            "identify_supporting_reason",
            "handle_counterargument",
            "infer_pragmatic_meaning",
            "discourse_connectors",
            "conditional_structures",
            "lexical_precision",
            "register_and_formality",
            "phonological_control",
            "oral_fluency",
            "textual_cohesion_and_coherence",
        ],
    }

    @classmethod
    def _match_canonical_skills(
        cls,
        prompt: str,
        stimulus_text: str | None,
        modality: str,
        skills_by_code: dict[str, Skill],
        task_type_code: str | None = None,
    ) -> list[str]:
        """Matches competencies from available assessable skills catalog in the database."""
        text = f"{prompt} {stimulus_text or ''}".lower()
        matched: list[str] = []

        # 1. High-precision semantic matching against canonical skills
        if any(w in text for w in ("ce document est", "carte de visite", "petite annonce", "situation", "qui parle", "à qui", "contexte")):
            if "understand_context" in skills_by_code:
                matched.append("understand_context")

        if any(w in text for w in ("global", "thème", "idée principale", "sujet principal", "objectif principal", "traite principalement")):
            if "identify_main_idea" in skills_by_code:
                matched.append("identify_main_idea")

        if any(w in text for w in ("intention", "but", "pourquoi", "vise à", "cherche à", "objectif")):
            if "identify_communicative_intention" in skills_by_code:
                matched.append("identify_communicative_intention")

        if any(w in text for w in ("ton", "tonalité", "ironique", "humoristique", "critique", "alarmiste")):
            if "identify_tone" in skills_by_code:
                matched.append("identify_tone")

        if any(w in text for w in ("avis", "opinion", "point de vue", "prise de position", "favorable", "opposé", "hostile")):
            if "identify_stance_and_perspective" in skills_by_code:
                matched.append("identify_stance_and_perspective")

        if any(w in text for w in ("implicite", "suggère", "déduire", "sous-entend", "on peut comprendre")):
            if "infer_implicit_information" in skills_by_code:
                matched.append("infer_implicit_information")

        if any(w in text for w in ("détail", "condition", "restriction", "garantie", "règle", "clause", "particulier", "seconde main", "vendu")):
            if "identify_specific_detail" in skills_by_code:
                matched.append("identify_specific_detail")

        if any(w in text for w in ("tél", "email", "adresse", "site", "prix", "date", "lieu", "quand", "où", "combien", "horaire", "numéro", "coordonnées")):
            if "locate_information" in skills_by_code:
                matched.append("locate_information")

        if any(w in text for w in ("synonyme", "équivaut", "reformulation", "veut dire", "remplacer")):
            if "paraphrase_and_synonym_recognition" in skills_by_code:
                matched.append("paraphrase_and_synonym_recognition")

        if any(w in text for w in ("associez", "correspond", "compar", "différence", "profil")):
            if "compare_information" in skills_by_code:
                matched.append("compare_information")

        if any(w in text for w in ("ordre", "chronolog", "étape", "premier", "ensuite", "succession")):
            if "understand_sequence" in skills_by_code:
                matched.append("understand_sequence")

        if any(w in text for w in ("connecteur", "liaison", "néanmoins", "cependant", "en effet", "par conséquent")):
            if "discourse_connectors" in skills_by_code:
                matched.append("discourse_connectors")

        if any(w in text for w in ("préfixe", "suffixe", "radical", "formation du mot", "dérivé")):
            if "word_formation" in skills_by_code:
                matched.append("word_formation")

        if any(w in text for w in ("grammaire", "accord", "pluriel", "féminin", "participe passé")):
            if "grammatical_agreement" in skills_by_code:
                matched.append("grammatical_agreement")

        if any(w in text for w in ("subjonctif", "conditionnel", "mode")):
            if "mood_selection" in skills_by_code:
                matched.append("mood_selection")
        elif any(w in text for w in ("imparfait", "passé composé", "temps du verbe", "futur")):
            if "tense_selection" in skills_by_code:
                matched.append("tense_selection")
        elif any(w in text for w in ("conjug", "verbe")):
            if "verb_conjugation" in skills_by_code:
                matched.append("verb_conjugation")

        if any(w in text for w in ("pronom", "antécédent", "renvoie à", "désigne", "remplace")):
            if "pronoun_usage" in skills_by_code:
                matched.append("pronoun_usage")
            elif "reference_resolution" in skills_by_code:
                matched.append("reference_resolution")

        if any(w in text for w in ("mot", "sens", "vocabulaire", "expression", "locution")):
            if "vocabulary_in_context" in skills_by_code:
                matched.append("vocabulary_in_context")

        # 2. Filter and align with TaskType allowed skills if available
        if task_type_code and task_type_code in cls.TASK_TYPE_ALLOWED_SKILLS:
            allowed = set(cls.TASK_TYPE_ALLOWED_SKILLS[task_type_code])
            task_filtered = [m for m in matched if m in allowed]
            if task_filtered:
                matched = task_filtered
            else:
                for fallback_code in cls.TASK_TYPE_ALLOWED_SKILLS[task_type_code]:
                    if fallback_code in skills_by_code:
                        matched.append(fallback_code)
                        if len(matched) >= 2:
                            break

        # 3. Support legacy or custom codes in skills_by_code (e.g. CE-*, CO-*)
        if not matched:
            for code, sk in skills_by_code.items():
                if not getattr(sk, "is_assessable", True):
                    continue
                code_upper = code.upper()
                is_reading_skill = code_upper.startswith("CE-") or "read" in (sk.domain or "") or sk.category == "reading"
                is_listening_skill = code_upper.startswith("CO-") or "listen" in (sk.domain or "") or sk.category == "listening"
                if modality == "reading" and is_reading_skill:
                    matches_reading = (
                        (any(w in text for w in ("global", "thème", "idée")) and any(t in code_upper for t in ("COMP-GLOB", "GLOBAL", "MAIN")))
                        or (any(w in text for w in ("détail", "information")) and any(t in code_upper for t in ("COMP-FIN", "DETAIL")))
                        or (any(w in text for w in ("grammaire", "temps", "accord")) and "GRAM" in code_upper)
                    )
                    if matches_reading:
                        matched.append(code)
                elif modality == "listening" and is_listening_skill:
                    matches_listening = (
                        (any(w in text for w in ("intention", "sentiment")) and any(t in code_upper for t in ("INTENT", "INFER")))
                        or any(t in code_upper for t in ("COMP-GLOB", "MAIN"))
                    )
                    if matches_listening:
                        matched.append(code)

        # 4. Deterministic fallback to canonical skills
        if not matched:
            for default_code in ("identify_main_idea", "identify_specific_detail", "locate_information", "vocabulary_in_context"):
                if default_code in skills_by_code:
                    matched.append(default_code)
                    break

        if not matched and skills_by_code:
            assessable_codes = [c for c, s in skills_by_code.items() if getattr(s, "is_assessable", True)]
            if assessable_codes:
                matched.append(assessable_codes[0])

        return list(dict.fromkeys(matched))[:3]

    @classmethod
    def _match_canonical_task(
        cls,
        prompt: str,
        stimulus_text: str | None,
        modality: str,
        level: str | None,
        response_type: str,
        task_types_by_code: dict[str, TaskType],
    ) -> str | None:
        """Deterministically generates and resolves the best-fitting canonical TaskType code if omitted."""
        text = f"{prompt} {stimulus_text or ''}".lower()
        word_count = len(stimulus_text.split()) if stimulus_text else 0
        lvl = (level or "B1").upper()

        # 1. Structure-specific mappings across modalities
        if response_type == "ordering" and "text_ordering" in task_types_by_code:
            return "text_ordering"
        if response_type == "matching":
            if any(w in text for w in ("graph", "tableau", "statistique", "chiffre")) and "graph_matching" in task_types_by_code:
                return "graph_matching"
            if modality == "listening" and "public_survey" in task_types_by_code:
                return "public_survey"
            if "document_matching" in task_types_by_code:
                return "document_matching"
        if response_type in ("gap_fill", "short_text"):
            if word_count > 40 and "text_gap" in task_types_by_code:
                return "text_gap"
            if "sentence_gap" in task_types_by_code:
                return "sentence_gap"

        # 2. Modality: Reading
        if modality == "reading":
            if (
                any(w in text for w in ("règlement", "formulaire", "administration", "préfecture", "démarche", "loi", "décret", "consigne"))
                and "administrative_document" in task_types_by_code
            ):
                return "administrative_document"
            if (
                any(w in text for w in ("note de service", "collaborateur", "entreprise", "réunion", "poste à pourvoir", "ressources humaines", "direction"))
                and "professional_document" in task_types_by_code
            ):
                return "professional_document"
            if (
                any(w in text for w in ("article", "tribune", "journal", "presse", "éditorial", "édito", "auteur", "débat", "analyse", "chronique", "essai", "point de vue"))
                and "press_article" in task_types_by_code
            ):
                return "press_article"
            if (
                (lvl in ("A1", "A2") or any(w in text for w in ("annonce", "vendre", "louer", "affiche", "horaire", "menu", "prix", "contactez", "offre d'emploi")))
                and "daily_document" in task_types_by_code
            ):
                return "daily_document"
            if lvl in ("B1", "B2", "C1", "C2") and "press_article" in task_types_by_code:
                return "press_article"
            if "daily_document" in task_types_by_code:
                return "daily_document"

        # 3. Modality: Listening
        elif modality == "listening":
            if any(w in text for w in ("dialogue", "conversation", "parlent", "interlocuteur")) and "conversation_extract" in task_types_by_code:
                return "conversation_extract"
            if any(w in text for w in ("radio", "chronique", "journal", "reportage", "émission")) and "radio_broadcast" in task_types_by_code:
                return "radio_broadcast"
            if any(w in text for w in ("gare", "aéroport", "magasin", "message répondeur", "annonce")) and "short_message" in task_types_by_code:
                return "short_message"
            if "radio_broadcast" in task_types_by_code:
                return "radio_broadcast"

        # 4. Modality: Lexique & Structure
        elif modality == "lexique_structure":
            if any(w in text for w in ("suffixe", "préfixe", "formation")) and "word_formation" in task_types_by_code:
                return "word_formation"
            if any(w in text for w in ("adjectif", "accord")) and "adjective_agreement" in task_types_by_code:
                return "adjective_agreement"
            if any(w in text for w in ("pronom", "anaphore", "remplace")) and "pronoun_reference" in task_types_by_code:
                return "pronoun_reference"
            if "syntax_construction" in task_types_by_code:
                return "syntax_construction"

        # 5. Fallback: match any active task belonging to this modality
        for tt in task_types_by_code.values():
            if getattr(tt, "modality", None) == modality:
                return tt.code

        return None

    # ---------------------------------------------------------------------------
    # 4. Bulk Import Transaction Commit
    # ---------------------------------------------------------------------------
    @classmethod
    async def commit_bulk_import(
        cls,
        db: AsyncSession,
        payload: BulkImportCommitRequest,
        actor_id: uuid.UUID | None = None,
    ) -> BulkImportCommitResponse:
        """Atomically inserts validated bulk question records into PostgreSQL."""
        created_ids: list[uuid.UUID] = []
        errors: list[dict[str, Any]] = []

        # Query active assessable skills for tag linking
        stmt = select(Skill).where(Skill.is_active.is_(True), Skill.is_assessable.is_(True)).order_by(Skill.order_index)
        all_skills = list((await db.execute(stmt)).scalars().all())
        skills_by_code = {s.code: s for s in all_skills}
        skills_by_lower = {s.code.lower(): s for s in all_skills}

        # Query active task types for linking and automatic matching
        stmt_tt = select(TaskType).where(TaskType.is_active.is_(True))
        all_task_types = list((await db.execute(stmt_tt)).scalars().all())
        task_types_by_code = {tt.code.lower(): tt for tt in all_task_types}

        now = datetime.datetime.now(datetime.UTC)
        skipped_duplicates_count = 0
        committed_hashes: set[str] = set()

        for idx, item in enumerate(payload.items):
            if not item.is_valid:
                errors.append({"item_index": idx, "prompt": item.prompt[:50], "errors": item.validation_errors})
                continue

            # 0. Duplicate check
            q_hash = compute_item_hash(
                item.prompt,
                stimulus_text=item.stimulus_text,
                stimulus_title=item.stimulus_title,
                stimulus_id=item.stimulus_id,
                options=item.options,
                gaps=item.gaps,
            )
            if payload.skip_duplicates:
                # Check intra-commit batch duplicates
                if q_hash in committed_hashes:
                    skipped_duplicates_count += 1
                    continue
                # Check against existing database items
                existing_q = await db.scalar(
                    select(Question.id).where(Question.item_hash == q_hash).limit(1)
                )
                if existing_q:
                    skipped_duplicates_count += 1
                    continue

            try:
                # 1. Stimulus Creation or Linking
                stim_id: uuid.UUID | None = item.stimulus_id
                if not stim_id and (item.stimulus_text or item.stimulus_title):
                    from app.modules.admin.schemas import AdminStimulusCreate

                    stim_create = AdminStimulusCreate(
                        title=item.stimulus_title or f"Document {item.modality.capitalize()}",
                        modality=item.modality,
                        content_text=item.stimulus_text,
                        media_url=item.media_url,
                        text_format="markdown",
                    )
                    stim = await AdminContentService.create_stimulus(db=db, payload=stim_create, actor_id=actor_id)
                    stim_id = stim.id

                # 2. Difficulty Rating and Cognitive Complexity
                cefr_level = (item.target_cefr or item.level or "B1").upper()
                diff_rating = cls._compute_difficulty_rating(cefr_level, item.difficulty)
                cog_complexity = cls._normalize_cognitive_complexity(item.cognitive_complexity)

                # 3. Create Question record
                norm_q_type, norm_r_type = cls._normalize_question_and_response_type(
                    item.question_type, item.response_type
                )
                q_type = QuestionType.SINGLE_CHOICE
                try:
                    q_type = QuestionType(norm_q_type)
                except ValueError:
                    q_type = QuestionType.SINGLE_CHOICE

                # Resolve or auto-generate TaskType
                task_type_id: uuid.UUID | None = None
                target_tt_code = item.task_type_code
                if not target_tt_code:
                    target_tt_code = cls._match_canonical_task(
                        prompt=item.prompt,
                        stimulus_text=item.stimulus_text,
                        modality=item.modality,
                        level=cefr_level,
                        response_type=norm_r_type,
                        task_types_by_code=task_types_by_code,
                    )
                if target_tt_code:
                    found_tt = task_types_by_code.get(target_tt_code.lower())
                    if found_tt:
                        task_type_id = found_tt.id

                scoring_payload: dict[str, Any] | None = None
                if norm_r_type == "matching":
                    pairs = []
                    for o in item.options:
                        if "->" in o.content:
                            left_part, right_part = o.content.split("->", 1)
                            l_val = left_part.strip()
                            r_val = right_part.strip()
                            pairs.append({
                                "left": l_val,
                                "right": r_val,
                                "source_id": l_val,
                                "target_id": r_val,
                                "left_text": l_val,
                                "right_text": r_val,
                            })
                        else:
                            l_val = f"Élément {o.order_index + 1}"
                            r_val = o.content.strip()
                            pairs.append({
                                "left": l_val,
                                "right": r_val,
                                "source_id": l_val,
                                "target_id": r_val,
                                "left_text": l_val,
                                "right_text": r_val,
                            })
                    scoring_payload = {"pairs": pairs}
                elif norm_r_type == "ordering":
                    scoring_payload = {"sequence": [o.content for o in item.options]}
                elif norm_r_type == "gap_fill":
                    if item.gaps:
                        scoring_payload = {"gaps": [g.model_dump() for g in item.gaps]}
                    elif item.scoring_payload and "gaps" in item.scoring_payload:
                        scoring_payload = item.scoring_payload
                    else:
                        accepted = [o.content for o in item.options if o.is_correct] or [o.content for o in item.options]
                        scoring_payload = {"accepted_answers": accepted}
                elif norm_r_type == "short_text":
                    accepted = [o.content for o in item.options if o.is_correct] or [o.content for o in item.options]
                    scoring_payload = {"accepted_answers": accepted}
                elif norm_r_type in ("long_text", "spoken_response", "interaction"):
                    scoring_payload = {"criteria": ["pertinence", "coherence", "lexique", "grammaire"]}

                author_type_str = (
                    QuestionAuthorType.IMPORTED.value
                    if hasattr(QuestionAuthorType.IMPORTED, "value")
                    else "imported"
                )

                question = Question(
                    prompt=item.prompt,
                    question_type=q_type,
                    response_type=norm_r_type,
                    stimulus_id=stim_id,
                    task_type_id=task_type_id,
                    level=cefr_level,
                    target_cefr=cefr_level,
                    difficulty=item.difficulty,
                    difficulty_rating=diff_rating,
                    cognitive_complexity=cog_complexity,
                    points=item.points,
                    penalty_points=item.penalty_points,
                    scoring_payload=scoring_payload,
                    explanation=item.explanation,
                    media_url=item.media_url,
                    status=payload.default_status,
                    version=1,
                    item_hash=q_hash,
                    is_live_delivered=False,
                    created_by_user_id=actor_id,
                    updated_by_user_id=actor_id,
                    created_at=now,
                    updated_at=now,
                )
                db.add(question)
                await db.flush()

                # 4. Create Question Options
                created_opts: list[QuestionOption] = []
                for opt_idx, opt_payload in enumerate(item.options):
                    opt = QuestionOption(
                        question_id=question.id,
                        content=opt_payload.content,
                        is_correct=opt_payload.is_correct,
                        order_index=opt_idx,
                        explanation=opt_payload.explanation,
                        misconception_type=opt_payload.misconception_type,
                        distractor_rationale=opt_payload.distractor_rationale,
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(opt)
                    created_opts.append(opt)

                if created_opts and norm_r_type == "gap_fill" and scoring_payload and "gaps" in scoring_payload:
                    await db.flush()
                    opt_pointer = 0
                    has_updated_payload = False
                    new_gaps: list[dict[str, Any]] = []
                    for gap_dict in scoring_payload.get("gaps", []):
                        gap_copy = dict(gap_dict) if isinstance(gap_dict, dict) else gap_dict
                        if isinstance(gap_copy, dict) and "options" in gap_copy and gap_copy["options"]:
                            new_opts = []
                            for gap_opt in gap_copy["options"]:
                                opt_copy = dict(gap_opt) if isinstance(gap_opt, dict) else gap_opt
                                if isinstance(opt_copy, dict) and opt_pointer < len(created_opts):
                                    opt_copy["id"] = str(created_opts[opt_pointer].id)
                                    opt_pointer += 1
                                    has_updated_payload = True
                                new_opts.append(opt_copy)
                            gap_copy["options"] = new_opts
                        new_gaps.append(gap_copy)
                    if has_updated_payload:
                        question.scoring_payload = {"gaps": new_gaps}
                        flag_modified(question, "scoring_payload")

                # 5. Resolve & Create Question Skill Tags (balanced weights = 1.00 per dimension)
                matched_skills: list[Skill] = []
                seen_skill_ids: set[uuid.UUID] = set()
                for raw_code in item.skill_codes:
                    norm_code = cls.LEGACY_SKILL_ALIASES.get(raw_code.strip().lower(), raw_code.strip())
                    sk = skills_by_code.get(norm_code) or skills_by_lower.get(norm_code.lower())
                    if sk and sk.id not in seen_skill_ids:
                        matched_skills.append(sk)
                        seen_skill_ids.add(sk.id)

                if not matched_skills and skills_by_code:
                    fallback_codes = cls._match_canonical_skills(
                        prompt=item.prompt,
                        stimulus_text=item.stimulus_text,
                        modality=item.modality,
                        skills_by_code=skills_by_code,
                    )
                    for fc in fallback_codes:
                        sk = skills_by_code.get(fc)
                        if sk and sk.id not in seen_skill_ids:
                            matched_skills.append(sk)
                            seen_skill_ids.add(sk.id)

                if matched_skills:
                    skills_by_dim: dict[str, list[Skill]] = {}
                    for sk in matched_skills:
                        dim_key = (
                            sk.dimension.value
                            if hasattr(sk.dimension, "value") and sk.dimension is not None
                            else str(sk.dimension or "default")
                        )
                        skills_by_dim.setdefault(dim_key, []).append(sk)

                    for dim_skills in skills_by_dim.values():
                        weight_per_skill = round(1.0 / len(dim_skills), 2)
                        for s_idx, sk in enumerate(dim_skills):
                            assigned_weight = (
                                round(1.0 - (weight_per_skill * (len(dim_skills) - 1)), 2)
                                if s_idx == len(dim_skills) - 1
                                else weight_per_skill
                            )
                            tag = QuestionSkillTag(
                                question_id=question.id,
                                skill_id=sk.id,
                                weight=assigned_weight,
                                role=SkillTagRole.PRIMARY if s_idx == 0 else SkillTagRole.SECONDARY,
                                created_at=now,
                                updated_at=now,
                            )
                            db.add(tag)

                # 6. Create Provenance
                prov = QuestionProvenance(
                    question_id=question.id,
                    author_type=author_type_str,
                    source_type="bulk_import",
                    created_by_user_id=actor_id,
                )
                db.add(prov)

                await db.flush()

                # 7. Initial validation check
                await QuestionValidationEngine.validate_and_persist(
                    db=db,
                    question=question,
                    actor_id=actor_id,
                    check_duplication=False,
                )

                created_ids.append(question.id)
                committed_hashes.add(q_hash)

            except Exception as item_ex:  # noqa: BLE001
                logger.error("bulk_import_commit_item_error", index=idx, error=str(item_ex))
                errors.append({"item_index": idx, "prompt": item.prompt[:50], "error": str(item_ex)})

        await db.commit()

        if actor_id and created_ids:
            await AuditService.log_event(
                db=db,
                actor_user_id=actor_id,
                action=AuditAction.CREATE,
                entity_type="question_bulk_import",
                entity_id=None,
                payload={"created_count": len(created_ids), "skipped_duplicates_count": skipped_duplicates_count, "error_count": len(errors)},
            )

        return BulkImportCommitResponse(
            created_count=len(created_ids),
            skipped_duplicates_count=skipped_duplicates_count,
            created_ids=created_ids,
            errors=errors,
        )

    # ---------------------------------------------------------------------------
    # 5. Template Generation (CSV & JSON)
    # ---------------------------------------------------------------------------
    @classmethod
    def generate_csv_template(cls) -> str:
        """Generates standard CSV template headers and sample rows covering every question_type."""
        headers = [
            "prompt",
            "task_type_code",
            "question_type",
            "modality",
            "level",
            "difficulty",
            "cognitive_complexity",
            "option_a",
            "option_b",
            "option_c",
            "option_d",
            "correct_option",
            "stimulus_title",
            "stimulus_text",
            "media_url",
            "explanation",
            "skill_codes",
        ]
        sample_rows = [
            # 1. single_choice (QCM à choix unique)
            [
                "Quel est le thème principal de cette annonce ?",
                "daily_document",
                "single_choice",
                "reading",
                "B1",
                "2",
                "recall_recognition",
                "Une ouverture de musée",
                "Une fermeture de ligne de métro",
                "Un festival de musique",
                "Une grève générale",
                "B",
                "Information RATP",
                "En raison de travaux de modernisation sur la ligne 1, le trafic sera interrompu tout le week-end.",
                "",
                "Le document annonce clairement l'interruption du trafic pour travaux de modernisation.",
                "identify_main_idea,locate_information",
            ],
            # 2. multiple_choice (QCM à choix multiple)
            [
                "Quelles conditions doivent être remplies pour bénéficier du tarif réduit ?",
                "press_article",
                "multiple_choice",
                "reading",
                "B2",
                "3",
                "interpretation",
                "Avoir moins de 26 ans",
                "Habiter hors de l'Union européenne",
                "Présenter un justificatif de scolarité",
                "Réserver au moins 30 jours à l'avance",
                "A,C",
                "Conditions tarifaires du musée",
                "Le tarif réduit est accordé aux jeunes de moins de 26 ans ainsi qu'aux étudiants sur présentation d'un justificatif en cours de validité.",
                "",
                "Le texte mentionne deux critères éligibles : moins de 26 ans (A) et justificatif étudiant (C).",
                "identify_specific_detail,locate_information",
            ],
            # 3. gap_fill (Texte à trous / phrase à compléter)
            [
                "Complétez la phrase : « Bien qu'il ___ très tard, le directeur a tenu à relire le rapport. »",
                "sentence_gap",
                "gap_fill",
                "lexique_structure",
                "B2",
                "3",
                "interpretation",
                "soit",
                "est",
                "sera",
                "était",
                "A",
                "Exercice de grammaire",
                "La locution conjonctive « bien que » exprime la concession et exige l'emploi du mode subjonctif.",
                "",
                "Après « bien que », on utilise le subjonctif présent (« soit »).",
                "mood_selection,subordination_and_coordination",
            ],
            # 4. short_text / text_input (Réponse courte ouverte)
            [
                "Quel mot du texte est synonyme de « amélioration » dans le premier paragraphe ?",
                "reformulation",
                "short_text",
                "reading",
                "B2",
                "3",
                "recall_recognition",
                "modernisation",
                "perfectionnement",
                "",
                "",
                "A,B",
                "Modernisation du réseau",
                "Le plan quinquennal prévoit une modernisation progressive des infrastructures ferroviaires régionales.",
                "",
                "Le terme « modernisation » (ou « perfectionnement ») correspond au sens recherché.",
                "paraphrase_and_synonym_recognition,vocabulary_in_context",
            ],
            # 5. matching (Appariement de paires)
            [
                "Associez chaque rubrique d'annonce au profil de lecteur correspondant.",
                "document_matching",
                "matching",
                "reading",
                "B1",
                "2",
                "interpretation",
                "Annonce 1 -> Jeune diplômé cherchant un stage",
                "Annonce 2 -> Famille recherchant un appartement",
                "Annonce 3 -> Randonneur souhaitant du matériel d'occasion",
                "Annonce 4 -> Étudiant proposant des cours de soutien",
                "A,B,C,D",
                "Petites annonces locales",
                "1. Cabinet recrute stagiaire. 2. Loue T4 proche écoles. 3. Vends sac à dos et tente. 4. Donne cours de mathématiques.",
                "",
                "Chaque petite annonce correspond à un besoin spécifique identifié par ses mots-clés.",
                "compare_information,locate_information",
            ],
            # 6. ordering (Ordonnancement / remise en ordre chronologique)
            [
                "Remettez dans l'ordre chronologique les étapes de la procédure d'inscription.",
                "text_ordering",
                "ordering",
                "reading",
                "B1",
                "3",
                "interpretation",
                "Créer un compte personnel sur le portail en ligne",
                "Téléverser les pièces justificatives numérisées",
                "Valider le paiement des frais de dossier",
                "Télécharger la convocation officielle à l'examen",
                "A,B,C,D",
                "Guide d'inscription en ligne",
                "Pour vous inscrire, commencez par créer votre compte, déposez ensuite vos justificatifs, réglez les frais puis téléchargez votre convocation.",
                "",
                "L'ordre suit les connecteurs temporels : commencer par, ensuite, puis.",
                "understand_sequence,discourse_connectors",
            ],
            # 7. long_text (Expression écrite longue)
            [
                "Rédigez une lettre argumentée au maire (180 mots minimum) pour proposer l'aménagement de nouvelles pistes cyclables dans votre quartier.",
                "opinion_letter",
                "long_text",
                "writing",
                "B2",
                "4",
                "critical_evaluation",
                "",
                "",
                "",
                "",
                "",
                "Section B — Lettre ouverte",
                "« La municipalité devrait-elle limiter la place des voitures en centre-ville ? » Vous écrivez au courrier des lecteurs pour partager votre point de vue.",
                "",
                "Évaluation sur la structure argumentative, la richesse lexicale, la cohérence et la maîtrise morphosyntaxique.",
                "identify_claim,discourse_connectors,register_and_formality",
            ],
            # 8. spoken_response (Expression orale — monologue suivi)
            [
                "Présentez les avantages et les inconvénients du télétravail à partir de votre expérience ou d'exemples précis (2 à 3 minutes).",
                "persuasive_argumentation",
                "spoken_response",
                "speaking",
                "B2",
                "3",
                "critical_evaluation",
                "",
                "",
                "",
                "",
                "",
                "Sujet d'exposé oral",
                "Le télétravail s'est largement généralisé dans les entreprises de services au cours des dernières années.",
                "",
                "Le candidat doit structurer son propos avec une introduction, des arguments illustrés et une conclusion.",
                "identify_supporting_reason,discourse_connectors,phonological_control",
            ],
            # 9. interaction (Expression orale — jeu de rôle interactif)
            [
                "Vous appelez l'organisateur d'un séjour linguistique à Montréal pour poser une dizaine de questions sur l'hébergement, les cours et les tarifs.",
                "information_gathering",
                "interaction",
                "speaking",
                "B1",
                "2",
                "interpretation",
                "",
                "",
                "",
                "",
                "",
                "Section A — Prise d'informations",
                "Séjour intensif de français à Montréal : cours le matin, activités culturelles l'après-midi, hébergement en famille d'accueil ou résidence. Renseignements par téléphone.",
                "",
                "Le candidat doit utiliser le registre formel (« vous ») et varier la formulation des questions.",
                "identify_communicative_intention,register_and_formality,sentence_structure",
            ],
        ]
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        for row in sample_rows:
            writer.writerow(row)
        return output.getvalue()
