"""FastAPI router for writing assessment, timed attempts, and teacher corrections."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.storage import StorageService, get_storage
from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.users.models import User, UserRole
from app.modules.writing.enums import WritingSubmissionStatus
from app.modules.writing.schemas import (
    TeacherCorrectionRequest,
    WritingAttemptDraftUpdate,
    WritingAttemptResponse,
    WritingCorrectionResponse,
    WritingSubmissionDetailResponse,
    WritingSubmissionResponse,
    WritingTaskDetail,
    WritingTaskListItem,
)
from app.modules.writing.service import WritingService

router = APIRouter(prefix="", tags=["writing"])


# ---------------------------------------------------------------------------
# Student Writing Task Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/writing/tasks",
    response_model=list[WritingTaskListItem],
    summary="List available writing assessment tasks",
)
async def list_writing_tasks(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[WritingTaskListItem]:
    """Retrieve published TEF writing tasks."""
    tasks, _ = await WritingService.list_tasks(db=db, page=page, page_size=page_size)
    return [WritingTaskListItem.model_validate(t) for t in tasks]


@router.get(
    "/writing/tasks/{task_id}",
    response_model=WritingTaskDetail,
    summary="Get writing task prompt and details",
)
async def get_writing_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> WritingTaskDetail:
    """Retrieve details and prompt for a writing task."""
    task = await WritingService.get_task(db=db, task_id=task_id)
    return WritingTaskDetail.model_validate(task)


# ---------------------------------------------------------------------------
# Student Attempt & Editor Endpoints (Server-Controlled Timing)
# ---------------------------------------------------------------------------


@router.post(
    "/writing/tasks/{task_id}/attempts",
    response_model=WritingAttemptResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start or resume a timed writing attempt",
)
async def start_writing_attempt(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WritingAttemptResponse:
    """Open or resume a timed writing session. Timer is strictly server-enforced."""
    attempt = await WritingService.start_attempt(
        db=db,
        task_id=task_id,
        user_id=current_user.id,
    )
    attempt_obj, rem_sec = await WritingService.get_attempt(
        db=db,
        attempt_id=attempt.id,
        current_user_id=current_user.id,
    )
    return WritingAttemptResponse(
        id=attempt_obj.id,
        task_id=attempt_obj.task_id,
        user_id=attempt_obj.user_id,
        status=attempt_obj.status,
        content=attempt_obj.content,
        word_count=attempt_obj.word_count,
        started_at=attempt_obj.started_at,
        expires_at=attempt_obj.expires_at,
        remaining_seconds=rem_sec,
        submitted_at=attempt_obj.submitted_at,
    )


@router.get(
    "/writing/attempts/{attempt_id}",
    response_model=WritingAttemptResponse,
    summary="Get current attempt status and editor state",
)
async def get_writing_attempt(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WritingAttemptResponse:
    """Retrieve attempt draft and authoritative server timer."""
    is_admin = current_user.role == UserRole.ADMIN
    attempt, rem_sec = await WritingService.get_attempt(
        db=db,
        attempt_id=attempt_id,
        current_user_id=current_user.id,
        is_admin=is_admin,
    )
    return WritingAttemptResponse(
        id=attempt.id,
        task_id=attempt.task_id,
        user_id=attempt.user_id,
        status=attempt.status,
        content=attempt.content,
        word_count=attempt.word_count,
        started_at=attempt.started_at,
        expires_at=attempt.expires_at,
        remaining_seconds=rem_sec,
        submitted_at=attempt.submitted_at,
    )


@router.put(
    "/writing/attempts/{attempt_id}",
    response_model=WritingAttemptResponse,
    summary="Save live draft editor content",
)
async def save_writing_draft(
    attempt_id: uuid.UUID,
    req: WritingAttemptDraftUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WritingAttemptResponse:
    """Save editor draft content and recalculate French word count."""
    attempt, rem_sec = await WritingService.save_draft(
        db=db,
        attempt_id=attempt_id,
        user_id=current_user.id,
        content=req.content,
    )
    return WritingAttemptResponse(
        id=attempt.id,
        task_id=attempt.task_id,
        user_id=attempt.user_id,
        status=attempt.status,
        content=attempt.content,
        word_count=attempt.word_count,
        started_at=attempt.started_at,
        expires_at=attempt.expires_at,
        remaining_seconds=rem_sec,
        submitted_at=attempt.submitted_at,
    )


@router.post(
    "/writing/attempts/{attempt_id}/submit",
    response_model=WritingSubmissionResponse,
    summary="Finalize and submit writing essay",
)
async def submit_writing_attempt(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: StorageService = Depends(get_storage),
) -> WritingSubmissionResponse:
    """Submit attempt: verifies timing, uploads essay to MinIO, and creates submission record."""
    _, submission = await WritingService.submit_attempt(
        db=db,
        attempt_id=attempt_id,
        user_id=current_user.id,
        storage=storage,
    )
    return WritingSubmissionResponse(
        id=submission.id,
        attempt_id=submission.attempt_id,
        task_id=submission.task_id,
        user_id=submission.user_id,
        assigned_teacher_id=submission.assigned_teacher_id,
        status=submission.status,
        word_count=submission.word_count,
        submitted_at=submission.submitted_at,
        correction=None,
    )


@router.get(
    "/writing/submissions/{submission_id}",
    response_model=WritingSubmissionDetailResponse,
    summary="View student submission and correction",
)
async def get_writing_submission(
    submission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: StorageService = Depends(get_storage),
) -> WritingSubmissionDetailResponse:
    """Retrieve submission details, text content from MinIO, and feedback once returned."""
    is_teacher = current_user.role in (UserRole.TEACHER, UserRole.ADMIN)
    is_admin = current_user.role == UserRole.ADMIN
    detail = await WritingService.get_submission(
        db=db,
        submission_id=submission_id,
        current_user_id=current_user.id,
        is_teacher=is_teacher,
        is_admin=is_admin,
        storage=storage,
    )
    return WritingSubmissionDetailResponse.model_validate(detail)


@router.post(
    "/writing/submissions/{submission_id}/mock-correct",
    response_model=WritingCorrectionResponse,
    summary="Trigger automated mock correction for development",
)
async def trigger_mock_correction(
    submission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: StorageService = Depends(get_storage),
) -> WritingCorrectionResponse:
    """Evaluate submission via rule-based MockCorrectionProvider for local testing."""
    is_admin = current_user.role == UserRole.ADMIN
    # Check ownership
    detail = await WritingService.get_submission(
        db=db,
        submission_id=submission_id,
        current_user_id=current_user.id,
        is_admin=is_admin,
    )
    correction = await WritingService.process_mock_correction(
        db=db,
        submission_id=detail["id"],
        storage=storage,
    )
    return WritingCorrectionResponse.model_validate(correction)


# ---------------------------------------------------------------------------
# Teacher Correction Workflow Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/teachers/writing/submissions",
    response_model=list[WritingSubmissionResponse],
    summary="List unassigned queue and teacher's assigned submissions",
)
async def list_teacher_submissions(
    status_filter: WritingSubmissionStatus | None = None,
    db: AsyncSession = Depends(get_db),
    teacher_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN)),
) -> list[WritingSubmissionResponse]:
    """Retrieve submissions available for review."""
    items = await WritingService.list_teacher_submissions(
        db=db,
        teacher_id=teacher_user.id,
        status_filter=status_filter,
    )
    return [
        WritingSubmissionResponse(
            id=s.id,
            attempt_id=s.attempt_id,
            task_id=s.task_id,
            user_id=s.user_id,
            assigned_teacher_id=s.assigned_teacher_id,
            status=s.status,
            word_count=s.word_count,
            submitted_at=s.submitted_at,
            correction=None,
        )
        for s in items
    ]


@router.get(
    "/teachers/writing/submissions/{submission_id}",
    response_model=WritingSubmissionDetailResponse,
    summary="Get submission text for teacher review",
)
async def get_teacher_submission_detail(
    submission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    teacher_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN)),
    storage: StorageService = Depends(get_storage),
) -> WritingSubmissionDetailResponse:
    """Download essay text from MinIO for teacher inspection."""
    detail = await WritingService.get_submission(
        db=db,
        submission_id=submission_id,
        current_user_id=teacher_user.id,
        is_teacher=True,
        is_admin=teacher_user.role == UserRole.ADMIN,
        storage=storage,
    )
    return WritingSubmissionDetailResponse.model_validate(detail)


@router.post(
    "/teachers/writing/submissions/{submission_id}/assign",
    response_model=WritingSubmissionResponse,
    summary="Assign submission to teacher",
)
async def assign_teacher_submission(
    submission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    teacher_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN)),
) -> WritingSubmissionResponse:
    """Self-assign an unassigned submission for correction."""
    submission = await WritingService.assign_teacher_submission(
        db=db,
        submission_id=submission_id,
        teacher_id=teacher_user.id,
    )
    return WritingSubmissionResponse(
        id=submission.id,
        attempt_id=submission.attempt_id,
        task_id=submission.task_id,
        user_id=submission.user_id,
        assigned_teacher_id=submission.assigned_teacher_id,
        status=submission.status,
        word_count=submission.word_count,
        submitted_at=submission.submitted_at,
        correction=None,
    )


@router.post(
    "/teachers/writing/submissions/{submission_id}/review",
    response_model=WritingSubmissionResponse,
    summary="Mark submission as actively reviewing",
)
async def start_teacher_review(
    submission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    teacher_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN)),
) -> WritingSubmissionResponse:
    """Transition assigned submission to reviewing status."""
    submission = await WritingService.start_teacher_review(
        db=db,
        submission_id=submission_id,
        teacher_id=teacher_user.id,
    )
    return WritingSubmissionResponse(
        id=submission.id,
        attempt_id=submission.attempt_id,
        task_id=submission.task_id,
        user_id=submission.user_id,
        assigned_teacher_id=submission.assigned_teacher_id,
        status=submission.status,
        word_count=submission.word_count,
        submitted_at=submission.submitted_at,
        correction=None,
    )


@router.post(
    "/teachers/writing/submissions/{submission_id}/correct",
    response_model=WritingCorrectionResponse,
    summary="Submit teacher correction and return to student",
)
async def submit_teacher_correction(
    submission_id: uuid.UUID,
    req: TeacherCorrectionRequest,
    db: AsyncSession = Depends(get_db),
    teacher_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN)),
) -> WritingCorrectionResponse:
    """Record teacher evaluation, score, feedback, and return submission to student."""
    correction = await WritingService.submit_teacher_correction(
        db=db,
        submission_id=submission_id,
        teacher_id=teacher_user.id,
        req=req,
    )
    return WritingCorrectionResponse.model_validate(correction)
