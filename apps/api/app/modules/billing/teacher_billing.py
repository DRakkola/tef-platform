"""Teacher booking monetization, slot reservations, earnings, and platform commission."""

import datetime
import uuid
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.modules.billing.enums import (
    LedgerEntryType,
    ReservationStatus,
    TeacherEarningStatus,
)
from app.modules.billing.models import (
    BillingLedgerEntry,
    BookingReservation,
    Order,
    TeacherEarning,
)
from app.modules.notifications.schemas import NotificationType
from app.modules.notifications.service import NotificationService
from app.modules.teachers.enums import BookingStatus
from app.modules.teachers.models import TeacherBooking
from app.modules.users.models import TeacherProfile, User

logger = structlog.get_logger("tef-api.billing.teacher")


class TeacherBillingService:
    """Service managing paid teacher lesson reservations, earnings, and commissions."""

    DEFAULT_COMMISSION_BPS = 2000  # 20.00% platform commission

    @classmethod
    async def create_booking_reservation(
        cls,
        db: AsyncSession,
        student: User,
        teacher_id: uuid.UUID,
        start_time: datetime.datetime,
        end_time: datetime.datetime,
        hold_duration_minutes: int = 15,
    ) -> BookingReservation:
        """Hold a teacher slot temporarily while checkout is underway.

        Guarantees that two students cannot both checkout the same teacher time slot.
        """
        now_utc = datetime.datetime.now(datetime.UTC)
        start_utc = start_time if start_time.tzinfo else start_time.replace(tzinfo=datetime.UTC)
        end_utc = end_time if end_time.tzinfo else end_time.replace(tzinfo=datetime.UTC)

        if start_utc <= now_utc:
            raise AppException(
                message="Impossible de réserver un créneau passé.",
                code="CANNOT_BOOK_PAST_SLOT",
                status_code=400,
            )

        # 1. Verify teacher profile exists
        teacher_stmt = select(TeacherProfile).where(TeacherProfile.id == teacher_id)
        teacher = (await db.execute(teacher_stmt)).scalar_one_or_none()
        if not teacher:
            raise AppException(
                message="Profil professeur introuvable.",
                code="TEACHER_NOT_FOUND",
                status_code=404,
            )

        if teacher.user_id == student.id:
            raise AppException(
                message="Les professeurs ne peuvent pas réserver de cours avec eux-mêmes.",
                code="SELF_BOOKING_FORBIDDEN",
                status_code=400,
            )

        slot_identifier = f"{teacher_id}_{start_utc.isoformat()}_{end_utc.isoformat()}"

        # 2. Check for active held reservations or overlapping confirmed bookings
        res_stmt = (
            select(BookingReservation)
            .where(
                BookingReservation.slot_identifier == slot_identifier,
                BookingReservation.status == ReservationStatus.HELD,
                BookingReservation.expires_at > now_utc,
            )
            .with_for_update()
        )
        existing_res = (await db.execute(res_stmt)).scalar_one_or_none()
        if existing_res and existing_res.student_id != student.id:
            raise AppException(
                message="Ce créneau est actuellement en cours de réservation par un autre étudiant.",
                code="SLOT_ALREADY_HELD",
                status_code=409,
            )

        booking_stmt = (
            select(TeacherBooking)
            .where(
                TeacherBooking.teacher_id == teacher_id,
                TeacherBooking.status.in_([BookingStatus.REQUESTED, BookingStatus.CONFIRMED]),
                TeacherBooking.start_time < end_utc,
                TeacherBooking.end_time > start_utc,
            )
        )
        if (await db.execute(booking_stmt)).scalar_one_or_none():
            raise AppException(
                message="Ce créneau a déjà été confirmé avec le professeur.",
                code="SLOT_ALREADY_BOOKED",
                status_code=409,
            )

        # 3. Create or refresh reservation
        expires_at = now_utc + datetime.timedelta(minutes=hold_duration_minutes)
        if existing_res:
            existing_res.expires_at = expires_at
            reservation = existing_res
        else:
            reservation = BookingReservation(
                slot_identifier=slot_identifier,
                student_id=student.id,
                teacher_id=teacher_id,
                start_time=start_utc,
                end_time=end_utc,
                expires_at=expires_at,
                status=ReservationStatus.HELD,
            )
            db.add(reservation)

        await db.flush()
        return reservation

    @classmethod
    async def confirm_paid_reservation(
        cls,
        db: AsyncSession,
        reservation_id: uuid.UUID,
        order: Order,
    ) -> tuple[TeacherBooking, TeacherEarning]:
        """Convert a held reservation into a confirmed TeacherBooking and credit TeacherEarning."""
        res_stmt = (
            select(BookingReservation)
            .where(BookingReservation.id == reservation_id)
            .with_for_update()
        )
        reservation = (await db.execute(res_stmt)).scalar_one_or_none()
        if not reservation:
            raise AppException(
                message="Réservation de créneau introuvable.",
                code="RESERVATION_NOT_FOUND",
                status_code=404,
            )

        # 1. Create confirmed TeacherBooking
        booking = TeacherBooking(
            teacher_id=reservation.teacher_id,
            student_id=reservation.student_id,
            start_time=reservation.start_time,
            end_time=reservation.end_time,
            status=BookingStatus.CONFIRMED,
            payment_status="paid",
            notes=f"Réservation payée via commande {order.order_number}",
        )
        db.add(booking)
        await db.flush()

        # 2. Update reservation status
        reservation.status = ReservationStatus.PAID
        reservation.booking_id = booking.id

        # 3. Calculate platform commission and net teacher earning
        commission_bps = cls.DEFAULT_COMMISSION_BPS
        platform_fee_cents = (order.total_cents * commission_bps) // 10000
        net_amount_cents = order.total_cents - platform_fee_cents

        earning = TeacherEarning(
            teacher_id=reservation.teacher_id,
            booking_id=booking.id,
            order_id=order.id,
            gross_amount_cents=order.total_cents,
            platform_fee_cents=platform_fee_cents,
            net_amount_cents=net_amount_cents,
            currency=order.currency,
            commission_rate_bps=commission_bps,
            status=TeacherEarningStatus.AVAILABLE,
        )
        db.add(earning)

        # 4. Record immutable ledger entries
        db.add(
            BillingLedgerEntry(
                user_id=reservation.student_id,
                entry_type=LedgerEntryType.TEACHER_EARNING,
                amount_cents=net_amount_cents,
                currency=order.currency,
                reference_type="teacher_booking",
                reference_id=str(booking.id),
                provider=order.provider,
                description=f"Rémunération professeur pour la session {booking.id}",
            )
        )
        db.add(
            BillingLedgerEntry(
                user_id=reservation.student_id,
                entry_type=LedgerEntryType.PLATFORM_COMMISSION,
                amount_cents=platform_fee_cents,
                currency=order.currency,
                reference_type="teacher_booking",
                reference_id=str(booking.id),
                provider=order.provider,
                description=f"Commission plateforme ({commission_bps // 100}%) pour session {booking.id}",
            )
        )

        await db.flush()

        # 5. Notify teacher and student
        teacher_stmt = select(TeacherProfile).where(TeacherProfile.id == reservation.teacher_id)
        teacher_profile = (await db.execute(teacher_stmt)).scalar_one_or_none()
        if teacher_profile:
            try:
                await NotificationService.create_notification(
                    db=db,
                    user_id=teacher_profile.user_id,
                    title="Nouvelle session réservée et rémunérée",
                    message=f"Une session a été réservée pour le {reservation.start_time.strftime('%d/%m/%Y à %H:%M UTC')}. Gain net : {net_amount_cents / 100:.2f} {order.currency}.",
                    notification_type=NotificationType.TEACHER_EARNING_CREATED if hasattr(NotificationType, "TEACHER_EARNING_CREATED") else NotificationType.SYSTEM_ANNOUNCEMENT,
                    data={"booking_id": str(booking.id), "net_amount_cents": net_amount_cents},
                )
            except Exception as notify_err:  # noqa: BLE001
                logger.warning("teacher_earning_notification_failed", error=str(notify_err))

        return booking, earning

    @classmethod
    async def get_teacher_earnings(
        cls,
        db: AsyncSession,
        teacher_user_id: uuid.UUID,
        limit: int = 50,
    ) -> list[TeacherEarning]:
        """Fetch earnings records for the authenticated teacher."""
        teacher_stmt = select(TeacherProfile).where(TeacherProfile.user_id == teacher_user_id)
        teacher = (await db.execute(teacher_stmt)).scalar_one_or_none()
        if not teacher:
            return []

        stmt = (
            select(TeacherEarning)
            .where(TeacherEarning.teacher_id == teacher.id)
            .order_by(TeacherEarning.created_at.desc())
            .limit(limit)
        )
        return list((await db.execute(stmt)).scalars().all())

    @classmethod
    async def get_teacher_earnings_summary(
        cls,
        db: AsyncSession,
        teacher_user_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Aggregate total gross, commission, and available earnings for teacher."""
        teacher_stmt = select(TeacherProfile).where(TeacherProfile.user_id == teacher_user_id)
        teacher = (await db.execute(teacher_stmt)).scalar_one_or_none()
        if not teacher:
            return {
                "total_gross_cents": 0,
                "total_platform_fee_cents": 0,
                "total_net_cents": 0,
                "available_cents": 0,
                "pending_cents": 0,
                "paid_cents": 0,
                "currency": "EUR",
                "completed_lessons_count": 0,
            }

        stmt = (
            select(
                func.coalesce(func.sum(TeacherEarning.gross_amount_cents), 0),
                func.coalesce(func.sum(TeacherEarning.platform_fee_cents), 0),
                func.coalesce(func.sum(TeacherEarning.net_amount_cents), 0),
                func.count(TeacherEarning.id),
            )
            .where(TeacherEarning.teacher_id == teacher.id)
        )
        row = (await db.execute(stmt)).one()
        gross, fee, net, count = row

        avail_stmt = (
            select(func.coalesce(func.sum(TeacherEarning.net_amount_cents), 0))
            .where(
                TeacherEarning.teacher_id == teacher.id,
                TeacherEarning.status == TeacherEarningStatus.AVAILABLE,
            )
        )
        available = (await db.execute(avail_stmt)).scalar() or 0

        return {
            "total_gross_cents": int(gross),
            "total_platform_fee_cents": int(fee),
            "total_net_cents": int(net),
            "available_cents": int(available),
            "pending_cents": 0,
            "paid_cents": 0,
            "currency": "EUR",
            "completed_lessons_count": int(count),
        }
