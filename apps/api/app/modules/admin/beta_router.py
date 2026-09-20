"""FastAPI Router for the Admin Beta Control Panel: /api/v1/admin/beta."""

import datetime
import hashlib
import secrets
import uuid
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.feature_flags import FeatureFlagManager
from app.modules.admin.beta_models import BetaCohort, BetaInvitation
from app.modules.admin.beta_schemas import (
    BetaCohortCreate,
    BetaCohortResponse,
    BetaInvitationCreate,
    BetaInvitationResponse,
    BetaOverviewResponse,
    BetaSuspendUserRequest,
    BetaToggleFeatureRequest,
)
from app.modules.admin.models import AuditEvent
from app.modules.analytics.models import SupportTicket
from app.modules.assessments.models import Attempt
from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.billing.models import AIUsageRecord, Order
from app.modules.practice_pool.models import PracticeSession
from app.modules.speaking.models import SpeakingSession
from app.modules.teachers.models import TeacherBooking
from app.modules.users.models import User, UserRole
from app.modules.writing.models import WritingSubmission

router = APIRouter(prefix="/admin/beta", tags=["Admin Beta Operations"])
logger = structlog.get_logger("tef-api.admin_beta")


@router.get(
    "/overview",
    response_model=BetaOverviewResponse,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
    summary="Get real-time operational overview for beta monitoring",
)
async def get_beta_overview(
    db: AsyncSession = Depends(get_db),
) -> BetaOverviewResponse:
    now = datetime.datetime.now(datetime.UTC)
    last_24h = now - datetime.timedelta(hours=24)
    last_7d = now - datetime.timedelta(days=7)

    # 1. Beta users count
    total_beta = (
        await db.scalar(select(func.count(User.id)).where(User.is_beta_user.is_(True)))
    ) or 0

    # 2. Recent registrations
    recent_reg = (
        await db.scalar(select(func.count(User.id)).where(User.created_at >= last_24h))
    ) or 0

    # 3. Active users (logged in last 7d)
    active_users = (
        await db.scalar(select(func.count(User.id)).where(User.last_login_at >= last_7d))
    ) or 0

    # 4. Activity counts
    assessments_completed = (
        await db.scalar(select(func.count(Attempt.id)).where(Attempt.status == "completed"))
    ) or 0

    writing_subs = (await db.scalar(select(func.count(WritingSubmission.id)))) or 0
    speaking_sess = (await db.scalar(select(func.count(SpeakingSession.id)))) or 0
    practice_sess = (await db.scalar(select(func.count(PracticeSession.id)))) or 0
    teacher_bks = (await db.scalar(select(func.count(TeacherBooking.id)))) or 0

    # 5. Financials
    total_rev = (
        await db.scalar(select(func.coalesce(func.sum(Order.total_cents), 0)))
    ) or 0

    # 6. AI cost
    ai_cost_usd = 0.0
    try:
        ai_records = (await db.execute(select(AIUsageRecord))).scalars().all()
        for rec in ai_records:
            ai_cost_usd += (rec.units * 0.02) + ((rec.audio_seconds or 0) * 0.001)
    except Exception:
        ai_cost_usd = 0.0

    # 7. Support tickets
    open_tickets = (
        await db.scalar(
            select(func.count(SupportTicket.id)).where(
                SupportTicket.status.in_(["OPEN", "IN_PROGRESS"])
            )
        )
    ) or 0

    # 8. Feature flags
    flags = await FeatureFlagManager.get_all_flags()
    flags["beta_enabled"] = settings.BETA_ENABLED
    flags["billing_production_enabled"] = settings.BILLING_PRODUCTION_ENABLED

    return BetaOverviewResponse(
        total_beta_users=total_beta,
        active_users_7d=active_users,
        recent_registrations_24h=recent_reg,
        assessment_completions=assessments_completed,
        writing_submissions=writing_subs,
        speaking_sessions=speaking_sess,
        practice_sessions=practice_sess,
        teacher_bookings=teacher_bks,
        total_revenue_cents=total_rev,
        ai_total_cost_usd=round(ai_cost_usd, 4),
        open_support_tickets=open_tickets,
        unresolved_incidents_count=0,
        feature_flags=flags,
        server_timestamp=now.isoformat(),
    )


