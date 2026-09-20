"""API Router for TEF Readiness Estimation, Adaptive Learning, and Diagnostic Profiles."""

import datetime
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.modules.assessments.models import Skill
from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.learning.daily_plan import DailyPlanService
from app.modules.learning.models import (
    ReadinessBand,
    ReadinessProfile,
    ReadinessSnapshot,
    SkillEvidence,
)
from app.modules.learning.readiness_engine import ReadinessEngine
from app.modules.learning.readiness_schemas import (
    AdminReadinessStatsResponse,
    BlockingSkillResponse,
    DailyPlanV2Response,
    LearningPathMilestoneResponse,
    LearningPathResponse,
    ReadinessProfileResponse,
    ReadinessSnapshotResponse,
    ReassessmentRecommendationResponse,
    SkillEstimateResponse,
    SkillEvidenceResponse,
    SkillTrendResponse,
    TargetGapResponse,
)
from app.modules.learning.reassessment_engine import ReassessmentEngine
from app.modules.users.models import StudentProfile, User, UserRole

student_readiness_router = APIRouter(prefix="/students/me", tags=["Student Readiness"])
admin_readiness_router = APIRouter(prefix="/admin/readiness", tags=["Admin Readiness"])


@student_readiness_router.get(
    "/readiness",
    response_model=ReadinessProfileResponse,
    summary="Get current student readiness profile",
)
async def get_my_readiness(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReadinessProfileResponse:
    """Retrieve the student's authoritative readiness estimate, confidence, and target gap summary."""
    profile = await db.scalar(
        select(ReadinessProfile).where(ReadinessProfile.student_id == current_user.id)
    )
    if not profile:
        profile = await ReadinessEngine.recalculate_student_readiness(db, current_user.id)

    # Days remaining calculation
    days_remaining = None
    urgency = "none"
    if profile.target_date:
        today = datetime.datetime.now(datetime.UTC).date()
        days_remaining = (profile.target_date - today).days
        if days_remaining < 0:
            urgency = "overdue"
        elif days_remaining <= 14:
            urgency = "critical"
        elif days_remaining <= 30:
            urgency = "urgent"
        else:
            urgency = "normal"

    band_val = (
        profile.readiness_band.value
        if hasattr(profile.readiness_band, "value")
        else str(profile.readiness_band)
    )

    return ReadinessProfileResponse(
        student_id=profile.student_id,
        target_exam=profile.target_exam,
        target_level=profile.target_level,
        target_date=profile.target_date.isoformat() if profile.target_date else None,
        days_remaining=days_remaining,
        urgency=urgency,
        overall_estimate=profile.overall_estimate,
        estimated_level=profile.estimated_level,
        confidence=profile.confidence,
        confidence_label=profile.confidence_label,
        readiness_band=band_val,
        summary_skills=profile.summary_skills or {},
        summary_gaps=profile.summary_gaps or [],
        summary_blockers=profile.summary_blockers or [],
        last_calculated_at=profile.last_calculated_at,
        calculation_version=profile.calculation_version,
    )


@student_readiness_router.post(
    "/readiness/recalculate",
    response_model=ReadinessProfileResponse,
    summary="Trigger on-demand student readiness recalculation",
)
async def recalculate_my_readiness(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReadinessProfileResponse:
    """Manually trigger recalculation of student readiness profile, creating a new snapshot."""
    await ReadinessEngine.recalculate_student_readiness(db, current_user.id)
    return await get_my_readiness(current_user=current_user, db=db)


@student_readiness_router.get(
    "/readiness/skills",
    response_model=list[SkillEstimateResponse],
    summary="Get estimated mastery per linguistic skill",
)
async def get_my_readiness_skills(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SkillEstimateResponse]:
    """Retrieve detailed estimates, confidences, observation sources, and explanations for each skill."""
    profile = await db.scalar(
        select(ReadinessProfile).where(ReadinessProfile.student_id == current_user.id)
    )
    if not profile:
        profile = await ReadinessEngine.recalculate_student_readiness(db, current_user.id)

    all_skills = (await db.execute(select(Skill))).scalars().all()

    evidences = (
        (
            await db.execute(
                select(SkillEvidence)
                .where(SkillEvidence.student_id == current_user.id)
                .order_by(SkillEvidence.observed_at.desc())
            )
        )
        .scalars()
        .all()
    )
    ev_by_skill: dict[uuid.UUID, list[SkillEvidence]] = {}
    for ev in evidences:
        ev_by_skill.setdefault(ev.skill_id, []).append(ev)

    results: list[SkillEstimateResponse] = []
    summary_skills = profile.summary_skills or {}

    for s in all_skills:
        skill_str_id = str(s.id)
        cached_data = summary_skills.get(skill_str_id, {})
        skill_evs = ev_by_skill.get(s.id, [])

        trend_data = ReadinessEngine.calculate_trends_and_velocity(skill_evs)
        cat = s.category.value if s.category and hasattr(s.category, "value") else str(s.category or "general")

        last_obs = None
        if cached_data.get("last_observed_at"):
            try:
                last_obs = datetime.datetime.fromisoformat(cached_data["last_observed_at"])
            except Exception:
                pass

        results.append(
            SkillEstimateResponse(
                skill_id=s.id,
                skill_code=s.code,
                skill_name=s.name,
                category=cat,
                estimate=cached_data.get("estimate"),
                estimated_level=cached_data.get("estimated_level"),
                confidence=cached_data.get("confidence", 0.0),
                confidence_label=cached_data.get("confidence_label", "insufficient_data"),
                insufficient_data=cached_data.get("insufficient_data", True),
                observation_count=len(skill_evs),
                trend=trend_data["trend_30d"],
                last_observed_at=last_obs,
                sources_summary=cached_data.get("sources_summary", {}),
                explanation=cached_data.get(
                    "explanation",
                    "Données insuffisantes. Complétez des entraînements pour calibrer.",
                ),
            )
        )

    return results


@student_readiness_router.get(
    "/readiness/gaps",
    response_model=list[TargetGapResponse],
    summary="Get target gap analysis per skill",
)
async def get_my_target_gaps(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TargetGapResponse]:
    """Retrieve prioritized deficit ranking between current mastery and target thresholds."""
    profile = await db.scalar(
        select(ReadinessProfile).where(ReadinessProfile.student_id == current_user.id)
    )
    if not profile:
        profile = await ReadinessEngine.recalculate_student_readiness(db, current_user.id)

    raw_gaps = profile.summary_gaps or []
    results: list[TargetGapResponse] = []

    for g in raw_gaps:
        s_id = uuid.UUID(g["skill_id"]) if isinstance(g["skill_id"], str) else g["skill_id"]
        results.append(
            TargetGapResponse(
                skill_id=s_id,
                skill_name=g.get("skill_name", "Compétence"),
                category=g.get("category", "general"),
                current_estimate=g.get("current_estimate"),
                target_estimate=g.get("target_estimate", 65.0),
                gap=g.get("gap", 0.0),
                confidence=g.get("confidence", 0.0),
                priority=g.get("priority", 50),
                urgency=g.get("urgency", "normal"),
                explanation=g.get("explanation", ""),
            )
        )

    results.sort(key=lambda x: x.priority, reverse=True)
    return results


@student_readiness_router.get(
    "/readiness/blockers",
    response_model=list[BlockingSkillResponse],
    summary="Get blocking skills materially limiting progress",
)
async def get_my_blocking_skills(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BlockingSkillResponse]:
    """Identify competencies with sufficient observation data and material deficits limiting target achievement."""
    profile = await db.scalar(
        select(ReadinessProfile).where(ReadinessProfile.student_id == current_user.id)
    )
    if not profile:
        profile = await ReadinessEngine.recalculate_student_readiness(db, current_user.id)

    raw_blockers = profile.summary_blockers or []
    results: list[BlockingSkillResponse] = []

    for b in raw_blockers:
        s_id = uuid.UUID(b["skill_id"]) if isinstance(b["skill_id"], str) else b["skill_id"]
        results.append(
            BlockingSkillResponse(
                skill_id=s_id,
                skill_name=b.get("skill_name", "Compétence bloquante"),
                category=b.get("category", "general"),
                current_estimate=b.get("current_estimate"),
                target_estimate=b.get("target_estimate", 65.0),
                gap=b.get("gap", 0.0),
                confidence=b.get("confidence", 0.0),
                priority=b.get("priority", 80),
                blocker_reason=b.get("blocker_reason", ""),
                recommended_action=b.get("recommended_action", ""),
            )
        )

    return results


@student_readiness_router.get(
    "/readiness/trends",
    response_model=list[SkillTrendResponse],
    summary="Get multi-window progression trends and learning velocity",
)
async def get_my_skill_trends(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SkillTrendResponse]:
    """Calculate progression trends across 7d, 30d, 90d, all-time, and safe score change velocity."""
    all_skills = (await db.execute(select(Skill))).scalars().all()

    evidences = (
        (
            await db.execute(
                select(SkillEvidence)
                .where(SkillEvidence.student_id == current_user.id)
                .order_by(SkillEvidence.observed_at.asc())
            )
        )
        .scalars()
        .all()
    )
    ev_by_skill: dict[uuid.UUID, list[SkillEvidence]] = {}
    for ev in evidences:
        ev_by_skill.setdefault(ev.skill_id, []).append(ev)

    results: list[SkillTrendResponse] = []
    for s in all_skills:
        skill_evs = ev_by_skill.get(s.id, [])
        cat = s.category.value if s.category and hasattr(s.category, "value") else str(s.category or "general")
        trend_calc = ReadinessEngine.calculate_trends_and_velocity(skill_evs)

        results.append(
            SkillTrendResponse(
                skill_id=s.id,
                skill_name=s.name,
                category=cat,
                trend_7d=trend_calc["trend_7d"],
                trend_30d=trend_calc["trend_30d"],
                trend_90d=trend_calc["trend_90d"],
                trend_all_time=trend_calc["trend_all_time"],
                score_change_per_week=trend_calc["score_change_per_week"],
                level_change_estimate=trend_calc["level_change_estimate"],
                data_points_count=trend_calc["data_points_count"],
                sufficient_data_for_velocity=trend_calc["sufficient_data_for_velocity"],
            )
        )

    return results


@student_readiness_router.get(
    "/readiness/evidence",
    response_model=list[SkillEvidenceResponse],
    summary="Get paginated append-only evidence records",
)
async def get_my_evidence_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    skill_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SkillEvidenceResponse]:
    """Retrieve immutable historical evaluation evidence points."""
    stmt = (
        select(SkillEvidence)
        .where(SkillEvidence.student_id == current_user.id)
        .options(selectinload(SkillEvidence.skill))
        .order_by(desc(SkillEvidence.observed_at))
    )
    if skill_id:
        stmt = stmt.where(SkillEvidence.skill_id == skill_id)

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    evidences = (await db.execute(stmt)).scalars().all()

    return [
        SkillEvidenceResponse(
            id=ev.id,
            skill_id=ev.skill_id,
            skill_name=ev.skill.name if ev.skill else "Compétence",
            source_type=ev.source_type,
            source_id=ev.source_id,
            raw_score=ev.raw_score,
            normalized_score=ev.normalized_score,
            confidence=ev.confidence,
            weight=ev.weight,
            observed_at=ev.observed_at,
            calculation_version=ev.calculation_version,
        )
        for ev in evidences
    ]


@student_readiness_router.get(
    "/readiness/history",
    response_model=list[ReadinessSnapshotResponse],
    summary="Get paginated historical calculation snapshots",
)
async def get_my_readiness_snapshots(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ReadinessSnapshotResponse]:
    """Retrieve immutable historical readiness calculation snapshots."""
    stmt = (
        select(ReadinessSnapshot)
        .where(ReadinessSnapshot.student_id == current_user.id)
        .order_by(desc(ReadinessSnapshot.generated_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    snapshots = (await db.execute(stmt)).scalars().all()

    return [
        ReadinessSnapshotResponse(
            id=snap.id,
            overall_estimate=snap.overall_estimate,
            estimated_level=snap.estimated_level,
            confidence=snap.confidence,
            confidence_label=snap.confidence_label,
            readiness_band=snap.readiness_band,
            calculation_version=snap.calculation_version,
            generated_at=snap.generated_at,
            skills_count=len(snap.skills) if snap.skills else 0,
            blockers_count=len(snap.blockers) if snap.blockers else 0,
        )
        for snap in snapshots
    ]


@student_readiness_router.get(
    "/learning-path",
    response_model=LearningPathResponse,
    summary="Get personalized adaptive learning path toward target",
)
async def get_my_learning_path(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LearningPathResponse:
    """Generate adaptive milestone roadmap derived from student evidence and blocking skills."""
    profile = await db.scalar(
        select(ReadinessProfile).where(ReadinessProfile.student_id == current_user.id)
    )
    if not profile:
        profile = await ReadinessEngine.recalculate_student_readiness(db, current_user.id)

    target_level = profile.target_level or "B2"
    current_level = profile.estimated_level or "A1"
    band_val = (
        profile.readiness_band.value
        if hasattr(profile.readiness_band, "value")
        else str(profile.readiness_band)
    )

    blockers = profile.summary_blockers or []
    blocker_names = [b.get("skill_name", "Compétence") for b in blockers]

    milestones: list[LearningPathMilestoneResponse] = [
        LearningPathMilestoneResponse(
            milestone_number=1,
            title="Calibrage & Fondations structurales",
            description="Établissement du profil initial et renforcement de la grammaire/conjugaison essentielle.",
            focus_skills=["Grammaire et Syntaxe", "Conjugaison et Modes"],
            suggested_activities=[{"type": "exercise", "title": "Pronoms relatifs et subjonctif"}],
            is_completed=profile.readiness_band != ReadinessBand.INSUFFICIENT_DATA,
        ),
        LearningPathMilestoneResponse(
            milestone_number=2,
            title="Consolidation des compétences bloquantes",
            description=f"Levée active des freins majeurs identifiés : {', '.join(blocker_names) if blocker_names else 'Compétences clés'}.",
            focus_skills=blocker_names if blocker_names else ["Compréhension écrite", "Compréhension orale"],
            suggested_activities=[{"type": "exercise", "title": "Entraînements ciblés de remédiation"}],
            is_completed=band_val in ["progressing", "near_target", "target_consistent"],
        ),
        LearningPathMilestoneResponse(
            milestone_number=3,
            title="Pratique active & Fluidité d'expression",
            description="Simulations d'expression écrite et ateliers oraux chronométrés.",
            focus_skills=["Expression écrite", "Expression orale"],
            suggested_activities=[
                {"type": "writing", "title": "Épreuve d'expression écrite Section A/B"},
                {"type": "speaking", "title": "Atelier oral avec tuteur ou IA"},
            ],
            is_completed=band_val in ["near_target", "target_consistent"],
        ),
        LearningPathMilestoneResponse(
            milestone_number=4,
            title="Simulations formatives en condition réelle",
            description="Épreuves blanches complètes pour stabiliser la performance au seuil cible.",
            focus_skills=["Compréhension globale", "Gestion du temps"],
            suggested_activities=[{"type": "assessment", "title": "Simulation complète TEF Canada"}],
            is_completed=band_val == "target_consistent",
        ),
    ]

    return LearningPathResponse(
        target_exam=profile.target_exam,
        target_level=target_level,
        current_estimated_level=current_level,
        readiness_band=band_val,
        milestones=milestones,
        generated_at=datetime.datetime.now(datetime.UTC),
    )


@student_readiness_router.get(
    "/daily-plan",
    response_model=DailyPlanV2Response,
    summary="Get personalized time-budgeted daily study plan",
)
async def get_my_daily_plan(
    minutes: int | None = Query(None, ge=15, le=60, description="Override available study minutes"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DailyPlanV2Response:
    """Generate daily learning plan strictly bounded by student time budget (15, 30, 45, 60 min)."""
    raw_plan = await DailyPlanService.get_daily_plan(db, current_user.id, budget_override=minutes)

    tasks = [
        {
            "id": t["id"],
            "title": t["title"],
            "description": t["description"],
            "task_type": t["task_type"],
            "target_entity_id": t.get("target_entity_id"),
            "skill_name": t.get("skill_name", "Compétence"),
            "estimated_minutes": t["estimated_minutes"],
            "priority": t["priority"],
            "is_completed": t["is_completed"],
        }
        for t in raw_plan["tasks"]
    ]

    return DailyPlanV2Response(
        daily_minutes_available=raw_plan["daily_minutes_available"],
        total_estimated_minutes=raw_plan["total_estimated_minutes"],
        tasks=tasks,
        completed_count=raw_plan["completed_tasks"],
        total_count=raw_plan["total_tasks"],
        date=raw_plan["date"],
    )


class DailyBudgetUpdateRequest(BaseModel):
    daily_minutes_available: int = Field(..., ge=15, le=60)


@student_readiness_router.put(
    "/daily-plan/budget",
    summary="Update student daily available minutes budget",
)
async def update_my_daily_budget(
    payload: DailyBudgetUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Persist student's daily study time constraint in their profile."""
    profile = await db.scalar(
        select(StudentProfile).where(StudentProfile.user_id == current_user.id)
    )
    if profile:
        profile.daily_minutes_available = payload.daily_minutes_available
    else:
        profile = StudentProfile(
            user_id=current_user.id,
            daily_minutes_available=payload.daily_minutes_available,
        )
        db.add(profile)
    await db.commit()
    return {
        "message": "Daily study budget updated successfully",
        "daily_minutes_budget": payload.daily_minutes_available,
    }


@student_readiness_router.get(
    "/readiness/reassessment",
    response_model=ReassessmentRecommendationResponse,
    summary="Get reassessment status and recommendation",
)
@student_readiness_router.post(
    "/readiness/reassessment",
    response_model=ReassessmentRecommendationResponse,
    summary="Evaluate reassessment readiness trigger",
)
@student_readiness_router.get(
    "/reassessment",
    response_model=ReassessmentRecommendationResponse,
    summary="Get reassessment readiness trigger",
)
@student_readiness_router.post(
    "/reassessment",
    response_model=ReassessmentRecommendationResponse,
    summary="Evaluate reassessment readiness trigger",
)
async def evaluate_reassessment_trigger(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReassessmentRecommendationResponse:
    """Check if the student has sufficient practice evidence to warrant a reassessment."""
    reassessment_data = await ReassessmentEngine.evaluate_reassessment_need(db, current_user.id)
    return ReassessmentRecommendationResponse(**reassessment_data)


# =====================================================================
# ADMIN / ANALYTICS ENDPOINTS (RBAC Restricted to Admin Role)
# =====================================================================


@admin_readiness_router.get(
    "/stats",
    response_model=AdminReadinessStatsResponse,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
    summary="Get platform-wide readiness metrics and algorithmic health",
)
async def get_admin_readiness_stats(
    db: AsyncSession = Depends(get_db),
) -> AdminReadinessStatsResponse:
    """Administrative analytics on readiness calculation distributions and evidence counts."""
    profiles = (await db.execute(select(ReadinessProfile))).scalars().all()
    total_profiles = len(profiles)

    band_counts: dict[str, int] = {
        "insufficient_data": 0,
        "developing": 0,
        "progressing": 0,
        "near_target": 0,
        "target_consistent": 0,
    }
    total_conf = 0.0

    for p in profiles:
        band_str = p.readiness_band.value if hasattr(p.readiness_band, "value") else str(p.readiness_band)
        band_counts[band_str] = band_counts.get(band_str, 0) + 1
        total_conf += p.confidence

    total_evidences = (await db.scalar(select(func.count(SkillEvidence.id)))) or 0
    insufficient_count = band_counts["insufficient_data"]
    insufficient_rate = round((insufficient_count / total_profiles) * 100.0, 1) if total_profiles > 0 else 0.0
    avg_ev = round(total_evidences / total_profiles, 1) if total_profiles > 0 else 0.0
    avg_conf = round(total_conf / total_profiles, 2) if total_profiles > 0 else 0.0

    return AdminReadinessStatsResponse(
        calculation_version=ReadinessEngine.CALCULATION_VERSION,
        total_profiles=total_profiles,
        insufficient_data_count=insufficient_count,
        insufficient_data_rate=insufficient_rate,
        developing_count=band_counts["developing"],
        progressing_count=band_counts["progressing"],
        near_target_count=band_counts["near_target"],
        target_consistent_count=band_counts["target_consistent"],
        total_evidence_records=total_evidences,
        average_evidence_per_student=avg_ev,
        average_confidence=avg_conf,
    )
