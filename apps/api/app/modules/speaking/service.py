"""Speaking session service managing timers, state transitions, room authorization, and evaluations."""

import datetime
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.security import decode_access_token, is_token_revoked
from app.modules.assessments.models import Skill, SkillCategory
from app.modules.learning.readiness_engine import ReadinessEngine
from app.modules.learning.readiness_models import SkillEvidenceSourceType
from app.modules.speaking.enums import (
    SpeakingEvaluatorType,
    SpeakingParticipantRole,
    SpeakingSessionState,
    SpeakingSessionType,
)
from app.modules.speaking.models import (
    SpeakingEvaluation,
    SpeakingEvaluationSkill,
    SpeakingParticipant,
    SpeakingSession,
)
from app.modules.speaking.providers.gemini_live import GeminiSpeakingEvaluator
from app.modules.speaking.providers.mock import MockMediaRoomProvider
from app.modules.speaking.schemas import SpeakingSessionCreate, TeacherEvaluationCreate
from app.modules.teachers.models import TeacherBooking
from app.modules.users.models import User, UserRole

media_room_provider = MockMediaRoomProvider()
speaking_evaluator = GeminiSpeakingEvaluator()


def _ensure_utc(dt: datetime.datetime | None) -> datetime.datetime | None:
    """Ensure datetime is timezone-aware in UTC (normalizes offset-naive SQLite datetimes)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.UTC)
    return dt


class SpeakingService:
    """Business logic for speaking sessions, room authorization, and scoring."""

    @staticmethod
    async def create_session(
        db: AsyncSession,
        user: User,
        payload: SpeakingSessionCreate,
    ) -> SpeakingSession:
        """Create a new speaking session with participants and server room allocation."""
        room_id = f"room_{uuid.uuid4().hex[:16]}"
        session = SpeakingSession(
            session_type=payload.session_type,
            status=SpeakingSessionState.SCHEDULED,
            topic=payload.topic,
            level=payload.level,
            duration_minutes=payload.duration_minutes,
            room_id=room_id,
            booking_id=payload.booking_id,
            created_by_user_id=user.id,
        )
        db.add(session)
        await db.flush()

        # 1. Primary student participant
        student_participant = SpeakingParticipant(
            session_id=session.id,
            user_id=user.id,
            role=SpeakingParticipantRole.STUDENT,
            display_name=user.email.split("@")[0],
        )
        db.add(student_participant)

        # 2. Add counter-participant depending on session type
        if payload.session_type == SpeakingSessionType.AI:
            from app.core.beta_limits import BetaLimitsService
            await BetaLimitsService.check_and_increment(user.id, "ai_oral")

            ai_participant = SpeakingParticipant(
                session_id=session.id,
                user_id=None,
                role=SpeakingParticipantRole.AI_ASSISTANT,
                display_name="Examinateur Virtuel TEF",
            )
            db.add(ai_participant)
        elif payload.session_type == SpeakingSessionType.TEACHER and payload.booking_id:
            # Look up booking to link teacher participant
            booking_stmt = (
                select(TeacherBooking)
                .where(TeacherBooking.id == payload.booking_id)
                .options(selectinload(TeacherBooking.teacher))
            )
            booking = (await db.execute(booking_stmt)).scalar_one_or_none()
            if booking and booking.teacher:
                teacher_participant = SpeakingParticipant(
                    session_id=session.id,
                    user_id=booking.teacher.user_id,
                    role=SpeakingParticipantRole.TEACHER,
                    display_name=booking.teacher.display_name,
                )
                db.add(teacher_participant)

        await db.commit()

        # Initialize media room abstraction
        media_room_provider.create_room(room_id=room_id, session_id=session.id)

        # Reload with selectin relationships
        return await SpeakingService.get_session_by_id(db, session.id, user)

    @staticmethod
    async def get_session_by_id(
        db: AsyncSession,
        session_id: uuid.UUID,
        user: User,
    ) -> SpeakingSession:
        """Fetch session checking authorization and enforcing server expiry."""
        stmt = (
            select(SpeakingSession)
            .where(SpeakingSession.id == session_id)
            .options(
                selectinload(SpeakingSession.participants),
                selectinload(SpeakingSession.evaluation),
            )
        )
        session = (await db.execute(stmt)).scalar_one_or_none()

        if not session:
            raise AppException(
                message="Speaking session not found",
                code="SESSION_NOT_FOUND",
                status_code=404,
            )

        # Authorization check: user must be participant, creator, or admin
        participant_user_ids = {p.user_id for p in session.participants if p.user_id}
        is_participant = user.id in participant_user_ids or session.created_by_user_id == user.id
        is_admin = user.role == UserRole.ADMIN

        if not (is_participant or is_admin):
            raise AppException(
                message="Not authorized to access this speaking session",
                code="FORBIDDEN",
                status_code=403,
            )

        # Check server timer expiry
        await SpeakingService.check_and_expire(db, session)
        return session

    @staticmethod
    async def list_user_sessions(
        db: AsyncSession,
        user: User,
    ) -> list[SpeakingSession]:
        """List speaking sessions where the user is a participant or creator."""
        stmt = (
            select(SpeakingSession)
            .join(SpeakingParticipant, SpeakingParticipant.session_id == SpeakingSession.id)
            .where(SpeakingParticipant.user_id == user.id)
            .options(
                selectinload(SpeakingSession.participants),
                selectinload(SpeakingSession.evaluation),
            )
            .order_by(SpeakingSession.created_at.desc())
        )
        result = await db.execute(stmt)
        sessions = list(result.scalars().unique().all())

        # Enforce server expiration on all fetched sessions
        for s in sessions:
            await SpeakingService.check_and_expire(db, s)
        return sessions

    @staticmethod
    async def start_session(
        db: AsyncSession,
        session_id: uuid.UUID,
        user: User,
    ) -> SpeakingSession:
        """Start session and activate server-authoritative timer."""
        session = await SpeakingService.get_session_by_id(db, session_id, user)

        if session.status in (
            SpeakingSessionState.COMPLETED,
            SpeakingSessionState.EXPIRED,
            SpeakingSessionState.CANCELLED,
        ):
            raise AppException(
                message=f"Cannot start session in status '{session.status.value}'",
                code="INVALID_SESSION_STATE",
                status_code=400,
            )

        if session.status != SpeakingSessionState.ACTIVE:
            now_utc = datetime.datetime.now(datetime.UTC)
            session.starts_at = now_utc
            session.expires_at = now_utc + datetime.timedelta(minutes=session.duration_minutes)
            session.status = SpeakingSessionState.ACTIVE
            await db.commit()
            await db.refresh(session)

        return session

    @staticmethod
    async def check_and_expire(db: AsyncSession, session: SpeakingSession) -> bool:
        """Enforce server-authoritative expiration."""
        expires_at = _ensure_utc(session.expires_at)
        if session.status == SpeakingSessionState.ACTIVE and expires_at:
            now_utc = datetime.datetime.now(datetime.UTC)
            if now_utc > expires_at:
                session.status = SpeakingSessionState.EXPIRED
                session.ended_at = expires_at
                media_room_provider.close_room(session.room_id)
                await db.commit()
                return True
        return False

    @staticmethod
    async def complete_session(
        db: AsyncSession,
        session_id: uuid.UUID,
        user: User,
    ) -> SpeakingSession:
        """Complete speaking session and generate structured evaluation for AI practice."""
        session = await SpeakingService.get_session_by_id(db, session_id, user)

        if session.status in (SpeakingSessionState.COMPLETED, SpeakingSessionState.CANCELLED):
            return session

        session.status = SpeakingSessionState.COMPLETED
        session.ended_at = datetime.datetime.now(datetime.UTC)
        media_room_provider.close_room(session.room_id)

        # If AI session without evaluation, generate evaluation via MockSpeakingProvider
        if session.session_type == SpeakingSessionType.AI and not session.evaluation:
            # Find primary student
            student_participant = next(
                (
                    p
                    for p in session.participants
                    if p.role == SpeakingParticipantRole.STUDENT and p.user_id
                ),
                None,
            )
            student_id = student_participant.user_id if student_participant else user.id

            # Retrieve conversation transcript accumulated during live session
            transcript = None
            try:
                from app.core.redis import RedisService
                redis_svc = RedisService(settings.REDIS_URL)
                transcript = await redis_svc.get(f"speaking_transcript:{session.id}")
            except Exception:  # noqa: BLE001, S110
                pass

            eval_result = await speaking_evaluator.evaluate_session(
                topic=session.topic,
                level=session.level,
                duration_seconds=session.duration_minutes * 60,
                transcript=transcript,
            )

            evaluator_type = (
                SpeakingEvaluatorType.AI
                if settings.GEMINI_API_KEY
                else SpeakingEvaluatorType.MOCK
            )

            evaluation = SpeakingEvaluation(
                session_id=session.id,
                student_id=student_id,
                evaluator_user_id=None,
                evaluator_type=evaluator_type,
                estimated_level=eval_result.estimated_level,
                fluency=eval_result.fluency,
                vocabulary=eval_result.vocabulary,
                grammar=eval_result.grammar,
                coherence=eval_result.coherence,
                pronunciation=eval_result.pronunciation,
                overall_score=eval_result.overall_score,
                strengths=eval_result.strengths,
                weaknesses=eval_result.weaknesses,
                recommendations=eval_result.recommendations,
                detailed_feedback=eval_result.detailed_feedback,
                is_official_tef=False,
            )
            db.add(evaluation)
            session.evaluation = evaluation
            await db.flush()

            # Attach speaking skills if available in database
            skills_stmt = select(Skill).where(Skill.category == SkillCategory.SPEAKING).limit(3)
            skills = (await db.execute(skills_stmt)).scalars().all()
            for s in skills:
                eval_skill = SpeakingEvaluationSkill(
                    evaluation_id=evaluation.id,
                    skill_id=s.id,
                    score=eval_result.overall_score,
                    notes=f"Compétence évaluée pour {s.name}",
                )
                db.add(eval_skill)

            # Ingest AI speaking evaluation into ReadinessEngine
            now_ev = datetime.datetime.now(datetime.UTC)
            for s in skills:
                try:
                    async with db.begin_nested():
                        await ReadinessEngine.ingest_evidence(
                            db=db,
                            student_id=student_id,
                            skill_id=s.id,
                            source_type=SkillEvidenceSourceType.AI_EVALUATION.value,
                            source_id=evaluation.id,
                            raw_score=eval_result.overall_score,
                            normalized_score=eval_result.overall_score,
                            confidence=0.80,
                            weight=1.0,
                            observed_at=now_ev,
                            metadata_payload={"session_id": str(session.id), "evaluator": "mock_speaking"},
                        )
                except Exception:  # noqa: BLE001, S110
                    pass

            if skills:
                try:
                    async with db.begin_nested():
                        await ReadinessEngine.recalculate_student_readiness(db, student_id)
                except Exception:  # noqa: BLE001, S110
                    pass

        await db.commit()
        return await SpeakingService.get_session_by_id(db, session_id, user)

    @staticmethod
    async def cancel_session(
        db: AsyncSession,
        session_id: uuid.UUID,
        user: User,
    ) -> SpeakingSession:
        """Cancel a speaking session."""
        session = await SpeakingService.get_session_by_id(db, session_id, user)
        if session.status in (SpeakingSessionState.COMPLETED, SpeakingSessionState.EXPIRED):
            raise AppException(
                message=f"Cannot cancel session in status '{session.status.value}'",
                code="INVALID_SESSION_STATE",
                status_code=400,
            )

        session.status = SpeakingSessionState.CANCELLED
        media_room_provider.close_room(session.room_id)
        await db.commit()
        return session

    @staticmethod
    async def submit_teacher_evaluation(
        db: AsyncSession,
        session_id: uuid.UUID,
        teacher_user: User,
        payload: TeacherEvaluationCreate,
    ) -> SpeakingEvaluation:
        """Certified teacher submits post-session evaluation."""
        session = await SpeakingService.get_session_by_id(db, session_id, teacher_user)

        # Check authorization: user must be the teacher participant or admin
        teacher_participant = next(
            (
                p
                for p in session.participants
                if p.role == SpeakingParticipantRole.TEACHER and p.user_id == teacher_user.id
            ),
            None,
        )
        if not teacher_participant and teacher_user.role != UserRole.ADMIN:
            raise AppException(
                message="Only the assigned teacher or admin can evaluate this speaking session",
                code="FORBIDDEN",
                status_code=403,
            )

        # Find student participant
        student_participant = next(
            (
                p
                for p in session.participants
                if p.role == SpeakingParticipantRole.STUDENT and p.user_id
            ),
            None,
        )
        if not student_participant or not student_participant.user_id:
            raise AppException(
                message="Student participant not found for this session",
                code="STUDENT_NOT_FOUND",
                status_code=400,
            )

        # Complete session if not already completed
        if session.status != SpeakingSessionState.COMPLETED:
            session.status = SpeakingSessionState.COMPLETED
            session.ended_at = datetime.datetime.now(datetime.UTC)

        evaluation = SpeakingEvaluation(
            session_id=session.id,
            student_id=student_participant.user_id,
            evaluator_user_id=teacher_user.id,
            evaluator_type=SpeakingEvaluatorType.TEACHER,
            estimated_level=payload.estimated_level,
            fluency=payload.fluency,
            vocabulary=payload.vocabulary,
            grammar=payload.grammar,
            coherence=payload.coherence,
            pronunciation=payload.pronunciation,
            overall_score=payload.overall_score,
            strengths=payload.strengths,
            weaknesses=payload.weaknesses,
            recommendations=payload.recommendations,
            detailed_feedback=payload.detailed_feedback,
            is_official_tef=False,
        )
        db.add(evaluation)
        await db.commit()
        await db.refresh(evaluation)

        # Ingest teacher speaking evidence into ReadinessEngine
        speaking_skill = (
            await db.execute(
                select(Skill).where(Skill.code.in_(["speaking", "expression_orale", "EO", "speaking_b2"]))
            )
        ).scalar_one_or_none()
        if not speaking_skill:
            speaking_skill = (
                await db.execute(
                    select(Skill).where(Skill.name.ilike("%speaking%") | Skill.name.ilike("%orale%"))
                )
            ).scalars().first()

        now_te = datetime.datetime.now(datetime.UTC)
        if speaking_skill and student_participant.user_id:
            try:
                await ReadinessEngine.ingest_evidence(
                    db=db,
                    student_id=student_participant.user_id,
                    skill_id=speaking_skill.id,
                    source_type=SkillEvidenceSourceType.TEACHER_EVALUATION.value,
                    source_id=evaluation.id,
                    raw_score=payload.overall_score,
                    normalized_score=payload.overall_score,
                    confidence=0.95,
                    weight=1.0,
                    observed_at=now_te,
                    metadata_payload={
                        "session_id": str(session.id),
                        "evaluator": "teacher",
                        "level": payload.estimated_level,
                    },
                )
                await ReadinessEngine.recalculate_student_readiness(db, student_participant.user_id)
            except Exception:  # noqa: BLE001, S110
                pass

        return evaluation

    @staticmethod
    async def authorize_room_connection(
        db: AsyncSession,
        room_id: str,
        token: str,
    ) -> tuple[SpeakingSession, User, SpeakingParticipant]:
        """Authorize participant for WebRTC WebSocket connection.

        Verifies:
        1. Token is cryptographically valid and not expired.
        2. User exists in database.
        3. Media room / session exists.
        4. Session is not expired or completed.
        5. User belongs to the session participants.
        """
        token_payload = decode_access_token(token)
        if not token_payload:
            raise AppException(
                message="Invalid or expired access token",
                code="INVALID_TOKEN",
                status_code=401,
            )

        jti = token_payload.get("jti")
        if jti and await is_token_revoked(jti):
            raise AppException(
                message="Token has been revoked",
                code="TOKEN_REVOKED",
                status_code=401,
            )

        user_id_str = token_payload.get("sub")
        if not user_id_str:
            raise AppException(
                message="Token subject missing",
                code="INVALID_TOKEN",
                status_code=401,
            )

        user_id = uuid.UUID(user_id_str)
        user_stmt = select(User).where(User.id == user_id)
        user = (await db.execute(user_stmt)).scalar_one_or_none()
        if not user:
            raise AppException(
                message="User not found",
                code="USER_NOT_FOUND",
                status_code=404,
            )

        session_stmt = (
            select(SpeakingSession)
            .where(SpeakingSession.room_id == room_id)
            .options(selectinload(SpeakingSession.participants))
        )
        session = (await db.execute(session_stmt)).scalar_one_or_none()
        if not session:
            raise AppException(
                message="Speaking media room not found",
                code="ROOM_NOT_FOUND",
                status_code=404,
            )

        # Check timer expiration
        is_expired = await SpeakingService.check_and_expire(db, session)
        if is_expired or session.status in (
            SpeakingSessionState.EXPIRED,
            SpeakingSessionState.COMPLETED,
            SpeakingSessionState.CANCELLED,
        ):
            raise AppException(
                message=f"Session is closed or expired (status: {session.status.value})",
                code="SESSION_CLOSED",
                status_code=400,
            )

        # Find matching participant
        participant = next((p for p in session.participants if p.user_id == user.id), None)
        if not participant and user.role != UserRole.ADMIN:
            raise AppException(
                message="User is not authorized as a participant for this speaking session",
                code="FORBIDDEN",
                status_code=403,
            )

        return session, user, participant  # type: ignore[return-value]
