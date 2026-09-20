"""Domain enumeration types for billing, monetization, and ledger."""

from enum import Enum


class PlanTier(str, Enum):
    """Legacy and display plan tiers for backward compatibility."""

    FREE = "free"
    PRO_MONTHLY = "pro_monthly"
    PRO_ANNUAL = "pro_annual"
    INTENSIVE_BOOTCAMP = "intensive_bootcamp"


class ProductType(str, Enum):
    """Supported product classifications in the platform catalog."""

    SUBSCRIPTION = "subscription"
    ONE_TIME = "one_time"
    CREDIT_PACK = "credit_pack"
    TEACHER_LESSON = "teacher_lesson"
    WRITING_CORRECTION = "writing_correction"
    AI_USAGE = "ai_usage"


class BillingInterval(str, Enum):
    """Recurring billing frequencies."""

    MONTHLY = "monthly"
    ANNUAL = "annual"
    ONE_TIME = "one_time"


class SubscriptionStatus(str, Enum):
    """Internal lifecycle states for user subscriptions."""

    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    INCOMPLETE = "incomplete"


class OrderStatus(str, Enum):
    """Internal states for financial purchases and orders."""

    PENDING = "pending"
    PAID = "paid"
    PARTIALLY_REFUNDED = "partially_refunded"
    REFUNDED = "refunded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class LedgerEntryType(str, Enum):
    """Immutable categories for double-entry financial ledger events."""

    PAYMENT = "payment"
    REFUND = "refund"
    CREDIT_GRANT = "credit_grant"
    CREDIT_CONSUMPTION = "credit_consumption"
    TEACHER_EARNING = "teacher_earning"
    PLATFORM_COMMISSION = "platform_commission"
    ADJUSTMENT = "adjustment"


class CreditGrantType(str, Enum):
    """Provenance sources for user credit grants."""

    PURCHASE = "purchase"
    ADMIN_GRANT = "admin_grant"
    PROMOTIONAL_GRANT = "promotional_grant"
    SUBSCRIPTION_ALLOWANCE = "subscription_allowance"


class ReservationStatus(str, Enum):
    """State machine for teacher slot holding during checkout."""

    HELD = "held"
    PAID = "paid"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class TeacherEarningStatus(str, Enum):
    """Lifecycle states for teacher booking compensation."""

    PENDING = "pending"
    AVAILABLE = "available"
    PAID = "paid"
    REFUNDED = "refunded"
    REVERSED = "reversed"


class WebhookEventStatus(str, Enum):
    """Processing states for payment provider webhook events."""

    RECEIVED = "received"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"
    IGNORED = "ignored"
