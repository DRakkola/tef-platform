"""Stripe payment provider adapter using official Stripe SDK."""

import datetime
from typing import Any

import stripe

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


class StripePaymentProvider(PaymentProvider):
    """Production adapter for Stripe hosted checkout, webhooks, and subscription lifecycle."""

    def __init__(self, api_key: str, webhook_secret: str) -> None:
        self.api_key = api_key
        self.webhook_secret = webhook_secret
        stripe.api_key = api_key

    async def create_checkout_session(self, params: CheckoutSessionParams) -> CheckoutSessionResult:
        try:
            line_items = [
                {
                    "price_data": {
                        "currency": params.currency.lower(),
                        "product_data": {
                            "name": params.product_name,
                        },
                        "unit_amount": params.amount_cents,
                        **(
                            {"recurring": {"interval": "month"}}
                            if params.mode == "subscription"
                            else {}
                        ),
                    },
                    "quantity": 1,
                }
            ]

            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=line_items,
                mode=params.mode,
                success_url=params.success_url,
                cancel_url=params.cancel_url,
                client_reference_id=params.client_reference_id,
                customer_email=params.user_email,
                metadata={
                    **params.metadata,
                    "user_id": str(params.user_id),
                    "product_id": str(params.product_id),
                    "price_id": str(params.price_id),
                },
            )

            return CheckoutSessionResult(
                session_id=session.id,
                checkout_url=session.url or "",
                provider="stripe",
                status=session.status or "open",
                amount_total=session.amount_total or params.amount_cents,
                currency=session.currency or params.currency.lower(),
                payment_intent_id=session.payment_intent if isinstance(session.payment_intent, str) else None,
                subscription_id=session.subscription if isinstance(session.subscription, str) else None,
                customer_id=session.customer if isinstance(session.customer, str) else None,
                metadata=dict(session.metadata or {}),
            )
        except stripe.StripeError as err:
            raise AppException(
                message=f"Stripe error creating checkout session: {err!s}",
                code="PAYMENT_PROVIDER_ERROR",
                status_code=502,
            ) from err

    async def retrieve_checkout_session(self, session_id: str) -> CheckoutSessionResult:
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            return CheckoutSessionResult(
                session_id=session.id,
                checkout_url=session.url or "",
                provider="stripe",
                status=session.status or "unknown",
                amount_total=session.amount_total or 0,
                currency=session.currency or "eur",
                payment_intent_id=session.payment_intent if isinstance(session.payment_intent, str) else None,
                subscription_id=session.subscription if isinstance(session.subscription, str) else None,
                customer_id=session.customer if isinstance(session.customer, str) else None,
                metadata=dict(session.metadata or {}),
            )
        except stripe.StripeError as err:
            raise AppException(
                message=f"Stripe error retrieving session: {err!s}",
                code="PAYMENT_PROVIDER_ERROR",
                status_code=502,
            ) from err

    async def cancel_subscription(
        self, provider_sub_id: str, at_period_end: bool = True
    ) -> SubscriptionResult:
        try:
            if at_period_end:
                sub = stripe.Subscription.modify(provider_sub_id, cancel_at_period_end=True)
            else:
                sub = stripe.Subscription.cancel(provider_sub_id)

            return self._format_subscription(sub)
        except stripe.StripeError as err:
            raise AppException(
                message=f"Stripe error modifying subscription: {err!s}",
                code="PAYMENT_PROVIDER_ERROR",
                status_code=502,
            ) from err

    async def resume_subscription(self, provider_sub_id: str) -> SubscriptionResult:
        try:
            sub = stripe.Subscription.modify(provider_sub_id, cancel_at_period_end=False)
            return self._format_subscription(sub)
        except stripe.StripeError as err:
            raise AppException(
                message=f"Stripe error resuming subscription: {err!s}",
                code="PAYMENT_PROVIDER_ERROR",
                status_code=502,
            ) from err

    async def get_subscription(self, provider_sub_id: str) -> SubscriptionResult:
        try:
            sub = stripe.Subscription.retrieve(provider_sub_id)
            return self._format_subscription(sub)
        except stripe.StripeError as err:
            raise AppException(
                message=f"Stripe error retrieving subscription: {err!s}",
                code="PAYMENT_PROVIDER_ERROR",
                status_code=502,
            ) from err

    async def create_refund(
        self, payment_ref: str, amount_cents: int, reason: str = "requested_by_customer"
    ) -> RefundResult:
        try:
            refund = stripe.Refund.create(
                payment_intent=payment_ref,
                amount=amount_cents,
                reason=reason if reason in ["duplicate", "fraudulent", "requested_by_customer"] else "requested_by_customer",
            )
            return RefundResult(
                refund_id=refund.id,
                payment_reference=payment_ref,
                amount_cents=refund.amount or amount_cents,
                currency=refund.currency or "eur",
                status=refund.status or "succeeded",
                reason=refund.reason,
            )
        except stripe.StripeError as err:
            raise AppException(
                message=f"Stripe error issuing refund: {err!s}",
                code="PAYMENT_PROVIDER_ERROR",
                status_code=502,
            ) from err

    def verify_webhook(self, raw_body: bytes, signature_header: str) -> WebhookEventPayload:
        try:
            event = stripe.Webhook.construct_event(
                payload=raw_body,
                sig_header=signature_header,
                secret=self.webhook_secret,
            )
            data_obj = event.data.object if hasattr(event.data, "object") else {}
            data_dict = data_obj if isinstance(data_obj, dict) else (getattr(data_obj, "__dict__", {}) or {})

            created_ts = getattr(event, "created", int(datetime.datetime.now(datetime.UTC).timestamp()))
            created_at = datetime.datetime.fromtimestamp(created_ts, tz=datetime.UTC)

            return WebhookEventPayload(
                provider="stripe",
                event_id=event.id,
                event_type=event.type,
                created_at=created_at,
                data=data_dict,
                raw_payload=dict(event),
            )
        except (stripe.SignatureVerificationError, ValueError) as err:
            raise AppException(
                message=f"Invalid webhook signature: {err!s}",
                code="INVALID_WEBHOOK_SIGNATURE",
                status_code=400,
            ) from err

    async def retrieve_payment(self, payment_id: str) -> PaymentResult:
        try:
            pi = stripe.PaymentIntent.retrieve(payment_id)
            created_at = (
                datetime.datetime.fromtimestamp(pi.created, tz=datetime.UTC)
                if getattr(pi, "created", None)
                else None
            )
            return PaymentResult(
                payment_id=pi.id,
                amount_cents=pi.amount or 0,
                currency=pi.currency or "eur",
                status=pi.status or "unknown",
                paid_at=created_at,
            )
        except stripe.StripeError as err:
            raise AppException(
                message=f"Stripe error retrieving payment: {err!s}",
                code="PAYMENT_PROVIDER_ERROR",
                status_code=502,
            ) from err

    @staticmethod
    def _format_subscription(sub: Any) -> SubscriptionResult:
        period_start_ts = getattr(sub, "current_period_start", None) or int(
            datetime.datetime.now(datetime.UTC).timestamp()
        )
        period_end_ts = getattr(sub, "current_period_end", None) or int(
            (datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30)).timestamp()
        )
        canceled_ts = getattr(sub, "canceled_at", None)

        return SubscriptionResult(
            provider_subscription_id=sub.id,
            provider_customer_id=sub.customer if isinstance(sub.customer, str) else None,
            status=sub.status or "active",
            current_period_start=datetime.datetime.fromtimestamp(period_start_ts, tz=datetime.UTC),
            current_period_end=datetime.datetime.fromtimestamp(period_end_ts, tz=datetime.UTC),
            cancel_at_period_end=bool(getattr(sub, "cancel_at_period_end", False)),
            cancelled_at=datetime.datetime.fromtimestamp(canceled_ts, tz=datetime.UTC) if canceled_ts else None,
            metadata=dict(getattr(sub, "metadata", {}) or {}),
        )
