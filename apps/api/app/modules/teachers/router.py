"""FastAPI Router for teacher endpoints: /api/v1/teachers."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AppException
from app.modules.auth.dependencies import require_role
from app.modules.users.models import TeacherProfile, User, UserRole
from app.modules.users.schemas import TeacherProfileResponse

router = APIRouter(prefix="/teachers", tags=["Teachers"])


@router.get(
    "/me",
    response_model=TeacherProfileResponse,
    summary="Get current teacher profile",
)
async def get_my_teacher_profile(
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> TeacherProfileResponse:
    """Retrieve teacher profile of currently authenticated teacher."""
    stmt = select(TeacherProfile).where(TeacherProfile.user_id == current_user.id)
    profile = (await db.execute(stmt)).scalar_one_or_none()

    if not profile:
        raise AppException(
            message="Teacher profile not found",
            code="PROFILE_NOT_FOUND",
            status_code=404,
        )

    return TeacherProfileResponse.model_validate(profile)
