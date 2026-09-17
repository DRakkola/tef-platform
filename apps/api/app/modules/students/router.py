"""FastAPI Router for student endpoints: /api/v1/students."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AppException
from app.modules.auth.dependencies import require_role
from app.modules.students.dashboard_schemas import (
    StudentDashboardResponse,
    StudentProgressResponse,
)
from app.modules.students.dashboard_service import StudentDashboardService
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
    "/me/progress",
    response_model=StudentProgressResponse,
    summary="Get historical progress timeline and skill trajectories",
)
async def get_my_progress(
    current_user: User = Depends(require_role(UserRole.STUDENT, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> StudentProgressResponse:
    """Retrieve historical measurement timeline and skill trajectories."""
    return await StudentDashboardService.get_progress(db, current_user)
