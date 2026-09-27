"""Service layer orchestrating TEF Speaking Examinations, Section Transitions, and Turn Lifecycle."""

import datetime
import uuid

import structlog
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.modules.admin.speaking_scenario_models import SpeakingScenario
from app.modules.speaking.enums import (
    ConversationState,
    ExamSectionType,
    SpeakingExamState,
    SpeakingParticipantRole,
    SpeakingSectionState,
    SpeakingSessionState,
    SpeakingSessionType,
    SpeakingTurnState,
    TranscriptStatus,
)
from app.modules.speaking.models import (
    SpeakingExam,
    SpeakingParticipant,
    SpeakingSection,
    SpeakingSession,
    SpeakingTurn,
)
from app.modules.speaking.providers.gemini_live import build_examiner_instructions
from app.modules.speaking.schemas import (
    SpeakingExamCreate,
    SpeakingExamStateResponse,
    SpeakingSectionResponse,
    SpeakingTurnCreate,
)

logger = structlog.get_logger("tef-api.speaking.exam_service")


def _not_found(msg: str) -> AppException:
    return AppException(message=msg, code="NOT_FOUND", status_code=404)


def _forbidden(msg: str) -> AppException:
    return AppException(message=msg, code="FORBIDDEN", status_code=403)


def _bad_request(msg: str) -> AppException:
    return AppException(message=msg, code="BAD_REQUEST", status_code=400)


