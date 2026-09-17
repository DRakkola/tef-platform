"""Service layer for billing, subscriptions, and student credits."""

import uuid
from datetime import UTC, datetime, timedelta

from app.modules.billing.schemas import (
    CreditBalanceResponse,
    InvoiceResponse,
    PlanTier,
    SubscriptionResponse,
    SubscriptionStatus,
)


class BillingService:
    """Mock-safe billing and credit service."""

    @classmethod
    async def get_user_subscription(cls, user_id: uuid.UUID) -> SubscriptionResponse:
        now = datetime.now(UTC)
        return SubscriptionResponse(
            id=uuid.uuid5(uuid.NAMESPACE_DNS, f"sub-{user_id}"),
            user_id=user_id,
            plan_tier=PlanTier.FREE,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now - timedelta(days=15),
            current_period_end=now + timedelta(days=15),
            cancel_at_period_end=False,
        )

    @classmethod
    async def get_credit_balance(cls, user_id: uuid.UUID) -> CreditBalanceResponse:
        return CreditBalanceResponse(
            user_id=user_id,
            speaking_credits=5,
            writing_credits=3,
            tutoring_hours=2.0,
        )

    @classmethod
    async def get_invoices(cls, user_id: uuid.UUID) -> list[InvoiceResponse]:
        now = datetime.now(UTC)
        return [
            InvoiceResponse(
                id=f"in_{str(user_id)[:8]}_01",
                amount_cents=2900,
                currency="eur",
                status="paid",
                created_at=now - timedelta(days=30),
                pdf_url=None,
            )
        ]
