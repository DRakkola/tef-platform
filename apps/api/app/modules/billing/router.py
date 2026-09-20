"""FastAPI routes for Billing, Checkout, Webhooks, Teacher Earnings, and Admin Billing."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.exceptions import AppException
from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.billing.admin_service import AdminBillingService
from app.modules.billing.credits_service import CreditsService
from app.modules.billing.entitlements import EntitlementService
from app.modules.billing.enums import PlanTier
from app.modules.billing.models import (
    CreditConsumption,
    CreditGrant,
    Order,
    OrderItem,
    Subscription,
)
from app.modules.billing.reconciliation import BillingReconciliationService
from app.modules.billing.refund_service import RefundService
from app.modules.billing.schemas import (
    AdminGrantRequest,
    AdminRefundRequest,
    BillingLedgerEntryResponse,
    CheckoutRequest,
    CheckoutResponse,
    CreditBalanceResponse,
    CreditConsumptionResponse,
    CreditGrantResponse,
    CreditUsageOverviewResponse,
    InvoiceResponse,
    OrderItemResponse,
    OrderResponse,
    PaymentWebhookEventResponse,
    ProductResponse,
    ReservationCreateRequest,
    ReservationResponse,
    SubscriptionResponse,
    TeacherEarningResponse,
    TeacherEarningsSummaryResponse,
)
from app.modules.billing.service import BillingService
from app.modules.billing.teacher_billing import TeacherBillingService
from app.modules.users.models import User, UserRole

# ----------------------------------------------------
# 1. CORE BILLING ROUTER (/billing)
# ----------------------------------------------------
router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get("/products", response_model=list[ProductResponse], summary="List product catalog")
async def list_products(db: AsyncSession = Depends(get_db)) -> list[ProductResponse]:
    """Retrieve all available subscription plans, credit packs, and lesson products."""
    return await BillingService.get_products(db=db, active_only=True)


@router.get("/products/{product_id}", response_model=ProductResponse, summary="Get product details")
async def get_product(product_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> ProductResponse:
    """Retrieve details for a specific product."""
    return await BillingService.get_product(db=db, product_id=product_id)


@router.post("/checkout", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED, summary="Create checkout session")
async def create_checkout_session(
    payload: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckoutResponse:
    """Launch hosted checkout session with server-side price resolution."""
    return await BillingService.create_checkout_session(db=db, user=current_user, payload=payload)


@router.get("/checkout/{session_id}", summary="Check checkout session fulfillment status")
async def get_checkout_session_status(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Verify fulfillment state of a completed checkout session."""
    stmt = select(Order).where(Order.provider_order_reference == session_id, Order.user_id == current_user.id)
    order = (await db.execute(stmt)).scalar_one_or_none()
    if not order:
        raise AppException(message="Session de commande introuvable", code="ORDER_NOT_FOUND", status_code=404)

    return {
        "session_id": session_id,
        "order_id": str(order.id),
        "order_number": order.order_number,
        "status": order.status.value,
        "paid": order.status.value == "paid",
        "total_cents": order.total_cents,
        "currency": order.currency,
    }


