"""FastAPI Router for administrative endpoints: /api/v1/admin."""

from typing import Any

from fastapi import APIRouter, Depends

from app.modules.auth.dependencies import require_role
from app.modules.users.models import User, UserRole

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get(
    "/system-overview",
    summary="Admin system overview (restricted to admins only)",
)
async def get_admin_system_overview(
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> dict[str, Any]:
    """Administrative overview endpoint restricted strictly to admin role."""
    return {
        "status": "operational",
        "restricted": True,
        "access": "admin_granted",
    }
