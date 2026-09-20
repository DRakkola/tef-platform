"""FastAPI Router for student endpoints: /api/v1/students."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.rate_limit import get_client_ip
from app.modules.auth.dependencies import require_role
from app.modules.learning.activity import ActivityTracker
from app.modules.learning.daily_plan import DailyPlanService
from app.modules.learning.levels import LevelEstimationService
from app.modules.learning.models import StudentSkill
from app.modules.learning.recommendations_v2 import RecommendationEngineV2
from app.modules.learning.schemas import (
    ActivityListResponse,
    DailyPlanResponse,
    RecommendationResponse,
    RecommendationStatusUpdateRequest,
    SkillAssessmentResponse,
    StrengthsWeaknessesResponse,
    StudentSkillResponse,
    TargetGapResponse,
    TargetUpdateRequest,
)
from app.modules.learning.service import LearningService
from app.modules.learning.strengths_weaknesses import StrengthsWeaknessesService
from app.modules.learning.targets import TargetGapService
from app.modules.students.dashboard_schemas import (
    StudentDashboardResponse,
    StudentProgressResponse,
)
from app.modules.students.dashboard_service import StudentDashboardService
from app.modules.students.privacy_schemas import (
    StudentDataExportResponse,
    StudentDeleteRequest,
    StudentDeleteResponse,
)
from app.modules.students.privacy_service import PrivacyService
from app.modules.analytics.enums import EventType
from app.modules.analytics.schemas import (
    OnboardingCompleteRequest,
    OnboardingStateResponse,
    OnboardingUpdateRequest,
)
from app.modules.analytics.service import AnalyticsService
from app.modules.users.models import StudentProfile, User, UserRole
from app.modules.users.schemas import StudentProfileResponse

router = APIRouter(prefix="/students", tags=["Students"])


@router.get(
    "/me",
    response_model=StudentProfileResponse,
    summary="Get current student profile",
)
async def get_my_student_profile(
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> StudentProfileResponse:
    """Retrieve student profile of currently authenticated student."""
    stmt = select(StudentProfile).where(StudentProfile.user_id == current_user.id)
    profile = (await db.execute(stmt)).scalar_one_or_none()

    if not profile:
        raise AppException(
            message="Student profile not found",
            code="PROFILE_NOT_FOUND",
            status_code=404,
        )

    return StudentProfileResponse.model_validate(profile)


@router.get(
    "/me/dashboard",
    response_model=StudentDashboardResponse,
    summary="Get aggregated student dashboard data",
)
async def get_my_dashboard(
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> StudentDashboardResponse:
    """Retrieve complete learning loop summary for student dashboard."""
    return await StudentDashboardService.get_dashboard(db, current_user)


@router.get(
    "/me/skills",
    response_model=list[StudentSkillResponse],
    summary="Get current student skill profile",
)
async def get_my_skills(
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[StudentSkillResponse]:
    """Retrieve all tracked skills and current mastery estimates for the authenticated student."""
    skills = await LearningService.get_student_skills(
        db=db,
        user_id=current_user.id,
    )
    return [StudentSkillResponse.model_validate(s) for s in skills]


@router.get(
    "/me/skills/{skill_id}",
    response_model=dict[str, Any],
    summary="Get detailed skill information with historical snapshots",
)
async def get_my_skill_detail(
    skill_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve detailed skill evaluation with full immutable historical snapshots."""
    student_skill = await db.scalar(
        select(StudentSkill)
        .where(
            StudentSkill.user_id == current_user.id,
            StudentSkill.skill_id == skill_id,
        )
        .options(selectinload(StudentSkill.skill))
    )
    history = await LearningService.get_skill_history(
        db=db,
        user_id=current_user.id,
        skill_id=skill_id,
    )

    if not student_skill:
        raise AppException(
            message="Skill not assessed yet for this student",
            code="SKILL_NOT_ASSESSED",
            status_code=404,
        )

    return {
        "skill_id": student_skill.skill_id,
        "skill_name": student_skill.skill.name if student_skill.skill else "",
        "skill_code": student_skill.skill.code if student_skill.skill else "",
        "category": (
            student_skill.skill.category.value
            if student_skill.skill and hasattr(student_skill.skill.category, "value")
            else "general"
        ),
        "mastery_score": round(student_skill.mastery_score, 1),
        "confidence": round(student_skill.confidence, 2),
        "attempts_count": student_skill.attempts_count,
        "successful_attempts": student_skill.successful_attempts,
        "estimated_level": student_skill.estimated_level or LevelEstimationService.estimate_cefr(student_skill.mastery_score),
        "last_assessed_at": student_skill.last_assessed_at,
        "history": [SkillAssessmentResponse.model_validate(h) for h in history],
        "disclaimer": LevelEstimationService.DISCLAIMER,
    }


