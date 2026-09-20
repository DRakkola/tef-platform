import asyncio
import datetime
import uuid
from typing import Any

import structlog
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.core.storage import StorageService
from app.modules.admin.models import WritingTaskVersion
from app.modules.assessments.models import Skill
from app.modules.learning.engine import SkillEngine
from app.modules.learning.levels import LevelEstimationService
from app.modules.learning.models import (
    Mistake,
    SkillAssessment,
    StudentActivityEvent,
    StudentSkill,
)
from app.modules.learning.readiness_engine import ReadinessEngine
from app.modules.learning.readiness_models import SkillEvidenceSourceType
from app.modules.learning.recommendations_v2 import RecommendationEngineV2
from app.modules.notifications.service import NotificationService
from app.modules.writing.enums import (
    CorrectionProviderType,
    WritingAttemptStatus,
    WritingCorrectionStatus,
    WritingSubmissionStatus,
)
from app.modules.writing.models import (
    WritingAssignment,
    WritingAttempt,
    WritingCorrection,
    WritingCorrectionItem,
    WritingCorrectionSkill,
    WritingDraftRevision,
    WritingSubmission,
    WritingTask,
)
from app.modules.writing.providers.mock import MockCorrectionProvider
from app.modules.writing.providers.teacher import HumanTeacherCorrectionProvider
from app.modules.writing.schemas import TeacherCorrectionRequest
from app.modules.writing.storage import WritingStorage
from app.modules.writing.utils import count_words_french

logger = structlog.get_logger("tef-api.writing.service")


