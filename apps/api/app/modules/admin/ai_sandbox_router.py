"""FastAPI Router for Admin AI Sandbox & Benchmarking Studio: /api/v1/admin/ai-sandbox."""

import asyncio
import uuid

import structlog
from fastapi import APIRouter, Depends, Query, Request, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token, is_token_revoked
from app.modules.admin.ai_sandbox_models import AIPromptTemplate
from app.modules.admin.ai_sandbox_schemas import (
    AIPromptTemplateCreate,
    AIPromptTemplateResponse,
    AIPromptTemplateUpdate,
    AISandboxCompareRequest,
    AISandboxCompareResponse,
    AISandboxRunListResponse,
    AISandboxRunResponse,
    BenchmarkListResponse,
    ImportedSubmissionResponse,
    RawPromptTestRequest,
    RawPromptTestResponse,
    SpeakingEvaluationTestRequest,
    SpeakingEvaluationTestResult,
    SpeakingTurnTestRequest,
    SpeakingTurnTestResponse,
    WritingTestResult,
    WritingTestRunRequest,
)
from app.modules.admin.ai_sandbox_service import AISandboxService
from app.modules.admin.models import AuditEvent
from app.modules.admin.speaking_config_schemas import (
    SpeakingExaminerConfigResponse,
    SpeakingExaminerConfigUpdateRequest,
)
from app.modules.admin.speaking_scenario_models import SpeakingScenario
from app.modules.admin.speaking_scenario_schemas import (
    SpeakingScenarioCreateRequest,
    SpeakingScenarioListResponse,
    SpeakingScenarioResponse,
    SpeakingScenarioUpdateRequest,
)
from app.modules.auth.dependencies import require_role
from app.modules.speaking.providers.gemini_live import GeminiLiveExaminer, GeminiSpeakingEvaluator
from app.modules.users.models import User, UserRole

router = APIRouter(prefix="/admin/ai-sandbox", tags=["Admin AI Sandbox"])
logger = structlog.get_logger("tef-api.admin_ai_sandbox")


# Envelopes for composite responses
class WritingRunEnvelope(BaseModel):
    result: WritingTestResult
    run: AISandboxRunResponse


class SpeakingTurnRunEnvelope(BaseModel):
    turn: SpeakingTurnTestResponse
    run: AISandboxRunResponse


class SpeakingEvaluationRunEnvelope(BaseModel):
    result: SpeakingEvaluationTestResult
    run: AISandboxRunResponse


class RawRunEnvelope(BaseModel):
    output: RawPromptTestResponse
    run: AISandboxRunResponse


