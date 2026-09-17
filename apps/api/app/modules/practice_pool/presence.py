"""Ephemeral presence, queue management, and match locking for Practice Pool.

Uses Redis for live presence and atomic locks, with a self-contained in-memory
implementation for tests and local fallback. Authoritative session lifecycle is
always persisted in PostgreSQL.
"""

import asyncio
import json
import uuid
from dataclasses import asdict, dataclass
from typing import Protocol

import structlog

from app.core.redis import redis_service

logger = structlog.get_logger("tef-api.practice_pool.presence")


@dataclass
class QueueItem:
    """Ephemeral queue payload for waiting student."""

    user_id: str
    queue_id: str
    language: str
    level: str
    practice_type: str
    anonymous_alias: str
    joined_at: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, str]) -> QueueItem:
        return cls(
            user_id=data["user_id"],
            queue_id=data["queue_id"],
            language=data["language"],
            level=data["level"],
            practice_type=data["practice_type"],
            anonymous_alias=data["anonymous_alias"],
            joined_at=data["joined_at"],
        )


class PracticePresenceManager(Protocol):
    """Protocol for practice pool presence, live queue, and concurrency locking."""

    async def add_to_queue(self, item: QueueItem) -> None: ...
    async def remove_from_queue(self, user_id: uuid.UUID) -> None: ...
    async def get_queue_entry(self, user_id: uuid.UUID) -> QueueItem | None: ...
    async def get_all_waiting(self) -> list[QueueItem]: ...
    async def acquire_match_lock(
        self, user_a_id: uuid.UUID, user_b_id: uuid.UUID, ttl_seconds: int = 10
    ) -> bool: ...
    async def release_match_lock(self, user_a_id: uuid.UUID, user_b_id: uuid.UUID) -> None: ...
    async def set_user_active_session(
        self, user_id: uuid.UUID, session_id: uuid.UUID, ttl_seconds: int = 1800
    ) -> None: ...
    async def clear_user_active_session(self, user_id: uuid.UUID) -> None: ...
    async def is_user_in_active_session(self, user_id: uuid.UUID) -> bool: ...


