"""Writing service managing tasks, student timed attempts, MinIO storage, and teacher correction workflows."""

import asyncio
import datetime
import uuid
from typing import Any

import structlog
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.core.storage import StorageService
from app.modules.writing.enums import (
    CorrectionProviderType,
    WritingAttemptStatus,
    WritingSubmissionStatus,
)
from app.modules.writing.models import (
    WritingAttempt,
    WritingCorrection,
    WritingSubmission,
    WritingTask,
)
from app.modules.writing.providers.mock import MockCorrectionProvider
from app.modules.writing.providers.teacher import HumanTeacherCorrectionProvider
from app.modules.notifications.service import NotificationService
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
    ) -> tuple[WritingAttempt, int]:
        """Save draft editor content and update word count while session is active."""
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

        attempt.content = content
        attempt.word_count = count_words_french(content)
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

            # Persist actual submission text into MinIO private object storage
            object_key = WritingStorage.save_submission_text(
                storage=storage,
                text=attempt.content,
            )

            # Update attempt state
            attempt.status = WritingAttemptStatus.SUBMITTED
            attempt.submitted_at = now

            # Create submission record
            submission = WritingSubmission(
                attempt_id=attempt.id,
                task_id=attempt.task_id,
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
    async def assign_teacher_submission(
        db: AsyncSession,
        submission_id: uuid.UUID,
        teacher_id: uuid.UUID,
    ) -> WritingSubmission:
        """Assign an unassigned submission to a teacher."""
        submission = await db.scalar(
            select(WritingSubmission).where(WritingSubmission.id == submission_id)
        )
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

        submission.assigned_teacher_id = teacher_id
        submission.status = WritingSubmissionStatus.ASSIGNED
        await db.flush()

        logger.info(
            "submission_assigned_to_teacher",
            submission_id=str(submission.id),
            teacher_id=str(teacher_id),
        )
        return submission

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
        """Record teacher correction with provenance and mark submission returned."""
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
            existing_correction.strengths = result.strengths
            existing_correction.weaknesses = result.weaknesses
            existing_correction.comments = result.comments
            existing_correction.corrected_content = result.corrected_content
            existing_correction.recommendations = result.recommendations
            correction = existing_correction
        else:
            correction = WritingCorrection(
                submission_id=submission.id,
                provider=CorrectionProviderType.TEACHER,
                corrected_by_user_id=teacher_id,
                score=result.score,
                estimated_level=result.estimated_level,
                strengths=result.strengths,
                weaknesses=result.weaknesses,
                comments=result.comments,
                corrected_content=result.corrected_content,
                recommendations=result.recommendations,
                created_at=now,
            )
            db.add(correction)

        # Transition submission to returned
        submission.status = WritingSubmissionStatus.RETURNED
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
        return correction

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
        )
        db.add(correction)

        submission.status = WritingSubmissionStatus.RETURNED
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
            "mock_correction_completed",
            submission_id=str(submission.id),
            score=correction.score,
            level=correction.estimated_level,
        )
        return correction
