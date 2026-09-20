"""Admin-authorized refund service maintaining ledger immutability and financial integrity."""

import datetime
import uuid

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.integrations.payments.factory import get_payment_provider
from app.modules.billing.enums import (
    LedgerEntryType,
    OrderStatus,
    TeacherEarningStatus,
)
from app.modules.billing.models import (
    BillingLedgerEntry,
    CreditAccount,
    CreditGrant,
    Order,
    TeacherEarning,
)
from app.modules.notifications.schemas import NotificationType
from app.modules.notifications.service import NotificationService
from app.modules.teachers.enums import BookingStatus
from app.modules.teachers.models import TeacherBooking

logger = structlog.get_logger("tef-api.billing.refund")


class RefundService:
    """Service handling partial and full refunds with complete ledger reversal."""

    @classmethod
    async def process_refund(
        cls,
        db: AsyncSession,
        order_id: uuid.UUID,
        amount_cents: int | None = None,
        reason: str = "requested_by_customer",
        actor_id: uuid.UUID | None = None,
    ) -> Order:
        """Process refund with pessimistic locking, provider execution, and ledger reversal."""
        now_utc = datetime.datetime.now(datetime.UTC)

        # 1. Pessimistic lock on Order
        order_stmt = (
            select(Order)
            .where(Order.id == order_id)
            .options(selectinload(Order.items))
            .with_for_update()
        )
        order = (await db.execute(order_stmt)).scalar_one_or_none()
        if not order:
            raise AppException(
                message="Commande introuvable.",
                code="ORDER_NOT_FOUND",
                status_code=404,
            )

        if order.status not in (OrderStatus.PAID, OrderStatus.PARTIALLY_REFUNDED):
            raise AppException(
                message=f"Impossible de rembourser une commande avec le statut '{order.status.value}'.",
                code="INVALID_ORDER_STATUS_FOR_REFUND",
                status_code=400,
            )

        refundable_cents = order.total_cents - order.refunded_amount_cents
        if refundable_cents <= 0:
            raise AppException(
                message="Cette commande a déjà été intégralement remboursée.",
                code="ORDER_ALREADY_REFUNDED",
                status_code=400,
            )

        refund_amount = amount_cents if (amount_cents and amount_cents > 0) else refundable_cents
        if refund_amount > refundable_cents:
            raise AppException(
                message=f"Le montant demandé ({refund_amount / 100:.2f} {order.currency}) dépasse le montant restant remboursable ({refundable_cents / 100:.2f} {order.currency}).",
                code="REFUND_AMOUNT_EXCEEDS_REMAINING",
                status_code=400,
            )

        # 2. Call Payment Provider Refund API
        provider = get_payment_provider()
        payment_ref = order.provider_order_reference or str(order.id)
        refund_res = await provider.create_refund(
            payment_ref=payment_ref,
            amount_cents=refund_amount,
            reason=reason,
        )

        # 3. Update Order state
        order.refunded_amount_cents += refund_amount
        if order.refunded_amount_cents >= order.total_cents:
            order.status = OrderStatus.REFUNDED
        else:
            order.status = OrderStatus.PARTIALLY_REFUNDED
        order.refunded_at = now_utc

        # 4. Record reverse ledger entry
        ledger_entry = BillingLedgerEntry(
            user_id=order.user_id,
            entry_type=LedgerEntryType.REFUND,
            amount_cents=-refund_amount,
            currency=order.currency,
            reference_type="order",
            reference_id=str(order.id),
            provider=order.provider,
            provider_reference=refund_res.refund_id,
            description=f"Remboursement ({reason}) par administrateur {actor_id or 'système'}",
        )
        db.add(ledger_entry)

        # 5. Reverse associated Teacher Earnings and Cancel Booking if applicable
        earning_stmt = (
            select(TeacherEarning)
            .where(TeacherEarning.order_id == order.id)
            .with_for_update()
        )
        teacher_earning = (await db.execute(earning_stmt)).scalar_one_or_none()
        if teacher_earning:
            teacher_earning.status = TeacherEarningStatus.REFUNDED
            # Cancel the booking
            booking_stmt = (
                select(TeacherBooking)
                .where(TeacherBooking.id == teacher_earning.booking_id)
                .with_for_update()
            )
            booking = (await db.execute(booking_stmt)).scalar_one_or_none()
            if booking:
                booking.status = BookingStatus.CANCELLED
                booking.cancellation_reason = f"Remboursement de la commande ({reason})"
                booking.cancelled_at = now_utc

            # Reverse teacher earning in ledger
            db.add(
                BillingLedgerEntry(
                    user_id=order.user_id,
                    entry_type=LedgerEntryType.ADJUSTMENT,
                    amount_cents=-teacher_earning.net_amount_cents,
                    currency=order.currency,
                    reference_type="teacher_booking_reversal",
                    reference_id=str(teacher_earning.booking_id),
                    provider="internal",
                    description=f"Annulation rémunération suite au remboursement de la commande {order.order_number}",
                )
            )

        # 6. Reverse granted credits if this was a credit pack purchase
        credit_grant_stmt = (
            select(CreditGrant)
            .where(CreditGrant.order_id == order.id)
            .with_for_update()
        )
        credit_grant = (await db.execute(credit_grant_stmt)).scalar_one_or_none()
        if credit_grant and credit_grant.remaining_credits > 0:
            deduction = min(credit_grant.remaining_credits, credit_grant.initial_credits)
            credit_grant.remaining_credits -= deduction

            # Adjust credit account
            account_stmt = (
                select(CreditAccount)
                .where(CreditAccount.user_id == order.user_id)
                .with_for_update()
            )
            account = (await db.execute(account_stmt)).scalar_one_or_none()
            if account:
                account.balance = max(0, account.balance - deduction)

            db.add(
                BillingLedgerEntry(
                    user_id=order.user_id,
                    entry_type=LedgerEntryType.ADJUSTMENT,
                    amount_cents=-deduction,
                    currency="EUR",
                    reference_type="credit_grant_reversal",
                    reference_id=str(credit_grant.id),
                    provider="internal",
                    description=f"Annulation des crédits non consommés suite au remboursement de {order.order_number}",
                )
            )

        await db.flush()

        # 7. Notify customer
        try:
            await NotificationService.create_notification(
                db=db,
                user_id=order.user_id,
                title="Remboursement effectué",
                message=f"Un remboursement de {refund_amount / 100:.2f} {order.currency} a été émis pour votre commande {order.order_number}.",
                notification_type=NotificationType.REFUND_COMPLETED if hasattr(NotificationType, "REFUND_COMPLETED") else NotificationType.SYSTEM_ANNOUNCEMENT,
                data={"order_id": str(order.id), "amount_refunded_cents": refund_amount},
            )
        except Exception as notify_err:  # noqa: BLE001
            logger.warning("refund_notification_failed", error=str(notify_err))

        return order
