"""SQLAlchemy ORM models for Billing, Subscriptions, Ledger, Orders, and Credits."""

import datetime
import uuid
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import TimeStampedUUIDModel
from app.modules.billing.enums import (
    BillingInterval,
    CreditGrantType,
    LedgerEntryType,
    OrderStatus,
    ProductType,
    ReservationStatus,
    SubscriptionStatus,
    TeacherEarningStatus,
    WebhookEventStatus,
)


class Product(TimeStampedUUIDModel):
    """Platform product catalog entity."""

    __tablename__ = "products"

    sku: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    product_type: Mapped[ProductType] = mapped_column(
        SQLEnum(ProductType, name="product_type", native_enum=False),
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)

    prices: Mapped[list[ProductPrice]] = relationship(
        "ProductPrice", back_populates="product", cascade="all, delete-orphan", lazy="selectin"
    )
    entitlements: Mapped[list[ProductEntitlement]] = relationship(
        "ProductEntitlement", back_populates="product", cascade="all, delete-orphan", lazy="selectin"
    )


class ProductPrice(TimeStampedUUIDModel):
    """Price configuration for a product across currencies and intervals."""

    __tablename__ = "product_prices"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    currency: Mapped[str] = mapped_column(String(3), default="EUR", nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    billing_interval: Mapped[BillingInterval] = mapped_column(
        SQLEnum(BillingInterval, name="billing_interval", native_enum=False),
        default=BillingInterval.ONE_TIME,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    provider_price_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    product: Mapped[Product] = relationship("Product", back_populates="prices")


class ProductEntitlement(TimeStampedUUIDModel):
    """Features and quota granted when purchasing or subscribing to a product."""

    __tablename__ = "product_entitlements"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    feature_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entitlement_type: Mapped[str] = mapped_column(String(32), default="boolean", nullable=False)
    limit_units: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_unlimited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    product: Mapped[Product] = relationship("Product", back_populates="entitlements")


class Subscription(TimeStampedUUIDModel):
    """Persistent subscription record authoritative within the application."""

    __tablename__ = "subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True
    )
    price_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_prices.id"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(32), default="stripe", nullable=False)
    provider_subscription_id: Mapped[str] = mapped_column(
        String(128), unique=True, index=True, nullable=False
    )
    provider_customer_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    status: Mapped[SubscriptionStatus] = mapped_column(
        SQLEnum(SubscriptionStatus, name="subscription_status", native_enum=False),
        default=SubscriptionStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    current_period_start: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    current_period_end: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cancelled_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    product: Mapped[Product] = relationship("Product", lazy="selectin")
    price: Mapped[ProductPrice] = relationship("ProductPrice", lazy="selectin")


class Order(TimeStampedUUIDModel):
    """Customer purchase order record."""

    __tablename__ = "orders"

    order_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[OrderStatus] = mapped_column(
        SQLEnum(OrderStatus, name="order_status", native_enum=False),
        default=OrderStatus.PENDING,
        nullable=False,
        index=True,
    )
    currency: Mapped[str] = mapped_column(String(3), default="EUR", nullable=False)
    subtotal_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    refunded_amount_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    provider: Mapped[str] = mapped_column(String(32), default="stripe", nullable=False)
    provider_order_reference: Mapped[str | None] = mapped_column(
        String(128), nullable=True, index=True
    )
    paid_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refunded_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)

    items: Mapped[list[OrderItem]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )


class OrderItem(TimeStampedUUIDModel):
    """Individual product line item attached to an order."""

    __tablename__ = "order_items"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    price_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_prices.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    total_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)

    order: Mapped[Order] = relationship("Order", back_populates="items")
    product: Mapped[Product] = relationship("Product", lazy="selectin")
    price: Mapped[ProductPrice] = relationship("ProductPrice", lazy="selectin")


