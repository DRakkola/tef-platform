"""Mock payment provider implementation for offline testing, sandboxing, and CI/CD."""

import datetime
import hashlib
import hmac
import json
import uuid

from app.core.exceptions import AppException
from app.integrations.payments.base import (
    CheckoutSessionParams,
    CheckoutSessionResult,
    PaymentProvider,
    PaymentResult,
    RefundResult,
    SubscriptionResult,
    WebhookEventPayload,
)


class MockPaymentProvider(PaymentProvider):
    """In-memory mock payment provider.

    Simulates Stripe hosted checkout, webhook verification, refunds, and subscriptions.
    """

    def __init__(self, webhook_secret: str = "mock_webhook_secret_for_tests") -> None:
        self.webhook_secret = webhook_secret
        self.sessions: dict[str, CheckoutSessionResult] = {}
        self.subscriptions: dict[str, SubscriptionResult] = {}
        self.refunds: dict[str, RefundResult] = {}
        self.payments: dict[str, PaymentResult] = {}

    async def create_checkout_session(self, params: CheckoutSessionParams) -> CheckoutSessionResult:
        session_id = f"cs_mock_{uuid.uuid4().hex[:16]}"
        checkout_url = f"https://checkout.tef.local/pay/{session_id}"
        payment_intent_id = f"pi_mock_{uuid.uuid4().hex[:16]}" if params.mode == "payment" else None
        subscription_id = f"sub_mock_{uuid.uuid4().hex[:16]}" if params.mode == "subscription" else None
        customer_id = f"cus_mock_{uuid.uuid4().hex[:16]}"

        result = CheckoutSessionResult(
            session_id=session_id,
            checkout_url=checkout_url,
            provider="mock",
            status="open",
            amount_total=params.amount_cents,
            currency=params.currency.lower(),
            payment_intent_id=payment_intent_id,
            subscription_id=subscription_id,
            customer_id=customer_id,
            metadata=dict(params.metadata),
        )
        self.sessions[session_id] = result
        return result

    async def retrieve_checkout_session(self, session_id: str) -> CheckoutSessionResult:
        if session_id not in self.sessions:
            raise AppException(
                message="Checkout session not found on payment provider",
                code="CHECKOUT_SESSION_NOT_FOUND",
                status_code=404,
            )
        return self.sessions[session_id]

    async def cancel_subscription(
        self, provider_sub_id: str, at_period_end: bool = True
    ) -> SubscriptionResult:
        now = datetime.datetime.now(datetime.UTC)
        if provider_sub_id in self.subscriptions:
            current = self.subscriptions[provider_sub_id]
            updated = SubscriptionResult(
                provider_subscription_id=current.provider_subscription_id,
                provider_customer_id=current.provider_customer_id,
                status="cancelled" if not at_period_end else current.status,
                current_period_start=current.current_period_start,
                current_period_end=current.current_period_end,
                cancel_at_period_end=at_period_end,
                cancelled_at=now,
                metadata=current.metadata,
            )
        else:
            updated = SubscriptionResult(
                provider_subscription_id=provider_sub_id,
                provider_customer_id=f"cus_mock_{uuid.uuid4().hex[:16]}",
                status="cancelled" if not at_period_end else "active",
                current_period_start=now - datetime.timedelta(days=1),
                current_period_end=now + datetime.timedelta(days=29),
                cancel_at_period_end=at_period_end,
                cancelled_at=now,
            )
        self.subscriptions[provider_sub_id] = updated
        return updated

    async def resume_subscription(self, provider_sub_id: str) -> SubscriptionResult:
        now = datetime.datetime.now(datetime.UTC)
        if provider_sub_id in self.subscriptions:
            current = self.subscriptions[provider_sub_id]
            updated = SubscriptionResult(
                provider_subscription_id=current.provider_subscription_id,
                provider_customer_id=current.provider_customer_id,
                status="active",
                current_period_start=current.current_period_start,
                current_period_end=current.current_period_end,
                cancel_at_period_end=False,
                cancelled_at=None,
                metadata=current.metadata,
            )
        else:
            updated = SubscriptionResult(
                provider_subscription_id=provider_sub_id,
                provider_customer_id=f"cus_mock_{uuid.uuid4().hex[:16]}",
                status="active",
                current_period_start=now - datetime.timedelta(days=1),
                current_period_end=now + datetime.timedelta(days=29),
                cancel_at_period_end=False,
                cancelled_at=None,
            )
        self.subscriptions[provider_sub_id] = updated
        return updated

    async def get_subscription(self, provider_sub_id: str) -> SubscriptionResult:
        if provider_sub_id in self.subscriptions:
            return self.subscriptions[provider_sub_id]
        now = datetime.datetime.now(datetime.UTC)
        sub = SubscriptionResult(
            provider_subscription_id=provider_sub_id,
            provider_customer_id=f"cus_mock_{uuid.uuid4().hex[:16]}",
            status="active",
            current_period_start=now - datetime.timedelta(days=15),
            current_period_end=now + datetime.timedelta(days=15),
            cancel_at_period_end=False,
        )
        self.subscriptions[provider_sub_id] = sub
        return sub

    async def create_refund(
        self, payment_ref: str, amount_cents: int, reason: str = "requested_by_customer"
    ) -> RefundResult:
        refund_id = f"re_mock_{uuid.uuid4().hex[:16]}"
        res = RefundResult(
            refund_id=refund_id,
            payment_reference=payment_ref,
            amount_cents=amount_cents,
            currency="eur",
            status="succeeded",
            reason=reason,
        )
        self.refunds[refund_id] = res
        return res

    def generate_webhook_signature(self, raw_body: bytes, timestamp: int | None = None) -> str:
        """Utility to generate a valid signature header for testing webhook ingestion."""
        if timestamp is None:
            timestamp = int(datetime.datetime.now(datetime.UTC).timestamp())
        payload = f"{timestamp}.".encode() + raw_body
        mac = hmac.new(self.webhook_secret.encode(), payload, hashlib.sha256).hexdigest()
        return f"t={timestamp},v1={mac}"

    def verify_webhook(self, raw_body: bytes, signature_header: str) -> WebhookEventPayload:
        if not signature_header:
            raise AppException(
                message="Missing webhook signature header",
                code="INVALID_WEBHOOK_SIGNATURE",
                status_code=400,
            )

        parts: dict[str, str] = {}
        for item in signature_header.split(","):
            if "=" in item:
                k, v = item.split("=", 1)
                parts[k.strip()] = v.strip()

        timestamp_str = parts.get("t")
        v1_sig = parts.get("v1")

        if not timestamp_str or not v1_sig:
            raise AppException(
                message="Malformed webhook signature format",
                code="INVALID_WEBHOOK_SIGNATURE",
                status_code=400,
            )

        expected_mac = hmac.new(
            self.webhook_secret.encode(),
            f"{timestamp_str}.".encode() + raw_body,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_mac, v1_sig):
            raise AppException(
                message="Invalid cryptographic signature on payment webhook",
                code="INVALID_WEBHOOK_SIGNATURE",
                status_code=400,
            )

        try:
            payload_dict = json.loads(raw_body.decode("utf-8"))
        except Exception as err:
            raise AppException(
                message="Malformed JSON body in webhook request",
                code="MALFORMED_WEBHOOK_BODY",
                status_code=400,
            ) from err

        event_id = payload_dict.get("id", f"evt_mock_{uuid.uuid4().hex[:16]}")
        event_type = payload_dict.get("type", "unknown")
        created_ts = payload_dict.get("created", int(datetime.datetime.now(datetime.UTC).timestamp()))
        created_at = datetime.datetime.fromtimestamp(created_ts, tz=datetime.UTC)
        data = payload_dict.get("data", {}).get("object", {})

        return WebhookEventPayload(
            provider="mock",
            event_id=event_id,
            event_type=event_type,
            created_at=created_at,
            data=data,
            raw_payload=payload_dict,
        )

    async def retrieve_payment(self, payment_id: str) -> PaymentResult:
        if payment_id in self.payments:
            return self.payments[payment_id]
        return PaymentResult(
            payment_id=payment_id,
            amount_cents=2900,
            currency="eur",
            status="succeeded",
            paid_at=datetime.datetime.now(datetime.UTC),
        )
