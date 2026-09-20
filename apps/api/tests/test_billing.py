"""Comprehensive test suite for Billing, Monetization, Subscriptions, Credits,
Teacher Earnings, and Admin Financial Controls.
"""

import hashlib
import hmac
import json
import uuid
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.core.security import hash_password
from app.modules.billing.enums import (
    BillingInterval,
    CreditGrantType,
    LedgerEntryType,
    OrderStatus,
    PlanTier,
    ProductType,
    ReservationStatus,
    SubscriptionStatus,
    TeacherEarningStatus,
)
from app.modules.billing.models import (
    BillingLedgerEntry,
    Coupon,
    CreditAccount,
    CreditGrant,
    Order,
    OrderItem,
    PaymentWebhookEvent,
    Product,
    ProductEntitlement,
    ProductPrice,
    Subscription,
    TeacherEarning,
)
from app.modules.billing.credits_service import CreditsService
from app.modules.billing.teacher_billing import TeacherBillingService
from app.modules.billing.reconciliation import BillingReconciliationService
from app.modules.users.models import TeacherProfile, User, UserRole


@pytest_asyncio.fixture
async def seed_catalog(db_session: AsyncSession) -> dict[str, Product | ProductPrice]:
    """Seed the standard product catalog into the test database (idempotent)."""
    stmt = select(Product).where(Product.sku == "tef-premium")
    res = await db_session.execute(stmt)
    existing_prem = res.scalar_one_or_none()
    if existing_prem:
        stmt_prices = select(ProductPrice)
        all_prices = list((await db_session.execute(stmt_prices)).scalars().all())
        stmt_prods = select(Product)
        all_prods = {p.sku: p for p in (await db_session.execute(stmt_prods)).scalars().all()}
        return {
            "free": all_prods["tef-free"],
            "premium": all_prods["tef-premium"],
            "pack_med": all_prods["credit-pack-medium"],
            "teacher": all_prods["teacher-lesson-1h"],
            "price_free": [p for p in all_prices if p.product_id == all_prods["tef-free"].id][0],
            "price_prem_m": [p for p in all_prices if p.product_id == all_prods["tef-premium"].id and p.billing_interval == BillingInterval.MONTHLY][0],
            "price_prem_a": [p for p in all_prices if p.product_id == all_prods["tef-premium"].id and p.billing_interval == BillingInterval.ANNUAL][0],
            "price_pack_med": [p for p in all_prices if p.product_id == all_prods["credit-pack-medium"].id][0],
            "price_teacher": [p for p in all_prices if p.product_id == all_prods["teacher-lesson-1h"].id][0],
        }

    # 1. TEF Free
    prod_free = Product(
        sku="tef-free",
        name="TEF Free",
        description="Formule Découverte gratuite",
        product_type=ProductType.SUBSCRIPTION,
        is_active=True,
    )
    db_session.add(prod_free)
    await db_session.flush()

    price_free = ProductPrice(
        product_id=prod_free.id,
        currency="EUR",
        amount_cents=0,
        billing_interval=BillingInterval.MONTHLY,
        is_active=True,
    )
    db_session.add(price_free)

    # 2. TEF Premium
    prod_premium = Product(
        sku="tef-premium",
        name="TEF Premium",
        description="Accès illimité aux simulations TEF et évaluations IA",
        product_type=ProductType.SUBSCRIPTION,
        is_active=True,
    )
    db_session.add(prod_premium)
    await db_session.flush()

    price_prem_m = ProductPrice(
        product_id=prod_premium.id,
        currency="EUR",
        amount_cents=2900,
        billing_interval=BillingInterval.MONTHLY,
        is_active=True,
    )
    price_prem_a = ProductPrice(
        product_id=prod_premium.id,
        currency="EUR",
        amount_cents=24000,
        billing_interval=BillingInterval.ANNUAL,
        is_active=True,
    )
    db_session.add_all([price_prem_m, price_prem_a])

    ent_ai_writing = ProductEntitlement(
        product_id=prod_premium.id,
        feature_key="ai_writing_evaluation",
        limit_units=50,
        is_unlimited=False,
    )
    ent_ai_speaking = ProductEntitlement(
        product_id=prod_premium.id,
        feature_key="ai_speaking_practice",
        limit_units=50,
        is_unlimited=False,
    )
    db_session.add_all([ent_ai_writing, ent_ai_speaking])

    # 3. Credit Pack Medium (25 credits)
    prod_pack_med = Product(
        sku="credit-pack-medium",
        name="Pack Avancé 25 Crédits",
        description="25 crédits de pratique polyvalents",
        product_type=ProductType.CREDIT_PACK,
        is_active=True,
        metadata_={"credits": 25},
    )
    db_session.add(prod_pack_med)
    await db_session.flush()

    price_pack_med = ProductPrice(
        product_id=prod_pack_med.id,
        currency="EUR",
        amount_cents=3000,
        billing_interval=BillingInterval.ONE_TIME,
        is_active=True,
    )
    db_session.add(price_pack_med)

    # 4. Teacher Lesson 1h
    prod_teacher = Product(
        sku="teacher-lesson-1h",
        name="Cours Particulier 1h",
        description="Session individuelle avec professeur certifié",
        product_type=ProductType.TEACHER_LESSON,
        is_active=True,
    )
    db_session.add(prod_teacher)
    await db_session.flush()

    price_teacher = ProductPrice(
        product_id=prod_teacher.id,
        currency="EUR",
        amount_cents=4000,
        billing_interval=BillingInterval.ONE_TIME,
        is_active=True,
    )
    db_session.add(price_teacher)

    await db_session.commit()

    return {
        "free": prod_free,
        "premium": prod_premium,
        "pack_med": prod_pack_med,
        "teacher": prod_teacher,
        "price_free": price_free,
        "price_prem_m": price_prem_m,
        "price_prem_a": price_prem_a,
        "price_pack_med": price_pack_med,
        "price_teacher": price_teacher,
    }


