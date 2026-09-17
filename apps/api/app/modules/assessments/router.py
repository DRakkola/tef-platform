"""FastAPI router for assessments, student attempts, and scoring."""

import datetime
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.assessments.enums import AssessmentType
from app.modules.assessments.schemas import (
    AnswerSubmitRequest,
    AssessmentDetailResponse,
    AssessmentListItemResponse,
    AttemptAnswerStudentResponse,
    AttemptDetailResponse,
    AttemptResultsResponse,
    PaginatedAssessmentsResponse,
)
from app.modules.assessments.service import AssessmentService
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User, UserRole

router = APIRouter(prefix="", tags=["assessments"])


@router.get(
    "/assessments",
    response_model=PaginatedAssessmentsResponse,
    summary="List published assessments",
)
async def list_assessments(
    assessment_type: AssessmentType | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> PaginatedAssessmentsResponse:
    """Retrieve available published assessments."""
    items, total = await AssessmentService.list_assessments(
        db=db,
        assessment_type=assessment_type,
        page=page,
        page_size=page_size,
    )
    return PaginatedAssessmentsResponse(
        items=[AssessmentListItemResponse.model_validate(it) for it in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/assessments/{assessment_id}",
    response_model=AssessmentDetailResponse,
    summary="Get assessment details and questions for taking",
)
async def get_assessment(
    assessment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> AssessmentDetailResponse:
    """Retrieve assessment questions and sections. Correct answers are omitted."""
    assessment = await AssessmentService.get_assessment_for_taking(
        db=db,
        assessment_id=assessment_id,
    )
    return AssessmentDetailResponse.model_validate(assessment)


@router.post(
    "/assessments/{assessment_id}/attempts",
    response_model=AttemptDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start an assessment attempt",
)
async def start_attempt(
    assessment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttemptDetailResponse:
    """Initialize or resume an exam attempt with server-controlled start and expiration timestamps."""
    attempt = await AssessmentService.create_attempt(
        db=db,
        assessment_id=assessment_id,
        user_id=current_user.id,
    )
    now = datetime.datetime.now(datetime.UTC)
    remaining = 0
    exp = (
        attempt.expires_at
        if (attempt.expires_at and attempt.expires_at.tzinfo)
        else (attempt.expires_at.replace(tzinfo=datetime.UTC) if attempt.expires_at else None)
    )
    if exp and exp > now:
        remaining = int((exp - now).total_seconds())

    return AttemptDetailResponse(
        id=attempt.id,
        assessment_id=attempt.assessment_id,
        user_id=attempt.user_id,
        status=attempt.status,
        started_at=attempt.started_at,
        expires_at=attempt.expires_at,
        submitted_at=attempt.submitted_at,
        remaining_seconds=remaining,
        answers=[AttemptAnswerStudentResponse.model_validate(a) for a in attempt.answers],
    )


@router.get(
    "/attempts/{attempt_id}",
    response_model=AttemptDetailResponse,
    summary="Get current attempt progress and remaining time",
)
async def get_attempt(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttemptDetailResponse:
    """Retrieve attempt status, previous answers, and server-side remaining time."""
    is_admin = current_user.role == UserRole.ADMIN
    attempt = await AssessmentService.get_attempt(
        db=db,
        attempt_id=attempt_id,
        current_user_id=current_user.id,
        is_admin=is_admin,
    )
    now = datetime.datetime.now(datetime.UTC)
    remaining = 0
    exp = (
        attempt.expires_at
        if (attempt.expires_at and attempt.expires_at.tzinfo)
        else (attempt.expires_at.replace(tzinfo=datetime.UTC) if attempt.expires_at else None)
    )
    if exp and exp > now:
        remaining = int((exp - now).total_seconds())

    return AttemptDetailResponse(
        id=attempt.id,
        assessment_id=attempt.assessment_id,
        user_id=attempt.user_id,
        status=attempt.status,
        started_at=attempt.started_at,
        expires_at=attempt.expires_at,
        submitted_at=attempt.submitted_at,
        remaining_seconds=remaining,
        answers=[AttemptAnswerStudentResponse.model_validate(a) for a in attempt.answers],
    )


@router.post(
    "/attempts/{attempt_id}/answers",
    response_model=AttemptAnswerStudentResponse,
    summary="Submit or update an answer for an attempt question",
)
async def submit_answer(
    attempt_id: uuid.UUID,
    body: AnswerSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttemptAnswerStudentResponse:
    """Idempotently save or update an answer to a question within an active attempt."""
    answer = await AssessmentService.submit_answer(
        db=db,
        attempt_id=attempt_id,
        current_user_id=current_user.id,
        req=body,
    )
    return AttemptAnswerStudentResponse.model_validate(answer)


@router.post(
    "/attempts/{attempt_id}/submit",
    response_model=AttemptResultsResponse,
    summary="Submit attempt for final grading",
)
async def submit_attempt(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttemptResultsResponse:
    """Lock attempt, grade all answers using the isolated scoring engine, and return results."""
    await AssessmentService.submit_attempt(
        db=db,
        attempt_id=attempt_id,
        current_user_id=current_user.id,
    )
    # Return full results view
    results = await AssessmentService.get_attempt_results(
        db=db,
        attempt_id=attempt_id,
        current_user_id=current_user.id,
        is_admin=(current_user.role == UserRole.ADMIN),
    )
    return AttemptResultsResponse(**results)


@router.get(
    "/attempts/{attempt_id}/results",
    response_model=AttemptResultsResponse,
    summary="Get detailed attempt results and explanations",
)
async def get_attempt_results(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttemptResultsResponse:
    """View full score breakdown, correct answers, and explanations for a completed attempt."""
    is_admin = current_user.role == UserRole.ADMIN
    results = await AssessmentService.get_attempt_results(
        db=db,
        attempt_id=attempt_id,
        current_user_id=current_user.id,
        is_admin=is_admin,
    )
    return AttemptResultsResponse(**results)
