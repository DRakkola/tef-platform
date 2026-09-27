import asyncio
import base64
import datetime
import uuid

import structlog
from fastapi import (
    APIRouter,
    Depends,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.redis import RedisService
from app.core.storage import StorageService, get_storage
from app.modules.admin.speaking_config_models import SpeakingExaminerConfig
from app.modules.auth.dependencies import get_current_user
from app.modules.speaking.audio import save_turn_audio
from app.modules.speaking.enums import (
    ExamSectionType,
    SpeakingExamState,
    SpeakingSectionState,
    SpeakingSessionType,
    SpeakingTurnSpeaker,
    TranscriptStatus,
)
from app.modules.speaking.exam_service import SpeakingExamService
from app.modules.speaking.models import (
    SpeakingExam,
    SpeakingSection,
    SpeakingSession,
    SpeakingTurn,
)
from app.modules.speaking.providers.gemini_live import GeminiLiveExaminer
from app.modules.speaking.schemas import (
    SpeakingEvaluationResponse,
    SpeakingExamCreate,
    SpeakingExamListResponse,
    SpeakingExamResponse,
    SpeakingExamStateResponse,
    SpeakingParticipantResponse,
    SpeakingSectionResponse,
    SpeakingSessionCreate,
    SpeakingSessionDetailResponse,
    SpeakingSessionListResponse,
    SpeakingSessionResponse,
    SpeakingTurnAudioResponse,
    SpeakingTurnCreate,
    SpeakingTurnResponse,
    TeacherEvaluationCreate,
)
from app.modules.speaking.service import (
    SpeakingService,
    media_room_provider,
)
from app.modules.speaking.signaling import signaling_manager
from app.modules.users.models import User, UserRole

logger = structlog.get_logger("tef-api.speaking.router")

router = APIRouter(prefix="/speaking", tags=["Speaking"])


def _ensure_utc(dt: datetime.datetime | None) -> datetime.datetime | None:
    """Ensure datetime is timezone-aware in UTC (normalizes offset-naive SQLite datetimes)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.UTC)
    return dt


def _calculate_remaining_seconds(session: SpeakingSession) -> int | None:
    """Calculate remaining time for active session."""
    expires_at = _ensure_utc(session.expires_at)
    if session.starts_at and expires_at:
        now_utc = datetime.datetime.now(datetime.UTC)
        remaining = int((expires_at - now_utc).total_seconds())
        return max(0, remaining)
    return None


def _serialize_session(session: SpeakingSession) -> SpeakingSessionResponse:
    """Serialize session model to standard response."""
    return SpeakingSessionResponse(
        id=session.id,
        session_type=session.session_type,
        status=session.status,
        topic=session.topic,
        level=session.level,
        duration_minutes=session.duration_minutes,
        starts_at=session.starts_at,
        expires_at=session.expires_at,
        remaining_seconds=_calculate_remaining_seconds(session),
        room_id=session.room_id,
        exam_id=session.exam.id if getattr(session, "exam", None) else None,
        participants=[SpeakingParticipantResponse.model_validate(p) for p in session.participants],
        created_at=session.created_at,
    )


def _serialize_exam(exam: SpeakingExam) -> SpeakingExamResponse:
    """Serialize SpeakingExam model with sections, timers, and turn counts."""
    now = datetime.datetime.now(datetime.UTC)
    sections_resp = []
    for s in exam.sections:
        s_resp = SpeakingSectionResponse.model_validate(s)
        s_expires = _ensure_utc(s.expires_at)
        if s.status == SpeakingSectionState.ACTIVE and s_expires:
            delta = (s_expires - now).total_seconds()
            s_resp.remaining_seconds = max(0, int(delta))
        elif s.status == SpeakingSectionState.PENDING:
            s_resp.remaining_seconds = s.duration_seconds
        else:
            s_resp.remaining_seconds = 0
        s_resp.turns = [SpeakingTurnResponse.model_validate(t) for t in s.turns]
        sections_resp.append(s_resp)

    return SpeakingExamResponse(
        id=exam.id,
        student_id=exam.student_id,
        session_id=exam.session_id,
        status=exam.status,
        current_section_type=exam.current_section_type,
        topic=exam.topic,
        target_level=exam.target_level,
        total_duration_minutes=exam.total_duration_minutes,
        started_at=exam.started_at,
        completed_at=exam.completed_at,
        room_id=exam.session.room_id if exam.session else None,
        sections=sections_resp,
        evaluation=SpeakingEvaluationResponse.model_validate(exam.evaluation) if exam.evaluation else None,
        created_at=exam.created_at,
    )


@router.post(
    "/sessions",
    response_model=SpeakingSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new speaking session",
)
async def create_speaking_session(
    payload: SpeakingSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingSessionResponse:
    """Create a new AI or Teacher speaking session with default 25-minute duration."""
    session = await SpeakingService.create_session(db, current_user, payload)
    if payload.session_type == SpeakingSessionType.AI:
        try:
            from app.modules.speaking.providers.gemini_live import build_examiner_instructions
            exam = SpeakingExam(
                student_id=current_user.id,
                session_id=session.id,
                status=SpeakingExamState.CREATED,
                current_section_type=ExamSectionType.SECTION_A,
                topic=payload.topic,
                target_level=payload.level,
                total_duration_minutes=payload.duration_minutes,
                config_version="v1",
            )
            db.add(exam)
            await db.flush()
            session.exam = exam

            sec_a_prompt = build_examiner_instructions(
                topic=payload.topic,
                level=payload.level,
                scepticism_level=0.5,
                section=ExamSectionType.SECTION_A,
            )
            sec_b_prompt = build_examiner_instructions(
                topic=payload.topic,
                level=payload.level,
                scepticism_level=0.75,
                section=ExamSectionType.SECTION_B,
            )
            sec_a = SpeakingSection(
                exam_id=exam.id,
                section_type=ExamSectionType.SECTION_A,
                sequence=1,
                title="Section A : Demande d'informations formelle",
                description="Posez une dizaine de questions formelles pour obtenir des renseignements détaillés sur l'annonce.",
                prompt_topic=payload.topic,
                prompt_context="Vous téléphonez pour obtenir des renseignements sur l'annonce.",
                examiner_persona="Aoede",
                system_prompt=sec_a_prompt,
                duration_seconds=600,
                status=SpeakingSectionState.PENDING,
            )
            sec_b = SpeakingSection(
                exam_id=exam.id,
                section_type=ExamSectionType.SECTION_B,
                sequence=2,
                title="Section B : Argumentation et persuasion",
                description="Convainquez votre ami(e) d'adhérer à votre projet en surmontant ses objections avec tact.",
                prompt_topic=payload.topic,
                prompt_context="Vous essayez de convaincre votre ami(e).",
                examiner_persona="Fenrir",
                system_prompt=sec_b_prompt,
                duration_seconds=900,
                status=SpeakingSectionState.PENDING,
            )
            db.add_all([sec_a, sec_b])
            await db.commit()
        except Exception as exc:  # noqa: BLE001
            logger.warning("sync_speaking_exam_for_session_failed", session_id=str(session.id), error=str(exc))

    return _serialize_session(session)


@router.get(
    "/sessions",
    response_model=SpeakingSessionListResponse,
    summary="List user speaking sessions",
)
async def list_speaking_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingSessionListResponse:
    """Retrieve speaking sessions for the current authenticated user."""
    sessions = await SpeakingService.list_user_sessions(db, current_user)
    items = [_serialize_session(s) for s in sessions]
    return SpeakingSessionListResponse(items=items, total=len(items))


@router.get(
    "/sessions/{session_id}",
    response_model=SpeakingSessionDetailResponse,
    summary="Get speaking session detail and ICE candidates",
)
async def get_speaking_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingSessionDetailResponse:
    """Get session details, remaining seconds, participants, and WebRTC STUN/TURN servers."""
    session = await SpeakingService.get_session_by_id(db, session_id, current_user)
    base_response = _serialize_session(session)
    ice_servers = [s.model_dump() for s in media_room_provider.get_ice_servers()]

    eval_response = (
        SpeakingEvaluationResponse.model_validate(session.evaluation)
        if session.evaluation
        else None
    )

    return SpeakingSessionDetailResponse(
        **base_response.model_dump(),
        ice_servers=ice_servers,
        evaluation=eval_response,
    )


@router.post(
    "/sessions/{session_id}/start",
    response_model=SpeakingSessionResponse,
    summary="Start speaking session and activate server timer",
)
async def start_speaking_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingSessionResponse:
    """Activate speaking session. Server strictly owns starts_at and expires_at countdown."""
    session = await SpeakingService.start_session(db, session_id, current_user)
    return _serialize_session(session)


@router.post(
    "/sessions/{session_id}/complete",
    response_model=SpeakingSessionResponse,
    summary="Complete speaking session",
)
async def complete_speaking_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingSessionResponse:
    """Complete speaking session and trigger post-session evaluation."""
    session = await SpeakingService.complete_session(db, session_id, current_user)
    return _serialize_session(session)


@router.post(
    "/sessions/{session_id}/cancel",
    response_model=SpeakingSessionResponse,
    summary="Cancel speaking session",
)
async def cancel_speaking_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingSessionResponse:
    """Cancel scheduled speaking session."""
    session = await SpeakingService.cancel_session(db, session_id, current_user)
    return _serialize_session(session)


@router.get(
    "/sessions/{session_id}/evaluation",
    response_model=SpeakingEvaluationResponse,
    summary="Get speaking evaluation results",
)
async def get_speaking_evaluation(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingEvaluationResponse:
    """Retrieve structured post-session evaluation and skill diagnostics."""
    session = await SpeakingService.get_session_by_id(db, session_id, current_user)
    if not session.evaluation:
        raise AppException(
            message="No evaluation found for this speaking session yet",
            code="EVALUATION_NOT_FOUND",
            status_code=404,
        )
    return SpeakingEvaluationResponse.model_validate(session.evaluation)


@router.post(
    "/sessions/{session_id}/evaluation",
    response_model=SpeakingEvaluationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Teacher submits speaking evaluation",
)
async def submit_teacher_evaluation(
    session_id: uuid.UUID,
    payload: TeacherEvaluationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingEvaluationResponse:
    """Teacher submits structured evaluation for a speaking session."""
    evaluation = await SpeakingService.submit_teacher_evaluation(
        db=db,
        session_id=session_id,
        teacher_user=current_user,
        payload=payload,
    )
    return SpeakingEvaluationResponse.model_validate(evaluation)


# --- WebRTC WebSocket Signaling ---


@router.websocket("/ws/{room_id}")
async def speaking_webrtc_signaling_ws(
    websocket: WebSocket,
    room_id: str,
    token: str | None = Query(None, description="Bearer JWT access token for authentication"),
    db: AsyncSession = Depends(get_db),
) -> None:
    """WebSocket endpoint for WebRTC signaling (offer, answer, ICE candidates, room events).

    Live audio is NEVER sent through this endpoint. Audio flows peer-to-peer over WebRTC.
    """
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
        logger.warning("webrtc_ws_missing_credentials", room_id=room_id)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        session, user, participant = await SpeakingService.authorize_room_connection(
            db=db,
            room_id=room_id,
            token=auth_token,
        )
    except AppException as exc:
        logger.warning(
            "webrtc_ws_auth_rejected",
            room_id=room_id,
            code=exc.code,
            message=exc.message,
        )
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    except Exception as exc:  # noqa: BLE001
        logger.error("webrtc_ws_error", room_id=room_id, error=str(exc))
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

    connection_id = f"conn_{uuid.uuid4().hex[:12]}"
    display_name = participant.display_name if participant else user.email

    await signaling_manager.connect(
        room_id=room_id,
        connection_id=connection_id,
        websocket=websocket,
        user_id=str(user.id),
        display_name=display_name,
    )

    exam = await SpeakingExamService.get_exam_by_session_id(db, session.id, user_id=user.id)
    current_sec_type = exam.current_section_type if (exam and exam.current_section_type) else ExamSectionType.SECTION_A

    gemini_examiner: GeminiLiveExaminer | None = None
    gemini_pump_task: asyncio.Task | None = None

    if session.session_type == SpeakingSessionType.AI and settings.GEMINI_API_KEY:
        sec_key = current_sec_type.value
        cfg_query = await db.execute(select(SpeakingExaminerConfig).where(SpeakingExaminerConfig.section == sec_key))
        active_cfg = cfg_query.scalar_one_or_none()

        active_sec = (
            next((s for s in exam.sections if s.section_type == current_sec_type), None)
            if (exam and exam.sections)
            else None
        )

        resolved_prompt = (
            active_sec.system_prompt
            if (active_sec and active_sec.system_prompt)
            else (active_cfg.system_prompt if active_cfg else None)
        )
        resolved_topic = (
            active_sec.prompt_topic
            if (active_sec and active_sec.prompt_topic)
            else session.topic
        )
        resolved_voice = (
            active_sec.examiner_persona
            if (active_sec and active_sec.examiner_persona)
            else (active_cfg.voice_persona if active_cfg else "Aoede")
        )

        gemini_examiner = GeminiLiveExaminer(
            session_id=session.id,
            topic=resolved_topic,
            level=session.level,
            model=active_cfg.model if active_cfg else None,
            voice_persona=resolved_voice,
            scepticism_level=active_cfg.scepticism_level if active_cfg else (0.2 if sec_key == "section_a" else 0.65),
            system_prompt=resolved_prompt,
            temperature=active_cfg.temperature if active_cfg else 0.7,
            top_p=active_cfg.top_p if active_cfg else 0.95,
        )
        is_live_connected = await gemini_examiner.connect()

    # Per-turn audio and transcript buffers
    candidate_audio_chunks: list[bytes] = []
    candidate_current_client_turn_id: str | None = None
    candidate_text_parts: list[str] = []
    examiner_audio_chunks: list[bytes] = []
    examiner_text_parts: list[str] = []

    async def _flush_candidate_turn(candidate_text: str | None = None, client_turn_id: str | None = None) -> None:
        nonlocal candidate_audio_chunks, candidate_current_client_turn_id, candidate_text_parts
        pcm_bytes = b"".join(candidate_audio_chunks)
        candidate_audio_chunks.clear()
        c_tid = client_turn_id or candidate_current_client_turn_id
        candidate_current_client_turn_id = None
        full_candidate_text = candidate_text or " ".join(candidate_text_parts).strip() or None
        candidate_text_parts.clear()

        if not exam or (not pcm_bytes and not full_candidate_text):
            return

        storage = get_storage()
        audio_key = None
        duration = None
        if pcm_bytes:
            try:
                max_t_stmt = select(func.max(SpeakingTurn.turn_number)).join(SpeakingSection).where(
                    SpeakingSection.exam_id == exam.id,
                    SpeakingSection.section_type == current_sec_type,
                )
                max_t = (await db.scalar(max_t_stmt)) or 0
                next_t = max_t + 1
                audio_key, duration = save_turn_audio(
                    storage=storage,
                    exam_id=exam.id,
                    section_type=current_sec_type.value,
                    turn_number=next_t,
                    speaker="candidate",
                    pcm_bytes=pcm_bytes,
                    sample_rate=16000,
                )
            except Exception as a_err:  # noqa: BLE001
                logger.warning("save_candidate_audio_failed", error=str(a_err))

        t_status = TranscriptStatus.COMPLETED if (full_candidate_text and full_candidate_text.strip()) else (
            TranscriptStatus.EMPTY if not full_candidate_text else TranscriptStatus.COMPLETED
        )

        try:
            await SpeakingExamService.record_turn(
                db=db,
                exam_id=exam.id,
                section_type=current_sec_type,
                turn_data=SpeakingTurnCreate(
                    speaker=SpeakingTurnSpeaker.CANDIDATE,
                    content_text=full_candidate_text,
                    transcript_status=t_status,
                    audio_storage_key=audio_key,
                    audio_duration_seconds=duration,
                    client_turn_id=c_tid,
                ),
                user_id=user.id,
            )
        except Exception as t_err:  # noqa: BLE001
            logger.debug("record_candidate_turn_ignored", error=str(t_err))

    async def _flush_examiner_turn(interrupted: bool = False) -> None:
        nonlocal examiner_audio_chunks, examiner_text_parts
        pcm_bytes = b"".join(examiner_audio_chunks)
        examiner_audio_chunks.clear()
        full_text = " ".join(examiner_text_parts).strip()
        examiner_text_parts.clear()

        if not exam or (not pcm_bytes and not full_text):
            return

        storage = get_storage()
        audio_key = None
        duration = None
        if pcm_bytes:
            try:
                max_t_stmt = select(func.max(SpeakingTurn.turn_number)).join(SpeakingSection).where(
                    SpeakingSection.exam_id == exam.id,
                    SpeakingSection.section_type == current_sec_type,
                )
                max_t = (await db.scalar(max_t_stmt)) or 0
                next_t = max_t + 1
                audio_key, duration = save_turn_audio(
                    storage=storage,
                    exam_id=exam.id,
                    section_type=current_sec_type.value,
                    turn_number=next_t,
                    speaker="examiner",
                    pcm_bytes=pcm_bytes,
                    sample_rate=24000,
                )
            except Exception as a_err:  # noqa: BLE001
                logger.warning("save_examiner_audio_failed", error=str(a_err))

        t_status = TranscriptStatus.COMPLETED if full_text else TranscriptStatus.EMPTY
        try:
            await SpeakingExamService.record_turn(
                db=db,
                exam_id=exam.id,
                section_type=current_sec_type,
                turn_data=SpeakingTurnCreate(
                    speaker=SpeakingTurnSpeaker.EXAMINER,
                    content_text=full_text or None,
                    transcript_status=t_status,
                    audio_storage_key=audio_key,
                    audio_duration_seconds=duration,
                    interrupted=interrupted,
                    interruption_reason="candidate_interrupted" if interrupted else None,
                ),
                user_id=user.id,
            )
        except Exception as t_err:  # noqa: BLE001
            logger.debug("record_examiner_turn_ignored", error=str(t_err))

    if gemini_examiner and is_live_connected:
        async def pump_gemini_to_client():
            try:
                assert gemini_examiner is not None
                async for event in gemini_examiner.stream_responses():
                    await websocket.send_json(event)
                    e_type = event.get("type")

                    if e_type == "audio":
                        if candidate_audio_chunks:
                            await _flush_candidate_turn()
                        raw_b64 = event.get("data", "")
                        if raw_b64:
                            try:
                                examiner_audio_chunks.append(base64.b64decode(raw_b64))
                            except Exception:  # noqa: BLE001, S110
                                pass

                    elif e_type == "transcript":
                        role = event.get("role")
                        t_text = event.get("text", "")
                        if t_text:
                            if role == "examiner":
                                examiner_text_parts.append(t_text)
                            elif role == "candidate":
                                candidate_text_parts.append(t_text)

                    elif e_type in ("turn_complete", "turn_change"):
                        await _flush_examiner_turn(interrupted=False)

                    elif e_type == "interrupted":
                        await _flush_examiner_turn(interrupted=True)

            except Exception as exc:  # noqa: BLE001
                logger.warning("gemini_pump_error", session_id=str(session.id), error=str(exc))

        gemini_pump_task = asyncio.create_task(pump_gemini_to_client())

        # Initial greeting prompt to trigger natural spoken French opening from examiner
        if current_sec_type == ExamSectionType.SECTION_A:
            init_prompt = (
                "L'épreuve commence. Salue poliment le candidat en utilisant le vouvoiement formel, "
                "indique que tu réponds au sujet de l'annonce et invite-le à te poser ses premières questions."
            )
        else:
            init_prompt = (
                "L'épreuve commence. Salue chaleureusement ton ami(e) candidat(e) en utilisant le tutoiement, "
                "demande-lui des nouvelles et demande-lui ce dont il ou elle voulait te parler."
            )
        await gemini_examiner.send_text_turn(init_prompt)

    try:
        # Send initial confirmation to connected client with exam and section context
        await websocket.send_json(
            {
                "action": "connected",
                "connection_id": connection_id,
                "room_id": room_id,
                "session_id": str(session.id),
                "exam_id": str(exam.id) if exam else None,
                "section": current_sec_type.value,
                "status": session.status.value,
                "is_ai_live": bool(gemini_examiner and is_live_connected),
            }
        )

        audio_chunk_count = 0
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            target_id = data.get("target_id")

            # Route student audio/text directly to Gemini Live Examiner
            if action == "audio_chunk":
                audio_chunk_count += 1
                pcm_chunk = data.get("data", "")
                mime = data.get("mime_type", "audio/pcm;rate=16000")

                if examiner_audio_chunks:
                    # Candidate spoke while examiner was speaking: candidate interrupted examiner
                    await _flush_examiner_turn(interrupted=True)

                if pcm_chunk:
                    try:
                        candidate_audio_chunks.append(base64.b64decode(pcm_chunk))
                    except Exception:  # noqa: BLE001, S110
                        pass

                if data.get("client_turn_id"):
                    candidate_current_client_turn_id = data.get("client_turn_id")

                if audio_chunk_count == 1 or audio_chunk_count % 30 == 0:
                    logger.info(
                        "webrtc_ws_student_audio_chunk",
                        count=audio_chunk_count,
                        room_id=room_id,
                        chunk_len=len(pcm_chunk),
                        has_gemini=bool(gemini_examiner),
                    )
                if gemini_examiner and pcm_chunk:
                    await gemini_examiner.send_audio_chunk(pcm_chunk, mime_type=mime)
                continue

            if action == "candidate_turn_complete":
                user_text = data.get("text")
                client_tid = data.get("client_turn_id")
                await _flush_candidate_turn(candidate_text=user_text, client_turn_id=client_tid)
                continue

            if gemini_examiner and action in ("text_turn", "text_message"):
                user_text = data.get("text", "")
                if user_text:
                    await gemini_examiner.send_text_turn(user_text)
                    await _flush_candidate_turn(candidate_text=user_text, client_turn_id=data.get("client_turn_id"))
                continue

            envelope = {
                "action": action,
                "sender_id": connection_id,
                "data": data.get("data", {}),
            }

            if target_id:
                # Directed signaling (e.g. SDP offer/answer or candidate to specific peer)
                await signaling_manager.send_to_peer(
                    room_id=room_id,
                    target_connection_id=target_id,
                    message=envelope,
                )
            else:
                # Room-wide event (e.g. state change, mute, ping)
                await signaling_manager.broadcast(
                    room_id=room_id,
                    message=envelope,
                    exclude_connection_id=connection_id,
                )

    except WebSocketDisconnect:
        await signaling_manager.disconnect(room_id=room_id, connection_id=connection_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "webrtc_ws_connection_closed",
            room_id=room_id,
            connection_id=connection_id,
            error=str(exc),
        )
        await signaling_manager.disconnect(room_id=room_id, connection_id=connection_id)
    finally:
        if gemini_pump_task:
            gemini_pump_task.cancel()
        if candidate_audio_chunks:
            try:
                await _flush_candidate_turn()
            except Exception:  # noqa: BLE001, S110
                pass
        if examiner_audio_chunks or examiner_text_parts:
            try:
                await _flush_examiner_turn(interrupted=False)
            except Exception:  # noqa: BLE001, S110
                pass
        if gemini_examiner:
            full_transcript = gemini_examiner.get_full_transcript()
            if full_transcript:
                try:
                    redis_svc = RedisService(settings.REDIS_URL)
                    await redis_svc.set(f"speaking_transcript:{session.id}", full_transcript, expire=86400)
                except Exception as r_exc:  # noqa: BLE001
                    logger.warning("failed_saving_transcript_redis", error=str(r_exc))
            await gemini_examiner.close()


# ---------------------------------------------------------------------------
# Structured TEF Speaking Exam Endpoints (Phase 2)
# ---------------------------------------------------------------------------
@router.post(
    "/exams",
    response_model=SpeakingExamResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new structured TEF Speaking Exam",
)
async def create_speaking_exam(
    payload: SpeakingExamCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingExamResponse:
    """Create a structured TEF Speaking Exam with Section A (10 min) and Section B (15 min)."""
    exam = await SpeakingExamService.create_exam(db, current_user.id, payload)
    return _serialize_exam(exam)


@router.get(
    "/exams",
    response_model=SpeakingExamListResponse,
    summary="List current student's speaking exams",
)
async def list_speaking_exams(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingExamListResponse:
    """List historical and active exams for current student."""
    items, total = await SpeakingExamService.list_student_exams(
        db, current_user.id, limit=limit, offset=offset
    )
    return SpeakingExamListResponse(
        items=[_serialize_exam(e) for e in items],
        total=total,
    )


@router.get(
    "/exams/{exam_id}",
    response_model=SpeakingExamResponse,
    summary="Get full Speaking Exam details with sections and turns",
)
async def get_speaking_exam(
    exam_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingExamResponse:
    """Retrieve full exam detail including sections, prompt tasks, and turns."""
    exam = await SpeakingExamService.get_exam(db, exam_id, current_user.id)
    return _serialize_exam(exam)


@router.get(
    "/exams/{exam_id}/state",
    response_model=SpeakingExamStateResponse,
    summary="Get authoritative real-time state and timer for exam",
)
async def get_speaking_exam_state(
    exam_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingExamStateResponse:
    """Get authoritative countdown timer, active section, and transition permission."""
    return await SpeakingExamService.get_exam_state(db, exam_id, current_user.id)


@router.post(
    "/exams/{exam_id}/start",
    response_model=SpeakingExamResponse,
    summary="Start the exam and activate Section A",
)
async def start_speaking_exam(
    exam_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingExamResponse:
    """Start Section A with server-authoritative 10-minute timer. Idempotent."""
    exam = await SpeakingExamService.start_exam(db, exam_id, current_user.id)
    return _serialize_exam(exam)


@router.post(
    "/exams/{exam_id}/sections/{section_type}/start",
    response_model=SpeakingExamResponse,
    summary="Start a specific section (e.g. Section B)",
)
async def start_speaking_section(
    exam_id: uuid.UUID,
    section_type: ExamSectionType,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingExamResponse:
    """Start Section B (15-minute timer) following Section A completion. Idempotent."""
    exam = await SpeakingExamService.start_section(db, exam_id, section_type, current_user.id)
    return _serialize_exam(exam)


@router.post(
    "/exams/{exam_id}/sections/{section_type}/complete",
    response_model=SpeakingExamResponse,
    summary="Complete a section",
)
async def complete_speaking_section(
    exam_id: uuid.UUID,
    section_type: ExamSectionType,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingExamResponse:
    """Complete active section. Section A -> Section B prep; Section B -> exam complete. Idempotent."""
    exam = await SpeakingExamService.complete_section(db, exam_id, section_type, current_user.id)
    return _serialize_exam(exam)


@router.get(
    "/exams/{exam_id}/sections/{section_type}/turns",
    response_model=list[SpeakingTurnResponse],
    summary="List recorded turns for a section",
)
async def list_speaking_section_turns(
    exam_id: uuid.UUID,
    section_type: ExamSectionType,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SpeakingTurnResponse]:
    """Retrieve ordered turn history for a section."""
    turns = await SpeakingExamService.list_turns(db, exam_id, section_type, current_user.id)
    return [SpeakingTurnResponse.model_validate(t) for t in turns]


@router.post(
    "/exams/{exam_id}/sections/{section_type}/turns",
    response_model=SpeakingTurnResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a turn",
)
async def record_speaking_section_turn(
    exam_id: uuid.UUID,
    section_type: ExamSectionType,
    payload: SpeakingTurnCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpeakingTurnResponse:
    """Idempotently record a turn under the given section."""
    turn = await SpeakingExamService.record_turn(
        db, exam_id, section_type, payload, current_user.id
    )
    return SpeakingTurnResponse.model_validate(turn)


@router.get(
    "/exams/{exam_id}/sections/{section_type}/turns/{turn_id}/audio",
    response_model=SpeakingTurnAudioResponse,
    summary="Get temporary presigned URL for turn audio evidence",
)
async def get_turn_audio_url(
    exam_id: uuid.UUID,
    section_type: ExamSectionType,
    turn_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> SpeakingTurnAudioResponse:
    """Generate short-lived presigned URL for turn audio evidence.

    Verifies candidate ownership or teacher/admin authorization.
    """
    exam = await SpeakingExamService.get_exam(db, exam_id, current_user.id)
    if exam.student_id != current_user.id and current_user.role not in (
        UserRole.ADMIN,
        UserRole.TEACHER,
    ):
        raise AppException(
            message="You are not authorized to access this exam audio",
            code="FORBIDDEN",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    stmt = (
        select(SpeakingTurn)
        .join(SpeakingSection)
        .where(
            SpeakingTurn.id == turn_id,
            SpeakingSection.exam_id == exam_id,
            SpeakingSection.section_type == section_type,
        )
    )
    turn = (await db.execute(stmt)).scalar_one_or_none()
    if not turn:
        raise AppException(
            message=f"Turn {turn_id} not found in {section_type.value}",
            code="NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    if not turn.audio_storage_key:
        raise AppException(
            message="No audio recording available for this turn",
            code="NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    presigned_url = storage.generate_presigned_url(
        object_key=turn.audio_storage_key,
        expiration_seconds=3600,
    )
    return SpeakingTurnAudioResponse(
        audio_url=presigned_url,
        expires_in=3600,
        audio_storage_key=turn.audio_storage_key,
    )
