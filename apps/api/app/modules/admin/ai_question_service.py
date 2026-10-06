"""Service layer for AI Question Generation Pipeline (Phase 7).

Integrates:
- Structured prompt engineering & CEFR calibration
- Real Gemini LLM API calls with deterministic fallback
- Strict DB taxonomy restriction (no hallucinated skill IDs)
- Automated duplicate detection against the question bank
- Full QuestionValidationEngine integration
- Second-pass pedagogical & linguistic AI critique (read-only)
- Conversion to persistent draft questions with complete provenance
- Strict immutability protection preventing modification of approved/published questions
"""

from __future__ import annotations

import datetime
import json
import re
import time
import uuid
from collections.abc import Sequence
from typing import Any

import structlog
from pydantic import ValidationError
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import AppException
from app.modules.admin.ai_question_schemas import (
    AIBatchGenerationResponse,
    AIGenerationJobCreateRequest,
    AIGenerationJobResponse,
    AIQuestionGenerationRequest,
    AIReviewReport,
    AIStimulusCandidate,
    AIStimulusGenerationRequest,
    CandidateGenerationMetadata,
    CandidateOptionPayload,
    CandidateRegenerateRequest,
    CandidateReviewRequest,
    CandidateSkillMapping,
    CatalogOption,
    DuplicateCheckReport,
    GeneratedQuestionCandidate,
    TaskFormatCatalogEntry,
    TaskFormatCatalogResponse,
)
from app.modules.admin.ai_sandbox_service import AISandboxService
from app.modules.admin.enums import AIGenerationJobStatus, AuditAction, ContentStatus, SkillTagRole
from app.modules.admin.models import AIGenerationJob
from app.modules.admin.question_formats import (
    QUESTION_FORMAT_SPECS,
    STIMULUS_AUDIO_TRANSCRIPT,
    STIMULUS_BROCHURE,
    STIMULUS_KIND_LABELS,
    STIMULUS_MULTI_DOCUMENT,
    STIMULUS_NONE,
    STIMULUS_PROMPT_LEAD,
    STIMULUS_TABLE,
    TaskFormatSpec,
    catalog_payload,
    get_spec,
    prompt_template_version_for,
    response_type_uses_options,
    standard_option_count_for,
)
from app.modules.admin.service import AuditService
from app.modules.assessments.enums import (
    CognitiveComplexityLevel,
    QuestionAuthorType,
    QuestionResponseType,
    QuestionType,
)
from app.modules.assessments.item_hash import compute_item_hash, normalize_prompt_for_hash
from app.modules.assessments.models import (
    AssessmentSectionQuestion,
    Question,
    QuestionOption,
    QuestionProvenance,
    QuestionSkillTag,
    Skill,
    Stimulus,
    TaskType,
)
from app.modules.assessments.question_validation import (
    QuestionValidationEngine,
    ValidationResult,
)

logger = structlog.get_logger("tef-api.admin.ai_question_generation")

# Maximum number of recent questions scanned for fuzzy duplicate detection.
# Bounded to keep generation latency predictable on large banks.
DUPLICATE_SCAN_LIMIT = 200

# Lexical similarity above which a candidate is treated as a probable duplicate.
DUPLICATE_SIMILARITY_THRESHOLD = 0.75

# Components that ``regenerate_draft_component`` knows how to rewrite.
REGENERABLE_COMPONENTS = ("distractors", "options", "prompt", "explanation")

# Default CEFR score midpoints
CEFR_MIDPOINTS: dict[str, int] = {
    "A1": 150,
    "A2": 250,
    "B1": 350,
    "B2": 450,
    "C1": 550,
    "C2": 650,
}

CEFR_ITEM_DIFFICULTY: dict[str, int] = {
    "A1": 1,
    "A2": 2,
    "B1": 3,
    "B2": 4,
    "C1": 5,
    "C2": 5,
}


def _tokenize_text(text: str) -> set[str]:
    """Extract lowercase alphanumeric tokens for similarity comparison."""
    if not text:
        return set()
    return set(re.findall(r"\b\w{3,}\b", text.lower()))


def _calculate_jaccard_similarity(tokens_a: set[str], tokens_b: set[str]) -> float:
    """Compute Jaccard similarity index between two token sets."""
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = len(tokens_a.intersection(tokens_b))
    union = len(tokens_a.union(tokens_b))
    return float(intersection) / float(union) if union > 0 else 0.0


