"""Authoritative credit management with row-level locking and FIFO/soonest-expiring consumption."""

import datetime
import uuid

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.modules.billing.enums import CreditGrantType, LedgerEntryType
from app.modules.billing.models import (
    BillingLedgerEntry,
    CreditAccount,
    CreditConsumption,
    CreditGrant,
)
from app.modules.notifications.schemas import NotificationType
from app.modules.notifications.service import NotificationService

logger = structlog.get_logger("tef-api.billing.credits")


class CreditsService:
    """PostgreSQL-authoritative credit management service."""

    @staticmethod
    async def get_or_create_account(db: AsyncSession, user_id: uuid.UUID, for_update: bool = False) -> CreditAccount:
        """Retrieve or initialize the user's credit account, optionally locking the row."""
        stmt = select(CreditAccount).where(CreditAccount.user_id == user_id)
        if for_update:
            stmt = stmt.with_for_update()

        account = (await db.execute(stmt)).scalar_one_or_none()
        if not account:
            account = CreditAccount(user_id=user_id, balance=0)
            db.add(account)
            await db.flush()
            if for_update:
                # Re-select with row lock once created
                stmt = select(CreditAccount).where(CreditAccount.user_id == user_id).with_for_update()
                account = (await db.execute(stmt)).scalar_one()

        return account

    @classmethod
    async def grant_credits(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        amount: int,
        grant_type: CreditGrantType,
        reason: str | None = None,
        order_id: uuid.UUID | None = None,
        granted_by_user_id: uuid.UUID | None = None,
        expires_at: datetime.datetime | None = None,
    ) -> CreditGrant:
        """Grant credits to a user, incrementing account balance and recording ledger entries."""
        if amount <= 0:
            raise AppException(
                message="Credit grant amount must be strictly positive",
                code="INVALID_CREDIT_AMOUNT",
                status_code=400,
            )

        # 1. Acquire pessimistic lock on user's credit account
        account = await cls.get_or_create_account(db, user_id=user_id, for_update=True)

        # 2. Create the grant tranche
        grant = CreditGrant(
            user_id=user_id,
            initial_credits=amount,
            remaining_credits=amount,
            grant_type=grant_type,
            order_id=order_id,
            granted_by_user_id=granted_by_user_id,
            reason=reason or f"Credits granted via {grant_type.value}",
            expires_at=expires_at,
        )
        db.add(grant)

        # 3. Update cached balance
        account.balance += amount

        # 4. Record immutable ledger entry
        ledger_entry = BillingLedgerEntry(
            user_id=user_id,
            entry_type=LedgerEntryType.CREDIT_GRANT,
            amount_cents=amount,
            currency="EUR",
            reference_type="credit_grant",
            reference_id=str(grant.id),
            provider="internal",
            description=grant.reason,
        )
        db.add(ledger_entry)

        await db.flush()

        # 5. Emit user notification
        try:
            await NotificationService.create_notification(
                db=db,
                user_id=user_id,
                title="Crédits ajoutés à votre compte",
                message=f"Vous avez reçu {amount} crédits d'entraînement. Nouveau solde : {account.balance}.",
                notification_type=NotificationType.CREDITS_GRANTED if hasattr(NotificationType, "CREDITS_GRANTED") else NotificationType.SYSTEM_ANNOUNCEMENT,
                data={"credits_added": amount, "new_balance": account.balance, "grant_id": str(grant.id)},
            )
        except Exception as notify_err:  # noqa: BLE001
            logger.warning("credits_granted_notification_failed", error=str(notify_err))

        return grant

    @classmethod
    async def consume_credits(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        amount: int,
        feature_key: str,
        reference_id: str | None = None,
        reference_type: str | None = None,
    ) -> list[CreditConsumption]:
        """Atomically consume credits using soonest-expiring ordering and pessimistic row locks.

        Guarantees that two concurrent requests cannot double-spend the same credit balance.
        """
        if amount <= 0:
            raise AppException(
                message="Consumption amount must be strictly positive",
                code="INVALID_CONSUMPTION_AMOUNT",
                status_code=400,
            )

        now_utc = datetime.datetime.now(datetime.UTC)

        # 1. Pessimistic lock on credit account
        account = await cls.get_or_create_account(db, user_id=user_id, for_update=True)
        if account.balance < amount:
            raise AppException(
                message=f"Solde insuffisant : {amount} crédits requis, solde actuel : {account.balance}.",
                code="INSUFFICIENT_CREDITS",
                status_code=402,
            )

        # 2. Query active unexpired credit grants with pessimistic row locks
        # Deterministic consumption order: soonest expiring first, then oldest created
        grants_stmt = (
            select(CreditGrant)
            .where(
                CreditGrant.user_id == user_id,
                CreditGrant.remaining_credits > 0,
                (CreditGrant.expires_at.is_(None) | (CreditGrant.expires_at > now_utc)),
            )
            .order_by(
                CreditGrant.expires_at.asc().nulls_last(),
                CreditGrant.created_at.asc(),
            )
            .with_for_update()
        )
        active_grants = list((await db.execute(grants_stmt)).scalars().all())

        total_available = sum(g.remaining_credits for g in active_grants)
        if total_available < amount:
            # Sync balance if expired grants caused mismatch
            account.balance = total_available
            raise AppException(
                message=f"Crédits valides insuffisants ({total_available} disponibles, {amount} requis).",
                code="INSUFFICIENT_CREDITS",
                status_code=402,
            )

        # 3. Deduct from grants
        remaining_to_deduct = amount
        consumptions: list[CreditConsumption] = []

        for grant in active_grants:
            if remaining_to_deduct <= 0:
                break

            deduction = min(grant.remaining_credits, remaining_to_deduct)
            grant.remaining_credits -= deduction
            remaining_to_deduct -= deduction

            consumption = CreditConsumption(
                user_id=user_id,
                credits_consumed=deduction,
                feature_key=feature_key,
                reference_id=reference_id,
                reference_type=reference_type,
                grant_id=grant.id,
            )
            db.add(consumption)
            consumptions.append(consumption)

        # 4. Update account balance
        account.balance -= amount

        # 5. Record immutable financial ledger entry
        ledger_entry = BillingLedgerEntry(
            user_id=user_id,
            entry_type=LedgerEntryType.CREDIT_CONSUMPTION,
            amount_cents=amount,
            currency="EUR",
            reference_type=reference_type or "feature_consumption",
            reference_id=reference_id or feature_key,
            provider="internal",
            description=f"Consommation de {amount} crédit(s) pour '{feature_key}'",
        )
        db.add(ledger_entry)

        await db.flush()

        # 6. Low credit balance notification if balance <= 2
        if account.balance <= 2:
            try:
                await NotificationService.create_notification(
                    db=db,
                    user_id=user_id,
                    title="Solde de crédits bas",
                    message=f"Il ne vous reste que {account.balance} crédit(s). Rechargez votre compte pour continuer vos entraînements.",
                    notification_type=NotificationType.CREDITS_LOW if hasattr(NotificationType, "CREDITS_LOW") else NotificationType.SYSTEM_ANNOUNCEMENT,
                    data={"remaining_balance": account.balance},
                )
            except Exception as notify_err:  # noqa: BLE001
                logger.warning("credits_low_notification_failed", error=str(notify_err))

        return consumptions

    @classmethod
    async def get_balance(cls, db: AsyncSession, user_id: uuid.UUID) -> int:
        """Get current valid unexpired credit balance."""
        now_utc = datetime.datetime.now(datetime.UTC)
        stmt = (
            select(func.coalesce(func.sum(CreditGrant.remaining_credits), 0))
            .where(
                CreditGrant.user_id == user_id,
                CreditGrant.remaining_credits > 0,
                (CreditGrant.expires_at.is_(None) | (CreditGrant.expires_at > now_utc)),
            )
        )
        balance = (await db.execute(stmt)).scalar() or 0
        return int(balance)
