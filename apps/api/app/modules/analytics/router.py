"""FastAPI Router for Analytics Telemetry, User Feedback, Support Triage, Health, and Experiments."""

import datetime
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AppException
from app.modules.analytics.enums import (
    FeedbackCategory,
    SupportTicketPriority,
    SupportTicketStatus,
)
from app.modules.analytics.experiments_service import ExperimentsService
from app.modules.analytics.health_service import HealthService
from app.modules.analytics.schemas import (
    AIAnalyticsResponse,
    AnalyticsEventBatchRequest,
    AnalyticsEventIngestItem,
    AnalyticsEventResponse,
    AnalyticsOverviewResponse,
    BillingAnalyticsResponse,
    ContentAnalyticsResponse,
    ExperimentCreateRequest,
    ExperimentResponse,
    ExperimentResultsResponse,
    ExperimentUpdateRequest,
    ExperimentVariantResponse,
    FunnelResponse,
    HealthDashboardResponse,
    LearningAnalyticsResponse,
    PracticePoolAnalyticsResponse,
    RetentionResponse,
    SupportTicketCreateRequest,
    SupportTicketResponse,
    SupportTicketUpdateRequest,
    TeacherAnalyticsResponse,
    UserFeedbackCreateRequest,
    UserFeedbackResponse,
)
from app.modules.analytics.service import AnalyticsService
from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.users.models import User, UserRole

analytics_router = APIRouter(prefix="/analytics", tags=["Analytics Telemetry"])
admin_analytics_router = APIRouter(prefix="/admin/analytics", tags=["Admin - Analytics Cockpit"])
admin_ops_router = APIRouter(prefix="/admin", tags=["Admin - Beta Operations"])


# ---------------------------------------------------------------------------
# Telemetry Ingestion Endpoints (Fail-Safe)
# ---------------------------------------------------------------------------


