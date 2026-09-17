"""FastAPI router for billing, subscriptions, and student credits."""

from fastapi import APIRouter, Depends

from app.modules.auth.dependencies import get_current_user
from app.modules.billing.schemas import (
    CreditBalanceResponse,
    InvoiceResponse,
    SubscriptionResponse,
)
from app.modules.billing.service import BillingService
from app.modules.users.models import User

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get(
    "/subscription",
    response_model=SubscriptionResponse,
    summary="Get current user subscription status",
)
async def get_subscription(
    current_user: User = Depends(get_current_user),
) -> SubscriptionResponse:
    """Retrieve active subscription tier and period details."""
    return await BillingService.get_user_subscription(user_id=current_user.id)


@router.get(
    "/credits",
    response_model=CreditBalanceResponse,
    summary="Get current user practice credits balance",
)
async def get_credits(
    current_user: User = Depends(get_current_user),
) -> CreditBalanceResponse:
    """Retrieve remaining speaking, writing, and tutoring credits."""
    return await BillingService.get_credit_balance(user_id=current_user.id)


@router.get(
    "/invoices",
    response_model=list[InvoiceResponse],
    summary="List past invoices and receipts",
)
async def get_invoices(
    current_user: User = Depends(get_current_user),
) -> list[InvoiceResponse]:
    """Retrieve billing history and invoices."""
    return await BillingService.get_invoices(user_id=current_user.id)