class InMemoryPracticePresenceManager:
    """Thread-safe in-memory presence and queue manager for tests and standalone mode."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._queue: dict[str, QueueItem] = {}  # user_id_str -> QueueItem
        self._active_sessions: dict[str, str] = {}  # user_id_str -> session_id_str
        self._match_locks: dict[str, float] = {}  # lock_key -> expire_timestamp

    async def add_to_queue(self, item: QueueItem) -> None:
        async with self._lock:
            self._queue[item.user_id] = item

    async def remove_from_queue(self, user_id: uuid.UUID) -> None:
        async with self._lock:
            self._queue.pop(str(user_id), None)

    async def get_queue_entry(self, user_id: uuid.UUID) -> QueueItem | None:
        async with self._lock:
            return self._queue.get(str(user_id))

    async def get_all_waiting(self) -> list[QueueItem]:
        async with self._lock:
            return list(self._queue.values())

    async def acquire_match_lock(
        self, user_a_id: uuid.UUID, user_b_id: uuid.UUID, ttl_seconds: int = 10
    ) -> bool:
        async with self._lock:
            pair = sorted([str(user_a_id), str(user_b_id)])
            lock_key = f"{pair[0]}_{pair[1]}"
            now = asyncio.get_event_loop().time()

            # Clean expired lock
            if lock_key in self._match_locks and now > self._match_locks[lock_key]:
                del self._match_locks[lock_key]

            if lock_key in self._match_locks:
                return False

            self._match_locks[lock_key] = now + ttl_seconds
            return True

    async def release_match_lock(self, user_a_id: uuid.UUID, user_b_id: uuid.UUID) -> None:
        async with self._lock:
            pair = sorted([str(user_a_id), str(user_b_id)])
            lock_key = f"{pair[0]}_{pair[1]}"
            self._match_locks.pop(lock_key, None)

    async def set_user_active_session(
        self, user_id: uuid.UUID, session_id: uuid.UUID, ttl_seconds: int = 1800
    ) -> None:
        async with self._lock:
            self._active_sessions[str(user_id)] = str(session_id)

    async def clear_user_active_session(self, user_id: uuid.UUID) -> None:
        async with self._lock:
            self._active_sessions.pop(str(user_id), None)

    async def is_user_in_active_session(self, user_id: uuid.UUID) -> bool:
        async with self._lock:
            return str(user_id) in self._active_sessions


class RedisPracticePresenceManager:
    """Redis-backed presence and queue manager with atomic operations."""

    QUEUE_KEY = "practice:live_queue"
    ACTIVE_SESSION_PREFIX = "practice:active_session:"
    LOCK_PREFIX = "practice:lock:match:"

    async def add_to_queue(self, item: QueueItem) -> None:
        try:
            await redis_service.client.hset(
                self.QUEUE_KEY,
                item.user_id,
                json.dumps(item.to_dict()),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_add_to_queue_failed", error=str(exc))

    async def remove_from_queue(self, user_id: uuid.UUID) -> None:
        try:
            await redis_service.client.hdel(self.QUEUE_KEY, str(user_id))
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_remove_from_queue_failed", error=str(exc))

    async def get_queue_entry(self, user_id: uuid.UUID) -> QueueItem | None:
        try:
            data = await redis_service.client.hget(self.QUEUE_KEY, str(user_id))
            if data:
                return QueueItem.from_dict(json.loads(data))
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_get_queue_entry_failed", error=str(exc))
        return None

    async def get_all_waiting(self) -> list[QueueItem]:
        try:
            items_raw = await redis_service.client.hgetall(self.QUEUE_KEY)
            items = []
            for val in items_raw.values():
                items.append(QueueItem.from_dict(json.loads(val)))
            return items
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_get_all_waiting_failed", error=str(exc))
            return []

    async def acquire_match_lock(
        self, user_a_id: uuid.UUID, user_b_id: uuid.UUID, ttl_seconds: int = 10
    ) -> bool:
        try:
            pair = sorted([str(user_a_id), str(user_b_id)])
            lock_key = f"{self.LOCK_PREFIX}{pair[0]}_{pair[1]}"
            result = await redis_service.client.set(lock_key, "1", ex=ttl_seconds, nx=True)
            return bool(result)
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_acquire_match_lock_failed", error=str(exc))
            return True

    async def release_match_lock(self, user_a_id: uuid.UUID, user_b_id: uuid.UUID) -> None:
        try:
            pair = sorted([str(user_a_id), str(user_b_id)])
            lock_key = f"{self.LOCK_PREFIX}{pair[0]}_{pair[1]}"
            await redis_service.client.delete(lock_key)
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_release_match_lock_failed", error=str(exc))

    async def set_user_active_session(
        self, user_id: uuid.UUID, session_id: uuid.UUID, ttl_seconds: int = 1800
    ) -> None:
        try:
            key = f"{self.ACTIVE_SESSION_PREFIX}{user_id}"
            await redis_service.client.set(key, str(session_id), ex=ttl_seconds)
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_set_user_active_session_failed", error=str(exc))

    async def clear_user_active_session(self, user_id: uuid.UUID) -> None:
        try:
            key = f"{self.ACTIVE_SESSION_PREFIX}{user_id}"
            await redis_service.client.delete(key)
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_clear_user_active_session_failed", error=str(exc))

    async def is_user_in_active_session(self, user_id: uuid.UUID) -> bool:
        try:
            key = f"{self.ACTIVE_SESSION_PREFIX}{user_id}"
            return bool(await redis_service.client.exists(key))
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_is_user_in_active_session_failed", error=str(exc))
            return False


# Global default presence manager instance
in_memory_presence_manager = InMemoryPracticePresenceManager()
redis_presence_manager = RedisPracticePresenceManager()

# Default to in_memory when Redis is not configured or during offline testing,
# can be switched dynamically or injected.
current_presence_manager: PracticePresenceManager = in_memory_presence_manager


def get_presence_manager() -> PracticePresenceManager:
    """Return active practice presence manager."""
    return current_presence_manager


def set_presence_manager(manager: PracticePresenceManager) -> None:
    """Override active practice presence manager (e.g. for testing)."""
    global current_presence_manager
    current_presence_manager = manager
