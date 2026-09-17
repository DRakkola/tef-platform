"""Service layer proxying exercise execution to LearningService."""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.learning.enums import SkillCategory
from app.modules.learning.schemas import ExerciseAttemptRequest
from app.modules.learning.service import LearningService
from app.modules.users.models import User


class ExerciseService:
    """Service handling exercise operations."""

    @staticmethod
    async def list_exercises(
        db: AsyncSession,
        category: SkillCategory | None = None,
        skill_id: uuid.UUID | None = None,
        level: str | None = None,
    ) -> list[Any]:
        return await LearningService.list_exercises(
            db=db,
            category=category,
            skill_id=skill_id,
            level=level,
        )

    @staticmethod
    async def get_exercise(db: AsyncSession, exercise_id: uuid.UUID) -> Any:
        return await LearningService.get_exercise_for_practice(db=db, exercise_id=exercise_id)

    @staticmethod
    async def attempt_exercise(
        db: AsyncSession,
        exercise_id: uuid.UUID,
        user: User,
        payload: ExerciseAttemptRequest,
    ) -> Any:
        return await LearningService.submit_exercise_attempt(
            db=db,
            exercise_id=exercise_id,
            user_id=user.id,
            req=payload,
        )