class CreditAccount(TimeStampedUUIDModel):
    """Authoritative credit balance for a student."""

    __tablename__ = "credit_accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    balance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class CreditGrant(TimeStampedUUIDModel):
    """Specific tranche of credits granted to a user with an optional expiration."""

    __tablename__ = "credit_grants"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    initial_credits: Mapped[int] = mapped_column(Integer, nullable=False)
    remaining_credits: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    grant_type: Mapped[CreditGrantType] = mapped_column(
        SQLEnum(CreditGrantType, name="credit_grant_type", native_enum=False),
        default=CreditGrantType.PURCHASE,
        nullable=False,
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True
    )
    granted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    __table_args__ = (
        Index("ix_credit_grants_user_remaining_exp", "user_id", "remaining_credits", "expires_at"),
    )


class CreditConsumption(TimeStampedUUIDModel):
    """Immutable record of credit consumption by a student."""

    __tablename__ = "credit_consumptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    credits_consumed: Mapped[int] = mapped_column(Integer, nullable=False)
    feature_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    reference_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    reference_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    grant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_grants.id", ondelete="SET NULL"), nullable=True
    )


class BillingLedgerEntry(TimeStampedUUIDModel):
    """Immutable financial ledger entry recording every balance or monetary movement."""

    __tablename__ = "billing_ledger_entries"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entry_type: Mapped[LedgerEntryType] = mapped_column(
        SQLEnum(LedgerEntryType, name="ledger_entry_type", native_enum=False),
        nullable=False,
        index=True,
    )
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="EUR", nullable=False)
    reference_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    reference_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(32), default="stripe", nullable=False)
    provider_reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class PaymentWebhookEvent(TimeStampedUUIDModel):
    """Idempotent log of raw webhooks received from payment providers."""

    __tablename__ = "payment_webhook_events"

    provider: Mapped[str] = mapped_column(String(32), default="stripe", nullable=False, index=True)
    provider_event_id: Mapped[str] = mapped_column(
        String(128), unique=True, index=True, nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    received_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    processed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[WebhookEventStatus] = mapped_column(
        SQLEnum(WebhookEventStatus, name="webhook_event_status", native_enum=False),
        default=WebhookEventStatus.RECEIVED,
        nullable=False,
        index=True,
    )
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class BookingReservation(TimeStampedUUIDModel):
    """Temporary slot reservation mutex during teacher booking checkout."""

    __tablename__ = "booking_reservations"

    slot_identifier: Mapped[str] = mapped_column(
        String(128), unique=True, index=True, nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teacher_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    start_time: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    end_time: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    status: Mapped[ReservationStatus] = mapped_column(
        SQLEnum(ReservationStatus, name="reservation_status", native_enum=False),
        default=ReservationStatus.HELD,
        nullable=False,
        index=True,
    )
    checkout_session_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teacher_bookings.id", ondelete="SET NULL"), nullable=True
    )


class TeacherEarning(TimeStampedUUIDModel):
    """Teacher compensation ledger record derived from completed paid bookings."""

    __tablename__ = "teacher_earnings"

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teacher_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teacher_bookings.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True
    )
    gross_amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    platform_fee_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    net_amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="EUR", nullable=False)
    commission_rate_bps: Mapped[int] = mapped_column(Integer, default=2000, nullable=False)
    status: Mapped[TeacherEarningStatus] = mapped_column(
        SQLEnum(TeacherEarningStatus, name="teacher_earning_status", native_enum=False),
        default=TeacherEarningStatus.PENDING,
        nullable=False,
        index=True,
    )


class AIUsageRecord(TimeStampedUUIDModel):
    """Record of AI units and audio seconds consumed by a user."""

    __tablename__ = "ai_usage_records"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    feature: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(64), default="anthropic", nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    units: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    audio_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    credits_consumed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Coupon(TimeStampedUUIDModel):
    """Promotional coupon code offering percentage or fixed discounts."""

    __tablename__ = "coupons"

    code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    discount_type: Mapped[str] = mapped_column(String(20), default="percentage", nullable=False)
    discount_value: Mapped[int] = mapped_column(Integer, nullable=False)
    max_redemptions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    times_redeemed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class UserEntitlementGrant(TimeStampedUUIDModel):
    """Manual or promotional entitlement grant outside standard recurring plans."""

    __tablename__ = "user_entitlement_grants"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    feature_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(32), default="admin_grant", nullable=False)
    granted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
