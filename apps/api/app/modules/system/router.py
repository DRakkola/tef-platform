"""FastAPI Router for system controls, feature flags, and private beta support tickets."""

import datetime
import uuid
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.feature_flags import FeatureFlagManager
from app.core.rate_limit import get_client_ip
from app.modules.admin.models import AuditEvent
from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.system.schemas import (
    FeatureFlagsResponse,
    SupportTicketRequest,
    SupportTicketResponse,
    UpdateFeatureFlagRequest,
)
from app.modules.users.models import User, UserRole

logger = structlog.get_logger("tef-api.system")

system_router = APIRouter(prefix="/system", tags=["System"])
support_router = APIRouter(prefix="/support", tags=["Support"])
admin_system_router = APIRouter(prefix="/admin/system", tags=["Admin - System Controls"])


@system_router.get(
    "/flags",
    response_model=FeatureFlagsResponse,
    summary="Get all public system feature flags",
)
async def get_feature_flags() -> FeatureFlagsResponse:
    """Returns current operational status for key platform modules."""
    flags = await FeatureFlagManager.get_all_flags()
    return FeatureFlagsResponse(flags=flags)


@support_router.post(
    "/tickets",
    response_model=SupportTicketResponse,
    summary="Submit private beta feedback or bug report",
)
@system_router.post(
    "/support/tickets",
    response_model=SupportTicketResponse,
    summary="Submit private beta feedback or bug report (system prefix alias)",
)
async def submit_support_ticket(
    req: SupportTicketRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SupportTicketResponse:
    """Records user feedback, diagnostic metadata, and client state for engineering review."""
    ticket_id = uuid.uuid4()
    now_utc = datetime.datetime.now(datetime.UTC)
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")

    # Optional user identification from bearer token if present
    actor_id: uuid.UUID | None = None
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from app.core.security import decode_access_token
            payload = decode_access_token(auth_header.split(" ")[1])
            actor_id = uuid.UUID(payload["sub"])
        except Exception:
            pass

    event = AuditEvent(
        id=ticket_id,
        actor_user_id=actor_id,
        action="SUPPORT_TICKET_SUBMITTED",
        entity_type="support_ticket",
        entity_id=ticket_id,
        payload={
            "category": req.category,
            "subject": req.subject,
            "description": req.description,
            "client_metadata": req.client_metadata,
        },
        ip_address=client_ip,
        user_agent=user_agent,
        created_at=now_utc,
    )
    db.add(event)
    await db.commit()

    logger.info(
        "support_ticket_recorded",
        ticket_id=str(ticket_id),
        category=req.category,
        subject=req.subject,
        user_id=str(actor_id) if actor_id else None,
    )

    return SupportTicketResponse(
        ticket_id=ticket_id,
        status="received",
        created_at=now_utc,
        message="Thank you for your report. Our engineering team has been notified.",
    )


@admin_system_router.patch(
    "/flags",
    response_model=FeatureFlagsResponse,
    summary="Update operational feature flag state",
)
async def update_feature_flag(
    req: UpdateFeatureFlagRequest,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> FeatureFlagsResponse:
    """Toggles platform capability switches (AI speaking, writing, bookings, checkout, maintenance)."""
    updated_flags = await FeatureFlagManager.set_flag(req.flag_name, req.enabled)
    now_utc = datetime.datetime.now(datetime.UTC)

    # Record administrative audit trail
    audit_ev = AuditEvent(
        actor_user_id=current_user.id,
        action="FEATURE_FLAG_UPDATED",
        entity_type="system_feature_flag",
        payload={
            "flag": req.flag_name,
            "enabled": req.enabled,
            "reason": req.reason,
            "updated_at": now_utc.isoformat(),
        },
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        created_at=now_utc,
    )
    db.add(audit_ev)
    await db.commit()

    return FeatureFlagsResponse(flags=updated_flags)