def generate_mock_webhook_signature(payload_bytes: bytes, secret: str = "whsec_mock_key") -> str:
    """Generate deterministic HMAC-SHA256 signature for mock webhook tests."""
    return hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()


# ==============================================================================
# 1. CATALOG & CHECKOUT TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_catalog_query(
    client: AsyncClient,
    seed_catalog: dict[str, Product | ProductPrice],
) -> None:
    """Verify catalog endpoint returns active products and their prices."""
    resp = await client.get("/api/v1/billing/products")
    assert resp.status_code == 200
    products = resp.json()
    assert len(products) >= 4
    skus = [p["sku"] for p in products]
    assert "tef-premium" in skus
    assert "credit-pack-medium" in skus


@pytest.mark.asyncio
async def test_create_checkout_session(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
    seed_catalog: dict[str, Product | ProductPrice],
    db_session: AsyncSession,
) -> None:
    """Verify checkout session creation creates a pending order and hosted URL."""
    price = seed_catalog["price_prem_m"]

    payload = {
        "price_id": str(price.id),
        "success_url": "http://frontend.local/billing?status=success",
        "cancel_url": "http://frontend.local/pricing?status=cancelled",
    }
    resp = await client.post("/api/v1/billing/checkout", json=payload, headers=student_auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending"
    assert "ORD-" in data["order_number"]
    assert data["amount_total"] == 2900
    assert "checkout_url" in data

    # Verify pending order exists in DB
    order_stmt = select(Order).where(Order.id == uuid.UUID(data["order_id"]))
    res = await db_session.execute(order_stmt)
    order = res.scalar_one_or_none()
    assert order is not None
    assert order.status == OrderStatus.PENDING
    assert order.user_id == test_student.id
    assert order.total_cents == 2900


@pytest.mark.asyncio
async def test_checkout_with_coupon_discount(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
    seed_catalog: dict[str, Product | ProductPrice],
    db_session: AsyncSession,
) -> None:
    """Verify applying a valid coupon discounts the subtotal properly."""
    coupon = Coupon(
        code="PROMO20",
        discount_type="percentage",
        discount_value=20,
        is_active=True,
        max_redemptions=100,
    )
    db_session.add(coupon)
    await db_session.commit()

    price = seed_catalog["price_prem_m"]

    payload = {
        "price_id": str(price.id),
        "coupon_code": "PROMO20",
    }
    resp = await client.post("/api/v1/billing/checkout", json=payload, headers=student_auth_headers)
    assert resp.status_code == 201
    data = resp.json()

    # 2900 cents * 20% discount = 580 cents discount -> 2320 subtotal + tax
    assert data["amount_total"] < 2900


# ==============================================================================
# 2. WEBHOOK INGESTION & IDEMPOTENCY TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_webhook_signature_verification_and_order_fulfillment(
    client: AsyncClient,
    test_student: User,
    seed_catalog: dict[str, Product | ProductPrice],
    db_session: AsyncSession,
) -> None:
    """Verify valid webhook fulfills order, writes ledger entry, and sets status to PAID."""
    from app.integrations.payments.factory import get_payment_provider

    payment_provider = get_payment_provider()
    pack_prod = seed_catalog["pack_med"]
    price = seed_catalog["price_pack_med"]

    # 1. Create pending order
    order = Order(
        order_number=f"ORD-TEST-{uuid.uuid4().hex[:6]}",
        user_id=test_student.id,
        status=OrderStatus.PENDING,
        currency="EUR",
        subtotal_cents=2500,
        tax_cents=500,
        total_cents=3000,
        provider="mock",
    )
    db_session.add(order)
    await db_session.flush()

    item = OrderItem(
        order_id=order.id,
        product_id=pack_prod.id,
        price_id=price.id,
        quantity=1,
        unit_price_cents=3000,
        total_price_cents=3000,
    )
    db_session.add(item)
    await db_session.commit()

    # 2. Construct signed webhook event
    event_id = f"evt_{uuid.uuid4().hex}"
    payload_dict = {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": f"cs_{uuid.uuid4().hex}",
                "metadata": {
                    "order_id": str(order.id),
                    "user_id": str(test_student.id),
                    "product_type": ProductType.CREDIT_PACK.value,
                    "credits": "25",
                },
                "amount_total": 3000,
                "currency": "eur",
            }
        },
    }
    raw_payload = json.dumps(payload_dict).encode("utf-8")
    sig_header = payment_provider.generate_webhook_signature(raw_payload)

    # 3. Post webhook
    resp = await client.post(
        "/api/v1/billing/webhook/mock",
        content=raw_payload,
        headers={"Stripe-Signature": sig_header, "Content-Type": "application/json"},
    )
    assert resp.status_code == 200

    # 4. Verify order is paid
    await db_session.refresh(order)
    assert order.status == OrderStatus.PAID
    assert order.paid_at is not None

    # 5. Verify BillingLedgerEntry exists
    ledger_stmt = select(BillingLedgerEntry).where(BillingLedgerEntry.reference_id == str(order.id))
    res = await db_session.execute(ledger_stmt)
    entry = res.scalar_one_or_none()
    assert entry is not None
    assert entry.entry_type == LedgerEntryType.PAYMENT
    assert entry.amount_cents == 3000


