"""FastAPI router for practice exercises."""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.exercises.service import ExerciseService
from app.modules.learning.enums import SkillCategory
from app.modules.learning.schemas import (
    ExerciseAttemptRequest,
    ExerciseAttemptResponse,
    ExerciseResponse,
)
from app.modules.users.models import User

router = APIRouter(prefix="/exercises", tags=["Exercises"])


@router.get(
    "",
    response_model=list[ExerciseResponse],
    summary="List available practice exercises",
)
async def list_exercises(
    category: SkillCategory | None = None,
    skill_id: uuid.UUID | None = None,
    level: str | None = None,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[ExerciseResponse]:
    """List published practice exercises with options for taking."""
    exercises = await ExerciseService.list_exercises(
        db=db,
        category=category,
        skill_id=skill_id,
        level=level,
    )
    return [ExerciseResponse.model_validate(ex) for ex in exercises]


@router.get(
    "/{exercise_id}",
    response_model=ExerciseResponse,
    summary="Get exercise details by ID",
)
async def get_exercise(
    exercise_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> ExerciseResponse:
    """Retrieve an exercise definition by ID."""
    exercise = await ExerciseService.get_exercise(db=db, exercise_id=exercise_id)
    return ExerciseResponse.model_validate(exercise)


@router.post(
    "/{exercise_id}/attempts",
    response_model=ExerciseAttemptResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an attempt for a practice exercise",
)
async def submit_exercise_attempt(
    exercise_id: uuid.UUID,
    payload: ExerciseAttemptRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExerciseAttemptResponse:
    """Grade exercise attempt, log mistakes, and update student mastery."""
    attempt = await ExerciseService.attempt_exercise(
        db=db,
        exercise_id=exercise_id,
        user=current_user,
        payload=payload,
    )
    return ExerciseAttemptResponse.model_validate(attempt)


@router.get(
    "/{exercise_id}/attempts",
    response_model=list[ExerciseAttemptResponse],
    summary="List student's historical attempts for this exercise",
)
async def get_exercise_attempts(
    exercise_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ExerciseAttemptResponse]:
    """Retrieve chronological attempts by the authenticated student for this exercise."""
    attempts = await ExerciseService.get_exercise_attempts(
        db=db,
        exercise_id=exercise_id,
        user=current_user,
    )
    return [ExerciseAttemptResponse.model_validate(att) for att in attempts]


exercise_attempts_router = APIRouter(prefix="/exercise-attempts", tags=["Exercise Attempts"])


@exercise_attempts_router.get(
    "/{attempt_id}",
    response_model=ExerciseAttemptResponse,
    summary="Get single exercise attempt by ID",
)
async def get_exercise_attempt_by_id(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExerciseAttemptResponse:
    """Retrieve an exercise attempt by ID with student data isolation."""
    attempt = await ExerciseService.get_exercise_attempt(
        db=db,
        attempt_id=attempt_id,
        user=current_user,
    )
    return ExerciseAttemptResponse.model_validate(attempt)
