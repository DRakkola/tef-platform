"""Authoritative billing service handling catalog, orders, checkout, webhooks, and subscriptions."""

import datetime
import hashlib
import uuid
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.integrations.payments.base import CheckoutSessionParams
from app.integrations.payments.factory import get_payment_provider
from app.modules.billing.credits_service import CreditsService
from app.modules.billing.enums import (
    CreditGrantType,
    LedgerEntryType,
    OrderStatus,
    PlanTier,
    ProductType,
    SubscriptionStatus,
    WebhookEventStatus,
)
from app.modules.billing.models import (
    BillingLedgerEntry,
    BookingReservation,
    CreditGrant,
    Order,
    OrderItem,
    PaymentWebhookEvent,
    Product,
    ProductPrice,
    Subscription,
    UserEntitlementGrant,
)
from app.modules.billing.schemas import (
    CheckoutRequest,
    CheckoutResponse,
    CreditBalanceResponse,
    CreditGrantResponse,
    InvoiceResponse,
    OrderItemResponse,
    OrderResponse,
    ProductEntitlementResponse,
    ProductPriceResponse,
    ProductResponse,
    SubscriptionResponse,
)
from app.modules.billing.tax_service import TaxService
from app.modules.billing.teacher_billing import TeacherBillingService
from app.modules.notifications.schemas import NotificationType
from app.modules.notifications.service import NotificationService
from app.modules.users.models import User

logger = structlog.get_logger("tef-api.billing")