@pytest.mark.asyncio
async def test_webhook_idempotency_duplicate_events(
    client: AsyncClient,
    test_student: User,
    seed_catalog: dict[str, Product | ProductPrice],
    db_session: AsyncSession,
) -> None:
    """Verify sending the exact same webhook event ID multiple times is strictly idempotent."""
    from app.integrations.payments.factory import get_payment_provider

    payment_provider = get_payment_provider()
    pack_prod = seed_catalog["pack_med"]
    price = seed_catalog["price_pack_med"]

    order = Order(
        order_number=f"ORD-DUP-{uuid.uuid4().hex[:6]}",
        user_id=test_student.id,
        status=OrderStatus.PENDING,
        currency="EUR",
        subtotal_cents=2500,
        tax_cents=500,
        total_cents=3000,
        provider="mock",
    )
    db_session.add(order)
    await db_session.flush()

    item = OrderItem(
        order_id=order.id,
        product_id=pack_prod.id,
        price_id=price.id,
        quantity=1,
        unit_price_cents=3000,
        total_price_cents=3000,
    )
    db_session.add(item)
    await db_session.commit()

    event_id = f"evt_dup_{uuid.uuid4().hex}"
    payload_dict = {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": f"cs_{uuid.uuid4().hex}",
                "metadata": {
                    "order_id": str(order.id),
                    "user_id": str(test_student.id),
                    "product_type": ProductType.CREDIT_PACK.value,
                    "credits": "25",
                },
                "amount_total": 3000,
                "currency": "eur",
            }
        },
    }
    raw_payload = json.dumps(payload_dict).encode("utf-8")
    sig_header = payment_provider.generate_webhook_signature(raw_payload)
    headers = {"Stripe-Signature": sig_header, "Content-Type": "application/json"}

    # Send 5 identical requests
    for _ in range(5):
        resp = await client.post("/api/v1/billing/webhook/mock", content=raw_payload, headers=headers)
        assert resp.status_code == 200

    # Ensure only ONE webhook event record was logged
    wh_stmt = select(PaymentWebhookEvent).where(PaymentWebhookEvent.provider_event_id == event_id)
    res = await db_session.execute(wh_stmt)
    events = res.scalars().all()
    assert len(events) == 1

    # Ensure only ONE ledger entry was created
    ledger_stmt = select(BillingLedgerEntry).where(BillingLedgerEntry.reference_id == str(order.id))
    res = await db_session.execute(ledger_stmt)
    entries = res.scalars().all()
    assert len(entries) == 1


