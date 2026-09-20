"""Payment and Payout provider protocols and domain transfer objects."""

import datetime
import uuid
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class CheckoutSessionParams:
    """Parameters required to initialize a provider-hosted checkout session."""

    user_id: uuid.UUID
    user_email: str
    product_id: uuid.UUID
    price_id: uuid.UUID
    product_name: str
    amount_cents: int
    currency: str
    mode: str  # "payment" | "subscription"
    success_url: str
    cancel_url: str
    client_reference_id: str
    metadata: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class CheckoutSessionResult:
    """Result of creating or retrieving a checkout session."""

    session_id: str
    checkout_url: str
    provider: str
    status: str
    amount_total: int
    currency: str
    payment_intent_id: str | None = None
    subscription_id: str | None = None
    customer_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SubscriptionResult:
    """Normalized subscription details returned from the payment provider."""

    provider_subscription_id: str
    provider_customer_id: str | None
    status: str
    current_period_start: datetime.datetime
    current_period_end: datetime.datetime
    cancel_at_period_end: bool
    cancelled_at: datetime.datetime | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class RefundResult:
    """Normalized refund details from the payment provider."""

    refund_id: str
    payment_reference: str
    amount_cents: int
    currency: str
    status: str
    reason: str | None = None


@dataclass(frozen=True)
class PaymentResult:
    """Normalized payment transaction status from the payment provider."""

    payment_id: str
    amount_cents: int
    currency: str
    status: str
    paid_at: datetime.datetime | None = None


@dataclass(frozen=True)
class WebhookEventPayload:
    """Verified webhook payload normalized across providers."""

    provider: str
    event_id: str
    event_type: str
    created_at: datetime.datetime
    data: dict[str, Any]
    raw_payload: dict[str, Any]


class PaymentProvider(Protocol):
    """Abstract interface decoupling domain logic from specific payment gateways."""

    async def create_checkout_session(self, params: CheckoutSessionParams) -> CheckoutSessionResult:
        """Create a hosted checkout session."""
        ...

    async def retrieve_checkout_session(self, session_id: str) -> CheckoutSessionResult:
        """Retrieve state of an existing checkout session."""
        ...

    async def cancel_subscription(
        self, provider_sub_id: str, at_period_end: bool = True
    ) -> SubscriptionResult:
        """Cancel an active subscription either immediately or at period end."""
        ...

    async def resume_subscription(self, provider_sub_id: str) -> SubscriptionResult:
        """Resume a subscription that was previously scheduled for cancellation at period end."""
        ...

    async def get_subscription(self, provider_sub_id: str) -> SubscriptionResult:
        """Retrieve subscription state directly from the provider."""
        ...

    async def create_refund(
        self, payment_ref: str, amount_cents: int, reason: str = "requested_by_customer"
    ) -> RefundResult:
        """Issue a full or partial refund for a processed payment."""
        ...

    def verify_webhook(self, raw_body: bytes, signature_header: str) -> WebhookEventPayload:
        """Cryptographically verify the incoming webhook signature and parse the event."""
        ...

    async def retrieve_payment(self, payment_id: str) -> PaymentResult:
        """Fetch status and details of a specific payment charge."""
        ...


class PayoutProvider(Protocol):
    """Abstract interface for teacher marketplace payouts."""

    async def create_payout_recipient(
        self, teacher_id: uuid.UUID, email: str, details: dict[str, Any]
    ) -> dict[str, Any]:
        """Register a teacher recipient account."""
        ...

    async def retrieve_recipient(self, recipient_id: str) -> dict[str, Any]:
        """Fetch recipient account status."""
        ...

    async def create_payout(
        self, recipient_id: str, amount_cents: int, currency: str, reference: str
    ) -> dict[str, Any]:
        """Initiate transfer to teacher account."""
        ...

    async def get_payout_status(self, payout_id: str) -> dict[str, Any]:
        """Fetch status of an initiated payout."""
        ...
