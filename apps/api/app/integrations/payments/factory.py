"""Factory and dependency injection for payment and payout providers."""

import os
from functools import lru_cache

from app.core.config import settings
from app.integrations.payments.base import PaymentProvider, PayoutProvider
from app.integrations.payments.mock_adapter import MockPaymentProvider
from app.integrations.payments.stripe_adapter import StripePaymentProvider


class MockPayoutProvider(PayoutProvider):
    """In-memory placeholder payout provider for teacher earnings."""

    async def create_payout_recipient(
        self, teacher_id, email, details
    ):
        return {"recipient_id": f"rec_mock_{str(teacher_id)[:8]}", "status": "active"}

    async def retrieve_recipient(self, recipient_id):
        return {"recipient_id": recipient_id, "status": "active"}

    async def create_payout(
        self, recipient_id, amount_cents, currency, reference
    ):
        return {
            "payout_id": f"po_mock_{reference}",
            "amount_cents": amount_cents,
            "currency": currency,
            "status": "pending",
        }

    async def get_payout_status(self, payout_id):
        return {"payout_id": payout_id, "status": "paid"}


_mock_payment_provider: MockPaymentProvider | None = None


def get_mock_payment_provider() -> MockPaymentProvider:
    """Return a singleton mock provider instance for testing inspection."""
    global _mock_payment_provider
    if _mock_payment_provider is None:
        _mock_payment_provider = MockPaymentProvider()
    return _mock_payment_provider


def get_payment_provider() -> PaymentProvider:
    """Resolve active payment provider based on configuration.

    In production/staging with Stripe credentials, instantiate StripePaymentProvider.
    In development/testing or absent credentials, instantiate MockPaymentProvider.
    """
    stripe_key = os.getenv("STRIPE_SECRET_KEY")
    stripe_webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    if stripe_key and stripe_webhook_secret and getattr(settings, "PAYMENT_PROVIDER", "stripe") == "stripe":
        return StripePaymentProvider(
            api_key=stripe_key,
            webhook_secret=stripe_webhook_secret,
        )

    return get_mock_payment_provider()


@lru_cache
def get_payout_provider() -> PayoutProvider:
    """Resolve active payout provider for teacher marketplace."""
    return MockPayoutProvider()