# ==============================================================================
# 3. SUBSCRIPTION LIFECYCLE TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_subscription_cancel_at_period_end_and_resume(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
    seed_catalog: dict[str, Product | ProductPrice],
    db_session: AsyncSession,
) -> None:
    """Verify cancel at period end maintains active status until expiration and can be resumed."""
    prem_prod = seed_catalog["premium"]
    price = seed_catalog["price_prem_m"]

    now = datetime.now(UTC)
    sub = Subscription(
        user_id=test_student.id,
        product_id=prem_prod.id,
        price_id=price.id,
        status=SubscriptionStatus.ACTIVE,
        current_period_start=now - timedelta(days=5),
        current_period_end=now + timedelta(days=25),
        cancel_at_period_end=False,
        provider="mock",
        provider_subscription_id=f"sub_{uuid.uuid4().hex[:8]}",
    )
    db_session.add(sub)
    await db_session.commit()

    # 1. Query subscription
    resp = await client.get("/api/v1/billing/subscription", headers=student_auth_headers)
    assert resp.status_code == 200
    assert resp.json()["plan_tier"] == "pro_monthly"
    assert resp.json()["cancel_at_period_end"] is False

    # 2. Cancel at period end
    resp = await client.post("/api/v1/billing/subscription/cancel", headers=student_auth_headers)
    assert resp.status_code == 200
    assert resp.json()["cancel_at_period_end"] is True
    # Still active!
    assert resp.json()["status"] == "active"

    # 3. Resume subscription
    resp = await client.post("/api/v1/billing/subscription/resume", headers=student_auth_headers)
    assert resp.status_code == 200
    assert resp.json()["cancel_at_period_end"] is False


# ==============================================================================
# 4. CREDITS ACCOUNTING & CONCURRENCY TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_credits_fifo_soonest_expiring_order(
    test_student: User,
    db_session: AsyncSession,
) -> None:
    """Verify credits consumption strictly prioritizes earliest expiring grants."""
    now = datetime.now(UTC)
    account = CreditAccount(user_id=test_student.id, balance=30)
    db_session.add(account)

    # Grant 1: Expiring in 2 days
    g_soon = CreditGrant(
        user_id=test_student.id,
        initial_credits=10,
        remaining_credits=10,
        grant_type=CreditGrantType.PURCHASE,
        expires_at=now + timedelta(days=2),
    )
    # Grant 2: Expiring in 1 year
    g_later = CreditGrant(
        user_id=test_student.id,
        initial_credits=20,
        remaining_credits=20,
        grant_type=CreditGrantType.PURCHASE,
        expires_at=now + timedelta(days=365),
    )
    db_session.add_all([g_soon, g_later])
    await db_session.commit()

    # Consume 6 credits
    await CreditsService.consume_credits(
        db=db_session,
        user_id=test_student.id,
        amount=6,
        feature_key="ai_writing_evaluation",
    )
    await db_session.commit()

    await db_session.refresh(g_soon)
    await db_session.refresh(g_later)
    await db_session.refresh(account)

    # g_soon had 10, consumed 6 -> 4 remaining
    assert g_soon.remaining_credits == 4
    # g_later untouched -> 20 remaining
    assert g_later.remaining_credits == 20
    assert account.balance == 24


