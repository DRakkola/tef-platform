"""Administrative billing service for audit, orders, ledger, and promotional grants."""

import datetime
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.modules.billing.credits_service import CreditsService
from app.modules.billing.enums import (
    CreditGrantType,
    LedgerEntryType,
    SubscriptionStatus,
)
from app.modules.billing.models import (
    BillingLedgerEntry,
    Order,
    OrderItem,
    PaymentWebhookEvent,
    Product,
    Subscription,
    TeacherEarning,
    UserEntitlementGrant,
)
from app.modules.billing.schemas import (
    AdminGrantRequest,
    BillingLedgerEntryResponse,
    OrderItemResponse,
    OrderResponse,
    PaymentWebhookEventResponse,
    TeacherEarningResponse,
)
from app.modules.users.models import User


class AdminBillingService:
    """Service supporting administrative oversight of the monetization subsystem."""

    @classmethod
    async def get_all_orders(
        cls,
        db: AsyncSession,
        limit: int = 50,
        offset: int = 0,
    ) -> list[OrderResponse]:
        """List all platform orders for administrator inspection."""
        stmt = (
            select(Order)
            .order_by(Order.created_at.desc())
            .options(
                selectinload(Order.items).selectinload(OrderItem.product),
            )
            .limit(limit)
            .offset(offset)
        )
        orders = list((await db.execute(stmt)).scalars().all())
        responses: list[OrderResponse] = []
        for o in orders:
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
                for item in o.items
            ]
            responses.append(
                OrderResponse(
                    id=o.id,
                    order_number=o.order_number,
                    user_id=o.user_id,
                    status=o.status,
                    currency=o.currency,
                    subtotal_cents=o.subtotal_cents,
                    tax_cents=o.tax_cents,
                    total_cents=o.total_cents,
                    refunded_amount_cents=o.refunded_amount_cents,
                    provider=o.provider,
                    provider_order_reference=o.provider_order_reference,
                    paid_at=o.paid_at,
                    refunded_at=o.refunded_at,
                    created_at=o.created_at,
                    items=items,
                )
            )
        return responses

    @classmethod
    async def get_ledger_entries(
        cls,
        db: AsyncSession,
        limit: int = 50,
        offset: int = 0,
    ) -> list[BillingLedgerEntryResponse]:
        """Fetch immutable double-entry ledger records."""
        stmt = (
            select(BillingLedgerEntry)
            .order_by(BillingLedgerEntry.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        entries = list((await db.execute(stmt)).scalars().all())
        return [BillingLedgerEntryResponse.model_validate(e) for e in entries]

    @classmethod
    async def get_webhook_events(
        cls,
        db: AsyncSession,
        limit: int = 50,
    ) -> list[PaymentWebhookEventResponse]:
        """List received payment provider webhook events."""
        stmt = (
            select(PaymentWebhookEvent)
            .order_by(PaymentWebhookEvent.received_at.desc())
            .limit(limit)
        )
        events = list((await db.execute(stmt)).scalars().all())
        return [PaymentWebhookEventResponse.model_validate(e) for e in events]

    @classmethod
    async def get_all_teacher_earnings(
        cls,
        db: AsyncSession,
        limit: int = 50,
    ) -> list[TeacherEarningResponse]:
        """List teacher marketplace earnings."""
        stmt = (
            select(TeacherEarning)
            .order_by(TeacherEarning.created_at.desc())
            .limit(limit)
        )
        earnings = list((await db.execute(stmt)).scalars().all())
        return [TeacherEarningResponse.model_validate(e) for e in earnings]

    @classmethod
    async def create_grant(
        cls,
        db: AsyncSession,
        admin_user: User,
        payload: AdminGrantRequest,
    ) -> dict[str, Any]:
        """Admin grants credits, subscription access, or custom entitlement with audit trail."""
        # 1. Verify target user
        user_stmt = select(User).where(User.id == payload.user_id)
        target_user = (await db.execute(user_stmt)).scalar_one_or_none()
        if not target_user:
            raise AppException(
                message="Utilisateur cible introuvable.",
                code="USER_NOT_FOUND",
                status_code=404,
            )

        now_utc = datetime.datetime.now(datetime.UTC)

        if payload.grant_type == "credits":
            try:
                credits_amount = int(payload.amount_or_sku)
            except ValueError as err:
                raise AppException(
                    message="Pour un octroi de crédits, le montant doit être un entier valide.",
                    code="INVALID_GRANT_AMOUNT",
                    status_code=400,
                ) from err

            grant = await CreditsService.grant_credits(
                db=db,
                user_id=payload.user_id,
                amount=credits_amount,
                grant_type=CreditGrantType.ADMIN_GRANT,
                reason=payload.reason,
                granted_by_user_id=admin_user.id,
                expires_at=payload.expires_at,
            )
            return {
                "status": "success",
                "grant_type": "credits",
                "grant_id": str(grant.id),
                "credits_granted": credits_amount,
                "reason": payload.reason,
            }

        elif payload.grant_type == "entitlement":
            grant = UserEntitlementGrant(
                user_id=payload.user_id,
                feature_key=payload.amount_or_sku,
                source="admin_grant",
                granted_by_user_id=admin_user.id,
                reason=payload.reason,
                expires_at=payload.expires_at,
                is_active=True,
            )
            db.add(grant)
            await db.flush()
            return {
                "status": "success",
                "grant_type": "entitlement",
                "feature_key": payload.amount_or_sku,
                "reason": payload.reason,
            }

        elif payload.grant_type == "subscription":
            # Find product by SKU
            prod_stmt = select(Product).where(Product.sku == payload.amount_or_sku).options(selectinload(Product.prices))
            product = (await db.execute(prod_stmt)).scalar_one_or_none()
            if not product or not product.prices:
                raise AppException(
                    message=f"Produit avec SKU '{payload.amount_or_sku}' introuvable.",
                    code="PRODUCT_NOT_FOUND",
                    status_code=404,
                )
            price = product.prices[0]
            expires = payload.expires_at or (now_utc + datetime.timedelta(days=30))

            sub = Subscription(
                user_id=payload.user_id,
                product_id=product.id,
                price_id=price.id,
                provider="admin_grant",
                provider_subscription_id=f"sub_admin_{uuid.uuid4().hex[:12]}",
                status=SubscriptionStatus.ACTIVE,
                current_period_start=now_utc,
                current_period_end=expires,
            )
            db.add(sub)
            db.add(
                BillingLedgerEntry(
                    user_id=payload.user_id,
                    entry_type=LedgerEntryType.ADJUSTMENT,
                    amount_cents=0,
                    currency="EUR",
                    reference_type="admin_subscription_grant",
                    reference_id=str(sub.id),
                    provider="admin",
                    description=f"Octroi administratif par {admin_user.id} : {payload.reason}",
                )
            )
            await db.flush()
            return {
                "status": "success",
                "grant_type": "subscription",
                "subscription_id": str(sub.id),
                "sku": product.sku,
                "expires_at": expires.isoformat(),
            }

        raise AppException(
            message=f"Type d'octroi '{payload.grant_type}' non supporté.",
            code="UNSUPPORTED_GRANT_TYPE",
            status_code=400,
        )
