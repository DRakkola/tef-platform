"""Target-gap service computing distance to target CEFR/NCLC level and exam date urgency."""

import datetime
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.learning.levels import LevelEstimationService
from app.modules.learning.models import StudentSkill
from app.modules.users.models import StudentProfile, User


class TargetGapService:
    """Computes progress relative to target CEFR/NCLC goals and exam readiness timelines."""

    @classmethod
    async def get_target_gap(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Compute complete target gap analysis for student."""
        # 1. Fetch student profile
        profile = await db.scalar(
            select(StudentProfile).where(StudentProfile.user_id == user_id)
        )
        target_exam = profile.target_exam if profile else "TEF Canada"
        target_cefr = (
            (profile.target_cefr_level or profile.target_level)
            if profile and (profile.target_cefr_level or profile.target_level)
            else "B2"
        ).strip().upper()
        target_nclc = (
            profile.target_nclc_level
            if profile and profile.target_nclc_level
            else LevelEstimationService.estimate_nclc(
                LevelEstimationService.get_level_threshold(target_cefr),
                target_cefr,
            )
        )
        target_date: datetime.date | None = profile.target_date if profile else None

        # 2. Fetch student skills
        skills_stmt = (
            select(StudentSkill)
            .where(StudentSkill.user_id == user_id)
            .options(selectinload(StudentSkill.skill))
            .order_by(StudentSkill.mastery_score.asc())
        )
        skills = (await db.execute(skills_stmt)).scalars().all()

        # Compute current overall readiness
        valid_scores = [s.mastery_score for s in skills]
        current_score = (
            round(sum(valid_scores) / len(valid_scores), 1) if valid_scores else 0.0
        )
        current_cefr = LevelEstimationService.estimate_cefr(current_score) if valid_scores else "A1"
        current_nclc = (
            LevelEstimationService.estimate_nclc(current_score, current_cefr)
            if valid_scores
            else "NCLC 3"
        )

        # 3. Gaps and level distance
        target_threshold = LevelEstimationService.get_level_threshold(target_cefr)
        score_gap = round(max(0.0, target_threshold - current_score), 1)
        level_distance = LevelEstimationService.calculate_level_distance(current_cefr, target_cefr)
        is_target_met = current_score >= target_threshold and level_distance == 0

        # 4. Target date urgency
        today = datetime.datetime.now(datetime.UTC).date()
        days_remaining: int | None = None
        urgency = "none"
        if target_date:
            days_remaining = (target_date - today).days
            if days_remaining < 0:
                urgency = "overdue"
            elif days_remaining <= 14:
                urgency = "critical"
            elif days_remaining <= 30:
                urgency = "urgent"
            else:
                urgency = "normal"

        # 5. Priority skill deficits
        priority_deficits: list[dict[str, Any]] = []
        for s in skills:
            if s.mastery_score < target_threshold:
                deficit = round(target_threshold - s.mastery_score, 1)
                s_name = s.skill.name if s.skill else "Compétence"
                s_cat = (
                    s.skill.category.value
                    if s.skill and hasattr(s.skill.category, "value")
                    else str(s.skill.category if s.skill else "general")
                )
                priority_deficits.append(
                    {
                        "skill_id": s.skill_id,
                        "skill_name": s_name,
                        "category": s_cat,
                        "current_score": round(s.mastery_score, 1),
                        "deficit": deficit,
                        "attempts_count": s.attempts_count,
                    }
                )

        # Sort deficits largest first
        priority_deficits.sort(key=lambda x: x["deficit"], reverse=True)

        return {
            "target_exam": target_exam,
            "target_cefr_level": target_cefr,
            "target_nclc_level": target_nclc,
            "target_date": target_date.isoformat() if target_date else None,
            "days_remaining": days_remaining,
            "urgency": urgency,
            "current_score": current_score,
            "current_cefr_level": current_cefr,
            "current_nclc_level": current_nclc,
            "target_threshold_score": target_threshold,
            "score_gap": score_gap,
            "level_distance": level_distance,
            "is_target_met": is_target_met,
            "priority_deficits": priority_deficits,
            "disclaimer": LevelEstimationService.DISCLAIMER,
        }

    @classmethod
    async def update_target(
        cls,
        db: AsyncSession,
        user: User,
        target_exam: str | None = None,
        target_cefr_level: str | None = None,
        target_nclc_level: str | None = None,
        target_date: datetime.date | None = None,
    ) -> dict[str, Any]:
        """Update or create student target profile goals."""
        profile = await db.scalar(
            select(StudentProfile).where(StudentProfile.user_id == user.id)
        )
        if not profile:
            profile = StudentProfile(
                user_id=user.id,
                target_exam=target_exam or "TEF Canada",
                target_level=target_cefr_level or "B2",
                target_cefr_level=target_cefr_level or "B2",
                target_nclc_level=target_nclc_level or "NCLC 7",
                target_date=target_date,
            )
            db.add(profile)
        else:
            if target_exam is not None:
                profile.target_exam = target_exam
            if target_cefr_level is not None:
                profile.target_cefr_level = target_cefr_level.strip().upper()
                profile.target_level = target_cefr_level.strip().upper()
            if target_nclc_level is not None:
                profile.target_nclc_level = target_nclc_level.strip()
            if target_date is not None:
                profile.target_date = target_date

        await db.flush()
        return await cls.get_target_gap(db, user.id)