class BillingService:
    """Core domain service for billing, catalog, checkout, and webhook ingestion."""

    # ----------------------------------------------------
    # CATALOG
    # ----------------------------------------------------

    @classmethod
    async def get_products(
        cls, db: AsyncSession, active_only: bool = True
    ) -> list[ProductResponse]:
        """Fetch platform products with attached prices and entitlements."""
        stmt = (
            select(Product)
            .options(
                selectinload(Product.prices),
                selectinload(Product.entitlements),
            )
            .order_by(Product.created_at.asc())
        )
        if active_only:
            stmt = stmt.where(Product.is_active == True)

        products = list((await db.execute(stmt)).scalars().all())
        responses: list[ProductResponse] = []
        for p in products:
            prices = [
                ProductPriceResponse.model_validate(pr)
                for pr in p.prices
                if (not active_only or pr.is_active)
            ]
            entitlements = [
                ProductEntitlementResponse.model_validate(ent) for ent in p.entitlements
            ]
            responses.append(
                ProductResponse(
                    id=p.id,
                    sku=p.sku,
                    name=p.name,
                    description=p.description,
                    product_type=p.product_type,
                    is_active=p.is_active,
                    metadata_=p.metadata_ or {},
                    prices=prices,
                    entitlements=entitlements,
                )
            )
        return responses

    @classmethod
    async def get_product(cls, db: AsyncSession, product_id: uuid.UUID) -> ProductResponse:
        """Fetch a specific product by ID."""
        stmt = (
            select(Product)
            .where(Product.id == product_id)
            .options(
                selectinload(Product.prices),
                selectinload(Product.entitlements),
            )
        )
        p = (await db.execute(stmt)).scalar_one_or_none()
        if not p:
            raise AppException(
                message="Produit introuvable",
                code="PRODUCT_NOT_FOUND",
                status_code=404,
            )
        return ProductResponse(
            id=p.id,
            sku=p.sku,
            name=p.name,
            description=p.description,
            product_type=p.product_type,
            is_active=p.is_active,
            metadata_=p.metadata_ or {},
            prices=[ProductPriceResponse.model_validate(pr) for pr in p.prices],
            entitlements=[ProductEntitlementResponse.model_validate(ent) for ent in p.entitlements],
        )

    # ----------------------------------------------------
    # CHECKOUT
    # ----------------------------------------------------

    @classmethod
    async def create_checkout_session(
        cls,
        db: AsyncSession,
        user: User,
        payload: CheckoutRequest,
        base_url: str = "http://localhost:5173",
    ) -> CheckoutResponse:
        """Create order and launch hosted payment checkout session with price integrity."""
        # 1. Resolve Price and Product server-side (Never trust client prices)
        price_stmt = (
            select(ProductPrice)
            .where(ProductPrice.id == payload.price_id, ProductPrice.is_active == True)
            .options(selectinload(ProductPrice.product))
        )
        price = (await db.execute(price_stmt)).scalar_one_or_none()
        if not price or not price.product:
            raise AppException(
                message="Tarif introuvable ou inactif",
                code="PRICE_NOT_FOUND",
                status_code=404,
            )

        product = price.product
        subtotal_cents = price.amount_cents

        # 2. Server-side discount calculation if coupon provided
        discount_cents = 0
        if payload.coupon_code:
            # Simple coupon lookup
            from app.modules.billing.models import Coupon

            coupon_stmt = select(Coupon).where(
                Coupon.code == payload.coupon_code.strip().upper(),
                Coupon.is_active == True,
            )
            coupon = (await db.execute(coupon_stmt)).scalar_one_or_none()
            if coupon:
                if coupon.discount_type == "percentage":
                    discount_cents = (subtotal_cents * coupon.discount_value) // 100
                elif coupon.discount_type == "fixed_amount":
                    discount_cents = min(subtotal_cents, coupon.discount_value)
                coupon.times_redeemed += 1

        discounted_subtotal = max(0, subtotal_cents - discount_cents)

        # 3. Calculate tax
        tax_res = TaxService.calculate_tax(discounted_subtotal)
        total_cents = tax_res.total_cents

        # 4. Generate unique order number
        today_str = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d")
        order_number = f"TEF-ORD-{today_str}-{uuid.uuid4().hex[:8].upper()}"

        order = Order(
            order_number=order_number,
            user_id=user.id,
            status=OrderStatus.PENDING,
            currency=price.currency,
            subtotal_cents=discounted_subtotal,
            tax_cents=tax_res.tax_cents,
            total_cents=total_cents,
            provider="stripe",
            metadata_={
                **payload.metadata,
                "reservation_id": str(payload.reservation_id) if payload.reservation_id else None,
                "coupon_code": payload.coupon_code,
            },
        )
        db.add(order)
        await db.flush()

        order_item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            price_id=price.id,
            quantity=1,
            unit_price_cents=subtotal_cents,
            total_price_cents=discounted_subtotal,
            metadata_={"sku": product.sku},
        )
        db.add(order_item)
        await db.flush()

        # 5. Call Payment Provider
        mode = "subscription" if product.product_type == ProductType.SUBSCRIPTION else "payment"
        success_url = payload.success_url or f"{base_url}/checkout?session_id={{CHECKOUT_SESSION_ID}}&status=success"
        cancel_url = payload.cancel_url or f"{base_url}/checkout?status=cancelled"

        provider = get_payment_provider()
        session_params = CheckoutSessionParams(
            user_id=user.id,
            user_email=user.email,
            product_id=product.id,
            price_id=price.id,
            product_name=product.name,
            amount_cents=total_cents,
            currency=price.currency,
            mode=mode,
            success_url=success_url,
            cancel_url=cancel_url,
            client_reference_id=order_number,
            metadata={
                "order_id": str(order.id),
                "order_number": order_number,
                "user_id": str(user.id),
                "reservation_id": str(payload.reservation_id) if payload.reservation_id else "",
            },
        )
        session_res = await provider.create_checkout_session(session_params)

        order.provider = session_res.provider
        order.provider_order_reference = session_res.session_id

        # If booking reservation attached, record session
        if payload.reservation_id:
            res_stmt = select(BookingReservation).where(BookingReservation.id == payload.reservation_id)
            reservation = (await db.execute(res_stmt)).scalar_one_or_none()
            if reservation:
                reservation.checkout_session_id = session_res.session_id

        await db.flush()

        return CheckoutResponse(
            session_id=session_res.session_id,
            checkout_url=session_res.checkout_url,
            order_id=order.id,
            order_number=order.order_number,
            amount_total=total_cents,
            currency=price.currency,
            provider=session_res.provider,
            status=order.status.value,
        )

    # ----------------------------------------------------
    # WEBHOOK INGESTION & IDEMPOTENT PROCESSING
    # ----------------------------------------------------

    @classmethod
    async def process_webhook(
        cls,
        db: AsyncSession,
        provider_name: str,
        raw_body: bytes,
        signature_header: str,
    ) -> dict[str, Any]:
        """Ingest, verify, and idempotently process provider webhooks."""
        provider = get_payment_provider()
        event_payload = provider.verify_webhook(raw_body, signature_header)

        # 1. Idempotency Check via unique provider_event_id
        payload_hash = hashlib.sha256(raw_body).hexdigest()
        existing_event_stmt = select(PaymentWebhookEvent).where(
            PaymentWebhookEvent.provider == provider_name,
            PaymentWebhookEvent.provider_event_id == event_payload.event_id,
        )
        existing_event = (await db.execute(existing_event_stmt)).scalar_one_or_none()
        if existing_event:
            logger.info("duplicate_webhook_ignored", event_id=event_payload.event_id)
            return {"status": "duplicate_ignored", "event_id": event_payload.event_id}

        # 2. Persist event receipt
        webhook_record = PaymentWebhookEvent(
            provider=provider_name,
            provider_event_id=event_payload.event_id,
            event_type=event_payload.event_type,
            received_at=datetime.datetime.now(datetime.UTC),
            status=WebhookEventStatus.PROCESSING,
            payload_hash=payload_hash,
            raw_payload=event_payload.raw_payload,
        )
        db.add(webhook_record)
        await db.flush()

        # 3. Process according to event type
        now_utc = datetime.datetime.now(datetime.UTC)
        try:
            if event_payload.event_type in ("checkout.session.completed", "payment_intent.succeeded"):
                session_obj = event_payload.data
                session_id = session_obj.get("id")
                metadata = session_obj.get("metadata", {})
                order_id_str = metadata.get("order_id")

                order_stmt = select(Order).options(
                    selectinload(Order.items).selectinload(OrderItem.product).selectinload(Product.entitlements),
                    selectinload(Order.items).selectinload(OrderItem.price),
                ).with_for_update()

                if order_id_str:
                    order_stmt = order_stmt.where(Order.id == uuid.UUID(order_id_str))
                elif session_id:
                    order_stmt = order_stmt.where(Order.provider_order_reference == session_id)
                else:
                    order_stmt = order_stmt.where(Order.id == None)

                order = (await db.execute(order_stmt)).scalar_one_or_none()
                if order and order.status != OrderStatus.PAID:
                    order.status = OrderStatus.PAID
                    order.paid_at = now_utc

                    # Record payment in ledger
                    db.add(
                        BillingLedgerEntry(
                            user_id=order.user_id,
                            entry_type=LedgerEntryType.PAYMENT,
                            amount_cents=order.total_cents,
                            currency=order.currency,
                            reference_type="order",
                            reference_id=str(order.id),
                            provider=provider_name,
                            provider_reference=session_id,
                            description=f"Paiement commande {order.order_number}",
                        )
                    )

                    # Grant products/entitlements
                    for item in order.items:
                        prod = item.product
                        if not prod:
                            continue

                        if prod.product_type == ProductType.SUBSCRIPTION:
                            # Create or renew subscription
                            sub_period_end = now_utc + (
                                datetime.timedelta(days=365)
                                if item.price.billing_interval.value == "annual"
                                else datetime.timedelta(days=30)
                            )
                            sub = Subscription(
                                user_id=order.user_id,
                                product_id=prod.id,
                                price_id=item.price_id,
                                provider=provider_name,
                                provider_subscription_id=session_obj.get("subscription") or f"sub_{uuid.uuid4().hex[:12]}",
                                provider_customer_id=session_obj.get("customer"),
                                status=SubscriptionStatus.ACTIVE,
                                current_period_start=now_utc,
                                current_period_end=sub_period_end,
                            )
                            db.add(sub)

                            try:
                                await NotificationService.create_notification(
                                    db=db,
                                    user_id=order.user_id,
                                    title="Abonnement activé",
                                    message=f"Votre abonnement {prod.name} est désormais actif jusqu'au {sub_period_end.strftime('%d/%m/%Y')}.",
                                    notification_type=NotificationType.SUBSCRIPTION_ACTIVATED if hasattr(NotificationType, "SUBSCRIPTION_ACTIVATED") else NotificationType.SYSTEM_ANNOUNCEMENT,
                                    data={"product_sku": prod.sku},
                                )
                            except Exception as notify_err:  # noqa: BLE001
                                logger.warning("subscription_notification_failed", error=str(notify_err))

                        elif prod.product_type == ProductType.CREDIT_PACK:
                            # Find credits count
                            credits_count = 0
                            for ent in prod.entitlements:
                                if ent.feature_key == "credits":
                                    credits_count = ent.limit_units
                                    break
                            if credits_count == 0:
                                credits_count = prod.metadata_.get("credits", 10)

                            await CreditsService.grant_credits(
                                db=db,
                                user_id=order.user_id,
                                amount=credits_count,
                                grant_type=CreditGrantType.PURCHASE,
                                order_id=order.id,
                                reason=f"Achat pack {prod.name}",
                            )

                        elif prod.product_type == ProductType.TEACHER_LESSON:
                            # Confirm temporary held booking reservation
                            res_id_str = metadata.get("reservation_id")
                            if res_id_str:
                                await TeacherBillingService.confirm_paid_reservation(
                                    db=db,
                                    reservation_id=uuid.UUID(res_id_str),
                                    order=order,
                                )

                        elif prod.product_type == ProductType.WRITING_CORRECTION:
                            # Grant human writing entitlement
                            grant = UserEntitlementGrant(
                                user_id=order.user_id,
                                feature_key="human_writing_correction",
                                source="one_time_purchase",
                                reason=f"Achat {prod.name}",
                            )
                            db.add(grant)

                    # Send payment succeeded notification
                    try:
                        await NotificationService.create_notification(
                            db=db,
                            user_id=order.user_id,
                            title="Paiement confirmé",
                            message=f"Votre paiement de {order.total_cents / 100:.2f} {order.currency} pour la commande {order.order_number} a été validé avec succès.",
                            notification_type=NotificationType.PAYMENT_SUCCEEDED if hasattr(NotificationType, "PAYMENT_SUCCEEDED") else NotificationType.SYSTEM_ANNOUNCEMENT,
                            data={"order_number": order.order_number, "total_cents": order.total_cents},
                        )
                    except Exception as notify_err:  # noqa: BLE001
                        logger.warning("payment_notification_failed", error=str(notify_err))

            elif event_payload.event_type in ("customer.subscription.deleted", "customer.subscription.updated"):
                sub_data = event_payload.data
                prov_sub_id = sub_data.get("id")
                if prov_sub_id:
                    sub_stmt = select(Subscription).where(Subscription.provider_subscription_id == prov_sub_id)
                    sub = (await db.execute(sub_stmt)).scalar_one_or_none()
                    if sub:
                        if event_payload.event_type == "customer.subscription.deleted":
                            sub.status = SubscriptionStatus.CANCELLED
                            sub.cancelled_at = now_utc
                        elif sub_data.get("cancel_at_period_end"):
                            sub.cancel_at_period_end = True

            webhook_record.status = WebhookEventStatus.PROCESSED
            webhook_record.processed_at = now_utc

        except Exception as err:  # noqa: BLE001
            logger.error("webhook_processing_failed", error=str(err), event_id=event_payload.event_id)
            webhook_record.status = WebhookEventStatus.FAILED
            webhook_record.processing_error = str(err)

        await db.commit()
        return {"status": "processed", "event_id": event_payload.event_id}

    # ----------------------------------------------------
    # SUBSCRIPTIONS (Backward-compatible)
    # ----------------------------------------------------

    @classmethod
    async def get_user_subscription(
        cls, db: AsyncSession, user_id: uuid.UUID
    ) -> SubscriptionResponse:
        """Fetch active user subscription or fallback to default Free tier."""
        now_utc = datetime.datetime.now(datetime.UTC)
        stmt = (
            select(Subscription)
            .where(
                Subscription.user_id == user_id,
                Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]),
            )
            .order_by(Subscription.current_period_end.desc())
            .options(selectinload(Subscription.product))
        )
        sub = (await db.execute(stmt)).scalars().first()

        if sub:
            plan_tier = PlanTier.PRO_MONTHLY
            if sub.product and "annual" in sub.product.sku:
                plan_tier = PlanTier.PRO_ANNUAL
            return SubscriptionResponse(
                id=sub.id,
                user_id=sub.user_id,
                plan_tier=plan_tier,
                status=sub.status,
                current_period_start=sub.current_period_start,
                current_period_end=sub.current_period_end,
                cancel_at_period_end=sub.cancel_at_period_end,
                product_id=sub.product_id,
                price_id=sub.price_id,
                provider=sub.provider,
                provider_subscription_id=sub.provider_subscription_id,
                cancelled_at=sub.cancelled_at,
                product_name=sub.product.name if sub.product else "TEF Réussite Pro",
            )

        # Default fallback: Free tier
        return SubscriptionResponse(
            id=uuid.uuid5(uuid.NAMESPACE_DNS, f"sub-free-{user_id}"),
            user_id=user_id,
            plan_tier=PlanTier.FREE,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now_utc - datetime.timedelta(days=15),
            current_period_end=now_utc + datetime.timedelta(days=15),
            cancel_at_period_end=False,
            product_name="TEF Découverte (Gratuit)",
        )

    @classmethod
    async def cancel_subscription(
        cls, db: AsyncSession, user_id: uuid.UUID, at_period_end: bool = True
    ) -> SubscriptionResponse:
        """Cancel subscription with period-end access preservation."""
        stmt = (
            select(Subscription)
            .where(
                Subscription.user_id == user_id,
                Subscription.status == SubscriptionStatus.ACTIVE,
            )
            .options(selectinload(Subscription.product))
        )
        sub = (await db.execute(stmt)).scalar_one_or_none()
        if not sub:
            raise AppException(
                message="Aucun abonnement actif à annuler.",
                code="NO_ACTIVE_SUBSCRIPTION",
                status_code=404,
            )

        provider = get_payment_provider()
        await provider.cancel_subscription(sub.provider_subscription_id, at_period_end=at_period_end)

        sub.cancel_at_period_end = at_period_end
        if not at_period_end:
            sub.status = SubscriptionStatus.CANCELLED
            sub.cancelled_at = datetime.datetime.now(datetime.UTC)

        await db.commit()
        await db.refresh(sub)
        return await cls.get_user_subscription(db, user_id)

    @classmethod
    async def resume_subscription(
        cls, db: AsyncSession, user_id: uuid.UUID
    ) -> SubscriptionResponse:
        """Resume a subscription that was scheduled for period-end cancellation."""
        stmt = (
            select(Subscription)
            .where(
                Subscription.user_id == user_id,
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.cancel_at_period_end == True,
            )
            .options(selectinload(Subscription.product))
        )
        sub = (await db.execute(stmt)).scalar_one_or_none()
        if not sub:
            raise AppException(
                message="Aucun abonnement en attente d'annulation trouvé.",
                code="NO_CANCELLED_SUBSCRIPTION",
                status_code=404,
            )

        provider = get_payment_provider()
        await provider.resume_subscription(sub.provider_subscription_id)

        sub.cancel_at_period_end = False
        await db.commit()
        await db.refresh(sub)
        return await cls.get_user_subscription(db, user_id)

    # ----------------------------------------------------
    # CREDITS & INVOICES (Backward-compatible)
    # ----------------------------------------------------

    @classmethod
    async def get_credit_balance(
        cls, db: AsyncSession, user_id: uuid.UUID
    ) -> CreditBalanceResponse:
        """Retrieve student credit balance and active grants."""
        balance = await CreditsService.get_balance(db, user_id)
        now_utc = datetime.datetime.now(datetime.UTC)

        grants_stmt = (
            select(CreditGrant)
            .where(
                CreditGrant.user_id == user_id,
                CreditGrant.remaining_credits > 0,
                (CreditGrant.expires_at.is_(None) | (CreditGrant.expires_at > now_utc)),
            )
            .order_by(CreditGrant.created_at.desc())
        )
        grants = list((await db.execute(grants_stmt)).scalars().all())

        return CreditBalanceResponse(
            user_id=user_id,
            balance=balance,
            speaking_credits=balance,
            writing_credits=balance,
            tutoring_hours=balance / 10.0,
            active_grants=[CreditGrantResponse.model_validate(g) for g in grants],
        )

    @classmethod
    async def get_invoices(
        cls, db: AsyncSession, user_id: uuid.UUID
    ) -> list[InvoiceResponse]:
        """Fetch past invoices derived from paid user orders."""
        stmt = (
            select(Order)
            .where(Order.user_id == user_id, Order.status == OrderStatus.PAID)
            .order_by(Order.paid_at.desc().nulls_last())
        )
        orders = list((await db.execute(stmt)).scalars().all())

        return [
            InvoiceResponse(
                id=o.order_number,
                amount_cents=o.total_cents,
                currency=o.currency.lower(),
                status="paid",
                created_at=o.paid_at or o.created_at,
                pdf_url=None,
            )
            for o in orders
        ]

    @classmethod
    async def get_orders(
        cls, db: AsyncSession, user_id: uuid.UUID
    ) -> list[OrderResponse]:
        """Fetch all user orders with item details."""
        stmt = (
            select(Order)
            .where(Order.user_id == user_id)
            .order_by(Order.created_at.desc())
            .options(
                selectinload(Order.items).selectinload(OrderItem.product),
            )
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
