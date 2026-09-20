"""Deterministic calculation engine for TEF Readiness Estimation and Skill Profile Analytics.

Strictly deterministic and unit-testable. No LLM as mathematical authority.
Maintains calculation_version for full historical reproducibility.
"""

import datetime
import math
import statistics
import time
import uuid
from typing import Any, ClassVar

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.metrics import metrics
from app.modules.assessments.models import Skill
from app.modules.learning.assessment_mapping import default_mapping_provider
from app.modules.learning.enums import SkillCategory
from app.modules.learning.levels import LevelEstimationService
from app.modules.learning.models import (
    Mistake,
    ReadinessBand,
    ReadinessProfile,
    ReadinessSnapshot,
    SkillEvidence,
    SkillTrendState,
)
from app.modules.users.models import StudentProfile, User


class ReadinessEngine:
    """Core domain engine computing skill mastery, confidence, target gaps,

    blocking competencies, progression velocity, and overall readiness.
    """

    CALCULATION_VERSION = "v2.0.0"

    # Exponential time-decay half-life: 45 days
    HALF_LIFE_DAYS = 45.0
    DECAY_LAMBDA = math.log(2.0) / HALF_LIFE_DAYS

    # Configurable source weights
    SOURCE_WEIGHTS: ClassVar[dict[str, float]] = {
        "assessment": 1.0,
        "teacher_evaluation": 0.95,
        "ai_evaluation": 0.85,
        "exercise": 0.70,
        "practice": 0.60,
    }

    # Minimum observations required to exit 'insufficient_data' state
    MIN_OBSERVATIONS_FOR_ESTIMATE = 2
    MIN_CONFIDENCE_THRESHOLD = 0.35

    # Core TEF evaluation pillars (Reading, Listening, Writing, Speaking)
    CORE_CATEGORIES: ClassVar[set[str]] = {
        SkillCategory.READING.value,
        SkillCategory.LISTENING.value,
        SkillCategory.WRITING.value,
        SkillCategory.SPEAKING.value,
    }

    @classmethod
    def get_source_weight(cls, source_type: str) -> float:
        """Resolve weight for a given evidence source type."""
        norm = source_type.strip().lower()
        return cls.SOURCE_WEIGHTS.get(norm, 0.70)

    @classmethod
    def calculate_recency_weight(cls, days_ago: float) -> float:
        """Calculate exponential time-decay weight."""
        delta = max(0.0, float(days_ago))
        return math.exp(-cls.DECAY_LAMBDA * delta)

    @classmethod
    def calculate_skill_confidence(
        cls,
        observation_count: int,
        source_types: set[str],
        scores: list[float],
        days_since_last: float = 0.0,
    ) -> tuple[float, str, bool]:
        """Compute calibrated confidence score [0.0, 1.0], label, and insufficient_data flag.

        Confidence is strictly separated from performance.
        Inputs: observation count, source diversity, score consistency, recency, source quality.
        """
        if observation_count == 0:
            return 0.0, "insufficient_data", True

        # 1. Observation sample count confidence (caps at 0.50 at 5 observations)
        sample_conf = min(0.50, observation_count * 0.10)

        # 2. Source diversity bonus (+0.15 for 2 types, +0.25 for 3+ types)
        diversity_bonus = 0.0
        num_sources = len(source_types)
        if num_sources >= 3:
            diversity_bonus = 0.25
        elif num_sources >= 2:
            diversity_bonus = 0.15

        # 3. Consistency factor based on standard deviation (V2: variance penalty)
        consistency_factor = 0.0
        if len(scores) >= 2:
            try:
                stdev = statistics.stdev(scores)
                if stdev <= 10.0:
                    consistency_factor = 0.15
                elif stdev <= 18.0:
                    consistency_factor = 0.05
                elif stdev > 25.0:
                    # V2: Explicit variance penalty for contradictory scores prevents overconfidence
                    consistency_factor = -0.15
            except Exception:
                consistency_factor = 0.0

        # 4. Recency factor
        recency_factor = 0.0
        if days_since_last <= 14.0:
            recency_factor = 0.10
        elif days_since_last > 30.0:
            weeks_stale = (days_since_last - 30.0) / 7.0
            recency_factor = -min(0.25, weeks_stale * 0.02)

        # 5. High-trust source presence bonus
        high_trust_bonus = 0.0
        if "assessment" in source_types or "teacher_evaluation" in source_types:
            high_trust_bonus = 0.10

        total_conf = sample_conf + diversity_bonus + consistency_factor + recency_factor + high_trust_bonus
        confidence = round(max(0.0, min(1.0, total_conf)), 2)

        insufficient_data = (
            observation_count < cls.MIN_OBSERVATIONS_FOR_ESTIMATE
            or confidence < cls.MIN_CONFIDENCE_THRESHOLD
        )

        if insufficient_data:
            label = "insufficient_data"
        elif confidence >= 0.70:
            label = "high"
        elif confidence >= 0.45:
            label = "medium"
        else:
            label = "low"

        return confidence, label, insufficient_data

    @classmethod
    def calculate_skill_estimate(
        cls,
        evidences: list[SkillEvidence],
        now: datetime.datetime | None = None,
    ) -> dict[str, Any]:
        """Aggregate skill estimate from immutable append-only SkillEvidence records."""
        now = now or datetime.datetime.now(datetime.UTC)

        if not evidences:
            return {
                "estimate": None,
                "estimated_level": None,
                "confidence": 0.0,
                "confidence_label": "insufficient_data",
                "insufficient_data": True,
                "observation_count": 0,
                "sources_summary": {},
                "last_observed_at": None,
                "explanation": "Aucune observation enregistrée pour cette compétence.",
            }

        def _to_utc(dt: datetime.datetime) -> datetime.datetime:
            return dt if dt.tzinfo else dt.replace(tzinfo=datetime.UTC)

        now_dt = _to_utc(now)
        weighted_sum = 0.0
        total_weight = 0.0
        source_types: set[str] = set()
        sources_summary: dict[str, int] = {}
        scores: list[float] = []
        latest_observed_at = evidences[0].observed_at

        for ev in evidences:
            score = max(0.0, min(100.0, float(ev.normalized_score)))
            scores.append(score)
            src = ev.source_type.strip().lower()
            source_types.add(src)
            sources_summary[src] = sources_summary.get(src, 0) + 1

            if _to_utc(ev.observed_at) > _to_utc(latest_observed_at):
                latest_observed_at = ev.observed_at

            # Time decay
            obs_dt = _to_utc(ev.observed_at)
            days_ago = max(0.0, (now_dt - obs_dt).total_seconds() / 86400.0)

            src_weight = cls.get_source_weight(src)
            rec_weight = cls.calculate_recency_weight(days_ago)
            eff_weight = src_weight * rec_weight * max(0.1, ev.confidence) * max(0.1, ev.weight)

            weighted_sum += eff_weight * score
            total_weight += eff_weight

        days_since_last = max(0.0, (now_dt - _to_utc(latest_observed_at)).total_seconds() / 86400.0)
        confidence, conf_label, insufficient_data = cls.calculate_skill_confidence(
            observation_count=len(evidences),
            source_types=source_types,
            scores=scores,
            days_since_last=days_since_last,
        )

        estimate = round(weighted_sum / total_weight, 1) if total_weight > 0 else None
        if estimate is not None:
            estimate = max(0.0, min(100.0, estimate))

        estimated_level = (
            default_mapping_provider.map_score_to_estimate(estimate)["estimated_cefr"]
            if estimate is not None and not insufficient_data
            else None
        )

        # Build human-readable explainability summary
        src_parts = []
        if sources_summary.get("assessment"):
            src_parts.append(f"{sources_summary['assessment']} épreuve(s)")
        if sources_summary.get("teacher_evaluation"):
            src_parts.append(f"{sources_summary['teacher_evaluation']} avis enseignant")
        if sources_summary.get("ai_evaluation"):
            src_parts.append(f"{sources_summary['ai_evaluation']} évaluation(s) IA")
        if sources_summary.get("exercise"):
            src_parts.append(f"{sources_summary['exercise']} exercice(s)")
        if sources_summary.get("practice"):
            src_parts.append(f"{sources_summary['practice']} session(s) d'échange")

        if insufficient_data:
            explanation = (
                f"Données insuffisantes ({len(evidences)} observation(s)). "
                "Complétez des évaluations ciblées pour calibrer l'estimation."
            )
        else:
            explanation = f"Estimation basée sur : {', '.join(src_parts)}."

        return {
            "estimate": estimate,
            "estimated_level": estimated_level,
            "confidence": confidence,
            "confidence_label": conf_label,
            "insufficient_data": insufficient_data,
            "observation_count": len(evidences),
            "sources_summary": sources_summary,
            "last_observed_at": latest_observed_at,
            "explanation": explanation,
        }

    @classmethod
    def calculate_target_gap(
        cls,
        skill_id: uuid.UUID | str,
        skill_name: str,
        category: str,
        current_estimate: float | None,
        confidence: float,
        target_level: str = "B2",
        days_remaining: int | None = None,
        mistake_count: int = 0,
    ) -> dict[str, Any]:
        """Compute target gap, urgency, and prioritized ranking."""
        target_threshold = default_mapping_provider.get_target_threshold(target_level)

        if current_estimate is None:
            gap = target_threshold
            explanation = f"Niveau non encore calibré pour {skill_name}. Seuil cible {target_level} : {target_threshold:.0f}%."
        else:
            gap = max(0.0, round(target_threshold - current_estimate, 1))
            if gap == 0.0:
                explanation = f"Maîtrise estimée conforme au seuil {target_level} ({current_estimate:.0f}%)."
            else:
                explanation = f"Écart de {gap:.0f} points par rapport au seuil cible {target_level} ({target_threshold:.0f}%)."

        # Urgency based on target date
        urgency = "none"
        urgency_multiplier = 1.0
        if days_remaining is not None:
            if days_remaining < 0:
                urgency = "overdue"
                urgency_multiplier = 1.3
            elif days_remaining <= 14:
                urgency = "critical"
                urgency_multiplier = 1.3
            elif days_remaining <= 30:
                urgency = "urgent"
                urgency_multiplier = 1.15
            else:
                urgency = "normal"

        # Core skills have higher weight in prioritization
        is_core = category in cls.CORE_CATEGORIES
        core_multiplier = 1.4 if is_core else 1.0

        # Prioritization formula: (gap * 0.5) * core_mult * urgency_mult + (mistakes * 2)
        base_priority = (gap * 0.6) * core_multiplier * urgency_multiplier + min(15.0, mistake_count * 3.0)
        # Prioritize confident gaps over purely unobserved ones
        if confidence >= cls.MIN_CONFIDENCE_THRESHOLD:
            base_priority += 10.0

        priority = max(1, min(100, int(round(base_priority))))

        return {
            "skill_id": str(skill_id),
            "skill_name": skill_name,
            "category": category,
            "current_estimate": current_estimate,
            "target_estimate": target_threshold,
            "gap": gap,
            "confidence": confidence,
            "priority": priority,
            "urgency": urgency,
            "explanation": explanation,
        }

    @classmethod
    def identify_blocking_skills(
        cls,
        gaps: list[dict[str, Any]],
        min_gap_threshold: float = 10.0,
    ) -> list[dict[str, Any]]:
        """Identify competencies that materially limit student progress toward the target exam goal.

        Never identify a blocker from a single failed question or insufficient data.
        """
        blockers: list[dict[str, Any]] = []

        for g in gaps:
            # Rule 1: Must have sufficient confidence
            if g["confidence"] < cls.MIN_CONFIDENCE_THRESHOLD:
                continue

            # Rule 2: Material gap >= min_gap_threshold
            if g["gap"] >= min_gap_threshold:
                cat = g["category"]
                action = (
                    f"Prioriser les entraînements en {g['skill_name']} "
                    f"pour combler le déficit de {g['gap']:.0f} pts."
                )
                reason = (
                    f"Votre niveau estimé ({g['current_estimate']:.0f}%) est inférieur de {g['gap']:.0f} pts "
                    f"au seuil attendu pour {g['target_estimate']:.0f}%."
                )

                blockers.append(
                    {
                        "skill_id": str(g["skill_id"]),
                        "skill_name": g["skill_name"],
                        "category": cat,
                        "current_estimate": g["current_estimate"],
                        "target_estimate": g["target_estimate"],
                        "gap": g["gap"],
                        "confidence": g["confidence"],
                        "priority": g["priority"],
                        "blocker_reason": reason,
                        "recommended_action": action,
                    }
                )

        # Sort by priority descending
        blockers.sort(key=lambda b: b["priority"], reverse=True)
        return blockers[:3]

    @classmethod
    def calculate_overall_readiness(
        cls,
        skills_summary: list[dict[str, Any]],
        target_level: str = "B2",
    ) -> tuple[float | None, str | None, float, str, ReadinessBand]:
        """Compute overall readiness score, CEFR estimate, confidence, and readiness band.

        Returns: (overall_estimate, estimated_level, confidence, confidence_label, readiness_band).
        """
        target_threshold = default_mapping_provider.get_target_threshold(target_level)

        # Separate core competencies and supporting skills
        core_skills = [
            s for s in skills_summary if s["category"] in cls.CORE_CATEGORIES and not s["insufficient_data"]
        ]
        supporting_skills = [
            s for s in skills_summary if s["category"] not in cls.CORE_CATEGORIES and not s["insufficient_data"]
        ]

        # Rule: Must have at least 2 core skills with sufficient evidence
        if len(core_skills) < 2:
            avg_conf = (
                round(sum(s["confidence"] for s in skills_summary) / len(skills_summary), 2)
                if skills_summary
                else 0.0
            )
            return None, None, avg_conf, "insufficient_data", ReadinessBand.INSUFFICIENT_DATA

        # Weighted calculation: 70% core competencies, 30% supporting skills
        core_avg = sum(s["estimate"] for s in core_skills) / len(core_skills)
        if supporting_skills:
            supp_avg = sum(s["estimate"] for s in supporting_skills) / len(supporting_skills)
            overall = 0.70 * core_avg + 0.30 * supp_avg
        else:
            overall = core_avg

        overall_estimate = round(max(0.0, min(100.0, overall)), 1)
        estimated_level = default_mapping_provider.map_score_to_estimate(overall_estimate)["estimated_cefr"]

        # Average confidence across evaluated skills
        all_evaluated = core_skills + supporting_skills
        avg_conf = round(sum(s["confidence"] for s in all_evaluated) / len(all_evaluated), 2)
        conf_label = "high" if avg_conf >= 0.70 else "medium" if avg_conf >= 0.45 else "low"

        # Determine controlled readiness band
        # Developing: overall < target - 20 (e.g. < 45 for B2)
        # Progressing: target - 20 <= overall < target - 8 (e.g. 45-57 for B2)
        # Near Target: target - 8 <= overall < target (e.g. 57-64.9 for B2)
        # Target Consistent: overall >= target
        if overall_estimate < (target_threshold - 20.0):
            band = ReadinessBand.DEVELOPING
        elif overall_estimate < (target_threshold - 8.0):
            band = ReadinessBand.PROGRESSING
        elif overall_estimate < target_threshold:
            band = ReadinessBand.NEAR_TARGET
        else:
            # Check if any core skill has a massive deficit (> 15 pts below target)
            has_major_deficit = any(s["estimate"] < (target_threshold - 15.0) for s in core_skills)
            band = ReadinessBand.NEAR_TARGET if has_major_deficit else ReadinessBand.TARGET_CONSISTENT

        return overall_estimate, estimated_level, avg_conf, conf_label, band

    @classmethod
    def calculate_trends_and_velocity(
        cls,
        evidences: list[SkillEvidence],
        now: datetime.datetime | None = None,
    ) -> dict[str, Any]:
        """Compute trends across 7d, 30d, 90d, all-time and safe learning progress velocity."""
        now = now or datetime.datetime.now(datetime.UTC)
        now_dt = now if now.tzinfo else now.replace(tzinfo=datetime.UTC)

        def get_window_trend(window_days: int | None) -> str:
            filtered = []
            for ev in evidences:
                obs_dt = ev.observed_at if ev.observed_at.tzinfo else ev.observed_at.replace(tzinfo=datetime.UTC)
                delta_d = (now_dt - obs_dt).total_seconds() / 86400.0
                if window_days is None or delta_d <= window_days:
                    filtered.append((obs_dt, ev.normalized_score))

            if len(filtered) < 2:
                return SkillTrendState.INSUFFICIENT_DATA.value

            filtered.sort(key=lambda x: x[0])
            first_half = filtered[: len(filtered) // 2]
            second_half = filtered[len(filtered) // 2 :]

            avg_first = sum(x[1] for x in first_half) / len(first_half)
            avg_second = sum(x[1] for x in second_half) / len(second_half)
            diff = avg_second - avg_first

            if diff >= 5.0:
                return SkillTrendState.IMPROVING.value
            if diff <= -5.0:
                return SkillTrendState.DECLINING.value
            return SkillTrendState.STABLE.value

        trend_7d = get_window_trend(7)
        trend_30d = get_window_trend(30)
        trend_90d = get_window_trend(90)
        trend_all_time = get_window_trend(None)

        # Progress velocity: only expose when span >= 14 days and >= 3 points
        score_change_per_week = None
        level_change_estimate = None
        sufficient_for_velocity = False

        if len(evidences) >= 3:
            sorted_ev = sorted(
                evidences,
                key=lambda x: x.observed_at if x.observed_at.tzinfo else x.observed_at.replace(tzinfo=datetime.UTC),
            )
            oldest_dt = sorted_ev[0].observed_at
            if not oldest_dt.tzinfo:
                oldest_dt = oldest_dt.replace(tzinfo=datetime.UTC)
            newest_dt = sorted_ev[-1].observed_at
            if not newest_dt.tzinfo:
                newest_dt = newest_dt.replace(tzinfo=datetime.UTC)

            span_days = (newest_dt - oldest_dt).total_seconds() / 86400.0
            if span_days >= 14.0:
                sufficient_for_velocity = True
                weeks = span_days / 7.0
                score_delta = sorted_ev[-1].normalized_score - sorted_ev[0].normalized_score
                score_change_per_week = round(score_delta / weeks, 1)

                if score_change_per_week >= 2.0:
                    level_change_estimate = "Progression rapide"
                elif score_change_per_week > 0.0:
                    level_change_estimate = "Progression régulière"
                elif score_change_per_week == 0.0:
                    level_change_estimate = "Niveau stable"
                else:
                    level_change_estimate = "Légère baisse observée"

        return {
            "trend_7d": trend_7d,
            "trend_30d": trend_30d,
            "trend_90d": trend_90d,
            "trend_all_time": trend_all_time,
            "score_change_per_week": score_change_per_week,
            "level_change_estimate": level_change_estimate,
            "data_points_count": len(evidences),
            "sufficient_data_for_velocity": sufficient_for_velocity,
        }

    @classmethod
    async def ingest_evidence(
        cls,
        db: AsyncSession,
        student_id: uuid.UUID,
        skill_id: uuid.UUID,
        source_type: str,
        source_id: uuid.UUID,
        raw_score: float,
        normalized_score: float,
        confidence: float = 1.0,
        weight: float = 1.0,
        observed_at: datetime.datetime | None = None,
        metadata_payload: dict[str, Any] | None = None,
    ) -> SkillEvidence | None:
        """Idempotently append an observation to the historical evidence stream."""
        observed_at = observed_at or datetime.datetime.now(datetime.UTC)

        # Idempotency check: unique (student_id, skill_id, source_type, source_id)
        existing = await db.scalar(
            select(SkillEvidence).where(
                SkillEvidence.student_id == student_id,
                SkillEvidence.skill_id == skill_id,
                SkillEvidence.source_type == source_type,
                SkillEvidence.source_id == source_id,
            )
        )
        if existing:
            return existing

        evidence = SkillEvidence(
            student_id=student_id,
            skill_id=skill_id,
            source_type=source_type,
            source_id=source_id,
            raw_score=round(float(raw_score), 2),
            normalized_score=round(max(0.0, min(100.0, float(normalized_score))), 2),
            confidence=round(max(0.0, min(1.0, float(confidence))), 2),
            weight=round(max(0.1, float(weight)), 2),
            observed_at=observed_at,
            calculation_version=cls.CALCULATION_VERSION,
            metadata_payload=metadata_payload or {},
        )
        db.add(evidence)
        await db.flush()
        return evidence

    @classmethod
    async def recalculate_student_readiness(
        cls,
        db: AsyncSession,
        student_id: uuid.UUID,
    ) -> ReadinessProfile:
        """Recalculate complete student readiness, update profile, and generate an immutable snapshot."""
        start_time = time.perf_counter()
        metrics.inc("readiness_calculation_started_total")
        try:
            now = datetime.datetime.now(datetime.UTC)

            # 1. Fetch student profile targets
            profile = await db.scalar(select(StudentProfile).where(StudentProfile.user_id == student_id))
            target_exam = profile.target_exam if profile else "TEF Canada"
            target_level = (
                (profile.target_cefr_level or profile.target_level)
                if profile and (profile.target_cefr_level or profile.target_level)
                else "B2"
            ).strip().upper()
            target_date = profile.target_date if profile else None

            days_remaining = None
            if target_date:
                days_remaining = (target_date - now.date()).days

            # 2. Fetch all skills
            all_skills = (await db.execute(select(Skill))).scalars().all()
            skills_by_id = {s.id: s for s in all_skills}

            # 3. Fetch student evidence grouped by skill
            evidences = (
                (
                    await db.execute(
                        select(SkillEvidence)
                        .where(SkillEvidence.student_id == student_id)
                        .order_by(SkillEvidence.observed_at.desc())
                    )
                )
                .scalars()
                .all()
            )

            ev_by_skill: dict[uuid.UUID, list[SkillEvidence]] = {}
            for ev in evidences:
                ev_by_skill.setdefault(ev.skill_id, []).append(ev)

            # 4. Fetch mistake counts per skill
            mistakes_stmt = (
                select(Mistake.skill_id, func.sum(Mistake.error_count))
                .where(Mistake.user_id == student_id)
                .group_by(Mistake.skill_id)
            )
            mistake_rows = (await db.execute(mistakes_stmt)).all()
            mistakes_by_skill = {row[0]: int(row[1]) for row in mistake_rows}

            # 5. Calculate skill estimates & target gaps
            skills_summary: list[dict[str, Any]] = []
            gaps: list[dict[str, Any]] = []

            for s in all_skills:
                skill_evs = ev_by_skill.get(s.id, [])
                estimate_data = cls.calculate_skill_estimate(skill_evs, now=now)
                cat = s.category.value if s.category and hasattr(s.category, "value") else str(s.category or "general")

                skill_entry = {
                    "skill_id": str(s.id),
                    "skill_code": s.code,
                    "skill_name": s.name,
                    "category": cat,
                    "estimate": estimate_data["estimate"],
                    "estimated_level": estimate_data["estimated_level"],
                    "confidence": estimate_data["confidence"],
                    "confidence_label": estimate_data["confidence_label"],
                    "insufficient_data": estimate_data["insufficient_data"],
                    "observation_count": estimate_data["observation_count"],
                    "last_observed_at": (
                        estimate_data["last_observed_at"].isoformat() if estimate_data["last_observed_at"] else None
                    ),
                    "explanation": estimate_data["explanation"],
                }
                skills_summary.append(skill_entry)

                # Target gap
                gap_data = cls.calculate_target_gap(
                    skill_id=str(s.id),
                    skill_name=s.name,
                    category=cat,
                    current_estimate=estimate_data["estimate"],
                    confidence=estimate_data["confidence"],
                    target_level=target_level,
                    days_remaining=days_remaining,
                    mistake_count=mistakes_by_skill.get(s.id, 0),
                )
                gaps.append(gap_data)

            # 6. Identify blocking competencies
            blockers = cls.identify_blocking_skills(gaps)

            # 7. Overall readiness & band
            overall, cefr, conf, conf_label, band = cls.calculate_overall_readiness(
                skills_summary=skills_summary,
                target_level=target_level,
            )

            # 8. Persist/Update ReadinessProfile
            readiness_profile = await db.scalar(
                select(ReadinessProfile).where(ReadinessProfile.student_id == student_id)
            )
            if not readiness_profile:
                readiness_profile = ReadinessProfile(
                    student_id=student_id,
                    target_exam=target_exam,
                    target_level=target_level,
                    target_date=target_date,
                    overall_estimate=overall,
                    estimated_level=cefr,
                    confidence=conf,
                    confidence_label=conf_label,
                    readiness_band=band,
                    summary_skills={str(s["skill_id"]): s for s in skills_summary},
                    summary_gaps=[
                        {**g, "skill_id": str(g["skill_id"])}
                        for g in gaps
                    ],
                    summary_blockers=[
                        {**b, "skill_id": str(b["skill_id"])}
                        for b in blockers
                    ],
                    last_calculated_at=now,
                    calculation_version=cls.CALCULATION_VERSION,
                )
                db.add(readiness_profile)
            else:
                readiness_profile.target_exam = target_exam
                readiness_profile.target_level = target_level
                readiness_profile.target_date = target_date
                readiness_profile.overall_estimate = overall
                readiness_profile.estimated_level = cefr
                readiness_profile.confidence = conf
                readiness_profile.confidence_label = conf_label
                readiness_profile.readiness_band = band
                readiness_profile.summary_skills = {str(s["skill_id"]): s for s in skills_summary}
                readiness_profile.summary_gaps = [
                    {**g, "skill_id": str(g["skill_id"])}
                    for g in gaps
                ]
                readiness_profile.summary_blockers = [
                    {**b, "skill_id": str(b["skill_id"])}
                    for b in blockers
                ]
                readiness_profile.last_calculated_at = now
                readiness_profile.calculation_version = cls.CALCULATION_VERSION

            # 9. Create immutable ReadinessSnapshot
            snapshot = ReadinessSnapshot(
                student_id=student_id,
                overall_estimate=overall,
                estimated_level=cefr,
                confidence=conf,
                confidence_label=conf_label,
                readiness_band=band.value if hasattr(band, "value") else str(band),
                skills={str(s["skill_id"]): s for s in skills_summary},
                gaps=[{**g, "skill_id": str(g["skill_id"])} for g in gaps],
                blockers=[{**b, "skill_id": str(b["skill_id"])} for b in blockers],
                recommendations=[],
                calculation_version=cls.CALCULATION_VERSION,
                generated_at=now,
            )
            db.add(snapshot)
            await db.commit()
            await db.refresh(readiness_profile)

            # Record success metrics
            duration = time.perf_counter() - start_time
            metrics.inc("readiness_calculation_completed_total")
            metrics.set_gauge("readiness_calculation_duration_seconds", round(duration, 4))
            if band == ReadinessBand.INSUFFICIENT_DATA:
                metrics.inc("readiness_insufficient_data_total")

            return readiness_profile
        except Exception:
            metrics.inc("readiness_calculation_failed_total")
            raise