def _estimate_cost_usd(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Estimate generation cost from configured token prices."""
    del model  # single provider family; pricing is global
    return (
        prompt_tokens * settings.GEMINI_PRICE_INPUT_PER_MTOK / 1_000_000
        + completion_tokens * settings.GEMINI_PRICE_OUTPUT_PER_MTOK / 1_000_000
    )


class AIQuestionGenerationService:
    """Core service for orchestrating AI question generation, validation, and review."""

    # ---------------------------------------------------------------------------
    # Format Catalogue (server-driven authoring metadata)
    # ---------------------------------------------------------------------------
    @classmethod
    def get_format_catalog(cls) -> TaskFormatCatalogResponse:
        """Return the authoritative catalogue of authorable TEF task formats.

        The registry is the single source of truth for both generation and the
        admin wizard, so the UI can never offer a combination the backend would
        reject.
        """
        payload = catalog_payload()
        return TaskFormatCatalogResponse(
            total_formats=len(payload["formats"]),
            modules=[CatalogOption(**module) for module in payload["modules"]],
            stimulus_kinds=[CatalogOption(**kind) for kind in payload["stimulus_kinds"]],
            formats=[TaskFormatCatalogEntry(**entry) for entry in payload["formats"]],
        )

    # ---------------------------------------------------------------------------
    # Asynchronous Job Lifecycle
    # ---------------------------------------------------------------------------
    @classmethod
    async def create_generation_job(
        cls,
        db: AsyncSession,
        request: AIGenerationJobCreateRequest,
        actor_id: uuid.UUID | None,
    ) -> AIGenerationJob:
        """Persist a queued generation batch and hand it to the worker queue.

        Only non-secret request fields are persisted. The API key override lives
        in the enqueued message at most; it is never written to the database.
        """
        persistable = request.model_dump(
            mode="json",
            exclude={"api_key_override"},
        )
        job = AIGenerationJob(
            status=AIGenerationJobStatus.QUEUED.value,
            task_type_code=request.task_type_code,
            modality=request.modality,
            target_cefr=request.target_cefr,
            requested_count=request.count,
            request_payload=persistable,
            created_by_user_id=actor_id,
        )
        db.add(job)
        await db.flush()
        await db.refresh(job)

        logger.info(
            "ai_generation_job.queued",
            job_id=str(job.id),
            modality=job.modality,
            task_type_code=job.task_type_code,
            requested_count=job.requested_count,
        )
        return job

    @classmethod
    async def get_generation_job(
        cls,
        db: AsyncSession,
        job_id: uuid.UUID,
        actor_id: uuid.UUID | None,
        is_admin: bool = False,
    ) -> AIGenerationJob:
        """Fetch a job, enforcing ownership.

        Admins may read any job; everyone else is restricted to jobs they
        created. Authorization is checked server-side on every poll.
        """
        job = await db.get(AIGenerationJob, job_id)
        if job is None:
            raise AppException(
                message="Job de génération introuvable", code="NOT_FOUND", status_code=404
            )
        if not is_admin and job.created_by_user_id != actor_id:
            # Do not disclose existence of another admin's job.
            raise AppException(
                message="Job de génération introuvable", code="NOT_FOUND", status_code=404
            )
        return job

    @classmethod
    def _serialize_job(cls, job: AIGenerationJob) -> AIGenerationJobResponse:
        """Project a job row into its polling response contract."""
        result: AIBatchGenerationResponse | None = None
        if job.status == AIGenerationJobStatus.SUCCEEDED.value and job.result_payload:
            try:
                result = AIBatchGenerationResponse.model_validate(job.result_payload)
            except ValidationError:
                # Never fail a poll because of stored payload drift; the status
                # and error fields remain meaningful on their own.
                logger.warning(
                    "ai_generation_job.result_payload_unreadable",
                    job_id=str(job.id),
                )
                result = None

        return AIGenerationJobResponse(
            id=job.id,
            status=AIGenerationJobStatus(job.status),
            task_type_code=job.task_type_code,
            modality=job.modality,
            target_cefr=job.target_cefr,
            requested_count=job.requested_count,
            error_message=job.error_message,
            started_at=job.started_at,
            completed_at=job.completed_at,
            created_at=job.created_at,
            updated_at=job.updated_at,
            is_terminal=job.status
            in (AIGenerationJobStatus.SUCCEEDED.value, AIGenerationJobStatus.FAILED.value),
            result=result,
        )

    @classmethod
    async def run_generation_job(
        cls,
        db: AsyncSession,
        job_id: uuid.UUID,
    ) -> AIGenerationJob:
        """Execute a queued batch in a worker and persist the outcome.

        Safe to call more than once: a job already in a terminal state is left
        untouched, so Celery redelivery and manual retries cannot double-run or
        clobber a finished result.
        """
        job = await db.get(AIGenerationJob, job_id, with_for_update=True)
        if job is None:
            raise AppException(
                message="Job de génération introuvable", code="NOT_FOUND", status_code=404
            )

        if job.status in (
            AIGenerationJobStatus.SUCCEEDED.value,
            AIGenerationJobStatus.FAILED.value,
        ):
            logger.info(
                "ai_generation_job.terminal_state_skipped",
                job_id=str(job.id),
                status=job.status,
            )
            return job

        job.status = AIGenerationJobStatus.RUNNING.value
        job.started_at = datetime.datetime.now(datetime.UTC)
        job.error_message = None
        await db.commit()

        try:
            request = AIQuestionGenerationRequest.model_validate(job.request_payload)
            batch = await cls.generate_candidates(
                db=db,
                request=request,
                actor_id=job.created_by_user_id,
            )
        except Exception as exc:
            logger.exception("ai_generation_job.failed", job_id=str(job.id))
            job.status = AIGenerationJobStatus.FAILED.value
            # Persist a safe, actionable message rather than an internal trace.
            job.error_message = (
                f"{type(exc).__name__}: la génération a échoué. "
                "Réessayez ou réduisez le nombre d'éléments demandés."
            )
            job.completed_at = datetime.datetime.now(datetime.UTC)
            await db.commit()
            await db.refresh(job)
            return job

        job.status = AIGenerationJobStatus.SUCCEEDED.value
        job.result_payload = batch.model_dump(mode="json")
        job.completed_at = datetime.datetime.now(datetime.UTC)
        await db.commit()
        await db.refresh(job)

        logger.info(
            "ai_generation_job.succeeded",
            job_id=str(job.id),
            total_generated=batch.total_generated,
            generation_time_ms=batch.generation_time_ms,
        )
        return job

    # ---------------------------------------------------------------------------
    # Main Batch Generation Entrypoint
    # ---------------------------------------------------------------------------
    @classmethod
    async def generate_candidates(
        cls,
        db: AsyncSession,
        request: AIQuestionGenerationRequest,
        actor_id: uuid.UUID | None = None,
    ) -> AIBatchGenerationResponse:
        """Generate one or more question candidate drafts meeting TEF standards."""
        start_time = time.perf_counter()
        logger.info(
            "ai_question_generation.started",
            modality=request.modality,
            target_cefr=request.target_cefr,
            count=request.count,
            topic=request.topic,
        )

        # 1. Resolve TaskType
        task_type = await cls._resolve_task_type(db, request)
        task_type_id = task_type.id if task_type else None
        task_type_code = task_type.code if task_type else request.task_type_code

        # 2. Resolve the registry entry that governs this item family. When the caller
        #    omits the task type, infer a compatible family from the response type so
        #    that legacy callers (response_type only) keep working.
        spec = cls._resolve_spec(
            task_type_code=task_type_code,
            response_type=request.response_type,
            modality=request.modality,
        )
        assert spec is not None  # press_article is always present in the registry
        task_type_code = spec.code
        response_type = spec.coerce_response_type(request.response_type)
        option_count = spec.coerce_option_count(request.option_count)

        # 3. Resolve Valid Taxonomy Skills
        allowed_skills = await cls._resolve_allowed_skills(db, request, task_type)

        # 4. Resolve Stimulus Content if existing or supplied
        stimulus_content, stimulus_title, stimulus_id = await cls._resolve_stimulus_context(db, request)

        # 5. Build System & User Prompts
        template_version = prompt_template_version_for(task_type_code)

        api_key = request.api_key_override or settings.GEMINI_API_KEY
        use_simulation = request.force_simulation or not api_key

        candidates: list[GeneratedQuestionCandidate] = []
        valid_count = 0
        invalid_count = 0

        # Support bundling multiple questions per stimulus
        current_stimulus_content = stimulus_content
        current_stimulus_title = stimulus_title
        current_stimulus_id = stimulus_id
        q_per_stim = max(1, min(getattr(request, "questions_per_stimulus", 1), 4))

        # We generate `request.count` items
        for i in range(request.count):
            try:
                candidate = await cls._generate_single_candidate(
                    db=db,
                    request=request,
                    spec=spec,
                    response_type=response_type,
                    option_count=option_count,
                    task_type_id=task_type_id,
                    task_type_code=task_type_code,
                    allowed_skills=allowed_skills,
                    stimulus_id=current_stimulus_id,
                    stimulus_title=current_stimulus_title,
                    stimulus_content=current_stimulus_content,
                    template_version=template_version,
                    use_simulation=use_simulation,
                    api_key=api_key,
                    candidate_index=i,
                )

                # Reuse stimulus for subsequent items in the bundle
                if (i + 1) % q_per_stim != 0:
                    current_stimulus_content = candidate.stimulus_content or current_stimulus_content
                    current_stimulus_title = candidate.stimulus_title or current_stimulus_title
                    current_stimulus_id = candidate.stimulus_id or current_stimulus_id
                else:
                    # Reset to initial stimulus for the next bundle
                    current_stimulus_content = stimulus_content
                    current_stimulus_title = stimulus_title
                    current_stimulus_id = stimulus_id

                # Automated Duplicate Detection Check
                dup_report = await cls.check_question_duplicates(
                    db=db,
                    prompt=candidate.prompt,
                    stimulus_content=candidate.stimulus_content,
                )
                candidate.duplicate_check = dup_report

                # Automated Validation via QuestionValidationEngine
                val_result = await cls._validate_candidate_item(
                    db=db,
                    candidate=candidate,
                    task_type_id=task_type_id,
                )
                candidate.validation_report = val_result.model_dump(mode="json")

                if val_result.valid and not dup_report.is_duplicate:
                    valid_count += 1
                else:
                    invalid_count += 1

                candidates.append(candidate)

            except Exception as exc:  # noqa: BLE001
                logger.error("ai_question_generation.candidate_failed", index=i, error=str(exc))
                invalid_count += 1
                # Support partial success: continue to other candidates in batch

        total_time_ms = int((time.perf_counter() - start_time) * 1000)
        summary = (
            f"Génération terminée en {total_time_ms} ms : {len(candidates)} générés, "
            f"{valid_count} valides, {invalid_count} avec avertissements ou erreurs."
        )

        logger.info(
            "ai_question_generation.completed",
            total_generated=len(candidates),
            valid=valid_count,
            invalid=invalid_count,
            time_ms=total_time_ms,
        )

        return AIBatchGenerationResponse(
            candidates=candidates,
            total_requested=request.count,
            total_generated=len(candidates),
            valid_candidates_count=valid_count,
            invalid_candidates_count=invalid_count,
            generation_time_ms=total_time_ms,
            summary=summary,
        )

    # ---------------------------------------------------------------------------
    # Specialized Stimulus Generation & Persistence
    # ---------------------------------------------------------------------------
    @classmethod
    async def generate_stimulus(
        cls,
        db: AsyncSession,
        request: AIStimulusGenerationRequest,
        actor_id: uuid.UUID | None = None,
    ) -> AIStimulusCandidate:
        """Generate a specialized, authentic TEF stimulus (multi-doc, table, passage, audio)."""
        start_time = time.perf_counter()
        task_code = request.task_type_code or "press_article"
        spec = get_spec(task_code) or get_spec("press_article")
        assert spec is not None  # press_article is always present in the registry
        task_code = spec.code
        target_cefr = (request.target_cefr or "B2").upper()

        meta = CandidateGenerationMetadata(
            model=request.model,
            prompt_template_version=spec.prompt_template_version,
            is_simulation=request.force_simulation or not bool(settings.GEMINI_API_KEY),
        )

        parsed_data = None
        if not meta.is_simulation:
            sys_prompt = (
                "Tu es un rédacteur expert officiel de supports d'évaluation du TEF (CCI Paris Île-de-France).\n"
                f"Rédige un support documentaire authentique pour l'épreuve de {request.modality} au niveau {target_cefr}.\n"
                f"Format de tâche : {task_code} ({spec.name}).\n"
                f"Type de stimulus requis : {STIMULUS_KIND_LABELS.get(spec.stimulus_kind, spec.stimulus_kind)}.\n"
                f"Directives : {spec.admin_hint} {spec.prompt_guidance}"
            )
            usr_prompt = (
                f"Génère un support documentaire TEF en français standard au format JSON strict avec les clés :\n"
                f"- title: Titre réaliste du document\n"
                f"- content_text: Texte intégral bien formaté en Markdown avec retours à la ligne (pour multi_document, sépare impérativement avec '### Document A : [Titre]\\n[Contenu]\\n\\n### Document B : [Titre]...'). Pour les tableaux, utilise la syntaxe Markdown standard avec des entêtes.\n"
                f"- text_format: 'markdown' ou 'plain' ou 'table' ou 'dialogue'\n"
                f"- word_count: Nombre approximatif de mots\n"
                f"- source_attribution: Source réaliste (journal, service public, entreprise)\n"
                f"- sub_documents: Liste de dictionnaires avec clés 'label', 'title', 'content' si multi-documents\n"
                f"Thème souhaité : {request.topic or 'Société contemporaine, vie citoyenne, innovation, écologie'}"
            )
            try:
                raw_text, prompt_tok, comp_tok = await AISandboxService._call_gemini_api(
                    api_key=request.api_key_override or settings.GEMINI_API_KEY or "",
                    model=request.model,
                    system_prompt=sys_prompt,
                    user_prompt=usr_prompt,
                    temperature=request.temperature,
                    max_tokens=2200,
                )
                parsed_data = AISandboxService._parse_json_or_fallback(raw_text)
                meta.prompt_tokens = prompt_tok
                meta.completion_tokens = comp_tok
                meta.total_tokens = prompt_tok + comp_tok
            except Exception as exc:  # noqa: BLE001
                logger.warning("Stimulus generation via LLM failed, using template simulation", error=str(exc))
                meta.is_simulation = True

        if not parsed_data or meta.is_simulation:
            parsed_data = cls._simulate_stimulus_generation(task_code, target_cefr, request.topic)

        # Parse sub_documents if multi_document
        sub_docs = parsed_data.get("sub_documents", [])
        content_text = parsed_data.get("content_text", "")
        if not sub_docs and "### Document" in content_text:
            parts = re.split(r"###\s+(Document\s+[A-D])\s*:\s*", content_text)
            if len(parts) >= 3:
                for idx in range(1, len(parts), 2):
                    label = parts[idx].strip()
                    doc_content = parts[idx + 1].strip() if idx + 1 < len(parts) else ""
                    sub_docs.append({
                        "label": label,
                        "title": label,
                        "content": doc_content,
                    })

        text_fmt = parsed_data.get("text_format", "markdown")
        if spec.stimulus_kind == STIMULUS_TABLE:
            text_fmt = "table"
        elif request.modality == "listening":
            text_fmt = "dialogue"

        meta.latency_ms = int((time.perf_counter() - start_time) * 1000)

        candidate = AIStimulusCandidate(
            id=uuid.uuid4(),
            title=parsed_data.get("title", f"Support {spec.name}"),
            content_text=content_text,
            text_format=text_fmt,
            modality=request.modality,
            target_cefr=target_cefr,
            word_count=parsed_data.get("word_count") or len(content_text.split()),
            source_attribution=parsed_data.get("source_attribution"),
            task_type_code=task_code,
            sub_documents=sub_docs,
            generation_metadata=meta,
        )
        return candidate

    @classmethod
    async def persist_stimulus(
        cls,
        db: AsyncSession,
        candidate: AIStimulusCandidate,
        actor_id: uuid.UUID | None = None,
    ) -> Stimulus:
        """Persist an accepted AI-generated stimulus candidate into the database."""
        import hashlib
        c_hash = hashlib.sha256(
            f"{candidate.title}:{candidate.modality}:{candidate.content_text}".encode()
        ).hexdigest()
        stim = Stimulus(
            id=candidate.id or uuid.uuid4(),
            title=candidate.title,
            modality=candidate.modality,
            content_text=candidate.content_text,
            text_format=candidate.text_format,
            word_count=candidate.word_count,
            source_citation=candidate.source_attribution,
            content_hash=c_hash,
        )
        db.add(stim)
        await db.flush()
        return stim

    @classmethod
    def _simulate_stimulus_generation(
        cls,
        task_code: str,
        target_cefr: str,
        topic: str | None,
    ) -> dict[str, Any]:
        """Produce high-authenticity simulation stimuli for all TEF task types."""
        if task_code == "document_matching":
            return {
                "title": "Offres de formation et d'ateliers professionnels",
                "content_text": (
                    "### Document A : Atelier d'artisanat du bois\n"
                    "Initiation aux techniques traditionnelles d'ébénisterie tous les samedis matin de 9h à 12h. "
                    "Matériel fourni sur place, inscription trimestrielle.\n\n"
                    "### Document B : Séminaire de communication numérique\n"
                    "Formation intensive en marketing digital et gestion des réseaux sociaux le vendredi soir de 18h30 à 21h30. "
                    "Idéal pour indépendants et personnes en reconversion professionnelle.\n\n"
                    "### Document C : Stage de cuisine du terroir\n"
                    "Cours pratiques de gastronomie régionale et dégustation de produits bio en semaine (mardi et jeudi de 14h à 17h). "
                    "Tabliers et fiches recettes inclus.\n\n"
                    "### Document D : Programme de perfectionnement comptable\n"
                    "Actualisation des normes fiscales pour entrepreneurs et indépendants chaque mardi matin en visioconférence "
                    "avec support pédagogique interactif."
                ),
                "text_format": "multi_doc",
                "source_attribution": "Guide des Ateliers Métropolitains",
                "sub_documents": [
                    {"label": "Document A", "title": "Atelier d'artisanat du bois", "content": "Initiation ébénisterie samedi matin."},
                    {"label": "Document B", "title": "Séminaire de communication numérique", "content": "Marketing digital vendredi soir."},
                    {"label": "Document C", "title": "Stage de cuisine du terroir", "content": "Gastronomie régionale mardi/jeudi."},
                    {"label": "Document D", "title": "Programme de perfectionnement comptable", "content": "Fiscalité mardi matin en visio."},
                ],
            }
        elif task_code == "graph_matching":
            return {
                "title": "Enquête mobilité urbaine : Répartition des modes de transport (2020-2025)",
                "content_text": (
                    "| Année | Transports en commun (%) | Vélo personnel (%) | Voiture individuelle (%) | Marche à pied (%) |\n"
                    "| :--- | :---: | :---: | :---: | :---: |\n"
                    "| 2020 | 45% | 8% | 32% | 15% |\n"
                    "| 2022 | 48% | 12% | 26% | 14% |\n"
                    "| 2024 | 52% | 18% | 17% | 13% |\n"
                    "| 2025 | 54% | 21% | 13% | 12% |"
                ),
                "text_format": "table",
                "source_attribution": "Observatoire des Déplacements Urbains",
            }
        elif task_code == "sentence_gap":
            return {
                "title": "Complétion de phrase",
                "content_text": "",
                "text_format": "plain",
                "source_attribution": None,
            }
        elif task_code == "text_gap":
            return {
                "title": "L'essor du télétravail dans les petites communes",
                "content_text": (
                    "Autrefois réservé aux grands centres urbains, le travail à distance séduit désormais les zones rurales. "
                    "Plusieurs villages ont ainsi créé des tiers-lieux connectés pour accueillir les télétravailleurs. "
                    "______ cette transformation dynamise le commerce de proximité, elle soulève aussi la question des infrastructures numériques "
                    "qui demeurent parfois insuffisantes."
                ),
                "text_format": "markdown",
                "source_attribution": "Courrier des Régions",
            }
        elif task_code == "administrative_document":
            return {
                "title": "Conditions d'attribution de l'aide municipale à la rénovation thermique",
                "content_text": (
                    "Article 4 : Éligibilité des demandeurs.\n"
                    "Peuvent prétendre à la subvention municipale pour la transition énergétique les propriétaires occupants "
                    "dont le revenu fiscal de référence ne dépasse pas le barème départemental catégorie B. "
                    "Le dossier complet doit impérativement comporter l'audit énergétique préalable ainsi que les devis établis par un professionnel labellisé RGE."
                ),
                "text_format": "markdown",
                "source_attribution": "Bulletin Municipal Officiel",
            }
        elif task_code == "professional_document":
            return {
                "title": "Note interne : Modalités d'organisation du travail hybride",
                "content_text": (
                    "Direction des Ressources Humaines\n"
                    "À l'attention de l'ensemble des collaborateurs du pôle innovation.\n"
                    "Objet : Protocole de flexibilité hebdomadaire.\n"
                    "À compter du prochain trimestre, les membres de l'équipe ont la possibilité de fixer jusqu'à deux jours "
                    "de télétravail par semaine, sous réserve d'un accord préalable avec leur responsable hiérarchique et de la présence "
                    "obligatoire aux réunions plénières du jeudi matin."
                ),
                "text_format": "markdown",
                "source_attribution": "Direction RH Groupe Synergie",
            }
        elif task_code == "short_announcement":
            return {
                "title": "Message automatique : Cabinet Médical Voltaire",
                "content_text": (
                    "[Bip sonore - Enregistrement automatique]\n"
                    "'Vous êtes bien au cabinet médical Voltaire. Nos praticiens consultent uniquement sur rendez-vous du lundi au vendredi. "
                    "En cas d'urgence vitale, composez immédiatement le 15. Pour toute demande de renouvellement d'ordonnance, "
                    "veuillez adresser un message électronique via notre portail sécurisé. Merci de votre appel.'"
                ),
                "text_format": "dialogue",
                "source_attribution": "Cabinet Médical Voltaire",
            }
        elif task_code == "radio_broadcast":
            return {
                "title": "Chronique environnement : L'agroécologie périurbaine",
                "content_text": (
                    "[Générique sonore France Écoute]\n"
                    "Journaliste : 'Ce matin, nous partons à la découverte d'une ceinture maraîchère bio implantée à vingt kilomètres de Nantes. "
                    "Rencontre avec Thomas Guérin, agronome qui repense les circuits d'approvisionnement courts.'\n"
                    "Thomas : 'L'idée n'est pas de produire des quantités industrielles, mais de nourrir durablement 5000 familles avec des variétés anciennes "
                    "parfaitement adaptées aux épisodes de sécheresse.'"
                ),
                "text_format": "dialogue",
                "source_attribution": "France Écoute - Chronique Planète",
            }
        elif task_code == "public_survey":
            return {
                "title": "Sondage radiophonique : La piétonnisation intégrale du centre-ville",
                "content_text": (
                    "[Micro-trottoir diffusé sur Radio Ville]\n\n"
                    "Locuteur 1 (Antoine, commerçant) : 'Pour mon magasin, c'est très bénéfique, les piétons s'arrêtent et découvrent ma vitrine avec plaisir.'\n\n"
                    "Locuteur 2 (Valérie, automobiliste) : 'Je suis totalement contre. Les détours pour traverser la commune allongent mon trajet quotidien de 25 minutes.'\n\n"
                    "Locuteur 3 (Camille, cycliste) : 'L'atmosphère est devenue nettement plus saine et les déplacements avec de jeunes enfants sont enfin sécurisés.'\n\n"
                    "Locuteur 4 (Nathalie, riveraine) : 'Tant que les bornes d'accès permettent aux riverains de décharger leurs courses le soir, cela me convient tout à fait.'"
                ),
                "text_format": "dialogue",
                "source_attribution": "Radio Ville - Journal de midi",
            }
        elif task_code == "phonological_recognition":
            return {
                "title": "Énoncé oral court : Intonation et mélodie",
                "content_text": (
                    "[Audio court - 1 locuteur, intonation interrogative montante marquée]\n"
                    "'Vous avez déjà validé votre inscription pour le trimestre prochain ?'"
                ),
                "text_format": "dialogue",
                "source_attribution": "Laboratoire de phonétique appliquée",
            }
        elif task_code == "fait_divers":
            return {
                "title": "Fait divers : Insolite disparition au musée",
                "content_text": (
                    "Dans la nuit de mardi à mercredi, un automate horloger datant du XVIIIe siècle s'est mystérieusement volatilisé "
                    "du musée des Beaux-Arts, sans qu'aucune des alarmes ne se soit déclenchée ni qu'aucune issue n'ait été fracturée."
                ),
                "text_format": "markdown",
                "source_attribution": "L'Écho Régional",
            }
        elif task_code == "opinion_letter":
            return {
                "title": "Débat public : La régulation des trottinettes électriques en libre-service",
                "content_text": (
                    "Face à la prolifération des engins de déplacement motorisés abandonnés sur les trottoirs, "
                    "la municipalité organise une consultation citoyenne pour décider du maintien ou du retrait total des opérateurs de location."
                ),
                "text_format": "markdown",
                "source_attribution": "Tribune Citoyenne",
            }
        elif task_code == "information_gathering":
            return {
                "title": "Petite annonce : Stage d'initiation au kayak en rivière",
                "content_text": (
                    "Club Nautique des Berges : stage découverte pendant les vacances de Pâques. "
                    "Groupes de 8 participants maximum, encadrement par un moniteur diplômé d'État. "
                    "Matériel de sécurité intégralement fourni. Tarifs préférentiels pour étudiants et demandeurs d'emploi. "
                    "Renseignements et réservations au 05 61 22 33 44."
                ),
                "text_format": "markdown",
                "source_attribution": "Gazette Municipale",
            }
        elif task_code == "persuasive_argumentation":
            return {
                "title": "Brochure : Vacances éco-volontariat en refuge de montagne",
                "content_text": (
                    "Passez une semaine immersive dans les Pyrénées : aide au balisage des sentiers, participation aux inventaires de la flore "
                    "alpine et observation nocturne des constellations en refuge isolé à 2200 mètres d'altitude. "
                    "Une expérience humaine inoubliable, conviviale et accessible à tous les marcheurs motivés."
                ),
                "text_format": "markdown",
                "source_attribution": "Parc National des Pyrénées",
            }
        else:
            return {
                "title": "La transition énergétique face au défi de la sobriété",
                "content_text": (
                    "Si le déploiement des énergies renouvelables constitue un pilier indiscutable de la transition écologique, "
                    "plusieurs experts soulignent qu'il ne saurait suffire sans une réduction drastique de notre consommation globale. "
                    "La sobriété énergétique implique une transformation profonde de nos modes de vie, notamment en matière de mobilité et d'isolation des logements, "
                    "plutôt qu'un simple remplacement technologique de nos sources d'approvisionnement."
                ),
                "text_format": "markdown",
                "source_attribution": "Revue des Études Écologiques",
            }

    # ---------------------------------------------------------------------------
    # Single Candidate Generator
    # ---------------------------------------------------------------------------
    @classmethod
    async def _generate_single_candidate(
        cls,
        db: AsyncSession,
        request: AIQuestionGenerationRequest,
        spec: TaskFormatSpec,
        response_type: str,
        option_count: int | None,
        task_type_id: uuid.UUID | None,
        task_type_code: str,
        allowed_skills: list[Skill],
        stimulus_id: uuid.UUID | None,
        stimulus_title: str | None,
        stimulus_content: str | None,
        template_version: str,
        use_simulation: bool,
        api_key: str | None,
        candidate_index: int,
    ) -> GeneratedQuestionCandidate:
        """Call LLM or realistic simulation to construct a single question candidate."""
        sub_start = time.perf_counter()

        system_prompt, user_prompt = cls._build_generation_prompts(
            request=request,
            spec=spec,
            response_type=response_type,
            option_count=option_count,
            allowed_skills=allowed_skills,
            stimulus_title=stimulus_title,
            stimulus_content=stimulus_content,
            candidate_index=candidate_index,
        )

        prompt_tokens = len(user_prompt.split()) + len(system_prompt.split())
        completion_tokens = 0
        raw_text = ""
        is_sim = use_simulation

        if not use_simulation and api_key:
            try:
                raw_text, prompt_tokens, completion_tokens = await AISandboxService._call_gemini_api(
                    api_key=api_key,
                    model=request.model,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=request.temperature,
                    max_tokens=2500,
                )
                parsed_data = AISandboxService._parse_json_or_fallback(raw_text)
                if not cls._is_parse_usable(parsed_data, response_type):
                    logger.warning(
                        "LLM returned unusable JSON for response_type, falling back to simulation",
                        response_type=response_type,
                        raw_preview=raw_text[:200] if raw_text else None,
                    )
                    parsed_data = cls._simulate_question_generation(
                        request=request,
                        spec=spec,
                        response_type=response_type,
                        option_count=option_count,
                        allowed_skills=allowed_skills,
                        stimulus_title=stimulus_title,
                        stimulus_content=stimulus_content,
                        candidate_index=candidate_index,
                    )
                    is_sim = True
                    completion_tokens = 380
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Gemini API generation failed, falling back to realistic simulation",
                    error=str(exc),
                )
                parsed_data = cls._simulate_question_generation(
                    request=request,
                    spec=spec,
                    response_type=response_type,
                    option_count=option_count,
                    allowed_skills=allowed_skills,
                    stimulus_title=stimulus_title,
                    stimulus_content=stimulus_content,
                    candidate_index=candidate_index,
                )
                is_sim = True
                completion_tokens = 380
        else:
            parsed_data = cls._simulate_question_generation(
                request=request,
                spec=spec,
                response_type=response_type,
                option_count=option_count,
                allowed_skills=allowed_skills,
                stimulus_title=stimulus_title,
                stimulus_content=stimulus_content,
                candidate_index=candidate_index,
            )
            completion_tokens = 380

        latency_ms = int((time.perf_counter() - sub_start) * 1000)
        total_tokens = prompt_tokens + completion_tokens
        cost_usd = _estimate_cost_usd(request.model, prompt_tokens, completion_tokens)

        # Build candidate object
        meta = CandidateGenerationMetadata(
            model=request.model,
            prompt_template_version=template_version,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=round(cost_usd, 6),
            latency_ms=latency_ms,
            is_simulation=is_sim,
        )

        # Enforce Difficulty Calibration
        cefr = str(parsed_data.get("target_cefr", request.target_cefr)).upper()
        if cefr not in CEFR_MIDPOINTS:
            cefr = request.target_cefr.upper()

        diff_rating = request.difficulty_rating or CEFR_MIDPOINTS.get(cefr, 450)
        item_diff = CEFR_ITEM_DIFFICULTY.get(cefr, 3)

        # Map options
        options_data: list[CandidateOptionPayload] = []
        for idx, opt in enumerate(parsed_data.get("options", []) or []):
            if isinstance(opt, dict):
                options_data.append(
                    CandidateOptionPayload(
                        content=str(opt.get("content", "")).strip(),
                        is_correct=bool(opt.get("is_correct", False)),
                        order_index=idx,
                        explanation=opt.get("explanation"),
                        misconception_type=opt.get("misconception_type"),
                        distractor_rationale=opt.get("distractor_rationale"),
                    )
                )

        # Map skills strictly to allowed taxonomy skills
        skill_mappings = cls._bind_skill_mappings(
            allowed_skills=allowed_skills,
            parsed_skill_ids=parsed_data.get("skill_mappings", []),
            target_skill_ids=request.target_skill_ids,
        )

        uses_stimulus = (
            spec.requires_stimulus
            and spec.stimulus_kind != STIMULUS_PROMPT_LEAD
            and request.stimulus_mode != STIMULUS_NONE
        )
        candidate = GeneratedQuestionCandidate(
            candidate_id=str(uuid.uuid4()),
            modality=request.modality,
            prompt=str(parsed_data.get("prompt", "")).strip(),
            instructions=parsed_data.get("instructions"),
            response_type=response_type,
            target_cefr=cefr,
            difficulty_rating=diff_rating,
            item_difficulty=item_diff,
            cognitive_complexity=parsed_data.get(
                "cognitive_complexity", request.cognitive_complexity
            ),
            points=1,
            penalty_points=0,
            task_type_id=task_type_id,
            task_type_code=task_type_code,
            format_spec_version=spec.prompt_template_version,
            option_count=option_count,
            stimulus_id=stimulus_id if uses_stimulus else None,
            stimulus_title=(
                (parsed_data.get("stimulus_title") or stimulus_title)
                if uses_stimulus
                else None
            ),
            stimulus_content=(
                (parsed_data.get("stimulus_content") or stimulus_content)
                if uses_stimulus
                else None
            ),
            stimulus_mode=request.stimulus_mode if uses_stimulus else STIMULUS_NONE,
            source_attribution=(
                (parsed_data.get("source_attribution") or request.source_attribution)
                if uses_stimulus
                else None
            ),
            options=options_data,
            skill_mappings=skill_mappings,
            scoring_payload=cls._extract_scoring_payload(parsed_data, response_type),
            explanation=parsed_data.get("explanation"),
            generation_metadata=meta,
            status="pending_review",
        )

        return candidate

    # ---------------------------------------------------------------------------
    # Prompt Construction
    # ---------------------------------------------------------------------------
    # ---------------------------------------------------------------------------
    # Format-Aware Parsing Helpers
    # ---------------------------------------------------------------------------
    @classmethod
    def _resolve_spec(
        cls,
        task_type_code: str | None,
        response_type: str | None,
        modality: str,
    ) -> TaskFormatSpec:
        """Pick the registry entry for a request, inferring it when only a response type is given."""
        if task_type_code:
            spec = get_spec(task_type_code)
            if spec is not None:
                return spec

        requested = response_type

        # Legacy callers sometimes pass a task code in the response_type slot
        # (e.g. "text_gap" instead of "gap_fill").
        if requested and requested in QUESTION_FORMAT_SPECS:
            return QUESTION_FORMAT_SPECS[requested]

        for candidate in QUESTION_FORMAT_SPECS.values():
            if candidate.module == modality and candidate.accepts(requested):
                return candidate

        fallback = QUESTION_FORMAT_SPECS.get("press_article")
        assert fallback is not None
        return fallback

    @classmethod
    def _is_parse_usable(cls, parsed_data: Any, response_type: str) -> bool:
        """Reject LLM output that cannot satisfy the requested response format."""
        if not isinstance(parsed_data, dict) or not str(parsed_data.get("prompt", "")).strip():
            return False

        if response_type in (
            QuestionResponseType.SINGLE_CHOICE.value,
            QuestionResponseType.MULTIPLE_CHOICE.value,
        ):
            options = parsed_data.get("options")
            if not isinstance(options, list) or len(options) < 2:
                return False
            return any(isinstance(o, dict) and o.get("is_correct") for o in options)

        if response_type in (
            QuestionResponseType.MATCHING.value,
            QuestionResponseType.ORDERING.value,
            QuestionResponseType.GAP_FILL.value,
            QuestionResponseType.SHORT_TEXT.value,
        ):
            return cls._extract_scoring_payload(parsed_data, response_type) is not None

        return True

    @staticmethod
    def _extract_scoring_payload(parsed_data: dict[str, Any], response_type: str) -> dict[str, Any] | None:
        """Normalise the LLM scoring payload into the canonical keys the scorers expect."""
        raw = parsed_data.get("scoring_payload")
        if not isinstance(raw, dict):
            return None

        if response_type == QuestionResponseType.MATCHING.value:
            pairs = raw.get("pairs")
            if not pairs:
                pairs = raw.get("matching_pairs")
            if not pairs:
                return None
            normalised: list[dict[str, str]] = []
            if isinstance(pairs, dict):
                normalised = [
                    {"source_id": str(k), "target_id": str(v)} for k, v in pairs.items()
                ]
            elif isinstance(pairs, list):
                for item in pairs:
                    if isinstance(item, dict):
                        src = item.get("source_id") or item.get("left") or item.get("key")
                        tgt = item.get("target_id") or item.get("right") or item.get("value")
                        if src is not None and tgt is not None:
                            normalised.append({"source_id": str(src), "target_id": str(tgt)})
                    elif isinstance(item, (list, tuple)) and len(item) == 2:
                        normalised.append({"source_id": str(item[0]), "target_id": str(item[1])})
            if not normalised:
                return None
            payload = {k: v for k, v in raw.items() if k not in {"pairs", "matching_pairs"}}
            payload["pairs"] = normalised
            for key in ("sources", "targets"):
                if isinstance(raw.get(key), list):
                    payload[key] = raw[key]
            return payload

        if response_type == QuestionResponseType.ORDERING.value:
            sequence = raw.get("sequence") or raw.get("correct_sequence")
            if not sequence:
                items = raw.get("items")
                if isinstance(items, list) and items:
                    def _position(entry: Any) -> int:
                        if not isinstance(entry, dict):
                            return 0
                        return int(entry.get("correct_position", entry.get("position", 0)) or 0)

                    items_sorted = sorted(items, key=_position)
                    sequence = [
                        str(it.get("id") or it.get("key"))
                        for it in items_sorted
                        if isinstance(it, dict) and (it.get("id") or it.get("key"))
                    ]
            if not sequence:
                return None
            payload = {k: v for k, v in raw.items() if k != "correct_sequence"}
            payload["sequence"] = [str(x) for x in sequence]
            payload.setdefault("partial_credit", True)
            if isinstance(raw.get("items"), list):
                payload["items"] = raw["items"]
            return payload

        if response_type == QuestionResponseType.GAP_FILL.value:
            gaps = raw.get("gaps")
            if isinstance(gaps, dict):
                gaps = [gaps]
            if not isinstance(gaps, list) or not gaps:
                return None
            normalised_gaps: list[dict[str, Any]] = []
            for i, gap in enumerate(gaps, start=1):
                if not isinstance(gap, dict):
                    continue
                accepted = (
                    gap.get("accepted_answers")
                    or gap.get("correct_answer")
                    or gap.get("acceptable_alternatives")
                )
                if isinstance(accepted, str):
                    accepted = [accepted]
                if not accepted:
                    continue
                normalised_gaps.append(
                    {
                        "index": gap.get("index", i),
                        "accepted_answers": [str(a) for a in accepted],
                        "ignore_case": bool(gap.get("ignore_case", True)),
                        "ignore_accents": bool(gap.get("ignore_accents", True)),
                    }
                )
            if not normalised_gaps:
                return None
            return {"gaps": normalised_gaps}

        if response_type == QuestionResponseType.SHORT_TEXT.value:
            accepted = raw.get("accepted_answers")
            if isinstance(accepted, str):
                accepted = [accepted]
            if not isinstance(accepted, list) or not accepted:
                return None
            return {
                "accepted_answers": [str(a) for a in accepted],
                "ignore_case": bool(raw.get("ignore_case", True)),
                "ignore_accents": bool(raw.get("ignore_accents", True)),
            }

        return raw

    @classmethod
    def _build_generation_prompts(
        cls,
        request: AIQuestionGenerationRequest,
        spec: TaskFormatSpec,
        response_type: str,
        option_count: int | None,
        allowed_skills: list[Skill],
        stimulus_title: str | None,
        stimulus_content: str | None,
        candidate_index: int,
    ) -> tuple[str, str]:
        """Construct high-integrity system and user prompts from the task-format registry."""
        is_choice = response_type in (
            QuestionResponseType.SINGLE_CHOICE.value,
            QuestionResponseType.MULTIPLE_CHOICE.value,
        )

        quality_rules = [
            "1. Authenticité linguistique : Rédige en français standard contemporain, naturel et idiomatique.",
            (
                "2. Calibrage CECRL rigoureux : Respecte scrupuleusement la complexité syntaxique "
                f"et le registre lexical du niveau visé ({request.target_cefr})."
            ),
        ]
        if is_choice:
            quality_rules.append(
                "3. Règle absolue des distracteurs : Les fausses réponses doivent être parfaitement plausibles, "
                "reposer sur des pièges cognitifs typiques (sur-généralisation, mauvaise interprétation d'un "
                "connecteur, extrapolation), mais formellement réfutables par le support."
            )
            quality_rules.append(
                "4. Interdictions formelles : NE JAMAIS inclure d'options du type 'Toutes les réponses "
                "ci-dessus', 'Aucune des réponses ci-dessus', 'A et B sont vraies'. Toutes les options doivent "
                "avoir une longueur similaire."
            )
            if response_type == QuestionResponseType.SINGLE_CHOICE.value:
                quality_rules.append(
                    "5. Clé de réponse unique : Exactement une seule option doit être indiscutablement correcte."
                )
            else:
                quality_rules.append(
                    "5. Sélection multiple : Au moins deux options doivent être correctes et au moins une "
                    "incorrecte ; chaque option correcte doit être justifiée séparément."
                )
        else:
            quality_rules.append(
                "3. Structure imposée : Respecte à la lettre le schéma JSON du format demandé. "
                "N'ajoute jamais d'options si le format n'en utilise pas."
            )
            quality_rules.append(
                "4. Fidélité au barème : Le barème (scoring_payload) doit correspondre exactement aux éléments "
                "présents dans l'énoncé, et inversement."
            )
        quality_rules.append(
            "5. Respect strict de la taxonomie : Tu NE DOIS associer QUE des compétences explicitement "
            "fournies dans la liste autorisée."
        )

        system_prompt = (
            "Tu es un concepteur expert officiel d'épreuves du TEF (Test d'Évaluation de Français) "
            "pour la Chambre de Commerce et d'Industrie de Paris (CCI Paris Île-de-France).\n\n"
            "DIRECTIVES PSYCHOMÉTRIQUES ET QUALITÉ DU TEF :\n" + "\n".join(quality_rules)
        )

        skills_json = [
            {
                "skill_id": str(s.id),
                "code": s.code,
                "name": s.name,
                "dimension": getattr(s.dimension, "value", str(s.dimension)) if s.dimension else "reasoning",
            }
            for s in allowed_skills
        ]

        stimulus_instructions = cls._build_stimulus_instructions(
            spec=spec,
            stimulus_title=stimulus_title,
            stimulus_content=stimulus_content,
        )

        user_prompt = (
            f"Génère une question d'évaluation TEF au format JSON strict avec les paramètres suivants :\n"
            f"- Modalité : {request.modality}\n"
            f"- Type de tâche : {spec.code} ({spec.name})\n"
            f"- Consigne spécifique au type de tâche : {spec.admin_hint}\n"
            f"- Format de réponse : {response_type}\n"
            f"- Niveau CECRL visé : {request.target_cefr}\n"
            f"- Complexité cognitive : {request.cognitive_complexity}\n"
            f"- Thématique : {request.topic or 'Société contemporaine, innovation ou vie professionnelle'}\n"
            f"- Échantillon n° : {candidate_index + 1}\n\n"
            f"{stimulus_instructions}\n\n"
            f"{spec.prompt_guidance}\n\n"
            f"Compétences disponibles (choisis-en 1 ou 2 au maximum parmi cette liste uniquement) :\n"
            f"{json.dumps(skills_json, ensure_ascii=False, indent=2)}\n\n"
            f"{cls._build_response_schema_block(spec, response_type, option_count, request.target_cefr, request.cognitive_complexity)}"
        )

        return system_prompt, user_prompt

    @classmethod
    def _build_stimulus_instructions(
        cls,
        spec: TaskFormatSpec,
        stimulus_title: str | None,
        stimulus_content: str | None,
    ) -> str:
        """Derive stimulus instructions from the registry's stimulus kind."""
        if spec.stimulus_kind == STIMULUS_NONE or not spec.requires_stimulus:
            return (
                "RÈGLE STIMULUS : NE GÉNÈRE AUCUN STIMULUS. Les champs 'stimulus_title' et "
                "'stimulus_content' doivent impérativement valoir null. Toute l'information nécessaire "
                f"doit figurer dans le champ 'prompt'. Type de tâche : {spec.name}."
            )

        if stimulus_content and str(stimulus_content).strip():
            return (
                f"Utilise le support textuel fourni ci-dessous :\n"
                f"Titre : {stimulus_title or 'Document'}\n"
                f"Texte :\n{stimulus_content}\n"
            )

        kind = spec.stimulus_kind
        if kind == STIMULUS_MULTI_DOCUMENT:
            return (
                "RÈGLE DOCUMENT MATCHING : Génère un ensemble multi-documents composé de 4 courts documents "
                "distincts libellés '### Document A : [Titre]\\n[Texte]', '### Document B : ...', "
                "'### Document C : ...', '### Document D : ...'. Chaque document décrit une offre, un "
                "stage, un service ou une annonce (30 à 60 mots chacun). La question décrit le profil ou le "
                "besoin précis d'une personne. Le 'scoring_payload' doit contenir 'sources' (les besoins), "
                "'targets' (les documents) et 'pairs' (la correspondance correcte)."
            )
        if kind == STIMULUS_TABLE:
            return (
                "RÈGLE GRAPH / TABLE MATCHING : Génère un support constitué d'un tableau synthétique au format "
                "Markdown (entêtes de colonnes claires, valeurs chiffrées précises). La question doit évaluer "
                "l'analyse ou la comparaison exacte des chiffres. Le 'scoring_payload' doit contenir 'sources', "
                "'targets' et 'pairs'."
            )
        if kind == STIMULUS_AUDIO_TRANSCRIPT:
            return (
                "RÈGLE COMPRÉHENSION ORALE (LISTENING) : Le champ 'stimulus_content' doit contenir la "
                "transcription textuelle de l'enregistrement sonore avec indications contextuelles et "
                "locuteurs distincts (ex: '[Annonce sonore en gare]...', ou 'Locuteur 1 : ... Locuteur 2 : ...')."
            )
        if kind == STIMULUS_PROMPT_LEAD:
            return (
                "RÈGLE AMORCE D'ÉNONCÉ : Le champ 'prompt' doit commencer par l'amorce de la consigne fournie "
                "ci-dessus, puis la reformerule à la première personne pour le candidat. Les champs "
                "'stimulus_title' et 'stimulus_content' doivent valoir null. NE PRODUIS AUCUNE liste de réponses."
            )
        if kind == STIMULUS_BROCHURE:
            return (
                "RÈGLE BROCHURE : Génère le contenu de la brochure / fiche d'information qui sert de support "
                "de présentation. Décris les objectifs, le format de l'échange et les critères d'évaluation "
                "que le candidat doit respecter. Le champ 'prompt' contient la consigne orale."
            )
        return (
            f"Génère un support textuel ({spec.name}) réaliste adapté au format du TEF d'environ 120 à 250 "
            f"mots, avec un titre évocateur et une attribution de source crédible."
        )

    @classmethod
    def _build_response_schema_block(
        cls,
        spec: TaskFormatSpec,
        response_type: str,
        option_count: int | None,
        target_cefr: str,
        cognitive_complexity: str,
    ) -> str:
        """Emit a format-specific JSON contract the model must honour exactly."""
        common = (
            '  "stimulus_title": "Titre du document (null si sans support)",\n'
            '  "stimulus_content": "Texte intégral du document source (null si sans support)",\n'
            '  "source_attribution": "Source fictive ou réelle (ex: Le Quotidien Économique)",\n'
            '  "prompt": "Énoncé complet posé au candidat, consigne incluse",\n'
            '  "instructions": "Consigne spécifique éventuelle, ou null",\n'
            f'  "target_cefr": "{target_cefr}",\n'
            f'  "cognitive_complexity": "{cognitive_complexity}",\n'
        )

        header = (
            "SCHEMA JSON ATTENDU (réponds UNIQUEMENT avec ce JSON valide, sans texte additionnel "
            "ni bloc markdown) :\n"
            "{\n"
        )
        tail = (
            '  "explanation": "Explication pédagogique démontrant la bonne réponse et le rejet des autres.",\n'
            '  "skill_mappings": [{"skill_id": "<id de la liste fournie>", "role": "primary", "weight": 1.0}]\n'
            "}"
        )

        if response_type in (
            QuestionResponseType.SINGLE_CHOICE.value,
            QuestionResponseType.MULTIPLE_CHOICE.value,
        ):
            n = option_count or (spec.option_count[1] if spec.option_count else 4)
            options_block = (
                '  "options": [\n'
                + ",\n".join(
                    '    {{"content": "Option {idx}", "is_correct": {correct}, '
                    '"explanation": "Justification...", "misconception_type": null, '
                    '"distractor_rationale": null}}'.format(
                        idx=i + 1, correct="true" if i == 0 else "false"
                    )
                    for i in range(n)
                )
                + "\n  ],\n"
            )
            return header + common + options_block + tail

        if response_type == QuestionResponseType.MATCHING.value:
            return (
                header
                + common
                + '  "options": [],\n'
                + '  "scoring_payload": {\n'
                + '    "sources": [{"id": "besoin_1", "text": "Besoin décrit"},'
                + ' {"id": "besoin_2", "text": "Autre besoin"}],\n'
                + '    "targets": [{"id": "doc_a", "text": "Document A"},'
                + ' {"id": "doc_b", "text": "Document B"}],\n'
                + '    "pairs": [{"source_id": "besoin_1", "target_id": "doc_a"},'
                + ' {"source_id": "besoin_2", "target_id": "doc_b"}]\n'
                + "  }\n"
                + tail
            )

        if response_type == QuestionResponseType.ORDERING.value:
            n = option_count or (spec.option_count[1] if spec.option_count else 5)
            items = ", ".join(
                '{{"id": "seg_{n}", "text": "Segment {n} du recit"}}'.format(n=i + 1)
                for i in range(n)
            )
            seq = ", ".join(f'"seg_{i + 1}"' for i in range(n))
            return (
                header
                + common
                + '  "options": [],\n'
                + '  "scoring_payload": {\n'
                + f'    "items": [{items}],\n'
                + f'    "sequence": [{seq}],\n'
                + '    "partial_credit": true\n'
                + "  }\n"
                + tail
            )

        if response_type == QuestionResponseType.GAP_FILL.value:
            return (
                header
                + common
                + '  "options": [],\n'
                + '  "scoring_payload": {\n'
                + '    "gaps": [{"index": 1, "accepted_answers": ["cependant", "toutefois"],'
                ' "ignore_case": true, "ignore_accents": true}]\n'
                + "  }\n"
                + tail
            )

        if response_type == QuestionResponseType.SHORT_TEXT.value:
            return (
                header
                + common
                + '  "options": [],\n'
                + '  "scoring_payload": {\n'
                + '    "accepted_answers": ["reformulation attendue"],\n'
                + '    "ignore_case": true,\n'
                + '    "ignore_accents": true\n'
                + "  }\n"
                + tail
            )

        # long_text / spoken_response
        return (
            header
            + common
            + '  "options": [],\n'
            + '  "scoring_payload": {\n'
            + '    "rubric": ["Critère 1 évalué", "Critère 2 évalué", "Critère 3 évalué"],\n'
            + '    "expected_duration_seconds": 180\n'
            + "  }\n"
            + tail
        )

    # ---------------------------------------------------------------------------
    # Taxonomy Skills Resolver & Restrictor
    # ---------------------------------------------------------------------------
    @classmethod
    async def _resolve_task_type(
        cls, db: AsyncSession, request: AIQuestionGenerationRequest
    ) -> TaskType | None:
        """Resolve TaskType from ID or code, defaulting to a reading task.

        The registry (not the task_types table) owns the format contract, so an
        explicitly requested code is always honoured. When no matching row exists
        we return ``None`` rather than substituting a different format's row:
        silently attaching e.g. ``press_article`` to a ``text_ordering`` request
        would corrupt both the persisted provenance and the format spec.
        """
        if request.task_type_id:
            return await db.get(TaskType, request.task_type_id)

        if request.task_type_code:
            stmt = select(TaskType).where(TaskType.code == request.task_type_code)
            return (await db.execute(stmt)).scalar_one_or_none()

        # Fallback to default task type for modality
        fallback_code = "press_article" if request.modality == "reading" else "public_announcement"
        stmt = select(TaskType).where(
            TaskType.modality == request.modality,
            TaskType.code == fallback_code,
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    @classmethod
    async def _resolve_allowed_skills(
        cls,
        db: AsyncSession,
        request: AIQuestionGenerationRequest,
        task_type: TaskType | None,
    ) -> list[Skill]:
        """Fetch active, assessable skills compatible with the task modality and partitioned by dimension."""
        from app.modules.admin.models import TaskTypeSkill

        stmt = select(Skill).where(Skill.is_active == True, Skill.is_assessable == True)
        if request.modality:
            # Filter skills whose domain matches modality, is general, or is None
            stmt = stmt.where(
                (Skill.domain == request.modality) | (Skill.domain == "general") | (Skill.domain == None)
            )

        # Restrict by TaskTypeSkill whitelist if defined for this task type
        if task_type is not None:
            tts_stmt = select(TaskTypeSkill.skill_id).where(TaskTypeSkill.task_type_id == task_type.id)
            whitelisted_ids = set((await db.execute(tts_stmt)).scalars().all())
            if whitelisted_ids:
                stmt = stmt.where(
                    (Skill.id.in_(whitelisted_ids)) | (Skill.parent_id.in_(whitelisted_ids))
                )

        skills = list((await db.execute(stmt)).scalars().all())

        if request.target_skill_ids:
            # Filter to explicitly requested skills
            requested_set = set(request.target_skill_ids)
            filtered = [s for s in skills if s.id in requested_set]
            if filtered:
                return filtered

        # Partition skills to balance reasoning and language
        reasoning = [s for s in skills if getattr(s.dimension, "value", str(s.dimension)) == "reasoning"]
        language = [s for s in skills if getattr(s.dimension, "value", str(s.dimension)) == "language"]
        other = [s for s in skills if s not in reasoning and s not in language]

        # Return balanced set (up to 8 reasoning and up to 8 language)
        balanced = reasoning[:8] + language[:8] + other[:4]
        return balanced or skills[:15]

    @classmethod
    async def _resolve_stimulus_context(
        cls, db: AsyncSession, request: AIQuestionGenerationRequest
    ) -> tuple[str | None, str | None, uuid.UUID | None]:
        """Retrieve existing stimulus if specified, or use supplied text."""
        if request.stimulus_mode == "existing_stimulus" and request.stimulus_id:
            stim = await db.get(Stimulus, request.stimulus_id)
            if stim:
                return stim.content_text, stim.title, stim.id

        if request.stimulus_mode == "supplied_text" and request.supplied_stimulus_text:
            return request.supplied_stimulus_text, "Document fourni", None

        return None, None, None

    @classmethod
    def _bind_skill_mappings(
        cls,
        allowed_skills: list[Skill],
        parsed_skill_ids: list[Any],
        target_skill_ids: list[uuid.UUID],
    ) -> list[CandidateSkillMapping]:
        """Strictly enforce that skill mappings use only real, allowed taxonomy skills,
        enforcing dual-dimension tagging (1 primary reasoning + optional 1 primary language).
        """
        if not allowed_skills:
            return []

        allowed_map: dict[str, Skill] = {str(s.id): s for s in allowed_skills}
        code_map: dict[str, Skill] = {s.code.lower(): s for s in allowed_skills}

        # 1. If target skills were explicitly specified by admin, prioritize those
        if target_skill_ids:
            target_skills = [allowed_map[str(tid)] for tid in target_skill_ids if str(tid) in allowed_map]
            if target_skills:
                res_by_dim: dict[str, list[Skill]] = {}
                for s in target_skills:
                    dim = getattr(s.dimension, "value", str(s.dimension)) if s.dimension else "reasoning"
                    res_by_dim.setdefault(dim, []).append(s)
                mappings: list[CandidateSkillMapping] = []
                for dim, sk_list in res_by_dim.items():
                    if len(sk_list) == 1:
                        mappings.append(
                            CandidateSkillMapping(
                                skill_id=sk_list[0].id,
                                skill_code=sk_list[0].code,
                                skill_name=sk_list[0].name,
                                role="primary",
                                weight=1.0,
                            )
                        )
                    elif len(sk_list) == 2:
                        mappings.append(
                            CandidateSkillMapping(
                                skill_id=sk_list[0].id,
                                skill_code=sk_list[0].code,
                                skill_name=sk_list[0].name,
                                role="primary",
                                weight=0.75,
                            )
                        )
                        mappings.append(
                            CandidateSkillMapping(
                                skill_id=sk_list[1].id,
                                skill_code=sk_list[1].code,
                                skill_name=sk_list[1].name,
                                role="secondary",
                                weight=0.25,
                            )
                        )
                    else:
                        prim_w = 0.60
                        sec_w = round(0.40 / (len(sk_list) - 1), 4)
                        for idx, sk in enumerate(sk_list):
                            mappings.append(
                                CandidateSkillMapping(
                                    skill_id=sk.id,
                                    skill_code=sk.code,
                                    skill_name=sk.name,
                                    role="primary" if idx == 0 else "secondary",
                                    weight=prim_w if idx == 0 else sec_w,
                                )
                            )
                return mappings

        # 2. Otherwise map from parsed LLM output, enforcing at most 1 primary per dimension
        matched_by_dim: dict[str, list[Skill]] = {}
        seen_ids: set[uuid.UUID] = set()

        for item in parsed_skill_ids:
            if not isinstance(item, dict):
                continue
            cand_id_str = str(item.get("skill_id", "")).strip().lower()
            matched_skill = allowed_map.get(cand_id_str) or code_map.get(cand_id_str)

            if matched_skill and matched_skill.id not in seen_ids:
                seen_ids.add(matched_skill.id)
                dim = getattr(matched_skill.dimension, "value", str(matched_skill.dimension)) if matched_skill.dimension else "reasoning"
                matched_by_dim.setdefault(dim, []).append(matched_skill)

        results: list[CandidateSkillMapping] = []
        for dim, sk_list in matched_by_dim.items():
            if len(sk_list) == 1:
                results.append(
                    CandidateSkillMapping(
                        skill_id=sk_list[0].id,
                        skill_code=sk_list[0].code,
                        skill_name=sk_list[0].name,
                        role="primary",
                        weight=1.0,
                    )
                )
            elif len(sk_list) >= 2:
                # 1 Primary at 0.75 + 1 Secondary at 0.25 (sums to 1.00)
                results.append(
                    CandidateSkillMapping(
                        skill_id=sk_list[0].id,
                        skill_code=sk_list[0].code,
                        skill_name=sk_list[0].name,
                        role="primary",
                        weight=0.75,
                    )
                )
                results.append(
                    CandidateSkillMapping(
                        skill_id=sk_list[1].id,
                        skill_code=sk_list[1].code,
                        skill_name=sk_list[1].name,
                        role="secondary",
                        weight=0.25,
                    )
                )

        # 3. Fallback if no skills matched or LLM hallucinated
        if not results:
            reasoning_skills = [s for s in allowed_skills if getattr(s.dimension, "value", str(s.dimension)) == "reasoning"]
            language_skills = [s for s in allowed_skills if getattr(s.dimension, "value", str(s.dimension)) == "language"]

            if len(reasoning_skills) >= 2:
                results.append(CandidateSkillMapping(skill_id=reasoning_skills[0].id, skill_code=reasoning_skills[0].code, skill_name=reasoning_skills[0].name, role="primary", weight=0.75))
                results.append(CandidateSkillMapping(skill_id=reasoning_skills[1].id, skill_code=reasoning_skills[1].code, skill_name=reasoning_skills[1].name, role="secondary", weight=0.25))
            elif reasoning_skills:
                results.append(CandidateSkillMapping(skill_id=reasoning_skills[0].id, skill_code=reasoning_skills[0].code, skill_name=reasoning_skills[0].name, role="primary", weight=1.0))

            if len(language_skills) >= 2:
                results.append(CandidateSkillMapping(skill_id=language_skills[0].id, skill_code=language_skills[0].code, skill_name=language_skills[0].name, role="primary", weight=0.75))
                results.append(CandidateSkillMapping(skill_id=language_skills[1].id, skill_code=language_skills[1].code, skill_name=language_skills[1].name, role="secondary", weight=0.25))
            elif language_skills:
                results.append(CandidateSkillMapping(skill_id=language_skills[0].id, skill_code=language_skills[0].code, skill_name=language_skills[0].name, role="primary", weight=1.0))

            if not results and allowed_skills:
                results.append(CandidateSkillMapping(skill_id=allowed_skills[0].id, skill_code=allowed_skills[0].code, skill_name=allowed_skills[0].name, role="primary", weight=1.0))

        return results

    # ---------------------------------------------------------------------------
    # Duplicate Detection Engine
    # ---------------------------------------------------------------------------
    @classmethod
    async def check_question_duplicates(
        cls,
        db: AsyncSession,
        prompt: str,
        stimulus_content: str | None = None,
    ) -> DuplicateCheckReport:
        """Scan question bank for prompt or stimulus duplicates using text token similarity."""
        if not prompt or not prompt.strip():
            return DuplicateCheckReport(
                is_duplicate=False,
                status="unique",
                similarity_score=0.0,
                message="Énoncé vide, vérification doublon ignorée.",
            )

        clean_prompt = normalize_prompt_for_hash(prompt)
        candidate_hash = compute_item_hash(prompt)
        candidate_tokens = _tokenize_text(clean_prompt)

        # 1. Exact match check.
        #    Primary path is the index-backed item_hash lookup, which is also
        #    whitespace-insensitive. The secondary path catches legacy rows whose
        #    item_hash was never populated (NULL) by an older write path; it
        #    compares the un-collapsed form because SQL cannot portably reproduce
        #    the hash normalization, so it stays a best-effort net only.
        legacy_prompt = prompt.strip().lower()
        exact_stmt = select(Question).where(
            or_(
                Question.item_hash == candidate_hash,
                and_(
                    Question.item_hash.is_(None),
                    func.lower(func.trim(Question.prompt)) == legacy_prompt,
                ),
            )
        ).limit(1)
        exact_match = (await db.execute(exact_stmt)).scalar_one_or_none()

        if exact_match:
            return DuplicateCheckReport(
                is_duplicate=True,
                status="exact_duplicate",
                similarity_score=1.0,
                matched_question_id=exact_match.id,
                matched_prompt=exact_match.prompt,
                message="Doublon exact détecté dans la banque de questions.",
            )

        # 2. Similarity scan over recent or similar questions.
        #    Ordered explicitly: without ORDER BY the row order is undefined and
        #    the truncated scan would return non-deterministic matches.
        scan_stmt = (
            select(Question.id, Question.prompt)
            .order_by(Question.created_at.desc(), Question.id.desc())
            .limit(DUPLICATE_SCAN_LIMIT)
        )
        existing_rows = (await db.execute(scan_stmt)).all()

        highest_sim = 0.0
        best_match_id: uuid.UUID | None = None
        best_match_prompt: str | None = None

        for q_id, q_prompt in existing_rows:
            if not q_prompt:
                continue
            existing_tokens = _tokenize_text(q_prompt)
            sim = _calculate_jaccard_similarity(candidate_tokens, existing_tokens)
            if sim > highest_sim:
                highest_sim = sim
                best_match_id = q_id
                best_match_prompt = q_prompt

        if highest_sim >= DUPLICATE_SIMILARITY_THRESHOLD:
            return DuplicateCheckReport(
                is_duplicate=True,
                status="possible_duplicate",
                similarity_score=round(highest_sim, 2),
                matched_question_id=best_match_id,
                matched_prompt=best_match_prompt,
                message=f"Suspicion de doublon : similarité lexicale de {int(highest_sim * 100)}% avec une question existante.",
            )

        return DuplicateCheckReport(
            is_duplicate=False,
            status="unique",
            similarity_score=round(highest_sim, 2),
            matched_question_id=best_match_id if highest_sim > 0.4 else None,
            matched_prompt=best_match_prompt if highest_sim > 0.4 else None,
            message="Contenu original, aucun doublon significatif identifié.",
        )

    # ---------------------------------------------------------------------------
    # Candidate Validation via QuestionValidationEngine
    # ---------------------------------------------------------------------------
    @classmethod
    async def _validate_candidate_item(
        cls,
        db: AsyncSession,
        candidate: GeneratedQuestionCandidate,
        task_type_id: uuid.UUID | None,
    ) -> ValidationResult:
        """Run candidate through the authoritative QuestionValidationEngine."""
        # Convert candidate into format accepted by QuestionValidationEngine
        pseudo_dict = {
            "id": None,
            "prompt": candidate.prompt,
            "instructions": candidate.instructions,
            "response_type": candidate.response_type,
            "target_cefr": candidate.target_cefr,
            "difficulty_rating": candidate.difficulty_rating,
            "cognitive_complexity": candidate.cognitive_complexity,
            "scoring_payload": candidate.scoring_payload,
            "author_type": QuestionAuthorType.AI.value,
            "options": [
                {
                    "content": o.content,
                    "is_correct": o.is_correct,
                    "order_index": o.order_index,
                    "explanation": o.explanation,
                    "misconception_type": o.misconception_type,
                    "distractor_rationale": o.distractor_rationale,
                }
                for o in candidate.options
            ],
            "skill_tags": [
                {
                    "skill_id": sm.skill_id,
                    "role": sm.role,
                    "weight": sm.weight,
                }
                for sm in candidate.skill_mappings
            ],
            "stimulus_id": candidate.stimulus_id,
            "stimulus_text": candidate.stimulus_content,
            "task_type_id": task_type_id,
            "provenance": {
                "author_type": QuestionAuthorType.AI.value,
                "generator_model": candidate.generation_metadata.model,
                "generator_prompt_version": candidate.generation_metadata.prompt_template_version,
                "generator_parameters": {
                    "is_simulation": candidate.generation_metadata.is_simulation,
                },
            },
        }

        return await QuestionValidationEngine.validate_question(
            db=db,
            question=pseudo_dict,
            task_type_id=task_type_id,
            check_duplication=False,  # Already handled by dedicated duplicate engine
        )

    # ---------------------------------------------------------------------------
    # Second-Pass AI Review Engine (Read-Only Quality Critique)
    # ---------------------------------------------------------------------------
    @classmethod
    async def review_candidate(
        cls,
        db: AsyncSession,
        request: CandidateReviewRequest,
    ) -> AIReviewReport:
        """Generate a second-pass quality, naturalness, and pedagogical audit."""
        cand = request.candidate
        api_key = request.api_key_override or settings.GEMINI_API_KEY
        use_simulation = request.force_simulation or not api_key

        if not use_simulation and api_key:
            system_prompt = (
                "Tu es un auditeur linguistique et psychométrique senior indépendant pour le TEF. "
                "Évalue la question candidate fournie selon 3 axes :\n"
                "1. Authenticité linguistique et registre de langue française (0-100)\n"
                "2. Équilibre et pertinence des distracteurs (qualité des pièges, absence d'indices involontaires)\n"
                "3. Alignement avec le niveau CECRL ciblé.\n"
                "Fournis une note globale, les forces, les faiblesses, et les améliorations suggérées au format JSON strict."
            )
            user_prompt = (
                f"Document support :\n{cand.stimulus_content}\n\n"
                f"Énoncé : {cand.prompt}\n"
                f"Niveau CECRL visé : {cand.target_cefr}\n"
                f"Options :\n"
                + "\n".join(
                    f"- {'[CORRECTE] ' if o.is_correct else '[DISTRACTEUR] '}{o.content} (Justification: {o.explanation or ''})"
                    for o in cand.options
                )
            )

            try:
                raw_text, _, _ = await AISandboxService._call_gemini_api(
                    api_key=api_key,
                    model=settings.GEMINI_EVAL_MODEL,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=0.2,
                )
                parsed = AISandboxService._parse_json_or_fallback(raw_text)
                return AIReviewReport(
                    quality_score=float(parsed.get("quality_score", 88.0)),
                    naturalness_score=float(parsed.get("naturalness_score", 92.0)),
                    pedagogical_alignment=str(parsed.get("pedagogical_alignment", "high")),
                    distractor_quality=str(parsed.get("distractor_quality", "Distracteurs équilibrés et plausibles.")),
                    strengths=list(parsed.get("strengths", ["Excellente fidélité au niveau CECRL visé", "Distracteurs fondés sur des pièges textuels crédibles"])),
                    weaknesses=list(parsed.get("weaknesses", [])),
                    warnings=list(parsed.get("warnings", [])),
                    suggested_improvements=list(parsed.get("suggested_improvements", [])),
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Second-pass AI review failed, using heuristic audit", error=str(exc))

        # Deterministic heuristic critique fallback
        has_correct = any(o.is_correct for o in cand.options)
        option_lengths = [len(o.content.split()) for o in cand.options]
        len_variance = max(option_lengths) - min(option_lengths) if option_lengths else 0

        quality = 90.0 if has_correct and len_variance <= 5 else 75.0
        warnings = []
        if len_variance > 7:
            warnings.append("Écart de longueur important entre les options (risque d'indice visuel).")

        return AIReviewReport(
            quality_score=quality,
            naturalness_score=92.0,
            pedagogical_alignment="high" if quality >= 85 else "moderate",
            distractor_quality="Distracteurs crédibles fondés sur des extrapolations courantes.",
            strengths=[
                f"Alignement adéquat avec le niveau CECRL {cand.target_cefr}",
                "Formulation concise de l'énoncé",
                "Clé de réponse univoque",
            ],
            weaknesses=[] if not warnings else warnings,
            warnings=warnings,
            suggested_improvements=["Homogénéiser la taille des propositions."] if warnings else [],
        )

    # ---------------------------------------------------------------------------
    # Draft Creation: Convert Candidate to DB Question
    # ---------------------------------------------------------------------------
    @classmethod
    async def create_draft_from_candidate(
        cls,
        db: AsyncSession,
        candidate: GeneratedQuestionCandidate,
        actor_id: uuid.UUID | None,
        section_id: uuid.UUID | None = None,
    ) -> Question:
        """Persist candidate as a formal draft Question with complete provenance.

        INVARIANTS ENFORCED:
        - Status is ALWAYS 'draft'.
        - Author type is ALWAYS 'ai'.
        - NEVER auto-publishes or auto-approves.
        - QuestionProvenance is populated with full generation lineage.
        """
        now = datetime.datetime.now(datetime.UTC)

        # 1. Resolve or Create Stimulus if content exists and no ID provided
        stimulus_id = candidate.stimulus_id
        if not stimulus_id and candidate.stimulus_content and candidate.stimulus_content.strip():
            import hashlib
            stim_title = candidate.stimulus_title or "Document support"
            stim_modality = candidate.modality or "reading"
            stim_content = candidate.stimulus_content.strip()
            c_hash = hashlib.sha256(f"{stim_title}:{stim_modality}:{stim_content}".encode()).hexdigest()
            existing_stim = await db.scalar(select(Stimulus).where(Stimulus.content_hash == c_hash))
            if existing_stim:
                stimulus_id = existing_stim.id
            else:
                stim = Stimulus(
                    title=stim_title,
                    modality=stim_modality,
                    content_text=stim_content,
                    text_format="plain",
                    word_count=len(stim_content.split()),
                    source_citation=candidate.source_attribution,
                    content_hash=c_hash,
                    created_at=now,
                    updated_at=now,
                )
                db.add(stim)
                await db.flush()
                stimulus_id = stim.id


        # 2. Validate and map the response format onto the coarse QuestionType enum.
        try:
            response_type = QuestionResponseType(candidate.response_type)
        except ValueError as exc:
            raise ValueError(
                f"Unsupported response_type {candidate.response_type!r}; "
                "generation must emit a valid QuestionResponseType."
            ) from exc
        q_type = cls._question_type_for(response_type)

        # 3. Create Question record in DRAFT status in the Question Bank (decoupled from section)
        question = Question(
            question_type=q_type,
            response_type=response_type.value,
            prompt=candidate.prompt,
            instructions=candidate.instructions,
            item_hash=compute_item_hash(candidate.prompt),
            stimulus_id=stimulus_id,
            difficulty_rating=candidate.difficulty_rating,
            difficulty=candidate.item_difficulty,
            target_cefr=candidate.target_cefr,
            level=candidate.target_cefr,
            cognitive_complexity=candidate.cognitive_complexity,
            points=candidate.points,
            penalty_points=candidate.penalty_points,
            scoring_payload=cls._prepare_scoring_payload(response_type, candidate),
            explanation=candidate.explanation,
            task_type_id=candidate.task_type_id,
            status=ContentStatus.DRAFT.value,  # HARD INVARIANT: Always DRAFT
            version=1,
            created_by_user_id=actor_id,
            updated_by_user_id=actor_id,
            created_at=now,
            updated_at=now,
        )
        db.add(question)
        await db.flush()

        # Optional: Link to assessment section if explicitly targeted
        if section_id:
            sec_assoc = AssessmentSectionQuestion(
                assessment_section_id=section_id,
                question_id=question.id,
                order_index=0,
            )
            db.add(sec_assoc)

        # 4. Create Question Options (distractor metadata is preserved verbatim)
        for opt in candidate.options:
            q_opt = QuestionOption(
                question_id=question.id,
                content=opt.content,
                is_correct=opt.is_correct,
                order_index=opt.order_index,
                explanation=opt.explanation,
                misconception_type=opt.misconception_type,
                distractor_rationale=opt.distractor_rationale,
                created_at=now,
                updated_at=now,
            )
            db.add(q_opt)
        await db.flush()

        # 4b. Ordering items are persisted as options; rewrite the candidate's
        #     ordinal keys to the real option UUIDs the scorer will compare against.
        if response_type == QuestionResponseType.ORDERING:
            await cls._persist_ordering_options(db, question, candidate, now)

        # 5. Create Question Skill Tags
        for sm in candidate.skill_mappings:
            role_val = sm.role
            role_enum = SkillTagRole(role_val) if isinstance(role_val, str) else role_val
            q_tag = QuestionSkillTag(
                question_id=question.id,
                skill_id=sm.skill_id,
                role=role_enum,
                weight=sm.weight,
                created_at=now,
                updated_at=now,
            )
            db.add(q_tag)

        # 6. Create Question Provenance
        prov = QuestionProvenance(
            question_id=question.id,
            author_type=QuestionAuthorType.AI.value,
            source_type="ai_generation",
            generator_model=candidate.generation_metadata.model,
            generator_prompt_version=candidate.generation_metadata.prompt_template_version,
            generator_parameters={
                "tokens_used": candidate.generation_metadata.total_tokens,
                "latency_ms": candidate.generation_metadata.latency_ms,
                "is_simulation": candidate.generation_metadata.is_simulation,
                "candidate_id": candidate.candidate_id,
            },
            created_by_user_id=actor_id,
            created_at=now,
        )
        db.add(prov)
        await db.flush()

        # 7. Execute automated validation audit record
        await QuestionValidationEngine.validate_and_persist(
            db=db,
            question=question,
            actor_id=actor_id,
            check_duplication=True,
        )

        # 8. Record Immutable Audit Event
        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.CREATE,
            entity_type="question",
            entity_id=question.id,
            payload={
                "action": "ai_draft_created",
                "candidate_id": candidate.candidate_id,
                "model": candidate.generation_metadata.model,
                "cefr": candidate.target_cefr,
                "status": "draft",
            },
        )

        question_id = question.id
        await db.flush()

        # Return fully loaded question
        stmt = (
            select(Question)
            .where(Question.id == question_id)
            .options(
                selectinload(Question.options),
                selectinload(Question.skill_tags),
                selectinload(Question.stimulus),
                selectinload(Question.provenance),
                selectinload(Question.validations),
            )
        )
        return (await db.execute(stmt)).scalar_one()

    # ---------------------------------------------------------------------------
    # Draft Persistence Helpers
    # ---------------------------------------------------------------------------
    @staticmethod
    def _question_type_for(response_type: QuestionResponseType) -> QuestionType:
        """Map a precise response format onto the coarse QuestionType enum.

        QuestionType only distinguishes choice / multi-choice / free text, so
        matching and ordering are stored as text input: the candidate assembles
        a response payload rather than ticking an option.
        """
        if response_type == QuestionResponseType.MULTIPLE_CHOICE:
            return QuestionType.MULTIPLE_CHOICE
        if response_type == QuestionResponseType.SINGLE_CHOICE:
            return QuestionType.SINGLE_CHOICE
        return QuestionType.TEXT_INPUT

    @classmethod
    def _prepare_scoring_payload(
        cls,
        response_type: QuestionResponseType,
        candidate: GeneratedQuestionCandidate,
    ) -> dict[str, Any] | None:
        """Return a defensive copy of the scoring payload for persistence."""
        if not candidate.scoring_payload:
            return None
        if response_type == QuestionResponseType.ORDERING:
            # The sequence is rewritten once option UUIDs exist.
            payload = {
                k: v for k, v in candidate.scoring_payload.items() if k not in {"sequence"}
            }
            payload["sequence"] = [str(x) for x in candidate.scoring_payload.get("sequence") or []]
            return payload
        return dict(candidate.scoring_payload)

    @classmethod
    async def _persist_ordering_options(
        cls,
        db: AsyncSession,
        question: Question,
        candidate: GeneratedQuestionCandidate,
        now: datetime.datetime,
    ) -> None:
        """Create ordering options and rebind the scoring payload to their UUIDs."""
        items = (candidate.scoring_payload or {}).get("items") or []
        if not items:
            return

        raw_sequence = [str(x) for x in (candidate.scoring_payload or {}).get("sequence") or []]
        if not raw_sequence:
            raw_sequence = [
                str(it.get("id") or it.get("key")) for it in items if isinstance(it, dict)
            ]

        position_by_id = {key: idx for idx, key in enumerate(raw_sequence)}

        created: list[tuple[int, uuid.UUID, str]] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            key = str(item.get("id") or item.get("key"))
            if not key:
                continue
            order_index = int(position_by_id.get(key, item.get("correct_position") or 0))
            option_id = uuid.uuid4()
            text = str(item.get("text", ""))
            db.add(
                QuestionOption(
                    id=option_id,
                    question_id=question.id,
                    content=text,
                    is_correct=False,
                    order_index=order_index,
                    created_at=now,
                    updated_at=now,
                )
            )
            created.append((order_index, option_id, text))

        created.sort(key=lambda entry: entry[0])
        new_items = [
            {"id": str(option_id), "text": text, "correct_position": idx}
            for idx, (_order_index, option_id, text) in enumerate(created)
        ]

        payload = dict(question.scoring_payload or {})
        payload["sequence"] = [str(option_id) for _order_index, option_id, _text in created]
        payload["items"] = new_items
        question.scoring_payload = payload
        await db.flush()

    # ---------------------------------------------------------------------------
    # Component Regeneration on Draft Questions
    # ---------------------------------------------------------------------------
    @classmethod
    async def regenerate_draft_component(
        cls,
        db: AsyncSession,
        question_id: uuid.UUID,
        request: CandidateRegenerateRequest,
        actor_id: uuid.UUID | None,
    ) -> Question:
        """Regenerate specific components (distractors, prompt, explanation) of an existing draft question.

        HARD INVARIANT:
        Questions in 'approved', 'published', or 'archived' status MUST NEVER BE MUTATED.
        Raises 409 Conflict if mutation is attempted on an immutable question.
        """
        stmt = (
            select(Question)
            .where(Question.id == question_id)
            .options(
                selectinload(Question.options),
                selectinload(Question.skill_tags),
                selectinload(Question.stimulus),
                selectinload(Question.provenance),
            )
        )
        question = (await db.execute(stmt)).scalar_one_or_none()
        if not question:
            raise AppException(message="Question introuvable", code="NOT_FOUND", status_code=404)

        # IMMUTABILITY INVARIANT CHECK
        immutable_statuses = {
            ContentStatus.APPROVED.value,
            ContentStatus.PUBLISHED.value,
            ContentStatus.ARCHIVED.value,
        }
        if question.status in immutable_statuses:
            raise AppException(
                message=(
                    f"Impossible de régénérer une question en statut '{question.status}'. "
                    "Les questions approuvées ou publiées sont immuables. "
                    "Créez d'abord une nouvelle version brouillon (fork / new version)."
                ),
                code="IMMUTABLE_QUESTION_MUTATION",
                status_code=409,
            )

        now = datetime.datetime.now(datetime.UTC)

        spec = await cls._resolve_spec_for_existing_question(db, question)

        if request.component not in REGENERABLE_COMPONENTS:
            raise AppException(
                message=(
                    f"Composant '{request.component}' non régénérable. "
                    f"Composants acceptés : {', '.join(REGENERABLE_COMPONENTS)}."
                ),
                code="UNSUPPORTED_REGENERATION_COMPONENT",
                status_code=400,
            )

        # Distractors only make sense for items that actually render options.
        # This keys off the question's own response type rather than the family's
        # capabilities: `text_gap` supports both `single_choice` and `gap_fill`,
        # and a gap-fill variant must never gain distractors.
        if request.component in ("distractors", "options") and not response_type_uses_options(
            question.response_type
        ):
            raise AppException(
                message=(
                    f"Le format de réponse '{question.response_type}' n'utilise pas de "
                    "choix discrets : la régénération de distracteurs est inapplicable."
                ),
                code="UNSUPPORTED_REGENERATION_COMPONENT",
                status_code=400,
            )

        api_key = request.api_key_override or settings.GEMINI_API_KEY
        use_simulation = request.force_simulation or not api_key
        regen_payload: dict[str, Any] = {}
        target_total = cls._target_option_count(question, spec)

        if not use_simulation and api_key:
            try:
                raw_text, _, _ = await AISandboxService._call_gemini_api(
                    api_key=api_key,
                    model=request.model,
                    system_prompt=cls._build_regeneration_system_prompt(request.component, spec),
                    user_prompt=cls._build_regeneration_user_prompt(question, request, spec),
                    temperature=request.temperature,
                    max_tokens=2000,
                )
                parsed = AISandboxService._parse_json_or_fallback(raw_text)
                if isinstance(parsed, dict):
                    regen_payload = parsed
                else:
                    logger.warning(
                        "regeneration.parse_unusable",
                        question_id=str(question.id),
                        component=request.component,
                    )
            except Exception:
                logger.exception(
                    "regeneration.llm_failed",
                    question_id=str(question.id),
                    component=request.component,
                )
        else:
            logger.warning(
                "regeneration.using_deterministic_fallback",
                question_id=str(question.id),
                component=request.component,
                reason="simulation" if request.force_simulation else "missing_api_key",
            )
            # Produce the same payload shape as the LLM path so the apply and
            # validation logic below is exercised identically in simulation.
            regen_payload = cls._simulate_regeneration_payload(
                component=request.component,
                question=question,
                spec=spec,
                target_total=target_total,
            )

        # Handle regeneration of distractors
        if request.component in ("distractors", "options"):
            correct_opt = next((o for o in question.options if o.is_correct), None)
            if correct_opt is None:
                raise AppException(
                    message=(
                        "Aucune option correcte identifiée : impossible de régénérer les "
                        "distracteurs sans altérer la clé de correction."
                    ),
                    code="MISSING_CORRECT_OPTION",
                    status_code=409,
                )

            distractors = cls._extract_regenerated_distractors(
                regen_payload,
                existing=question.options,
                target_count=target_total - 1,
            )

            # Clear old options and add regenerated options
            question.options.clear()

            # Insert preserved correct answer and new distractors
            new_opts = [
                QuestionOption(
                    question_id=question.id,
                    content=correct_opt.content,
                    is_correct=True,
                    order_index=0,
                    explanation=correct_opt.explanation or "Bonne réponse.",
                    misconception_type=correct_opt.misconception_type,
                    distractor_rationale=correct_opt.distractor_rationale,
                    created_at=now,
                    updated_at=now,
                )
            ]
            for offset, distractor in enumerate(distractors, start=1):
                new_opts.append(
                    QuestionOption(
                        question_id=question.id,
                        content=distractor["content"],
                        is_correct=False,
                        order_index=offset,
                        explanation=distractor["explanation"],
                        misconception_type=distractor["misconception_type"],
                        distractor_rationale=distractor["distractor_rationale"],
                        created_at=now,
                        updated_at=now,
                    )
                )
            question.options.extend(new_opts)

        elif request.component == "prompt":
            new_prompt = cls._extract_regenerated_prompt(regen_payload, question, request)
            if new_prompt:
                question.prompt = new_prompt
                # Keep the duplicate-detection index in sync with the new text.
                question.item_hash = compute_item_hash(new_prompt)
        elif request.component == "explanation":
            new_explanation = regen_payload.get("explanation") or regen_payload.get("global_explanation")
            if isinstance(new_explanation, str) and new_explanation.strip():
                question.explanation = new_explanation.strip()

        question.updated_by_user_id = actor_id
        question.updated_at = now
        await db.flush()

        # Re-run validation audit
        await QuestionValidationEngine.validate_and_persist(
            db=db,
            question=question,
            actor_id=actor_id,
            check_duplication=True,
        )

        question_id = question.id
        await db.flush()

        # Refresh and return
        stmt_refresh = (
            select(Question)
            .where(Question.id == question_id)
            .options(
                selectinload(Question.options),
                selectinload(Question.skill_tags),
                selectinload(Question.stimulus),
                selectinload(Question.provenance),
                selectinload(Question.validations),
            )
        )
        res = await db.execute(stmt_refresh)
        return res.scalar_one()

    # ---------------------------------------------------------------------------
    # Component Regeneration Helpers
    # ---------------------------------------------------------------------------
    @classmethod
    async def _resolve_spec_for_existing_question(
        cls, db: AsyncSession, question: Question
    ) -> TaskFormatSpec:
        """Infer the governing format spec for an already-persisted question.

        ``Question`` exposes only the ``task_type_id`` foreign key (there is no
        ORM relationship), so the owning task type is loaded explicitly here.
        """
        task_code: str | None = None
        modality = "reading"

        if question.task_type_id:
            task_type = await db.get(TaskType, question.task_type_id)
            if task_type is not None:
                task_code = task_type.code
                modality = task_type.modality

        return cls._resolve_spec(
            task_type_code=task_code,
            response_type=question.response_type,
            modality=modality,
        )

    @staticmethod
    def _build_regeneration_system_prompt(component: str, spec: TaskFormatSpec) -> str:
        """System prompt scoped to a single component and the question's format."""
        common = (
            "Tu es un concepteur d'épreuves TEF. Tu régénères UN SEUL composant d'une "
            f"question existante de la famille « {spec.name} » ({spec.code}). "
            "Réponds uniquement en JSON valide, sans texte autour. "
            "Conserve le sens pédagogique et le niveau CECRL d'origine."
        )
        if component in ("distractors", "options"):
            return (
                f"{common}\n"
                "Tâche : produire des distracteurs (mauvaises réponses) crédibles et "
                "de longueur comparable à la bonne réponse.\n"
                "JSON attendu : "
                '{"distractors": [{"content": "...", "explanation": "...", '
                '"misconception_type": "...", "distractor_rationale": "..."}]}\n'
                "Champs : misconception_type ∈ {false_fact, extrapolation, wording_shift, "
                "absurdity, false_quantifier, distractor_category}. "
                "distractor_rationale doit nommer le mécanisme de l'erreur."
            )
        if component == "prompt":
            return (
                f"{common}\n"
                "Tâche : réécrire uniquement l'énoncé, sans changer la réponse attendue "
                "ni le sens de la question.\n"
                'JSON attendu : {"prompt": "..."}'
            )
        return (
            f"{common}\n"
            "Tâche : rédiger l'explication pédagogique de la réponse correcte "
            "(pourquoi c'est juste, et le raisonnement attendu).\n"
            'JSON attendu : {"explanation": "..."}'
        )

    @staticmethod
    def _build_regeneration_user_prompt(
        question: Question,
        request: CandidateRegenerateRequest,
        spec: TaskFormatSpec,
    ) -> str:
        options_block = "\n".join(
            f"- {'[CORRECTE] ' if o.is_correct else '[DISTRACTEUR] '}{o.content}"
            for o in question.options
        )
        parts = [
            f"Famille de tâche : {spec.name} ({spec.code})",
            f"Format de réponse : {question.response_type}",
            f"Niveau CECRL : {question.target_cefr or question.level or 'B2'}",
            f"Énoncé actuel : {question.prompt}",
        ]
        if options_block:
            parts.append(f"Options actuelles :\n{options_block}")
        if request.custom_instructions:
            parts.append(f"Consignes de l'administrateur : {request.custom_instructions}")
        return "\n\n".join(parts)

    @staticmethod
    def _target_option_count(question: Question, spec: TaskFormatSpec) -> int:
        """Number of options a regenerated item should carry.

        Regeneration completes *and* improves the option set, so the target is
        the format's standard option count rather than however many distractors
        the draft happened to have. The value is clamped into the family's valid
        range so 2-3 and 4-5 families are never forced to four options.
        """
        response_type = question.response_type or spec.default_response_type
        minimum, maximum = spec.option_count

        if maximum == 0:
            # Ordering items and other option-bearing families without a declared
            # range: preserve the author's ordering size, floor of four.
            return max(len(question.options), 4)

        standard_min, standard_max = standard_option_count_for(response_type)
        preferred = standard_max or standard_min
        if minimum <= preferred <= maximum:
            return preferred
        return max(1, min(preferred, maximum))

    @classmethod
    def _simulate_regeneration_payload(
        cls,
        component: str,
        question: Question,
        spec: TaskFormatSpec,
        target_total: int | None = None,
    ) -> dict[str, Any]:
        """Deterministic stand-in for the model when no API key is available.

        The output deliberately mirrors the real contract so downstream
        normalisation is exercised, and is clearly labelled so a human reviewer
        can tell simulated content from model output.
        """
        cefr = question.target_cefr or question.level or "B2"
        family = spec.code

        if component in ("distractors", "options"):
            total = target_total or cls._target_option_count(question, spec)
            target = max(1, total - 1)
            return {
                "distractors": [
                    {
                        "content": f"[Simulation] Piège {index} calibré sur {family} ({cefr})",
                        "explanation": "Distracteur synthétique généré sans appel modèle.",
                        "misconception_type": "false_fact",
                        "distractor_rationale": "Erreur factuelle plausible simulée.",
                    }
                    for index in range(1, target + 1)
                ]
            }
        if component == "prompt":
            return {
                "prompt": f"{question.prompt.strip()} [simulation {family}]",
            }
        return {
            "explanation": (
                f"[Simulation] Explication enrichie pour la famille {family} "
                f"au niveau {cefr}."
            )
        }

    @classmethod
    def _extract_regenerated_distractors(
        cls,
        payload: dict[str, Any],
        existing: Sequence[QuestionOption],
        target_count: int,
    ) -> list[dict[str, Any]]:
        """Normalise LLM distractor output, falling back deterministically.

        The correct answer is never regenerated, so a short or malformed model
        response degrades to reusing the existing distractors rather than
        silently producing a short option list.
        """
        target_count = max(1, target_count)
        raw = payload.get("distractors")
        if not isinstance(raw, list):
            raw = []

        results: list[dict[str, Any]] = []
        seen: set[str] = set()
        for item in raw:
            if not isinstance(item, dict):
                continue
            content = str(item.get("content") or "").strip()
            if not content:
                continue
            fingerprint = normalize_prompt_for_hash(content)
            if fingerprint in seen:
                continue
            seen.add(fingerprint)
            results.append(
                {
                    "content": content,
                    "explanation": str(item.get("explanation") or "").strip()
                    or "Distracteur régénéré.",
                    "misconception_type": item.get("misconception_type") or "false_fact",
                    "distractor_rationale": str(item.get("distractor_rationale") or "").strip()
                    or "Mécanisme d'erreur non précisé.",
                }
            )

        if len(results) < target_count:
            logger.info(
                "regeneration.distractors_fallback",
                requested=len(results),
                needed=target_count,
                reason="insufficient_llm_distractors",
            )
            fallback_pool = [o for o in existing if not o.is_correct]
            for option in fallback_pool:
                if len(results) >= target_count:
                    break
                fingerprint = normalize_prompt_for_hash(option.content or "")
                if not fingerprint or fingerprint in seen:
                    continue
                seen.add(fingerprint)
                results.append(
                    {
                        "content": option.content,
                        "explanation": option.explanation or "Distracteur existant conservé.",
                        "misconception_type": option.misconception_type or "false_fact",
                        "distractor_rationale": option.distractor_rationale
                        or "Mécanisme d'erreur non précisé.",
                    }
                )

        if not results:
            raise AppException(
                message=(
                    "La régénération des distracteurs n'a produit aucune alternative "
                    "exploitable. Réessayez ou saisissez les distracteurs manuellement."
                ),
                code="REGENERATION_PRODUCED_NO_DISTRACTORS",
                status_code=502,
            )

        return results[:target_count]

    @staticmethod
    def _extract_regenerated_prompt(
        payload: dict[str, Any],
        question: Question,
        request: CandidateRegenerateRequest,
    ) -> str | None:
        """Return a new prompt, or None to keep the existing one."""
        candidate = payload.get("prompt")
        if isinstance(candidate, str) and candidate.strip():
            new_prompt = candidate.strip()
            # Guard against a no-op rewrite, which would only churn provenance.
            if normalize_prompt_for_hash(new_prompt) != normalize_prompt_for_hash(question.prompt):
                return new_prompt
            logger.info("regeneration.prompt_unchanged", question_id=str(question.id))
        return None

    # ---------------------------------------------------------------------------
    # Deterministic High-Fidelity Simulation Fallback
    # ---------------------------------------------------------------------------
    @classmethod
    def _simulate_question_generation(
        cls,
        request: AIQuestionGenerationRequest,
        spec: TaskFormatSpec,
        response_type: str,
        option_count: int | None,
        allowed_skills: list[Skill],
        stimulus_title: str | None,
        stimulus_content: str | None,
        candidate_index: int,
    ) -> dict[str, Any]:
        """Produce realistic TEF candidates when API is unavailable or simulated."""
        task_type_code = spec.code
        cefr = (request.target_cefr or "B2").upper()

        sample_stimuli = {
            "A1": (
                "Petite annonce : Cours de guitare",
                (
                    "Professeur diplômé donne cours particuliers de guitare classique et moderne à domicile. "
                    "Pour tous les âges et tous les niveaux. Tarif : 25 euros de l'heure. "
                    "Contactez Marc au 06 12 34 56 78 en soirée."
                ),
                "Quel est le tarif horaire du cours ?",
                [
                    {"content": "25 euros", "is_correct": True, "explanation": "Mentionné explicitement : 25 euros de l'heure."},
                    {"content": "20 euros", "is_correct": False, "misconception_type": "false_fact", "explanation": "Faux chiffre."},
                    {"content": "30 euros", "is_correct": False, "misconception_type": "false_fact", "explanation": "Faux chiffre."},
                    {"content": "35 euros", "is_correct": False, "misconception_type": "false_fact", "explanation": "Faux chiffre."},
                ],
            ),
            "A2": (
                "Avis de fermeture exceptionnelle",
                (
                    "Chers adhérents, la médiathèque municipale fermera ses portes du 12 au 16 octobre inclus pour des travaux de rénovation de l'espace jeunesse. "
                    "Vous pouvez toutefois prolonger vos prêts de livres directement sur notre site internet."
                ),
                "Pourquoi la médiathèque est-elle fermée ?",
                [
                    {"content": "Pour réaliser des travaux dans la section jeunesse.", "is_correct": True, "explanation": "Le texte indique la rénovation de l'espace jeunesse."},
                    {"content": "En raison des congés annuels des employés.", "is_correct": False, "misconception_type": "extrapolation", "explanation": "Non mentionné."},
                    {"content": "Pour organiser une rencontre d'auteurs.", "is_correct": False, "misconception_type": "extrapolation", "explanation": "Non mentionné."},
                    {"content": "Pour déménager vers de nouveaux locaux.", "is_correct": False, "misconception_type": "extrapolation", "explanation": "Il s'agit de travaux, pas d'un déménagement."},
                ],
            ),
            "B1": (
                "Le développement des jardins partagés en ville",
                (
                    "Face au manque d'espaces verts, les municipalités encouragent la création de potagers partagés au cœur des quartiers urbains. "
                    "Au-delà de la production de légumes biologiques, ces parcelles constituent de véritables espaces de convivialité et renforcent les liens intergénérationnels entre riverains. "
                    "Certains résidents déplorent toutefois le manque d'outils disponibles."
                ),
                "D'après l'article, quel est l'avantage social majeur des jardins partagés ?",
                [
                    {"content": "Ils favorisent les rencontres et les échanges entre habitants de différents âges.", "is_correct": True, "explanation": "Correspond au renforcement des liens intergénérationnels."},
                    {"content": "Ils réduisent le coût global de la vie quotidienne pour les citadins.", "is_correct": False, "misconception_type": "extrapolation", "explanation": "Avantage financier non précisé."},
                    {"content": "Ils suppriment totalement la pollution atmosphérique dans les quartiers.", "is_correct": False, "misconception_type": "overgeneralization", "explanation": "Généralisation excessive."},
                    {"content": "Ils garantissent un approvisionnement complet en nourriture biologique.", "is_correct": False, "misconception_type": "overgeneralization", "explanation": "Production locale mais pas approvisionnement complet."},
                ],
            ),
            "B2": (
                "La transition énergétique face au défi de la sobriété",
                (
                    "Si le déploiement des énergies renouvelables constitue un pilier indiscutable de la transition écologique, "
                    "plusieurs experts soulignent qu'il ne saurait suffire sans une réduction drastique de notre consommation globale. "
                    "La sobriété énergétique implique une transformation profonde de nos modes de vie, notamment en matière de mobilité et d'isolation des logements, "
                    "plutôt qu'un simple remplacement technologique de nos sources d'approvisionnement."
                ),
                "Quelle idée directrice l'auteur cherche-t-il à mettre en relief ?",
                [
                    {"content": "L'innovation technologique doit impérativement s'accompagner d'une modération de nos usages.", "is_correct": True, "explanation": "L'auteur insiste sur le fait que les énergies renouvelables ne suffisent pas sans sobriété des usages."},
                    {"content": "Les énergies renouvelables sont inefficaces pour lutter contre le réchauffement.", "is_correct": False, "misconception_type": "contradiction", "explanation": "L'auteur dit qu'elles sont indispensables ('pilier indiscutable')."},
                    {"content": "Seule une politique d'isolation thermique permettra d'atteindre les objectifs climatiques.", "is_correct": False, "misconception_type": "overgeneralization", "explanation": "L'isolation est un exemple parmi d'autres de sobriété."},
                    {"content": "La population refuse catégoriquement d'adapter ses habitudes de transport.", "is_correct": False, "misconception_type": "unjustified_inference", "explanation": "Rien n'indique un refus catégorique de la population."},
                ],
            ),
            "C1": (
                "L'intelligence artificielle et l'illusion de la neutralité algorithmique",
                (
                    "Loin d'incarner une rationalité mathématique exempte de biais, les systèmes algorithmiques reflètent inévitablement les préjugés et les asymétries inhérents à leurs données d'apprentissage. "
                    "Dès lors, sacraliser l'objectivité des modèles prédictifs revient à occulter les choix éthiques et politiques sous-jacents à leur conception."
                ),
                "Quelle critique fondamentale ce texte formule-t-il à l'égard de l'utilisation des algorithmes ?",
                [
                    {"content": "Attribuer une impartialité naturelle aux algorithmes masque les partis pris humains incorporés dans leur conception.", "is_correct": True, "explanation": "Synthèse fidèle du texte."},
                    {"content": "Les modèles prédictifs s'avèrent incapables de traiter des volumes massifs d'informations.", "is_correct": False, "misconception_type": "extrapolation", "explanation": "Le volume de données n'est pas le sujet du texte."},
                    {"content": "Les développeurs conçoivent volontairement des outils biaisés pour influencer les choix des utilisateurs.", "is_correct": False, "misconception_type": "unjustified_inference", "explanation": "Le texte parle de préjugés inhérents aux données, pas d'une malveillance volontaire."},
                    {"content": "L'abandon des mathématiques dans les modèles prédictifs altère leur fonctionnement logique.", "is_correct": False, "misconception_type": "contradiction", "explanation": "Les modèles reposent sur les mathématiques."},
                ],
            ),
            "C2": (
                "De la caducité programmée des certitudes historiographiques",
                (
                    "L'appréhension critique des sources primaires requiert une défiance constante à l'endroit des récits hagiographiques canonisés. "
                    "L'historien ne saurait se contenter d'exhumer des témoignages; il lui incombe d'en déconstruire la téléologie implicite pour en restituer la contingence originale."
                ),
                "Quel est l'impératif méthodologique assigné à la recherche historique selon l'auteur ?",
                [
                    {"content": "Interroger la finalité sous-jacente des récits établis pour en révéler le caractère circonstanciel.", "is_correct": True, "explanation": "Traduit fidèlement l'impératif de déconstruire la téléologie et restituer la contingence."},
                    {"content": "Privilégier la tradition orale aux dépends de l'analyse des archives écrites.", "is_correct": False, "misconception_type": "contradiction", "explanation": "Contredit le texte."},
                    {"content": "Considérer les récits mémoriels canonisés comme des vérités immuables.", "is_correct": False, "misconception_type": "contradiction", "explanation": "Le texte exige au contraire une défiance constante."},
                    {"content": "Limiter la recherche à l'accumulation passive de documents d'époque.", "is_correct": False, "misconception_type": "contradiction", "explanation": "L'auteur dit qu'il ne saurait se contenter d'exhumer des témoignages."},
                ],
            ),
        }

        default_sample = sample_stimuli.get(cefr, sample_stimuli["B2"])

        if task_type_code == "sentence_gap" or not spec.requires_stimulus:
            title = None
            content = None
            prompt = "Malgré les intempéries survenues durant la nuit, l'équipe municipale a réussi à ______ l'accès au centre-ville."
            options = [
                {"content": "rétablir", "is_correct": True, "explanation": "Forme verbale à l'infinitif régie par la préposition 'à'."},
                {"content": "rétabli", "is_correct": False, "misconception_type": "morphosyntax", "distractor_rationale": "Participe passé erroné après préposition."},
                {"content": "rétablira", "is_correct": False, "misconception_type": "morphosyntax", "distractor_rationale": "Futur conjugué erroné après préposition."},
                {"content": "rétablissant", "is_correct": False, "misconception_type": "morphosyntax", "distractor_rationale": "Participe présent erroné après préposition."},
            ]
        elif task_type_code == "document_matching":
            title = "Offres de formation et d'ateliers professionnels"
            content = (
                "### Document A : Atelier d'artisanat du bois\n"
                "Initiation aux techniques traditionnelles d'ébénisterie tous les samedis matin de 9h à 12h.\n\n"
                "### Document B : Séminaire de communication numérique\n"
                "Formation intensive en marketing digital et gestion des réseaux sociaux le vendredi soir de 18h30 à 21h30.\n\n"
                "### Document C : Stage de cuisine du terroir\n"
                "Cours pratiques de gastronomie régionale et dégustation de produits bio en semaine.\n\n"
                "### Document D : Programme de perfectionnement comptable\n"
                "Actualisation des normes fiscales pour entrepreneurs et indépendants chaque mardi en visioconférence."
            )
            prompt = "Léa souhaite développer ses compétences professionnelles en stratégie numérique en soirée."
            options = [
                {"content": "Document A", "is_correct": False, "misconception_type": "content_mismatch", "distractor_rationale": "Atelier bois le samedi matin."},
                {"content": "Document B", "is_correct": True, "explanation": "Marketing digital et réseaux sociaux le vendredi soir."},
                {"content": "Document C", "is_correct": False, "misconception_type": "content_mismatch", "distractor_rationale": "Cuisine du terroir en semaine."},
                {"content": "Document D", "is_correct": False, "misconception_type": "content_mismatch", "distractor_rationale": "Comptabilité et fiscalité."},
            ]
        elif task_type_code == "graph_matching":
            title = "Enquête mobilité urbaine : Répartition des modes de transport (2020-2025)"
            content = (
                "| Année | Transports en commun (%) | Vélo personnel (%) | Voiture individuelle (%) | Marche à pied (%) |\n"
                "| :--- | :---: | :---: | :---: | :---: |\n"
                "| 2020 | 45% | 8% | 32% | 15% |\n"
                "| 2022 | 48% | 12% | 26% | 14% |\n"
                "| 2024 | 52% | 18% | 17% | 13% |\n"
                "| 2025 | 54% | 21% | 13% | 12% |"
            )
            prompt = "D'après les données présentées dans le tableau, quelle évolution majeure caractérise la période 2020-2025 ?"
            options = [
                {"content": "La part du vélo a plus que doublé tandis que celle de la voiture a chuté de plus de moitié.", "is_correct": True, "explanation": "Vélo passe de 8% à 21%, voiture de 32% à 13%."},
                {"content": "La fréquentation des transports en commun a diminué de manière continue.", "is_correct": False, "misconception_type": "contradiction", "distractor_rationale": "Elle est passée de 45% à 54%."},
                {"content": "La voiture individuelle est restée le mode de déplacement majoritaire.", "is_correct": False, "misconception_type": "contradiction", "distractor_rationale": "Elle est passée à 13%."},
                {"content": "L'usage du vélo a stagné sur toute la période considérée.", "is_correct": False, "misconception_type": "false_fact", "distractor_rationale": "Il a augmenté de 13 points."},
            ]
        elif task_type_code == "text_gap":
            title = "L'essor du télétravail dans les petites communes"
            content = (
                "Autrefois réservé aux grands centres urbains, le travail à distance séduit désormais les zones rurales. "
                "Plusieurs villages ont ainsi créé des tiers-lieux connectés pour accueillir les télétravailleurs. "
                "______ cette transformation dynamise le commerce de proximité, elle soulève aussi la question des infrastructures numériques."
            )
            prompt = "Quel connecteur logique permet de compléter la phrase de manière cohérente ?"
            options = [
                {"content": "Bien que", "is_correct": True, "explanation": "Concession logique articulée avec la nuance qui suit."},
                {"content": "Puisque", "is_correct": False, "misconception_type": "logical_fallacy", "distractor_rationale": "Cause inadaptée au sens concessif."},
                {"content": "C'est pourquoi", "is_correct": False, "misconception_type": "logical_fallacy", "distractor_rationale": "Conséquence inadaptée."},
                {"content": "Afin que", "is_correct": False, "misconception_type": "logical_fallacy", "distractor_rationale": "But inadapté."},
            ]
        elif task_type_code == "short_announcement":
            title = "Message de service : Ligne de métro 4"
            content = (
                "[Sonnerie de gare - Voix féminine calme]\n"
                "'Attention, en raison d'un incident technique sur la voie à la station Châtelet, le trafic est interrompu entre Saint-Germain-des-Prés et Gare du Nord. "
                "La reprise de la circulation est estimée à 18h45. Des bus de substitution sont mis à votre disposition place Saint-Sulpice. "
                "Nous vous prions de nous excuser pour la gêne occasionnée.'"
            )
            prompt = "Que doivent faire les voyageurs pour poursuivre leur trajet vers le nord ?"
            options = [
                {"content": "Emprunter les bus de substitution mis en place place Saint-Sulpice.", "is_correct": True, "explanation": "Indiqué : bus de substitution mis à votre disposition place Saint-Sulpice."},
                {"content": "Attendre la réouverture complète de la ligne avant 17h00.", "is_correct": False, "misconception_type": "false_fact", "distractor_rationale": "Reprise estimée à 18h45."},
                {"content": "Prendre une correspondance directe à la station Châtelet.", "is_correct": False, "misconception_type": "contradiction", "distractor_rationale": "L'incident a lieu précisément à Châtelet."},
                {"content": "Se rendre immédiatement au guichet pour un remboursement.", "is_correct": False, "misconception_type": "extrapolation", "distractor_rationale": "Non mentionné dans le message."},
            ]
        elif task_type_code == "radio_broadcast":
            title = "Chronique environnement : L'agroécologie périurbaine"
            content = (
                "[Générique sonore France Écoute]\n"
                "Journaliste : 'Ce matin, nous partons à la découverte d'une ceinture maraîchère bio implantée à vingt kilomètres de Nantes. "
                "Rencontre avec Thomas Guérin, agronome qui repense les circuits d'approvisionnement courts.'\n"
                "Thomas : 'L'idée n'est pas de produire des quantités industrielles, mais de nourrir durablement 5000 familles avec des variétés anciennes "
                "parfaitement adaptées aux épisodes de sécheresse.'"
            )
            prompt = "Quel objectif prioritaire l'agronome Thomas Guérin assigne-t-il à son projet ?"
            options = [
                {"content": "Approvisionner durablement la population locale avec des cultures résilientes.", "is_correct": True, "explanation": "Nourrir 5000 familles avec des variétés adaptées à la sécheresse."},
                {"content": "Développer une production agro-industrielle intensive pour l'export.", "is_correct": False, "misconception_type": "contradiction", "distractor_rationale": "Il réfute explicitement les quantités industrielles."},
                {"content": "Créer le premier réseau national de distribution automatisé.", "is_correct": False, "misconception_type": "extrapolation", "distractor_rationale": "Non mentionné."},
                {"content": "Remplacer l'ensemble des marchés traditionnels du département.", "is_correct": False, "misconception_type": "overgeneralization", "distractor_rationale": "Projet à dimension locale (5000 familles)."},
            ]
        elif task_type_code == "public_survey":
            title = "Sondage radiophonique : La piétonnisation intégrale du centre-ville"
            content = (
                "[Micro-trottoir diffusé sur Radio Ville]\n\n"
                "Locuteur 1 (Antoine, commerçant) : 'Pour mon magasin, c'est très bénéfique, les piétons s'arrêtent et découvrent ma vitrine avec plaisir.'\n\n"
                "Locuteur 2 (Valérie, automobiliste) : 'Je suis totalement contre. Les détours pour traverser la commune allongent mon trajet quotidien de 25 minutes.'\n\n"
                "Locuteur 3 (Camille, cycliste) : 'L'atmosphère est devenue nettement plus saine et les déplacements avec de jeunes enfants sont enfin sécurisés.'\n\n"
                "Locuteur 4 (Nathalie, riveraine) : 'Tant que les bornes d'accès permettent aux riverains de décharger leurs courses le soir, cela me convient tout à fait.'"
            )
            prompt = "Quel intervenant souligne un bénéfice direct pour son activité commerciale ?"
            options = [
                {"content": "Le locuteur 1", "is_correct": True, "explanation": "Antoine précise que les piétons découvrent sa vitrine et entrent dans sa boutique."},
                {"content": "Le locuteur 2", "is_correct": False, "misconception_type": "content_mismatch", "distractor_rationale": "Valérie est automobiliste et déplore les détours."},
                {"content": "Le locuteur 3", "is_correct": False, "misconception_type": "content_mismatch", "distractor_rationale": "Camille est cycliste et mentionne la santé et la sécurité des enfants."},
                {"content": "Le locuteur 4", "is_correct": False, "misconception_type": "content_mismatch", "distractor_rationale": "Nathalie est riveraine et évoque les courses."},
            ]
        elif task_type_code == "phonological_recognition":
            title = "Discrimination phonétique et intonation"
            content = (
                "[Audio court - 1 locuteur, intonation interrogative montante marquée]\n"
                "'Vous avez déjà validé votre inscription pour le trimestre prochain ?'"
            )
            prompt = "Quelle intention communicative correspond à l'énoncé entendu ?"
            options = [
                {"content": "Une interrogation formulée avec une intonation montante.", "is_correct": True, "explanation": "Hausse mélodique caractéristique de la question polaire."},
                {"content": "Un ordre strict exigeant une exécution immédiate.", "is_correct": False, "misconception_type": "intonation_mismatch", "distractor_rationale": "Pas d'intonation descendante impérative."},
                {"content": "Une simple déclaration affirmative et neutre.", "is_correct": False, "misconception_type": "intonation_mismatch", "distractor_rationale": "Il y a une nette montée intonative en fin de phrase."},
                {"content": "Une hésitation ou un doute non résolu.", "is_correct": False, "misconception_type": "intonation_mismatch", "distractor_rationale": "Énoncé complet et direct."},
            ]
        elif task_type_code == "fait_divers":
            title = "Fait divers : Insolite disparition au musée"
            content = (
                "Dans la nuit de mardi à mercredi, un automate horloger datant du XVIIIe siècle s'est mystérieusement volatilisé "
                "du musée des Beaux-Arts, sans qu'aucune des alarmes ne se soit déclenchée ni qu'aucune issue n'ait été fracturée."
            )
            prompt = "Rédigez la suite de cet événement insolite en racontant le déroulement des faits et leur dénouement au passé (min. 80 mots)."
            options = []
        elif task_type_code == "opinion_letter":
            title = "Débat public : La régulation des trottinettes électriques"
            content = (
                "Face à la prolifération des engins de déplacement motorisés abandonnés sur les trottoirs, "
                "la municipalité organise une consultation citoyenne pour décider du maintien ou du retrait total des opérateurs de location."
            )
            prompt = "Écrivez une lettre argumentée au maire pour exprimer votre point de vue sur cette mesure. Développez deux arguments solides étayés d'exemples précis (min. 200 mots)."
            options = []
        elif task_type_code == "information_gathering":
            title = "Petite annonce : Stage d'initiation au kayak en rivière"
            content = (
                "Club Nautique des Berges : stage découverte pendant les vacances de Pâques. "
                "Groupes de 8 participants maximum, encadrement par un moniteur diplômé d'État. "
                "Matériel de sécurité intégralement fourni. Tarifs préférentiels pour étudiants et demandeurs d'emploi. "
                "Renseignements et réservations au 05 61 22 33 44."
            )
            prompt = "Vous appelez le club nautique pour obtenir des renseignements détaillés. Posez une dizaine de questions précises pour préparer votre inscription (durée : 5 minutes)."
            options = []
        elif task_type_code == "persuasive_argumentation":
            title = "Brochure : Vacances éco-volontariat en refuge de montagne"
            content = (
                "Passez une semaine immersive dans les Pyrénées : aide au balisage des sentiers, participation aux inventaires de la flore "
                "alpine et observation nocturne des constellations en refuge isolé à 2200 mètres d'altitude. "
                "Une expérience humaine inoubliable, conviviale et accessible à tous les marcheurs motivés."
            )
            prompt = "Convainquez un(e) ami(e) réticent(e) de participer avec vous à ce séjour d'éco-volontariat. Présentez les atouts du projet et levez ses doutes (durée : 10 minutes)."
            options = []
        else:
            default_sample = sample_stimuli.get(cefr, sample_stimuli["B2"])
            title = stimulus_title or default_sample[0]
            content = stimulus_content or default_sample[1]
            prompt = default_sample[2]
            options = default_sample[3]

        if candidate_index > 0 and prompt:
            prompt = f"{prompt} (Variante {candidate_index + 1})"

        shaped = cls._shape_simulation_for_format(
            response_type=response_type,
            option_count=option_count,
            spec=spec,
            prompt=prompt,
            options=options,
        )
        options = shaped["options"]
        scoring_payload = shaped["scoring_payload"]

        # For prompt-lead families (writing, speaking) the situation lives inside the
        # prompt itself; there is no separate stimulus document.
        if spec.stimulus_kind == STIMULUS_PROMPT_LEAD:
            if title and content:
                prompt = f"{content}\n\n{prompt}"
            title = None
            content = None

        # Granular Multi-Tagging (up to 2 skills per dimension: 1 Primary at 0.75 + 1 Secondary at 0.25)
        reasoning_skills = [s for s in allowed_skills if getattr(s.dimension, "value", str(s.dimension)) == "reasoning"]
        language_skills = [s for s in allowed_skills if getattr(s.dimension, "value", str(s.dimension)) == "language"]

        skill_mappings_payload = []
        if len(reasoning_skills) >= 2:
            skill_mappings_payload.append({"skill_id": str(reasoning_skills[0].id), "role": "primary", "weight": 0.75})
            skill_mappings_payload.append({"skill_id": str(reasoning_skills[1].id), "role": "secondary", "weight": 0.25})
        elif len(reasoning_skills) == 1:
            skill_mappings_payload.append({"skill_id": str(reasoning_skills[0].id), "role": "primary", "weight": 1.0})

        if len(language_skills) >= 2:
            skill_mappings_payload.append({"skill_id": str(language_skills[0].id), "role": "primary", "weight": 0.75})
            skill_mappings_payload.append({"skill_id": str(language_skills[1].id), "role": "secondary", "weight": 0.25})
        elif len(language_skills) == 1:
            skill_mappings_payload.append({"skill_id": str(language_skills[0].id), "role": "primary", "weight": 1.0})

        if not skill_mappings_payload and allowed_skills:
            skill_mappings_payload.append({"skill_id": str(allowed_skills[0].id), "role": "primary", "weight": 1.0})

        return {
            "stimulus_title": title,
            "stimulus_content": content,
            "source_attribution": request.source_attribution or "Revue des Études Francophones",
            "prompt": prompt,
            "instructions": shaped["instructions"] or cls._default_instructions_for(response_type),
            "target_cefr": cefr,
            "cognitive_complexity": request.cognitive_complexity or CognitiveComplexityLevel.INTERPRETATION.value,
            "explanation": (
                "La bonne réponse découle directement de l'analyse du support. "
                "Les autres propositions constituent des extrapolations ou des contresens fréquents."
            ),
            "options": options,
            "scoring_payload": scoring_payload,
            "skill_mappings": skill_mappings_payload,
        }

    @classmethod
    def _shape_simulation_for_format(
        cls,
        response_type: str,
        option_count: int | None,
        spec: TaskFormatSpec,
        prompt: str,
        options: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Convert a hand-written sample into the exact shape the target format requires."""
        is_choice = response_type in (
            QuestionResponseType.SINGLE_CHOICE.value,
            QuestionResponseType.MULTIPLE_CHOICE.value,
        )

        if is_choice:
            n = option_count or (spec.option_count[1] if spec.option_count else 4)
            shaped_options = cls._resize_choice_options(options, n, response_type)
            return {"options": shaped_options, "scoring_payload": None, "instructions": None}

        if response_type == QuestionResponseType.MATCHING.value:
            n = option_count or (spec.option_count[1] if spec.option_count else 4)
            # Use the sample options as targets when they look like a matching bank,
            # otherwise synthesise a four-document bank.
            targets = [
                {"id": f"doc_{chr(ord('a') + i)}", "text": f"Document {chr(ord('A') + i)}"}
                for i in range(n)
            ]
            sources = [
                {"id": f"besoin_{i + 1}", "text": f"Besoin {i + 1} : {opt.get('content', '')}"}
                for i, opt in enumerate(options[:n])
            ] or [{"id": "besoin_1", "text": "Besoin décrit dans la consigne"}]
            pairs = [
                {"source_id": src["id"], "target_id": targets[i % len(targets)]["id"]}
                for i, src in enumerate(sources)
            ]
            return {
                "options": [],
                "scoring_payload": {"sources": sources, "targets": targets, "pairs": pairs},
                "instructions": "Associez chaque besoin au document correspondant.",
            }

        if response_type == QuestionResponseType.ORDERING.value:
            n = option_count or (spec.option_count[1] if spec.option_count else 5)
            items = [
                {"id": f"seg_{i + 1}", "text": opt.get("content", f"Segment {i + 1}")}
                for i, opt in enumerate(options[:n])
            ] or [
                {"id": f"seg_{i + 1}", "text": f"Segment {i + 1} du recit"} for i in range(n)
            ]
            sequence = [it["id"] for it in items]
            return {
                "options": [],
                "scoring_payload": {"items": items, "sequence": sequence, "partial_credit": True},
                "instructions": "Remettez les elements dans l'ordre logique.",
            }

        if response_type == QuestionResponseType.GAP_FILL.value:
            correct = next(
                (o.get("content", "") for o in options if o.get("is_correct")),
                "cependant",
            )
            alternatives = [
                o.get("content", "") for o in options if not o.get("is_correct") and o.get("content")
            ]
            return {
                "options": [],
                "scoring_payload": {
                    "gaps": [
                        {
                            "index": 1,
                            "accepted_answers": [correct, *alternatives],
                            "ignore_case": True,
                            "ignore_accents": True,
                        }
                    ]
                },
                "instructions": "Completez le blanc avec le connecteur adapte.",
            }

        if response_type == QuestionResponseType.SHORT_TEXT.value:
            correct = next(
                (o.get("content", "") for o in options if o.get("is_correct")),
                "la reformulation attendue",
            )
            return {
                "options": [],
                "scoring_payload": {
                    "accepted_answers": [correct],
                    "ignore_case": True,
                    "ignore_accents": True,
                },
                "instructions": "Reformulez l'information demandee en une phrase.",
            }

        return {
            "options": [],
            "scoring_payload": {
                "rubric": [
                    "Respect de la consigne et complétude de la production",
                    "Organisation et cohérence du propos",
                    "Richesse et correction de la langue",
                ],
                "expected_duration_seconds": 300 if response_type == "long_text" else 600,
            },
            "instructions": None,
        }

    @staticmethod
    def _resize_choice_options(
        options: list[dict[str, Any]], target_count: int, response_type: str
    ) -> list[dict[str, Any]]:
        """Pad or trim simulated options to the requested count, keeping the correct key intact."""
        if not options:
            return []
        correct = [o for o in options if o.get("is_correct")]
        distractors = [o for o in options if not o.get("is_correct")]

        minimum_correct = 1 if response_type == QuestionResponseType.SINGLE_CHOICE.value else 2
        if len(correct) < minimum_correct and distractors:
            # Promote enough distractors to satisfy the multi-select minimum.
            for extra in distractors[: minimum_correct - len(correct)]:
                correct.append(extra)
                distractors.remove(extra)

        keep_correct = correct[:target_count]
        keep_distractors = distractors[: max(0, target_count - len(keep_correct))]
        result = [*keep_correct, *keep_distractors]
        return result[:target_count]

    @staticmethod
    def _default_instructions_for(response_type: str) -> str:
        """Human-readable candidate instruction per response type."""
        mapping = {
            QuestionResponseType.SINGLE_CHOICE.value: "Lisez le document puis choisissez la reponse correcte.",
            QuestionResponseType.MULTIPLE_CHOICE.value: "Lisez le document puis selectionnez toutes les reponses exactes.",
            QuestionResponseType.MATCHING.value: "Associez chaque element a son correspondant.",
            QuestionResponseType.ORDERING.value: "Remettez les elements dans l'ordre logique.",
            QuestionResponseType.GAP_FILL.value: "Completez le blanc avec le terme adapte.",
            QuestionResponseType.SHORT_TEXT.value: "Redigez une reponse courte et exacte.",
            QuestionResponseType.LONG_TEXT.value: "Redigez votre production complete en respectant la consigne.",
            QuestionResponseType.SPOKEN_RESPONSE.value: "Produisez votre intervention orale en respectant la consigne.",
        }
        return mapping.get(response_type, "Repondez a la consigne.")
