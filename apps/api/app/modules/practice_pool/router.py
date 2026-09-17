"""FastAPI REST and WebSocket Router for Practice Pool and Audio-Only WebRTC Signaling."""

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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AppException
from app.modules.auth.dependencies import get_current_user
from app.modules.practice_pool.enums import PracticeRequestStatus
from app.modules.practice_pool.models import PracticeBlock, PracticeRequest, PracticeSession
from app.modules.practice_pool.schemas import (
    PracticeBlockCreate,
    PracticeBlockResponse,
    PracticeQueueJoin,
    PracticeQueueStatusResponse,
    PracticeReportCreate,
    PracticeReportResponse,
    PracticeRequestCreate,
    PracticeRequestResponse,
    PracticeSessionDetailResponse,
    PracticeSessionResponse,
)
from app.modules.practice_pool.service import (
    PracticePoolService,
    _ensure_utc,
    media_room_provider,
)
from app.modules.speaking.signaling import signaling_manager
from app.modules.users.models import User

logger = structlog.get_logger("tef-api.practice_pool.router")

router = APIRouter(prefix="/practice", tags=["Practice Pool"])


def _calculate_remaining_seconds(session: PracticeSession) -> int | None:
    """Calculate remaining seconds for active practice session."""
    expires_at = _ensure_utc(session.expires_at)
    if session.starts_at and expires_at:
        now_utc = datetime.datetime.now(datetime.UTC)
        remaining = int((expires_at - now_utc).total_seconds())
        return max(0, remaining)
    return None


def _serialize_session(
    session: PracticeSession, current_user_id: uuid.UUID
) -> PracticeSessionResponse:
    """Serialize session with anonymous peer alias and no personal identifier exposure."""
    my_alias = (
        session.student_a_alias
        if session.student_a_id == current_user_id
        else session.student_b_alias
    )
    peer_alias = (
        session.student_b_alias
        if session.student_a_id == current_user_id
        else session.student_a_alias
    )
    return PracticeSessionResponse(
        id=session.id,
        match_id=session.match_id,
        room_id=session.room_id,
        my_alias=my_alias,
        peer_alias=peer_alias,
        language=session.language,
        level=session.level,
        practice_type=session.practice_type,
        duration_minutes=session.duration_minutes,
        status=session.status,
        starts_at=session.starts_at,
        expires_at=session.expires_at,
        remaining_seconds=_calculate_remaining_seconds(session),
        audio_only=True,
        created_at=session.created_at,
    )


# --- 1. Queue Management ---


