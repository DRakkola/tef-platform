import asyncio
import datetime
import uuid
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.modules.assessments.enums import (
    AssessmentType,
    AttemptStatus,
)
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    Attempt,
    AttemptAnswer,
    AttemptScore,
    Question,
)
from app.modules.assessments.schemas import AnswerSubmitRequest
from app.modules.assessments.scoring import ScoringEngine
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
                # Expire previous attempt
                existing_active.status = AttemptStatus.EXPIRED
                await db.flush()

        # Initialize fresh attempt with server-controlled clock
        started_at = now
        expires_at = started_at + datetime.timedelta(seconds=assessment.duration_seconds)

        new_attempt = Attempt(
            assessment_id=assessment_id,
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
            logger.info("attempt_auto_expired", attempt_id=str(attempt.id))

        return attempt

    @staticmethod
    async def submit_answer(
        db: AsyncSession,
        attempt_id: uuid.UUID,
        current_user_id: uuid.UUID,
        req: AnswerSubmitRequest,
    ) -> AttemptAnswer:
        """Record or update an answer idempotently within an active attempt."""
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
            raise AppException(
                message="Attempt time has expired",
                code="ATTEMPT_EXPIRED",
                status_code=400,
            )

        # Validate question belongs to this assessment
        target_question: Question | None = None
        for section in attempt.assessment.sections:
            for q in section.questions:
                if q.id == req.question_id:
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
        if req.selected_option_id:
            valid_opt_ids = {opt.id for opt in target_question.options}
            if req.selected_option_id not in valid_opt_ids:
                raise AppException(
                    message="Selected option is not valid for this question",
                    code="INVALID_OPTION",
                    status_code=400,
                )

        # Upsert answer idempotently
        existing_answer = await db.scalar(
            select(AttemptAnswer).where(
                AttemptAnswer.attempt_id == attempt_id,
                AttemptAnswer.question_id == req.question_id,
            )
        )

        option_ids_str = [str(opt_id) for opt_id in req.selected_option_ids]

        if existing_answer:
            existing_answer.selected_option_id = req.selected_option_id
            existing_answer.selected_option_ids = option_ids_str
            existing_answer.text_response = req.text_response
            existing_answer.answered_at = now
            answer = existing_answer
        else:
            answer = AttemptAnswer(
                attempt_id=attempt_id,
                question_id=req.question_id,
                selected_option_id=req.selected_option_id,
                selected_option_ids=option_ids_str,
                text_response=req.text_response,
                answered_at=now,
            )
            db.add(answer)

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

            # Load all answers submitted for this attempt
            answers_stmt = select(AttemptAnswer).where(AttemptAnswer.attempt_id == attempt_id)
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
        """Fetch graded results, correct answers, and explanations after submission."""
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

        # Index user answers by question_id
        answer_map = {ans.question_id: ans for ans in attempt.answers}

        sections_data: list[dict[str, Any]] = []
        for section in attempt.assessment.sections:
            questions_data: list[dict[str, Any]] = []
            for q in section.questions:
                user_ans = answer_map.get(q.id)
                ans_data = None
                if user_ans:
                    ans_data = {
                        "id": user_ans.id,
                        "question_id": user_ans.question_id,
                        "selected_option_id": user_ans.selected_option_id,
                        "selected_option_ids": user_ans.selected_option_ids,
                        "text_response": user_ans.text_response,
                        "is_correct": user_ans.is_correct,
                        "points_awarded": user_ans.points_awarded,
                        "answered_at": user_ans.answered_at,
                    }

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
        }
