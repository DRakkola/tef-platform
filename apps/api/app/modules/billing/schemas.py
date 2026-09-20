"""Pydantic v2 schemas for products, subscriptions, orders, credits, and ledger."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

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
    WebhookEventStatus,
)

# ----------------------------------------------------
# PRODUCT CATALOG SCHEMAS
# ----------------------------------------------------


class ProductEntitlementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    feature_key: str
    entitlement_type: str
    limit_units: int
    is_unlimited: bool


class ProductPriceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    currency: str
    amount_cents: int
    billing_interval: BillingInterval
    is_active: bool
    provider_price_id: str | None = None


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sku: str
    name: str
    description: str | None = None
    product_type: ProductType
    is_active: bool
    metadata_: dict[str, Any] = Field(default_factory=dict, alias="metadata_")
    prices: list[ProductPriceResponse] = Field(default_factory=list)
    entitlements: list[ProductEntitlementResponse] = Field(default_factory=list)


# ----------------------------------------------------
# SUBSCRIPTIONS SCHEMAS (Backward-compatible)
# ----------------------------------------------------


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    plan_tier: PlanTier = PlanTier.FREE
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool = False
    product_id: uuid.UUID | None = None
    price_id: uuid.UUID | None = None
    provider: str = "stripe"
    provider_subscription_id: str | None = None
    cancelled_at: datetime | None = None
    product_name: str | None = None


class SubscriptionActionResponse(BaseModel):
    subscription_id: uuid.UUID
    status: SubscriptionStatus
    cancel_at_period_end: bool
    message: str


# ----------------------------------------------------
# ORDERS & INVOICES SCHEMAS
# ----------------------------------------------------


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    price_id: uuid.UUID
    quantity: int
    unit_price_cents: int
    total_price_cents: int
    product_name: str | None = None


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_number: str
    user_id: uuid.UUID
    status: OrderStatus
    currency: str
    subtotal_cents: int
    tax_cents: int
    total_cents: int
    refunded_amount_cents: int = 0
    provider: str
    provider_order_reference: str | None = None
    paid_at: datetime | None = None
    refunded_at: datetime | None = None
    created_at: datetime
    items: list[OrderItemResponse] = Field(default_factory=list)


class InvoiceResponse(BaseModel):
    """Invoice / Receipt summary schema."""

    id: str
    amount_cents: int
    currency: str = "eur"
    status: str
    created_at: datetime
    pdf_url: str | None = None


# ----------------------------------------------------
# CHECKOUT & RESERVATION SCHEMAS
# ----------------------------------------------------


class CheckoutRequest(BaseModel):
    price_id: uuid.UUID
    success_url: str | None = None
    cancel_url: str | None = None
    coupon_code: str | None = None
    reservation_id: uuid.UUID | None = None
    metadata: dict[str, str] = Field(default_factory=dict)


class CheckoutResponse(BaseModel):
    session_id: str
    checkout_url: str
    order_id: uuid.UUID
    order_number: str
    amount_total: int
    currency: str
    provider: str
    status: str


class ReservationCreateRequest(BaseModel):
    teacher_id: uuid.UUID
    start_time: datetime
    end_time: datetime


class ReservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slot_identifier: str
    student_id: uuid.UUID
    teacher_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    expires_at: datetime
    status: ReservationStatus
    checkout_session_id: str | None = None
    booking_id: uuid.UUID | None = None


# ----------------------------------------------------
# CREDITS SCHEMAS (Backward-compatible)
# ----------------------------------------------------


class CreditGrantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    initial_credits: int
    remaining_credits: int
    grant_type: CreditGrantType
    reason: str | None = None
    expires_at: datetime | None = None
    created_at: datetime


class CreditConsumptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    credits_consumed: int
    feature_key: str
    reference_id: str | None = None
    reference_type: str | None = None
    created_at: datetime


class CreditBalanceResponse(BaseModel):
    """Credit balance response supporting legacy and enriched domains."""

    user_id: uuid.UUID
    balance: int = 0
    speaking_credits: int = Field(default=0, ge=0)
    writing_credits: int = Field(default=0, ge=0)
    tutoring_hours: float = Field(default=0.0, ge=0.0)
    active_grants: list[CreditGrantResponse] = Field(default_factory=list)


class CreditUsageOverviewResponse(BaseModel):
    balance: int
    consumptions: list[CreditConsumptionResponse]
    grants: list[CreditGrantResponse]


# ----------------------------------------------------
# TEACHER EARNINGS SCHEMAS
# ----------------------------------------------------


class TeacherEarningResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    teacher_id: uuid.UUID
    booking_id: uuid.UUID
    order_id: uuid.UUID | None = None
    gross_amount_cents: int
    platform_fee_cents: int
    net_amount_cents: int
    currency: str
    commission_rate_bps: int
    status: TeacherEarningStatus
    created_at: datetime


class TeacherEarningsSummaryResponse(BaseModel):
    total_gross_cents: int
    total_platform_fee_cents: int
    total_net_cents: int
    available_cents: int
    pending_cents: int
    paid_cents: int
    currency: str = "EUR"
    completed_lessons_count: int


# ----------------------------------------------------
# ADMIN BILLING SCHEMAS
# ----------------------------------------------------


class AdminRefundRequest(BaseModel):
    order_id: uuid.UUID
    amount_cents: int | None = None
    reason: str = "requested_by_customer"


class AdminGrantRequest(BaseModel):
    user_id: uuid.UUID
    grant_type: str  # "credits" | "entitlement" | "subscription"
    amount_or_sku: str
    reason: str
    expires_at: datetime | None = None


class BillingLedgerEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    entry_type: LedgerEntryType
    amount_cents: int
    currency: str
    reference_type: str
    reference_id: str
    provider: str
    provider_reference: str | None = None
    description: str | None = None
    created_at: datetime


class PaymentWebhookEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider: str
    provider_event_id: str
    event_type: str
    received_at: datetime
    processed_at: datetime | None = None
    status: WebhookEventStatus
    processing_error: str | None = None
