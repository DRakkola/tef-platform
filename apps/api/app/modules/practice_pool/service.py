"""Practice Pool Service orchestrating queue presence, matching, authoritative sessions, and safety."""

import datetime
import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.core.security import decode_access_token, is_token_revoked
from app.modules.practice_pool.aliases import generate_anonymous_alias
from app.modules.practice_pool.enums import (
    PracticeMatchStatus,
    PracticeQueueStatus,
    PracticeReportStatus,
    PracticeRequestStatus,
    PracticeSessionStatus,
    PracticeType,
)
from app.modules.practice_pool.matching import PracticeMatchService, are_students_compatible
from app.modules.practice_pool.models import (
    PracticeBlock,
    PracticeMatch,
    PracticeParticipant,
    PracticeQueueEntry,
    PracticeReport,
    PracticeRequest,
    PracticeSession,
    PracticeTopic,
)
from app.modules.practice_pool.presence import (
    QueueItem,
    get_presence_manager,
)
from app.modules.practice_pool.schemas import (
    PracticeCandidate,
    PracticeHeartbeatResponse,
    PracticeQueueJoin,
    PracticeQueueStatusResponse,
    PracticeReportCreate,
)
from app.modules.practice_pool.transport import get_practice_media_transport
from app.modules.users.models import User, UserRole


