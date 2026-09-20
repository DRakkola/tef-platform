"""Personalized daily study plan service V2 ('What should I practice today?').

Strictly adheres to student time budgets (15, 30, 45, 60 min) and prioritizes blocking skills.
"""

import datetime
import uuid
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.assessments.models import Attempt
from app.modules.learning.models import (
    Exercise,
    ExerciseAttempt,
    Mistake,
    ReadinessProfile,
    Recommendation,
    StudentSkill,
)
from app.modules.users.models import StudentProfile


class DailyPlanService:
    """Generates an adaptive daily study plan tailored to student blockers and strictly bounded by time budget."""

    @classmethod
    async def get_daily_plan(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        budget_override: int | None = None,
    ) -> dict[str, Any]:
        """Generate or retrieve today's adaptive study plan fitted strictly to the available time budget."""
        now = datetime.datetime.now(datetime.UTC)
        today_start = datetime.datetime.combine(now.date(), datetime.time.min, tzinfo=datetime.UTC)

        # 1. Fetch student profile and time budget
        profile = await db.scalar(select(StudentProfile).where(StudentProfile.user_id == user_id))
        budget = budget_override
        if budget is None:
            if profile and getattr(profile, "daily_minutes_available", None):
                budget = profile.daily_minutes_available
            elif profile and profile.learning_preferences:
                budget = profile.learning_preferences.get("daily_minutes_available", 30)
            else:
                budget = 30

        # Bound budget between 15 and 60 minutes
        budget = max(15, min(60, budget))

        # 2. Check activities completed today
        today_exercise_attempts = (
            await db.execute(
                select(ExerciseAttempt)
                .where(
                    ExerciseAttempt.user_id == user_id,
                    ExerciseAttempt.attempted_at >= today_start,
                )
            )
        ).scalars().all()
        completed_exercise_ids = {ea.exercise_id for ea in today_exercise_attempts}

        today_assessments_count = (
            await db.scalar(
                select(func.count(Attempt.id)).where(
                    Attempt.user_id == user_id,
                    Attempt.submitted_at >= today_start,
                )
            )
        ) or 0

        # 3. Fetch readiness profile to identify blocking competencies
        readiness_profile = await db.scalar(
            select(ReadinessProfile).where(ReadinessProfile.student_id == user_id)
        )
        blockers = readiness_profile.summary_blockers if readiness_profile else []

        tasks: list[dict[str, Any]] = []
        allocated_minutes = 0

        # Allocation based on budget
        # Budget = 15 min -> 10 min blocker drill + 5 min mistake/vocab review
        # Budget = 30 min -> 15 min blocker drill + 10 min second skill + 5 min mistake review
        # Budget = 45 min -> 20 min core focus + 15 min blocker drill + 10 min mistake/vocab review
        # Budget = 60 min -> 25 min simulation/practice + 15 min blocker drill + 10 min second blocker + 10 min review

        # Task 1: Primary blocking competency drill
        if blockers:
            primary_blocker = blockers[0]
            b_name = primary_blocker.get("skill_name", "Compétence prioritaire")
            gap_pts = primary_blocker.get("gap", 10.0)
            t1_minutes = 10 if budget == 15 else 15 if budget <= 45 else 15

            # Find matching exercise
            skill_id = uuid.UUID(primary_blocker["skill_id"]) if isinstance(primary_blocker["skill_id"], str) else primary_blocker["skill_id"]
            rec = await db.scalar(
                select(Recommendation)
                .where(
                    Recommendation.user_id == user_id,
                    Recommendation.skill_id == skill_id,
                    Recommendation.status.in_(["active", "started", "pending"]),
                )
                .limit(1)
            )
            ex_id = rec.entity_id if rec and rec.entity_type == "exercise" else None

            tasks.append(
                {
                    "id": f"blocker-{skill_id}",
                    "title": f"Ciblage Bloquant : {b_name}",
                    "description": f"Comblez le déficit de {gap_pts:.0f} pts identifié par le modèle de préparation.",
                    "task_type": "exercise",
                    "target_entity_id": ex_id,
                    "skill_name": b_name,
                    "estimated_minutes": t1_minutes,
                    "priority": "critical",
                    "is_completed": ex_id in completed_exercise_ids if ex_id else len(today_exercise_attempts) > 0,
                }
            )
            allocated_minutes += t1_minutes
        else:
            # Fallback to diagnostic or lowest skill
            lowest_skill = await db.scalar(
                select(StudentSkill)
                .where(StudentSkill.user_id == user_id)
                .options(selectinload(StudentSkill.skill))
                .order_by(StudentSkill.mastery_score.asc())
                .limit(1)
            )
            t1_minutes = 10 if budget == 15 else 15
            if lowest_skill and lowest_skill.skill:
                s_name = lowest_skill.skill.name
                tasks.append(
                    {
                        "id": f"skill-{lowest_skill.skill_id}",
                        "title": f"Exercice ciblé : {s_name}",
                        "description": f"Consolidez votre maîtrise ({lowest_skill.mastery_score:.0f}%).",
                        "task_type": "exercise",
                        "target_entity_id": None,
                        "skill_name": s_name,
                        "estimated_minutes": t1_minutes,
                        "priority": "high",
                        "is_completed": len(today_exercise_attempts) > 0,
                    }
                )
            else:
                tasks.append(
                    {
                        "id": "diagnostic-evaluation-drill",
                        "title": "Test de positionnement initial",
                        "description": "Évaluez votre niveau de départ sur les compétences clés du TEF.",
                        "task_type": "assessment",
                        "target_entity_id": None,
                        "skill_name": "Diagnostic général",
                        "estimated_minutes": t1_minutes,
                        "priority": "high",
                        "is_completed": today_assessments_count > 0,
                    }
                )
            allocated_minutes += t1_minutes

        # Task 2: Secondary blocker OR exam simulation if 45-60 min OR secondary skill practice
        remaining = budget - allocated_minutes
        if remaining >= 10:
            if len(blockers) >= 2:
                b2 = blockers[1]
                b2_name = b2.get("skill_name", "Deuxième point d'attention")
                b2_id = uuid.UUID(b2["skill_id"]) if isinstance(b2["skill_id"], str) else b2["skill_id"]
                t2_minutes = 10 if remaining <= 15 else 15
                tasks.append(
                    {
                        "id": f"blocker-secondary-{b2_id}",
                        "title": f"Renforcement : {b2_name}",
                        "description": f"Exercices sur votre 2e compétence bloquante ({b2.get('gap', 0):.0f} pts d'écart).",
                        "task_type": "exercise",
                        "target_entity_id": None,
                        "skill_name": b2_name,
                        "estimated_minutes": t2_minutes,
                        "priority": "medium",
                        "is_completed": len(today_exercise_attempts) >= 2,
                    }
                )
                allocated_minutes += t2_minutes
            elif budget >= 45:
                # Add exam simulation
                t2_minutes = 20 if remaining >= 25 else 15
                tasks.append(
                    {
                        "id": "timed-exam-simulation",
                        "title": "Simulation Chronométrée TEF",
                        "description": "Pratique en condition réelle pour développer l'endurance d'examen.",
                        "task_type": "assessment",
                        "target_entity_id": None,
                        "skill_name": "Épreuve globale",
                        "estimated_minutes": t2_minutes,
                        "priority": "high",
                        "is_completed": today_assessments_count > 0,
                    }
                )
                allocated_minutes += t2_minutes
            else:
                secondary_skill = await db.scalar(
                    select(StudentSkill)
                    .where(StudentSkill.user_id == user_id)
                    .options(selectinload(StudentSkill.skill))
                    .order_by(StudentSkill.mastery_score.asc())
                    .offset(1)
                    .limit(1)
                )
                sec_name = (
                    secondary_skill.skill.name
                    if secondary_skill and secondary_skill.skill
                    else "Compréhension & Pratique"
                )
                t2_minutes = 10 if remaining <= 15 else 15
                tasks.append(
                    {
                        "id": "secondary-skill-drill",
                        "title": f"Renforcement : {sec_name}",
                        "description": f"Exercices d'application pour consolider vos acquis en {sec_name}.",
                        "task_type": "exercise",
                        "target_entity_id": None,
                        "skill_name": sec_name,
                        "estimated_minutes": t2_minutes,
                        "priority": "medium",
                        "is_completed": len(today_exercise_attempts) >= 2,
                    }
                )
                allocated_minutes += t2_minutes

        # Task 3: Mistake revision or active vocabulary drill for remaining minutes
        remaining = budget - allocated_minutes
        if remaining >= 5:
            recent_mistake = await db.scalar(
                select(Mistake)
                .where(Mistake.user_id == user_id)
                .options(selectinload(Mistake.skill))
                .order_by(desc(Mistake.error_count), desc(Mistake.last_occurred_at))
                .limit(1)
            )
            if recent_mistake:
                m_skill = recent_mistake.skill.name if recent_mistake.skill else "Linguistique"
                tasks.append(
                    {
                        "id": f"mistake-{recent_mistake.id}",
                        "title": f"Révision d'erreur : {m_skill}",
                        "description": f"Corrigez et ancrez vos points d'achoppement récents ({recent_mistake.error_count} erreur(s)).",
                        "task_type": "mistake_review",
                        "target_entity_id": recent_mistake.exercise_id or recent_mistake.question_id,
                        "skill_name": m_skill,
                        "estimated_minutes": remaining,
                        "priority": "medium",
                        "is_completed": len(today_exercise_attempts) >= len(tasks),
                    }
                )
                allocated_minutes += remaining
            else:
                tasks.append(
                    {
                        "id": "vocab-fluency-maintenance",
                        "title": "Lexique et Fluidité d'expression",
                        "description": f"{remaining} minutes d'ancrage actif du vocabulaire ciblé B2/C1.",
                        "task_type": "exercise",
                        "target_entity_id": None,
                        "skill_name": "Vocabulaire",
                        "estimated_minutes": remaining,
                        "priority": "normal",
                        "is_completed": len(today_exercise_attempts) >= len(tasks),
                    }
                )
                allocated_minutes += remaining

        # Strict invariant verification: allocated_minutes <= budget
        assert allocated_minutes <= budget, f"Allocated minutes {allocated_minutes} exceeds budget {budget}"

        completed_count = sum(1 for t in tasks if t["is_completed"])
        completion_pct = round((completed_count / len(tasks)) * 100.0, 1) if tasks else 0.0

        return {
            "date": now.date().isoformat(),
            "daily_minutes_available": budget,
            "total_tasks": len(tasks),
            "completed_tasks": completed_count,
            "completion_percentage": completion_pct,
            "estimated_minutes_total": allocated_minutes,
            "total_estimated_minutes": allocated_minutes,
            "tasks": tasks,
        }
