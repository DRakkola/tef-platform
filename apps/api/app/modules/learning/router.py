"""FastAPI router for learning intelligence, skills tracking, recommendations, and exercises."""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.learning.enums import RecommendationStatus, SkillCategory
from app.modules.learning.schemas import (
    ExerciseAttemptRequest,
    ExerciseAttemptResponse,
    ExerciseResponse,
    MistakeResponse,
    RecommendationFeedbackRequest,
    RecommendationFeedbackResponse,
    RecommendationResponse,
    SkillAssessmentResponse,
    StudentSkillResponse,
)
from app.modules.learning.service import LearningService
from app.modules.users.models import User

router = APIRouter(prefix="", tags=["learning"])


@router.get(
    "/students/skills",
    response_model=list[StudentSkillResponse],
    summary="Get current student skills and mastery scores",
)
async def get_student_skills(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[StudentSkillResponse]:
    """Retrieve all tracked skills and current mastery estimates for the authenticated student."""
    skills = await LearningService.get_student_skills(
        db=db,
        user_id=current_user.id,
    )
    return [StudentSkillResponse.model_validate(s) for s in skills]


@router.get(
    "/students/skills/history",
    response_model=list[SkillAssessmentResponse],
    summary="Get immutable historical skill assessment snapshots",
)
async def get_student_skill_history(
    skill_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SkillAssessmentResponse]:
    """Retrieve chronological skill assessment records for trend analysis and auditability."""
    history = await LearningService.get_skill_history(
        db=db,
        user_id=current_user.id,
        skill_id=skill_id,
    )
    return [SkillAssessmentResponse.model_validate(h) for h in history]


@router.get(
    "/students/mistakes",
    response_model=list[MistakeResponse],
    summary="Get logged student mistakes",
)
async def get_student_mistakes(
    skill_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MistakeResponse]:
    """Retrieve mistakes recorded across assessments and exercises for targeted review."""
    mistakes = await LearningService.get_student_mistakes(
        db=db,
        user_id=current_user.id,
        skill_id=skill_id,
    )
    return [MistakeResponse.model_validate(m) for m in mistakes]


@router.get(
    "/students/recommendations",
    response_model=list[RecommendationResponse],
    summary="Get active personalized learning recommendations",
)
async def get_student_recommendations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[RecommendationResponse]:
    """List active recommendations prioritised deterministically by skill mastery gap and mistakes."""
    recs = await LearningService.get_student_recommendations(
        db=db,
        user_id=current_user.id,
    )
    return [RecommendationResponse.model_validate(r) for r in recs]


@router.post(
    "/recommendations/{recommendation_id}/dismiss",
    response_model=RecommendationResponse,
    summary="Dismiss a learning recommendation",
)
async def dismiss_recommendation(
    recommendation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RecommendationResponse:
    """Mark a recommendation as dismissed so it no longer clutters the student feed."""
    updated = await LearningService.update_recommendation_status(
        db=db,
        recommendation_id=recommendation_id,
        user_id=current_user.id,
        new_status=RecommendationStatus.DISMISSED,
    )
    return RecommendationResponse.model_validate(updated)


@router.post(
    "/recommendations/{recommendation_id}/complete",
    response_model=RecommendationResponse,
    summary="Mark a learning recommendation as completed",
)
async def complete_recommendation(
    recommendation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RecommendationResponse:
    """Mark a recommendation as completed after student finishes the prescribed study activity."""
    updated = await LearningService.update_recommendation_status(
        db=db,
        recommendation_id=recommendation_id,
        user_id=current_user.id,
        new_status=RecommendationStatus.COMPLETED,
    )
    return RecommendationResponse.model_validate(updated)


@router.post(
    "/recommendations/{recommendation_id}/feedback",
    response_model=RecommendationFeedbackResponse,
    summary="Submit student feedback and relevance rating for a recommendation",
)
async def submit_recommendation_feedback(
    recommendation_id: uuid.UUID,
    payload: RecommendationFeedbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RecommendationFeedbackResponse:
    """Record student feedback on recommendation quality and relevance."""
    result = await LearningService.submit_recommendation_feedback(
        db=db,
        recommendation_id=recommendation_id,
        user_id=current_user.id,
        relevance_rating=payload.relevance_rating,
        reason=payload.reason,
        dismiss_recommendation=payload.dismiss_recommendation,
    )
    return RecommendationFeedbackResponse.model_validate(result)


@router.get(
    "/exercises",
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
    """List published practice exercises with options for taking (correct answers concealed)."""
    exercises = await LearningService.list_exercises(
        db=db,
        category=category,
        skill_id=skill_id,
        level=level,
    )
    return [ExerciseResponse.model_validate(ex) for ex in exercises]


@router.get(
    "/exercises/{exercise_id}",
    response_model=ExerciseResponse,
    summary="Get single exercise for practice",
)
async def get_exercise(
    exercise_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> ExerciseResponse:
    """Retrieve an exercise for taking without revealing the correct answers."""
    exercise = await LearningService.get_exercise_for_practice(
        db=db,
        exercise_id=exercise_id,
    )
    return ExerciseResponse.model_validate(exercise)


@router.post(
    "/exercises/{exercise_id}/attempts",
    response_model=ExerciseAttemptResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an exercise practice attempt",
)
async def submit_exercise_attempt(
    exercise_id: uuid.UUID,
    req: ExerciseAttemptRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExerciseAttemptResponse:
    """Submit practice response, grade immediately, update skills, log mistakes, and complete active recommendation."""
    result = await LearningService.submit_exercise_attempt(
        db=db,
        exercise_id=exercise_id,
        user_id=current_user.id,
        req=req,
    )
    return ExerciseAttemptResponse.model_validate(result)
