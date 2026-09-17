"""WebRTC WebSocket signaling connection manager for speaking media rooms."""

import structlog
from fastapi import WebSocket

logger = structlog.get_logger("tef-api.speaking.signaling")


class SignalingConnectionManager:
    """Manages active WebRTC signaling WebSocket connections per room."""

    def __init__(self) -> None:
        # room_id -> {connection_id: WebSocket}
        self.rooms: dict[str, dict[str, WebSocket]] = {}
        # connection_id -> {room_id, user_id, display_name}
        self.connection_meta: dict[str, dict[str, str]] = {}

    async def connect(
        self,
        room_id: str,
        connection_id: str,
        websocket: WebSocket,
        user_id: str,
        display_name: str,
    ) -> None:
        """Register newly connected participant in the media room."""
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = {}

        self.rooms[room_id][connection_id] = websocket
        self.connection_meta[connection_id] = {
            "room_id": room_id,
            "user_id": user_id,
            "display_name": display_name,
        }

        # Broadcast participant joined event to existing peers
        await self.broadcast(
            room_id=room_id,
            message={
                "action": "participant_joined",
                "connection_id": connection_id,
                "user_id": user_id,
                "display_name": display_name,
            },
            exclude_connection_id=connection_id,
        )

        logger.info(
            "webrtc_peer_connected",
            room_id=room_id,
            connection_id=connection_id,
            user_id=user_id,
        )

    async def disconnect(self, room_id: str, connection_id: str) -> None:
        """Unregister participant on WebSocket disconnect and notify room peers."""
        meta = self.connection_meta.pop(connection_id, None)

        if room_id in self.rooms and connection_id in self.rooms[room_id]:
            del self.rooms[room_id][connection_id]
            if not self.rooms[room_id]:
                del self.rooms[room_id]

        if meta:
            await self.broadcast(
                room_id=room_id,
                message={
                    "action": "participant_left",
                    "connection_id": connection_id,
                    "user_id": meta["user_id"],
                },
            )

        logger.info(
            "webrtc_peer_disconnected",
            room_id=room_id,
            connection_id=connection_id,
        )

    async def broadcast(
        self,
        room_id: str,
        message: dict,
        exclude_connection_id: str | None = None,
    ) -> None:
        """Broadcast JSON message to all peers in the room except optional sender."""
        peers = self.rooms.get(room_id, {})
        for peer_conn_id, peer_ws in list(peers.items()):
            if exclude_connection_id and peer_conn_id == exclude_connection_id:
                continue
            try:
                await peer_ws.send_json(message)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "webrtc_broadcast_failed",
                    room_id=room_id,
                    target_connection_id=peer_conn_id,
                    error=str(exc),
                )

    async def send_to_peer(
        self,
        room_id: str,
        target_connection_id: str,
        message: dict,
    ) -> bool:
        """Route directed signaling message (e.g. SDP offer/answer or ICE candidate) to a specific peer."""
        peers = self.rooms.get(room_id, {})
        target_ws = peers.get(target_connection_id)
        if target_ws:
            try:
                await target_ws.send_json(message)
                return True
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "webrtc_send_to_peer_failed",
                    room_id=room_id,
                    target_connection_id=target_connection_id,
                    error=str(exc),
                )
        return False


signaling_manager = SignalingConnectionManager()