@analytics_router.post(
    "/events",
    response_model=AnalyticsEventResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ingest a single client or server telemetry event",
)
async def ingest_analytics_event(
    item: AnalyticsEventIngestItem,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AnalyticsEventResponse:
    """Records an immutable product event with client-provided or auto-generated idempotency key."""
    eid = item.event_id or uuid.uuid4()
    now_utc = datetime.datetime.now(datetime.UTC)

    # Resolve actor if bearer token present but actor_id omitted
    actor_id = item.actor_id
    if not actor_id:
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                from app.core.security import decode_access_token
                payload = decode_access_token(auth_header.split(" ")[1])
                actor_id = uuid.UUID(payload["sub"])
            except Exception:
                pass

    await AnalyticsService.track(
        db=db,
        event_type=item.event_type,
        actor_id=actor_id,
        session_id=item.session_id,
        entity_type=item.entity_type,
        entity_id=item.entity_id,
        metadata=item.metadata,
        schema_version=item.schema_version,
        occurred_at=item.occurred_at,
        event_id=eid,
    )

    return AnalyticsEventResponse(
        event_id=eid,
        status="accepted",
        received_at=now_utc,
    )


@analytics_router.post(
    "/events/batch",
    response_model=dict[str, Any],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ingest a batch of telemetry events",
)
async def ingest_analytics_events_batch(
    req: AnalyticsEventBatchRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Processes a batch of up to 100 buffered client events."""
    accepted = await AnalyticsService.track_batch(db=db, items=req.events)
    return {
        "accepted_count": len(accepted),
        "status": "accepted",
        "processed_at": datetime.datetime.now(datetime.UTC).isoformat(),
    }


# ---------------------------------------------------------------------------
# Feedback & Support Tickets
# ---------------------------------------------------------------------------


@analytics_router.post(
    "/feedback",
    response_model=UserFeedbackResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit user satisfaction or feedback",
)
async def submit_user_feedback(
    req: UserFeedbackCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserFeedbackResponse:
    """Stores student feedback, ratings, and contextual metadata."""
    fb = await AnalyticsService.create_feedback(db=db, user_id=current_user.id, req=req)
    return UserFeedbackResponse(
        id=fb.id,
        user_id=fb.user_id,
        category=fb.category.value,
        rating=fb.rating,
        message=fb.message,
        context_url=fb.context_url,
        created_at=fb.created_at,
    )


@analytics_router.post(
    "/support/tickets",
    response_model=SupportTicketResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit customer support ticket or bug report",
)
async def submit_support_ticket(
    req: SupportTicketCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SupportTicketResponse:
    """Submits a support ticket for operations triage."""
    actor_id: uuid.UUID | None = None
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from app.core.security import decode_access_token
            payload = decode_access_token(auth_header.split(" ")[1])
            actor_id = uuid.UUID(payload["sub"])
        except Exception:
            pass

    ticket = await AnalyticsService.create_support_ticket(db=db, user_id=actor_id, req=req)
    return SupportTicketResponse(
        id=ticket.id,
        user_id=ticket.user_id,
        category=ticket.category,
        subject=ticket.subject,
        description=ticket.description,
        status=ticket.status.value,
        priority=ticket.priority.value,
        internal_notes=None,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


@analytics_router.get(
    "/support/tickets/me",
    response_model=list[SupportTicketResponse],
    summary="List support tickets submitted by current authenticated student",
)
async def list_my_support_tickets(
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[SupportTicketResponse]:
    """Returns support tickets for the current authenticated user with internal notes omitted."""
    tickets = await AnalyticsService.list_user_support_tickets(
        db=db, user_id=current_user.id, limit=limit, offset=offset
    )
    return [
        SupportTicketResponse(
            id=t.id,
            user_id=t.user_id,
            category=t.category,
            subject=t.subject,
            description=t.description,
            status=t.status.value,
            priority=t.priority.value,
            internal_notes=None,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in tickets
    ]


@analytics_router.get(
    "/support/tickets/me/{ticket_id}",
    response_model=SupportTicketResponse,
    summary="Get details of a support ticket submitted by current authenticated student",
)
async def get_my_support_ticket(
    ticket_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SupportTicketResponse:
    """Returns a single support ticket for current user with internal notes omitted."""
    ticket = await AnalyticsService.get_user_support_ticket(
        db=db, user_id=current_user.id, ticket_id=ticket_id
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Demande de support introuvable.")
    return SupportTicketResponse(
        id=ticket.id,
        user_id=ticket.user_id,
        category=ticket.category,
        subject=ticket.subject,
        description=ticket.description,
        status=ticket.status.value,
        priority=ticket.priority.value,
        internal_notes=None,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


# ---------------------------------------------------------------------------
# Experiments Client Assignment
# ---------------------------------------------------------------------------


@analytics_router.post(
    "/experiments/{experiment_key}/assignment",
    response_model=ExperimentVariantResponse | None,
    summary="Get or assign user variant for an active experiment",
)
async def get_experiment_assignment(
    experiment_key: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExperimentVariantResponse | None:
    """Returns deterministic variant assigned to current user for the experiment."""
    variant = await ExperimentsService.assign_user_variant(
        db=db,
        experiment_key=experiment_key,
        user_id=current_user.id,
    )
    if not variant:
        return None
    return ExperimentVariantResponse(
        id=variant.id,
        key=variant.key,
        weight=variant.weight,
        config_payload=variant.config_payload,
    )


# ---------------------------------------------------------------------------
# Admin Analytics Cockpit (9 Specialized Views)
# ---------------------------------------------------------------------------


@admin_analytics_router.get(
    "/overview",
    response_model=AnalyticsOverviewResponse,
    summary="Executive analytics overview",
)
async def get_analytics_overview(
    date_range: str = Query("last_30_days"),
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> AnalyticsOverviewResponse:
    return await AnalyticsService.get_overview_metrics(db=db, date_range=date_range)


@admin_analytics_router.get(
    "/funnel",
    response_model=FunnelResponse,
    summary="Multi-step activation and conversion funnel",
)
async def get_funnel_analytics(
    date_range: str = Query("last_30_days"),
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> FunnelResponse:
    return await AnalyticsService.get_funnel_metrics(db=db, date_range=date_range)


@admin_analytics_router.get(
    "/retention",
    response_model=RetentionResponse,
    summary="D1, D7, D14, D30 cohort retention analysis",
)
async def get_retention_analytics(
    weeks: int = Query(4, ge=1, le=12),
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> RetentionResponse:
    return await AnalyticsService.get_retention_cohorts(db=db, weeks=weeks)


@admin_analytics_router.get(
    "/learning",
    response_model=LearningAnalyticsResponse,
    summary="Observed skill trajectories and blocking skills",
)
async def get_learning_analytics(
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> LearningAnalyticsResponse:
    return await AnalyticsService.get_learning_analytics(db=db)


@admin_analytics_router.get(
    "/content",
    response_model=ContentAnalyticsResponse,
    summary="Assessment completions and question failure analysis",
)
async def get_content_analytics(
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ContentAnalyticsResponse:
    return await AnalyticsService.get_content_analytics(db=db)


@admin_analytics_router.get(
    "/teachers",
    response_model=TeacherAnalyticsResponse,
    summary="Marketplace utilization and correction turnaround",
)
async def get_teacher_analytics(
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> TeacherAnalyticsResponse:
    return await AnalyticsService.get_teacher_analytics(db=db)


@admin_analytics_router.get(
    "/ai",
    response_model=AIAnalyticsResponse,
    summary="AI usage, costs, latency, and error rates",
)
async def get_ai_analytics(
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> AIAnalyticsResponse:
    return await AnalyticsService.get_ai_analytics(db=db)


@admin_analytics_router.get(
    "/billing",
    response_model=BillingAnalyticsResponse,
    summary="Monetization, conversion, GMV, and subscriptions",
)
async def get_billing_analytics(
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> BillingAnalyticsResponse:
    return await AnalyticsService.get_billing_analytics(db=db)


@admin_analytics_router.get(
    "/practice-pool",
    response_model=PracticePoolAnalyticsResponse,
    summary="Practice pool matchmaking liquidity and session completion",
)
async def get_practice_pool_analytics(
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> PracticePoolAnalyticsResponse:
    return await AnalyticsService.get_practice_pool_analytics(db=db)


# ---------------------------------------------------------------------------
# Admin Beta Operations (Health, Feedback, Support, Experiments)
# ---------------------------------------------------------------------------


@admin_ops_router.get(
    "/health",
    response_model=HealthDashboardResponse,
    summary="Operational health checks across all subsystems",
)
async def get_admin_health_status(
    admin: User = Depends(require_role(UserRole.ADMIN)),
) -> HealthDashboardResponse:
    return await HealthService.check_platform_health()


@admin_ops_router.get(
    "/feedback",
    response_model=list[UserFeedbackResponse],
    summary="List student feedback submissions",
)
async def list_feedback_items(
    category: FeedbackCategory | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[UserFeedbackResponse]:
    feedbacks = await AnalyticsService.list_feedback(db=db, category=category, limit=limit, offset=offset)
    return [
        UserFeedbackResponse(
            id=fb.id,
            user_id=fb.user_id,
            category=fb.category.value,
            rating=fb.rating,
            message=fb.message,
            context_url=fb.context_url,
            created_at=fb.created_at,
        )
        for fb in feedbacks
    ]


@admin_ops_router.get(
    "/support/tickets",
    response_model=list[SupportTicketResponse],
    summary="List all support tickets for administrative triage",
)
async def list_admin_support_tickets(
    status: SupportTicketStatus | None = None,
    priority: SupportTicketPriority | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[SupportTicketResponse]:
    tickets = await AnalyticsService.list_support_tickets(
        db=db, status=status, priority=priority, limit=limit, offset=offset
    )
    return [
        SupportTicketResponse(
            id=t.id,
            user_id=t.user_id,
            category=t.category,
            subject=t.subject,
            description=t.description,
            status=t.status.value,
            priority=t.priority.value,
            internal_notes=t.internal_notes,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in tickets
    ]


@admin_ops_router.patch(
    "/support/tickets/{ticket_id}",
    response_model=SupportTicketResponse,
    summary="Update support ticket triage status and notes",
)
async def update_admin_support_ticket(
    ticket_id: uuid.UUID,
    req: SupportTicketUpdateRequest,
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> SupportTicketResponse:
    ticket = await AnalyticsService.update_support_ticket(db=db, ticket_id=ticket_id, req=req)
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found")
    return SupportTicketResponse(
        id=ticket.id,
        user_id=ticket.user_id,
        category=ticket.category,
        subject=ticket.subject,
        description=ticket.description,
        status=ticket.status.value,
        priority=ticket.priority.value,
        internal_notes=ticket.internal_notes,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


# ---------------------------------------------------------------------------
# Admin Controlled Experiments
# ---------------------------------------------------------------------------


@admin_ops_router.get(
    "/experiments",
    response_model=list[ExperimentResponse],
    summary="List product experiments",
)
async def list_admin_experiments(
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[ExperimentResponse]:
    return await ExperimentsService.list_experiments(db=db)


@admin_ops_router.post(
    "/experiments",
    response_model=ExperimentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new controlled product experiment",
)
async def create_admin_experiment(
    req: ExperimentCreateRequest,
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ExperimentResponse:
    return await ExperimentsService.create_experiment(db=db, req=req)


@admin_ops_router.get(
    "/experiments/{key}",
    response_model=ExperimentResponse,
    summary="Get details of a specific product experiment",
)
async def get_admin_experiment(
    key: str,
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ExperimentResponse:
    exp = await ExperimentsService.get_experiment(db=db, key=key)
    if not exp:
        raise HTTPException(status_code=404, detail=f"Experiment '{key}' not found")
    return ExperimentResponse(
        id=exp.id,
        key=exp.key,
        name=exp.name,
        description=exp.description,
        status=exp.status.value,
        variants=[
            ExperimentVariantResponse(
                id=v.id,
                key=v.key,
                weight=v.weight,
                config_payload=v.config_payload,
            )
            for v in exp.variants
        ],
        created_at=exp.created_at,
        updated_at=exp.updated_at,
    )


@admin_ops_router.patch(
    "/experiments/{key}",
    response_model=ExperimentResponse,
    summary="Update experiment lifecycle state or details",
)
async def update_admin_experiment(
    key: str,
    req: ExperimentUpdateRequest,
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ExperimentResponse:
    return await ExperimentsService.update_experiment(db=db, key=key, req=req)


@admin_ops_router.get(
    "/experiments/{key}/results",
    response_model=ExperimentResultsResponse,
    summary="Evaluate conversion metrics of an experiment",
)
async def get_admin_experiment_results(
    key: str,
    admin: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ExperimentResultsResponse:
    return await ExperimentsService.evaluate_experiment_results(db=db, experiment_key=key)