def _ensure_utc(dt: datetime.datetime | None) -> datetime.datetime | None:
    """Ensure datetime is timezone-aware in UTC (normalizes offset-naive SQLite datetimes)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.UTC)
    return dt



class PracticePoolService:
    """Core domain logic for anonymous student practice pool."""

    @staticmethod
    async def list_topics(
        db: AsyncSession,
        level: str | None = None,
        category: str | None = None,
    ) -> list[PracticeTopic]:
        """Retrieve active speaking scenarios and topics for student practice."""
        stmt = select(PracticeTopic).where(PracticeTopic.is_active == True)
        if level:
            stmt = stmt.where(PracticeTopic.level == level)
        if category:
            stmt = stmt.where(PracticeTopic.category == category)
        stmt = stmt.order_by(PracticeTopic.created_at.asc())
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def heartbeat(
        db: AsyncSession,
        user: User,
    ) -> PracticeHeartbeatResponse:
        """Keep student presence alive in the matchmaking queue."""
        presence = get_presence_manager()
        refreshed = await presence.touch_presence(user.id, ttl_seconds=60)
        if not refreshed:
            stmt = (
                select(PracticeQueueEntry)
                .where(
                    PracticeQueueEntry.user_id == user.id,
                    PracticeQueueEntry.status == PracticeQueueStatus.WAITING,
                )
                .order_by(PracticeQueueEntry.joined_at.desc())
            )
            entry = (await db.execute(stmt)).scalar_one_or_none()
            if entry:
                await presence.add_to_queue(
                    QueueItem(
                        user_id=str(user.id),
                        queue_id=str(entry.id),
                        language=entry.language,
                        level=entry.level,
                        practice_type=entry.practice_type.value,
                        anonymous_alias=entry.anonymous_alias,
                        joined_at=entry.joined_at.isoformat(),
                    ),
                    ttl_seconds=60,
                )
                return PracticeHeartbeatResponse(in_queue=True, status="waiting", ttl_seconds=60)
            return PracticeHeartbeatResponse(in_queue=False, status="not_in_queue", ttl_seconds=0)

        return PracticeHeartbeatResponse(in_queue=True, status="waiting", ttl_seconds=60)

    @staticmethod
    async def join_queue(
        db: AsyncSession,
        user: User,
        payload: PracticeQueueJoin,
    ) -> PracticeQueueStatusResponse:
        """Add student to matchmaking queue with an anonymous alias.

        Strictly prevents students from joining if already in an active session.
        Rate-limited to prevent queue spam.
        """
        presence = get_presence_manager()

        # Rate limit check: max 10 queue joins per minute
        allowed = await presence.check_rate_limit(f"join:{user.id}", max_requests=10, window_seconds=60)
        if not allowed:
            raise AppException(
                message="Queue join rate limit exceeded. Please wait a moment.",
                code="RATE_LIMIT_EXCEEDED",
                status_code=429,
            )

        # Enforce server-side beta quota limits
        from app.core.beta_limits import BetaLimitsService
        await BetaLimitsService.check_and_increment(user.id, "practice_pool")

        # 1. Enforce single active session rule
        active_session_stmt = select(PracticeSession).where(
            or_(
                PracticeSession.student_a_id == user.id,
                PracticeSession.student_b_id == user.id,
            ),
            PracticeSession.status == PracticeSessionStatus.ACTIVE,
        )
        active_session = (await db.execute(active_session_stmt)).scalar_one_or_none()
        if active_session:
            # Verify if it expired
            if await PracticePoolService.check_and_expire(db, active_session):
                active_session = None
            else:
                raise AppException(
                    message="You are already in an active practice session",
                    code="USER_ALREADY_IN_ACTIVE_SESSION",
                    status_code=409,
                )

        # 2. Deactivate any previous waiting queue entries in database
        prev_entries_stmt = select(PracticeQueueEntry).where(
            PracticeQueueEntry.user_id == user.id,
            PracticeQueueEntry.status == PracticeQueueStatus.WAITING,
        )
        prev_entries = (await db.execute(prev_entries_stmt)).scalars().all()
        now_utc = datetime.datetime.now(datetime.UTC)
        for pe in prev_entries:
            pe.status = PracticeQueueStatus.CANCELLED
            pe.left_at = now_utc

        # 3. Create persistent queue record
        alias = generate_anonymous_alias(seed_key=f"{user.id}_{uuid.uuid4().hex[:6]}")
        entry = PracticeQueueEntry(
            user_id=user.id,
            language=payload.language,
            level=payload.level,
            practice_type=payload.practice_type,
            status=PracticeQueueStatus.WAITING,
            anonymous_alias=alias,
            joined_at=now_utc,
        )
        db.add(entry)
        await db.commit()
        await db.refresh(entry)

        # 4. Register in ephemeral presence queue with 60s TTL
        await presence.add_to_queue(
            QueueItem(
                user_id=str(user.id),
                queue_id=str(entry.id),
                language=payload.language,
                level=payload.level,
                practice_type=payload.practice_type.value,
                anonymous_alias=alias,
                joined_at=now_utc.isoformat(),
            ),
            ttl_seconds=60,
        )

        # 5. Discover compatible waiting candidates
        candidates = await PracticePoolService._find_compatible_candidates(db, user, entry)

        return PracticeQueueStatusResponse(
            in_queue=True,
            queue_id=entry.id,
            anonymous_alias=alias,
            status=entry.status,
            language=entry.language,
            level=entry.level,
            practice_type=entry.practice_type,
            topic_id=payload.topic_id,
            joined_at=entry.joined_at,
            candidates=candidates,
        )

    @staticmethod
    async def leave_queue(
        db: AsyncSession,
        user: User,
    ) -> bool:
        """Remove student from presence and database queue."""
        presence = get_presence_manager()
        await presence.remove_from_queue(user.id)

        now_utc = datetime.datetime.now(datetime.UTC)
        stmt = select(PracticeQueueEntry).where(
            PracticeQueueEntry.user_id == user.id,
            PracticeQueueEntry.status == PracticeQueueStatus.WAITING,
        )
        entries = (await db.execute(stmt)).scalars().all()
        for e in entries:
            e.status = PracticeQueueStatus.CANCELLED
            e.left_at = now_utc
        await db.commit()
        return True

    @staticmethod
    async def get_queue_status(
        db: AsyncSession,
        user: User,
    ) -> PracticeQueueStatusResponse:
        """Inspect current queue status and compatible anonymous candidates."""
        presence = get_presence_manager()
        item = await presence.get_queue_entry(user.id)

        if not item:
            # Check DB in case of cache expiration
            stmt = (
                select(PracticeQueueEntry)
                .where(
                    PracticeQueueEntry.user_id == user.id,
                    PracticeQueueEntry.status == PracticeQueueStatus.WAITING,
                )
                .order_by(PracticeQueueEntry.joined_at.desc())
            )
            entry = (await db.execute(stmt)).scalar_one_or_none()
            if not entry:
                return PracticeQueueStatusResponse(in_queue=False)

            # Re-register in presence
            await presence.add_to_queue(
                QueueItem(
                    user_id=str(user.id),
                    queue_id=str(entry.id),
                    language=entry.language,
                    level=entry.level,
                    practice_type=entry.practice_type.value,
                    anonymous_alias=entry.anonymous_alias,
                    joined_at=entry.joined_at.isoformat(),
                ),
                ttl_seconds=60,
            )
        else:
            entry = await db.get(PracticeQueueEntry, uuid.UUID(item.queue_id))

        if not entry or entry.status != PracticeQueueStatus.WAITING:
            return PracticeQueueStatusResponse(in_queue=False)

        candidates = await PracticePoolService._find_compatible_candidates(db, user, entry)

        return PracticeQueueStatusResponse(
            in_queue=True,
            queue_id=entry.id,
            anonymous_alias=entry.anonymous_alias,
            status=entry.status,
            language=entry.language,
            level=entry.level,
            practice_type=entry.practice_type,
            joined_at=entry.joined_at,
            candidates=candidates,
        )

    @staticmethod
    async def _find_compatible_candidates(
        db: AsyncSession,
        user: User,
        user_entry: PracticeQueueEntry,
    ) -> list[PracticeCandidate]:
        """Find compatible peers waiting in queue while filtering blocked users.

        Applies anti-repeat scoring based on recent 48-hour session pairing history.
        """
        # Query blocked user IDs
        blocked_stmt = select(PracticeBlock.blocked_user_id).where(PracticeBlock.user_id == user.id)
        blocked_by_stmt = select(PracticeBlock.user_id).where(
            PracticeBlock.blocked_user_id == user.id
        )
        blocked_ids = set((await db.execute(blocked_stmt)).scalars().all()) | set(
            (await db.execute(blocked_by_stmt)).scalars().all()
        )

        # Query recent pairing history in past 48 hours for anti-repeat penalty
        recent_cutoff = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=48)
        recent_sessions_stmt = select(PracticeSession).where(
            or_(
                PracticeSession.student_a_id == user.id,
                PracticeSession.student_b_id == user.id,
            ),
            PracticeSession.created_at >= recent_cutoff,
        )
        recent_sessions = (await db.execute(recent_sessions_stmt)).scalars().all()
        recent_partner_ids = {
            s.student_b_id if s.student_a_id == user.id else s.student_a_id
            for s in recent_sessions
        }

        presence = get_presence_manager()
        all_waiting = await presence.get_all_waiting()

        candidates: list[PracticeCandidate] = []
        now_utc = datetime.datetime.now(datetime.UTC)

        for waiting_item in all_waiting:
            cand_user_id = uuid.UUID(waiting_item.user_id)
            if cand_user_id == user.id:
                continue

            cand_type = PracticeType(waiting_item.practice_type)
            if are_students_compatible(
                user_a_id=user.id,
                user_a_lang=user_entry.language,
                user_a_level=user_entry.level,
                user_a_type=user_entry.practice_type,
                user_b_id=cand_user_id,
                user_b_lang=waiting_item.language,
                user_b_level=waiting_item.level,
                user_b_type=cand_type,
                blocked_user_ids=blocked_ids,
            ):
                joined_dt = datetime.datetime.fromisoformat(waiting_item.joined_at)
                if joined_dt.tzinfo is None:
                    joined_dt = joined_dt.replace(tzinfo=datetime.UTC)
                wait_seconds = max(0.0, (now_utc - joined_dt).total_seconds())

                is_recent = cand_user_id in recent_partner_ids
                score = PracticeMatchService.calculate_candidate_score(
                    target_level=user_entry.level,
                    target_type=user_entry.practice_type,
                    candidate_level=waiting_item.level,
                    candidate_type=cand_type,
                    wait_seconds=wait_seconds,
                    is_recent_partner=is_recent,
                )

                candidates.append(
                    PracticeCandidate(
                        queue_id=uuid.UUID(waiting_item.queue_id),
                        anonymous_alias=waiting_item.anonymous_alias,
                        language=waiting_item.language,
                        level=waiting_item.level,
                        practice_type=cand_type,
                        joined_at=joined_dt,
                        score=score,
                    )
                )

        # Rank candidates highest priority first
        candidates.sort(key=lambda c: (c.score or 0.0), reverse=True)
        return candidates


    @staticmethod
    async def create_request(
        db: AsyncSession,
        sender: User,
        candidate_queue_id: uuid.UUID,
        topic_id: uuid.UUID | None = None,
    ) -> PracticeRequest:
        """Send a 1-to-1 practice invitation to a queue candidate with a 60s expiration."""
        presence = get_presence_manager()

        # Rate limit check: max 5 requests per minute
        allowed = await presence.check_rate_limit(f"request:{sender.id}", max_requests=5, window_seconds=60)
        if not allowed:
            raise AppException(
                message="Practice request rate limit exceeded. Please wait a moment.",
                code="RATE_LIMIT_EXCEEDED",
                status_code=429,
            )

        # 1. Verify sender not in active session
        sender_active_stmt = select(PracticeSession).where(
            or_(
                PracticeSession.student_a_id == sender.id,
                PracticeSession.student_b_id == sender.id,
            ),
            PracticeSession.status == PracticeSessionStatus.ACTIVE,
        )
        sender_active = (await db.execute(sender_active_stmt)).scalar_one_or_none()
        if sender_active and not (await PracticePoolService.check_and_expire(db, sender_active)):
            raise AppException(
                message="You cannot send requests while in an active session",
                code="USER_ALREADY_IN_ACTIVE_SESSION",
                status_code=409,
            )

        # 2. Look up receiver queue entry
        target_entry = await db.get(PracticeQueueEntry, candidate_queue_id)
        if not target_entry or target_entry.status != PracticeQueueStatus.WAITING:
            raise AppException(
                message="Candidate is no longer available in the queue",
                code="CANDIDATE_NOT_FOUND",
                status_code=404,
            )

        if target_entry.user_id == sender.id:
            raise AppException(
                message="You cannot practice with yourself",
                code="SELF_PRACTICE_FORBIDDEN",
                status_code=400,
            )

        # 3. Check blocks
        block_stmt = select(PracticeBlock).where(
            or_(
                (PracticeBlock.user_id == sender.id)
                & (PracticeBlock.blocked_user_id == target_entry.user_id),
                (PracticeBlock.user_id == target_entry.user_id)
                & (PracticeBlock.blocked_user_id == sender.id),
            )
        )
        if (await db.execute(block_stmt)).scalar_one_or_none():
            raise AppException(
                message="Cannot request practice with this user",
                code="USER_BLOCKED",
                status_code=403,
            )

        # 4. Check receiver active session
        receiver_active_stmt = select(PracticeSession).where(
            or_(
                PracticeSession.student_a_id == target_entry.user_id,
                PracticeSession.student_b_id == target_entry.user_id,
            ),
            PracticeSession.status == PracticeSessionStatus.ACTIVE,
        )
        receiver_active = (await db.execute(receiver_active_stmt)).scalar_one_or_none()
        if receiver_active and not (
            await PracticePoolService.check_and_expire(db, receiver_active)
        ):
            raise AppException(
                message="Candidate is currently in an active session",
                code="CANDIDATE_BUSY",
                status_code=409,
            )

        # 5. Fetch sender's queue alias or generate one
        sender_entry_stmt = (
            select(PracticeQueueEntry)
            .where(
                PracticeQueueEntry.user_id == sender.id,
                PracticeQueueEntry.status == PracticeQueueStatus.WAITING,
            )
            .order_by(PracticeQueueEntry.joined_at.desc())
        )
        sender_entry = (await db.execute(sender_entry_stmt)).scalar_one_or_none()
        sender_alias = (
            sender_entry.anonymous_alias
            if sender_entry
            else generate_anonymous_alias(f"{sender.id}_{uuid.uuid4().hex[:6]}")
        )

        now_utc = datetime.datetime.now(datetime.UTC)
        request = PracticeRequest(
            sender_id=sender.id,
            receiver_id=target_entry.user_id,
            sender_alias=sender_alias,
            receiver_alias=target_entry.anonymous_alias,
            language=target_entry.language,
            level=target_entry.level,
            practice_type=target_entry.practice_type,
            status=PracticeRequestStatus.PENDING,
            expires_at=now_utc + datetime.timedelta(seconds=60),
        )
        db.add(request)
        await db.commit()
        await db.refresh(request)
        return request

    @staticmethod
    async def accept_request(
        db: AsyncSession,
        user: User,
        request_id: uuid.UUID,
    ) -> PracticeSession:
        """Accept 1-to-1 practice invitation, create match, and start authoritative 25-minute session."""
        request = await db.get(PracticeRequest, request_id)
        if not request:
            raise AppException(
                message="Practice request not found",
                code="REQUEST_NOT_FOUND",
                status_code=404,
            )

        if request.receiver_id != user.id:
            raise AppException(
                message="You are not authorized to accept this practice request",
                code="FORBIDDEN",
                status_code=403,
            )

        now_utc = datetime.datetime.now(datetime.UTC)
        expires_at_utc = _ensure_utc(request.expires_at)
        if request.status != PracticeRequestStatus.PENDING or (
            expires_at_utc and now_utc > expires_at_utc
        ):
            request.status = PracticeRequestStatus.EXPIRED
            await db.commit()
            raise AppException(
                message="Practice request has expired or is no longer pending",
                code="REQUEST_EXPIRED",
                status_code=400,
            )

        presence = get_presence_manager()

        # Acquire atomic match lock for this pair of students
        lock_acquired = await presence.acquire_match_lock(request.sender_id, request.receiver_id)
        if not lock_acquired:
            raise AppException(
                message="Another match operation is currently in progress for these users",
                code="CONCURRENT_MATCH_IN_PROGRESS",
                status_code=409,
            )

        try:
            # Authoritatively check neither student is already in an active session
            active_stmt = select(PracticeSession).where(
                or_(
                    PracticeSession.student_a_id.in_([request.sender_id, request.receiver_id]),
                    PracticeSession.student_b_id.in_([request.sender_id, request.receiver_id]),
                ),
                PracticeSession.status == PracticeSessionStatus.ACTIVE,
            )
            existing_active = (await db.execute(active_stmt)).scalars().all()
            for s in existing_active:
                if not (await PracticePoolService.check_and_expire(db, s)):
                    raise AppException(
                        message="One of the participants is already in an active session",
                        code="USER_ALREADY_IN_ACTIVE_SESSION",
                        status_code=409,
                    )

            # Select practice topic
            t_stmt = select(PracticeTopic).where(
                PracticeTopic.is_active == True,
                PracticeTopic.level == request.level,
            ).limit(1)
            topic = (await db.execute(t_stmt)).scalar_one_or_none()
            if not topic:
                t_any_stmt = select(PracticeTopic).where(PracticeTopic.is_active == True).limit(1)
                topic = (await db.execute(t_any_stmt)).scalar_one_or_none()
            topic_id = topic.id if topic else None

            # Mark request accepted
            request.status = PracticeRequestStatus.ACCEPTED

            # Create match
            match = PracticeMatch(
                request_id=request.id,
                student_a_id=request.sender_id,
                student_b_id=request.receiver_id,
                student_a_alias=request.sender_alias,
                student_b_alias=request.receiver_alias,
                language=request.language,
                level=request.level,
                practice_type=request.practice_type,
                status=PracticeMatchStatus.SESSION_CREATED,
            )
            db.add(match)
            await db.flush()

            # Create authoritative audio-only practice session (25 mins default)
            duration_minutes = 25
            room_id = f"practice_room_{uuid.uuid4().hex[:16]}"
            session = PracticeSession(
                match_id=match.id,
                room_id=room_id,
                topic_id=topic_id,
                student_a_id=request.sender_id,
                student_b_id=request.receiver_id,
                student_a_alias=request.sender_alias,
                student_b_alias=request.receiver_alias,
                language=request.language,
                level=request.level,
                practice_type=request.practice_type,
                duration_minutes=duration_minutes,
                status=PracticeSessionStatus.ACTIVE,
                starts_at=now_utc,
                expires_at=now_utc + datetime.timedelta(minutes=duration_minutes),
                audio_only=True,
            )
            db.add(session)
            await db.flush()

            # Create participant records
            p_a = PracticeParticipant(
                session_id=session.id,
                user_id=request.sender_id,
                anonymous_alias=request.sender_alias,
                role="participant",
                is_connected=False,
                joined_at=now_utc,
            )
            p_b = PracticeParticipant(
                session_id=session.id,
                user_id=request.receiver_id,
                anonymous_alias=request.receiver_alias,
                role="participant",
                is_connected=False,
                joined_at=now_utc,
            )
            db.add(p_a)
            db.add(p_b)

            # Mark both queue entries as MATCHED
            q_stmt = select(PracticeQueueEntry).where(
                PracticeQueueEntry.user_id.in_([request.sender_id, request.receiver_id]),
                PracticeQueueEntry.status == PracticeQueueStatus.WAITING,
            )
            q_entries = (await db.execute(q_stmt)).scalars().all()
            for qe in q_entries:
                qe.status = PracticeQueueStatus.MATCHED
                qe.left_at = now_utc

            await db.commit()
            await db.refresh(session)

            # Update presence: remove from queue and mark active session
            await presence.remove_from_queue(request.sender_id)
            await presence.remove_from_queue(request.receiver_id)
            await presence.set_user_active_session(request.sender_id, session.id)
            await presence.set_user_active_session(request.receiver_id, session.id)

            # Initialize media room descriptor
            transport = get_practice_media_transport()
            transport.create_room(room_id=room_id, session_id=session.id)

            return session

        finally:
            await presence.release_match_lock(request.sender_id, request.receiver_id)

    @staticmethod
    async def reject_request(
        db: AsyncSession,
        user: User,
        request_id: uuid.UUID,
    ) -> PracticeRequest:
        """Reject a pending 1-to-1 practice invitation."""
        request = await db.get(PracticeRequest, request_id)
        if not request:
            raise AppException(
                "Practice request not found", code="REQUEST_NOT_FOUND", status_code=404
            )

        if request.receiver_id != user.id:
            raise AppException(
                "Not authorized to reject this request", code="FORBIDDEN", status_code=403
            )

        if request.status != PracticeRequestStatus.PENDING:
            raise AppException("Request is not pending", code="INVALID_STATE", status_code=400)

        request.status = PracticeRequestStatus.REJECTED
        await db.commit()
        return request

    @staticmethod
    async def cancel_request(
        db: AsyncSession,
        user: User,
        request_id: uuid.UUID,
    ) -> PracticeRequest:
        """Cancel a pending invitation sent by the user."""
        request = await db.get(PracticeRequest, request_id)
        if not request:
            raise AppException(
                "Practice request not found", code="REQUEST_NOT_FOUND", status_code=404
            )

        if request.sender_id != user.id:
            raise AppException(
                "Not authorized to cancel this request", code="FORBIDDEN", status_code=403
            )

        if request.status != PracticeRequestStatus.PENDING:
            raise AppException("Request is not pending", code="INVALID_STATE", status_code=400)

        request.status = PracticeRequestStatus.CANCELLED
        await db.commit()
        return request

    @staticmethod
    async def get_session_by_id(
        db: AsyncSession,
        session_id: uuid.UUID,
        user: User,
    ) -> PracticeSession:
        """Fetch practice session, verifying participant authorization and server timer."""
        session = await db.get(PracticeSession, session_id)
        if not session:
            raise AppException(
                "Practice session not found", code="SESSION_NOT_FOUND", status_code=404
            )

        is_participant = user.id in (session.student_a_id, session.student_b_id)
        is_admin = user.role == UserRole.ADMIN
        if not (is_participant or is_admin):
            raise AppException(
                "Not authorized to access this session", code="FORBIDDEN", status_code=403
            )

        await PracticePoolService.check_and_expire(db, session)
        return session

    @staticmethod
    async def leave_session(
        db: AsyncSession,
        session_id: uuid.UUID,
        user: User,
    ) -> PracticeSession:
        """Conclude participation in active session."""
        session = await PracticePoolService.get_session_by_id(db, session_id, user)
        if session.status == PracticeSessionStatus.ACTIVE:
            session.status = PracticeSessionStatus.COMPLETED
            session.ended_at = datetime.datetime.now(datetime.UTC)
            transport = get_practice_media_transport()
            transport.close_room(session.room_id)
            await db.commit()

        presence = get_presence_manager()
        await presence.clear_user_active_session(session.student_a_id)
        await presence.clear_user_active_session(session.student_b_id)
        return session

    @staticmethod
    async def check_and_expire(db: AsyncSession, session: PracticeSession) -> bool:
        """Enforce server-authoritative timer expiration."""
        expires_at = _ensure_utc(session.expires_at)
        if session.status == PracticeSessionStatus.ACTIVE and expires_at:
            now_utc = datetime.datetime.now(datetime.UTC)
            if now_utc > expires_at:
                session.status = PracticeSessionStatus.EXPIRED
                session.ended_at = expires_at
                transport = get_practice_media_transport()
                transport.close_room(session.room_id)
                await db.commit()

                presence = get_presence_manager()
                await presence.clear_user_active_session(session.student_a_id)
                await presence.clear_user_active_session(session.student_b_id)
                return True
        return False

    @staticmethod
    async def report_user(
        db: AsyncSession,
        reporter: User,
        session_id: uuid.UUID,
        payload: PracticeReportCreate,
    ) -> PracticeReport:
        """Submit an anonymous safety report regarding a session peer."""
        presence = get_presence_manager()
        allowed = await presence.check_rate_limit(f"report:{reporter.id}", max_requests=5, window_seconds=3600)
        if not allowed:
            raise AppException(
                message="Report rate limit exceeded. Please try again later.",
                code="RATE_LIMIT_EXCEEDED",
                status_code=429,
            )

        session = await PracticePoolService.get_session_by_id(db, session_id, reporter)
        reported_id = (
            session.student_b_id if session.student_a_id == reporter.id else session.student_a_id
        )

        report = PracticeReport(
            reporter_id=reporter.id,
            reported_user_id=reported_id,
            session_id=session.id,
            reason=payload.reason,
            details=payload.details,
            status=PracticeReportStatus.OPEN,
        )
        db.add(report)
        await db.commit()
        await db.refresh(report)
        return report

    @staticmethod
    async def block_user(
        db: AsyncSession,
        user: User,
        blocked_user_id: uuid.UUID,
        reason: str | None = None,
    ) -> PracticeBlock:
        """Block a peer to ensure they are never matched again."""
        if user.id == blocked_user_id:
            raise AppException(
                "Cannot block yourself", code="SELF_BLOCK_FORBIDDEN", status_code=400
            )

        existing_stmt = select(PracticeBlock).where(
            PracticeBlock.user_id == user.id,
            PracticeBlock.blocked_user_id == blocked_user_id,
        )
        block = (await db.execute(existing_stmt)).scalar_one_or_none()
        if not block:
            block = PracticeBlock(
                user_id=user.id,
                blocked_user_id=blocked_user_id,
                reason=reason,
            )
            db.add(block)
            await db.commit()
            await db.refresh(block)
        return block

    @staticmethod
    async def authorize_room_connection(
        db: AsyncSession,
        room_id: str,
        token: str,
    ) -> tuple[PracticeSession, User, str]:
        """Authorize WebSocket connection for audio-only WebRTC signaling.

        Supports looking up by room_id or session_id UUID.
        Returns session, authenticated user, and their anonymous pseudonym.
        """
        token_payload = decode_access_token(token)
        if not token_payload:
            raise AppException("Invalid or expired token", code="INVALID_TOKEN", status_code=401)

        jti = token_payload.get("jti")
        if jti and await is_token_revoked(jti):
            raise AppException("Token has been revoked", code="TOKEN_REVOKED", status_code=401)

        user_id_str = token_payload.get("sub")
        if not user_id_str:
            raise AppException("Token subject missing", code="INVALID_TOKEN", status_code=401)

        user_id = uuid.UUID(user_id_str)
        user = await db.get(User, user_id)
        if not user:
            raise AppException("User not found", code="USER_NOT_FOUND", status_code=404)

        stmt = select(PracticeSession).where(PracticeSession.room_id == room_id)
        session = (await db.execute(stmt)).scalar_one_or_none()
        if not session:
            try:
                session_uuid = uuid.UUID(room_id)
                session = await db.get(PracticeSession, session_uuid)
            except (ValueError, TypeError):
                pass

        if not session:
            raise AppException("Practice room not found", code="ROOM_NOT_FOUND", status_code=404)

        if await PracticePoolService.check_and_expire(db, session):
            raise AppException("Session expired", code="SESSION_CLOSED", status_code=400)

        if session.status in (
            PracticeSessionStatus.COMPLETED,
            PracticeSessionStatus.EXPIRED,
            PracticeSessionStatus.CANCELLED,
            PracticeSessionStatus.ABANDONED,
        ):
            raise AppException("Session is closed", code="SESSION_CLOSED", status_code=400)

        if user.id == session.student_a_id:
            alias = session.student_a_alias
        elif user.id == session.student_b_id:
            alias = session.student_b_alias
        elif user.role == UserRole.ADMIN:
            alias = "Administrateur"
        else:
            raise AppException(
                "Not authorized as a participant in this practice session",
                code="FORBIDDEN",
                status_code=403,
            )

        return session, user, alias

