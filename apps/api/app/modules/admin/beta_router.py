"""FastAPI Router for the Admin Beta Control Panel: /api/v1/admin/beta."""

import datetime
import hashlib
import secrets
import uuid
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.beta_limits import LIMIT_DEFINITIONS, BetaLimitsService
from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.feature_flags import FeatureFlagManager
from app.modules.admin.beta_models import BetaCohort, BetaInvitation, BetaRateLimit
from app.modules.admin.beta_schemas import (
    BetaCohortCreate,
    BetaCohortRateUpdate,
    BetaCohortResponse,
    BetaGlobalRateUpdate,
    BetaInvitationCreate,
    BetaInvitationResponse,
    BetaOverviewResponse,
    BetaRateLimitItemResponse,
    BetaRatesConfigResponse,
    BetaStudentQuotaResetRequest,
    BetaStudentRateListResponse,
    BetaStudentRateStatus,
    BetaStudentRateUpdate,
    BetaSuspendUserRequest,
    BetaToggleFeatureRequest,
)
from app.modules.admin.models import AuditEvent
from app.modules.analytics.models import SupportTicket
from app.modules.assessments.models import Attempt
from app.modules.auth.dependencies import require_role
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
    except Exception:  # noqa: BLE001
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


# ==============================================================================
# STUDENT RATE LIMITS & QUOTA CONTROL
# ==============================================================================


@router.get(
    "/rates",
    response_model=BetaRatesConfigResponse,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
    summary="Get global, cohort, and student-level beta rate limit configurations",
)
async def get_beta_rates_config(
    db: AsyncSession = Depends(get_db),
) -> BetaRatesConfigResponse:
    stmt = (
        select(BetaRateLimit)
        .options(
            selectinload(BetaRateLimit.cohort),
            selectinload(BetaRateLimit.user),
        )
        .order_by(BetaRateLimit.updated_at.desc())
    )
    all_limits = (await db.execute(stmt)).scalars().all()

    global_limits: list[BetaRateLimitItemResponse] = []
    cohort_limits: list[BetaRateLimitItemResponse] = []
    student_overrides: list[BetaRateLimitItemResponse] = []

    for item in all_limits:
        def_info = LIMIT_DEFINITIONS.get(item.action, {})
        name_fr = def_info.get("name_fr", item.action)
        resp_item = BetaRateLimitItemResponse(
            id=item.id,
            scope=item.scope,
            action=item.action,
            action_name_fr=name_fr,
            limit_value=item.limit_value,
            window=item.window,
            cohort_id=item.cohort_id,
            cohort_name=item.cohort.name if item.cohort else None,
            user_id=item.user_id,
            user_email=item.user.email if item.user else None,
            notes=item.notes,
            updated_at=item.updated_at,
        )
        if item.scope == "global":
            global_limits.append(resp_item)
        elif item.scope == "cohort":
            cohort_limits.append(resp_item)
        elif item.scope == "user":
            student_overrides.append(resp_item)

    actions_meta: dict[str, Any] = {}
    global_map = {g.action: g.limit_value for g in global_limits}
    for action_key, cfg in LIMIT_DEFINITIONS.items():
        actions_meta[action_key] = {
            "name_fr": cfg["name_fr"],
            "default": cfg["default"],
            "window": cfg["window"],
            "current_global_limit": global_map.get(action_key, cfg["default"]),
            "is_overridden": action_key in global_map,
        }

    return BetaRatesConfigResponse(
        actions=actions_meta,
        global_limits=global_limits,
        cohort_limits=cohort_limits,
        student_overrides=student_overrides,
    )


