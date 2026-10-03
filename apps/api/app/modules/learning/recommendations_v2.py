"""Recommendation engine v2 with deduplication, 48-hour cooldown, and lifecycle state management."""

import datetime
import uuid
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.modules.admin.enums import SkillRelationType
from app.modules.admin.models import SkillLevelDescriptor, SkillRelation
from app.modules.assessments.models import Skill
from app.modules.learning.engine import RecommendationEngine
from app.modules.learning.enums import RecommendationStatus, RecommendationType
from app.modules.learning.models import (
    Exercise,
    ExerciseAttempt,
    ExerciseSkill,
    Mistake,
    Recommendation,
    StudentSkill,
)
from app.modules.users.models import StudentProfile


class RecommendationEngineV2:
    """Production-grade recommendation engine incorporating mistakes, target gap,

    cooldown periods, and full lifecycle state tracking.
    """

    COOLDOWN_HOURS = 48
    EXPIRY_DAYS = 14

    @classmethod
    async def generate_recommendations(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[Recommendation]:
        """Evaluate student needs, enforce cooldown and deduplication, and persist recommendations."""
        now = datetime.datetime.now(datetime.UTC)
        cooldown_cutoff = now - datetime.timedelta(hours=cls.COOLDOWN_HOURS)
        expiry_date = now + datetime.timedelta(days=cls.EXPIRY_DAYS)

        # 1. Fetch student target goals
        profile = await db.scalar(
            select(StudentProfile).where(StudentProfile.user_id == user_id)
        )
        target_level = profile.target_level if profile else "B2"
        target_date = profile.target_date if profile else None
        days_to_target: int | None = None
        if target_date:
            days_to_target = (target_date - now.date()).days

        # 2. Query skills below mastery threshold (70%)
        weak_skills_stmt = (
            select(StudentSkill)
            .where(
                StudentSkill.user_id == user_id,
                StudentSkill.mastery_score < RecommendationEngine.MASTERY_THRESHOLD,
            )
            .options(selectinload(StudentSkill.skill))
            .order_by(StudentSkill.mastery_score.asc())
        )
        student_skills = (await db.execute(weak_skills_stmt)).scalars().all()

        # Fetch all student skills for prerequisite checking
        all_student_skills_stmt = select(StudentSkill).where(StudentSkill.user_id == user_id)
        all_student_skills = {
            ss.skill_id: ss for ss in (await db.execute(all_student_skills_stmt)).scalars().all()
        }

        # Query prerequisite relations for these weak skills
        weak_skill_ids = [ss.skill_id for ss in student_skills]
        prereq_relations: list[SkillRelation] = []
        if weak_skill_ids:
            rel_stmt = (
                select(SkillRelation)
                .where(
                    SkillRelation.to_skill_id.in_(weak_skill_ids),
                    SkillRelation.relation_type == SkillRelationType.PREREQUISITE,
                )
                .options(selectinload(SkillRelation.from_skill))
            )
            prereq_relations = list((await db.execute(rel_stmt)).scalars().all())

        # Map to_skill_id -> list of prerequisite Skills that are unmet
        unmet_prereqs_by_skill: dict[uuid.UUID, list[Skill]] = {}
        for rel in prereq_relations:
            if rel.from_skill is None:
                continue
            prereq_ss = all_student_skills.get(rel.from_skill_id)
            # If prerequisite has not been assessed or has mastery < 70%, it is unmet!
            if prereq_ss is None or prereq_ss.mastery_score < RecommendationEngine.MASTERY_THRESHOLD:
                unmet_prereqs_by_skill.setdefault(rel.to_skill_id, []).append(rel.from_skill)

        # 3. Find exercises completed in the last 48 hours to enforce cooldown
        recent_attempts_stmt = select(ExerciseAttempt.exercise_id).where(
            ExerciseAttempt.user_id == user_id,
            ExerciseAttempt.is_correct.is_(True),
            ExerciseAttempt.attempted_at >= cooldown_cutoff,
        )
        cooldown_exercise_ids = set((await db.execute(recent_attempts_stmt)).scalars().all())

        created_or_updated: list[Recommendation] = []
        handled_prereq_ids: set[uuid.UUID] = set()

        for ss in student_skills:
            # Check for unmet prerequisite skills first (Requirement 11)
            unmet_prereqs = unmet_prereqs_by_skill.get(ss.skill_id, [])
            for p_skill in unmet_prereqs:
                if p_skill.id in handled_prereq_ids:
                    continue
                handled_prereq_ids.add(p_skill.id)

                # Query exercises for prerequisite skill
                p_ex_stmt = (
                    select(Exercise)
                    .join(ExerciseSkill, ExerciseSkill.exercise_id == Exercise.id)
                    .where(
                        ExerciseSkill.skill_id == p_skill.id,
                        Exercise.is_published.is_(True),
                    )
                    .limit(3)
                )
                p_exercises = (await db.execute(p_ex_stmt)).scalars().all()

                prereq_priority = min(100, 85 + len(p_exercises))
                prereq_reason = (
                    f"Prérequis prioritaire : La maîtrise de '{p_skill.name}' est requise "
                    f"avant d'aborder '{ss.skill.name if ss.skill else 'cette compétence'}'."
                )

                for p_ex in p_exercises:
                    if p_ex.id in cooldown_exercise_ids:
                        continue
                    existing_p_rec = await db.scalar(
                        select(Recommendation).where(
                            Recommendation.user_id == user_id,
                            Recommendation.entity_id == p_ex.id,
                            Recommendation.status.in_(
                                [
                                    RecommendationStatus.ACTIVE,
                                    RecommendationStatus.PENDING,
                                    RecommendationStatus.STARTED,
                                ]
                            ),
                        )
                    )
                    if existing_p_rec:
                        existing_p_rec.priority = max(existing_p_rec.priority, prereq_priority)
                        existing_p_rec.reason = prereq_reason
                        existing_p_rec.generated_at = now
                        existing_p_rec.expires_at = expiry_date
                        created_or_updated.append(existing_p_rec)
                    else:
                        new_p_rec = Recommendation(
                            user_id=user_id,
                            skill_id=p_skill.id,
                            recommendation_type=RecommendationType.EXERCISE,
                            entity_type="exercise",
                            entity_id=p_ex.id,
                            reason=prereq_reason,
                            priority=prereq_priority,
                            status=RecommendationStatus.ACTIVE,
                            generated_at=now,
                            expires_at=expiry_date,
                        )
                        db.add(new_p_rec)
                        created_or_updated.append(new_p_rec)

            # Count recent mistakes for this skill
            mistakes_count_stmt = select(func.sum(Mistake.error_count)).where(
                Mistake.user_id == user_id,
                Mistake.skill_id == ss.skill_id,
            )
            mistakes_total = (await db.scalar(mistakes_count_stmt)) or 0

            # Target skill IDs (including parent skill hierarchy)
            target_skill_ids = [ss.skill_id]
            if ss.skill and ss.skill.parent_id:
                target_skill_ids.append(ss.skill.parent_id)

            # Query published exercises tagged with these skills
            exercises_stmt = (
                select(Exercise)
                .join(ExerciseSkill, ExerciseSkill.exercise_id == Exercise.id)
                .where(
                    ExerciseSkill.skill_id.in_(target_skill_ids),
                    Exercise.is_published.is_(True),
                )
                .limit(6)
            )
            matching_exercises = (await db.execute(exercises_stmt)).scalars().all()

            target_gap = max(0.0, 70.0 - ss.mastery_score)
            priority = RecommendationEngine.calculate_priority(
                mastery_score=ss.mastery_score,
                mistake_count=int(mistakes_total),
                target_gap=target_gap,
                days_to_target=days_to_target,
            )

            # Evidence-confidence calibration (Requirement 12)
            # Low sample sizes (confidence < 0.25 or attempts < 2) don't generate aggressive recommendations
            if ss.confidence < 0.25 or ss.attempts_count < 2:
                priority = max(10, int(priority * max(0.25, ss.confidence)))
                reason = (
                    f"Compétence en cours de diagnostic ({ss.attempts_count} observation(s)). "
                    "Exercice d'évaluation diagnostique recommandé pour consolider l'estimation."
                )
            else:
                reason = RecommendationEngine.build_recommendation_reason(
                    skill_name=ss.skill.name if ss.skill else "Compétence",
                    mastery_score=ss.mastery_score,
                    mistake_count=int(mistakes_total),
                    target_level=target_level,
                )

            for ex in matching_exercises:
                # Skip if exercise is in cooldown period
                if ex.id in cooldown_exercise_ids:
                    continue

                # Deduplication: Check if active or pending recommendation already exists
                existing_rec = await db.scalar(
                    select(Recommendation).where(
                        Recommendation.user_id == user_id,
                        Recommendation.entity_id == ex.id,
                        Recommendation.status.in_(
                            [
                                RecommendationStatus.ACTIVE,
                                RecommendationStatus.PENDING,
                                RecommendationStatus.STARTED,
                            ]
                        ),
                    )
                )

                if existing_rec:
                    # Upgrade priority and refresh reason if mistakes occurred
                    existing_rec.priority = max(existing_rec.priority, priority)
                    existing_rec.reason = reason
                    existing_rec.generated_at = now
                    existing_rec.expires_at = expiry_date
                    created_or_updated.append(existing_rec)
                else:
                    new_rec = Recommendation(
                        user_id=user_id,
                        skill_id=ss.skill_id,
                        recommendation_type=RecommendationType.EXERCISE,
                        entity_type="exercise",
                        entity_id=ex.id,
                        reason=reason,
                        priority=priority,
                        status=RecommendationStatus.ACTIVE,
                        generated_at=now,
                        expires_at=expiry_date,
                    )
                    db.add(new_rec)
                    created_or_updated.append(new_rec)

        await db.flush()
        return created_or_updated

    @classmethod
    async def get_recommendations(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        status_filter: RecommendationStatus | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Retrieve personalized recommendations for student with exercise details."""
        stmt = (
            select(Recommendation)
            .where(Recommendation.user_id == user_id)
            .options(selectinload(Recommendation.skill))
            .order_by(Recommendation.priority.desc(), desc(Recommendation.generated_at))
            .limit(limit)
        )
        if status_filter:
            stmt = stmt.where(Recommendation.status == status_filter)
        else:
            stmt = stmt.where(
                Recommendation.status.in_(
                    [
                        RecommendationStatus.ACTIVE,
                        RecommendationStatus.STARTED,
                        RecommendationStatus.PENDING,
                    ]
                )
            )

        recs = (await db.execute(stmt)).scalars().all()
        results: list[dict[str, Any]] = []

        # Batch-load CEFR descriptors for recommended skills (Requirement 8)
        skill_ids = [r.skill_id for r in recs if r.skill_id]
        descriptors_map: dict[tuple[uuid.UUID, str], str] = {}
        guidance_map: dict[tuple[uuid.UUID, str], str] = {}
        if skill_ids:
            desc_stmt = select(SkillLevelDescriptor).where(
                SkillLevelDescriptor.skill_id.in_(skill_ids)
            )
            for desc_row in (await db.execute(desc_stmt)).scalars().all():
                level_str = (
                    desc_row.level.value
                    if hasattr(desc_row.level, "value")
                    else str(desc_row.level)
                )
                descriptors_map[(desc_row.skill_id, level_str.upper())] = desc_row.descriptor
                if desc_row.evidence_guidance:
                    guidance_map[(desc_row.skill_id, level_str.upper())] = desc_row.evidence_guidance

        for r in recs:
            ex = None
            if r.entity_type == "exercise":
                ex = await db.get(Exercise, r.entity_id)

            level = ex.level if ex else "B2"
            descriptor = descriptors_map.get((r.skill_id, level.upper())) if r.skill_id else None
            evidence_guidance = (
                guidance_map.get((r.skill_id, level.upper())) if r.skill_id else None
            )

            results.append(
                {
                    "id": r.id,
                    "user_id": r.user_id,
                    "skill_id": r.skill_id,
                    "skill_code": r.skill.code if r.skill else "",
                    "skill_name": r.skill.name if r.skill else "Compétence",
                    "dimension": (
                        r.skill.dimension.value
                        if r.skill and hasattr(r.skill, "dimension") and r.skill.dimension
                        else None
                    ),
                    "domain": (
                        r.skill.domain
                        if r.skill and hasattr(r.skill, "domain")
                        else None
                    ),
                    "recommendation_type": r.recommendation_type,
                    "entity_type": r.entity_type,
                    "entity_id": r.entity_id,
                    "title": ex.title if ex else "Exercice de perfectionnement",
                    "category": (
                        ex.category.value
                        if ex and hasattr(ex.category, "value")
                        else (
                            r.skill.category.value
                            if r.skill and hasattr(r.skill.category, "value")
                            else "general"
                        )
                    ),
                    "level": level,
                    "difficulty": ex.difficulty if ex else 3,
                    "descriptor": descriptor,
                    "evidence_guidance": evidence_guidance,
                    "reason": r.reason,
                    "priority": r.priority,
                    "priority_label": (
                        "critical"
                        if r.priority >= 80
                        else "high"
                        if r.priority >= 60
                        else "medium"
                    ),
                    "status": r.status,
                    "generated_at": r.generated_at,
                    "expires_at": r.expires_at,
                }
            )

        return results

    @classmethod
    async def update_status(
        cls,
        db: AsyncSession,
        recommendation_id: uuid.UUID,
        user_id: uuid.UUID,
        new_status: RecommendationStatus,
    ) -> dict[str, Any]:
        """Update recommendation lifecycle status (STARTED, COMPLETED, DISMISSED)."""
        rec = await db.scalar(
            select(Recommendation)
            .where(
                Recommendation.id == recommendation_id,
                Recommendation.user_id == user_id,
            )
            .options(selectinload(Recommendation.skill))
        )
        if not rec:
            raise AppException(
                message="Recommendation not found",
                code="RECOMMENDATION_NOT_FOUND",
                status_code=404,
            )

        rec.status = new_status
        await db.flush()

        ex = None
        if rec.entity_type == "exercise":
            ex = await db.get(Exercise, rec.entity_id)

        return {
            "id": rec.id,
            "user_id": rec.user_id,
            "skill_id": rec.skill_id,
            "skill_code": rec.skill.code if rec.skill else "",
            "skill_name": rec.skill.name if rec.skill else "",
            "recommendation_type": rec.recommendation_type,
            "entity_type": rec.entity_type,
            "entity_id": rec.entity_id,
            "title": ex.title if ex else "",
            "reason": rec.reason,
            "priority": rec.priority,
            "status": rec.status,
            "generated_at": rec.generated_at,
            "expires_at": rec.expires_at,
        }