@router.post("/webhook/{provider}", summary="Ingest payment provider webhook")
async def handle_provider_webhook(
    provider: str,
    request: Request,
    stripe_signature: str | None = Header(None, alias="Stripe-Signature"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Ingest, verify HMAC signature, and idempotently process provider webhooks."""
    raw_body = await request.body()
    signature_header = stripe_signature or request.headers.get("X-Signature", "")
    return await BillingService.process_webhook(
        db=db,
        provider_name=provider,
        raw_body=raw_body,
        signature_header=signature_header,
    )


@router.get("/subscription", response_model=SubscriptionResponse, summary="Get current user subscription")
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionResponse:
    """Retrieve active subscription tier, renewal date, and cancellation status."""
    return await BillingService.get_user_subscription(db=db, user_id=current_user.id)


@router.post("/subscription/cancel", response_model=SubscriptionResponse, summary="Cancel subscription at period end")
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionResponse:
    """Schedule subscription cancellation at current period end, preserving access."""
    return await BillingService.cancel_subscription(db=db, user_id=current_user.id, at_period_end=True)


@router.post("/subscription/resume", response_model=SubscriptionResponse, summary="Resume cancelled subscription")
async def resume_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionResponse:
    """Resume an active subscription previously scheduled for cancellation."""
    return await BillingService.resume_subscription(db=db, user_id=current_user.id)


@router.get("/orders", response_model=list[OrderResponse], summary="List customer orders")
async def list_orders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[OrderResponse]:
    """Retrieve authenticated user's order and purchase history."""
    return await BillingService.get_orders(db=db, user_id=current_user.id)


@router.get("/orders/{order_id}", response_model=OrderResponse, summary="Get order details")
async def get_order(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    """Retrieve specific customer order (IDOR protected)."""
    stmt = (
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
    )
    order = (await db.execute(stmt)).scalar_one_or_none()
    if not order:
        raise AppException(message="Commande introuvable", code="ORDER_NOT_FOUND", status_code=404)

    if order.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise AppException(message="Accès refusé à cette commande", code="FORBIDDEN_ORDER_ACCESS", status_code=403)

    items = [
        OrderItemResponse(
            id=item.id,
            product_id=item.product_id,
            price_id=item.price_id,
            quantity=item.quantity,
            unit_price_cents=item.unit_price_cents,
            total_price_cents=item.total_price_cents,
            product_name=item.product.name if item.product else None,
        )
        for item in order.items
    ]
    return OrderResponse(
        id=order.id,
        order_number=order.order_number,
        user_id=order.user_id,
        status=order.status,
        currency=order.currency,
        subtotal_cents=order.subtotal_cents,
        tax_cents=order.tax_cents,
        total_cents=order.total_cents,
        refunded_amount_cents=order.refunded_amount_cents,
        provider=order.provider,
        provider_order_reference=order.provider_order_reference,
        paid_at=order.paid_at,
        refunded_at=order.refunded_at,
        created_at=order.created_at,
        items=items,
    )


@router.get("/credits", response_model=CreditBalanceResponse, summary="Get practice credits balance")
async def get_credits(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CreditBalanceResponse:
    """Retrieve remaining practice credits balance and active grant tranches."""
    return await BillingService.get_credit_balance(db=db, user_id=current_user.id)


@router.get("/usage", response_model=CreditUsageOverviewResponse, summary="Get credit ledger and usage history")
async def get_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CreditUsageOverviewResponse:
    """Retrieve detailed credit transaction history and feature consumptions."""
    balance = await CreditsService.get_balance(db, current_user.id)

    cons_stmt = (
        select(CreditConsumption)
        .where(CreditConsumption.user_id == current_user.id)
        .order_by(CreditConsumption.created_at.desc())
        .limit(50)
    )
    consumptions = list((await db.execute(cons_stmt)).scalars().all())

    grants_stmt = (
        select(CreditGrant)
        .where(CreditGrant.user_id == current_user.id)
        .order_by(CreditGrant.created_at.desc())
        .limit(50)
    )
    grants = list((await db.execute(grants_stmt)).scalars().all())

    return CreditUsageOverviewResponse(
        balance=balance,
        consumptions=[CreditConsumptionResponse.model_validate(c) for c in consumptions],
        grants=[CreditGrantResponse.model_validate(g) for g in grants],
    )


@router.get("/invoices", response_model=list[InvoiceResponse], summary="List past invoices/receipts")
async def get_invoices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[InvoiceResponse]:
    """Retrieve billing invoices and receipts."""
    return await BillingService.get_invoices(db=db, user_id=current_user.id)


@router.get("/entitlements", summary="Get active student feature entitlements")
async def get_entitlements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Inspect active feature access flags and limits."""
    return await EntitlementService.get_entitlements(db=db, user=current_user)


@router.post("/reservations", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED, summary="Hold teacher booking slot")
async def create_reservation(
    payload: ReservationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReservationResponse:
    """Acquire a temporary 15-minute hold on a teacher booking slot."""
    res = await TeacherBillingService.create_booking_reservation(
        db=db,
        student=current_user,
        teacher_id=payload.teacher_id,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )
    await db.commit()
    await db.refresh(res)
    return ReservationResponse.model_validate(res)


@router.post("/webhooks/{provider}", summary="Payment provider webhook endpoint")
async def receive_webhook(
    provider: str,
    request: Request,
    stripe_signature: str | None = Header(None, alias="Stripe-Signature"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Ingest, cryptographically verify, and idempotently process provider webhooks."""
    raw_body = await request.body()
    signature = stripe_signature or request.headers.get("X-Signature", "")
    return await BillingService.process_webhook(
        db=db,
        provider_name=provider.lower(),
        raw_body=raw_body,
        signature_header=signature,
    )


# ----------------------------------------------------
# 2. TEACHER EARNINGS ROUTER (/teacher/earnings)
# ----------------------------------------------------
teacher_billing_router = APIRouter(prefix="/teacher/earnings", tags=["Teacher Earnings"])


@teacher_billing_router.get("", response_model=list[TeacherEarningResponse], summary="List teacher lesson earnings")
async def list_teacher_earnings(
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[TeacherEarningResponse]:
    """Retrieve itemized earnings per completed lesson for authenticated teacher."""
    earnings = await TeacherBillingService.get_teacher_earnings(db=db, teacher_user_id=current_user.id)
    return [TeacherEarningResponse.model_validate(e) for e in earnings]


@teacher_billing_router.get("/summary", response_model=TeacherEarningsSummaryResponse, summary="Get teacher earnings summary")
async def get_teacher_earnings_summary(
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> TeacherEarningsSummaryResponse:
    """Retrieve gross earnings, platform commissions, and available balance."""
    data = await TeacherBillingService.get_teacher_earnings_summary(db=db, teacher_user_id=current_user.id)
    return TeacherEarningsSummaryResponse(**data)


# ----------------------------------------------------
# 3. ADMIN BILLING ROUTER (/admin/billing)
# ----------------------------------------------------
admin_billing_router = APIRouter(prefix="/admin/billing", tags=["Admin Billing"])


@admin_billing_router.get("/orders", response_model=list[OrderResponse], summary="Admin list orders")
async def admin_list_orders(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[OrderResponse]:
    """Admin inspect all platform customer orders."""
    return await AdminBillingService.get_all_orders(db=db, limit=limit, offset=offset)


@admin_billing_router.get("/subscriptions", response_model=list[SubscriptionResponse], summary="Admin list subscriptions")
async def admin_list_subscriptions(
    limit: int = 50,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[SubscriptionResponse]:
    """Admin inspect active and historical subscriptions."""
    stmt = select(Subscription).order_by(Subscription.created_at.desc()).options(selectinload(Subscription.product)).limit(limit)
    subs = list((await db.execute(stmt)).scalars().all())
    return [
        SubscriptionResponse(
            id=s.id,
            user_id=s.user_id,
            plan_tier=PlanTier.PRO_MONTHLY,
            status=s.status,
            current_period_start=s.current_period_start,
            current_period_end=s.current_period_end,
            cancel_at_period_end=s.cancel_at_period_end,
            product_id=s.product_id,
            price_id=s.price_id,
            provider=s.provider,
            provider_subscription_id=s.provider_subscription_id,
            cancelled_at=s.cancelled_at,
            product_name=s.product.name if s.product else None,
        )
        for s in subs
    ]


@admin_billing_router.get("/webhooks", response_model=list[PaymentWebhookEventResponse], summary="Admin inspect webhooks")
async def admin_list_webhooks(
    limit: int = 50,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[PaymentWebhookEventResponse]:
    """Admin inspect received payment webhooks and processing errors."""
    return await AdminBillingService.get_webhook_events(db=db, limit=limit)


@admin_billing_router.get("/ledger", response_model=list[BillingLedgerEntryResponse], summary="Admin inspect ledger")
async def admin_list_ledger(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[BillingLedgerEntryResponse]:
    """Admin inspect immutable double-entry financial ledger."""
    return await AdminBillingService.get_ledger_entries(db=db, limit=limit, offset=offset)


@admin_billing_router.post("/refunds", response_model=OrderResponse, summary="Admin issue refund")
async def admin_issue_refund(
    payload: AdminRefundRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    """Authorize and execute refund with reverse ledger entry and earning rollback."""
    order = await RefundService.process_refund(
        db=db,
        order_id=payload.order_id,
        amount_cents=payload.amount_cents,
        reason=payload.reason,
        actor_id=current_user.id,
    )
    await db.commit()
    return await BillingService.get_orders(db, order.user_id).then(lambda orders: next(o for o in orders if o.id == order.id)) if False else OrderResponse(
        id=order.id,
        order_number=order.order_number,
        user_id=order.user_id,
        status=order.status,
        currency=order.currency,
        subtotal_cents=order.subtotal_cents,
        tax_cents=order.tax_cents,
        total_cents=order.total_cents,
        refunded_amount_cents=order.refunded_amount_cents,
        provider=order.provider,
        provider_order_reference=order.provider_order_reference,
        paid_at=order.paid_at,
        refunded_at=order.refunded_at,
        created_at=order.created_at,
        items=[],
    )


@admin_billing_router.post("/grants", summary="Admin promotional or manual grant")
async def admin_create_grant(
    payload: AdminGrantRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Grant credits, subscription, or feature entitlements with audit logging."""
    res = await AdminBillingService.create_grant(db=db, admin_user=current_user, payload=payload)
    await db.commit()
    return res


@admin_billing_router.get("/teacher-earnings", response_model=list[TeacherEarningResponse], summary="Admin inspect all teacher earnings")
async def admin_list_teacher_earnings(
    limit: int = 50,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[TeacherEarningResponse]:
    """Admin inspect all teacher payouts and commissions."""
    return await AdminBillingService.get_all_teacher_earnings(db=db, limit=limit)


@admin_billing_router.get("/reconciliation", summary="Run billing reconciliation audit")
async def run_reconciliation(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Audit PostgreSQL financial state against invariants and compile findings."""
    report = await BillingReconciliationService.reconcile(db=db)
    return {
        "generated_at": report.generated_at.isoformat(),
        "total_findings": report.total_findings,
        "healthy": report.healthy,
        "findings": [
            {
                "category": f.category,
                "severity": f.severity,
                "reference_id": f.reference_id,
                "message": f.message,
                "details": f.details,
            }
            for f in report.findings
        ],
    }