# ---------------------------------------------------------------------------
# Prompt Templates Endpoints
# ---------------------------------------------------------------------------
@router.get(
    "/templates",
    response_model=list[AIPromptTemplateResponse],
    summary="List all AI prompt templates and presets",
)
async def list_templates(
    feature_type: str | None = Query(None, pattern="^(writing|speaking|raw)$"),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[AIPromptTemplate]:
    return await AISandboxService.list_templates(db, feature_type=feature_type)


@router.post(
    "/templates",
    response_model=AIPromptTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a custom AI prompt template",
)
async def create_template(
    payload: AIPromptTemplateCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> AIPromptTemplate:
    template = await AISandboxService.create_template(db, payload, current_user.id)

    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="CREATE_AI_PROMPT_TEMPLATE",
        entity_type="AIPromptTemplate",
        entity_id=template.id,
        payload={"name": template.name, "feature_type": template.feature_type, "model": template.default_model},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()

    return template


@router.get(
    "/templates/{template_id}",
    response_model=AIPromptTemplateResponse,
    summary="Get an AI prompt template by ID",
)
async def get_template(
    template_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> AIPromptTemplate:
    return await AISandboxService.get_template(db, template_id)


@router.put(
    "/templates/{template_id}",
    response_model=AIPromptTemplateResponse,
    summary="Update a custom AI prompt template",
)
async def update_template(
    template_id: uuid.UUID,
    payload: AIPromptTemplateUpdate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> AIPromptTemplate:
    template = await AISandboxService.update_template(db, template_id, payload)

    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="UPDATE_AI_PROMPT_TEMPLATE",
        entity_type="AIPromptTemplate",
        entity_id=template.id,
        payload={"name": template.name, "feature_type": template.feature_type},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()

    return template


@router.delete(
    "/templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a custom AI prompt template",
)
async def delete_template(
    template_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    await AISandboxService.delete_template(db, template_id)

    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="DELETE_AI_PROMPT_TEMPLATE",
        entity_type="AIPromptTemplate",
        entity_id=template_id,
        payload={"deleted_id": str(template_id)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()


# ---------------------------------------------------------------------------
# Test Execution Run Endpoints
# ---------------------------------------------------------------------------
@router.post(
    "/run/writing",
    response_model=WritingRunEnvelope,
    summary="Execute writing evaluation test in AI Sandbox",
)
async def run_writing_test(
    payload: WritingTestRunRequest,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> WritingRunEnvelope:
    result, run_record = await AISandboxService.run_writing_test(db, payload, current_user.id)

    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="RUN_AI_WRITING_SANDBOX",
        entity_type="AISandboxRun",
        entity_id=run_record.id,
        payload={
            "section": payload.section,
            "target_level": payload.target_level,
            "model": payload.model,
            "latency_ms": run_record.latency_ms,
            "is_simulation": run_record.is_simulation,
            "score": result.score,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()

    return WritingRunEnvelope(
        result=result,
        run=AISandboxRunResponse.model_validate(run_record),
    )


@router.post(
    "/run/speaking/turn",
    response_model=SpeakingTurnRunEnvelope,
    summary="Execute single dialogue turn test in Speaking Sandbox",
)
async def run_speaking_turn(
    payload: SpeakingTurnTestRequest,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> SpeakingTurnRunEnvelope:
    turn_resp, run_record = await AISandboxService.run_speaking_turn_test(db, payload, current_user.id)

    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="RUN_AI_SPEAKING_TURN_SANDBOX",
        entity_type="AISandboxRun",
        entity_id=run_record.id,
        payload={
            "section": payload.section,
            "model": payload.model,
            "latency_ms": run_record.latency_ms,
            "is_simulation": run_record.is_simulation,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()

    return SpeakingTurnRunEnvelope(
        turn=turn_resp,
        run=AISandboxRunResponse.model_validate(run_record),
    )


@router.post(
    "/run/speaking/evaluate",
    response_model=SpeakingEvaluationRunEnvelope,
    summary="Execute complete oral dialogue evaluation test",
)
async def run_speaking_evaluation(
    payload: SpeakingEvaluationTestRequest,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> SpeakingEvaluationRunEnvelope:
    eval_resp, run_record = await AISandboxService.run_speaking_evaluation_test(db, payload, current_user.id)

    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="RUN_AI_SPEAKING_EVALUATION_SANDBOX",
        entity_type="AISandboxRun",
        entity_id=run_record.id,
        payload={
            "section": payload.section,
            "model": payload.model,
            "latency_ms": run_record.latency_ms,
            "is_simulation": run_record.is_simulation,
            "tef_points": eval_resp.tef_points,
            "cefr_level": eval_resp.cefr_level,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()

    return SpeakingEvaluationRunEnvelope(
        result=eval_resp,
        run=AISandboxRunResponse.model_validate(run_record),
    )


@router.post(
    "/run/raw",
    response_model=RawRunEnvelope,
    summary="Execute freeform prompt test in Raw Model Lab",
)
async def run_raw_prompt(
    payload: RawPromptTestRequest,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> RawRunEnvelope:
    raw_resp, run_record = await AISandboxService.run_raw_prompt_test(db, payload, current_user.id)

    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="RUN_AI_RAW_PROMPT_SANDBOX",
        entity_type="AISandboxRun",
        entity_id=run_record.id,
        payload={
            "model": payload.model,
            "latency_ms": run_record.latency_ms,
            "total_tokens": run_record.total_tokens,
            "is_simulation": run_record.is_simulation,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()

    return RawRunEnvelope(
        output=raw_resp,
        run=AISandboxRunResponse.model_validate(run_record),
    )


# ---------------------------------------------------------------------------
# Historical Runs & A/B Comparison Endpoints
# ---------------------------------------------------------------------------
@router.get(
    "/runs",
    response_model=AISandboxRunListResponse,
    summary="List historical sandbox test runs",
)
async def list_runs(
    feature_type: str | None = Query(None, pattern="^(writing|speaking|raw)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> AISandboxRunListResponse:
    items, total = await AISandboxService.list_runs(db, feature_type, page, page_size)
    return AISandboxRunListResponse(
        items=[AISandboxRunResponse.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/runs/{run_id}",
    response_model=AISandboxRunResponse,
    summary="Get details of a specific sandbox test run",
)
async def get_run(
    run_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> AISandboxRunResponse:
    run = await AISandboxService.get_run(db, run_id)
    return AISandboxRunResponse.model_validate(run)


@router.post(
    "/compare",
    response_model=AISandboxCompareResponse,
    summary="Compare two sandbox runs side-by-side (A/B diff)",
)
async def compare_runs(
    payload: AISandboxCompareRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> AISandboxCompareResponse:
    res = await AISandboxService.compare_runs(db, payload.run_id_a, payload.run_id_b)
    return AISandboxCompareResponse(
        run_a=AISandboxRunResponse.model_validate(res["run_a"]),
        run_b=AISandboxRunResponse.model_validate(res["run_b"]),
        score_difference=res["score_difference"],
        latency_difference_ms=res["latency_difference_ms"],
        token_difference=res["token_difference"],
        prompt_diff_summary=res["prompt_diff_summary"],
        evaluation_diff_summary=res["evaluation_diff_summary"],
    )


# ---------------------------------------------------------------------------
# Benchmark Presets & Live Submission Import Endpoints
# ---------------------------------------------------------------------------
@router.get(
    "/benchmarks",
    response_model=BenchmarkListResponse,
    summary="Get curated standard TEF benchmark datasets",
)
async def get_benchmarks(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
) -> BenchmarkListResponse:
    samples = AISandboxService.get_curated_benchmarks()
    return BenchmarkListResponse(samples=samples)


@router.get(
    "/import-submission/{submission_id}",
    response_model=ImportedSubmissionResponse,
    summary="Import an existing student submission into the sandbox",
)
async def import_student_submission(
    submission_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ImportedSubmissionResponse:
    data = await AISandboxService.import_submission(db, submission_id)
    return ImportedSubmissionResponse(**data)


# ---------------------------------------------------------------------------
# Speaking Examiner Production Model Configurations
# ---------------------------------------------------------------------------
@router.get(
    "/speaking/config",
    response_model=list[SpeakingExaminerConfigResponse],
    summary="Get active Speaking Examiner production model configurations",
)
async def get_speaking_configs(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[SpeakingExaminerConfigResponse]:
    return await AISandboxService.get_speaking_configs(db)


@router.put(
    "/speaking/config",
    response_model=SpeakingExaminerConfigResponse,
    summary="Deploy calibrated Speaking Examiner settings to production",
)
async def update_speaking_config(
    payload: SpeakingExaminerConfigUpdateRequest,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> SpeakingExaminerConfigResponse:
    res = await AISandboxService.update_speaking_config(db, current_user.id, payload)
    return res


# ---------------------------------------------------------------------------
# Speaking Exam Scenarios & Guardrails Endpoints
# ---------------------------------------------------------------------------
@router.get(
    "/scenarios",
    response_model=SpeakingScenarioListResponse,
    summary="List all speaking exam scenarios",
)
async def list_speaking_scenarios(
    section: str | None = Query(None, pattern="^(section_a|section_b)$"),
    target_level: str | None = Query(None),
    is_active: bool | None = Query(None),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> SpeakingScenarioListResponse:
    items, total = await AISandboxService.list_scenarios(
        db, section=section, target_level=target_level, is_active=is_active
    )
    return SpeakingScenarioListResponse(
        items=[SpeakingScenarioResponse.model_validate(s) for s in items],
        total=total,
    )


@router.post(
    "/scenarios",
    response_model=SpeakingScenarioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new authentic speaking exam scenario",
)
async def create_speaking_scenario(
    payload: SpeakingScenarioCreateRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> SpeakingScenarioResponse:
    scenario = await AISandboxService.create_scenario(db, current_user.id, payload)
    return SpeakingScenarioResponse.model_validate(scenario)


@router.post(
    "/scenarios/seed",
    response_model=list[SpeakingScenarioResponse],
    summary="Seed authentic TEF Section A & B examination scenarios",
)
async def seed_speaking_scenarios(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[SpeakingScenarioResponse]:
    seeded = await AISandboxService.seed_default_scenarios(db, current_user.id)
    return [SpeakingScenarioResponse.model_validate(s) for s in seeded]


@router.get(
    "/scenarios/{scenario_id}",
    response_model=SpeakingScenarioResponse,
    summary="Get a speaking scenario by ID",
)
async def get_speaking_scenario(
    scenario_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> SpeakingScenarioResponse:
    scenario = await AISandboxService.get_scenario(db, scenario_id)
    return SpeakingScenarioResponse.model_validate(scenario)


@router.put(
    "/scenarios/{scenario_id}",
    response_model=SpeakingScenarioResponse,
    summary="Update a speaking scenario",
)
async def update_speaking_scenario(
    scenario_id: uuid.UUID,
    payload: SpeakingScenarioUpdateRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> SpeakingScenarioResponse:
    scenario = await AISandboxService.update_scenario(db, current_user.id, scenario_id, payload)
    return SpeakingScenarioResponse.model_validate(scenario)


@router.delete(
    "/scenarios/{scenario_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a speaking scenario",
)
async def delete_speaking_scenario(
    scenario_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    await AISandboxService.delete_scenario(db, current_user.id, scenario_id)


@router.post(
    "/scenarios/{scenario_id}/duplicate",
    response_model=SpeakingScenarioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Duplicate an existing scenario",
)
async def duplicate_speaking_scenario(
    scenario_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> SpeakingScenarioResponse:
    clone = await AISandboxService.duplicate_scenario(db, current_user.id, scenario_id)
    return SpeakingScenarioResponse.model_validate(clone)


# ---------------------------------------------------------------------------
# Dedicated Live Bidirectional Speaking Sandbox WebSocket Endpoint
# ---------------------------------------------------------------------------
@router.websocket("/speaking/live-ws")
async def live_speaking_sandbox_ws(
    websocket: WebSocket,
    token: str | None = Query(None),
    scenario_id: uuid.UUID | None = Query(None),
    section: str = Query("section_a"),
    topic: str = Query("Atelier de cuisine du monde"),
    level: str = Query("B2"),
    model: str = Query("gemini-3.8-flash-live-preview"),
    voice_persona: str = Query("Aoede"),
    scepticism_level: float = Query(0.5),
    temperature: float = Query(0.7),
    top_p: float = Query(0.95),
    system_prompt: str | None = Query(None),
    force_simulation: bool = Query(False),
    api_key_override: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Dedicated bidirectional live audio WebSocket for Admin AI Sandbox testing."""
    auth_token = token or websocket.cookies.get("access_token")
    if not auth_token:
        auth_header = websocket.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            auth_token = auth_header.removeprefix("Bearer ").strip()
        elif "sec-websocket-protocol" in websocket.headers:
            protocols = [p.strip() for p in websocket.headers["sec-websocket-protocol"].split(",")]
            if len(protocols) >= 2 and protocols[0] == "token":
                auth_token = protocols[1]
            elif len(protocols) == 1:
                auth_token = protocols[0]

    if not auth_token:
        logger.warning("admin_live_ws_missing_credentials")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        payload = decode_access_token(auth_token)
        jti = payload.get("jti")
        if jti and await is_token_revoked(jti):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        user_id_str = payload.get("sub")
        if not user_id_str:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        res = await db.execute(select(User).where(User.id == uuid.UUID(user_id_str)))
        current_user = res.scalar_one_or_none()
        if not current_user or current_user.role != UserRole.ADMIN or not current_user.is_active:
            logger.warning("admin_live_ws_forbidden_role", user_id=user_id_str)
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    except Exception as exc:  # noqa: BLE001
        logger.warning("admin_live_ws_auth_failed", error=str(exc))
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()

    # Load authentic scenario if scenario_id provided
    scenario: SpeakingScenario | None = None
    if scenario_id:
        scenario = await db.get(SpeakingScenario, scenario_id)
        if scenario:
            topic = scenario.title
            level = scenario.target_level
            voice_persona = scenario.voice_persona
            scepticism_level = scenario.scepticism_level
            logger.info("admin_live_ws_loaded_scenario", scenario_id=str(scenario.id), code=scenario.code)

    # Ensure live streaming uses supported Gemini Live model
    resolved_model = model
    if not resolved_model or "live" not in resolved_model.lower():
        resolved_model = getattr(settings, "GEMINI_LIVE_MODEL", "models/gemini-3.8-live")
        logger.info(
            "admin_live_ws_model_coerced",
            original_model=model,
            coerced_model=resolved_model,
        )

    examiner = GeminiLiveExaminer(
        session_id=uuid.uuid4(),
        topic=topic,
        level=level,
        model=resolved_model,
        voice_persona=voice_persona,
        scepticism_level=scepticism_level,
        system_prompt=system_prompt,
        temperature=temperature,
        top_p=top_p,
        force_simulation=force_simulation,
        api_key_override=api_key_override,
        scenario=scenario,
    )

    is_connected = await examiner.connect()
    pump_task: asyncio.Task | None = None

    try:
        # Confirm connection handshake to client
        await websocket.send_json({
            "type": "connected",
            "action": "connected",
            "is_live": is_connected,
            "model": examiner.model,
            "voice": examiner.voice_persona,
            "scepticism": examiner.scepticism_level,
            "scenario_code": scenario.code if scenario else None,
            "scenario_title": scenario.title if scenario else None,
        })

        async def pump_gemini():
            try:
                async for event in examiner.stream_responses():
                    await websocket.send_json(event)
            except Exception as e:  # noqa: BLE001
                logger.warning("admin_live_pump_error", error=str(e))

        pump_task = asyncio.create_task(pump_gemini())

        # Send initial spoken greeting customized to scenario persona
        if scenario:
            if scenario.section == "section_a":
                greeting = f"Bonjour, {scenario.persona_name} à l'appareil. Je vous écoute pour vos questions concernant l'annonce."
            else:
                greeting = f"Salut ! C'est {scenario.persona_name}. Alors, de quoi voulais-tu me parler ?"
        else:
            is_sec_a = "section a" in topic.lower() or "renseignement" in topic.lower() or "information" in topic.lower()
            if is_sec_a:
                greeting = "Bonjour, bienvenue ! Je vous écoute pour vos questions concernant l'annonce."
            else:
                greeting = "Salut ! Alors, de quoi voulais-tu me parler pour ce projet ?"
        await examiner.send_text_turn(greeting)

        audio_chunk_count = 0
        while True:
            msg = await websocket.receive_json()
            msg_type = msg.get("type") or msg.get("action")

            if msg_type in ("audio", "audio_chunk"):
                audio_chunk_count += 1
                raw_b64 = msg.get("data", "")
                mime = msg.get("mime_type", "audio/pcm;rate=16000")
                if audio_chunk_count == 1 or audio_chunk_count % 30 == 0:
                    logger.info("admin_live_ws_received_audio_chunk", count=audio_chunk_count, chunk_len=len(raw_b64))
                if raw_b64:
                    await examiner.send_audio_chunk(raw_b64, mime_type=mime)

            elif msg_type in ("text", "text_turn", "text_message"):
                text = msg.get("text", "")
                if text:
                    await examiner.send_text_turn(text)

            elif msg_type in ("interruption", "interrupted"):
                await examiner.send_interruption()

            elif msg_type == "end_exam":
                transcript = examiner.get_full_transcript()
                evaluator = GeminiSpeakingEvaluator()
                eval_result = await evaluator.evaluate_session(
                    topic=topic,
                    level=level,
                    transcript=transcript,
                )
                await websocket.send_json({
                    "type": "report_card",
                    "action": "report_card",
                    "data": {
                        "tef_points": eval_result.tef_points,
                        "cefr_level": eval_result.estimated_level,
                        "score": eval_result.overall_score,
                        "pronunciation_fluency": eval_result.fluency,
                        "lexical_resource": eval_result.vocabulary,
                        "grammatical_accuracy": eval_result.grammar,
                        "interaction_coherence": eval_result.coherence,
                        "strengths": eval_result.strengths,
                        "weaknesses": eval_result.weaknesses,
                        "recommendations": eval_result.recommendations,
                        "examiner_feedback": eval_result.detailed_feedback or "Entretien satisfaisant.",
                    },
                })
                break

    except WebSocketDisconnect:
        logger.info("admin_live_ws_client_disconnected")
    except Exception as exc:  # noqa: BLE001
        logger.error("admin_live_ws_error", error=str(exc))
    finally:
        if pump_task:
            pump_task.cancel()
        await examiner.close()