@router.post(
    "/queue/join",
    response_model=PracticeQueueStatusResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Join practice matchmaking queue",
)
async def join_practice_queue(
    payload: PracticeQueueJoin,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PracticeQueueStatusResponse:
    """Join practice matchmaking queue anonymously."""
    return await PracticePoolService.join_queue(db, current_user, payload)


@router.post(
    "/queue/leave",
    status_code=status.HTTP_200_OK,
    summary="Leave practice matchmaking queue",
)
async def leave_practice_queue(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Remove current user from matchmaking queue."""
    await PracticePoolService.leave_queue(db, current_user)
    return {"message": "Successfully left practice queue"}


@router.get(
    "/queue/status",
    response_model=PracticeQueueStatusResponse,
    summary="Get current queue status and compatible candidates",
)
async def get_practice_queue_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PracticeQueueStatusResponse:
    """Poll queue status and view available anonymous peers."""
    return await PracticePoolService.get_queue_status(db, current_user)


# --- 2. 1-to-1 Practice Requests ---


@router.post(
    "/requests",
    response_model=PracticeRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send 1-to-1 practice request to candidate",
)
async def create_practice_request(
    payload: PracticeRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PracticeRequestResponse:
    """Send practice request to an anonymous candidate in the queue."""
    req = await PracticePoolService.create_request(db, current_user, payload.candidate_queue_id)
    return PracticeRequestResponse(
        id=req.id,
        sender_alias=req.sender_alias,
        receiver_alias=req.receiver_alias,
        language=req.language,
        level=req.level,
        practice_type=req.practice_type,
        status=req.status,
        expires_at=req.expires_at,
        created_at=req.created_at,
        is_incoming=False,
    )


@router.get(
    "/requests/incoming",
    response_model=list[PracticeRequestResponse],
    summary="List pending incoming practice requests",
)
async def list_incoming_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PracticeRequestResponse]:
    """Retrieve pending invitations received from other students."""
    now_utc = datetime.datetime.now(datetime.UTC)
    stmt = (
        select(PracticeRequest)
        .where(
            PracticeRequest.receiver_id == current_user.id,
            PracticeRequest.status == PracticeRequestStatus.PENDING,
            PracticeRequest.expires_at > now_utc,
        )
        .order_by(PracticeRequest.created_at.desc())
    )
    requests = (await db.execute(stmt)).scalars().all()
    return [
        PracticeRequestResponse(
            id=r.id,
            sender_alias=r.sender_alias,
            receiver_alias=r.receiver_alias,
            language=r.language,
            level=r.level,
            practice_type=r.practice_type,
            status=r.status,
            expires_at=r.expires_at,
            created_at=r.created_at,
            is_incoming=True,
        )
        for r in requests
    ]


@router.get(
    "/requests/outgoing",
    response_model=list[PracticeRequestResponse],
    summary="List pending outgoing practice requests",
)
async def list_outgoing_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PracticeRequestResponse]:
    """Retrieve pending invitations sent to other students."""
    now_utc = datetime.datetime.now(datetime.UTC)
    stmt = (
        select(PracticeRequest)
        .where(
            PracticeRequest.sender_id == current_user.id,
            PracticeRequest.status == PracticeRequestStatus.PENDING,
            PracticeRequest.expires_at > now_utc,
        )
        .order_by(PracticeRequest.created_at.desc())
    )
    requests = (await db.execute(stmt)).scalars().all()
    return [
        PracticeRequestResponse(
            id=r.id,
            sender_alias=r.sender_alias,
            receiver_alias=r.receiver_alias,
            language=r.language,
            level=r.level,
            practice_type=r.practice_type,
            status=r.status,
            expires_at=r.expires_at,
            created_at=r.created_at,
            is_incoming=False,
        )
        for r in requests
    ]


@router.post(
    "/requests/{request_id}/accept",
    response_model=PracticeSessionResponse,
    summary="Accept practice request and start session",
)
async def accept_practice_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PracticeSessionResponse:
    """Accept invitation and create authoritative audio-only practice session."""
    session = await PracticePoolService.accept_request(db, current_user, request_id)
    return _serialize_session(session, current_user.id)


@router.post(
    "/requests/{request_id}/reject",
    status_code=status.HTTP_200_OK,
    summary="Reject practice request",
)
async def reject_practice_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Decline practice request."""
    await PracticePoolService.reject_request(db, current_user, request_id)
    return {"message": "Practice request rejected"}


@router.post(
    "/requests/{request_id}/cancel",
    status_code=status.HTTP_200_OK,
    summary="Cancel practice request",
)
async def cancel_practice_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Cancel pending request previously sent."""
    await PracticePoolService.cancel_request(db, current_user, request_id)
    return {"message": "Practice request cancelled"}


# --- 3. Sessions & Safety ---


@router.get(
    "/sessions/{session_id}",
    response_model=PracticeSessionDetailResponse,
    summary="Get practice session details and ICE servers",
)
async def get_practice_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PracticeSessionDetailResponse:
    """Retrieve session details, countdown, and STUN/TURN servers."""
    session = await PracticePoolService.get_session_by_id(db, session_id, current_user)
    base_res = _serialize_session(session, current_user.id)
    ice_servers = [s.model_dump() for s in media_room_provider.get_ice_servers()]
    return PracticeSessionDetailResponse(**base_res.model_dump(), ice_servers=ice_servers)


@router.post(
    "/sessions/{session_id}/leave",
    response_model=PracticeSessionResponse,
    summary="Leave active practice session",
)
async def leave_practice_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PracticeSessionResponse:
    """Conclude participation in active practice session."""
    session = await PracticePoolService.leave_session(db, session_id, current_user)
    return _serialize_session(session, current_user.id)


@router.post(
    "/sessions/{session_id}/report",
    response_model=PracticeReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Report unruly practice peer",
)
async def report_practice_peer(
    session_id: uuid.UUID,
    payload: PracticeReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PracticeReportResponse:
    """File an anonymous report regarding the practice session peer."""
    report = await PracticePoolService.report_user(db, current_user, session_id, payload)
    return PracticeReportResponse(
        id=report.id,
        reason=report.reason,
        status=report.status,
        created_at=report.created_at,
    )


@router.post(
    "/sessions/{session_id}/block-peer",
    response_model=PracticeBlockResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Block session peer",
)
async def block_practice_peer(
    session_id: uuid.UUID,
    payload: PracticeBlockCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PracticeBlockResponse:
    """Block the other student in the session from ever being matched again."""
    session = await PracticePoolService.get_session_by_id(db, session_id, current_user)
    peer_id = (
        session.student_b_id if session.student_a_id == current_user.id else session.student_a_id
    )
    block = await PracticePoolService.block_user(db, current_user, peer_id, payload.reason)
    return PracticeBlockResponse(
        id=block.id,
        blocked_user_id=block.blocked_user_id,
        reason=block.reason,
        created_at=block.created_at,
    )


@router.get(
    "/blocks",
    response_model=list[PracticeBlockResponse],
    summary="List blocked peers",
)
async def list_practice_blocks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PracticeBlockResponse]:
    """Retrieve list of users blocked by current student."""
    stmt = (
        select(PracticeBlock)
        .where(PracticeBlock.user_id == current_user.id)
        .order_by(PracticeBlock.created_at.desc())
    )
    blocks = (await db.execute(stmt)).scalars().all()
    return [
        PracticeBlockResponse(
            id=b.id,
            blocked_user_id=b.blocked_user_id,
            reason=b.reason,
            created_at=b.created_at,
        )
        for b in blocks
    ]


@router.delete(
    "/blocks/{blocked_user_id}",
    status_code=status.HTTP_200_OK,
    summary="Unblock peer",
)
async def unblock_practice_peer(
    blocked_user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Remove peer from blocklist."""
    stmt = select(PracticeBlock).where(
        PracticeBlock.user_id == current_user.id,
        PracticeBlock.blocked_user_id == blocked_user_id,
    )
    block = (await db.execute(stmt)).scalar_one_or_none()
    if block:
        await db.delete(block)
        await db.commit()
    return {"message": "Peer unblocked successfully"}


# --- 4. WebRTC WebSocket Signaling (Strict Audio-Only) ---


@router.websocket("/ws/{room_id}")
async def practice_webrtc_signaling_ws(
    websocket: WebSocket,
    room_id: str,
    token: str | None = Query(None, description="Bearer JWT access token for authentication"),
    db: AsyncSession = Depends(get_db),
) -> None:
    """WebSocket endpoint for audio-only WebRTC signaling between matched students.

    Live audio is NEVER sent through this endpoint. Audio flows peer-to-peer over WebRTC.
    Camera/video track negotiation is strictly forbidden.
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
        logger.warning("practice_ws_missing_credentials", room_id=room_id)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        session, user, alias = await PracticePoolService.authorize_room_connection(
            db=db,
            room_id=room_id,
            token=auth_token,
        )
    except AppException as exc:
        logger.warning(
            "practice_ws_auth_rejected",
            room_id=room_id,
            code=exc.code,
            message=exc.message,
        )
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    except Exception as exc:  # noqa: BLE001
        logger.error("practice_ws_error", room_id=room_id, error=str(exc))
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

    connection_id = f"conn_{uuid.uuid4().hex[:12]}"

    await signaling_manager.connect(
        room_id=room_id,
        connection_id=connection_id,
        websocket=websocket,
        user_id=str(user.id),
        display_name=alias,
    )

    try:
        # Send initial confirmation with audio_only constraint
        await websocket.send_json(
            {
                "action": "connected",
                "connection_id": connection_id,
                "room_id": room_id,
                "session_id": str(session.id),
                "my_alias": alias,
                "status": session.status.value,
                "audio_only": True,
            }
        )

        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            target_id = data.get("target_id")

            envelope = {
                "action": action,
                "sender_id": connection_id,
                "sender_alias": alias,
                "audio_only": True,
                "data": data.get("data", {}),
            }

            if target_id:
                await signaling_manager.send_to_peer(
                    room_id=room_id,
                    target_connection_id=target_id,
                    message=envelope,
                )
            else:
                await signaling_manager.broadcast(
                    room_id=room_id,
                    message=envelope,
                    exclude_connection_id=connection_id,
                )

    except WebSocketDisconnect:
        await signaling_manager.disconnect(room_id=room_id, connection_id=connection_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "practice_ws_connection_closed",
            room_id=room_id,
            connection_id=connection_id,
            error=str(exc),
        )
        await signaling_manager.disconnect(room_id=room_id, connection_id=connection_id)