@router.get(
    "/cohorts",
    response_model=list[BetaCohortResponse],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
    summary="List all beta cohorts",
)
async def list_cohorts(
    db: AsyncSession = Depends(get_db),
) -> list[BetaCohortResponse]:
    stmt = select(BetaCohort).options(selectinload(BetaCohort.users)).order_by(BetaCohort.created_at.desc())
    cohorts = (await db.execute(stmt)).scalars().all()

    resp: list[BetaCohortResponse] = []
    for c in cohorts:
        students = sum(1 for u in c.users if u.role == UserRole.STUDENT)
        teachers = sum(1 for u in c.users if u.role == UserRole.TEACHER)
        resp.append(
            BetaCohortResponse(
                id=c.id,
                name=c.name,
                description=c.description,
                max_students=c.max_students,
                max_teachers=c.max_teachers,
                is_active=c.is_active,
                feature_overrides=c.feature_overrides,
                students_count=students,
                teachers_count=teachers,
                created_at=c.created_at,
            )
        )
    return resp


@router.post(
    "/cohorts",
    response_model=BetaCohortResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new beta cohort",
)
async def create_cohort(
    payload: BetaCohortCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> BetaCohortResponse:
    existing = (
        await db.scalar(select(BetaCohort).where(BetaCohort.name == payload.name.strip()))
    )
    if existing:
        raise AppException(
            message=f"Une cohorte nommée '{payload.name}' existe déjà.",
            code="COHORT_ALREADY_EXISTS",
            status_code=400,
        )

    cohort = BetaCohort(
        name=payload.name.strip(),
        description=payload.description,
        max_students=payload.max_students,
        max_teachers=payload.max_teachers,
        is_active=True,
        feature_overrides=payload.feature_overrides,
    )
    db.add(cohort)
    await db.flush()

    # Audit log
    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="CREATE_BETA_COHORT",
        entity_type="BetaCohort",
        entity_id=cohort.id,
        payload={"name": cohort.name, "max_students": cohort.max_students},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()
    await db.refresh(cohort)

    return BetaCohortResponse(
        id=cohort.id,
        name=cohort.name,
        description=cohort.description,
        max_students=cohort.max_students,
        max_teachers=cohort.max_teachers,
        is_active=cohort.is_active,
        feature_overrides=cohort.feature_overrides,
        students_count=0,
        teachers_count=0,
        created_at=cohort.created_at,
    )


@router.get(
    "/invitations",
    response_model=list[BetaInvitationResponse],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
    summary="List generated beta invitations",
)
async def list_invitations(
    db: AsyncSession = Depends(get_db),
) -> list[BetaInvitationResponse]:
    stmt = (
        select(BetaInvitation)
        .options(selectinload(BetaInvitation.cohort))
        .order_by(BetaInvitation.created_at.desc())
    )
    invites = (await db.execute(stmt)).scalars().all()

    return [
        BetaInvitationResponse(
            id=inv.id,
            token_prefix=inv.token_prefix,
            cohort_id=inv.cohort_id,
            cohort_name=inv.cohort.name if inv.cohort else None,
            role=inv.role,
            max_uses=inv.max_uses,
            used_count=inv.used_count,
            expires_at=inv.expires_at,
            environment=inv.environment,
            is_revoked=inv.is_revoked,
            created_at=inv.created_at,
            plaintext_token=None,
        )
        for inv in invites
    ]


@router.post(
    "/invitations",
    response_model=BetaInvitationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a cryptographic beta invitation token",
)
async def create_invitation(
    payload: BetaInvitationCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> BetaInvitationResponse:
    # Generate cryptographic high-entropy token: tef_beta_<32-byte-hex>
    raw_token = f"tef_beta_{secrets.token_hex(20)}"
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    prefix = raw_token[:14] + "..."

    expires_at = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=payload.valid_days)

    cohort_name = None
    if payload.cohort_id:
        cohort = await db.get(BetaCohort, payload.cohort_id)
        if not cohort:
            raise AppException("Cohorte introuvable", code="COHORT_NOT_FOUND", status_code=404)
        cohort_name = cohort.name

    invitation = BetaInvitation(
        token_hash=token_hash,
        token_prefix=prefix,
        cohort_id=payload.cohort_id,
        role=payload.role,
        max_uses=payload.max_uses,
        used_count=0,
        expires_at=expires_at,
        environment=payload.environment,
        is_revoked=False,
        created_by_user_id=current_user.id,
    )
    db.add(invitation)
    await db.flush()

    # Audit log
    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="GENERATE_BETA_INVITATION",
        entity_type="BetaInvitation",
        entity_id=invitation.id,
        payload={
            "role": str(payload.role),
            "max_uses": payload.max_uses,
            "cohort_id": str(payload.cohort_id) if payload.cohort_id else None,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()
    await db.refresh(invitation)

    return BetaInvitationResponse(
        id=invitation.id,
        token_prefix=invitation.token_prefix,
        cohort_id=invitation.cohort_id,
        cohort_name=cohort_name,
        role=invitation.role,
        max_uses=invitation.max_uses,
        used_count=invitation.used_count,
        expires_at=invitation.expires_at,
        environment=invitation.environment,
        is_revoked=invitation.is_revoked,
        created_at=invitation.created_at,
        plaintext_token=raw_token,
    )


@router.post(
    "/invitations/{invitation_id}/revoke",
    response_model=dict[str, Any],
    summary="Revoke an active beta invitation",
)
async def revoke_invitation(
    invitation_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    invitation = await db.get(BetaInvitation, invitation_id)
    if not invitation:
        raise AppException("Invitation introuvable", code="INVITATION_NOT_FOUND", status_code=404)

    invitation.is_revoked = True

    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="REVOKE_BETA_INVITATION",
        entity_type="BetaInvitation",
        entity_id=invitation.id,
        payload={"prefix": invitation.token_prefix},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()

    return {"message": "Invitation révoquée avec succès", "invitation_id": str(invitation_id)}


@router.post(
    "/controls/toggle-feature",
    response_model=dict[str, Any],
    summary="Emergency kill-switch: toggle platform feature dynamically",
)
async def toggle_feature(
    payload: BetaToggleFeatureRequest,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    updated_flags = await FeatureFlagManager.set_flag(payload.feature_name, payload.enabled)

    # Audit log
    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="TOGGLE_FEATURE_FLAG",
        entity_type="FeatureFlag",
        entity_id=None,
        payload={"flag": payload.feature_name, "enabled": payload.enabled},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()

    return {
        "message": f"Drapeau fonctionnel '{payload.feature_name}' mis à jour : {payload.enabled}",
        "flags": updated_flags,
    }


@router.post(
    "/controls/suspend-user",
    response_model=dict[str, Any],
    summary="Suspend or reactivate a beta user with mandatory audit log",
)
async def suspend_user(
    payload: BetaSuspendUserRequest,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    target_user = await db.get(User, payload.user_id)
    if not target_user:
        raise AppException("Utilisateur introuvable", code="USER_NOT_FOUND", status_code=404)

    if target_user.role == UserRole.ADMIN:
        raise AppException("Impossible de suspendre un administrateur", code="CANNOT_SUSPEND_ADMIN", status_code=400)

    target_user.is_active = not payload.suspended

    action = "SUSPEND_USER" if payload.suspended else "REACTIVATE_USER"
    audit = AuditEvent(
        actor_user_id=current_user.id,
        action=action,
        entity_type="User",
        entity_id=target_user.id,
        payload={"email": target_user.email, "reason": payload.reason},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()

    return {
        "message": f"Utilisateur {target_user.email} {'suspendu' if payload.suspended else 'réactivé'} avec succès.",
        "user_id": str(target_user.id),
        "is_active": target_user.is_active,
    }
