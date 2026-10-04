import asyncio
import datetime
import uuid
from typing import Any

import structlog
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.modules.admin.models import AssessmentVersion
from app.modules.assessments.enums import (
    AssessmentType,
    AttemptStatus,
)
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    AssessmentSectionQuestion,
    Attempt,
    AttemptAnswer,
    AttemptScore,
    Question,
    QuestionSkillTag,
)
from app.modules.assessments.schemas import AnswerSubmitRequest
from app.modules.assessments.scoring import ScoringEngine
from app.modules.learning.enums import RecommendationStatus
from app.modules.learning.models import Exercise, Recommendation
from app.modules.learning.service import LearningService

logger = structlog.get_logger("tef-api.assessments")


def _ensure_utc(dt: datetime.datetime | None) -> datetime.datetime | None:
    """Ensure datetime is timezone-aware in UTC (normalizes offset-naive SQLite datetimes)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.UTC)
    return dt


class AssessmentService:
    """Manages assessment lifecycle, student attempts, answers, and scoring."""

    _submit_lock: asyncio.Lock = asyncio.Lock()

    @staticmethod
    async def list_assessments(
        db: AsyncSession,
        assessment_type: AssessmentType | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict[str, Any]], int]:
        """List published assessments with section and question counts."""
        stmt = (
            select(Assessment)
            .where(Assessment.is_published.is_(True))
            .options(selectinload(Assessment.sections).selectinload(AssessmentSection.questions))
            .order_by(Assessment.created_at.desc())
        )

        if assessment_type:
            stmt = stmt.where(Assessment.assessment_type == assessment_type)

        # Count total matching assessments
        count_stmt = select(func.count(Assessment.id)).where(Assessment.is_published.is_(True))
        if assessment_type:
            count_stmt = count_stmt.where(Assessment.assessment_type == assessment_type)
        total = await db.scalar(count_stmt) or 0

        # Apply pagination
        offset = (page - 1) * page_size
        stmt = stmt.offset(offset).limit(page_size)
        result = await db.execute(stmt)
        assessments = result.scalars().all()

        items: list[dict[str, Any]] = []
        for a in assessments:
            q_count = sum(len(s.questions) for s in a.sections)
            t_points = sum(sum(q.points for q in s.questions) for s in a.sections)
            items.append(
                {
                    "id": a.id,
                    "title": a.title,
                    "description": a.description,
                    "assessment_type": a.assessment_type,
                    "duration_seconds": a.duration_seconds,
                    "estimated_completion_time_minutes": max(5, round(a.duration_seconds / 60)),
                    "level": "B1-C1",
                    "navigation_policy": a.navigation_policy,
                    "scoring_policy": a.scoring_policy,
                    "max_attempts": a.max_attempts,
                    "pass_percentage": a.pass_percentage,
                    "section_count": len(a.sections),
                    "question_count": q_count,
                    "total_points": t_points,
                }
            )

        return items, total

    @staticmethod
    async def get_assessment_for_taking(
        db: AsyncSession,
        assessment_id: uuid.UUID,
    ) -> Assessment:
        """Fetch assessment with sections and questions for student taking (hiding answers)."""
        stmt = (
            select(Assessment)
            .where(Assessment.id == assessment_id, Assessment.is_published.is_(True))
            .options(
                selectinload(Assessment.sections)
                .selectinload(AssessmentSection.questions)
                .selectinload(Question.options),
                selectinload(Assessment.sections)
                .selectinload(AssessmentSection.questions)
                .selectinload(Question.skill_tags),
            )
        )
        result = await db.execute(stmt)
        assessment = result.scalar_one_or_none()
        if not assessment:
            raise AppException(
                message="Assessment not found",
                code="ASSESSMENT_NOT_FOUND",
                status_code=404,
            )
        return assessment

    @staticmethod
    async def create_attempt(
        db: AsyncSession,
        assessment_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Attempt:
        """Start a new assessment attempt and set authoritative server-side timestamps."""
        assessment = await db.scalar(
            select(Assessment).where(
                Assessment.id == assessment_id,
                Assessment.is_published.is_(True),
            )
        )
        if not assessment:
            raise AppException(
                message="Assessment not found or not published",
                code="ASSESSMENT_NOT_FOUND",
                status_code=404,
            )

        # Enforce max attempts limit
        if assessment.max_attempts is not None:
            attempt_count_stmt = select(func.count(Attempt.id)).where(
                Attempt.assessment_id == assessment_id,
                Attempt.user_id == user_id,
            )
            count = await db.scalar(attempt_count_stmt) or 0
            if count >= assessment.max_attempts:
                raise AppException(
                    message="Maximum allowed attempts reached for this assessment",
                    code="MAX_ATTEMPTS_REACHED",
                    status_code=400,
                )

        # Check for existing in-progress active attempt
        now = datetime.datetime.now(datetime.UTC)
        existing_active = await db.scalar(
            select(Attempt)
            .where(
                Attempt.assessment_id == assessment_id,
                Attempt.user_id == user_id,
                Attempt.status == AttemptStatus.STARTED,
            )
            .options(selectinload(Attempt.answers))
        )
        if existing_active:
            exp = _ensure_utc(existing_active.expires_at)
            if exp and now <= exp:
                logger.info(
                    "resuming_active_attempt",
                    attempt_id=str(existing_active.id),
                    user_id=str(user_id),
                )
                return existing_active
            else:
                # Expire previous attempt and auto-finalize
                existing_active.status = AttemptStatus.EXPIRED
                await db.flush()
                try:
                    await AssessmentService.submit_attempt(
                        db=db,
                        attempt_id=existing_active.id,
                        current_user_id=user_id,
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.debug("auto_submit_previous_attempt_failed", error=str(exc))

        # Identify authoritative published AssessmentVersion snapshot
        latest_version = await db.scalar(
            select(AssessmentVersion)
            .where(AssessmentVersion.assessment_id == assessment_id)
            .order_by(AssessmentVersion.version.desc())
        )
        version_id = latest_version.id if latest_version else None
        version_num = latest_version.version if latest_version else assessment.version

        # Initialize fresh attempt with server-controlled clock
        started_at = now
        expires_at = started_at + datetime.timedelta(seconds=assessment.duration_seconds)

        new_attempt = Attempt(
            assessment_id=assessment_id,
            assessment_version_id=version_id,
            assessment_version=version_num,
            user_id=user_id,
            status=AttemptStatus.STARTED,
            started_at=started_at,
            expires_at=expires_at,
        )
        db.add(new_attempt)
        await db.flush()

        # Reload with answers relationship populated
        result = await db.execute(
            select(Attempt)
            .where(Attempt.id == new_attempt.id)
            .options(selectinload(Attempt.answers))
        )
        attempt = result.scalar_one()

        logger.info(
            "attempt_started",
            attempt_id=str(attempt.id),
            assessment_id=str(assessment_id),
            version_id=str(version_id) if version_id else None,
            user_id=str(user_id),
            expires_at=expires_at.isoformat(),
        )
        return attempt

    @staticmethod
    async def get_attempt(
        db: AsyncSession,
        attempt_id: uuid.UUID,
        current_user_id: uuid.UUID,
        is_admin: bool = False,
    ) -> Attempt:
        """Retrieve attempt state and check for server-side expiration."""
        stmt = (
            select(Attempt).where(Attempt.id == attempt_id).options(selectinload(Attempt.answers))
        )
        result = await db.execute(stmt)
        attempt = result.scalar_one_or_none()
        if not attempt:
            raise AppException(
                message="Attempt not found",
                code="ATTEMPT_NOT_FOUND",
                status_code=404,
            )

        if not is_admin and attempt.user_id != current_user_id:
            raise AppException(
                message="You do not have permission to access this attempt",
                code="FORBIDDEN_RESOURCE",
                status_code=403,
            )

        # Automatic expiry check
        now = datetime.datetime.now(datetime.UTC)
        exp = _ensure_utc(attempt.expires_at)
        if attempt.status == AttemptStatus.STARTED and exp and now > exp:
            attempt.status = AttemptStatus.EXPIRED
            await db.flush()
            try:
                await AssessmentService.submit_attempt(
                    db=db,
                    attempt_id=attempt.id,
                    current_user_id=attempt.user_id,
                )
            except Exception as exc:  # noqa: BLE001
                logger.debug("auto_expire_attempt_failed", error=str(exc))
            logger.info("attempt_auto_expired", attempt_id=str(attempt.id))

        return attempt

    @staticmethod
    async def get_attempt_state(
        db: AsyncSession,
        attempt_id: uuid.UUID,
        current_user_id: uuid.UUID,
        is_admin: bool = False,
    ) -> dict[str, Any]:
        """Retrieve authoritative attempt synchronization state for taking/reconnecting."""
        stmt = (
            select(Attempt)
            .where(Attempt.id == attempt_id)
            .options(
                selectinload(Attempt.answers),
                selectinload(Attempt.assessment)
                .selectinload(Assessment.sections)
                .selectinload(AssessmentSection.questions),
            )
        )
        result = await db.execute(stmt)
        attempt = result.scalar_one_or_none()
        if not attempt:
            raise AppException(
                message="Attempt not found",
                code="ATTEMPT_NOT_FOUND",
                status_code=404,
            )

        if not is_admin and attempt.user_id != current_user_id:
            raise AppException(
                message="You do not have permission to access this attempt",
                code="FORBIDDEN_RESOURCE",
                status_code=403,
            )

        now = datetime.datetime.now(datetime.UTC)
        exp = _ensure_utc(attempt.expires_at)
        is_expired = bool(exp and now > exp)

        if attempt.status == AttemptStatus.STARTED and is_expired:
            attempt.status = AttemptStatus.EXPIRED
            await db.flush()
            try:
                await AssessmentService.submit_attempt(
                    db=db,
                    attempt_id=attempt_id,
                    current_user_id=attempt.user_id,
                )
            except Exception as exc:  # noqa: BLE001
                logger.debug("auto_submit_expired_state_failed", error=str(exc))
            await db.refresh(attempt)

        remaining = 0
        if not is_expired and exp and exp > now and attempt.status == AttemptStatus.STARTED:
            remaining = int((exp - now).total_seconds())

        answers_map: dict[str, Any] = {}
        for a in attempt.answers:
            if a.response_payload is not None:
                answers_map[str(a.question_id)] = a.response_payload
            elif a.selected_option_id:
                answers_map[str(a.question_id)] = str(a.selected_option_id)
            elif a.selected_option_ids:
                answers_map[str(a.question_id)] = a.selected_option_ids
            elif a.text_response:
                answers_map[str(a.question_id)] = a.text_response

        total_q = (
            sum(len(s.questions) for s in attempt.assessment.sections)
            if attempt.assessment
            else 0
        )

        return {
            "attempt_id": attempt.id,
            "assessment_id": attempt.assessment_id,
            "assessment_version_id": attempt.assessment_version_id,
            "user_id": attempt.user_id,
            "student_id": attempt.user_id,
            "status": attempt.status,
            "started_at": attempt.started_at,
            "expires_at": attempt.expires_at,
            "server_time": now,
            "remaining_seconds": remaining,
            "is_expired": is_expired or attempt.status in (AttemptStatus.EXPIRED, AttemptStatus.SUBMITTED),
            "answered_count": len(attempt.answers),
            "total_questions": total_q,
            "answers": answers_map,
        }

    @staticmethod
    async def submit_answer(
        db: AsyncSession,
        attempt_id: uuid.UUID,
        current_user_id: uuid.UUID,
        question_id: uuid.UUID | AnswerSubmitRequest,
        selected_option_id: uuid.UUID | None = None,
        selected_option_ids: list[uuid.UUID] | None = None,
        text_response: str | None = None,
        response_payload: dict[str, Any] | list[Any] | None = None,
        client_timestamp: datetime.datetime | None = None,
    ) -> AttemptAnswer:
        """Record or update an answer idempotently within an active attempt with stale write protection."""
        if isinstance(question_id, AnswerSubmitRequest):
            req = question_id
            target_question_id = req.question_id
            target_selected_option_id = req.selected_option_id
            target_selected_option_ids = req.selected_option_ids
            target_text_response = req.text_response
            target_response_payload = req.response_payload
            target_client_timestamp = req.client_timestamp
        else:
            target_question_id = question_id
            target_selected_option_id = selected_option_id
            target_selected_option_ids = selected_option_ids or []
            target_text_response = text_response
            target_response_payload = response_payload
            target_client_timestamp = client_timestamp

        stmt = (
            select(Attempt)
            .where(Attempt.id == attempt_id)
            .options(
                selectinload(Attempt.assessment)
                .selectinload(Assessment.sections)
                .selectinload(AssessmentSection.questions)
                .selectinload(Question.options)
            )
        )
        result = await db.execute(stmt)
        attempt = result.scalar_one_or_none()
        if not attempt:
            raise AppException(
                message="Attempt not found",
                code="ATTEMPT_NOT_FOUND",
                status_code=404,
            )

        if attempt.user_id != current_user_id:
            raise AppException(
                message="You do not have permission to modify this attempt",
                code="FORBIDDEN_RESOURCE",
                status_code=403,
            )

        # Check attempt state and expiration
        now = datetime.datetime.now(datetime.UTC)
        exp = _ensure_utc(attempt.expires_at)
        if attempt.status == AttemptStatus.SUBMITTED:
            raise AppException(
                message="Cannot modify answers on a submitted attempt",
                code="ATTEMPT_ALREADY_SUBMITTED",
                status_code=400,
            )

        if attempt.status == AttemptStatus.EXPIRED or (exp and now > exp):
            attempt.status = AttemptStatus.EXPIRED
            await db.flush()
            try:
                await AssessmentService.submit_attempt(
                    db=db,
                    attempt_id=attempt_id,
                    current_user_id=current_user_id,
                )
            except Exception as exc:  # noqa: BLE001
                logger.debug("auto_submit_expired_answer_failed", error=str(exc))
            raise AppException(
                message="Attempt time has expired",
                code="ATTEMPT_EXPIRED",
                status_code=400,
            )

        # Validate question belongs to this assessment
        target_question: Question | None = None
        for section in attempt.assessment.sections:
            for q in section.questions:
                if q.id == target_question_id:
                    target_question = q
                    break
            if target_question:
                break

        if not target_question:
            raise AppException(
                message="Question does not belong to this assessment",
                code="INVALID_QUESTION",
                status_code=400,
            )

        # Validate selected option if applicable
        if target_selected_option_id:
            valid_opt_ids = {opt.id for opt in target_question.options}
            if target_selected_option_id not in valid_opt_ids:
                raise AppException(
                    message="Selected option is not valid for this question",
                    code="INVALID_OPTION",
                    status_code=400,
                )

        # Upsert answer idempotently with stale protection
        existing_answer = await db.scalar(
            select(AttemptAnswer).where(
                AttemptAnswer.attempt_id == attempt_id,
                AttemptAnswer.question_id == target_question_id,
            )
        )

        option_ids_str = [str(opt_id) for opt_id in target_selected_option_ids]

        if existing_answer and target_client_timestamp:
            ans_time = _ensure_utc(existing_answer.answered_at)
            client_time = _ensure_utc(target_client_timestamp)
            if ans_time and client_time and ans_time > client_time:
                logger.info(
                    "ignoring_stale_answer_write",
                    attempt_id=str(attempt_id),
                    question_id=str(target_question_id),
                    existing_time=ans_time.isoformat(),
                    client_time=client_time.isoformat(),
                )
                return existing_answer

        # Resolve delivered question version for immutable attempt tracking
        delivered_version_id = None
        sec_ids = [sec.id for sec in attempt.assessment.sections]
        if sec_ids:
            asq_version_id = await db.scalar(
                select(AssessmentSectionQuestion.question_version_id).where(
                    AssessmentSectionQuestion.assessment_section_id.in_(sec_ids),
                    AssessmentSectionQuestion.question_id == target_question_id,
                )
            )
            if asq_version_id:
                delivered_version_id = asq_version_id

        if not delivered_version_id:
            from app.modules.admin.models import QuestionVersion
            qv_id = await db.scalar(
                select(QuestionVersion.id).where(
                    QuestionVersion.question_id == target_question_id,
                    QuestionVersion.version == target_question.version,
                )
            )
            delivered_version_id = qv_id

        if existing_answer:
            existing_answer.selected_option_id = target_selected_option_id
            existing_answer.selected_option_ids = option_ids_str
            existing_answer.text_response = target_text_response
            if target_response_payload is not None:
                existing_answer.response_payload = target_response_payload
            existing_answer.answered_at = now
            if delivered_version_id and not existing_answer.question_version_id:
                existing_answer.question_version_id = delivered_version_id
            answer = existing_answer
        else:
            answer = AttemptAnswer(
                attempt_id=attempt_id,
                question_id=target_question_id,
                selected_option_id=target_selected_option_id,
                selected_option_ids=option_ids_str,
                text_response=target_text_response,
                response_payload=target_response_payload,
                answered_at=now,
                question_version_id=delivered_version_id,
            )
            db.add(answer)

        # Mark question as live delivered to permanently freeze this version
        if not target_question.is_live_delivered:
            target_question.is_live_delivered = True

        await db.flush()
        return answer

    @staticmethod
    async def submit_attempt(
        db: AsyncSession,
        attempt_id: uuid.UUID,
        current_user_id: uuid.UUID,
    ) -> tuple[Attempt, AttemptScore]:
        """Finalize attempt, grade all questions, and save score with concurrency locking."""
        async with AssessmentService._submit_lock:
            # Row-level lock attempt for update to guarantee transaction safety
            stmt = select(Attempt).where(Attempt.id == attempt_id).with_for_update()
            result = await db.execute(stmt)
            attempt = result.scalar_one_or_none()
            if not attempt:
                raise AppException(
                    message="Attempt not found",
                    code="ATTEMPT_NOT_FOUND",
                    status_code=404,
                )

            if attempt.user_id != current_user_id:
                raise AppException(
                    message="You do not have permission to submit this attempt",
                    code="FORBIDDEN_RESOURCE",
                    status_code=403,
                )

            # Idempotent return if already submitted
            if attempt.status == AttemptStatus.SUBMITTED:
                score = await db.scalar(
                    select(AttemptScore).where(AttemptScore.attempt_id == attempt.id)
                )
                if score:
                    return attempt, score

            # Check server-side time expiration
            now = datetime.datetime.now(datetime.UTC)
            exp = _ensure_utc(attempt.expires_at)
            is_late = bool(exp and now > exp)
            if is_late:
                attempt.status = AttemptStatus.EXPIRED
            else:
                attempt.status = AttemptStatus.SUBMITTED

            attempt.submitted_at = now

            # Load full assessment structure with questions, options, and skill tags
            assessment_stmt = (
                select(Assessment)
                .where(Assessment.id == attempt.assessment_id)
                .options(
                    selectinload(Assessment.sections)
                    .selectinload(AssessmentSection.questions)
                    .selectinload(Question.options),
                    selectinload(Assessment.sections)
                    .selectinload(AssessmentSection.questions)
                    .selectinload(Question.skill_tags),
                )
            )
            assessment_result = await db.execute(assessment_stmt)
            assessment = assessment_result.scalar_one()

            # Load all answers submitted for this attempt with question_version snapshot
            answers_stmt = (
                select(AttemptAnswer)
                .where(AttemptAnswer.attempt_id == attempt_id)
                .options(selectinload(AttemptAnswer.question_version))
            )
            answers_result = await db.execute(answers_stmt)
            answers = list(answers_result.scalars().all())

            # Grade using isolated scoring engine
            score_result = ScoringEngine.calculate_score(assessment=assessment, answers=answers)

            # Check if score record already exists (safety check)
            existing_score = await db.scalar(
                select(AttemptScore).where(AttemptScore.attempt_id == attempt.id)
            )
            if existing_score:
                score = existing_score
            else:
                score = AttemptScore(
                    attempt_id=attempt.id,
                    total_points=score_result.total_points,
                    max_points=score_result.max_points,
                    percentage=score_result.percentage,
                    is_passed=score_result.is_passed,
                    estimated_level=score_result.estimated_level,
                    scoring_algorithm_version=getattr(score_result, "scoring_algorithm_version", "v2"),
                    skill_scores=score_result.skill_scores,
                    scored_at=now,
                )
                db.add(score)

            await db.flush()

            # Trigger learning engine hook for mistake logging, skill tracking & recommendations
            await LearningService.process_assessment_submission(
                db=db,
                attempt=attempt,
                assessment=assessment,
                score_result=score_result,
            )

            logger.info(
                "attempt_graded",
                attempt_id=str(attempt.id),
                status=attempt.status.value,
                total_points=score.total_points,
                max_points=score.max_points,
                percentage=score.percentage,
                level=score.estimated_level,
            )

            return attempt, score

    @staticmethod
    async def get_attempt_results(
        db: AsyncSession,
        attempt_id: uuid.UUID,
        current_user_id: uuid.UUID,
        is_admin: bool = False,
    ) -> dict[str, Any]:
        """Fetch graded results, correct answers, explanations, mistake analysis, and recommendations."""
        stmt = (
            select(Attempt)
            .where(Attempt.id == attempt_id)
            .options(
                selectinload(Attempt.score),
                selectinload(Attempt.answers),
                selectinload(Attempt.assessment)
                .selectinload(Assessment.sections)
                .selectinload(AssessmentSection.questions)
                .selectinload(Question.options),
                selectinload(Attempt.assessment)
                .selectinload(Assessment.sections)
                .selectinload(AssessmentSection.questions)
                .selectinload(Question.skill_tags)
                .selectinload(QuestionSkillTag.skill),
            )
        )
        result = await db.execute(stmt)
        attempt = result.scalar_one_or_none()
        if not attempt:
            raise AppException(
                message="Attempt not found",
                code="ATTEMPT_NOT_FOUND",
                status_code=404,
            )

        if not is_admin and attempt.user_id != current_user_id:
            raise AppException(
                message="You do not have permission to view results for this attempt",
                code="FORBIDDEN_RESOURCE",
                status_code=403,
            )

        if attempt.status in (AttemptStatus.CREATED, AttemptStatus.STARTED):
            now = datetime.datetime.now(datetime.UTC)
            exp = _ensure_utc(attempt.expires_at)
            if exp and now > exp:
                # Expire and score
                await AssessmentService.submit_attempt(
                    db=db,
                    attempt_id=attempt_id,
                    current_user_id=attempt.user_id,
                )
                await db.refresh(attempt)
            else:
                raise AppException(
                    message="Results are only available after submission or expiration",
                    code="ATTEMPT_NOT_SUBMITTED",
                    status_code=400,
                )

        if not attempt.score:
            raise AppException(
                message="Attempt score calculation not found",
                code="SCORE_NOT_FOUND",
                status_code=404,
            )

        # Index user answers by question_id (explicit query guarantees freshness)
        answers_stmt = select(AttemptAnswer).where(AttemptAnswer.attempt_id == attempt_id)
        answers_res = await db.execute(answers_stmt)
        answer_map = {ans.question_id: ans for ans in answers_res.scalars().all()}

        sections_data: list[dict[str, Any]] = []
        mistakes_data: list[dict[str, Any]] = []

        for section in attempt.assessment.sections:
            questions_data: list[dict[str, Any]] = []
            for q in section.questions:
                user_ans = answer_map.get(q.id)
                ans_data = None
                is_correct = False
                user_ans_text = "Non répondu"
                correct_ans_text = ""

                for opt in q.options:
                    if opt.is_correct:
                        correct_ans_text = opt.content
                    if user_ans and user_ans.selected_option_id == opt.id:
                        user_ans_text = opt.content

                if user_ans:
                    if user_ans.text_response:
                        user_ans_text = user_ans.text_response
                    is_correct = bool(user_ans.is_correct)
                    ans_data = {
                        "id": user_ans.id,
                        "question_id": user_ans.question_id,
                        "selected_option_id": user_ans.selected_option_id,
                        "selected_option_ids": user_ans.selected_option_ids,
                        "text_response": user_ans.text_response,
                        "is_correct": user_ans.is_correct,
                        "points_awarded": user_ans.points_awarded,
                        "answered_at": user_ans.answered_at,
                        "question_version_id": getattr(user_ans, "question_version_id", None),
                    }

                # Record educational mistake detail if incorrect or unanswered
                if not is_correct:
                    primary_tag = q.skill_tags[0] if q.skill_tags else None
                    tag_name = primary_tag.skill.name if primary_tag and primary_tag.skill else None
                    subtag = primary_tag.subskill if primary_tag else None

                    mistakes_data.append(
                        {
                            "question_id": q.id,
                            "prompt": q.prompt,
                            "level": q.level,
                            "points": q.points,
                            "user_answer": user_ans_text,
                            "correct_answer": correct_ans_text,
                            "explanation": q.explanation or "Consultez les notions méthodologiques et lexicales associées.",
                            "skill_name": tag_name,
                            "subskill": subtag,
                        }
                    )

                options_data = [
                    {
                        "id": opt.id,
                        "content": opt.content,
                        "order_index": opt.order_index,
                        "is_correct": opt.is_correct,
                        "explanation": opt.explanation,
                    }
                    for opt in q.options
                ]

                questions_data.append(
                    {
                        "id": q.id,
                        "section_id": q.section_id,
                        "prompt": q.prompt,
                        "question_type": q.question_type,
                        "order_index": q.order_index,
                        "level": q.level,
                        "difficulty": q.difficulty,
                        "points": q.points,
                        "explanation": q.explanation,
                        "media_url": q.media_url,
                        "options": options_data,
                        "user_answer": ans_data,
                    }
                )

            sections_data.append(
                {
                    "id": section.id,
                    "title": section.title,
                    "instructions": section.instructions,
                    "order_index": section.order_index,
                    "passage_text": section.passage_text,
                    "media_url": section.media_url,
                    "questions": questions_data,
                }
            )

        # Strengths and weaknesses evaluation
        strengths: list[str] = []
        weaknesses: list[str] = []
        for skill_key, s_data in (attempt.score.skill_scores or {}).items():
            if isinstance(s_data, dict):
                pct = float(s_data.get("percentage", 0.0))
                s_name = s_data.get("name", skill_key)
            else:
                pct = float(s_data)
                s_name = skill_key

            if pct >= 75.0:
                strengths.append(f"{s_name} ({int(pct)}%)")
            elif pct < 70.0:
                weaknesses.append(f"{s_name} ({int(pct)}%)")

        # Fetch active recommendations for this student
        recs_stmt = (
            select(Recommendation)
            .where(
                Recommendation.user_id == attempt.user_id,
                Recommendation.status == RecommendationStatus.ACTIVE,
            )
            .options(
                selectinload(Recommendation.skill),
            )
            .order_by(Recommendation.priority.desc(), desc(Recommendation.generated_at))
            .limit(5)
        )
        recs_result = await db.execute(recs_stmt)
        recs = recs_result.scalars().all()

        recommended_exercises_data = []
        for r in recs:
            if r.entity_type != "exercise":
                continue
            ex = await db.get(Exercise, r.entity_id)
            if not ex:
                continue
            ex_title = ex.title
            ex_level = ex.level
            ex_diff = ex.difficulty
            skill_name = r.skill.name if r.skill else "Compétence ciblée"
            cat = ex.category.value if hasattr(ex.category, "value") else "reading"
            priority_val = (
                "critical" if r.priority >= 80 else "high" if r.priority >= 60 else "medium"
            )
            recommended_exercises_data.append(
                {
                    "id": ex.id,
                    "title": ex_title,
                    "category": cat,
                    "difficulty": ex_diff,
                    "level": ex_level,
                    "target_skill_name": skill_name,
                    "reason": r.reason,
                    "priority": priority_val,
                }
            )

        return {
            "attempt_id": attempt.id,
            "assessment_id": attempt.assessment_id,
            "user_id": attempt.user_id,
            "status": attempt.status,
            "started_at": attempt.started_at,
            "expires_at": attempt.expires_at,
            "submitted_at": attempt.submitted_at,
            "score": {
                "id": attempt.score.id,
                "attempt_id": attempt.score.attempt_id,
                "total_points": attempt.score.total_points,
                "max_points": attempt.score.max_points,
                "percentage": attempt.score.percentage,
                "is_passed": attempt.score.is_passed,
                "estimated_level": attempt.score.estimated_level,
                "skill_scores": attempt.score.skill_scores,
                "scored_at": attempt.score.scored_at,
            },
            "sections": sections_data,
            "disclaimer": (
                "Ce résultat constitue une estimation indicative de performance basée sur notre algorithme de simulation. "
                "Il ne s'agit en aucun cas d'une attestation ou certification officielle TEF délivrée par la CCI Paris Île-de-France."
            ),
            "strengths": strengths,
            "weaknesses": weaknesses,
            "mistakes": mistakes_data,
            "recommended_exercises": recommended_exercises_data,
        }

    @staticmethod
    async def get_active_attempt_summary(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> dict[str, Any] | None:
        """Fetch ongoing active attempt for student with calculated remaining time."""
        now = datetime.datetime.now(datetime.UTC)
        stmt = (
            select(Attempt)
            .where(
                Attempt.user_id == user_id,
                Attempt.status == AttemptStatus.STARTED,
            )
            .options(
                selectinload(Attempt.assessment)
                .selectinload(Assessment.sections)
                .selectinload(AssessmentSection.questions),
                selectinload(Attempt.answers),
            )
            .order_by(desc(Attempt.started_at))
        )
        attempt = (await db.execute(stmt)).scalars().first()
        if not attempt:
            return None

        exp = _ensure_utc(attempt.expires_at)
        if not exp or exp <= now:
            return None

        total_q = sum(len(s.questions) for s in attempt.assessment.sections) if attempt.assessment else 0
        remaining = int((exp - now).total_seconds())

        return {
            "id": attempt.id,
            "assessment_id": attempt.assessment_id,
            "title": attempt.assessment.title if attempt.assessment else "Simulation TEF",
            "assessment_type": attempt.assessment.assessment_type if attempt.assessment else AssessmentType.MIXED,
            "level": "B1-C1",
            "duration_seconds": attempt.assessment.duration_seconds if attempt.assessment else 3600,
            "remaining_seconds": max(0, remaining),
            "started_at": attempt.started_at,
            "expires_at": attempt.expires_at,
            "total_questions": total_q,
            "answered_count": len(attempt.answers),
        }

    @staticmethod
    async def get_assessment_history(
        db: AsyncSession,
        user_id: uuid.UUID,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Fetch past completed and expired assessment attempts for student history."""
        stmt = (
            select(Attempt)
            .where(
                Attempt.user_id == user_id,
                Attempt.status.in_([AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED]),
            )
            .options(
                selectinload(Attempt.assessment),
                selectinload(Attempt.score),
            )
            .order_by(desc(Attempt.submitted_at), desc(Attempt.started_at))
            .limit(limit)
        )
        attempts = (await db.execute(stmt)).scalars().all()
        items: list[dict[str, Any]] = []
        for a in attempts:
            score_pct = round(a.score.percentage, 1) if a.score else None
            passed = a.score.is_passed if a.score else None
            dur = (
                int((a.submitted_at - a.started_at).total_seconds())
                if (a.submitted_at and a.started_at)
                else None
            )
            est_level = None
            if score_pct is not None:
                if score_pct >= 85:
                    est_level = "C1"
                elif score_pct >= 70:
                    est_level = "B2"
                elif score_pct >= 55:
                    est_level = "B1+"
                elif score_pct >= 40:
                    est_level = "B1"
                else:
                    est_level = "A2"

            items.append(
                {
                    "id": a.id,
                    "assessment_id": a.assessment_id,
                    "title": a.assessment.title if a.assessment else "Simulation TEF",
                    "assessment_type": a.assessment.assessment_type if a.assessment else AssessmentType.MIXED,
                    "level": "B1-C1",
                    "score_percentage": score_pct,
                    "passed": passed,
                    "estimated_level": est_level,
                    "status": a.status,
                    "started_at": a.started_at,
                    "submitted_at": a.submitted_at,
                    "duration_seconds": dur,
                }
            )
        return items

    @staticmethod
    async def get_recommended_assessment(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> dict[str, Any] | None:
        """Provide personalized assessment recommendation based on readiness and gaps."""
        assessments, _total = await AssessmentService.list_assessments(db, page=1, page_size=10)
        if not assessments:
            return None

        history_count_stmt = select(func.count(Attempt.id)).where(
            Attempt.user_id == user_id,
            Attempt.status == AttemptStatus.SUBMITTED,
        )
        history_count = await db.scalar(history_count_stmt) or 0

        first_asmt = assessments[0]
        if history_count == 0:
            reason = "Une évaluation initiale vous permettra d'étalonner votre niveau actuel et d'orienter vos priorités de révision."
        else:
            reason = "Une nouvelle évaluation complète vous aidera à mesurer votre progression récente vers le niveau B2."

        return {
            "assessment_id": first_asmt["id"],
            "title": first_asmt["title"],
            "assessment_type": first_asmt["assessment_type"],
            "level": first_asmt["level"],
            "duration_seconds": first_asmt["duration_seconds"],
            "estimated_completion_time_minutes": first_asmt["estimated_completion_time_minutes"],
            "question_count": first_asmt["question_count"],
            "section_count": first_asmt["section_count"],
            "reason": reason,
            "recommendation_type": "simulation",
        }
