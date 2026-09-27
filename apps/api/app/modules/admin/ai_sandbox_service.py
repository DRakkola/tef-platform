"""Service layer for AI Sandbox & Benchmarking Studio."""

import json
import time
import uuid
from typing import Any

import httpx
import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import AppException
from app.modules.admin.ai_sandbox_models import AIPromptTemplate, AISandboxRun
from app.modules.admin.ai_sandbox_schemas import (
    AIPromptTemplateCreate,
    AIPromptTemplateUpdate,
    BenchmarkSample,
    RawPromptTestRequest,
    RawPromptTestResponse,
    SpeakingEvaluationTestRequest,
    SpeakingEvaluationTestResult,
    SpeakingTurnTestRequest,
    SpeakingTurnTestResponse,
    WritingCriteriaBreakdown,
    WritingErrorSpan,
    WritingTestResult,
    WritingTestRunRequest,
)
from app.modules.admin.speaking_config_schemas import (
    SpeakingExaminerConfigResponse,
    SpeakingExaminerConfigUpdateRequest,
)
from app.modules.admin.speaking_scenario_models import SpeakingScenario
from app.modules.admin.speaking_scenario_schemas import (
    SpeakingScenarioCreateRequest,
    SpeakingScenarioUpdateRequest,
)
from app.modules.writing.models import WritingSubmission

logger = structlog.get_logger("tef-api.ai_sandbox")

# Pre-defined curated benchmark datasets for TEF testing
CURATED_BENCHMARKS: list[BenchmarkSample] = [
    BenchmarkSample(
        id="bench-writing-sec-b-b2",
        title="Section B — Interdiction des voitures en centre-ville (Niveau B2)",
        feature_type="writing",
        section="section_b",
        cefr_level="B2",
        task_prompt=(
            "Vous avez lu dans un journal que la mairie envisage d'interdire totalement les voitures dans le centre-ville. "
            "Écrivez une lettre au courrier des lecteurs pour exprimer votre point de vue argumenté sur ce projet (environ 200 mots)."
        ),
        sample_content=(
            "Monsieur le Rédacteur en chef,\n\n"
            "Je me permets de vous écrire suite à la parution de votre article concernant l'éventuelle fermeture du centre-ville aux automobiles. "
            "En tant que résident et cycliste régulier, je soutiens vivement cette initiative qui me semble indispensable pour notre cadre de vie.\n\n"
            "Tout d'abord, cette décision permettra de réduire de manière significative la pollution atmosphérique ainsi que les nuisances sonores, "
            "deux fléaux qui empoisonnent le quotidien des citadins. Ensuite, la pacification des rues stimulera indéniablement le commerce local, "
            "car les piétons ont tendance à flâner et à fréquenter davantage les boutiques de proximité lorsque l'espace est sécurisé et agréable.\n\n"
            "Néanmoins, pour que cette transition soit véritablement couronnée de succès, la municipalité se doit de renforcer impérativement "
            "les réseaux de transports en commun en périphérie et d'aménager des parcs relais abordables. Sans ces mesures d'accompagnement, "
            "les habitants des zones rurales environnantes risqueraient de se sentir injustement pénalisés.\n\n"
            "En espérant que mon témoignage enrichira le débat citoyen, je vous prie d'agréer mes salutations distinguées."
        ),
        description="Production d'un candidat de bon niveau B2, bien structurée avec connecteurs logiques et registre formel adéquat.",
        expected_score_range="480 - 520 pts (B2)",
    ),
    BenchmarkSample(
        id="bench-writing-sec-b-b1",
        title="Section B — Télétravail obligatoire (Niveau B1)",
        feature_type="writing",
        section="section_b",
        cefr_level="B1",
        task_prompt=(
            "Votre entreprise propose de rendre le télétravail obligatoire 3 jours par semaine. "
            "Écrivez un courriel à votre responsable pour donner votre avis sur cette mesure (environ 200 mots)."
        ),
        sample_content=(
            "Bonjour Monsieur le Directeur,\n\n"
            "Je vous écrit ce message pour donner mon avis sur la proposition de télétravail trois jours par semaine. "
            "C'est une bonne idée pour beaucoup de travailleurs parce que on gagne du temps avec les transports.\n\n"
            "Pour moi, ne pas prendre le train le matin me donne moins de stress et je peux commencer à travailler plus tôt. "
            "Aussi, je peux me concentrer très bien à la maison sans le bruit du bureau.\n\n"
            "Mais il y a aussi des inconvénients. Par exemple, c'est difficile de communiquer avec mes collègues par écran tout le temps. "
            "Parfois pour les réunions urgentes, c'est plus simple quand on est ensemble dans la même salle.\n\n"
            "Je pense donc qu'il faut laisser le choix aux employés au lieu de faire une règle obligatoire pour tout le monde.\n\n"
            "Merci pour votre écoute,\nCordialement."
        ),
        description="Production de niveau B1 avec syntaxe correcte mais vocabulaire simple et quelques maladresses d'accord.",
        expected_score_range="380 - 420 pts (B1)",
    ),
    BenchmarkSample(
        id="bench-writing-sec-a-a2",
        title="Section A — Récit d'un voyage insolite (Niveau A2)",
        feature_type="writing",
        section="section_a",
        cefr_level="A2",
        task_prompt="Racontez le début d'un voyage qui ne s'est pas passé comme prévu pour le journal local (environ 80 mots).",
        sample_content=(
            "Le week-end dernier, je suis parti à Lyon avec mon ami en voiture. Tout était bien au départ. "
            "Mais après 50 kilomètres, la voiture fait un grand bruit bizarre et elle s'arrête sur l'autoroute. "
            "Il pleuvait beaucoup et mon téléphone n'avait pas de batterie. Heureusement, un monsieur très gentil a appelé la dépanneuse. "
            "Nous sommes arrivés à l'hôtel à minuit, très fatigués !"
        ),
        description="Fait divers court de niveau A2 avec narration chronologique simple au passé composé et présent.",
        expected_score_range="260 - 320 pts (A2)",
    ),
    BenchmarkSample(
        id="bench-speaking-sec-a-cours-cuisine",
        title="Section A Oral — Renseignements pour un atelier culinaire",
        feature_type="speaking",
        section="section_a",
        cefr_level="B2",
        task_prompt="Vous avez vu une annonce pour des cours de cuisine du monde. Posez des questions précises sur le déroulement, les ingrédients et les tarifs.",
        sample_content="Bonjour, je vous appelle suite à votre annonce pour les cours de cuisine. Pourriez-vous m'indiquer la fréquence des séances et si le matériel est fourni ?",
        description="Prise d'information formelle. L'examinateur doit répondre poliment et concise au candidat (vouvoiement strict).",
        expected_score_range="Simulation interactive (10 questions attendues)",
    ),
    BenchmarkSample(
        id="bench-speaking-sec-b-voyage-velo",
        title="Section B Oral — Convaincre un ami de faire un voyage à vélo",
        feature_type="speaking",
        section="section_b",
        cefr_level="B2",
        task_prompt="Vous voulez convaincre votre ami(e) réticent(e) de partir une semaine faire du cyclotourisme en Bretagne avec vous.",
        sample_content="Salut ! Écoute, j'ai vu un itinéraire incroyable le long du canal en Bretagne pour les vacances. Il faut absolument qu'on le fasse ensemble à vélo !",
        description="Argumentation amicale. L'examinateur joue un ami dubitatif et formule des objections progressives (tutoiement strict).",
        expected_score_range="Simulation interactive (défense d'arguments)",
    ),
]