@router.get(
    "/me/progress",
    response_model=StudentProgressResponse,
    summary="Get historical progress timeline and skill trajectories",
)
async def get_my_progress(
    range: str = Query("all", pattern="^(7d|30d|90d|all)$"),
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> StudentProgressResponse:
    """Retrieve historical measurement timeline and skill trajectories filtered by range."""
    return await StudentDashboardService.get_progress(db, current_user, time_range=range)


@router.get(
    "/me/weaknesses",
    response_model=StrengthsWeaknessesResponse,
    summary="Get strengths, weaknesses, and skill trajectories",
)
async def get_my_weaknesses(
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> StrengthsWeaknessesResponse:
    """Classify student competencies into strongest, weakest, improving, and declining."""
    data = await StrengthsWeaknessesService.analyze_skills(db, current_user.id)
    return StrengthsWeaknessesResponse.model_validate(data)


@router.get(
    "/me/recommendations",
    response_model=list[RecommendationResponse],
    summary="Get active personalized practice recommendations",
)
async def get_my_recommendations(
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[RecommendationResponse]:
    """List active personalized recommendations prioritized by gap, mistakes, and urgency."""
    recs = await RecommendationEngineV2.get_recommendations(db, current_user.id)
    return [RecommendationResponse.model_validate(r) for r in recs]


@router.patch(
    "/me/recommendations/{recommendation_id}",
    response_model=RecommendationResponse,
    summary="Update recommendation status (started, completed, dismissed)",
)
async def update_my_recommendation(
    recommendation_id: uuid.UUID,
    req: RecommendationStatusUpdateRequest,
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> RecommendationResponse:
    """Transition recommendation lifecycle state."""
    updated = await RecommendationEngineV2.update_status(
        db=db,
        recommendation_id=recommendation_id,
        user_id=current_user.id,
        new_status=req.status,
    )
    return RecommendationResponse.model_validate(updated)


@router.get(
    "/me/daily-plan",
    response_model=DailyPlanResponse,
    summary="Get personalized daily study plan",
)
async def get_my_daily_plan(
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> DailyPlanResponse:
    """Synthesize 3-4 daily practice tasks tailored to student weaknesses and track completion."""
    plan = await DailyPlanService.get_daily_plan(db, current_user.id)
    return DailyPlanResponse.model_validate(plan)


@router.get(
    "/me/activity",
    response_model=ActivityListResponse,
    summary="Get paginated student learning activity history",
)
async def get_my_activity(
    event_type: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ActivityListResponse:
    """Retrieve immutable activity timeline with strict privacy isolation."""
    activities = await ActivityTracker.get_student_activities(
        db=db,
        user_id=current_user.id,
        event_type=event_type,
        limit=limit,
        offset=offset,
    )
    return ActivityListResponse.model_validate(activities)


@router.get(
    "/me/target",
    response_model=TargetGapResponse,
    summary="Get current target gap and exam readiness analysis",
)
async def get_my_target_gap(
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> TargetGapResponse:
    """Analyze current score distance to target CEFR/NCLC level and exam date urgency."""
    gap = await TargetGapService.get_target_gap(db, current_user.id)
    return TargetGapResponse.model_validate(gap)


@router.put(
    "/me/target",
    response_model=TargetGapResponse,
    summary="Update target exam goals and exam date",
)
async def update_my_target(
    req: TargetUpdateRequest,
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> TargetGapResponse:
    """Update student target exam, target CEFR/NCLC level, and target exam date."""
    gap = await TargetGapService.update_target(
        db=db,
        user=current_user,
        target_exam=req.target_exam,
        target_cefr_level=req.target_cefr_level,
        target_nclc_level=req.target_nclc_level,
        target_date=req.target_date,
    )
    await ActivityTracker.record_activity(
        db=db,
        user_id=current_user.id,
        event_type="target_updated",
        title="Objectif mis à jour",
        metadata={
            "target_cefr": gap["target_cefr_level"],
            "target_date": gap["target_date"],
        },
    )
    return TargetGapResponse.model_validate(gap)


@router.delete(
    "/me",
    response_model=StudentDeleteResponse,
    summary="Permanently delete student account (GDPR Right to be Forgotten)",
)
async def delete_my_student_account(
    req: StudentDeleteRequest,
    request: Request,
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> StudentDeleteResponse:
    """Permanently anonymize student personal information, cancel upcoming bookings, and revoke access."""
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    return await PrivacyService.delete_student_account(
        db=db,
        current_user=current_user,
        password=req.password,
        reason=req.reason,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.post(
    "/me/export",
    response_model=StudentDataExportResponse,
    summary="Export all student personal data (GDPR Right to Data Portability)",
)
async def export_my_student_data(
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> StudentDataExportResponse:
    """Generate a structured machine-readable archive of all student data."""
    return await PrivacyService.export_student_data(
        db=db,
        current_user=current_user,
    )


@router.get(
    "/me/onboarding",
    response_model=OnboardingStateResponse,
    summary="Get current student onboarding progress",
)
async def get_my_onboarding_state(
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> OnboardingStateResponse:
    """Retrieves current onboarding step, status, and preferences."""
    profile = await db.scalar(
        select(StudentProfile).where(StudentProfile.user_id == current_user.id)
    )
    if not profile:
        raise AppException(message="Student profile not found", code="PROFILE_NOT_FOUND", status_code=404)

    return OnboardingStateResponse(
        onboarding_status=profile.onboarding_status or "incomplete",
        onboarding_step=profile.onboarding_step or 1,
        target_exam=profile.target_exam or "TEF Canada",
        target_level=profile.target_level or "B2",
        target_date=profile.target_date.isoformat() if profile.target_date else None,
        daily_minutes_available=profile.daily_minutes_available or 30,
        timezone=profile.timezone or "UTC",
        native_language=profile.native_language,
        learning_preferences=profile.learning_preferences or {},
    )


@router.put(
    "/me/onboarding",
    response_model=OnboardingStateResponse,
    summary="Update student onboarding preferences and step progress",
)
async def update_my_onboarding_state(
    req: OnboardingUpdateRequest,
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> OnboardingStateResponse:
    """Updates onboarding step and diagnostic preferences."""
    profile = await db.scalar(
        select(StudentProfile).where(StudentProfile.user_id == current_user.id)
    )
    if not profile:
        raise AppException(message="Student profile not found", code="PROFILE_NOT_FOUND", status_code=404)

    if req.step is not None:
        profile.onboarding_step = req.step
    if req.target_exam is not None:
        profile.target_exam = req.target_exam
    if req.target_level is not None:
        profile.target_level = req.target_level
    if req.target_date is not None:
        profile.target_date = req.target_date
    if req.daily_minutes_available is not None:
        profile.daily_minutes_available = req.daily_minutes_available
    if req.native_language is not None:
        profile.native_language = req.native_language
    if req.timezone is not None:
        profile.timezone = req.timezone
    if req.learning_preferences is not None:
        current_prefs = dict(profile.learning_preferences or {})
        current_prefs.update(req.learning_preferences)
        profile.learning_preferences = current_prefs

    await db.commit()
    await db.refresh(profile)

    await AnalyticsService.track(
        db=db,
        event_type=EventType.ONBOARDING_STEP_COMPLETED.value,
        actor_id=current_user.id,
        entity_type="student_profile",
        entity_id=profile.id,
        metadata={"step": profile.onboarding_step, "target_level": profile.target_level},
    )

    return OnboardingStateResponse(
        onboarding_status=profile.onboarding_status or "incomplete",
        onboarding_step=profile.onboarding_step or 1,
        target_exam=profile.target_exam or "TEF Canada",
        target_level=profile.target_level or "B2",
        target_date=profile.target_date.isoformat() if profile.target_date else None,
        daily_minutes_available=profile.daily_minutes_available or 30,
        timezone=profile.timezone or "UTC",
        native_language=profile.native_language,
        learning_preferences=profile.learning_preferences or {},
    )


@router.post(
    "/me/onboarding/complete",
    response_model=OnboardingStateResponse,
    summary="Finalize or skip onboarding",
)
async def complete_my_onboarding(
    req: OnboardingCompleteRequest,
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> OnboardingStateResponse:
    """Sets onboarding status to completed or skipped and emits final event."""
    profile = await db.scalar(
        select(StudentProfile).where(StudentProfile.user_id == current_user.id)
    )
    if not profile:
        raise AppException(message="Student profile not found", code="PROFILE_NOT_FOUND", status_code=404)

    profile.onboarding_status = req.action
    if req.action == "completed":
        profile.onboarding_step = 4

    await db.commit()
    await db.refresh(profile)

    ev_type = (
        EventType.ONBOARDING_COMPLETED.value
        if req.action == "completed"
        else EventType.ONBOARDING_SKIPPED.value
    )
    await AnalyticsService.track(
        db=db,
        event_type=ev_type,
        actor_id=current_user.id,
        entity_type="student_profile",
        entity_id=profile.id,
        metadata={"action": req.action, "final_step": profile.onboarding_step},
    )

    return OnboardingStateResponse(
        onboarding_status=profile.onboarding_status,
        onboarding_step=profile.onboarding_step,
        target_exam=profile.target_exam,
        target_level=profile.target_level,
        target_date=profile.target_date.isoformat() if profile.target_date else None,
        daily_minutes_available=profile.daily_minutes_available,
        timezone=profile.timezone or "UTC",
        native_language=profile.native_language,
        learning_preferences=profile.learning_preferences or {},
    )


