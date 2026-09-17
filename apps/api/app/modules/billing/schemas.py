"""Pydantic schemas for the billing, subscriptions, and credits domain."""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class PlanTier(str, Enum):
    FREE = "free"
    PRO_MONTHLY = "pro_monthly"
    PRO_ANNUAL = "pro_annual"
    INTENSIVE_BOOTCAMP = "intensive_bootcamp"


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    TRIALING = "trialing"


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    plan_tier: PlanTier
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool = False


class CreditBalanceResponse(BaseModel):
    user_id: uuid.UUID
    speaking_credits: int = Field(default=0, ge=0)
    writing_credits: int = Field(default=0, ge=0)
    tutoring_hours: float = Field(default=0.0, ge=0.0)


class InvoiceResponse(BaseModel):
    id: str
    amount_cents: int
    currency: str = "eur"
    status: str
    created_at: datetime
    pdf_url: str | None = None
