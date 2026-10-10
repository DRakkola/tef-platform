"""Service implementation for Question Bank Bulk Operations, File Parsing, AI Auto-Tagging, and Bulk Import."""

from __future__ import annotations

import csv
import datetime
import io
import json
import re
import uuid
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.admin.bulk_question_schemas import (
    AIAutoTagAndFormatRequest,
    AIAutoTagAndFormatResponse,
    BulkActionErrorDetail,
    BulkActionRequest,
    BulkActionResponse,
    BulkActionType,
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
                    if not val.is_valid:
                        blocking_msgs = [
                            iss.message for iss in val.issues if iss.severity == "blocking"
                        ]
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
    @classmethod
    def parse_import_file(cls, content_bytes: bytes, filename: str) -> BulkParseResponse:
        """Parses question batch file into standardized preview items."""
        ext = filename.lower().split(".")[-1] if "." in filename else ""
        items: list[BulkImportQuestionItem] = []
        parse_errors: list[str] = []

        if ext == "json":
            try:
                data = json.loads(content_bytes.decode("utf-8-sig"))
                raw_list = data if isinstance(data, list) else data.get("items", [])
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
                # Decode with BOM detection
                decoded = content_bytes.decode("utf-8-sig")
                reader = csv.DictReader(io.StringIO(decoded))
                for idx, row in enumerate(reader):
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
                        if not any(row_dict.values()):
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

        valid_count = sum(1 for item in items if item.is_valid)
        invalid_count = len(items) - valid_count

        return BulkParseResponse(
            items=items,
            total_parsed=len(items),
            valid_count=valid_count,
            invalid_count=invalid_count,
            parse_errors=parse_errors,
        )

    @classmethod
    def _csv_row_to_import_item(cls, row: dict[str, Any], temp_id: str) -> BulkImportQuestionItem:
        """Transforms a flat CSV/Excel dictionary into a structured BulkImportQuestionItem."""
        # Normalize keys
        clean = {k.strip().lower().replace(" ", "_"): ("" if v is None else str(v).strip()) for k, v in row.items() if k}

        prompt = clean.get("prompt") or clean.get("question") or clean.get("enonce") or ""
        modality = clean.get("modality", "reading").lower()
        if modality not in ("reading", "listening", "writing", "speaking"):
            modality = "reading"

        level = clean.get("level") or clean.get("target_cefr") or clean.get("cefr") or "B1"
        level = level.upper()
        if level not in ("A1", "A2", "B1", "B2", "C1", "C2"):
            level = "B1"

        try:
            diff = int(clean.get("difficulty", "3"))
            diff = max(1, min(5, diff))
        except ValueError:
            diff = 3

        try:
            points = int(clean.get("points", "1"))
            points = max(1, points)
        except ValueError:
            points = 1

        try:
            penalty = int(clean.get("penalty_points", "0"))
        except ValueError:
            penalty = 0

        # Build options
        options: list[BulkOptionPayload] = []
        correct_indicator = clean.get("correct_option") or clean.get("correct_answer") or clean.get("reponse_correcte") or "A"
        correct_indicator = correct_indicator.strip()

        # Check for option_a, option_b, etc. or opt_1, opt_2
        opt_keys = [
            ("a", clean.get("option_a") or clean.get("opt_a") or clean.get("choice_a")),
            ("b", clean.get("option_b") or clean.get("opt_b") or clean.get("choice_b")),
            ("c", clean.get("option_c") or clean.get("opt_c") or clean.get("choice_c")),
            ("d", clean.get("option_d") or clean.get("opt_d") or clean.get("choice_d")),
        ]

        # Alternative: 1, 2, 3, 4
        if not any(v for _, v in opt_keys):
            opt_keys = [
                ("1", clean.get("option_1") or clean.get("choice_1")),
                ("2", clean.get("option_2") or clean.get("choice_2")),
                ("3", clean.get("option_3") or clean.get("choice_3")),
                ("4", clean.get("option_4") or clean.get("choice_4")),
            ]

        has_options = any(bool(v) for _, v in opt_keys)
        if has_options:
            for idx, (letter_or_num, opt_text) in enumerate(opt_keys):
                if opt_text:
                    is_corr = (
                        correct_indicator.lower() == letter_or_num.lower()
                        or correct_indicator.lower() == opt_text.lower()
                        or f"option {letter_or_num.lower()}" == correct_indicator.lower()
                    )
                    options.append(
                        BulkOptionPayload(
                            content=opt_text,
                            is_correct=is_corr,
                            order_index=idx,
                            explanation=clean.get(f"explanation_{letter_or_num}") or clean.get(f"explication_{letter_or_num}"),
                        )
                    )

            # If no correct option was flagged, fallback to first option
            if options and not any(o.is_correct for o in options):
                options[0].is_correct = True

        validation_errors: list[str] = []
        if not prompt:
            validation_errors.append("Le champ 'prompt' (énoncé de la question) est obligatoire.")
        if options and not any(o.is_correct for o in options):
            validation_errors.append("Au moins une réponse correcte est obligatoire.")

        skill_codes_raw = clean.get("skill_codes") or clean.get("skills") or clean.get("competences") or ""
        skill_codes = [s.strip() for s in re.split(r"[,;]\s*", skill_codes_raw) if s.strip()]

        return BulkImportQuestionItem(
            temp_id=temp_id,
            prompt=prompt,
            question_type=clean.get("question_type", "single_choice"),
            response_type=clean.get("response_type", "single_choice"),
            modality=modality,
            level=level,
            target_cefr=level,
            difficulty=diff,
            cognitive_complexity=clean.get("cognitive_complexity", "understand"),
            points=points,
            penalty_points=penalty,
            explanation=clean.get("explanation") or clean.get("explication"),
            stimulus_title=clean.get("stimulus_title") or clean.get("titre_document"),
            stimulus_text=clean.get("stimulus_text") or clean.get("texte_document") or clean.get("passage"),
            media_url=clean.get("media_url") or clean.get("audio_url"),
            options=options,
            skill_codes=skill_codes,
            is_valid=(len(validation_errors) == 0),
            validation_errors=validation_errors,
        )

    @classmethod
    def _dict_to_import_item(cls, raw: dict[str, Any], temp_id: str) -> BulkImportQuestionItem:
        """Transforms a raw JSON dictionary into a BulkImportQuestionItem."""
        prompt = str(raw.get("prompt") or raw.get("question") or "")
        options_data = raw.get("options") or []
        options: list[BulkOptionPayload] = []

        if isinstance(options_data, list):
            for idx, opt in enumerate(options_data):
                if isinstance(opt, dict):
                    options.append(
                        BulkOptionPayload(
                            content=str(opt.get("content") or opt.get("text") or ""),
                            is_correct=bool(opt.get("is_correct", False)),
                            explanation=opt.get("explanation"),
                            order_index=int(opt.get("order_index", idx)),
                            misconception_type=opt.get("misconception_type"),
                        )
                    )
                elif isinstance(opt, str):
                    options.append(
                        BulkOptionPayload(
                            content=opt,
                            is_correct=(idx == 0),
                            order_index=idx,
                        )
                    )

        validation_errors: list[str] = []
        if not prompt:
            validation_errors.append("Le champ 'prompt' (énoncé de la question) est obligatoire.")
        if options and not any(o.is_correct for o in options):
            validation_errors.append("Au moins une réponse correcte est obligatoire.")

        modality = str(raw.get("modality", "reading")).lower()
        if modality not in ("reading", "listening", "writing", "speaking"):
            modality = "reading"

        level = str(raw.get("level") or raw.get("target_cefr") or "B1").upper()
        if level not in ("A1", "A2", "B1", "B2", "C1", "C2"):
            level = "B1"

        return BulkImportQuestionItem(
            temp_id=temp_id,
            prompt=prompt,
            question_type=str(raw.get("question_type", "single_choice")),
            response_type=str(raw.get("response_type", "single_choice")),
            modality=modality,
            level=level,
            target_cefr=level,
            difficulty=int(raw.get("difficulty", 3)),
            cognitive_complexity=raw.get("cognitive_complexity", "understand"),
            points=int(raw.get("points", 1)),
            penalty_points=int(raw.get("penalty_points", 0)),
            explanation=raw.get("explanation"),
            stimulus_title=raw.get("stimulus_title"),
            stimulus_text=raw.get("stimulus_text"),
            stimulus_id=uuid.UUID(raw["stimulus_id"]) if raw.get("stimulus_id") else None,
            media_url=raw.get("media_url"),
            options=options,
            skill_codes=raw.get("skill_codes", []),
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
        # Query active skills from DB to map correctly
        stmt = select(Skill).where(Skill.is_active.is_(True)).order_by(Skill.order_index)
        skills = list((await db.execute(stmt)).scalars().all())
        skills_by_code = {s.code: s for s in skills}

        enriched_items: list[BulkImportQuestionItem] = []

        for item in payload.items:
            # 1. Rich Text Formatting
            if payload.auto_format_rich_text and item.stimulus_text:
                item.stimulus_text = cls._format_document_markdown(
                    raw_text=item.stimulus_text,
                    title=item.stimulus_title,
                )

            # 2. Skill & CEFR Auto-tagging
            if payload.auto_tag_skills:
                # Infer CEFR level if missing or default B1
                inferred_cefr = cls._infer_cefr_level(item.prompt, item.stimulus_text)
                if not item.target_cefr or item.target_cefr == "B1":
                    item.target_cefr = inferred_cefr
                    item.level = inferred_cefr

                # Assign canonical skill tags matching the modality
                suggested_codes = cls._match_canonical_skills(
                    prompt=item.prompt,
                    stimulus_text=item.stimulus_text,
                    modality=item.modality,
                    skills_by_code=skills_by_code,
                )
                item.skill_codes = suggested_codes

            # Revalidate
            item.validation_errors = []
            if not item.prompt:
                item.validation_errors.append("Le champ 'prompt' est obligatoire.")
            if item.options and not any(o.is_correct for o in item.options):
                item.validation_errors.append("Au moins une réponse correcte est obligatoire.")
            item.is_valid = len(item.validation_errors) == 0

            enriched_items.append(item)

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

    @classmethod
    def _match_canonical_skills(
        cls,
        prompt: str,
        stimulus_text: str | None,
        modality: str,
        skills_by_code: dict[str, Skill],
    ) -> list[str]:
        """Matches competencies from available skills catalog in the database."""
        text = f"{prompt} {stimulus_text or ''}".lower()
        matched: list[str] = []

        # Find matching codes in skills_by_code
        for code, sk in skills_by_code.items():
            if modality == "reading" and (code.startswith("CE-") or "read" in (sk.domain or "")):
                if "global" in text or "thème" in text or "idée" in text:
                    if "COMP-GLOB" in code or "GLOBAL" in code:
                        matched.append(code)
                elif "détail" in text or "information" in text:
                    if "COMP-FIN" in code or "DETAIL" in code:
                        matched.append(code)
                elif ("grammaire" in text or "temps" in text or "accord" in text) and "GRAM" in code:
                    matched.append(code)

            elif modality == "listening" and (code.startswith("CO-") or "listen" in (sk.domain or "")):
                if "intention" in text or "sentiment" in text:
                    if "INTENT" in code or "INFER" in code:
                        matched.append(code)
                else:
                    if "COMP-GLOB" in code or "MAIN" in code:
                        matched.append(code)

        # Fallback to standard canonical skill if no direct heuristic match
        if not matched:
            mod_prefix = "CE-" if modality == "reading" else "CO-"
            candidates = [c for c in skills_by_code if c.startswith(mod_prefix)]
            if candidates:
                matched.append(candidates[0])

        return list(dict.fromkeys(matched))[:3]

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

        # Query active skills for tag linking
        stmt = select(Skill).where(Skill.is_active.is_(True))
        all_skills = list((await db.execute(stmt)).scalars().all())
        skills_by_code = {s.code: s for s in all_skills}

        now = datetime.datetime.now(datetime.UTC)

        for idx, item in enumerate(payload.items):
            if not item.is_valid:
                errors.append({"item_index": idx, "prompt": item.prompt[:50], "errors": item.validation_errors})
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

                # 2. Compute Item Hash
                q_hash = compute_item_hash(item.prompt)

                # 3. Create Question record
                q_type = QuestionType.SINGLE_CHOICE
                try:
                    q_type = QuestionType(item.question_type)
                except ValueError:
                    q_type = QuestionType.SINGLE_CHOICE

                question = Question(
                    prompt=item.prompt,
                    question_type=q_type,
                    response_type=item.response_type,
                    stimulus_id=stim_id,
                    level=item.level,
                    target_cefr=item.target_cefr or item.level,
                    difficulty=item.difficulty,
                    difficulty_rating=item.difficulty,
                    cognitive_complexity=item.cognitive_complexity,
                    points=item.points,
                    penalty_points=item.penalty_points,
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
                for opt_payload in item.options:
                    opt = QuestionOption(
                        question_id=question.id,
                        content=opt_payload.content,
                        is_correct=opt_payload.is_correct,
                        order_index=opt_payload.order_index,
                        explanation=opt_payload.explanation,
                        misconception_type=opt_payload.misconception_type,
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(opt)

                # 5. Create Question Skill Tags (balanced weights = 1.00)
                matched_skills = [skills_by_code[c] for c in item.skill_codes if c in skills_by_code]
                if matched_skills:
                    weight_per_skill = round(1.0 / len(matched_skills), 2)
                    for s_idx, sk in enumerate(matched_skills):
                        # Ensure sum equals exactly 1.00
                        assigned_weight = 1.0 - (weight_per_skill * (len(matched_skills) - 1)) if s_idx == len(matched_skills) - 1 else weight_per_skill
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
                author_type_str = QuestionAuthorType.IMPORTED.value if hasattr(QuestionAuthorType.IMPORTED, "value") else "imported"
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
                payload={"created_count": len(created_ids), "error_count": len(errors)},
            )

        return BulkImportCommitResponse(
            created_count=len(created_ids),
            created_ids=created_ids,
            errors=errors,
        )

    # ---------------------------------------------------------------------------
    # 5. Template Generation (CSV & JSON)
    # ---------------------------------------------------------------------------
    @classmethod
    def generate_csv_template(cls) -> str:
        """Generates standard CSV template headers and sample rows for bulk import."""
        headers = [
            "prompt",
            "question_type",
            "modality",
            "level",
            "difficulty",
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
            [
                "Quel est le thème principal de cette annonce ?",
                "single_choice",
                "reading",
                "B1",
                "2",
                "Une ouverture de musée",
                "Une fermeture de ligne de métro",
                "Un festival de musique",
                "Une grève générale",
                "B",
                "Information RATP",
                "En raison de travaux de modernisation sur la ligne 1, le trafic sera interrompu tout le week-end.",
                "",
                "Le document annonce clairement l'interruption du trafic pour travaux de modernisation.",
                "CE-L1-COMP-GLOB",
            ],
            [
                "Que doit faire le candidat avant le 15 mai ?",
                "single_choice",
                "reading",
                "B2",
                "3",
                "Envoyer son dossier complet",
                "Payer les frais de scolarité",
                "Prendre rendez-vous avec le directeur",
                "Passer un entretien oral",
                "A",
                "Appel à candidatures",
                "Les dossiers complets de candidature doivent parvenir au secrétariat au plus tard le 15 mai à minuit.",
                "",
                "La mention de la date limite du 15 mai concerne l'envoi du dossier complet.",
                "CE-L2-COMP-FIN",
            ],
        ]
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        for row in sample_rows:
            writer.writerow(row)
        return output.getvalue()
