"""Reconciliation service scanning for state discrepancies across Provider and PostgreSQL."""

import datetime
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.enums import (
    OrderStatus,
    SubscriptionStatus,
)
from app.modules.billing.models import (
    CreditAccount,
    Order,
    Subscription,
    TeacherEarning,
)
from app.modules.teachers.models import TeacherBooking


@dataclass
class ReconciliationFinding:
    """Discrepancy detected during financial reconciliation."""

    category: str
    severity: str  # "high", "medium", "low"
    reference_id: str
    message: str
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class ReconciliationReport:
    """Summary of reconciliation audit run."""

    generated_at: datetime.datetime
    total_findings: int
    findings: list[ReconciliationFinding]
    healthy: bool


class BillingReconciliationService:
    """Audits local PostgreSQL financial records against expected state invariants."""

    @classmethod
    async def reconcile(cls, db: AsyncSession) -> ReconciliationReport:
        """Run full internal audit scan and compile report."""
        now_utc = datetime.datetime.now(datetime.UTC)
        findings: list[ReconciliationFinding] = []

        # 1. Check for stale pending orders (older than 2 hours that were never finalized)
        stale_threshold = now_utc - datetime.timedelta(hours=2)
        stale_orders_stmt = select(Order).where(
            Order.status == OrderStatus.PENDING,
            Order.created_at < stale_threshold,
        )
        stale_orders = list((await db.execute(stale_orders_stmt)).scalars().all())
        for order in stale_orders:
            findings.append(
                ReconciliationFinding(
                    category="stale_order",
                    severity="low",
                    reference_id=str(order.id),
                    message=f"Commande {order.order_number} en attente depuis plus de 2 heures.",
                    details={"total_cents": order.total_cents, "created_at": order.created_at.isoformat()},
                )
            )

        # 2. Check for negative credit balances (invariant violation)
        neg_credits_stmt = select(CreditAccount).where(CreditAccount.balance < 0)
        neg_accounts = list((await db.execute(neg_credits_stmt)).scalars().all())
        for acc in neg_accounts:
            findings.append(
                ReconciliationFinding(
                    category="negative_balance",
                    severity="high",
                    reference_id=str(acc.user_id),
                    message=f"Solde de crédits négatif ({acc.balance}) pour l'utilisateur {acc.user_id}.",
                    details={"balance": acc.balance},
                )
            )

        # 3. Check for TeacherBookings marked 'paid' without matching TeacherEarning
        paid_bookings_stmt = (
            select(TeacherBooking)
            .where(
                TeacherBooking.payment_status == "paid",
                ~TeacherBooking.id.in_(select(TeacherEarning.booking_id)),
            )
        )
        orphaned_bookings = list((await db.execute(paid_bookings_stmt)).scalars().all())
        for b in orphaned_bookings:
            findings.append(
                ReconciliationFinding(
                    category="missing_teacher_earning",
                    severity="high",
                    reference_id=str(b.id),
                    message=f"Session payée {b.id} sans enregistrement de rémunération professeur.",
                    details={"teacher_id": str(b.teacher_id), "student_id": str(b.student_id)},
                )
            )

        # 4. Check for active subscriptions whose current_period_end is significantly expired
        expired_sub_threshold = now_utc - datetime.timedelta(days=2)
        expired_active_subs_stmt = select(Subscription).where(
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.current_period_end < expired_sub_threshold,
        )
        expired_subs = list((await db.execute(expired_active_subs_stmt)).scalars().all())
        for sub in expired_subs:
            findings.append(
                ReconciliationFinding(
                    category="expired_active_subscription",
                    severity="medium",
                    reference_id=str(sub.id),
                    message=f"Abonnement {sub.id} avec statut 'active' mais période expirée le {sub.current_period_end.isoformat()}.",
                    details={"provider_sub_id": sub.provider_subscription_id},
                )
            )

        # 5. Teacher earnings gross vs commission arithmetic check
        earnings_stmt = select(TeacherEarning)
        earnings = list((await db.execute(earnings_stmt)).scalars().all())
        for e in earnings:
            if (e.platform_fee_cents + e.net_amount_cents) != e.gross_amount_cents:
                findings.append(
                    ReconciliationFinding(
                        category="earning_math_mismatch",
                        severity="high",
                        reference_id=str(e.id),
                        message=f"Incohérence mathématique sur le gain professeur {e.id} : {e.platform_fee_cents} + {e.net_amount_cents} != {e.gross_amount_cents}.",
                        details={"gross": e.gross_amount_cents, "fee": e.platform_fee_cents, "net": e.net_amount_cents},
                    )
                )

        return ReconciliationReport(
            generated_at=now_utc,
            total_findings=len(findings),
            findings=findings,
            healthy=len(findings) == 0,
        )
