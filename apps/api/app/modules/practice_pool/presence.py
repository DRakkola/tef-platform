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

    async def add_to_queue(self, item: QueueItem, ttl_seconds: int = 60) -> None: ...
    async def remove_from_queue(self, user_id: uuid.UUID) -> None: ...
    async def get_queue_entry(self, user_id: uuid.UUID) -> QueueItem | None: ...
    async def get_all_waiting(self) -> list[QueueItem]: ...
    async def touch_presence(self, user_id: uuid.UUID, ttl_seconds: int = 60) -> bool: ...
    async def cleanup_expired_presence(self) -> list[str]: ...
    async def acquire_student_lock(self, user_id: uuid.UUID, ttl_seconds: int = 10) -> bool: ...
    async def release_student_lock(self, user_id: uuid.UUID) -> None: ...
    async def acquire_match_lock(
        self, user_a_id: uuid.UUID, user_b_id: uuid.UUID, ttl_seconds: int = 10
    ) -> bool: ...
    async def release_match_lock(self, user_a_id: uuid.UUID, user_b_id: uuid.UUID) -> None: ...
    async def set_user_active_session(
        self, user_id: uuid.UUID, session_id: uuid.UUID, ttl_seconds: int = 1800
    ) -> None: ...
    async def clear_user_active_session(self, user_id: uuid.UUID) -> None: ...
    async def is_user_in_active_session(self, user_id: uuid.UUID) -> bool: ...
    async def check_rate_limit(
        self, key: str, max_requests: int, window_seconds: int = 60
    ) -> bool: ...


