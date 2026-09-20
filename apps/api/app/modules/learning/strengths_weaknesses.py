"""Strengths, weaknesses, and skill trajectory service."""

import uuid
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.learning.engine import SkillEngine
from app.modules.learning.models import SkillAssessment, StudentSkill


class StrengthsWeaknessesService:
    """Classifies student linguistic competencies into strengths, weaknesses,

    and detects trajectories (improving, declining, stable, calibrating).
    """

    STRENGTH_THRESHOLD = 75.0
    WEAKNESS_THRESHOLD = 65.0
    TREND_DELTA_THRESHOLD = 5.0

    @classmethod
    async def analyze_skills(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Analyze all skills for a student, partitioning into strengths, weaknesses, and trajectories."""
        skills_stmt = (
            select(StudentSkill)
            .where(StudentSkill.user_id == user_id)
            .options(selectinload(StudentSkill.skill))
            .order_by(StudentSkill.mastery_score.asc())
        )
        skills = (await db.execute(skills_stmt)).scalars().all()

        analyzed_skills: list[dict[str, Any]] = []

        for ss in skills:
            # 1. Determine confidence & calibration
            conf, label, is_insufficient = SkillEngine.calculate_confidence(
                attempts_count=ss.attempts_count,
                base_confidence=ss.confidence if ss.confidence > 0.0 else None,
            )

            # 2. Historical comparison for trend
            history_stmt = (
                select(SkillAssessment)
                .where(
                    SkillAssessment.user_id == user_id,
                    SkillAssessment.skill_id == ss.skill_id,
                )
                .order_by(desc(SkillAssessment.assessed_at))
                .limit(2)
            )
            history_assessments = (await db.execute(history_stmt)).scalars().all()

            previous_score = None
            if len(history_assessments) >= 2:
                previous_score = round(history_assessments[1].score, 1)
            elif len(history_assessments) == 1 and ss.attempts_count > 1:
                previous_score = round(history_assessments[0].score, 1)
            change = (
                round(ss.mastery_score - previous_score, 1)
                if previous_score is not None
                else None
            )

            # 3. Determine trend
            if is_insufficient or change is None:
                trend = "insufficient_data"
            elif change >= cls.TREND_DELTA_THRESHOLD:
                trend = "improving"
            elif change <= -cls.TREND_DELTA_THRESHOLD:
                trend = "declining"
            else:
                trend = "stable"

            s_name = ss.skill.name if ss.skill else "Compétence"
            s_cat = (
                ss.skill.category.value
                if ss.skill and hasattr(ss.skill.category, "value")
                else str(ss.skill.category if ss.skill else "general")
            )

            analyzed_skills.append(
                {
                    "skill_id": ss.skill_id,
                    "skill_name": s_name,
                    "category": s_cat,
                    "mastery_score": round(ss.mastery_score, 1),
                    "confidence": conf,
                    "confidence_label": label,
                    "insufficient_data": is_insufficient,
                    "previous_score": previous_score,
                    "change": change,
                    "trend": trend,
                    "attempts_count": ss.attempts_count,
                    "last_assessed_at": ss.last_assessed_at,
                }
            )

        # Partition into strengths, weaknesses, improving, declining
        strongest = [s for s in analyzed_skills if s["mastery_score"] >= cls.STRENGTH_THRESHOLD]
        strongest.sort(key=lambda x: x["mastery_score"], reverse=True)
        # If none >= 75%, take top 3 above 0
        if not strongest and analyzed_skills:
            sorted_by_score = sorted(analyzed_skills, key=lambda x: x["mastery_score"], reverse=True)
            strongest = sorted_by_score[:3]

        weakest = [s for s in analyzed_skills if s["mastery_score"] < cls.WEAKNESS_THRESHOLD]
        weakest.sort(key=lambda x: x["mastery_score"])
        # If none < 65%, take lowest 3
        if not weakest and analyzed_skills:
            sorted_by_score = sorted(analyzed_skills, key=lambda x: x["mastery_score"])
            weakest = sorted_by_score[:3]

        improving = [s for s in analyzed_skills if s["trend"] == "improving"]
        declining = [s for s in analyzed_skills if s["trend"] == "declining"]
        calibrating = [s for s in analyzed_skills if s["insufficient_data"]]

        return {
            "all_skills": analyzed_skills,
            "strongest_skills": strongest[:5],
            "weakest_skills": weakest[:5],
            "improving_skills": improving,
            "declining_skills": declining,
            "calibrating_skills": calibrating,
            "total_tracked": len(analyzed_skills),
        }
