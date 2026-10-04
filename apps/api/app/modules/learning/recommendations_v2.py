"""Canonical Recommendation Engine V2 consuming SkillEvidence and StudentSkill.

Architecture:
Assessment / Exercise / Writing / Speaking
                ↓
          Skill Evidence
                ↓
          Student Mastery (StudentSkill)
                ↓
       Skill Gap Analysis
                ↓
        Recommendation Engine

RecommendationEngineV2 does not independently reconstruct a second version of
student competency state from raw assessment scores. It consumes:
1. SkillEvidence (canonical historical observation source)
2. StudentSkill (current rolling mastery projection)
3. Taxonomy relationships (parent/subskills, prerequisites, related, modalities, task types)
"""

import datetime
import uuid
from collections import defaultdict
from typing import Any

from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.modules.admin.enums import SkillRelationType
from app.modules.admin.models import SkillLevelDescriptor, SkillRelation
from app.modules.assessments.models import Skill
from app.modules.learning.assessment_mapping import default_mapping_provider
from app.modules.learning.engine import RecommendationEngine
from app.modules.learning.enums import RecommendationStatus, RecommendationType
from app.modules.learning.models import (
    Exercise,
    ExerciseAttempt,
    ExerciseSkill,
    Mistake,
    Recommendation,
    SkillEvidence,
    StudentSkill,
)
from app.modules.users.models import StudentProfile