class InMemoryPracticePresenceManager:
    """Thread-safe in-memory presence and queue manager for tests and standalone mode."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._queue: dict[str, QueueItem] = {}  # user_id_str -> QueueItem
        self._heartbeats: dict[str, float] = {}  # user_id_str -> expire_timestamp
        self._active_sessions: dict[str, str] = {}  # user_id_str -> session_id_str
        self._student_locks: dict[str, float] = {}  # user_id_str -> expire_timestamp
        self._match_locks: dict[str, float] = {}  # lock_key -> expire_timestamp
        self._rate_limits: dict[str, list[float]] = {}  # key -> list of timestamps

    async def add_to_queue(self, item: QueueItem, ttl_seconds: int = 60) -> None:
        async with self._lock:
            now = asyncio.get_event_loop().time()
            self._queue[item.user_id] = item
            self._heartbeats[item.user_id] = now + ttl_seconds

    async def remove_from_queue(self, user_id: uuid.UUID) -> None:
        async with self._lock:
            u_str = str(user_id)
            self._queue.pop(u_str, None)
            self._heartbeats.pop(u_str, None)

    async def get_queue_entry(self, user_id: uuid.UUID) -> QueueItem | None:
        async with self._lock:
            u_str = str(user_id)
            now = asyncio.get_event_loop().time()
            exp = self._heartbeats.get(u_str)
            if exp and now > exp:
                self._queue.pop(u_str, None)
                self._heartbeats.pop(u_str, None)
                return None
            return self._queue.get(u_str)

    async def get_all_waiting(self) -> list[QueueItem]:
        async with self._lock:
            now = asyncio.get_event_loop().time()
            valid_items = []
            expired_keys = []
            for uid, item in self._queue.items():
                exp = self._heartbeats.get(uid)
                if exp and now > exp:
                    expired_keys.append(uid)
                else:
                    valid_items.append(item)
            for k in expired_keys:
                self._queue.pop(k, None)
                self._heartbeats.pop(k, None)
            return valid_items

    async def touch_presence(self, user_id: uuid.UUID, ttl_seconds: int = 60) -> bool:
        async with self._lock:
            u_str = str(user_id)
            if u_str not in self._queue:
                return False
            now = asyncio.get_event_loop().time()
            self._heartbeats[u_str] = now + ttl_seconds
            return True

    async def cleanup_expired_presence(self) -> list[str]:
        async with self._lock:
            now = asyncio.get_event_loop().time()
            expired = []
            for uid, exp in list(self._heartbeats.items()):
                if now > exp:
                    expired.append(uid)
                    self._queue.pop(uid, None)
                    del self._heartbeats[uid]
            return expired

    async def acquire_student_lock(self, user_id: uuid.UUID, ttl_seconds: int = 10) -> bool:
        async with self._lock:
            u_str = str(user_id)
            now = asyncio.get_event_loop().time()
            if u_str in self._student_locks and now > self._student_locks[u_str]:
                del self._student_locks[u_str]

            if u_str in self._student_locks:
                return False
            self._student_locks[u_str] = now + ttl_seconds
            return True

    async def release_student_lock(self, user_id: uuid.UUID) -> None:
        async with self._lock:
            self._student_locks.pop(str(user_id), None)

    async def acquire_match_lock(
        self, user_a_id: uuid.UUID, user_b_id: uuid.UUID, ttl_seconds: int = 10
    ) -> bool:
        async with self._lock:
            now = asyncio.get_event_loop().time()
            # Clean expired locks
            for key in list(self._student_locks.keys()):
                if now > self._student_locks[key]:
                    del self._student_locks[key]

            # Deadlock-free sorted student locking
            students = sorted([str(user_a_id), str(user_b_id)])
            s1, s2 = students[0], students[1]
            pair_key = f"{s1}_{s2}"

            if s1 in self._student_locks or s2 in self._student_locks or pair_key in self._match_locks:
                return False

            self._student_locks[s1] = now + ttl_seconds
            self._student_locks[s2] = now + ttl_seconds
            self._match_locks[pair_key] = now + ttl_seconds
            return True

    async def release_match_lock(self, user_a_id: uuid.UUID, user_b_id: uuid.UUID) -> None:
        async with self._lock:
            students = sorted([str(user_a_id), str(user_b_id)])
            self._student_locks.pop(students[0], None)
            self._student_locks.pop(students[1], None)
            self._match_locks.pop(f"{students[0]}_{students[1]}", None)

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

    async def check_rate_limit(
        self, key: str, max_requests: int, window_seconds: int = 60
    ) -> bool:
        async with self._lock:
            now = asyncio.get_event_loop().time()
            window_start = now - window_seconds
            timestamps = [t for t in self._rate_limits.get(key, []) if t > window_start]
            if len(timestamps) >= max_requests:
                return False
            timestamps.append(now)
            self._rate_limits[key] = timestamps
            return True


class RedisPracticePresenceManager:
    """Redis-backed presence and queue manager with atomic operations."""

    QUEUE_KEY = "practice:live_queue"
    PRESENCE_PREFIX = "practice:presence:"
    ACTIVE_SESSION_PREFIX = "practice:active_session:"
    LOCK_PREFIX = "practice:lock:match:"
    STUDENT_LOCK_PREFIX = "practice:match-lock:"
    RATELIMIT_PREFIX = "practice:ratelimit:"

    async def add_to_queue(self, item: QueueItem, ttl_seconds: int = 60) -> None:
        try:
            pipe = redis_service.client.pipeline()
            pipe.hset(
                self.QUEUE_KEY,
                item.user_id,
                json.dumps(item.to_dict()),
            )
            pipe.set(f"{self.PRESENCE_PREFIX}{item.user_id}", "1", ex=ttl_seconds)
            await pipe.execute()
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_add_to_queue_failed", error=str(exc))

    async def remove_from_queue(self, user_id: uuid.UUID) -> None:
        try:
            pipe = redis_service.client.pipeline()
            pipe.hdel(self.QUEUE_KEY, str(user_id))
            pipe.delete(f"{self.PRESENCE_PREFIX}{user_id}")
            await pipe.execute()
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_remove_from_queue_failed", error=str(exc))

    async def get_queue_entry(self, user_id: uuid.UUID) -> QueueItem | None:
        try:
            # Check presence TTL
            is_present = await redis_service.client.exists(f"{self.PRESENCE_PREFIX}{user_id}")
            if not is_present:
                await redis_service.client.hdel(self.QUEUE_KEY, str(user_id))
                return None

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
            for uid_bytes, val in items_raw.items():
                uid_str = uid_bytes.decode() if isinstance(uid_bytes, bytes) else str(uid_bytes)
                is_present = await redis_service.client.exists(f"{self.PRESENCE_PREFIX}{uid_str}")
                if is_present:
                    items.append(QueueItem.from_dict(json.loads(val)))
                else:
                    await redis_service.client.hdel(self.QUEUE_KEY, uid_str)
            return items
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_get_all_waiting_failed", error=str(exc))
            return []

    async def touch_presence(self, user_id: uuid.UUID, ttl_seconds: int = 60) -> bool:
        try:
            is_waiting = await redis_service.client.hexists(self.QUEUE_KEY, str(user_id))
            if not is_waiting:
                return False
            await redis_service.client.set(
                f"{self.PRESENCE_PREFIX}{user_id}", "1", ex=ttl_seconds
            )
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_touch_presence_failed", error=str(exc))
            return False

    async def cleanup_expired_presence(self) -> list[str]:
        try:
            items_raw = await redis_service.client.hgetall(self.QUEUE_KEY)
            expired = []
            for uid_bytes in items_raw:
                uid_str = uid_bytes.decode() if isinstance(uid_bytes, bytes) else str(uid_bytes)
                if not (await redis_service.client.exists(f"{self.PRESENCE_PREFIX}{uid_str}")):
                    expired.append(uid_str)
                    await redis_service.client.hdel(self.QUEUE_KEY, uid_str)
            return expired
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_cleanup_expired_presence_failed", error=str(exc))
            return []

    async def acquire_student_lock(self, user_id: uuid.UUID, ttl_seconds: int = 10) -> bool:
        try:
            lock_key = f"{self.STUDENT_LOCK_PREFIX}{user_id}"
            return bool(await redis_service.client.set(lock_key, "1", ex=ttl_seconds, nx=True))
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_acquire_student_lock_failed", error=str(exc))
            return True

    async def release_student_lock(self, user_id: uuid.UUID) -> None:
        try:
            await redis_service.client.delete(f"{self.STUDENT_LOCK_PREFIX}{user_id}")
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_release_student_lock_failed", error=str(exc))

    async def acquire_match_lock(
        self, user_a_id: uuid.UUID, user_b_id: uuid.UUID, ttl_seconds: int = 10
    ) -> bool:
        try:
            students = sorted([str(user_a_id), str(user_b_id)])
            s1, s2 = students[0], students[1]
            lock1 = await redis_service.client.set(
                f"{self.STUDENT_LOCK_PREFIX}{s1}", "1", ex=ttl_seconds, nx=True
            )
            if not lock1:
                return False

            lock2 = await redis_service.client.set(
                f"{self.STUDENT_LOCK_PREFIX}{s2}", "1", ex=ttl_seconds, nx=True
            )
            if not lock2:
                await redis_service.client.delete(f"{self.STUDENT_LOCK_PREFIX}{s1}")
                return False

            pair_key = f"{self.LOCK_PREFIX}{s1}_{s2}"
            pair_lock = await redis_service.client.set(pair_key, "1", ex=ttl_seconds, nx=True)
            if not pair_lock:
                await redis_service.client.delete(f"{self.STUDENT_LOCK_PREFIX}{s1}")
                await redis_service.client.delete(f"{self.STUDENT_LOCK_PREFIX}{s2}")
                return False

            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_acquire_match_lock_failed", error=str(exc))
            return True

    async def release_match_lock(self, user_a_id: uuid.UUID, user_b_id: uuid.UUID) -> None:
        try:
            students = sorted([str(user_a_id), str(user_b_id)])
            pipe = redis_service.client.pipeline()
            pipe.delete(f"{self.STUDENT_LOCK_PREFIX}{students[0]}")
            pipe.delete(f"{self.STUDENT_LOCK_PREFIX}{students[1]}")
            pipe.delete(f"{self.LOCK_PREFIX}{students[0]}_{students[1]}")
            await pipe.execute()
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

    async def check_rate_limit(
        self, key: str, max_requests: int, window_seconds: int = 60
    ) -> bool:
        try:
            limit_key = f"{self.RATELIMIT_PREFIX}{key}"
            current = await redis_service.client.incr(limit_key)
            if current == 1:
                await redis_service.client.expire(limit_key, window_seconds)
            return current <= max_requests
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_check_rate_limit_failed", error=str(exc))
            return True


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