@router.put(
    "/rates/global",
    response_model=BetaRateLimitItemResponse,
    summary="Set or adjust global beta rate limit for an action",
)
async def update_global_rate(
    payload: BetaGlobalRateUpdate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> BetaRateLimitItemResponse:
    if payload.action not in LIMIT_DEFINITIONS:
        raise AppException(
            f"Action inconnue '{payload.action}'. Actions valides : {list(LIMIT_DEFINITIONS.keys())}",
            code="INVALID_ACTION",
            status_code=400,
        )

    stmt = select(BetaRateLimit).where(
        BetaRateLimit.scope == "global",
        BetaRateLimit.action == payload.action,
    )
    rate_record = (await db.execute(stmt)).scalar_one_or_none()
    old_value = rate_record.limit_value if rate_record else LIMIT_DEFINITIONS[payload.action]["default"]

    if rate_record:
        rate_record.limit_value = payload.limit_value
        rate_record.created_by_user_id = current_user.id
    else:
        rate_record = BetaRateLimit(
            scope="global",
            action=payload.action,
            limit_value=payload.limit_value,
            window=LIMIT_DEFINITIONS[payload.action]["window"],
            created_by_user_id=current_user.id,
        )
        db.add(rate_record)

    await db.flush()

    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="UPDATE_BETA_GLOBAL_RATE",
        entity_type="BetaRateLimit",
        entity_id=rate_record.id,
        payload={
            "action": payload.action,
            "old_value": old_value,
            "new_value": payload.limit_value,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()
    await db.refresh(rate_record)

    await BetaLimitsService.invalidate_cache()

    name_fr = LIMIT_DEFINITIONS[payload.action]["name_fr"]
    return BetaRateLimitItemResponse(
        id=rate_record.id,
        scope=rate_record.scope,
        action=rate_record.action,
        action_name_fr=name_fr,
        limit_value=rate_record.limit_value,
        window=rate_record.window,
        notes=rate_record.notes,
        updated_at=rate_record.updated_at,
    )


@router.delete(
    "/rates/global/{action}",
    response_model=dict[str, Any],
    summary="Reset global beta rate limit to application defaults",
)
async def delete_global_rate(
    action: str,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if action not in LIMIT_DEFINITIONS:
        raise AppException(f"Action inconnue '{action}'", code="INVALID_ACTION", status_code=400)

    stmt = select(BetaRateLimit).where(
        BetaRateLimit.scope == "global",
        BetaRateLimit.action == action,
    )
    rate_record = (await db.execute(stmt)).scalar_one_or_none()
    if not rate_record:
        return {"message": "Plafond déjà configuré sur la valeur par défaut", "action": action}

    await db.delete(rate_record)

    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="DELETE_BETA_GLOBAL_RATE",
        entity_type="BetaRateLimit",
        entity_id=rate_record.id,
        payload={"action": action},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()

    await BetaLimitsService.invalidate_cache()
    return {"message": f"Plafond global '{action}' réinitialisé au défaut", "action": action}


@router.put(
    "/rates/cohort",
    response_model=BetaRateLimitItemResponse,
    summary="Set or adjust rate limit override for a beta cohort",
)
async def update_cohort_rate(
    payload: BetaCohortRateUpdate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> BetaRateLimitItemResponse:
    if payload.action not in LIMIT_DEFINITIONS:
        raise AppException(f"Action inconnue '{payload.action}'", code="INVALID_ACTION", status_code=400)

    cohort = await db.get(BetaCohort, payload.cohort_id)
    if not cohort:
        raise AppException("Cohorte introuvable", code="COHORT_NOT_FOUND", status_code=404)

    stmt = select(BetaRateLimit).where(
        BetaRateLimit.scope == "cohort",
        BetaRateLimit.cohort_id == payload.cohort_id,
        BetaRateLimit.action == payload.action,
    )
    rate_record = (await db.execute(stmt)).scalar_one_or_none()

    if rate_record:
        rate_record.limit_value = payload.limit_value
        rate_record.created_by_user_id = current_user.id
    else:
        rate_record = BetaRateLimit(
            scope="cohort",
            cohort_id=payload.cohort_id,
            action=payload.action,
            limit_value=payload.limit_value,
            window=LIMIT_DEFINITIONS[payload.action]["window"],
            created_by_user_id=current_user.id,
        )
        db.add(rate_record)

    await db.flush()

    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="UPDATE_BETA_COHORT_RATE",
        entity_type="BetaRateLimit",
        entity_id=rate_record.id,
        payload={
            "cohort_id": str(payload.cohort_id),
            "cohort_name": cohort.name,
            "action": payload.action,
            "new_value": payload.limit_value,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()
    await db.refresh(rate_record)

    await BetaLimitsService.invalidate_cache()

    name_fr = LIMIT_DEFINITIONS[payload.action]["name_fr"]
    return BetaRateLimitItemResponse(
        id=rate_record.id,
        scope=rate_record.scope,
        action=rate_record.action,
        action_name_fr=name_fr,
        limit_value=rate_record.limit_value,
        window=rate_record.window,
        cohort_id=cohort.id,
        cohort_name=cohort.name,
        notes=rate_record.notes,
        updated_at=rate_record.updated_at,
    )


@router.delete(
    "/rates/cohort/{cohort_id}/{action}",
    response_model=dict[str, Any],
    summary="Delete cohort rate limit override",
)
async def delete_cohort_rate(
    cohort_id: uuid.UUID,
    action: str,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(BetaRateLimit).where(
        BetaRateLimit.scope == "cohort",
        BetaRateLimit.cohort_id == cohort_id,
        BetaRateLimit.action == action,
    )
    rate_record = (await db.execute(stmt)).scalar_one_or_none()
    if not rate_record:
        return {"message": "Aucun plafond spécifique pour cette cohorte", "cohort_id": str(cohort_id)}

    await db.delete(rate_record)

    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="DELETE_BETA_COHORT_RATE",
        entity_type="BetaRateLimit",
        entity_id=rate_record.id,
        payload={"cohort_id": str(cohort_id), "action": action},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()

    await BetaLimitsService.invalidate_cache()
    return {"message": "Plafond spécifique supprimé pour la cohorte", "cohort_id": str(cohort_id), "action": action}


@router.put(
    "/rates/student",
    response_model=BetaRateLimitItemResponse,
    summary="Set or adjust individual student rate limit override",
)
async def update_student_rate(
    payload: BetaStudentRateUpdate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> BetaRateLimitItemResponse:
    if payload.action not in LIMIT_DEFINITIONS:
        raise AppException(f"Action inconnue '{payload.action}'", code="INVALID_ACTION", status_code=400)

    student = await db.get(User, payload.user_id)
    if not student:
        raise AppException("Étudiant introuvable", code="USER_NOT_FOUND", status_code=404)

    stmt = select(BetaRateLimit).where(
        BetaRateLimit.scope == "user",
        BetaRateLimit.user_id == payload.user_id,
        BetaRateLimit.action == payload.action,
    )
    rate_record = (await db.execute(stmt)).scalar_one_or_none()

    if rate_record:
        rate_record.limit_value = payload.limit_value
        rate_record.notes = payload.notes
        rate_record.created_by_user_id = current_user.id
    else:
        rate_record = BetaRateLimit(
            scope="user",
            user_id=payload.user_id,
            action=payload.action,
            limit_value=payload.limit_value,
            window=LIMIT_DEFINITIONS[payload.action]["window"],
            notes=payload.notes,
            created_by_user_id=current_user.id,
        )
        db.add(rate_record)

    await db.flush()

    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="UPDATE_BETA_STUDENT_RATE",
        entity_type="BetaRateLimit",
        entity_id=rate_record.id,
        payload={
            "user_id": str(student.id),
            "email": student.email,
            "action": payload.action,
            "new_value": payload.limit_value,
            "notes": payload.notes,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()
    await db.refresh(rate_record)

    await BetaLimitsService.invalidate_cache(user_id=payload.user_id, action=payload.action)

    name_fr = LIMIT_DEFINITIONS[payload.action]["name_fr"]
    return BetaRateLimitItemResponse(
        id=rate_record.id,
        scope=rate_record.scope,
        action=rate_record.action,
        action_name_fr=name_fr,
        limit_value=rate_record.limit_value,
        window=rate_record.window,
        user_id=student.id,
        user_email=student.email,
        notes=rate_record.notes,
        updated_at=rate_record.updated_at,
    )


@router.delete(
    "/rates/student/{user_id}/{action}",
    response_model=dict[str, Any],
    summary="Delete individual student rate limit override",
)
async def delete_student_rate(
    user_id: uuid.UUID,
    action: str,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(BetaRateLimit).where(
        BetaRateLimit.scope == "user",
        BetaRateLimit.user_id == user_id,
        BetaRateLimit.action == action,
    )
    rate_record = (await db.execute(stmt)).scalar_one_or_none()
    if not rate_record:
        return {"message": "Aucun plafond spécifique pour cet étudiant", "user_id": str(user_id)}

    await db.delete(rate_record)

    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="DELETE_BETA_STUDENT_RATE",
        entity_type="BetaRateLimit",
        entity_id=rate_record.id,
        payload={"user_id": str(user_id), "action": action},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()

    await BetaLimitsService.invalidate_cache(user_id=user_id, action=action)
    return {"message": "Plafond spécifique supprimé pour l'étudiant", "user_id": str(user_id), "action": action}


@router.get(
    "/rates/students",
    response_model=BetaStudentRateListResponse,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
    summary="List beta students with their live consumption and limits",
)
async def list_students_rates_status(
    search: str | None = Query(None, description="Search by student email"),
    cohort_id: uuid.UUID | None = Query(None, description="Filter by cohort"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> BetaStudentRateListResponse:
    query = select(User).options(selectinload(User.beta_cohort)).where(User.role == UserRole.STUDENT)

    if search:
        query = query.where(User.email.ilike(f"%{search.strip()}%"))
    if cohort_id:
        query = query.where(User.beta_cohort_id == cohort_id)

    count_query = select(func.count(User.id)).where(User.role == UserRole.STUDENT)
    if search:
        count_query = count_query.where(User.email.ilike(f"%{search.strip()}%"))
    if cohort_id:
        count_query = count_query.where(User.beta_cohort_id == cohort_id)
    total_count = (await db.scalar(count_query)) or 0

    users = (
        await db.execute(
            query.order_by(User.created_at.desc()).offset(offset).limit(limit)
        )
    ).scalars().all()

    user_ids = [u.id for u in users]
    override_user_ids: set[uuid.UUID] = set()
    if user_ids:
        ovr_stmt = select(BetaRateLimit.user_id).where(
            BetaRateLimit.scope == "user",
            BetaRateLimit.user_id.in_(user_ids),
        )
        override_user_ids = {
            uid for uid in (await db.execute(ovr_stmt)).scalars().all() if uid is not None
        }

    students_status: list[BetaStudentRateStatus] = []
    for u in users:
        quotas = await BetaLimitsService.get_user_status(u.id, db=db)
        students_status.append(
            BetaStudentRateStatus(
                user_id=u.id,
                email=u.email,
                cohort_id=u.beta_cohort_id,
                cohort_name=u.beta_cohort.name if u.beta_cohort else None,
                quotas=quotas,
                has_overrides=u.id in override_user_ids,
            )
        )

    return BetaStudentRateListResponse(
        total=total_count,
        students=students_status,
    )


@router.post(
    "/rates/student/{user_id}/reset",
    response_model=dict[str, Any],
    summary="Reset a student's consumption quota today/this week",
)
async def reset_student_quota(
    user_id: uuid.UUID,
    payload: BetaStudentQuotaResetRequest,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    student = await db.get(User, user_id)
    if not student:
        raise AppException("Étudiant introuvable", code="USER_NOT_FOUND", status_code=404)

    if payload.action and payload.action not in LIMIT_DEFINITIONS:
        raise AppException(f"Action inconnue '{payload.action}'", code="INVALID_ACTION", status_code=400)

    await BetaLimitsService.reset_user_consumption(user_id, action=payload.action)

    audit = AuditEvent(
        actor_user_id=current_user.id,
        action="RESET_BETA_STUDENT_QUOTA",
        entity_type="User",
        entity_id=student.id,
        payload={
            "student_email": student.email,
            "action": payload.action or "all",
            "reason": payload.reason,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(audit)
    await db.commit()

    updated_status = await BetaLimitsService.get_user_status(user_id, db=db)

    return {
        "message": f"Quota réinitialisé pour l'étudiant {student.email}",
        "user_id": str(user_id),
        "action": payload.action,
        "quotas": updated_status,
    }

