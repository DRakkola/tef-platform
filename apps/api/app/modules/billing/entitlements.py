"""Centralized Entitlement Service decoupling domain features from subscription plans."""

import datetime
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.modules.billing.credits_service import CreditsService
from app.modules.billing.enums import SubscriptionStatus
from app.modules.billing.models import (
    AIUsageRecord,
    ProductEntitlement,
    Subscription,
    UserEntitlementGrant,
)
from app.modules.users.models import User, UserRole

# Configurable credit costs per action
FEATURE_CREDIT_COSTS: dict[str, int] = {
    "ai_writing": 1,
    "ai_speaking": 2,
    "human_writing": 5,
    "teacher_lesson": 10,
    "mock_test": 2,
}

# Free tier monthly allowances
FREE_TIER_MONTHLY_LIMITS: dict[str, int] = {
    "mock_tests": 2,
    "exercises": 10,
    "ai_writing": 3,
    "ai_speaking": 3,
}


class EntitlementService:
    """Central authority for feature gating and quota enforcement."""

    @classmethod
    async def can_use_feature(
        cls, db: AsyncSession, user: User, feature_key: str, required_units: int = 1
    ) -> bool:
        """Evaluate if user is entitled to use a feature via subscription, grant, credit, or free quota."""
        # 1. Platform Administrators have full access
        if user.role == UserRole.ADMIN:
            return True

        now_utc = datetime.datetime.now(datetime.UTC)

        # 2. Check manual / promotional entitlement grants
        grant_stmt = select(UserEntitlementGrant).where(
            UserEntitlementGrant.user_id == user.id,
            UserEntitlementGrant.feature_key == feature_key,
            UserEntitlementGrant.is_active == True,
            (UserEntitlementGrant.expires_at.is_(None) | (UserEntitlementGrant.expires_at > now_utc)),
        )
        if (await db.execute(grant_stmt)).scalar_one_or_none():
            return True

        # 3. Check active subscriptions
        sub_stmt = (
            select(Subscription)
            .where(
                Subscription.user_id == user.id,
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.current_period_end > now_utc,
            )
            .options(
                selectinload(Subscription.product).selectinload(ProductEntitlement.product)
            )
        )
        subscriptions = list((await db.execute(sub_stmt)).scalars().all())

        for sub in subscriptions:
            if sub.product:
                for ent in sub.product.entitlements:
                    if ent.feature_key == feature_key or ent.feature_key == f"unlimited_{feature_key}":
                        if ent.is_unlimited:
                            return True
                        if ent.limit_units > 0:
                            # Check quota consumed in current subscription period
                            usage_stmt = select(func.coalesce(func.sum(AIUsageRecord.units), 0)).where(
                                AIUsageRecord.user_id == user.id,
                                AIUsageRecord.feature == feature_key,
                                AIUsageRecord.created_at >= sub.current_period_start,
                                AIUsageRecord.created_at <= sub.current_period_end,
                            )
                            used = (await db.execute(usage_stmt)).scalar() or 0
                            if (used + required_units) <= ent.limit_units:
                                return True

        # 4. Check credit account balance
        credit_cost = FEATURE_CREDIT_COSTS.get(feature_key, 0) * required_units
        if credit_cost > 0:
            user_credits = await CreditsService.get_balance(db, user_id=user.id)
            if user_credits >= credit_cost:
                return True

        # 5. Check default free monthly quota
        free_limit = FREE_TIER_MONTHLY_LIMITS.get(feature_key, 0)
        if free_limit > 0:
            month_start = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            usage_stmt = select(func.coalesce(func.sum(AIUsageRecord.units), 0)).where(
                AIUsageRecord.user_id == user.id,
                AIUsageRecord.feature == feature_key,
                AIUsageRecord.created_at >= month_start,
            )
            monthly_used = (await db.execute(usage_stmt)).scalar() or 0
            if (monthly_used + required_units) <= free_limit:
                return True

        return False

    @classmethod
    async def require_feature(
        cls, db: AsyncSession, user: User, feature_key: str, required_units: int = 1
    ) -> None:
        """Enforce feature entitlement, raising a 402/403 AppException if unauthorized."""
        allowed = await cls.can_use_feature(db, user, feature_key, required_units)
        if not allowed:
            raise AppException(
                message=f"Cette fonctionnalité ({feature_key}) nécessite un abonnement Premium ou des crédits suffisants.",
                code="ENTITLEMENT_REQUIRED",
                status_code=402,
            )

    @classmethod
    async def consume_usage(
        cls,
        db: AsyncSession,
        user: User,
        feature_key: str,
        units: int = 1,
        audio_seconds: int | None = None,
        model: str = "tef-evaluator-v1",
        provider: str = "internal",
    ) -> AIUsageRecord:
        """Record usage and consume credits if not covered by unlimited subscription."""
        now_utc = datetime.datetime.now(datetime.UTC)

        # Determine if user is covered by an unlimited subscription
        is_unlimited = False
        if user.role == UserRole.ADMIN:
            is_unlimited = True
        else:
            sub_stmt = (
                select(Subscription)
                .where(
                    Subscription.user_id == user.id,
                    Subscription.status == SubscriptionStatus.ACTIVE,
                    Subscription.current_period_end > now_utc,
                )
                .options(selectinload(Subscription.product))
            )
            subs = list((await db.execute(sub_stmt)).scalars().all())
            for sub in subs:
                if sub.product:
                    for ent in sub.product.entitlements:
                        if (ent.feature_key == feature_key or ent.feature_key == f"unlimited_{feature_key}") and ent.is_unlimited:
                            is_unlimited = True
                            break

        credits_to_consume = 0
        if not is_unlimited:
            # If feature costs credits, deduct them
            base_cost = FEATURE_CREDIT_COSTS.get(feature_key, 0)
            credits_to_consume = base_cost * units
            if credits_to_consume > 0:
                await CreditsService.consume_credits(
                    db=db,
                    user_id=user.id,
                    amount=credits_to_consume,
                    feature_key=feature_key,
                    reference_type="ai_usage",
                )

        record = AIUsageRecord(
            user_id=user.id,
            feature=feature_key,
            provider=provider,
            model=model,
            units=units,
            audio_seconds=audio_seconds,
            credits_consumed=credits_to_consume,
        )
        db.add(record)
        await db.flush()
        return record

    @classmethod
    async def can_use_ai_writing(cls, db: AsyncSession, user: User) -> bool:
        """Convenience check for AI writing correction entitlement."""
        return await cls.can_use_feature(db, user, "ai_writing")

    @classmethod
    async def can_use_ai_speaking(cls, db: AsyncSession, user: User) -> bool:
        """Convenience check for AI speaking practice session entitlement."""
        return await cls.can_use_feature(db, user, "ai_speaking")

    @classmethod
    async def can_take_premium_assessment(
        cls, db: AsyncSession, user: User, assessment_id: uuid.UUID | None = None
    ) -> bool:
        """Convenience check for timed exam simulations."""
        return await cls.can_use_feature(db, user, "mock_tests")

    @classmethod
    async def can_book_teacher(
        cls, db: AsyncSession, user: User, teacher_id: uuid.UUID | None = None
    ) -> bool:
        """Convenience check for 1-to-1 teacher bookings."""
        return await cls.can_use_feature(db, user, "teacher_lesson")

    @classmethod
    async def get_entitlements(cls, db: AsyncSession, user: User) -> dict[str, Any]:
        """Aggregate active entitlements for user dashboard."""
        now_utc = datetime.datetime.now(datetime.UTC)
        is_admin = user.role == UserRole.ADMIN

        sub_stmt = (
            select(Subscription)
            .where(
                Subscription.user_id == user.id,
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.current_period_end > now_utc,
            )
            .options(selectinload(Subscription.product))
        )
        subs = list((await db.execute(sub_stmt)).scalars().all())
        has_active_subscription = bool(subs or is_admin)

        credit_balance = await CreditsService.get_balance(db, user.id)

        features = {
            "unlimited_mock_tests": has_active_subscription or is_admin,
            "premium_exercises": has_active_subscription or is_admin,
            "progress_dashboard": True,
            "ai_writing": has_active_subscription or credit_balance >= 1 or is_admin,
            "ai_speaking": has_active_subscription or credit_balance >= 2 or is_admin,
            "speaking_practice": has_active_subscription or is_admin,
            "credits_balance": credit_balance,
            "has_subscription": has_active_subscription,
            "subscription_tier": subs[0].product.sku if subs and subs[0].product else ("admin" if is_admin else "free"),
        }
        return features