class RecommendationEngineV2:
    """Production-grade recommendation engine incorporating canonical skill evidence,

    prerequisites, target level gaps, cooldown periods, and lifecycle state tracking.
    """

    COOLDOWN_HOURS = 48
    EXPIRY_DAYS = 14
    MASTERY_THRESHOLD = 70.0

    @classmethod
    def classify_weakness_state(
        cls,
        observation_count: int,
        confidence: float,
        mastery_score: float,
    ) -> tuple[str, str]:
        """Classify student skill into insufficient_evidence, emerging_weakness, or confirmed_weakness.

        Distinguishes low performance with strong evidence from low performance with insufficient data.
        """
        if observation_count < 2 or confidence < 0.35:
            return "insufficient_evidence", "Diagnostic"
        if observation_count < 5 or confidence < 0.65:
            return "emerging_weakness", "Faiblesse émergente"
        return "confirmed_weakness", "Faiblesse confirmée"

    @classmethod
    def build_evidence_backed_reason(
        cls,
        skill_name: str,
        skill_code: str,
        weakness_state: str,
        observation_count: int,
        mastery_score: float,
        mistake_count: int = 0,
        sources_summary: dict[str, int] | None = None,
        target_level: str = "B2",
        target_threshold: float = 65.0,
        modality_names: list[str] | None = None,
    ) -> str:
        """Construct explainable diagnostic reason backed by observable evidence.

        Example:
        'Weak performance in reference_resolution across 8 recent reading questions.'
        rather than: 'Reading needs improvement.'
        """
        sources_summary = sources_summary or {}
        parts: list[str] = []
        if sources_summary.get("assessment_item"):
            parts.append(f"{sources_summary['assessment_item']} question(s) d'évaluation")
        elif sources_summary.get("assessment"):
            parts.append(f"{sources_summary['assessment']} épreuve(s)")
        if sources_summary.get("exercise"):
            parts.append(f"{sources_summary['exercise']} exercice(s)")
        if sources_summary.get("writing"):
            parts.append(f"{sources_summary['writing']} production(s) écrite(s)")
        if sources_summary.get("speaking"):
            parts.append(f"{sources_summary['speaking']} session(s) d'expression orale")
        if sources_summary.get("teacher_evaluation"):
            parts.append(f"{sources_summary['teacher_evaluation']} avis enseignant")
        if sources_summary.get("ai_evaluation"):
            parts.append(f"{sources_summary['ai_evaluation']} évaluation(s) IA")

        sources_text = ", ".join(parts) if parts else f"{observation_count} observation(s)"
        modality_text = f" en {', '.join(modality_names)}" if modality_names else ""

        if weakness_state == "insufficient_evidence":
            return (
                f"Compétence '{skill_name}' ({skill_code}) en cours de diagnostic "
                f"({observation_count} observation(s){modality_text}). "
                "Exercice d'évaluation diagnostique recommandé pour consolider l'estimation."
            )
        if weakness_state == "emerging_weakness":
            return (
                f"Faiblesse émergente en '{skill_name}' ({skill_code}) constatée sur "
                f"{observation_count} observation(s) récentes ({sources_text}{modality_text}, "
                f"maîtrise {mastery_score:.0f}%). Pratique ciblée recommandée pour consolider les acquis."
            )
        # confirmed_weakness
        err_text = f", {mistake_count} erreur(s) identifiée(s)" if mistake_count > 0 else ""
        return (
            f"Faiblesse confirmée en '{skill_name}' ({skill_code}) sur {observation_count} "
            f"observation(s) récentes ({sources_text}{modality_text}, maîtrise {mastery_score:.0f}%"
            f"{err_text}, seuil cible {target_level} : {target_threshold:.0f}%). "
            "Entraînez-vous pour combler l'écart."
        )

    @classmethod
    async def generate_recommendations(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        taxonomy_version_id: uuid.UUID | None = None,
    ) -> list[Recommendation]:
        """Evaluate student needs from SkillEvidence and StudentSkill, enforce cooldown

        and deduplication, and persist recommendations.
        """
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

        target_threshold = default_mapping_provider.get_target_threshold(target_level)

        # 2. Query skills below mastery threshold (70%)
        # Exclude archived/inactive skills and optionally scope to taxonomy_version_id
        weak_skills_stmt = (
            select(StudentSkill)
            .join(Skill, Skill.id == StudentSkill.skill_id)
            .where(
                StudentSkill.user_id == user_id,
                StudentSkill.mastery_score < cls.MASTERY_THRESHOLD,
                Skill.is_active.is_(True),
            )
            .options(
                selectinload(StudentSkill.skill).selectinload(Skill.parent),
                selectinload(StudentSkill.skill).selectinload(Skill.subskills),
                selectinload(StudentSkill.skill).selectinload(Skill.modalities),
                selectinload(StudentSkill.skill).selectinload(Skill.supported_task_types),
            )
            .order_by(StudentSkill.mastery_score.asc())
        )
        if taxonomy_version_id is not None:
            weak_skills_stmt = weak_skills_stmt.where(Skill.taxonomy_version_id == taxonomy_version_id)

        student_skills = list((await db.execute(weak_skills_stmt)).scalars().all())

        # 3. Fetch all student skills for prerequisite checking
        all_student_skills_stmt = select(StudentSkill).where(StudentSkill.user_id == user_id)
        all_student_skills: dict[uuid.UUID, StudentSkill] = {
            ss.skill_id: ss for ss in (await db.execute(all_student_skills_stmt)).scalars().all()
        }

        # 4. Query prerequisite relations for these weak skills
        weak_skill_ids = [ss.skill_id for ss in student_skills]
        prereq_relations: list[SkillRelation] = []
        if weak_skill_ids:
            rel_stmt = (
                select(SkillRelation)
                .where(
                    SkillRelation.to_skill_id.in_(weak_skill_ids),
                    SkillRelation.relation_type == SkillRelationType.PREREQUISITE,
                )
                .options(
                    selectinload(SkillRelation.from_skill).selectinload(Skill.parent),
                    selectinload(SkillRelation.from_skill).selectinload(Skill.modalities),
                )
            )
            prereq_relations = list((await db.execute(rel_stmt)).scalars().all())

        # Map to_skill_id -> list of prerequisite Skills that are unmet
        unmet_prereqs_by_skill: dict[uuid.UUID, list[Skill]] = {}
        for rel in prereq_relations:
            if rel.from_skill is None or not rel.from_skill.is_active:
                continue
            if taxonomy_version_id is not None and rel.from_skill.taxonomy_version_id != taxonomy_version_id:
                continue

            prereq_ss = all_student_skills.get(rel.from_skill_id)
            # If prerequisite has not been assessed or has mastery < 70% or confidence < 0.35, it is unmet!
            if prereq_ss is None or prereq_ss.mastery_score < cls.MASTERY_THRESHOLD or prereq_ss.confidence < 0.35:
                unmet_prereqs_by_skill.setdefault(rel.to_skill_id, []).append(rel.from_skill)

        # 5. Query canonical SkillEvidence for weak skills and prerequisites
        all_relevant_skill_ids = set(weak_skill_ids)
        for p_list in unmet_prereqs_by_skill.values():
            for p in p_list:
                all_relevant_skill_ids.add(p.id)

        evidences_by_skill: dict[uuid.UUID, list[SkillEvidence]] = defaultdict(list)
        if all_relevant_skill_ids:
            ev_stmt = (
                select(SkillEvidence)
                .where(
                    SkillEvidence.student_id == user_id,
                    SkillEvidence.skill_id.in_(all_relevant_skill_ids),
                )
                .order_by(desc(SkillEvidence.observed_at))
            )
            for ev in (await db.execute(ev_stmt)).scalars().all():
                evidences_by_skill[ev.skill_id].append(ev)

        # 6. Query Mistakes for all relevant skills
        mistakes_by_skill: dict[uuid.UUID, int] = defaultdict(int)
        if all_relevant_skill_ids:
            m_stmt = (
                select(Mistake.skill_id, func.sum(Mistake.error_count))
                .where(
                    Mistake.user_id == user_id,
                    Mistake.skill_id.in_(all_relevant_skill_ids),
                )
                .group_by(Mistake.skill_id)
            )
            for row in (await db.execute(m_stmt)).all():
                if row[0] and row[1]:
                    mistakes_by_skill[row[0]] = int(row[1])

        # 7. Find exercises completed correctly in the last 48 hours to enforce cooldown
        recent_attempts_stmt = select(ExerciseAttempt.exercise_id).where(
            ExerciseAttempt.user_id == user_id,
            ExerciseAttempt.is_correct.is_(True),
            ExerciseAttempt.attempted_at >= cooldown_cutoff,
        )
        cooldown_exercise_ids = set((await db.execute(recent_attempts_stmt)).scalars().all())

        created_or_updated: list[Recommendation] = []
        handled_prereq_ids: set[uuid.UUID] = set()

        # 8. Process unmet prerequisite recommendations first (prerequisites take precedence)
        for ss in student_skills:
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
                        or_(
                            ExerciseSkill.skill_id == p_skill.id,
                            ExerciseSkill.subskill_id == p_skill.id,
                        ),
                        Exercise.is_published.is_(True),
                    )
                    .limit(3)
                )
                p_exercises = list((await db.execute(p_ex_stmt)).scalars().all())

                prereq_priority = min(100, 85 + len(p_exercises))
                prereq_reason = (
                    f"Prérequis prioritaire : La maîtrise de '{p_skill.name}' ({p_skill.code}) est requise "
                    f"avant d'aborder '{ss.skill.name if ss.skill else 'cette compétence'}'."
                )

                if p_exercises:
                    for p_ex in p_exercises:
                        if p_ex.id in cooldown_exercise_ids:
                            continue
                        existing_p_rec = await db.scalar(
                            select(Recommendation).where(
                                Recommendation.user_id == user_id,
                                Recommendation.entity_type == "exercise",
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
                else:
                    # Target prerequisite skill directly if no specific exercise is available
                    existing_skill_rec = await db.scalar(
                        select(Recommendation).where(
                            Recommendation.user_id == user_id,
                            Recommendation.entity_type == "prerequisite",
                            Recommendation.entity_id == p_skill.id,
                            Recommendation.status.in_(
                                [
                                    RecommendationStatus.ACTIVE,
                                    RecommendationStatus.PENDING,
                                    RecommendationStatus.STARTED,
                                ]
                            ),
                        )
                    )
                    if existing_skill_rec:
                        existing_skill_rec.priority = max(existing_skill_rec.priority, prereq_priority)
                        existing_skill_rec.reason = prereq_reason
                        existing_skill_rec.generated_at = now
                        existing_skill_rec.expires_at = expiry_date
                        created_or_updated.append(existing_skill_rec)
                    else:
                        new_p_rec = Recommendation(
                            user_id=user_id,
                            skill_id=p_skill.id,
                            recommendation_type=RecommendationType.REVIEW,
                            entity_type="prerequisite",
                            entity_id=p_skill.id,
                            reason=prereq_reason,
                            priority=prereq_priority,
                            status=RecommendationStatus.ACTIVE,
                            generated_at=now,
                            expires_at=expiry_date,
                        )
                        db.add(new_p_rec)
                        created_or_updated.append(new_p_rec)

        # 9. Process weak skills
        for ss in student_skills:
            evs = evidences_by_skill.get(ss.skill_id, [])
            obs_count = len(evs) if evs else ss.attempts_count
            mistakes_total = mistakes_by_skill.get(ss.skill_id, 0)

            # Build source breakdown
            sources_summary: dict[str, int] = defaultdict(int)
            for ev in evs:
                sources_summary[ev.source_type.strip().lower()] += 1

            modality_names = (
                [m.modality for m in ss.skill.modalities]
                if ss.skill and ss.skill.modalities
                else []
            )

            # Classify weakness state (Requirement 6 & 7)
            weakness_state, _ = cls.classify_weakness_state(
                observation_count=obs_count,
                confidence=ss.confidence,
                mastery_score=ss.mastery_score,
            )

            # Priority calculation based on evidence strength
            if weakness_state == "insufficient_evidence":
                # Do not generate strong recommendations from extremely weak evidence (Requirement 6)
                # Keep priority <= 45 and scale with confidence
                priority = max(10, min(45, int(ss.confidence * 40 + (100.0 - ss.mastery_score) * 0.15)))
            elif weakness_state == "emerging_weakness":
                target_gap = max(0.0, target_threshold - ss.mastery_score)
                base = 50 + int(target_gap * 0.3) + min(10, mistakes_total * 2)
                priority = max(45, min(70, base))
            else:  # confirmed_weakness
                target_gap = max(0.0, target_threshold - ss.mastery_score)
                priority = RecommendationEngine.calculate_priority(
                    mastery_score=ss.mastery_score,
                    mistake_count=mistakes_total,
                    target_gap=target_gap,
                    days_to_target=days_to_target,
                )

            # Evidence-backed reason (Requirement 9)
            reason = cls.build_evidence_backed_reason(
                skill_name=ss.skill.name if ss.skill else "Compétence",
                skill_code=ss.skill.code if ss.skill else "",
                weakness_state=weakness_state,
                observation_count=obs_count,
                mastery_score=ss.mastery_score,
                mistake_count=mistakes_total,
                sources_summary=sources_summary,
                target_level=target_level,
                target_threshold=target_threshold,
                modality_names=modality_names,
            )

            # 10. Search exercises hierarchically (direct skill -> parent -> children)
            target_skill_ids = [ss.skill_id]
            if ss.skill and ss.skill.parent_id:
                target_skill_ids.append(ss.skill.parent_id)
            if ss.skill and ss.skill.children:
                target_skill_ids.extend([c.id for c in ss.skill.children if c.is_active])

            exercises_stmt = (
                select(Exercise)
                .join(ExerciseSkill, ExerciseSkill.exercise_id == Exercise.id)
                .where(
                    or_(
                        ExerciseSkill.skill_id.in_(target_skill_ids),
                        ExerciseSkill.subskill_id.in_(target_skill_ids),
                    ),
                    Exercise.is_published.is_(True),
                )
                .limit(6)
            )
            matching_exercises = list((await db.execute(exercises_stmt)).scalars().all())

            if matching_exercises:
                for ex in matching_exercises:
                    if ex.id in cooldown_exercise_ids:
                        continue

                    existing_rec = await db.scalar(
                        select(Recommendation).where(
                            Recommendation.user_id == user_id,
                            Recommendation.entity_type == "exercise",
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
            else:
                # Target the competency directly if no exercises are mapped yet (Requirement 10)
                target_type = (
                    "subskill"
                    if ss.skill and ss.skill.parent_id
                    else ("parent_competency" if ss.skill and ss.skill.children else "skill")
                )
                existing_comp_rec = await db.scalar(
                    select(Recommendation).where(
                        Recommendation.user_id == user_id,
                        Recommendation.entity_type == target_type,
                        Recommendation.entity_id == ss.skill_id,
                        Recommendation.status.in_(
                            [
                                RecommendationStatus.ACTIVE,
                                RecommendationStatus.PENDING,
                                RecommendationStatus.STARTED,
                            ]
                        ),
                    )
                )
                if existing_comp_rec:
                    existing_comp_rec.priority = max(existing_comp_rec.priority, priority)
                    existing_comp_rec.reason = reason
                    existing_comp_rec.generated_at = now
                    existing_comp_rec.expires_at = expiry_date
                    created_or_updated.append(existing_comp_rec)
                else:
                    new_rec = Recommendation(
                        user_id=user_id,
                        skill_id=ss.skill_id,
                        recommendation_type=RecommendationType.REVIEW,
                        entity_type=target_type,
                        entity_id=ss.skill_id,
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
            .options(
                selectinload(Recommendation.skill).selectinload(Skill.modalities),
                selectinload(Recommendation.skill).selectinload(Skill.supported_task_types),
            )
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

        recs = list((await db.execute(stmt)).scalars().all())
        results: list[dict[str, Any]] = []

        # Batch-load CEFR descriptors for recommended skills
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

            level = (
                ex.level
                if ex and hasattr(ex, "level")
                else (r.skill.level if r.skill and hasattr(r.skill, "level") and r.skill.level else "B2")
            )
            difficulty = ex.difficulty if ex and hasattr(ex, "difficulty") else 3
            title = (
                ex.title
                if ex and hasattr(ex, "title")
                else (f"Révision : {r.skill.name}" if r.skill else "Activité de perfectionnement")
            )

            # Category resolution: avoid hardcoded fallbacks
            category_val: str | None = None
            if ex and ex.category:
                category_val = ex.category.value if hasattr(ex.category, "value") else str(ex.category)
            elif r.skill:
                if r.skill.domain:
                    category_val = r.skill.domain
                elif r.skill.modalities:
                    prim = next((m.modality for m in r.skill.modalities if m.is_primary), None)
                    category_val = prim or r.skill.modalities[0].modality
                elif r.skill.category:
                    category_val = (
                        r.skill.category.value
                        if hasattr(r.skill.category, "value")
                        else str(r.skill.category)
                    )

            descriptor = descriptors_map.get((r.skill_id, level.upper())) if r.skill_id else None
            evidence_guidance = (
                guidance_map.get((r.skill_id, level.upper())) if r.skill_id else None
            )

            applicable_modalities = (
                [m.modality for m in r.skill.modalities]
                if r.skill and hasattr(r.skill, "modalities") and r.skill.modalities
                else []
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
                    "applicable_modalities": applicable_modalities,
                    "recommendation_type": r.recommendation_type,
                    "entity_type": r.entity_type,
                    "entity_id": r.entity_id,
                    "title": title,
                    "category": category_val,
                    "level": level,
                    "difficulty": difficulty,
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