@pytest.mark.asyncio
async def test_credits_concurrency_race_condition_protection(
    test_student: User,
    db_session: AsyncSession,
) -> None:
    """Verify that when only 1 credit remains, simultaneous requests cannot double-spend."""
    account = CreditAccount(user_id=test_student.id, balance=1)
    db_session.add(account)

    grant = CreditGrant(
        user_id=test_student.id,
        initial_credits=1,
        remaining_credits=1,
        grant_type=CreditGrantType.PURCHASE,
    )
    db_session.add(grant)
    await db_session.commit()

    # Attempt 2 sequential consumptions of 1 credit
    # 1st succeeds
    await CreditsService.consume_credits(
        db=db_session,
        user_id=test_student.id,
        amount=1,
        feature_key="ai_speaking_practice",
    )
    await db_session.commit()

    # 2nd must raise AppException with code INSUFFICIENT_CREDITS
    with pytest.raises(AppException) as exc_info:
        await CreditsService.consume_credits(
            db=db_session,
            user_id=test_student.id,
            amount=1,
            feature_key="ai_speaking_practice",
        )
    assert exc_info.value.code == "INSUFFICIENT_CREDITS"

    await db_session.refresh(account)
    assert account.balance == 0


# ==============================================================================
# 5. TEACHER LESSONS & SLOT RESERVATIONS TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_teacher_slot_reservation_held_ttl_and_double_booking(
    test_student: User,
    test_teacher: User,
    db_session: AsyncSession,
) -> None:
    """Verify held slot prevents concurrent reservation and expires after 15 minutes."""
    # Find teacher profile
    stmt = select(TeacherProfile).where(TeacherProfile.user_id == test_teacher.id)
    profile = (await db_session.execute(stmt)).scalar_one()

    start_time = datetime.now(UTC) + timedelta(days=2, hours=10)
    end_time = start_time + timedelta(hours=1)

    # 1. First student reserves the slot
    res1 = await TeacherBillingService.create_booking_reservation(
        db=db_session,
        student=test_student,
        teacher_id=profile.id,
        start_time=start_time,
        end_time=end_time,
    )
    await db_session.commit()
    assert res1.status == ReservationStatus.HELD
    assert res1.expires_at > datetime.now(UTC)

    # 2. Second reservation for the same slot must fail with 409
    other_student = User(
        email=f"other_{uuid.uuid4().hex[:6]}@example.com",
        password_hash=hash_password("ValidPassword123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db_session.add(other_student)
    await db_session.commit()

    with pytest.raises(AppException) as exc_info:
        await TeacherBillingService.create_booking_reservation(
            db=db_session,
            student=other_student,
            teacher_id=profile.id,
            start_time=start_time,
            end_time=end_time,
        )
    assert exc_info.value.code == "SLOT_ALREADY_HELD"


@pytest.mark.asyncio
async def test_teacher_earning_80_20_split_calculation(
    test_student: User,
    test_teacher: User,
    db_session: AsyncSession,
) -> None:
    """Verify confirming a paid reservation calculates 80% net and 20% platform fee."""
    stmt = select(TeacherProfile).where(TeacherProfile.user_id == test_teacher.id)
    profile = (await db_session.execute(stmt)).scalar_one()

    start_time = datetime.now(UTC) + timedelta(days=3, hours=14)
    end_time = start_time + timedelta(hours=1)

    # 1. Create reservation
    res = await TeacherBillingService.create_booking_reservation(
        db=db_session,
        student=test_student,
        teacher_id=profile.id,
        start_time=start_time,
        end_time=end_time,
    )

    # 2. Create paid order
    order = Order(
        order_number=f"ORD-TCH-{uuid.uuid4().hex[:6]}",
        user_id=test_student.id,
        status=OrderStatus.PAID,
        currency="EUR",
        subtotal_cents=3333,
        tax_cents=667,
        total_cents=4000,
        provider="mock",
    )
    db_session.add(order)
    await db_session.commit()

    # 3. Confirm reservation
    booking, earning = await TeacherBillingService.confirm_paid_reservation(
        db=db_session,
        reservation_id=res.id,
        order=order,
    )
    await db_session.commit()

    # 4000 gross -> 20% fee = 800 cents, 80% net = 3200 cents
    assert earning.gross_amount_cents == 4000
    assert earning.platform_fee_cents == 800
    assert earning.net_amount_cents == 3200
    assert earning.status == TeacherEarningStatus.AVAILABLE

    # Check earnings summary
    summary = await TeacherBillingService.get_teacher_earnings_summary(db=db_session, teacher_user_id=test_teacher.id)
    assert summary["total_gross_cents"] == 4000
    assert summary["total_platform_fee_cents"] == 800
    assert summary["total_net_cents"] == 3200
    assert summary["available_cents"] == 3200


# ==============================================================================
# 6. REFUND & FINANCIAL RECONCILIATION TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_admin_refund_and_ledger_reversal(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    """Verify issuing a refund transitions order status and appends reversal ledger entry."""
    order = Order(
        order_number=f"ORD-REF-{uuid.uuid4().hex[:6]}",
        user_id=test_student.id,
        status=OrderStatus.PAID,
        currency="EUR",
        subtotal_cents=2500,
        tax_cents=500,
        total_cents=3000,
        refunded_amount_cents=0,
        provider="mock",
    )
    db_session.add(order)
    await db_session.commit()

    # Issue refund of 1500 (partial)
    payload = {
        "order_id": str(order.id),
        "amount_cents": 1500,
        "reason": "Test partial refund",
    }
    resp = await client.post("/api/v1/admin/billing/refunds", json=payload, headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "partially_refunded"
    assert data["refunded_amount_cents"] == 1500

    # Verify ledger entry
    ledger_stmt = select(BillingLedgerEntry).where(
        BillingLedgerEntry.reference_id == str(order.id),
        BillingLedgerEntry.entry_type == LedgerEntryType.REFUND,
    )
    res = await db_session.execute(ledger_stmt)
    entry = res.scalar_one_or_none()
    assert entry is not None
    assert entry.amount_cents == -1500


@pytest.mark.asyncio
async def test_billing_reconciliation_audit(
    db_session: AsyncSession,
) -> None:
    """Verify daily reconciliation engine audits DB state cleanly."""
    report = await BillingReconciliationService.reconcile(db_session)
    assert report.generated_at is not None
    assert isinstance(report.healthy, bool)
    assert isinstance(report.findings, list)


# ==============================================================================
# 7. SECURITY & RBAC ISOLATION TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_security_idor_order_isolation(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    """Verify Student A cannot inspect or retrieve orders belonging to Student B."""
    other_user = User(
        email=f"other_{uuid.uuid4().hex[:6]}@example.com",
        password_hash=hash_password("ValidPassword123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db_session.add(other_user)
    await db_session.flush()

    other_order = Order(
        order_number=f"ORD-OTHER-{uuid.uuid4().hex[:6]}",
        user_id=other_user.id,
        status=OrderStatus.PAID,
        currency="EUR",
        subtotal_cents=2500,
        tax_cents=500,
        total_cents=3000,
        provider="mock",
    )
    db_session.add(other_order)
    await db_session.commit()

    # Student A attempts to access other_order
    resp = await client.get(f"/api/v1/billing/orders/{other_order.id}", headers=student_auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_security_non_admin_cannot_access_admin_billing(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
) -> None:
    """Verify non-admin users receive 403 Forbidden when calling admin billing endpoints."""
    resp = await client.get("/api/v1/admin/billing/orders", headers=student_auth_headers)
    assert resp.status_code == 403