def _ensure_utc(dt: datetime.datetime | None) -> datetime.datetime | None:
    """Ensure datetime is timezone-aware in UTC (normalizes offset-naive SQLite datetimes)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.UTC)
    return dt


class WritingService:
    """Core domain service for TEF Writing exams, attempts, and corrections."""

    _submit_lock: asyncio.Lock = asyncio.Lock()

    # -----------------------------------------------------------------------
    # Task Management
    # -----------------------------------------------------------------------

    @staticmethod
    async def list_tasks(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[WritingTask], int]:
        """List published writing tasks with pagination."""
        count_stmt = select(func.count(WritingTask.id)).where(WritingTask.is_published.is_(True))
        total = await db.scalar(count_stmt) or 0

        stmt = (
            select(WritingTask)
            .where(WritingTask.is_published.is_(True))
            .order_by(WritingTask.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def get_task(db: AsyncSession, task_id: uuid.UUID) -> WritingTask:
        """Retrieve task details."""
        task = await db.scalar(select(WritingTask).where(WritingTask.id == task_id))
        if not task or not task.is_published:
            raise AppException(
                message="Writing task not found",
                code="TASK_NOT_FOUND",
                status_code=404,
            )
        return task

    # -----------------------------------------------------------------------
    # Student Attempt Lifecycle & Server-Controlled Timing
    # -----------------------------------------------------------------------

    @staticmethod
    async def start_attempt(
        db: AsyncSession,
        task_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> WritingAttempt:
        """Start or resume a student's timed writing attempt."""
        task = await WritingService.get_task(db, task_id)
        now = datetime.datetime.now(datetime.UTC)

        # Check for existing active draft attempt
        stmt = (
            select(WritingAttempt)
            .where(
                WritingAttempt.task_id == task_id,
                WritingAttempt.user_id == user_id,
                WritingAttempt.status == WritingAttemptStatus.DRAFT,
            )
            .order_by(WritingAttempt.started_at.desc())
        )
        existing = await db.scalar(stmt)

        if existing:
            exp = _ensure_utc(existing.expires_at)
            if exp and now <= exp:
                logger.info(
                    "resuming_writing_attempt",
                    attempt_id=str(existing.id),
                    user_id=str(user_id),
                )
                return existing
            else:
                existing.status = WritingAttemptStatus.EXPIRED
                await db.flush()

        # Initialize fresh attempt with server-controlled timer
        started_at = now
        expires_at = started_at + datetime.timedelta(minutes=task.duration_minutes)

        new_attempt = WritingAttempt(
            task_id=task_id,
            user_id=user_id,
            status=WritingAttemptStatus.DRAFT,
            content="",
            word_count=0,
            started_at=started_at,
            expires_at=expires_at,
        )
        db.add(new_attempt)
        await db.flush()

        logger.info(
            "writing_attempt_started",
            attempt_id=str(new_attempt.id),
            task_id=str(task_id),
            user_id=str(user_id),
            expires_at=expires_at.isoformat(),
        )
        return new_attempt

    @staticmethod
    async def get_attempt(
        db: AsyncSession,
        attempt_id: uuid.UUID,
        current_user_id: uuid.UUID,
        is_admin: bool = False,
    ) -> tuple[WritingAttempt, int]:
        """Fetch attempt and verify server-side expiration."""
        attempt = await db.scalar(
            select(WritingAttempt)
            .where(WritingAttempt.id == attempt_id)
            .options(selectinload(WritingAttempt.task))
        )
        if not attempt:
            raise AppException(
                message="Writing attempt not found",
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
        if attempt.status == WritingAttemptStatus.DRAFT and exp and now > exp:
            attempt.status = WritingAttemptStatus.EXPIRED
            await db.flush()

        remaining_seconds = 0
        if exp and now < exp:
            remaining_seconds = int((exp - now).total_seconds())

        return attempt, remaining_seconds

    @staticmethod
    async def save_draft(
        db: AsyncSession,
        attempt_id: uuid.UUID,
        user_id: uuid.UUID,
        content: str,
        revision_number: int = 0,
    ) -> tuple[WritingAttempt, int]:
        """Save draft editor content, snapshot draft revision, and reject stale revisions."""
        attempt, remaining_seconds = await WritingService.get_attempt(
            db=db,
            attempt_id=attempt_id,
            current_user_id=user_id,
        )

        if attempt.status == WritingAttemptStatus.SUBMITTED:
            raise AppException(
                message="Cannot modify draft of an already submitted attempt",
                code="ATTEMPT_ALREADY_SUBMITTED",
                status_code=400,
            )

        if attempt.status == WritingAttemptStatus.EXPIRED or remaining_seconds <= 0:
            attempt.status = WritingAttemptStatus.EXPIRED
            await db.flush()
            raise AppException(
                message="Attempt time has expired",
                code="ATTEMPT_EXPIRED",
                status_code=400,
            )

        # Stale revision protection
        if revision_number > 0:
            if revision_number <= attempt.current_revision:
                raise AppException(
                    message="Stale draft revision rejected. A newer revision has already been saved.",
                    code="STALE_REVISION",
                    status_code=409,
                )
            new_rev = revision_number
        else:
            new_rev = attempt.current_revision + 1

        now = datetime.datetime.now(datetime.UTC)
        word_count = count_words_french(content)

        attempt.content = content
        attempt.word_count = word_count
        attempt.current_revision = new_rev

        # Record draft revision snapshot
        draft_rev = WritingDraftRevision(
            attempt_id=attempt.id,
            revision_number=new_rev,
            content=content,
            word_count=word_count,
            created_at=now,
            updated_at=now,
        )
        db.add(draft_rev)
        await db.flush()

        return attempt, remaining_seconds

    @staticmethod
    async def submit_attempt(
        db: AsyncSession,
        attempt_id: uuid.UUID,
        user_id: uuid.UUID,
        storage: StorageService,
    ) -> tuple[WritingAttempt, WritingSubmission]:
        """Finalize attempt, persist content to MinIO, and create WritingSubmission."""
        async with WritingService._submit_lock:
            stmt = (
                select(WritingAttempt)
                .where(WritingAttempt.id == attempt_id)
                .options(selectinload(WritingAttempt.submission))
                .with_for_update()
            )
            attempt = await db.scalar(stmt)
            if not attempt:
                raise AppException(
                    message="Writing attempt not found",
                    code="ATTEMPT_NOT_FOUND",
                    status_code=404,
                )

            if attempt.user_id != user_id:
                raise AppException(
                    message="You do not have permission to submit this attempt",
                    code="FORBIDDEN_RESOURCE",
                    status_code=403,
                )

            # Idempotent return if already submitted
            if attempt.status == WritingAttemptStatus.SUBMITTED:
                if attempt.submission:
                    return attempt, attempt.submission
                sub = await db.scalar(
                    select(WritingSubmission).where(WritingSubmission.attempt_id == attempt.id)
                )
                if sub:
                    return attempt, sub

            # Server clock verification
            now = datetime.datetime.now(datetime.UTC)
            exp = _ensure_utc(attempt.expires_at)
            if exp and now > exp:
                attempt.status = WritingAttemptStatus.EXPIRED
                await db.flush()
                raise AppException(
                    message="Attempt time has expired",
                    code="ATTEMPT_EXPIRED",
                    status_code=400,
                )

            # Validate non-empty essay
            if not attempt.content or not attempt.content.strip():
                raise AppException(
                    message="Cannot submit an empty essay",
                    code="EMPTY_SUBMISSION",
                    status_code=400,
                )

            # Calculate official word count
            word_count = count_words_french(attempt.content)
            attempt.word_count = word_count

            # Bind task version if not already bound
            if not attempt.writing_task_version_id:
                latest_version = await db.scalar(
                    select(WritingTaskVersion.id)
                    .where(WritingTaskVersion.writing_task_id == attempt.task_id)
                    .order_by(WritingTaskVersion.version.desc())
                    .limit(1)
                )
                if latest_version:
                    attempt.writing_task_version_id = latest_version

            submission_id = uuid.uuid4()
            payload = {
                "submission_id": str(submission_id),
                "student_id": str(attempt.user_id),
                "attempt_id": str(attempt.id),
                "task_id": str(attempt.task_id),
                "task_version_id": str(attempt.writing_task_version_id) if attempt.writing_task_version_id else None,
                "content": attempt.content,
                "word_count": word_count,
                "submitted_at": now.isoformat(),
            }

            # Persist submission into MinIO private object storage
            object_key = WritingStorage.save_submission_payload(
                storage=storage,
                student_id=attempt.user_id,
                submission_id=submission_id,
                payload=payload,
            )

            # Update attempt state
            attempt.status = WritingAttemptStatus.SUBMITTED
            attempt.submitted_at = now

            # Create submission record
            submission = WritingSubmission(
                id=submission_id,
                attempt_id=attempt.id,
                task_id=attempt.task_id,
                writing_task_version_id=attempt.writing_task_version_id,
                user_id=attempt.user_id,
                status=WritingSubmissionStatus.SUBMITTED,
                word_count=word_count,
                storage_object_key=object_key,
                submitted_at=now,
            )
            db.add(submission)
            await db.flush()

            logger.info(
                "writing_attempt_submitted",
                attempt_id=str(attempt.id),
                submission_id=str(submission.id),
                user_id=str(user_id),
                object_key=object_key,
                word_count=word_count,
            )
            return attempt, submission

    @staticmethod
    async def get_submission(
        db: AsyncSession,
        submission_id: uuid.UUID,
        current_user_id: uuid.UUID,
        is_teacher: bool = False,
        is_admin: bool = False,
        storage: StorageService | None = None,
    ) -> dict[str, Any]:
        """Fetch submission details, Task, Correction (if returned), and text content from MinIO."""
        stmt = (
            select(WritingSubmission)
            .where(WritingSubmission.id == submission_id)
            .options(
                selectinload(WritingSubmission.task),
                selectinload(WritingSubmission.correction),
            )
        )
        submission = await db.scalar(stmt)
        if not submission:
            raise AppException(
                message="Writing submission not found",
                code="SUBMISSION_NOT_FOUND",
                status_code=404,
            )

        # Authorization: student owner, assigned teacher, or admin
        is_owner = submission.user_id == current_user_id
        is_assigned_teacher = is_teacher and submission.assigned_teacher_id == current_user_id
        if not (is_owner or is_assigned_teacher or is_admin):
            raise AppException(
                message="You do not have permission to view this submission",
                code="FORBIDDEN_RESOURCE",
                status_code=403,
            )

        # Retrieve text content from MinIO if storage service provided
        content = ""
        if storage:
            try:
                content = WritingStorage.get_submission_text(storage, submission.storage_object_key)
            except Exception as exc:  # noqa: BLE001
                logger.error("failed_downloading_submission_text", error=str(exc))
                content = "[Content temporarily unavailable from storage]"

        # Hide unreturned corrections from student until returned
        correction_dict: dict[str, Any] | None = None
        if submission.correction:
            can_see_correction = (
                submission.status
                in (WritingSubmissionStatus.RETURNED, WritingSubmissionStatus.CORRECTED)
                or is_teacher
                or is_admin
            )
            if can_see_correction:
                c = submission.correction
                correction_dict = {
                    "id": c.id,
                    "submission_id": c.submission_id,
                    "provider": c.provider,
                    "corrected_by_user_id": c.corrected_by_user_id,
                    "score": c.score,
                    "estimated_level": c.estimated_level,
                    "strengths": c.strengths,
                    "weaknesses": c.weaknesses,
                    "comments": c.comments,
                    "corrected_content": c.corrected_content,
                    "recommendations": c.recommendations,
                    "created_at": c.created_at,
                }

        return {
            "id": submission.id,
            "attempt_id": submission.attempt_id,
            "task_id": submission.task_id,
            "user_id": submission.user_id,
            "assigned_teacher_id": submission.assigned_teacher_id,
            "status": submission.status,
            "word_count": submission.word_count,
            "submitted_at": submission.submitted_at,
            "content": content,
            "task": submission.task,
            "correction": correction_dict,
        }

    # -----------------------------------------------------------------------
    # Teacher Correction Workflow
    # -----------------------------------------------------------------------

    @staticmethod
    async def list_teacher_queue(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[WritingSubmission], int]:
        """List unassigned submissions in the teacher review queue."""
        count_stmt = select(func.count(WritingSubmission.id)).where(
            WritingSubmission.status.in_(
                [WritingSubmissionStatus.SUBMITTED, WritingSubmissionStatus.QUEUED]
            ),
            WritingSubmission.assigned_teacher_id.is_(None),
        )
        total = await db.scalar(count_stmt) or 0

        stmt = (
            select(WritingSubmission)
            .where(
                WritingSubmission.status.in_(
                    [WritingSubmissionStatus.SUBMITTED, WritingSubmissionStatus.QUEUED]
                ),
                WritingSubmission.assigned_teacher_id.is_(None),
            )
            .options(selectinload(WritingSubmission.task))
            .order_by(WritingSubmission.submitted_at.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def list_teacher_assignments(
        db: AsyncSession,
        teacher_id: uuid.UUID,
        status_filter: WritingSubmissionStatus | None = None,
    ) -> list[WritingSubmission]:
        """List submissions assigned to this teacher."""
        stmt = (
            select(WritingSubmission)
            .where(WritingSubmission.assigned_teacher_id == teacher_id)
            .options(selectinload(WritingSubmission.task), selectinload(WritingSubmission.correction))
            .order_by(WritingSubmission.submitted_at.desc())
        )
        if status_filter:
            stmt = stmt.where(WritingSubmission.status == status_filter)

        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def list_teacher_submissions(
        db: AsyncSession,
        teacher_id: uuid.UUID,
        status_filter: WritingSubmissionStatus | None = None,
    ) -> list[WritingSubmission]:
        """List submissions available in the unassigned queue or assigned to this teacher."""
        stmt = (
            select(WritingSubmission)
            .where(
                or_(
                    WritingSubmission.status.in_(
                        [WritingSubmissionStatus.SUBMITTED, WritingSubmissionStatus.QUEUED]
                    ),
                    WritingSubmission.assigned_teacher_id == teacher_id,
                )
            )
            .options(selectinload(WritingSubmission.task))
            .order_by(WritingSubmission.submitted_at.asc())
        )
        if status_filter:
            stmt = stmt.where(WritingSubmission.status == status_filter)

        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def claim_submission(
        db: AsyncSession,
        submission_id: uuid.UUID,
        teacher_id: uuid.UUID,
    ) -> WritingSubmission:
        """Pessimistically lock and claim an unassigned submission for correction."""
        stmt = (
            select(WritingSubmission)
            .where(WritingSubmission.id == submission_id)
            .with_for_update()
        )
        submission = await db.scalar(stmt)
        if not submission:
            raise AppException(
                message="Writing submission not found",
                code="SUBMISSION_NOT_FOUND",
                status_code=404,
            )

        if submission.assigned_teacher_id and submission.assigned_teacher_id != teacher_id:
            raise AppException(
                message="This submission is already assigned to another teacher",
                code="SUBMISSION_ALREADY_ASSIGNED",
                status_code=409,
            )

        now = datetime.datetime.now(datetime.UTC)
        submission.assigned_teacher_id = teacher_id
        submission.status = WritingSubmissionStatus.ASSIGNED

        # Record assignment audit
        assignment = await db.scalar(
            select(WritingAssignment).where(
                WritingAssignment.submission_id == submission.id,
                WritingAssignment.teacher_id == teacher_id,
            )
        )
        if not assignment:
            assignment = WritingAssignment(
                submission_id=submission.id,
                teacher_id=teacher_id,
                status="claimed",
                assigned_at=now,
                claimed_at=now,
            )
            db.add(assignment)
        else:
            assignment.status = "claimed"
            assignment.claimed_at = now

        await db.flush()

        logger.info(
            "submission_claimed_by_teacher",
            submission_id=str(submission.id),
            teacher_id=str(teacher_id),
        )
        return submission

    @staticmethod
    async def assign_teacher_submission(
        db: AsyncSession,
        submission_id: uuid.UUID,
        teacher_id: uuid.UUID,
    ) -> WritingSubmission:
        """Assign an unassigned submission to a teacher (delegates to claim_submission)."""
        return await WritingService.claim_submission(db, submission_id, teacher_id)

    @staticmethod
    async def start_teacher_review(
        db: AsyncSession,
        submission_id: uuid.UUID,
        teacher_id: uuid.UUID,
    ) -> WritingSubmission:
        """Transition assigned submission to actively reviewing state."""
        submission = await db.scalar(
            select(WritingSubmission).where(WritingSubmission.id == submission_id)
        )
        if not submission:
            raise AppException(
                message="Writing submission not found",
                code="SUBMISSION_NOT_FOUND",
                status_code=404,
            )

        if submission.assigned_teacher_id != teacher_id:
            raise AppException(
                message="You cannot review a submission assigned to another teacher",
                code="FORBIDDEN_RESOURCE",
                status_code=403,
            )

        submission.status = WritingSubmissionStatus.REVIEWING
        await db.flush()
        return submission

    @staticmethod
    async def submit_teacher_correction(
        db: AsyncSession,
        submission_id: uuid.UUID,
        teacher_id: uuid.UUID,
        req: TeacherCorrectionRequest,
    ) -> WritingCorrection:
        """Record structured teacher correction, update student skill profile & mistakes, and return submission."""
        stmt = (
            select(WritingSubmission)
            .where(WritingSubmission.id == submission_id)
            .with_for_update()
        )
        submission = await db.scalar(stmt)
        if not submission:
            raise AppException(
                message="Writing submission not found",
                code="SUBMISSION_NOT_FOUND",
                status_code=404,
            )

        if submission.assigned_teacher_id != teacher_id:
            raise AppException(
                message="You cannot correct a submission not assigned to you",
                code="FORBIDDEN_RESOURCE",
                status_code=403,
            )

        now = datetime.datetime.now(datetime.UTC)
        result = HumanTeacherCorrectionProvider.create_result(req)

        # Check if correction already exists (upsert)
        existing_correction = await db.scalar(
            select(WritingCorrection).where(WritingCorrection.submission_id == submission_id)
        )
        if existing_correction:
            existing_correction.score = result.score
            existing_correction.estimated_level = result.estimated_level
            existing_correction.task_completion = req.task_completion
            existing_correction.coherence = req.coherence
            existing_correction.vocabulary = req.vocabulary
            existing_correction.grammar = req.grammar
            existing_correction.syntax = req.syntax
            existing_correction.spelling = req.spelling
            existing_correction.register = req.register
            existing_correction.strengths = result.strengths
            existing_correction.weaknesses = result.weaknesses
            existing_correction.comments = result.comments
            existing_correction.corrected_content = result.corrected_content
            existing_correction.recommendations = result.recommendations
            existing_correction.status = WritingCorrectionStatus.SUBMITTED
            correction = existing_correction
        else:
            correction = WritingCorrection(
                submission_id=submission.id,
                provider=CorrectionProviderType.TEACHER,
                corrected_by_user_id=teacher_id,
                status=WritingCorrectionStatus.SUBMITTED,
                score=result.score,
                estimated_level=result.estimated_level,
                task_completion=req.task_completion,
                coherence=req.coherence,
                vocabulary=req.vocabulary,
                grammar=req.grammar,
                syntax=req.syntax,
                spelling=req.spelling,
                register=req.register,
                strengths=result.strengths,
                weaknesses=result.weaknesses,
                comments=result.comments,
                corrected_content=result.corrected_content,
                recommendations=result.recommendations,
                created_at=now,
            )
            db.add(correction)

        await db.flush()

        # Delete existing items and skills to avoid duplicates on re-submission
        await db.execute(
            delete(WritingCorrectionItem).where(WritingCorrectionItem.correction_id == correction.id)
        )
        await db.execute(
            delete(WritingCorrectionSkill).where(WritingCorrectionSkill.correction_id == correction.id)
        )

        # Add fine-grained correction items (mistakes / inline suggestions)
        for item_data in req.items:
            c_item = WritingCorrectionItem(
                correction_id=correction.id,
                original_text=item_data.original_text,
                corrected_text=item_data.corrected_text,
                category=item_data.category,
                explanation=item_data.explanation,
                skill_id=item_data.skill_id,
            )
            db.add(c_item)

        # Add skill evaluations
        for skill_data in req.skills:
            c_skill = WritingCorrectionSkill(
                correction_id=correction.id,
                skill_id=skill_data.skill_id,
                score=skill_data.score,
                level=skill_data.level,
                feedback=skill_data.feedback,
            )
            db.add(c_skill)

        # Transition submission to returned
        submission.status = WritingSubmissionStatus.RETURNED

        # Update assignment audit
        assignment = await db.scalar(
            select(WritingAssignment).where(
                WritingAssignment.submission_id == submission.id,
                WritingAssignment.teacher_id == teacher_id,
            )
        )
        if assignment:
            assignment.status = "completed"
            assignment.completed_at = now

        # Update learning intelligence: SkillAssessments, StudentSkills, Mistakes, StudentActivityEvent
        for skill_data in req.skills:
            existing_sa = await db.scalar(
                select(SkillAssessment).where(
                    SkillAssessment.source_id == correction.id,
                    SkillAssessment.skill_id == skill_data.skill_id,
                    SkillAssessment.source_type == "writing_correction",
                )
            )
            if not existing_sa:
                sa = SkillAssessment(
                    user_id=submission.user_id,
                    skill_id=skill_data.skill_id,
                    source_type="writing_correction",
                    source_id=correction.id,
                    score=skill_data.score,
                    points_earned=skill_data.score,
                    points_possible=100.0,
                    estimated_level=skill_data.level,
                    confidence=0.85,
                    assessed_at=now,
                )
                db.add(sa)

            # Update rolling StudentSkill estimate
            st_skill = await db.scalar(
                select(StudentSkill).where(
                    StudentSkill.user_id == submission.user_id,
                    StudentSkill.skill_id == skill_data.skill_id,
                )
            )
            if st_skill:
                new_mastery, new_conf = SkillEngine.update_mastery(
                    current_mastery=st_skill.mastery_score,
                    attempts_count=st_skill.attempts_count,
                    performance_score=skill_data.score,
                )
                st_skill.mastery_score = new_mastery
                st_skill.confidence = new_conf
                st_skill.attempts_count += 1
                st_skill.last_assessed_at = now
                st_skill.estimated_level = LevelEstimationService.estimate_cefr(new_mastery)
            else:
                st_skill = StudentSkill(
                    user_id=submission.user_id,
                    skill_id=skill_data.skill_id,
                    mastery_score=skill_data.score,
                    confidence=0.5,
                    attempts_count=1,
                    last_assessed_at=now,
                    estimated_level=skill_data.level,
                )
                db.add(st_skill)

        # Record linguistic mistakes
        for item_data in req.items:
            if item_data.skill_id:
                mistake = Mistake(
                    user_id=submission.user_id,
                    skill_id=item_data.skill_id,
                    subskill=item_data.category,
                    source_type="writing_correction",
                    source_id=correction.id,
                    user_answer=item_data.original_text,
                    correct_answer=item_data.corrected_text,
                    explanation=item_data.explanation,
                    error_count=1,
                    last_occurred_at=now,
                )
                db.add(mistake)

        # Record student activity event for timeline & analytics
        activity = StudentActivityEvent(
            user_id=submission.user_id,
            event_type="writing_completed",
            entity_type="writing_submission",
            entity_id=submission.id,
            metadata_payload={
                "score": correction.score,
                "estimated_level": correction.estimated_level,
                "task_id": str(submission.task_id),
            },
            created_at=now,
        )
        db.add(activity)

        # Trigger deterministic recommendations update
        try:
            await RecommendationEngineV2.generate_recommendations(db, submission.user_id)
        except Exception:  # noqa: BLE001
            pass

        # Ingest into ReadinessEngine
        for skill_data in req.skills:
            try:
                await ReadinessEngine.ingest_evidence(
                    db=db,
                    student_id=submission.user_id,
                    skill_id=skill_data.skill_id,
                    source_type=SkillEvidenceSourceType.TEACHER_EVALUATION.value,
                    source_id=correction.id,
                    raw_score=skill_data.score,
                    normalized_score=skill_data.score,
                    confidence=0.90,
                    weight=1.0,
                    observed_at=now,
                    metadata_payload={
                        "submission_id": str(submission.id),
                        "teacher_id": str(teacher_id),
                        "level": skill_data.level,
                    },
                )
            except Exception as e_ev:  # noqa: BLE001
                logger.warning("failed_ingesting_writing_teacher_evidence", error=str(e_ev))

        try:
            await ReadinessEngine.recalculate_student_readiness(db, submission.user_id)
        except Exception as e_rec:  # noqa: BLE001
            logger.warning("failed_recalculating_readiness_after_writing_correction", error=str(e_rec))

        await db.flush()

        # Emit student notification
        try:
            await NotificationService.notify_writing_correction_ready(
                db=db,
                student_id=submission.user_id,
                submission_id=submission.id,
                score=correction.score,
                estimated_level=correction.estimated_level,
            )
        except Exception as notif_err:  # noqa: BLE001
            logger.warning("failed_sending_writing_notification", error=str(notif_err))

        logger.info(
            "teacher_correction_submitted",
            submission_id=str(submission.id),
            correction_id=str(correction.id),
            teacher_id=str(teacher_id),
            score=correction.score,
            level=correction.estimated_level,
        )
        loaded_stmt = (
            select(WritingCorrection)
            .where(WritingCorrection.id == correction.id)
            .options(selectinload(WritingCorrection.items), selectinload(WritingCorrection.skills))
        )
        loaded_correction = await db.scalar(loaded_stmt)
        return loaded_correction or correction

    @staticmethod
    async def get_attempt_result(
        db: AsyncSession,
        attempt_id: uuid.UUID,
        current_user_id: uuid.UUID,
        is_admin: bool = False,
        storage: StorageService | None = None,
    ) -> dict[str, Any]:
        """Fetch attempt result, submission, structured correction, items, skills, and simulation disclaimer."""
        stmt = (
            select(WritingAttempt)
            .where(WritingAttempt.id == attempt_id)
            .options(
                selectinload(WritingAttempt.task),
                selectinload(WritingAttempt.submission).selectinload(WritingSubmission.correction).selectinload(WritingCorrection.items),
                selectinload(WritingAttempt.submission).selectinload(WritingSubmission.correction).selectinload(WritingCorrection.skills),
            )
        )
        attempt = await db.scalar(stmt)
        if not attempt:
            raise AppException(
                message="Writing attempt not found",
                code="ATTEMPT_NOT_FOUND",
                status_code=404,
            )

        if not is_admin and attempt.user_id != current_user_id:
            raise AppException(
                message="You do not have permission to view this attempt result",
                code="FORBIDDEN_RESOURCE",
                status_code=403,
            )

        if not attempt.submission:
            raise AppException(
                message="This attempt has not been submitted yet",
                code="NOT_SUBMITTED",
                status_code=400,
            )

        sub = attempt.submission
        content = attempt.content
        if storage and sub.storage_object_key:
            try:
                content = WritingStorage.get_submission_text(storage, sub.storage_object_key)
            except Exception:  # noqa: BLE001
                pass

        corr_data: dict[str, Any] | None = None
        if sub.correction:
            c = sub.correction
            corr_data = {
                "id": c.id,
                "submission_id": c.submission_id,
                "provider": c.provider,
                "corrected_by_user_id": c.corrected_by_user_id,
                "status": c.status.value if hasattr(c.status, "value") else str(c.status),
                "score": c.score,
                "estimated_level": c.estimated_level,
                "task_completion": c.task_completion,
                "coherence": c.coherence,
                "vocabulary": c.vocabulary,
                "grammar": c.grammar,
                "syntax": c.syntax,
                "spelling": c.spelling,
                "register": c.register,
                "strengths": c.strengths or [],
                "weaknesses": c.weaknesses or [],
                "comments": c.comments or "",
                "corrected_content": c.corrected_content,
                "recommendations": c.recommendations or [],
                "items": [
                    {
                        "id": i.id,
                        "correction_id": i.correction_id,
                        "original_text": i.original_text,
                        "corrected_text": i.corrected_text,
                        "category": i.category,
                        "explanation": i.explanation,
                        "skill_id": i.skill_id,
                        "created_at": i.created_at,
                    }
                    for i in (c.items or [])
                ],
                "skills": [
                    {
                        "id": s.id,
                        "correction_id": s.correction_id,
                        "skill_id": s.skill_id,
                        "score": s.score,
                        "level": s.level,
                        "feedback": s.feedback,
                        "created_at": s.created_at,
                    }
                    for s in (c.skills or [])
                ],
                "is_simulated": True,
                "disclaimer": "Simulation score only. Not an official TEF score.",
                "created_at": c.created_at,
            }

        return {
            "attempt_id": attempt.id,
            "submission_id": sub.id,
            "status": sub.status,
            "word_count": sub.word_count,
            "submitted_at": sub.submitted_at,
            "task": attempt.task,
            "content": content,
            "correction": corr_data,
            "is_simulated": True,
            "disclaimer": "Simulation score only. Not an official TEF score.",
        }

    # -----------------------------------------------------------------------
    # Automated / Mock Correction Integration
    # -----------------------------------------------------------------------

    @staticmethod
    async def process_mock_correction(
        db: AsyncSession,
        submission_id: uuid.UUID,
        storage: StorageService,
    ) -> WritingCorrection:
        """Run MockCorrectionProvider to produce an instant correction for development/testing."""
        stmt = (
            select(WritingSubmission)
            .where(WritingSubmission.id == submission_id)
            .options(selectinload(WritingSubmission.task))
        )
        submission = await db.scalar(stmt)
        if not submission:
            raise AppException(
                message="Writing submission not found",
                code="SUBMISSION_NOT_FOUND",
                status_code=404,
            )

        # Enforce beta quota limits
        from app.core.beta_limits import BetaLimitsService
        await BetaLimitsService.check_and_increment(submission.user_id, "ai_writing")

        # Transition status to processing
        submission.status = WritingSubmissionStatus.PROCESSING
        await db.flush()

        # Download text from MinIO
        text_content = WritingStorage.get_submission_text(storage, submission.storage_object_key)

        provider = MockCorrectionProvider()
        result = await provider.evaluate(
            submission=submission,
            text_content=text_content,
            task=submission.task,
        )

        now = datetime.datetime.now(datetime.UTC)
        correction = WritingCorrection(
            submission_id=submission.id,
            provider=CorrectionProviderType.MOCK,
            corrected_by_user_id=None,
            score=result.score,
            estimated_level=result.estimated_level,
            strengths=result.strengths,
            weaknesses=result.weaknesses,
            comments=result.comments,
            corrected_content=result.corrected_content,
            recommendations=result.recommendations,
            created_at=now,
            items=[],
            skills=[],
        )
        db.add(correction)

        submission.status = WritingSubmissionStatus.RETURNED
        await db.flush()

        # Ingest AI evaluation evidence into ReadinessEngine if writing skill found
        writing_skill = (
            await db.execute(
                select(Skill).where(Skill.code.in_(["writing", "expression_ecrite", "EE", "writing_b2"]))
            )
        ).scalar_one_or_none()
        if not writing_skill:
            writing_skill = (
                await db.execute(
                    select(Skill).where(Skill.name.ilike("%writing%") | Skill.name.ilike("%écrite%"))
                )
            ).scalars().first()

        if writing_skill:
            try:
                await ReadinessEngine.ingest_evidence(
                    db=db,
                    student_id=submission.user_id,
                    skill_id=writing_skill.id,
                    source_type=SkillEvidenceSourceType.AI_EVALUATION.value,
                    source_id=correction.id,
                    raw_score=correction.score,
                    normalized_score=correction.score,
                    confidence=0.80,
                    weight=1.0,
                    observed_at=now,
                    metadata_payload={"submission_id": str(submission.id), "provider": "mock"},
                )
                await ReadinessEngine.recalculate_student_readiness(db, submission.user_id)
            except Exception as e_ai:  # noqa: BLE001
                logger.warning("failed_ingesting_writing_mock_evidence", error=str(e_ai))

        # Emit student notification
        try:
            await NotificationService.notify_writing_correction_ready(
                db=db,
                student_id=submission.user_id,
                submission_id=submission.id,
                score=correction.score,
                estimated_level=correction.estimated_level,
            )
        except Exception as notif_err:  # noqa: BLE001
            logger.warning("failed_sending_writing_notification", error=str(notif_err))

        logger.info(
            "mock_correction_completed",
            submission_id=str(submission.id),
            score=correction.score,
            level=correction.estimated_level,
        )
        loaded_stmt = (
            select(WritingCorrection)
            .where(WritingCorrection.id == correction.id)
            .options(selectinload(WritingCorrection.items), selectinload(WritingCorrection.skills))
        )
        loaded_correction = await db.scalar(loaded_stmt)
        return loaded_correction or correction
