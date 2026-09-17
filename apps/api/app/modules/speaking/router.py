"""FastAPI REST and WebSocket Router for Speaking Sessions and WebRTC Signaling."""

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
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AppException
from app.modules.auth.dependencies import get_current_user
from app.modules.speaking.models import SpeakingSession
from app.modules.speaking.schemas import (
    SpeakingEvaluationResponse,
    SpeakingParticipantResponse,
    SpeakingSessionCreate,
    SpeakingSessionDetailResponse,
    SpeakingSessionListResponse,
    SpeakingSessionResponse,
    TeacherEvaluationCreate,
)
from app.modules.speaking.service import (
    SpeakingService,
    media_room_provider,
)
from app.modules.speaking.signaling import signaling_manager
from app.modules.users.models import User

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
        participants=[SpeakingParticipantResponse.model_validate(p) for p in session.participants],
        created_at=session.created_at,
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
    token: str = Query(..., description="Bearer JWT access token for authentication"),
    db: AsyncSession = Depends(get_db),
) -> None:
    """WebSocket endpoint for WebRTC signaling (offer, answer, ICE candidates, room events).

    Live audio is NEVER sent through this endpoint. Audio flows peer-to-peer over WebRTC.
    """
    try:
        session, user, participant = await SpeakingService.authorize_room_connection(
            db=db,
            room_id=room_id,
            token=token,
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

    try:
        # Send initial confirmation to connected client
        await websocket.send_json(
            {
                "action": "connected",
                "connection_id": connection_id,
                "room_id": room_id,
                "session_id": str(session.id),
                "status": session.status.value,
            }
        )

        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            target_id = data.get("target_id")

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