class AISandboxService:
    """Core execution, persistence, and benchmark service for Admin AI Sandbox."""

    # ---------------------------------------------------------------------------
    # System Prompt Templates CRUD
    # ---------------------------------------------------------------------------
    @staticmethod
    async def list_templates(
        db: AsyncSession,
        feature_type: str | None = None,
    ) -> list[AIPromptTemplate]:
        stmt = select(AIPromptTemplate).order_by(AIPromptTemplate.name.asc())
        if feature_type:
            stmt = stmt.where(AIPromptTemplate.feature_type == feature_type)
        res = await db.execute(stmt)
        templates = list(res.scalars().all())

        # If empty, auto-seed system presets
        if not templates:
            await AISandboxService.seed_system_templates(db)
            res = await db.execute(stmt)
            templates = list(res.scalars().all())

        return templates

    @staticmethod
    async def get_template(db: AsyncSession, template_id: uuid.UUID) -> AIPromptTemplate:
        template = await db.get(AIPromptTemplate, template_id)
        if not template:
            raise AppException(message="Prompt template not found", code="TEMPLATE_NOT_FOUND", status_code=404)
        return template

    @staticmethod
    async def create_template(
        db: AsyncSession,
        data: AIPromptTemplateCreate,
        user_id: uuid.UUID | None,
    ) -> AIPromptTemplate:
        template = AIPromptTemplate(
            name=data.name,
            description=data.description,
            feature_type=data.feature_type,
            system_prompt=data.system_prompt,
            user_prompt_template=data.user_prompt_template,
            default_model=data.default_model,
            default_temperature=data.default_temperature,
            is_system_preset=False,
            created_by_id=user_id,
        )
        db.add(template)
        await db.commit()
        await db.refresh(template)
        return template

    @staticmethod
    async def update_template(
        db: AsyncSession,
        template_id: uuid.UUID,
        data: AIPromptTemplateUpdate,
    ) -> AIPromptTemplate:
        template = await AISandboxService.get_template(db, template_id)
        if template.is_system_preset:
            raise AppException(
                message="System preset templates cannot be edited directly. Clone or create a custom template.",
                code="SYSTEM_PRESET_IMMUTABLE",
                status_code=400,
            )

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(template, key, value)

        await db.commit()
        await db.refresh(template)
        return template

    @staticmethod
    async def delete_template(db: AsyncSession, template_id: uuid.UUID) -> None:
        template = await AISandboxService.get_template(db, template_id)
        if template.is_system_preset:
            raise AppException(
                message="System preset templates cannot be deleted.",
                code="SYSTEM_PRESET_IMMUTABLE",
                status_code=400,
            )
        await db.delete(template)
        await db.commit()

    @staticmethod
    async def seed_system_templates(db: AsyncSession) -> None:
        """Seed baseline TEF system prompt presets."""
        presets = [
            AIPromptTemplate(
                name="Correcteur TEF Écrit — Standard B2/C1",
                description="Prompt officiel d'évaluation de la production écrite selon les 4 critères CECRL du TEF.",
                feature_type="writing",
                system_prompt="""Tu es un examinateur expert et officiel du TEF (Test d'Évaluation de Français) pour l'épreuve d'expression écrite.
Ta mission est d'évaluer la production du candidat avec une rigueur absolue selon les normes de la Chambre de Commerce et d'Industrie de Paris (CCIP / Le français des affaires).

Grille d'évaluation :
1. Respect de la consigne et volume attendu (0-25)
2. Cohérence textuelle et connecteurs logiques (0-25)
3. Richesse lexicale et précision du vocabulaire (0-25)
4. Correction grammaticale, syntaxe et orthographe (0-25)

Réponds impérativement au format JSON structuré avec :
- score (0-100), tef_points (0-698), cefr_level (A1-C2)
- criteria (task_completion, coherence_cohesion, vocabulary_range_accuracy, grammatical_range_accuracy)
- strengths, weaknesses, errors (avec error_text, start_index, end_index, error_type, suggestion, explanation)
- corrected_text, recommendations, overall_feedback.""",
                default_model="models/gemini-3.5-flash",
                default_temperature=0.3,
                is_system_preset=True,
            ),
            AIPromptTemplate(
                name="Examinateur TEF Oral — Section A (Renseignements formels)",
                description="Examinateur virtuel pour la prise d'information (10 questions du candidat, vouvoiement strict).",
                feature_type="speaking",
                system_prompt="""Tu incarnes l'interlocuteur officiel du TEF pour la Section A : « Prise d'information formelle ».
Consignes strictes :
- Tu représentes l'organisme ou le professionnel décrit dans l'annonce.
- Tu t'adresses au candidat en utilisant IMPÉRATIVEMENT le vouvoiement formel (« vous »).
- Tes réponses sont concises (1 à 3 phrases claires) pour laisser le candidat poser au moins 10 questions.
- Si le candidat hésite ou s'arrête, relance-le poliment : « Avez-vous d'autres questions sur nos tarifs ou nos horaires ? ».""",
                default_model="models/gemini-3.5-flash",
                default_temperature=0.6,
                is_system_preset=True,
            ),
            AIPromptTemplate(
                name="Examinateur TEF Oral — Section B (Argumentation amicale)",
                description="Examinateur virtuel ami/collègue à convaincre (tutoiement strict, objections bienveillantes).",
                feature_type="speaking",
                system_prompt="""Tu incarnes l'ami ou le collègue du candidat au TEF pour la Section B : « Argumentation et persuasion ».
Consignes strictes :
- Tu t'adresses au candidat en utilisant IMPÉRATIVEMENT le tutoiement (« tu »).
- Ton ton est familier, spontané et expressif.
- Au début, tu es réticent ou sceptique face à la proposition du candidat.
- Pose des objections réalistes : « Mais ça coûte combien ? », « Je n'ai pas le temps ce week-end », « Est-ce que c'est vraiment sûr ? ».
- Laisse-toi progressivement convaincre si les arguments sont solides et bien formulés.""",
                default_model="models/gemini-3.5-flash",
                default_temperature=0.7,
                is_system_preset=True,
            ),
            AIPromptTemplate(
                name="Terrain d'Essai Prompt Libre (Raw Playground)",
                description="Configuration neutre pour tester des prompts et observer la tokenométrie.",
                feature_type="raw",
                system_prompt="Tu es un assistant linguistique francophone spécialisé dans la préparation aux examens de français.",
                default_model="models/gemini-3.5-flash",
                default_temperature=0.7,
                is_system_preset=True,
            ),
        ]
        db.add_all(presets)
        await db.commit()

    # ---------------------------------------------------------------------------
    # Writing Sandbox Evaluation
    # ---------------------------------------------------------------------------
    @staticmethod
    async def run_writing_test(
        db: AsyncSession,
        request: WritingTestRunRequest,
        user_id: uuid.UUID | None,
    ) -> tuple[WritingTestResult, AISandboxRun]:
        start_time = time.perf_counter()

        system_prompt = request.system_prompt
        if not system_prompt and request.template_id:
            tpl = await db.get(AIPromptTemplate, request.template_id)
            if tpl:
                system_prompt = tpl.system_prompt

        if not system_prompt:
            system_prompt = "Tu es un examinateur expert officiel du TEF pour l'épreuve d'expression écrite."

        user_prompt = (
            f"Consigne du sujet ({request.section}) :\n{request.task_prompt}\n\n"
            f"Niveau visé : {request.target_level}\n\n"
            f"Texte du candidat :\n{request.student_draft}"
        )

        api_key = request.api_key_override or settings.GEMINI_API_KEY
        use_simulation = request.force_simulation or not api_key

        parsed_result: WritingTestResult
        raw_output_text: str
        prompt_tokens = len(user_prompt.split()) + len(system_prompt.split())
        completion_tokens = 0

        if not use_simulation and api_key:
            try:
                raw_output_text, prompt_tokens, completion_tokens = await AISandboxService._call_gemini_api(
                    api_key=api_key,
                    model=request.model,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=request.temperature,
                )
                parsed_dict = AISandboxService._parse_json_or_fallback(raw_output_text)
                parsed_result = AISandboxService._construct_writing_result(parsed_dict, request.student_draft)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Gemini API call failed in writing sandbox, falling back to simulation", error=str(exc))
                raw_output_text, parsed_result = AISandboxService._simulate_writing_evaluation(
                    request.task_prompt, request.student_draft, request.target_level, request.section
                )
                use_simulation = True
                completion_tokens = 320
        else:
            raw_output_text, parsed_result = AISandboxService._simulate_writing_evaluation(
                request.task_prompt, request.student_draft, request.target_level, request.section
            )
            completion_tokens = 320

        latency_ms = int((time.perf_counter() - start_time) * 1000)
        total_tokens = prompt_tokens + completion_tokens
        cost_usd = (prompt_tokens * 0.075 / 1_000_000) + (completion_tokens * 0.30 / 1_000_000)

        # Persist run in PostgreSQL
        run_record = AISandboxRun(
            feature_type="writing",
            template_id=request.template_id,
            model=request.model,
            temperature=request.temperature,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            input_context={
                "section": request.section,
                "target_level": request.target_level,
                "draft_length": len(request.student_draft),
                "word_count": len(request.student_draft.split()),
            },
            raw_output=raw_output_text,
            parsed_result=parsed_result.model_dump(),
            latency_ms=latency_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=round(cost_usd, 6),
            is_simulation=use_simulation,
            created_by_id=user_id,
        )
        db.add(run_record)
        await db.commit()
        await db.refresh(run_record)

        return parsed_result, run_record

    # ---------------------------------------------------------------------------
    # Speaking Sandbox Turn & Evaluation
    # ---------------------------------------------------------------------------
    @staticmethod
    async def run_speaking_turn_test(
        db: AsyncSession,
        request: SpeakingTurnTestRequest,
        user_id: uuid.UUID | None,
    ) -> tuple[SpeakingTurnTestResponse, AISandboxRun]:
        start_time = time.perf_counter()

        system_prompt = request.system_prompt
        if not system_prompt and request.template_id:
            tpl = await db.get(AIPromptTemplate, request.template_id)
            if tpl:
                system_prompt = tpl.system_prompt

        if not system_prompt:
            is_sec_a = request.section == "section_a"
            pronoun = "vous" if is_sec_a else "tu"
            tone = "professionnel et courtois" if is_sec_a else "amical et familier"
            system_prompt = (
                f"Tu es l'examinateur virtuel pour le TEF Oral ({request.section.upper()}). "
                f"Utilise impérativement le {pronoun} avec un ton {tone}. "
                f"Réponds en 1 à 3 phrases concises. Sujet : {request.topic}."
            )

        history_context = "\n".join(
            f"{m.role.upper()} : {m.content}" for m in request.dialogue_history
        )
        user_prompt = f"Historique de l'échange :\n{history_context}\n\nCANDIDAT : {request.candidate_message}\n\nEXAMINATEUR :"

        api_key = request.api_key_override or settings.GEMINI_API_KEY
        use_simulation = request.force_simulation or not api_key

        examiner_reply: str
        prompt_tokens = len(user_prompt.split()) + len(system_prompt.split())
        completion_tokens = 0

        if not use_simulation and api_key:
            try:
                raw_text, prompt_tokens, completion_tokens = await AISandboxService._call_gemini_api(
                    api_key=api_key,
                    model=request.model,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=request.temperature,
                )
                examiner_reply = raw_text.strip()
            except Exception as exc:  # noqa: BLE001
                logger.warning("Gemini API call failed in speaking turn, falling back to simulation", error=str(exc))
                examiner_reply = AISandboxService._simulate_speaking_reply(
                    request.section, request.candidate_message, len(request.dialogue_history)
                )
                use_simulation = True
                completion_tokens = 45
        else:
            examiner_reply = AISandboxService._simulate_speaking_reply(
                request.section, request.candidate_message, len(request.dialogue_history)
            )
            completion_tokens = 45

        latency_ms = int((time.perf_counter() - start_time) * 1000)
        total_tokens = prompt_tokens + completion_tokens
        cost_usd = (prompt_tokens * 0.075 / 1_000_000) + (completion_tokens * 0.30 / 1_000_000)

        response = SpeakingTurnTestResponse(
            examiner_reply=examiner_reply,
            latency_ms=latency_ms,
            tokens_used=total_tokens,
            is_simulation=use_simulation,
            notes=f"Rôle : {request.section.upper()} — Niveau visé {request.target_level}",
        )

        run_record = AISandboxRun(
            feature_type="speaking",
            template_id=request.template_id,
            model=request.model,
            temperature=request.temperature,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            input_context={
                "section": request.section,
                "topic": request.topic,
                "target_level": request.target_level,
                "history_turns": len(request.dialogue_history),
            },
            raw_output=examiner_reply,
            parsed_result={"examiner_reply": examiner_reply},
            latency_ms=latency_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=round(cost_usd, 6),
            is_simulation=use_simulation,
            created_by_id=user_id,
        )
        db.add(run_record)
        await db.commit()
        await db.refresh(run_record)

        return response, run_record

    @staticmethod
    async def run_speaking_evaluation_test(
        db: AsyncSession,
        request: SpeakingEvaluationTestRequest,
        user_id: uuid.UUID | None,
    ) -> tuple[SpeakingEvaluationTestResult, AISandboxRun]:
        start_time = time.perf_counter()

        system_prompt = request.system_prompt or (
            "Tu es un évaluateur officiel TEF Expression Orale. Évalue cette retranscription d'échange d'examen. "
            "Fournis une note sur 698, le niveau CECRL (A1-C2), la répartition selon les 4 critères officiels, "
            "les forces, faiblesses et recommandations au format JSON."
        )
        user_prompt = f"Sujet : {request.topic}\nNiveau visé : {request.target_level}\n\nTranscription :\n{request.transcription}"

        api_key = request.api_key_override or settings.GEMINI_API_KEY
        use_simulation = request.force_simulation or not api_key

        eval_result: SpeakingEvaluationTestResult
        raw_output_text: str
        prompt_tokens = len(user_prompt.split()) + len(system_prompt.split())
        completion_tokens = 0

        if not use_simulation and api_key:
            try:
                eval_model = settings.GEMINI_EVAL_MODEL if "live" in request.model.lower() else request.model
                raw_output_text, prompt_tokens, completion_tokens = await AISandboxService._call_gemini_api(
                    api_key=api_key,
                    model=eval_model,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=request.temperature,
                )
                parsed = AISandboxService._parse_json_or_fallback(raw_output_text)
                eval_result = SpeakingEvaluationTestResult(
                    tef_points=int(parsed.get("tef_points", 480)),
                    cefr_level=str(parsed.get("cefr_level", "B2")),
                    score=float(parsed.get("score", 70.0)),
                    pronunciation_fluency=float(parsed.get("pronunciation_fluency", 17.5)),
                    lexical_resource=float(parsed.get("lexical_resource", 18.0)),
                    grammatical_accuracy=float(parsed.get("grammatical_accuracy", 17.0)),
                    interaction_coherence=float(parsed.get("interaction_coherence", 18.5)),
                    strengths=list(parsed.get("strengths", ["Bonne interaction", "Débit naturel"])),
                    weaknesses=list(parsed.get("weaknesses", ["Quelques hésitations sur les accords complexes"])),
                    recommendations=list(parsed.get("recommendations", ["Pratiquer les questions inversées en registre soutenu"])),
                    examiner_feedback=str(parsed.get("examiner_feedback", "Prestation satisfaisante pour le niveau B2.")),
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Gemini speaking evaluation failed, falling back to simulation", error=str(exc))
                raw_output_text, eval_result = AISandboxService._simulate_speaking_evaluation(
                    request.topic, request.transcription, request.target_level
                )
                use_simulation = True
                completion_tokens = 250
        else:
            raw_output_text, eval_result = AISandboxService._simulate_speaking_evaluation(
                request.topic, request.transcription, request.target_level
            )
            completion_tokens = 250

        latency_ms = int((time.perf_counter() - start_time) * 1000)
        total_tokens = prompt_tokens + completion_tokens
        cost_usd = (prompt_tokens * 0.075 / 1_000_000) + (completion_tokens * 0.30 / 1_000_000)

        run_record = AISandboxRun(
            feature_type="speaking",
            template_id=request.template_id,
            model=request.model,
            temperature=request.temperature,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            input_context={
                "section": request.section,
                "topic": request.topic,
                "target_level": request.target_level,
                "transcription_words": len(request.transcription.split()),
            },
            raw_output=raw_output_text,
            parsed_result=eval_result.model_dump(),
            latency_ms=latency_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=round(cost_usd, 6),
            is_simulation=use_simulation,
            created_by_id=user_id,
        )
        db.add(run_record)
        await db.commit()
        await db.refresh(run_record)

        return eval_result, run_record

    # ---------------------------------------------------------------------------
    # Raw Prompt Lab Execution
    # ---------------------------------------------------------------------------
    @staticmethod
    async def run_raw_prompt_test(
        db: AsyncSession,
        request: RawPromptTestRequest,
        user_id: uuid.UUID | None,
    ) -> tuple[RawPromptTestResponse, AISandboxRun]:
        start_time = time.perf_counter()
        api_key = request.api_key_override or settings.GEMINI_API_KEY
        use_simulation = request.force_simulation or not api_key

        output_text: str
        prompt_tokens = len(request.user_prompt.split()) + len(request.system_prompt.split())
        completion_tokens = 0

        if not use_simulation and api_key:
            try:
                output_text, prompt_tokens, completion_tokens = await AISandboxService._call_gemini_api(
                    api_key=api_key,
                    model=request.model,
                    system_prompt=request.system_prompt,
                    user_prompt=request.user_prompt,
                    temperature=request.temperature,
                    max_tokens=request.max_tokens,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Gemini raw prompt failed, falling back to simulation", error=str(exc))
                output_text = f"[Simulation Déterministe]\nRéponse générée pour le prompt :\n{request.user_prompt[:200]}..."
                use_simulation = True
                completion_tokens = 80
        else:
            output_text = (
                f"[Simulation Déterministe]\n"
                f"Modèle : {request.model} (T={request.temperature})\n"
                f"Prompt Système : {request.system_prompt[:100]}...\n\n"
                f"Réponse : L'exécution hors-ligne a simulé avec succès le traitement linguistique pour votre requête."
            )
            completion_tokens = 80

        latency_ms = int((time.perf_counter() - start_time) * 1000)
        total_tokens = prompt_tokens + completion_tokens
        cost_usd = (prompt_tokens * 0.075 / 1_000_000) + (completion_tokens * 0.30 / 1_000_000)

        response = RawPromptTestResponse(
            output_text=output_text,
            latency_ms=latency_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            is_simulation=use_simulation,
        )

        run_record = AISandboxRun(
            feature_type="raw",
            template_id=request.template_id,
            model=request.model,
            temperature=request.temperature,
            system_prompt=request.system_prompt,
            user_prompt=request.user_prompt,
            input_context={"max_tokens": request.max_tokens},
            raw_output=output_text,
            parsed_result={"output_text": output_text},
            latency_ms=latency_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=round(cost_usd, 6),
            is_simulation=use_simulation,
            created_by_id=user_id,
        )
        db.add(run_record)
        await db.commit()
        await db.refresh(run_record)

        return response, run_record

    # ---------------------------------------------------------------------------
    # Historical Runs & A/B Comparison
    # ---------------------------------------------------------------------------
    @staticmethod
    async def list_runs(
        db: AsyncSession,
        feature_type: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AISandboxRun], int]:
        stmt = select(AISandboxRun)
        count_stmt = select(func.count(AISandboxRun.id))

        if feature_type:
            stmt = stmt.where(AISandboxRun.feature_type == feature_type)
            count_stmt = count_stmt.where(AISandboxRun.feature_type == feature_type)

        stmt = stmt.order_by(AISandboxRun.created_at.desc()).offset((page - 1) * page_size).limit(page_size)

        total_res = await db.execute(count_stmt)
        total = total_res.scalar_one()

        items_res = await db.execute(stmt)
        items = list(items_res.scalars().all())

        return items, total

    @staticmethod
    async def get_run(db: AsyncSession, run_id: uuid.UUID) -> AISandboxRun:
        run = await db.get(AISandboxRun, run_id)
        if not run:
            raise AppException(message="Sandbox run not found", code="RUN_NOT_FOUND", status_code=404)
        return run

    @staticmethod
    async def compare_runs(
        db: AsyncSession,
        run_id_a: uuid.UUID,
        run_id_b: uuid.UUID,
    ) -> dict[str, Any]:
        run_a = await AISandboxService.get_run(db, run_id_a)
        run_b = await AISandboxService.get_run(db, run_id_b)

        score_a: float | None = None
        score_b: float | None = None
        if run_a.parsed_result and "score" in run_a.parsed_result:
            score_a = float(run_a.parsed_result["score"])
        elif run_a.parsed_result and "tef_points" in run_a.parsed_result:
            score_a = float(run_a.parsed_result["tef_points"])

        if run_b.parsed_result and "score" in run_b.parsed_result:
            score_b = float(run_b.parsed_result["score"])
        elif run_b.parsed_result and "tef_points" in run_b.parsed_result:
            score_b = float(run_b.parsed_result["tef_points"])

        score_diff = None
        if score_a is not None and score_b is not None:
            score_diff = round(score_b - score_a, 2)

        prompt_diff_summary = (
            f"Run A Modèle: {run_a.model} (T={run_a.temperature}) vs Run B Modèle: {run_b.model} (T={run_b.temperature}). "
            f"Longueur Prompt Système : {len(run_a.system_prompt)} chars vs {len(run_b.system_prompt)} chars."
        )

        evaluation_diff_summary = (
            f"Écart de latence : {run_b.latency_ms - run_a.latency_ms:+d} ms. "
            f"Écart de jetons : {run_b.total_tokens - run_a.total_tokens:+d} tokens. "
        )
        if score_diff is not None:
            evaluation_diff_summary += f"Écart de score : {score_diff:+g} pts."

        return {
            "run_a": run_a,
            "run_b": run_b,
            "score_difference": score_diff,
            "latency_difference_ms": run_b.latency_ms - run_a.latency_ms,
            "token_difference": run_b.total_tokens - run_a.total_tokens,
            "prompt_diff_summary": prompt_diff_summary,
            "evaluation_diff_summary": evaluation_diff_summary,
        }

    # ---------------------------------------------------------------------------
    # Benchmarks & Live Submission Import
    # ---------------------------------------------------------------------------
    @staticmethod
    def get_curated_benchmarks() -> list[BenchmarkSample]:
        return CURATED_BENCHMARKS

    @staticmethod
    async def import_submission(
        db: AsyncSession,
        submission_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Import real past student submission for instant sandbox replay."""
        stmt = (
            select(WritingSubmission)
            .options(selectinload(WritingSubmission.attempt))
            .where(WritingSubmission.id == submission_id)
        )
        res = await db.execute(stmt)
        submission = res.scalar_one_or_none()
        if not submission:
            raise AppException(message="Writing submission not found", code="SUBMISSION_NOT_FOUND", status_code=404)

        from app.modules.writing.models import WritingTask
        task = await db.get(WritingTask, submission.task_id)
        if not task:
            raise AppException(message="Associated writing task not found", code="TASK_NOT_FOUND", status_code=404)

        # Retrieve text from storage or metadata
        student_draft = "[Contenu du devoir]"
        if hasattr(submission, "storage_object_key") and submission.storage_object_key:
            from app.core.storage import get_storage
            from app.modules.writing.storage import WritingStorage
            storage = get_storage()
            try:
                raw_text = WritingStorage.get_submission_text(storage, submission.storage_object_key)
                if isinstance(raw_text, dict):
                    student_draft = raw_text.get("content", str(raw_text))
                else:
                    student_draft = str(raw_text)
            except Exception:  # noqa: BLE001
                student_draft = f"Devoir soumis pour la tâche : {task.title}"

        return {
            "submission_id": submission.id,
            "task_id": task.id,
            "task_title": task.title,
            "task_prompt": task.prompt,
            "section": task.task_type.value if hasattr(task.task_type, "value") else str(task.task_type),
            "student_draft": student_draft,
            "word_count": len(student_draft.split()),
            "submitted_at": submission.submitted_at or submission.created_at,
        }

    # ---------------------------------------------------------------------------
    # Private Helper Engines (Live API & High-Fidelity Simulations)
    # ---------------------------------------------------------------------------
    @staticmethod
    async def _call_gemini_api(
        api_key: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> tuple[str, int, int]:
        clean_model = model.replace("models/", "")
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent?key={api_key}"

        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(endpoint, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Gemini API returned status {resp.status_code}: {resp.text}")

            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise RuntimeError("No candidate received from Gemini API")

            content_parts = candidates[0].get("content", {}).get("parts", [])
            text_result = content_parts[0].get("text", "") if content_parts else ""

            usage = data.get("usageMetadata", {})
            prompt_tokens = int(usage.get("promptTokenCount", len(user_prompt.split())))
            completion_tokens = int(usage.get("candidatesTokenCount", len(text_result.split())))

            return text_result, prompt_tokens, completion_tokens

    @staticmethod
    def _parse_json_or_fallback(raw_text: str) -> dict[str, Any]:
        """Safely parse JSON from LLM response, stripping markdown backticks if present."""
        clean = (
            raw_text.strip()
            .removeprefix("```json")
            .removeprefix("```")
            .removesuffix("```")
            .strip()
        )

        try:
            return json.loads(clean)
        except (ValueError, TypeError):
            return {"raw": raw_text}

    @staticmethod
    def _construct_writing_result(data: dict[str, Any], draft: str) -> WritingTestResult:
        """Ensure standard schema compliance from parsed dictionary."""
        score = float(data.get("score", 72.0))
        tef_points = int(data.get("tef_points", int(score * 6.98)))
        cefr = str(data.get("cefr_level", "B2"))

        crit = data.get("criteria", {})
        breakdown = WritingCriteriaBreakdown(
            task_completion=float(crit.get("task_completion", 18.0)),
            coherence_cohesion=float(crit.get("coherence_cohesion", 18.0)),
            vocabulary_range_accuracy=float(crit.get("vocabulary_range_accuracy", 18.0)),
            grammatical_range_accuracy=float(crit.get("grammatical_range_accuracy", 18.0)),
            detailed_notes=crit.get("detailed_notes", None),
        )

        errors: list[WritingErrorSpan] = []
        for e in data.get("errors", []):
            if isinstance(e, dict):
                errors.append(
                    WritingErrorSpan(
                        error_text=str(e.get("error_text", "")),
                        start_index=int(e.get("start_index", 0)),
                        end_index=int(e.get("end_index", 0)),
                        error_type=str(e.get("error_type", "grammar")),
                        suggestion=str(e.get("suggestion", "")),
                        explanation=str(e.get("explanation", "")),
                    )
                )

        return WritingTestResult(
            score=score,
            tef_points=tef_points,
            cefr_level=cefr,
            criteria=breakdown,
            strengths=list(data.get("strengths", ["Structure claire et logique", "Propos compréhensible"])),
            weaknesses=list(data.get("weaknesses", ["Varier davantage les connecteurs logiques"])),
            errors=errors,
            corrected_text=str(data.get("corrected_text", draft)),
            recommendations=list(data.get("recommendations", ["Revoir l'accord du participe passé avec l'auxiliaire avoir"])),
            overall_feedback=str(data.get("overall_feedback", "Production bien argumentée répondant au niveau attendu.")),
        )

    @staticmethod
    def _simulate_writing_evaluation(
        task_prompt: str,
        student_draft: str,
        target_level: str,
        section: str,
    ) -> tuple[str, WritingTestResult]:
        words = student_draft.split()
        count = len(words)

        # Baseline evaluation based on word count & vocabulary heuristic
        if count < 80:
            cefr = "A2"
            score = 42.0
            tef_points = 295
            errors = [
                WritingErrorSpan(
                    error_text="je écrit",
                    start_index=0,
                    end_index=8,
                    error_type="grammar",
                    suggestion="j'écris",
                    explanation="Le verbe écrire à la première personne du singulier au présent prend un 's'.",
                )
            ]
            strengths = ["Idée principale compréhensible", "Volonté de communiquer"]
            weaknesses = ["Longueur insuffisante", "Vocabulaire élémentaire", "Erreurs morphosyntaxiques fréquentes"]
        elif count < 150:
            cefr = "B1"
            score = 62.0
            tef_points = 415
            errors = [
                WritingErrorSpan(
                    error_text="parce que on gagne",
                    start_index=0,
                    end_index=19,
                    error_type="syntax",
                    suggestion="parce que l'on gagne / parce qu'on gagne",
                    explanation="Élision obligatoire de 'que' devant une voyelle (parce qu'on).",
                )
            ]
            strengths = ["Organisation logique en paragraphes", "Usage correct des temps du récit"]
            weaknesses = ["Manque de nuances dans l'argumentation", "Répétition de termes génériques"]
        else:
            cefr = "B2" if target_level != "C1" else "C1"
            score = 78.0 if cefr == "B2" else 88.0
            tef_points = 512 if cefr == "B2" else 610
            errors = [
                WritingErrorSpan(
                    error_text="de manière significative",
                    start_index=0,
                    end_index=24,
                    error_type="vocabulary",
                    suggestion="considérablement",
                    explanation="Suggestion stylistique pour enrichir le registre de langue.",
                )
            ]
            strengths = [
                "Excellente maîtrise du registre de langue soutenu",
                "Connecteurs logiques variés et pertinents",
                "Respect rigoureux de la consigne et du format épistolaire",
            ]
            weaknesses = ["Quelques formules un peu lourdes dans la conclusion"]

        sub_score = score / 4.0
        criteria = WritingCriteriaBreakdown(
            task_completion=round(sub_score + 0.5, 1),
            coherence_cohesion=round(sub_score, 1),
            vocabulary_range_accuracy=round(sub_score - 0.3, 1),
            grammatical_range_accuracy=round(sub_score - 0.2, 1),
            detailed_notes={
                "task_completion": f"Volume rédigé : {count} mots. Consigne respectée.",
                "coherence": "Progression thématique claire et transitions fluides.",
                "vocabulary": "Vocabulaire pertinent adapté au domaine du sujet.",
                "grammar": "Bonne maîtrise des structures verbales principales.",
            },
        )

        result = WritingTestResult(
            score=score,
            tef_points=tef_points,
            cefr_level=cefr,
            criteria=criteria,
            strengths=strengths,
            weaknesses=weaknesses,
            errors=errors,
            corrected_text=student_draft,
            recommendations=[
                "Approfondir les structures concessives (bien que, quoique + subjonctif)",
                "Veiller à la variété lexicale pour éviter les répétitions",
            ],
            overall_feedback=(
                f"Évaluation déterministe hors-ligne (TEF {section.upper()}) : "
                f"Le devoir démontre des compétences correspondant au niveau {cefr} ({tef_points}/698 points)."
            ),
        )

        raw_json = json.dumps(result.model_dump(), indent=2, ensure_ascii=False)
        return raw_json, result

    @staticmethod
    def _simulate_speaking_reply(section: str, candidate_message: str, turn_index: int) -> str:
        msg_lower = candidate_message.lower()

        if section == "section_a":
            if "tarif" in msg_lower or "prix" in msg_lower or "coûte" in msg_lower:
                return "Nous proposons une formule découverte à 45 euros la séance, ou un forfait mensuel de 120 euros. Souhaitez-vous des détails sur les modes de règlement ?"
            elif "horaire" in msg_lower or "heure" in msg_lower or "quand" in msg_lower:
                return "Nos ateliers se déroulent les mardis et jeudis de 18h30 à 20h30, ainsi que le samedi matin dès 9h30. Quel créneau vous conviendrait le mieux ?"
            elif "matériel" in msg_lower or "fourni" in msg_lower or "apporter" in msg_lower:
                return "Tout le matériel pédagogique et les ingrédients sont intégralement fournis sur place. Avez-vous d'autres questions concernant l'équipement ?"
            else:
                return "Tout à fait. Concernant votre question, nous nous adaptons au niveau de chacun. Avez-vous une autre précision à me demander pour votre inscription ?"

        # Section B (amical, tutoiement)
        if turn_index == 0:
            return "Salut ! Écoute, l'idée est sympa, mais une semaine entière à vélo... Tu sais bien que je ne suis pas un grand sportif. Tu es sûr que c'est faisable ?"
        elif "fatigue" in msg_lower or "sport" in msg_lower or "facile" in msg_lower:
            return "D'accord, mais et s'il pleut tous les jours ? En Bretagne, la météo peut être capricieuse. Comment on ferait avec les tentes et les bagages ?"
        elif "budget" in msg_lower or "argent" in msg_lower or "coût" in msg_lower:
            return "C'est vrai que niveau budget, c'est beaucoup plus économique qu'un hôtel. Tu as déjà regardé pour louer des vélos adaptés là-bas ?"
        else:
            return "Franchement, tu commences à me convaincre ! Montre-moi les photos du parcours et les étapes, on en rediscute ce soir autour d'un café !"

    @staticmethod
    def _simulate_speaking_evaluation(
        topic: str, transcription: str, target_level: str
    ) -> tuple[str, SpeakingEvaluationTestResult]:
        words = len(transcription.split())
        score = 75.0 if words > 50 else 55.0
        tef_points = int(score * 6.98)
        cefr = "B2" if score >= 70.0 else "B1"

        result = SpeakingEvaluationTestResult(
            tef_points=tef_points,
            cefr_level=cefr,
            score=score,
            pronunciation_fluency=18.5,
            lexical_resource=19.0,
            grammatical_accuracy=18.0,
            interaction_coherence=19.5,
            strengths=[
                "Aisance dans la prise de parole et réactivité immédiate",
                "Bon respect du rôle et de la consigne sociolinguistique",
                "Capacité d'argumentation convaincante",
            ],
            weaknesses=[
                "Quelques imprécisions sur les prépositions de lieu",
                "Prononciation perfectible sur certaines voyelles nasales",
            ],
            recommendations=[
                "Maintenir l'entraînement aux jeux de rôle sous contrainte de temps (10 minutes)",
                "Diversifier les formules d'amorce d'objection",
            ],
            examiner_feedback=(
                f"Évaluation orale simulée (Niveau {cefr} — {tef_points}/698 points) : "
                "L'interaction est vivante, dynamique et démontre un très bon niveau de communication spontanée."
            ),
        )
        return json.dumps(result.model_dump(), indent=2, ensure_ascii=False), result

    @staticmethod
    async def get_speaking_configs(db: AsyncSession) -> list[SpeakingExaminerConfigResponse]:
        """Fetch active production examiner configurations, auto-seeding defaults if not found."""
        from app.modules.admin.speaking_config_models import SpeakingExaminerConfig
        from app.modules.speaking.providers.gemini_live import build_examiner_instructions

        stmt = select(SpeakingExaminerConfig).order_by(SpeakingExaminerConfig.section)
        configs = list((await db.execute(stmt)).scalars().all())

        existing_sections = {c.section for c in configs}
        created_any = False

        if "section_a" not in existing_sections:
            prompt_a = build_examiner_instructions("Renseignements sur une annonce ou un stage (Section A)", "B2")
            cfg_a = SpeakingExaminerConfig(
                section="section_a",
                model="models/gemini-3.8-live",
                voice_persona="Aoede",
                system_prompt=prompt_a,
                scepticism_level=0.2,
                temperature=0.7,
                top_p=0.95,
            )
            db.add(cfg_a)
            configs.append(cfg_a)
            created_any = True

        if "section_b" not in existing_sections:
            prompt_b = build_examiner_instructions("Convaincre un ami de participer à un projet (Section B)", "B2")
            cfg_b = SpeakingExaminerConfig(
                section="section_b",
                model="models/gemini-3.8-live",
                voice_persona="Charon",
                system_prompt=prompt_b,
                scepticism_level=0.6,
                temperature=0.7,
                top_p=0.95,
            )
            db.add(cfg_b)
            configs.append(cfg_b)
            created_any = True

        if created_any:
            await db.commit()
            for c in configs:
                await db.refresh(c)

        return [SpeakingExaminerConfigResponse.model_validate(c) for c in configs]

    @staticmethod
    async def update_speaking_config(
        db: AsyncSession,
        admin_id: uuid.UUID,
        req: SpeakingExaminerConfigUpdateRequest,
    ) -> SpeakingExaminerConfigResponse:
        """Update or create active production examiner configuration for a section with audit logging."""
        from app.modules.admin.models import AuditEvent
        from app.modules.admin.speaking_config_models import SpeakingExaminerConfig

        stmt = select(SpeakingExaminerConfig).where(SpeakingExaminerConfig.section == req.section)
        cfg = (await db.execute(stmt)).scalar_one_or_none()

        old_model = cfg.model if cfg else None
        old_voice = cfg.voice_persona if cfg else None

        if cfg is None:
            cfg = SpeakingExaminerConfig(
                section=req.section,
                model=req.model,
                voice_persona=req.voice_persona,
                system_prompt=req.system_prompt,
                scepticism_level=req.scepticism_level,
                temperature=req.temperature,
                top_p=req.top_p,
                updated_by_id=admin_id,
            )
            db.add(cfg)
        else:
            cfg.model = req.model
            cfg.voice_persona = req.voice_persona
            cfg.system_prompt = req.system_prompt
            cfg.scepticism_level = req.scepticism_level
            cfg.temperature = req.temperature
            cfg.top_p = req.top_p
            cfg.updated_by_id = admin_id

        await db.flush()

        audit = AuditEvent(
            actor_user_id=admin_id,
            action="SPEAKING_EXAMINER_CONFIG_UPDATED",
            entity_type="SpeakingExaminerConfig",
            entity_id=cfg.id,
            payload={
                "section": req.section,
                "model": req.model,
                "voice_persona": req.voice_persona,
                "scepticism_level": req.scepticism_level,
                "temperature": req.temperature,
                "top_p": req.top_p,
                "previous_model": old_model,
                "previous_voice": old_voice,
            },
        )
        db.add(audit)
        await db.commit()
        await db.refresh(cfg)

        logger.info(
            "speaking_examiner_config_updated",
            section=req.section,
            model=req.model,
            voice=req.voice_persona,
            admin_id=str(admin_id),
        )

        return SpeakingExaminerConfigResponse.model_validate(cfg)

    # -----------------------------------------------------------------------
    # Speaking Scenarios & Guardrails Management
    # -----------------------------------------------------------------------
    @staticmethod
    async def list_scenarios(
        db: AsyncSession,
        section: str | None = None,
        target_level: str | None = None,
        is_active: bool | None = None,
    ) -> tuple[list[SpeakingScenario], int]:
        """List all speaking exam scenarios matching optional filters."""
        stmt = select(SpeakingScenario)
        if section:
            stmt = stmt.where(SpeakingScenario.section == section)
        if target_level:
            stmt = stmt.where(SpeakingScenario.target_level == target_level)
        if is_active is not None:
            stmt = stmt.where(SpeakingScenario.is_active == is_active)

        stmt = stmt.order_by(SpeakingScenario.section, SpeakingScenario.title)
        res = await db.execute(stmt)
        items = list(res.scalars().all())
        return items, len(items)

    @staticmethod
    async def get_scenario(db: AsyncSession, scenario_id: uuid.UUID) -> SpeakingScenario:
        """Fetch a specific speaking scenario by ID."""
        scenario = await db.get(SpeakingScenario, scenario_id)
        if not scenario:
            raise AppException(message="Scénario introuvable.", code="NOT_FOUND", status_code=404)
        return scenario

    @staticmethod
    async def create_scenario(
        db: AsyncSession,
        admin_id: uuid.UUID,
        req: SpeakingScenarioCreateRequest,
    ) -> SpeakingScenario:
        """Create a new authentic speaking exam scenario with validation and audit logging."""
        from app.modules.admin.models import AuditEvent

        # Check unique code
        code_check = await db.execute(select(SpeakingScenario).where(SpeakingScenario.code == req.code))
        if code_check.scalar_one_or_none():
            raise AppException(
                message=f"Le code scénario '{req.code}' existe déjà.",
                code="SCENARIO_CODE_CONFLICT",
                status_code=409,
            )

        scenario = SpeakingScenario(
            title=req.title,
            code=req.code,
            section=req.section,
            target_level=req.target_level,
            difficulty=req.difficulty,
            is_active=req.is_active,
            document_title=req.document_title,
            document_content=req.document_content,
            document_image_url=req.document_image_url,
            role_title=req.role_title,
            persona_name=req.persona_name,
            voice_persona=req.voice_persona,
            register=req.register,
            temperament=req.temperament,
            scepticism_level=req.scepticism_level,
            known_facts=req.known_facts,
            omitted_facts=req.omitted_facts,
            objection_cards=req.objection_cards,
            scope_description=req.scope_description,
            forbidden_topics=req.forbidden_topics,
            redirection_phrases=req.redirection_phrases,
            custom_instructions=req.custom_instructions,
            created_by_id=admin_id,
        )
        db.add(scenario)
        await db.flush()

        audit = AuditEvent(
            actor_user_id=admin_id,
            action="SPEAKING_SCENARIO_CREATED",
            entity_type="SpeakingScenario",
            entity_id=scenario.id,
            payload={"code": scenario.code, "section": scenario.section, "title": scenario.title},
        )
        db.add(audit)
        await db.commit()
        await db.refresh(scenario)

        logger.info("speaking_scenario_created", scenario_id=str(scenario.id), code=scenario.code)
        return scenario

    @staticmethod
    async def update_scenario(
        db: AsyncSession,
        admin_id: uuid.UUID,
        scenario_id: uuid.UUID,
        req: SpeakingScenarioUpdateRequest,
    ) -> SpeakingScenario:
        """Update an existing speaking exam scenario with audit logging."""
        from app.modules.admin.models import AuditEvent

        scenario = await AISandboxService.get_scenario(db, scenario_id)

        if req.code is not None and req.code != scenario.code:
            code_check = await db.execute(select(SpeakingScenario).where(SpeakingScenario.code == req.code))
            if code_check.scalar_one_or_none():
                raise AppException(
                    message=f"Le code scénario '{req.code}' existe déjà.",
                    code="SCENARIO_CODE_CONFLICT",
                    status_code=409,
                )
            scenario.code = req.code

        update_fields = [
            "title", "section", "target_level", "difficulty", "is_active",
            "document_title", "document_content", "document_image_url",
            "role_title", "persona_name", "voice_persona", "register",
            "temperament", "scepticism_level", "known_facts", "omitted_facts",
            "objection_cards", "scope_description", "forbidden_topics",
            "redirection_phrases", "custom_instructions",
        ]
        for field in update_fields:
            val = getattr(req, field, None)
            if val is not None:
                setattr(scenario, field, val)

        await db.flush()

        audit = AuditEvent(
            actor_user_id=admin_id,
            action="SPEAKING_SCENARIO_UPDATED",
            entity_type="SpeakingScenario",
            entity_id=scenario.id,
            payload={"code": scenario.code, "section": scenario.section, "title": scenario.title},
        )
        db.add(audit)
        await db.commit()
        await db.refresh(scenario)

        logger.info("speaking_scenario_updated", scenario_id=str(scenario.id), code=scenario.code)
        return scenario

    @staticmethod
    async def delete_scenario(
        db: AsyncSession,
        admin_id: uuid.UUID,
        scenario_id: uuid.UUID,
    ) -> None:
        """Delete a speaking scenario with audit logging."""
        from app.modules.admin.models import AuditEvent

        scenario = await AISandboxService.get_scenario(db, scenario_id)

        audit = AuditEvent(
            actor_user_id=admin_id,
            action="SPEAKING_SCENARIO_DELETED",
            entity_type="SpeakingScenario",
            entity_id=scenario.id,
            payload={"code": scenario.code, "title": scenario.title},
        )
        db.add(audit)
        await db.delete(scenario)
        await db.commit()

        logger.info("speaking_scenario_deleted", scenario_id=str(scenario_id), code=scenario.code)

    @staticmethod
    async def duplicate_scenario(
        db: AsyncSession,
        admin_id: uuid.UUID,
        scenario_id: uuid.UUID,
    ) -> SpeakingScenario:
        """Duplicate an existing scenario with a cloned code and title."""
        from app.modules.admin.models import AuditEvent

        source = await AISandboxService.get_scenario(db, scenario_id)
        clone_suffix = uuid.uuid4().hex[:4].upper()
        clone_code = f"{source.code[:40]}-CPY-{clone_suffix}"

        clone = SpeakingScenario(
            title=f"{source.title} (Copie)",
            code=clone_code,
            section=source.section,
            target_level=source.target_level,
            difficulty=source.difficulty,
            is_active=False,  # default inactive until reviewed
            document_title=source.document_title,
            document_content=source.document_content,
            document_image_url=source.document_image_url,
            role_title=source.role_title,
            persona_name=source.persona_name,
            voice_persona=source.voice_persona,
            register=source.register,
            temperament=source.temperament,
            scepticism_level=source.scepticism_level,
            known_facts=list(source.known_facts or []),
            omitted_facts=list(source.omitted_facts or []),
            objection_cards=list(source.objection_cards or []),
            scope_description=source.scope_description,
            forbidden_topics=list(source.forbidden_topics or []),
            redirection_phrases=list(source.redirection_phrases or []),
            custom_instructions=source.custom_instructions,
            created_by_id=admin_id,
        )
        db.add(clone)
        await db.flush()

        audit = AuditEvent(
            actor_user_id=admin_id,
            action="SPEAKING_SCENARIO_DUPLICATED",
            entity_type="SpeakingScenario",
            entity_id=clone.id,
            payload={"source_code": source.code, "clone_code": clone.code},
        )
        db.add(audit)
        await db.commit()
        await db.refresh(clone)

        logger.info("speaking_scenario_duplicated", original_id=str(source.id), clone_id=str(clone.id))
        return clone

    @staticmethod
    async def seed_default_scenarios(
        db: AsyncSession,
        admin_id: uuid.UUID,
    ) -> list[SpeakingScenario]:
        """Seed authentic TEF Section A & B examination scenarios if not already seeded."""
        default_defs = [
            {
                "code": "SCEN-A-01",
                "title": "Club de randonnée en montagne « Les Sommets Perdus »",
                "section": "section_a",
                "target_level": "B2",
                "difficulty": "standard",
                "document_title": "Randonnées accompagnées dans les Alpes — Sorties hebdomadaires",
                "document_content": (
                    "Club Alpin Les Sommets Perdus\n"
                    "Rejoignez notre association pour des randonnées inoubliables en moyenne et haute montagne tous les samedis et dimanches. "
                    "Groupes de 8 à 12 personnes avec guides diplômés d'État.\n"
                    "Inscription obligatoire 48h à l'avance. Tarifs préférentiels pour les étudiants et demandeurs d'emploi.\n"
                    "Contact : 04 50 12 34 56 ou contact@sommets-perdus.fr"
                ),
                "role_title": "Secrétaire d'accueil de l'association de randonnée",
                "persona_name": "M. Lambert",
                "voice_persona": "Aoede",
                "register": "formal",
                "temperament": "Professionnel, poli et bienveillant. Répond avec précision mais brièvement aux questions posées sans anticiper les détails non demandés.",
                "scepticism_level": 0.3,
                "known_facts": [
                    {"category": "tarifs", "fact": "Adhésion annuelle de 45€ + 15€ par sortie", "detail": "Réduction de 20% pour les étudiants sur présentation de carte."},
                    {"category": "équipement", "fact": "Chaussures montantes de randonnée obligatoires", "detail": "Bâtons et sac à dos peuvent être prêtés gratuitement par le club."},
                    {"category": "transport", "fact": "Covoiturage organisé depuis la gare centrale", "detail": "Départ à 7h30 le matin, partage des frais d'essence (environ 8€)."},
                    {"category": "niveau", "fact": "Niveau moyen : 600m de dénivelé positif en moyenne", "detail": "Accessible aux personnes en bonne condition physique, pas pour débutants complets."},
                    {"category": "repas", "fact": "Pique-nique tiré du sac", "detail": "Chaque participant apporte son repas et au moins 1,5L d'eau."},
                    {"category": "météo", "fact": "En cas d'intempéries, la sortie est reportée au dimanche ou remboursée", "detail": "Notification SMS la veille à 18h."},
                ],
                "omitted_facts": [
                    "Montant exact de l'adhésion annuelle et coût par sortie",
                    "Matériel obligatoire et possibilité de prêt",
                    "Moyen de transport pour se rendre au point de départ",
                    "Difficulté physique et dénivelé",
                    "Modalités pour le repas de midi",
                    "Conditions d'annulation en cas de pluie",
                ],
                "objection_cards": [],
                "scope_description": "Renseignements sur l'inscription, le fonctionnement, les tarifs et l'organisation pratique des sorties du club de randonnée.",
                "forbidden_topics": [
                    "Politique générale ou réglementations européennes de la montagne",
                    "Alpinisme extrême ou expéditions à l'étranger",
                    "Conseils d'immigration pour le Canada",
                ],
                "redirection_phrases": [
                    "Nous parlons ici des sorties de notre club de randonnée, revenons aux modalités de votre inscription.",
                    "Je vous invite à poser vos questions concernant l'annonce de nos randonnées.",
                ],
            },
            {
                "code": "SCEN-B-01",
                "title": "Adopter le covoiturage pour se rendre au travail",
                "section": "section_b",
                "target_level": "B2",
                "difficulty": "standard",
                "document_title": "Covoiturage quotidien : faites des économies et protégez la planète",
                "document_content": (
                    "Article extrait du magazine Éco-Mobilité :\n"
                    "« Face à l'augmentation du prix des carburants et aux embouteillages quotidiens, le covoiturage entre collègues ou voisins séduit de plus en plus de salariés. "
                    "Une plateforme locale permet désormais de mettre en relation les conducteurs d'une même zone d'activités avec des horaires flexibles et une indemnité forfaitaire kilométrique. »\n\n"
                    "Consigne d'examen : Vous avez lu cet article et vous voulez convaincre votre collègue (l'examinateur) de faire du covoiturage avec vous pour aller au bureau."
                ),
                "role_title": "Collègue de travail réticent et habitué à sa routine",
                "persona_name": "Julien",
                "voice_persona": "Fenrir",
                "register": "informal",
                "temperament": "Sceptique, attaché à sa liberté d'horaires et à sa tranquillité le matin, mais ouvert aux arguments financiers et concrets.",
                "scepticism_level": 0.6,
                "known_facts": [],
                "omitted_facts": [],
                "objection_cards": [
                    {
                        "trigger": "liberté/horaires",
                        "objection": "Tu sais bien que mes horaires changent souvent le soir avec les réunions de dernière minute, je ne veux pas être dépendant de toi !",
                        "concession": "Si on s'accorde sur une marge de 15 minutes ou si on fait seulement 2 ou 3 jours par semaine, à la limite...",
                    },
                    {
                        "trigger": "tranquillité/fatigue",
                        "objection": "Moi le matin, j'aime bien écouter ma musique et être tranquille sans parler à personne pour me réveiller en douceur.",
                        "concession": "Bon, si on n'est pas obligés de discuter tout le long du trajet et qu'on alterne la musique, pourquoi pas.",
                    },
                    {
                        "trigger": "argent/économies",
                        "objection": "Franchement, entre l'essence et les détours pour venir te chercher, je ne suis pas convaincu qu'on économise tant que ça.",
                        "concession": "C'est vrai que si on divise l'essence et l'usure par deux, ça fait quand même 100€ de moins par mois.",
                    },
                    {
                        "trigger": "organisation/retard",
                        "objection": "Et si l'un de nous tombe en panne ou a une urgence familiale le matin, on fait comment ?",
                        "concession": "D'accord, si l'application garantit un taxi de secours en cas d'imprévu, ça me rassure un peu.",
                    },
                ],
                "scope_description": "Persuasion amicale d'un collègue de travail pour covoiturer ensemble au bureau à partir d'un article de presse.",
                "forbidden_topics": [
                    "Politique fiscale des carburants",
                    "Vie privée en dehors du travail",
                    "Demande de note ou de score de l'examen",
                ],
                "redirection_phrases": [
                    "Attends, on s'éloigne du sujet ! Tu voulais me convaincre pour le covoiturage entre nous, pas refaire la politique des transports !",
                    "Écoute, reste sur notre trajet vers le boulot, comment tu t'organises concrètement ?",
                ],
            },
            {
                "code": "SCEN-A-02",
                "title": "Stage de théâtre d'improvisation pour adultes",
                "section": "section_a",
                "target_level": "B1",
                "difficulty": "lenient",
                "document_title": "Découvrez l'improvisation théâtrale — Stage d'initiation week-end",
                "document_content": (
                    "Compagnie « Les Mots en Scène »\n"
                    "Osez monter sur scène ! Stage intensif d'improvisation théâtrale pour débutants les 15 et 16 novembre.\n"
                    "Développez votre confiance en vous, votre spontanéité et l'écoute dans une ambiance chaleureuse et sans jugement.\n"
                    "Tous niveaux acceptés, places limitées à 12 personnes.\n"
                    "Contact et réservations : contact@motsenscene.fr"
                ),
                "role_title": "Metteur en scène et organisateur du stage",
                "persona_name": "Mme Sophie Bernard",
                "voice_persona": "Kore",
                "register": "formal",
                "temperament": "Enthousiaste, accueillante mais structurée. Attend que le candidat prenne l'initiative de poser au moins une dizaine de questions précises.",
                "scepticism_level": 0.2,
                "known_facts": [
                    {"category": "horaires", "fact": "Samedi et dimanche de 10h à 17h avec pause déjeuner d'une heure", "detail": "Total de 12 heures d'atelier."},
                    {"category": "tarif", "fact": "140€ pour le week-end complet", "detail": "Paiement en deux fois accepté."},
                    {"category": "lieu", "fact": "Salle Saint-Roch, 12 rue des Fleurs (accès métro ligne 1)", "detail": "Vestiaires disponibles sur place."},
                    {"category": "tenue", "fact": "Vêtements souples et confortables recommandés", "detail": "Chaussettes épaisses ou chaussons d'intérieur, pas de talons."},
                    {"category": "spectacle", "fact": "Petite restitution facultative le dimanche à 16h devant les proches", "detail": "Entrée libre pour amis et famille."},
                ],
                "omitted_facts": [
                    "Horaires précis des journées de stage",
                    "Tarif global et modalités de paiement",
                    "Lieu exact et accès en transports",
                    "Tenue vestimentaire requise",
                    "Représentation ou spectacle de fin de stage",
                ],
                "objection_cards": [],
                "scope_description": "Renseignements sur le déroulement pratique, les horaires, les tarifs et l'organisation du stage d'initiation au théâtre d'improvisation.",
                "forbidden_topics": [
                    "Carrière professionnelle au cinéma",
                    "Théâtre classique ou analyse littéraire de pièces",
                ],
                "redirection_phrases": [
                    "Concentrons-nous sur notre stage d'initiation du week-end. Avez-vous d'autres questions pratiques ?",
                ],
            },
            {
                "code": "SCEN-B-02",
                "title": "Convaincre un ami d'acheter une liseuse électronique",
                "section": "section_b",
                "target_level": "C1",
                "difficulty": "challenging",
                "document_title": "La liseuse électronique : l'avenir de la lecture nomade ?",
                "document_content": (
                    "Article extrait du Figaro Culture :\n"
                    "« Malgré l'attachement viscéral des Français au livre papier, les liseuses à encre électronique nouvelle génération conquièrent de plus en plus de grands lecteurs. "
                    "Légèreté, autonomie de plusieurs semaines, dictionnaires intégrés et accès instantané à des milliers d'ouvrages sans fatigue oculaire : le livre numérique présente de solides arguments. »\n\n"
                    "Consigne d'examen : Vous venez d'acquérir une liseuse et vous voulez persuader un ami très attaché au livre papier d'en acheter une également."
                ),
                "role_title": "Ami passionné de livres papier et collectionneur",
                "persona_name": "Maxime",
                "voice_persona": "Puck",
                "register": "informal",
                "temperament": "Puriste littéraire, très attaché à l'objet livre, à l'odeur du papier et aux librairies indépendantes. Exige une argumentation fine et nuancée.",
                "scepticism_level": 0.75,
                "known_facts": [],
                "omitted_facts": [],
                "objection_cards": [
                    {
                        "trigger": "odeur/toucher/objet",
                        "objection": "Tu plaisantes ? Une liseuse c'est froid et impersonnel ! Rien ne remplace l'odeur du papier et le plaisir de tourner les pages d'un vrai livre.",
                        "concession": "Je reconnais que pour les gros pavés en voyage ou dans le métro, trimballer 800 pages c'est lourd...",
                    },
                    {
                        "trigger": "écrans/yeux",
                        "objection": "Je passe déjà 8 heures par jour devant un écran d'ordinateur au boulot, je refuse de m'abîmer les yeux le soir en plus !",
                        "concession": "Si l'encre électronique ne rétroéclaire pas directement dans les yeux comme un smartphone, c'est peut-être moins agressif.",
                    },
                    {
                        "trigger": "libraires/indépendance",
                        "objection": "Acheter des fichiers chez des géants du web, c'est la mort des libraires de quartier que j'adore fréquenter.",
                        "concession": "Si la liseuse accepte des formats ouverts et qu'on peut acheter sur les plateformes de libraires indépendants, ça me dérange moins.",
                    },
                    {
                        "trigger": "prix/gadget",
                        "objection": "Payer plus de 130 euros pour un gadget qui risque de tomber en panne ou de casser dans mon sac, non merci.",
                        "concession": "C'est vrai que si les livres numériques sont 30 à 40% moins chers et que les classiques sont gratuits, c'est vite rentabilisé.",
                    },
                ],
                "scope_description": "Discussion amicale et argumentative visant à persuader un ami amoureux du papier d'adopter la liseuse électronique.",
                "forbidden_topics": [
                    "Piratage informatique ou téléchargement illégal",
                    "Débats financiers sur les multinationales",
                ],
                "redirection_phrases": [
                    "Attends, ne me parle pas de géopolitique, on parle de notre passion pour la lecture ! Pourquoi tu penses que moi j'en aurais besoin ?",
                ],
            },
        ]

        seeded: list[SpeakingScenario] = []
        for def_data in default_defs:
            existing = (await db.execute(select(SpeakingScenario).where(SpeakingScenario.code == def_data["code"]))).scalar_one_or_none()
            if existing:
                seeded.append(existing)
                continue

            scenario = SpeakingScenario(
                title=def_data["title"],
                code=def_data["code"],
                section=def_data["section"],
                target_level=def_data["target_level"],
                difficulty=def_data["difficulty"],
                is_active=True,
                document_title=def_data["document_title"],
                document_content=def_data["document_content"],
                role_title=def_data["role_title"],
                persona_name=def_data["persona_name"],
                voice_persona=def_data["voice_persona"],
                register=def_data["register"],
                temperament=def_data["temperament"],
                scepticism_level=def_data["scepticism_level"],
                known_facts=def_data["known_facts"],
                omitted_facts=def_data["omitted_facts"],
                objection_cards=def_data["objection_cards"],
                scope_description=def_data["scope_description"],
                forbidden_topics=def_data["forbidden_topics"],
                redirection_phrases=def_data["redirection_phrases"],
                created_by_id=admin_id,
            )
            db.add(scenario)
            await db.flush()
            seeded.append(scenario)

        await db.commit()
        for sc in seeded:
            await db.refresh(sc)
        logger.info("speaking_scenarios_seeded", count=len(seeded))
        return seeded

