"""Adaptive exercise selector determining appropriate challenge level without aggressive jumps."""

import datetime
import uuid
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.learning.models import (
    Exercise,
    ExerciseAttempt,
    ExerciseSkill,
)


class AdaptiveDifficultySelector:
    """Selects targeted learning exercises matching student readiness.

    Categorizes candidates as 'too_easy', 'appropriate', or 'challenging'.
    Smoothly transitions difficulty, avoiding severe penalties for single incorrect answers.
    """

    COOLDOWN_HOURS = 48

    @classmethod
    def evaluate_exercise_tier(
        cls,
        exercise_level: str,
        exercise_difficulty: int,
        student_estimate: float | None,
        target_level: str = "B2",
    ) -> str:
        """Classify an exercise relative to student estimate and target.

        Returns 'too_easy', 'appropriate', or 'challenging'.
        """
        if student_estimate is None:
            # When uncalibrated, foundation level (B1/difficulty 2-3) is appropriate
            if exercise_difficulty <= 2:
                return "appropriate"
            return "challenging"

        # Level mapping index: A1=1, A2=2, B1=3, B2=4, C1=5, C2=6
        level_weights = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6}
        ex_weight = level_weights.get(exercise_level.strip().upper(), 3)
        target_weight = level_weights.get(target_level.strip().upper(), 4)

        # Estimate equivalent tier
        if student_estimate < 35.0:
            est_weight = 1  # A1
        elif student_estimate < 50.0:
            est_weight = 2  # A2
        elif student_estimate < 65.0:
            est_weight = 3  # B1
        elif student_estimate < 80.0:
            est_weight = 4  # B2
        elif student_estimate < 90.0:
            est_weight = 5  # C1
        else:
            est_weight = 6  # C2

        diff_step = ex_weight - est_weight

        if diff_step < -1:
            return "too_easy"
        if diff_step == -1:
            return "too_easy" if student_estimate >= 70.0 else "appropriate"
        if diff_step == 0:
            return "appropriate"
        if diff_step == 1:
            # One step above is appropriate if student has good mastery, challenging otherwise
            return "challenging"
        return "challenging"

    @classmethod
    async def select_adaptive_exercise(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        skill_id: uuid.UUID,
        student_estimate: float | None,
        target_level: str = "B2",
        preferred_tier: str = "appropriate",
    ) -> Exercise | None:
        """Select an optimal published exercise for the student adhering to 48h cooldown."""
        now = datetime.datetime.now(datetime.UTC)
        cutoff = now - datetime.timedelta(hours=cls.COOLDOWN_HOURS)

        # 1. Fetch recently completed exercise IDs (cooldown)
        recent_attempts_stmt = select(ExerciseAttempt.exercise_id).where(
            ExerciseAttempt.user_id == user_id,
            ExerciseAttempt.attempted_at >= cutoff,
        )
        recent_exercise_ids = set((await db.execute(recent_attempts_stmt)).scalars().all())

        # 2. Query published exercises linked to this skill
        exercises_stmt = (
            select(Exercise)
            .join(ExerciseSkill, ExerciseSkill.exercise_id == Exercise.id)
            .where(
                ExerciseSkill.skill_id == skill_id,
                Exercise.is_published.is_(True),
            )
            .order_by(desc(Exercise.created_at))
        )
        candidates = (await db.execute(exercises_stmt)).scalars().all()

        # 3. Partition by tier and filter cooldown
        tiered: dict[str, list[Exercise]] = {
            "appropriate": [],
            "challenging": [],
            "too_easy": [],
        }

        for ex in candidates:
            if ex.id in recent_exercise_ids:
                continue
            tier = cls.evaluate_exercise_tier(
                exercise_level=ex.level,
                exercise_difficulty=ex.difficulty,
                student_estimate=student_estimate,
                target_level=target_level,
            )
            tiered[tier].append(ex)

        # Return preference or safe fallback
        if tiered[preferred_tier]:
            return tiered[preferred_tier][0]
        if tiered["appropriate"]:
            return tiered["appropriate"][0]
        if tiered["challenging"]:
            return tiered["challenging"][0]
        if tiered["too_easy"]:
            return tiered["too_easy"][0]

        return None