def _ensure_utc(dt: datetime.datetime | None) -> datetime.datetime | None:
    """Ensure datetime is timezone-aware in UTC (normalizes offset-naive datetimes)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.UTC)
    return dt


# Default TEF Section Times (Server Authoritative)
SECTION_A_DURATION_SECONDS = 600  # 10 minutes
SECTION_B_DURATION_SECONDS = 900  # 15 minutes


class SpeakingExamService:
    """Orchestrates authoritative TEF Speaking Examination state machine and turn logging."""

    @staticmethod
    async def create_exam(
        db: AsyncSession,
        student_id: uuid.UUID,
        payload: SpeakingExamCreate,
    ) -> SpeakingExam:
        """Create a new structured TEF Speaking Exam with Section A and Section B tasks."""
        topic = payload.topic or "TEF Expression Orale — Épreuve Officielle Simulée"
        target_level = payload.target_level or "B2"
        room_id = f"room-exam-{uuid.uuid4().hex[:12]}"

        # 1. Create underlying SpeakingSession for realtime WebRTC audio signaling
        session = SpeakingSession(
            session_type=SpeakingSessionType.AI,
            status=SpeakingSessionState.SCHEDULED,
            topic=topic,
            level=target_level,
            duration_minutes=25,
            room_id=room_id,
            created_by_user_id=student_id,
        )
        db.add(session)
        await db.flush()

        # Add participants
        student_part = SpeakingParticipant(
            session_id=session.id,
            user_id=student_id,
            role=SpeakingParticipantRole.STUDENT,
            display_name="Candidat",
            is_connected=False,
        )
        ai_part = SpeakingParticipant(
            session_id=session.id,
            user_id=None,
            role=SpeakingParticipantRole.AI_ASSISTANT,
            display_name="Examinateur Virtuel TEF",
            is_connected=False,
        )
        db.add_all([student_part, ai_part])

        # 2. Create authoritative SpeakingExam
        exam = SpeakingExam(
            student_id=student_id,
            session_id=session.id,
            status=SpeakingExamState.CREATED,
            current_section_type=ExamSectionType.SECTION_A,
            topic=topic,
            target_level=target_level,
            total_duration_minutes=25,
            config_version="v1",
        )
        db.add(exam)
        await db.flush()

        # Link session to exam
        session.exam = exam

        # 3. Create Section A (Demande d'informations formelle - 10 min)
        # Dynamically lookup active authentic scenario matching target level
        scen_a_stmt = (
            select(SpeakingScenario)
            .where(SpeakingScenario.is_active == True, SpeakingScenario.section == "section_a")
            .order_by(
                case((SpeakingScenario.target_level == target_level, 0), else_=1),
                func.random(),
            )
            .limit(1)
        )
        scenario_a = (await db.execute(scen_a_stmt)).scalar_one_or_none()

        if scenario_a and not payload.section_a_topic:
            sec_a_topic = scenario_a.title
            sec_a_desc = (
                f"Échange avec {scenario_a.persona_name} ({scenario_a.role_title}). "
                "Posez une dizaine de questions formelles pour obtenir des renseignements détaillés sur l'annonce."
            )
            sec_a_context = f"ANNONCE : {scenario_a.document_title}\n\n{scenario_a.document_content}"
            sec_a_persona = scenario_a.voice_persona
            sec_a_scepticism = scenario_a.scepticism_level
        else:
            sec_a_topic = payload.section_a_topic or "Séjour linguistique d'immersion en Provence"
            sec_a_desc = "Posez une dizaine de questions formelles pour obtenir des renseignements détaillés sur l'annonce."
            sec_a_context = (
                "Vous téléphonez pour obtenir des renseignements sur une annonce de séjour linguistique en Provence. "
                "Posez des questions précises sur les tarifs, les dates, le logement et les activités."
            )
            sec_a_persona = "Aoede"
            sec_a_scepticism = 0.5

        sec_a_prompt = build_examiner_instructions(
            topic=sec_a_topic,
            level=target_level,
            scepticism_level=sec_a_scepticism,
            section=ExamSectionType.SECTION_A,
            scenario=scenario_a if (scenario_a and not payload.section_a_topic) else None,
        )
        section_a = SpeakingSection(
            exam_id=exam.id,
            section_type=ExamSectionType.SECTION_A,
            sequence=1,
            title="Section A : Demande d'informations formelle",
            description=sec_a_desc,
            prompt_topic=sec_a_topic,
            prompt_context=sec_a_context,
            examiner_persona=sec_a_persona,
            system_prompt=sec_a_prompt,
            duration_seconds=SECTION_A_DURATION_SECONDS,
            status=SpeakingSectionState.PENDING,
        )

        # 4. Create Section B (Argumentation et persuasion amicale - 15 min)
        # Dynamically lookup active authentic scenario matching target level
        scen_b_stmt = (
            select(SpeakingScenario)
            .where(SpeakingScenario.is_active == True, SpeakingScenario.section == "section_b")
            .order_by(
                case((SpeakingScenario.target_level == target_level, 0), else_=1),
                func.random(),
            )
            .limit(1)
        )
        scenario_b = (await db.execute(scen_b_stmt)).scalar_one_or_none()

        if scenario_b and not payload.section_b_topic:
            sec_b_topic = scenario_b.title
            sec_b_desc = (
                f"Échange avec {scenario_b.persona_name} ({scenario_b.role_title}). "
                "Convainquez votre ami(e) d'adhérer à votre projet en surmontant ses objections avec tact."
            )
            sec_b_context = f"ARTICLE / SITUATION : {scenario_b.document_title}\n\n{scenario_b.document_content}"
            sec_b_persona = scenario_b.voice_persona
            sec_b_scepticism = scenario_b.scepticism_level
        else:
            sec_b_topic = payload.section_b_topic or "Partir vivre en colocation écologique en périphérie"
            sec_b_desc = "Convainquez votre ami(e) d'adhérer à votre projet en surmontant ses objections avec tact."
            sec_b_context = (
                "Vous essayez de convaincre votre ami(e) d'emménager dans une colocation écologique. "
                "Votre interlocuteur est sceptique quant aux coûts, au temps de trajet et aux contraintes."
            )
            sec_b_persona = "Fenrir"
            sec_b_scepticism = 0.75

        sec_b_prompt = build_examiner_instructions(
            topic=sec_b_topic,
            level=target_level,
            scepticism_level=sec_b_scepticism,
            section=ExamSectionType.SECTION_B,
            scenario=scenario_b if (scenario_b and not payload.section_b_topic) else None,
        )
        section_b = SpeakingSection(
            exam_id=exam.id,
            section_type=ExamSectionType.SECTION_B,
            sequence=2,
            title="Section B : Argumentation et persuasion",
            description=sec_b_desc,
            prompt_topic=sec_b_topic,
            prompt_context=sec_b_context,
            examiner_persona=sec_b_persona,
            system_prompt=sec_b_prompt,
            duration_seconds=SECTION_B_DURATION_SECONDS,
            status=SpeakingSectionState.PENDING,
        )

        db.add_all([section_a, section_b])
        await db.commit()

        # Re-fetch exam with all eager relationships loaded
        return await SpeakingExamService.get_exam(db, exam.id, student_id)

    @staticmethod
    async def get_exam(
        db: AsyncSession,
        exam_id: uuid.UUID,
        user_id: uuid.UUID | None = None,
    ) -> SpeakingExam:
        """Fetch exam and verify ownership, updating section timer expiry if elapsed."""
        stmt = (
            select(SpeakingExam)
            .options(
                selectinload(SpeakingExam.sections).selectinload(SpeakingSection.turns),
                selectinload(SpeakingExam.session).selectinload(SpeakingSession.participants),
                selectinload(SpeakingExam.evaluation),
            )
            .where(SpeakingExam.id == exam_id)
        )
        res = await db.execute(stmt)
        exam = res.scalar_one_or_none()

        if not exam:
            raise _not_found(f"Speaking exam {exam_id} not found.")

        if user_id and exam.student_id != user_id:
            raise _forbidden("You do not have access to this speaking exam.")

        # Authoritative server timer synchronization
        await SpeakingExamService._sync_server_timers(db, exam)

        return exam

    @staticmethod
    async def get_exam_by_session_id(
        db: AsyncSession,
        session_id: uuid.UUID,
        user_id: uuid.UUID | None = None,
    ) -> SpeakingExam | None:
        """Find an associated SpeakingExam given a SpeakingSession ID."""
        stmt = (
            select(SpeakingExam)
            .options(
                selectinload(SpeakingExam.sections).selectinload(SpeakingSection.turns),
                selectinload(SpeakingExam.session),
                selectinload(SpeakingExam.evaluation),
            )
            .where(SpeakingExam.session_id == session_id)
        )
        res = await db.execute(stmt)
        exam = res.scalar_one_or_none()
        if exam and user_id and exam.student_id != user_id:
            raise _forbidden("You do not have access to this speaking exam.")
        return exam

    @staticmethod
    async def start_exam(
        db: AsyncSession,
        exam_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> SpeakingExam:
        """Start the exam and activate Section A. Idempotent on repeated calls."""
        exam = await SpeakingExamService.get_exam(db, exam_id, user_id)

        # Idempotency: if already active in Section A, return immediately
        if exam.status == SpeakingExamState.SECTION_A_ACTIVE:
            return exam

        # Terminal / invalid transition checks
        if exam.status in (
            SpeakingExamState.COMPLETED,
            SpeakingExamState.EVALUATING,
            SpeakingExamState.EVALUATED,
            SpeakingExamState.CANCELLED,
            SpeakingExamState.EXPIRED,
            SpeakingExamState.FAILED,
        ):
            raise _bad_request(f"Cannot start exam in terminal state: {exam.status.value}")

        now = datetime.datetime.now(datetime.UTC)
        exam.status = SpeakingExamState.SECTION_A_ACTIVE
        exam.current_section_type = ExamSectionType.SECTION_A
        if not exam.started_at:
            exam.started_at = now

        # Activate Section A
        sec_a = next((s for s in exam.sections if s.section_type == ExamSectionType.SECTION_A), None)
        if sec_a:
            sec_a.status = SpeakingSectionState.ACTIVE
            if not sec_a.started_at:
                sec_a.started_at = now
            if not sec_a.expires_at:
                sec_a.expires_at = now + datetime.timedelta(seconds=sec_a.duration_seconds)

            # Sync underlying session timer
            if exam.session:
                exam.session.status = SpeakingSessionState.ACTIVE
                exam.session.starts_at = exam.session.starts_at or now
                exam.session.expires_at = sec_a.expires_at

        await db.commit()
        logger.info(
            "speaking_exam_started",
            exam_id=str(exam.id),
            student_id=str(user_id),
            section=ExamSectionType.SECTION_A.value,
        )
        return await SpeakingExamService.get_exam(db, exam_id, user_id)

    @staticmethod
    async def complete_section(
        db: AsyncSession,
        exam_id: uuid.UUID,
        section_type: ExamSectionType,
        user_id: uuid.UUID,
    ) -> SpeakingExam:
        """Complete an active section.

        Section A -> transitions to SECTION_B_PREPARING.
        Section B -> transitions to COMPLETED and triggers evaluation.
        Idempotent on repeated calls.
        """
        exam = await SpeakingExamService.get_exam(db, exam_id, user_id)
        now = datetime.datetime.now(datetime.UTC)

        if section_type == ExamSectionType.SECTION_A:
            # Idempotent: already completed Section A
            if exam.status in (
                SpeakingExamState.SECTION_A_COMPLETED,
                SpeakingExamState.SECTION_B_PREPARING,
                SpeakingExamState.SECTION_B_ACTIVE,
                SpeakingExamState.COMPLETED,
                SpeakingExamState.EVALUATING,
                SpeakingExamState.EVALUATED,
            ):
                return exam

            if exam.status != SpeakingExamState.SECTION_A_ACTIVE:
                raise _bad_request(f"Cannot complete Section A from status {exam.status.value}")

            sec_a = next((s for s in exam.sections if s.section_type == ExamSectionType.SECTION_A), None)
            if sec_a:
                sec_a.status = SpeakingSectionState.COMPLETED
                sec_a.completed_at = sec_a.completed_at or now

            exam.status = SpeakingExamState.SECTION_B_PREPARING
            exam.current_section_type = ExamSectionType.SECTION_B
            await db.commit()
            logger.info("speaking_section_a_completed", exam_id=str(exam.id))
            return await SpeakingExamService.get_exam(db, exam_id, user_id)

        if section_type == ExamSectionType.SECTION_B:
            # Idempotent: already completed Section B / exam
            if exam.status in (
                SpeakingExamState.COMPLETED,
                SpeakingExamState.EVALUATING,
                SpeakingExamState.EVALUATED,
            ):
                return exam

            if exam.status != SpeakingExamState.SECTION_B_ACTIVE:
                raise _bad_request(f"Cannot complete Section B from status {exam.status.value}")

            sec_b = next((s for s in exam.sections if s.section_type == ExamSectionType.SECTION_B), None)
            if sec_b:
                sec_b.status = SpeakingSectionState.COMPLETED
                sec_b.completed_at = sec_b.completed_at or now

            exam.status = SpeakingExamState.COMPLETED
            exam.completed_at = exam.completed_at or now

            if exam.session:
                exam.session.status = SpeakingSessionState.COMPLETED
                exam.session.ended_at = now

            await db.commit()
            logger.info("speaking_exam_completed", exam_id=str(exam.id))

            # Auto-evaluate session asynchronously or inline if service available
            await SpeakingExamService._trigger_auto_evaluation(db, exam)

            return await SpeakingExamService.get_exam(db, exam_id, user_id)

        raise _bad_request(f"Unknown section type: {section_type}")

    @staticmethod
    async def start_section(
        db: AsyncSession,
        exam_id: uuid.UUID,
        section_type: ExamSectionType,
        user_id: uuid.UUID,
    ) -> SpeakingExam:
        """Start Section B after preparation. Idempotent."""
        exam = await SpeakingExamService.get_exam(db, exam_id, user_id)

        if section_type == ExamSectionType.SECTION_B:
            # Idempotency
            if exam.status == SpeakingExamState.SECTION_B_ACTIVE:
                return exam

            if exam.status != SpeakingExamState.SECTION_B_PREPARING:
                raise _bad_request(
                    f"Cannot start Section B: Exam is in state {exam.status.value}, expected SECTION_B_PREPARING."
                )

            now = datetime.datetime.now(datetime.UTC)
            sec_b = next((s for s in exam.sections if s.section_type == ExamSectionType.SECTION_B), None)
            if sec_b:
                sec_b.status = SpeakingSectionState.ACTIVE
                sec_b.started_at = sec_b.started_at or now
                sec_b.expires_at = now + datetime.timedelta(seconds=sec_b.duration_seconds)

            exam.status = SpeakingExamState.SECTION_B_ACTIVE
            exam.current_section_type = ExamSectionType.SECTION_B

            if exam.session:
                exam.session.status = SpeakingSessionState.ACTIVE
                if sec_b and sec_b.expires_at:
                    exam.session.expires_at = sec_b.expires_at

            await db.commit()
            logger.info("speaking_section_b_started", exam_id=str(exam.id))
            return await SpeakingExamService.get_exam(db, exam_id, user_id)

        if section_type == ExamSectionType.SECTION_A:
            return await SpeakingExamService.start_exam(db, exam_id, user_id)

        raise _bad_request(f"Unsupported section type: {section_type}")

    @staticmethod
    async def get_exam_state(
        db: AsyncSession,
        exam_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> SpeakingExamStateResponse:
        """Get authoritative real-time state, countdown timer, and turn permission."""
        exam = await SpeakingExamService.get_exam(db, exam_id, user_id)
        now = datetime.datetime.now(datetime.UTC)

        current_sec = None
        rem_sec = 0
        can_submit = False
        can_advance = False

        if exam.current_section_type:
            current_sec = next(
                (s for s in exam.sections if s.section_type == exam.current_section_type),
                None,
            )

        sec_expires = _ensure_utc(current_sec.expires_at) if current_sec else None
        if current_sec and current_sec.status == SpeakingSectionState.ACTIVE and sec_expires:
            delta = (sec_expires - now).total_seconds()
            rem_sec = max(0, int(delta))
            can_submit = rem_sec > 0
            can_advance = True
        elif exam.status == SpeakingExamState.SECTION_B_PREPARING:
            rem_sec = 60  # Standard 60 seconds preparation window for Section B
            can_submit = False
            can_advance = True
        elif exam.status in (SpeakingExamState.CREATED, SpeakingExamState.READY):
            rem_sec = SECTION_A_DURATION_SECONDS
            can_submit = False
            can_advance = True

        # Total remaining duration across remaining sections
        total_rem = rem_sec
        if exam.current_section_type == ExamSectionType.SECTION_A and exam.status == SpeakingExamState.SECTION_A_ACTIVE:
            total_rem += SECTION_B_DURATION_SECONDS

        conv_state = ConversationState.IDLE
        if exam.status in (SpeakingExamState.SECTION_A_ACTIVE, SpeakingExamState.SECTION_B_ACTIVE):
            conv_state = ConversationState.WAITING_FOR_CANDIDATE
        elif exam.status == SpeakingExamState.SECTION_B_PREPARING:
            conv_state = ConversationState.PREPARING
        elif exam.status in (SpeakingExamState.COMPLETED, SpeakingExamState.EVALUATING, SpeakingExamState.EVALUATED):
            conv_state = ConversationState.COMPLETED
        elif exam.status in (SpeakingExamState.EXPIRED, SpeakingExamState.CANCELLED, SpeakingExamState.FAILED):
            conv_state = ConversationState.ERROR

        current_sec_resp = (
            SpeakingSectionResponse.model_validate(current_sec) if current_sec else None
        )
        if current_sec_resp:
            current_sec_resp.remaining_seconds = rem_sec

        prep_sec = 60 if exam.status == SpeakingExamState.SECTION_B_PREPARING else None

        return SpeakingExamStateResponse(
            exam_id=exam.id,
            status=exam.status,
            current_section_type=exam.current_section_type,
            current_section=current_sec_resp,
            conversation_state=conv_state,
            remaining_section_seconds=rem_sec,
            prep_remaining_seconds=prep_sec,
            total_remaining_seconds=total_rem,
            can_submit_turn=can_submit,
            can_advance_section=can_advance,
        )

    @staticmethod
    async def record_turn(
        db: AsyncSession,
        exam_id: uuid.UUID,
        section_type: ExamSectionType,
        turn_data: SpeakingTurnCreate,
        user_id: uuid.UUID,
    ) -> SpeakingTurn:
        """Idempotently record a completed or interrupted conversational turn with row-level locking."""
        exam = await SpeakingExamService.get_exam(db, exam_id, user_id)
        section = next((s for s in exam.sections if s.section_type == section_type), None)
        if not section:
            raise _not_found(f"Section {section_type} not found for exam {exam_id}")

        # Row-level lock on SpeakingSection to serialize concurrent turn generation
        sec_lock_stmt = (
            select(SpeakingSection)
            .where(SpeakingSection.id == section.id)
            .with_for_update()
        )
        await db.execute(sec_lock_stmt)

        # Idempotency check: if client_turn_id matches an existing turn in this section, return it
        if turn_data.client_turn_id:
            existing_stmt = select(SpeakingTurn).where(
                SpeakingTurn.section_id == section.id,
                SpeakingTurn.client_turn_id == turn_data.client_turn_id,
            )
            existing_res = await db.execute(existing_stmt)
            existing_turn = existing_res.scalar_one_or_none()
            if existing_turn:
                dirty = False
                if turn_data.content_text and existing_turn.content_text != turn_data.content_text:
                    existing_turn.content_text = turn_data.content_text
                    dirty = True
                audio_key = turn_data.audio_storage_key or turn_data.audio_key
                if audio_key and existing_turn.audio_storage_key != audio_key:
                    existing_turn.audio_storage_key = audio_key
                    dirty = True
                duration = turn_data.audio_duration_seconds or turn_data.duration_seconds
                if duration is not None and existing_turn.audio_duration_seconds != duration:
                    existing_turn.audio_duration_seconds = duration
                    dirty = True
                if turn_data.transcript_status and existing_turn.transcript_status != turn_data.transcript_status:
                    existing_turn.transcript_status = turn_data.transcript_status
                    dirty = True
                if turn_data.interrupted and not existing_turn.interrupted:
                    existing_turn.interrupted = True
                    existing_turn.interruption_reason = turn_data.interruption_reason
                    dirty = True
                if dirty:
                    await db.commit()
                    await db.refresh(existing_turn)
                return existing_turn

        # Calculate next turn number for this section
        max_turn_stmt = select(func.max(SpeakingTurn.turn_number)).where(
            SpeakingTurn.section_id == section.id
        )
        max_turn_res = await db.execute(max_turn_stmt)
        next_number = (max_turn_res.scalar() or 0) + 1

        audio_key = turn_data.audio_storage_key or turn_data.audio_key
        duration = turn_data.audio_duration_seconds or turn_data.duration_seconds
        transcript_status = turn_data.transcript_status
        if (
            not turn_data.content_text or not turn_data.content_text.strip()
        ) and transcript_status == TranscriptStatus.COMPLETED:
            transcript_status = TranscriptStatus.EMPTY

        turn_state = (
            SpeakingTurnState.INTERRUPTED
            if turn_data.interrupted
            else SpeakingTurnState.COMPLETED
        )

        now = datetime.datetime.now(datetime.UTC)
        turn = SpeakingTurn(
            section_id=section.id,
            section=section,
            turn_number=next_number,
            speaker=turn_data.speaker,
            state=turn_state,
            content_text=turn_data.content_text,
            transcript_status=transcript_status,
            audio_storage_key=audio_key,
            audio_duration_seconds=duration,
            interrupted=turn_data.interrupted,
            interruption_reason=turn_data.interruption_reason,
            transcription_confidence=turn_data.transcription_confidence,
            turn_metadata=turn_data.turn_metadata,
            started_at=now,
            completed_at=now,
            client_turn_id=turn_data.client_turn_id,
        )
        db.add(turn)
        await db.commit()
        await db.refresh(turn)
        return turn

    @staticmethod
    async def list_turns(
        db: AsyncSession,
        exam_id: uuid.UUID,
        section_type: ExamSectionType,
        user_id: uuid.UUID,
    ) -> list[SpeakingTurn]:
        """Fetch all conversational turns for a section ordered by turn_number."""
        exam = await SpeakingExamService.get_exam(db, exam_id, user_id)
        section = next((s for s in exam.sections if s.section_type == section_type), None)
        if not section:
            raise _not_found(f"Section {section_type} not found")

        stmt = (
            select(SpeakingTurn)
            .where(SpeakingTurn.section_id == section.id)
            .order_by(SpeakingTurn.turn_number.asc())
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def list_student_exams(
        db: AsyncSession,
        student_id: uuid.UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[SpeakingExam], int]:
        """List historical and active exams for a student."""
        count_stmt = select(func.count(SpeakingExam.id)).where(SpeakingExam.student_id == student_id)
        total_res = await db.execute(count_stmt)
        total = total_res.scalar() or 0

        stmt = (
            select(SpeakingExam)
            .options(
                selectinload(SpeakingExam.sections).selectinload(SpeakingSection.turns),
                selectinload(SpeakingExam.session),
                selectinload(SpeakingExam.evaluation),
            )
            .where(SpeakingExam.student_id == student_id)
            .order_by(SpeakingExam.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        res = await db.execute(stmt)
        return list(res.scalars().all()), total

    # ---------------------------------------------------------------------------
    # Private Helpers
    # ---------------------------------------------------------------------------
    @staticmethod
    async def _sync_server_timers(db: AsyncSession, exam: SpeakingExam) -> None:
        """Check active section expiration against current server timestamp."""
        now = datetime.datetime.now(datetime.UTC)
        dirty = False

        for sec in exam.sections:
            sec_expires = _ensure_utc(sec.expires_at)
            if sec.status == SpeakingSectionState.ACTIVE and sec_expires and now >= sec_expires:
                sec.status = SpeakingSectionState.EXPIRED
                sec.completed_at = sec_expires
                dirty = True

                # Transition exam state on expiration
                if sec.section_type == ExamSectionType.SECTION_A:
                    exam.status = SpeakingExamState.SECTION_B_PREPARING
                    exam.current_section_type = ExamSectionType.SECTION_B
                elif sec.section_type == ExamSectionType.SECTION_B:
                    exam.status = SpeakingExamState.COMPLETED
                    exam.completed_at = sec.expires_at
                    if exam.session:
                        exam.session.status = SpeakingSessionState.COMPLETED

        if dirty:
            await db.commit()

    @staticmethod
    async def _trigger_auto_evaluation(db: AsyncSession, exam: SpeakingExam) -> None:
        """Trigger evaluation for the completed exam asynchronously via Celery."""
        from app.core.config import settings

        if settings.ENVIRONMENT in ("testing", "test"):
            # In testing environment, avoid attempting Celery broker connections during HTTP requests
            return

        try:
            from app.workers.tasks import evaluate_speaking_exam_task

            evaluate_speaking_exam_task.delay(str(exam.id))
            exam.status = SpeakingExamState.EVALUATING
            await db.commit()
            logger.info("speaking_exam_evaluation_task_queued", exam_id=str(exam.id))
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "celery_broker_unavailable_evaluation_not_queued",
                exam_id=str(exam.id),
                error=str(exc),
            )
