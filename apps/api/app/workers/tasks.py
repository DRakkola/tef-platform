"""Background tasks managed by Celery."""

import asyncio
import concurrent.futures
import datetime
from collections.abc import Coroutine
from typing import Any

import structlog
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.celery_app import celery_app
from app.core.database import async_session_factory
from app.modules.billing.enums import ReservationStatus
from app.modules.billing.models import BookingReservation
from app.modules.practice_pool.enums import (
    PracticeQueueStatus,
    PracticeRequestStatus,
    PracticeSessionStatus,
)
from app.modules.practice_pool.models import (
    PracticeQueueEntry,
    PracticeRequest,
    PracticeSession,
)
from app.modules.practice_pool.presence import get_presence_manager
from app.modules.practice_pool.transport import get_practice_media_transport

logger = structlog.get_logger("tef-api.workers")


def run_async(coro: Coroutine[Any, Any, Any]) -> Any:
    """Helper to run async coroutines in synchronous Celery worker threads or active test loops."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(asyncio.run, coro).result()


@celery_app.task(name="tasks.health_check", bind=True)
def health_check_task(self, check_id: str = "health-check") -> dict[str, str]:
    """Trivial health check task proving Celery worker connectivity."""
    logger.info("celery_health_check_executing", task_id=self.request.id, check_id=check_id)
    return {
        "status": "healthy",
        "task_id": str(self.request.id),
        "check_id": check_id,
    }


async def cleanup_expired_practice_requests_core(db: AsyncSession) -> int:
    """Core logic to expire lapsed practice requests."""
    now_utc = datetime.datetime.now(datetime.UTC)
    stmt = select(PracticeRequest).where(
        PracticeRequest.status == PracticeRequestStatus.PENDING,
        PracticeRequest.expires_at <= now_utc,
    )
    expired_requests = (await db.execute(stmt)).scalars().all()
    count = len(expired_requests)
    for req in expired_requests:
        req.status = PracticeRequestStatus.EXPIRED
    if count > 0:
        await db.commit()
        logger.info("celery_expired_practice_requests_cleaned", count=count)
    return count


async def cleanup_stale_practice_queue_core(db: AsyncSession) -> int:
    """Core logic to prune stale queue entries whose Redis presence expired."""
    presence = get_presence_manager()
    await presence.cleanup_expired_presence()

    now_utc = datetime.datetime.now(datetime.UTC)
    stmt = select(PracticeQueueEntry).where(
        PracticeQueueEntry.status == PracticeQueueStatus.WAITING,
    )
    waiting_entries = (await db.execute(stmt)).scalars().all()
    pruned_count = 0
    for entry in waiting_entries:
        item = await presence.get_queue_entry(entry.user_id)
        if item is None:
            entry.status = PracticeQueueStatus.EXPIRED
            entry.left_at = now_utc
            pruned_count += 1

    if pruned_count > 0:
        await db.commit()
        logger.info("celery_stale_queue_entries_pruned", count=pruned_count)
    return pruned_count


async def cleanup_expired_practice_sessions_core(db: AsyncSession) -> int:
    """Core logic to expire lapsed active sessions and release media rooms."""
    now_utc = datetime.datetime.now(datetime.UTC)
    stmt = select(PracticeSession).where(
        PracticeSession.status == PracticeSessionStatus.ACTIVE,
        PracticeSession.expires_at <= now_utc,
    )
    expired_sessions = (await db.execute(stmt)).scalars().all()
    count = len(expired_sessions)
    for session in expired_sessions:
        session.status = PracticeSessionStatus.EXPIRED
        try:
            get_practice_media_transport().close_room(session.room_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "celery_failed_to_close_media_room",
                room_id=session.room_id,
                error=str(exc),
            )

    if count > 0:
        await db.commit()
        logger.info("celery_expired_practice_sessions_cleaned", count=count)
    return count


async def cleanup_abandoned_practice_sessions_core(db: AsyncSession) -> int:
    """Core logic to mark unjoined waiting sessions as abandoned."""
    now_utc = datetime.datetime.now(datetime.UTC)
    cutoff = now_utc - datetime.timedelta(minutes=10)
    stmt = select(PracticeSession).where(
        PracticeSession.status == PracticeSessionStatus.WAITING,
        PracticeSession.created_at <= cutoff,
    )
    abandoned_sessions = (await db.execute(stmt)).scalars().all()
    count = len(abandoned_sessions)
    for session in abandoned_sessions:
        session.status = PracticeSessionStatus.ABANDONED
        try:
            get_practice_media_transport().close_room(session.room_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "celery_failed_to_close_abandoned_room",
                room_id=session.room_id,
                error=str(exc),
            )

    if count > 0:
        await db.commit()
        logger.info("celery_abandoned_practice_sessions_cleaned", count=count)
    return count


@celery_app.task(name="tasks.cleanup_expired_practice_requests", bind=True)
def cleanup_expired_practice_requests(self) -> dict[str, Any]:
    """Cancel and expire practice requests older than their expiration timestamp (60s)."""

    async def _cleanup() -> int:
        async with async_session_factory() as db:
            return await cleanup_expired_practice_requests_core(db)

    count = run_async(_cleanup())
    return {"status": "success", "expired_requests_count": count}


@celery_app.task(name="tasks.cleanup_stale_practice_queue", bind=True)
def cleanup_stale_practice_queue(self) -> dict[str, Any]:
    """Prune queue entries whose heartbeat TTL has lapsed in Redis."""

    async def _cleanup() -> int:
        async with async_session_factory() as db:
            return await cleanup_stale_practice_queue_core(db)

    count = run_async(_cleanup())
    return {"status": "success", "pruned_queue_entries_count": count}


@celery_app.task(name="tasks.cleanup_expired_practice_sessions", bind=True)
def cleanup_expired_practice_sessions(self) -> dict[str, Any]:
    """Transition completed 25-minute practice sessions to EXPIRED and release media room."""

    async def _cleanup() -> int:
        async with async_session_factory() as db:
            return await cleanup_expired_practice_sessions_core(db)

    count = run_async(_cleanup())
    return {"status": "success", "expired_sessions_count": count}


@celery_app.task(name="tasks.cleanup_abandoned_practice_sessions", bind=True)
def cleanup_abandoned_practice_sessions(self) -> dict[str, Any]:
    """Transition waiting practice sessions that were never joined (> 10m) to ABANDONED."""

    async def _cleanup() -> int:
        async with async_session_factory() as db:
            return await cleanup_abandoned_practice_sessions_core(db)

    count = run_async(_cleanup())
    return {"status": "success", "abandoned_sessions_count": count}


async def cleanup_expired_booking_reservations_core(db: AsyncSession) -> int:
    """Expire temporary held booking reservations past their expiration timestamp."""
    now_utc = datetime.datetime.now(datetime.UTC)
    stmt = (
        select(BookingReservation)
        .where(
            BookingReservation.status == ReservationStatus.HELD,
            BookingReservation.expires_at <= now_utc,
        )
        .with_for_update()
    )
    expired_reservations = list((await db.execute(stmt)).scalars().all())
    count = len(expired_reservations)
    for res in expired_reservations:
        res.status = ReservationStatus.EXPIRED

    if count > 0:
        await db.commit()
        logger.info("celery_expired_booking_reservations_cleaned", count=count)
    return count


@celery_app.task(name="tasks.cleanup_expired_booking_reservations", bind=True)
def cleanup_expired_booking_reservations(self) -> dict[str, Any]:
    """Release held teacher booking slots that were not paid within 15 minutes."""

    async def _cleanup() -> int:
        async with async_session_factory() as db:
            return await cleanup_expired_booking_reservations_core(db)

    count = run_async(_cleanup())
    return {"status": "success", "expired_reservations_count": count}


async def reconcile_billing_daily_core(db: AsyncSession) -> dict[str, Any]:
    """Execute daily financial reconciliation check."""
    from app.modules.billing.reconciliation import BillingReconciliationService

    report = await BillingReconciliationService.reconcile(db)
    logger.info(
        "celery_billing_reconciliation_completed",
        total_findings=report.total_findings,
        healthy=report.healthy,
    )
    return {
        "total_findings": report.total_findings,
        "healthy": report.healthy,
    }


@celery_app.task(name="tasks.reconcile_billing_daily", bind=True)
def reconcile_billing_daily(self) -> dict[str, Any]:
    """Execute daily scheduled financial audit."""

    async def _reconcile() -> dict[str, Any]:
        async with async_session_factory() as db:
            return await reconcile_billing_daily_core(db)

    result = run_async(_reconcile())
    return {"status": "success", "report": result}


@celery_app.task(name="tasks.process_payment_webhook_event", bind=True)
def process_payment_webhook_event(
    self, provider: str, raw_body_str: str, signature: str
) -> dict[str, Any]:
    """Asynchronous processor for queued payment webhooks."""
    from app.modules.billing.service import BillingService

    async def _process() -> dict[str, Any]:
        async with async_session_factory() as db:
            return await BillingService.process_webhook(
                db=db,
                provider_name=provider,
                raw_body=raw_body_str.encode("utf-8"),
                signature_header=signature,
            )

    result = run_async(_process())
    return {"status": "success", "result": result}


async def cleanup_retention_artifacts_core(db: AsyncSession) -> dict[str, int]:
    """Prune data past statutory or operational retention horizons."""
    now_utc = datetime.datetime.now(datetime.UTC)
    from app.modules.admin.models import AuditEvent
    from app.modules.writing.models import WritingDraftRevision

    # 1. Purge draft revisions older than 7 days
    cutoff_7d = now_utc - datetime.timedelta(days=7)
    stmt_drafts = delete(WritingDraftRevision).where(WritingDraftRevision.created_at <= cutoff_7d)
    draft_res = await db.execute(stmt_drafts)
    purged_drafts = draft_res.rowcount if hasattr(draft_res, "rowcount") and draft_res.rowcount is not None else 0

    # 2. Anonymize/truncate audit log IP addresses older than 90 days
    cutoff_90d = now_utc - datetime.timedelta(days=90)
    stmt_audit = (
        update(AuditEvent)
        .where(AuditEvent.created_at <= cutoff_90d, AuditEvent.ip_address.isnot(None))
        .values(ip_address="0.0.0.0/0_redacted")
    )
    audit_res = await db.execute(stmt_audit)
    anonymized_ips = audit_res.rowcount if hasattr(audit_res, "rowcount") and audit_res.rowcount is not None else 0

    await db.commit()
    logger.info(
        "celery_retention_artifacts_cleaned",
        purged_drafts=purged_drafts,
        anonymized_ips=anonymized_ips,
    )
    return {
        "purged_drafts_count": purged_drafts,
        "anonymized_ips_count": anonymized_ips,
    }


@celery_app.task(name="tasks.cleanup_retention_artifacts", bind=True)
def cleanup_retention_artifacts(self) -> dict[str, Any]:
    """Execute periodic GDPR and data retention minimization job."""

    async def _cleanup() -> dict[str, int]:
        async with async_session_factory() as db:
            return await cleanup_retention_artifacts_core(db)

    results = run_async(_cleanup())
    return {"status": "success", "results": results}


async def recalculate_student_readiness_core(db: AsyncSession, student_id_str: str) -> dict[str, Any]:
    """Recalculate student readiness and generate immutable snapshot."""
    import uuid
    from app.modules.learning.readiness_engine import ReadinessEngine

    student_id = uuid.UUID(student_id_str)
    profile = await ReadinessEngine.recalculate_student_readiness(db, student_id)
    return {
        "student_id": student_id_str,
        "overall_estimate": profile.overall_estimate,
        "readiness_band": profile.readiness_band.value if hasattr(profile.readiness_band, "value") else str(profile.readiness_band),
        "confidence": profile.confidence,
    }


@celery_app.task(name="tasks.recalculate_student_readiness", bind=True)
def recalculate_student_readiness_task(self, student_id: str) -> dict[str, Any]:
    """Background task to recalculate a student's readiness profile and snapshot."""

    async def _recalc() -> dict[str, Any]:
        async with async_session_factory() as db:
            return await recalculate_student_readiness_core(db, student_id)

    res = run_async(_recalc())
    return {"status": "success", "data": res}


async def audit_exercise_effectiveness_core(db: AsyncSession) -> int:
    """Compute aggregate pre/post scores and observed improvement for exercises."""
    from app.modules.learning.models import Exercise, ExerciseAttempt, ExerciseEffectiveness, ExerciseSkill, SkillEvidence

    # Query exercises with attempts
    stmt = select(Exercise).where(Exercise.is_published.is_(True))
    exercises = (await db.execute(stmt)).scalars().all()
    updated_count = 0

    for ex in exercises:
        attempts_stmt = select(ExerciseAttempt).where(ExerciseAttempt.exercise_id == ex.id)
        attempts = (await db.execute(attempts_stmt)).scalars().all()
        if not attempts:
            continue

        attempts_count = len(attempts)
        correct_count = sum(1 for a in attempts if a.is_correct)
        completion_rate = round(correct_count / attempts_count, 2)

        # Average score on attempts
        avg_score = round(sum(a.points_awarded for a in attempts) / attempts_count * 100.0, 1) if attempts_count > 0 else 0.0

        # Link to skills
        skills_stmt = select(ExerciseSkill.skill_id).where(ExerciseSkill.exercise_id == ex.id)
        skill_ids = (await db.execute(skills_stmt)).scalars().all()

        for s_id in skill_ids:
            eff = await db.scalar(
                select(ExerciseEffectiveness).where(
                    ExerciseEffectiveness.exercise_id == ex.id,
                    ExerciseEffectiveness.skill_id == s_id,
                )
            )
            if not eff:
                eff = ExerciseEffectiveness(
                    exercise_id=ex.id,
                    skill_id=s_id,
                    attempts=attempts_count,
                    completion_rate=completion_rate,
                    average_pre_score=50.0,
                    average_post_score=avg_score,
                    observed_improvement=round(max(0.0, avg_score - 50.0), 1),
                )
                db.add(eff)
            else:
                eff.attempts = attempts_count
                eff.completion_rate = completion_rate
                eff.average_post_score = avg_score
                eff.observed_improvement = round(max(0.0, avg_score - eff.average_pre_score), 1)

            updated_count += 1

    if updated_count > 0:
        await db.commit()
        logger.info("celery_exercise_effectiveness_audited", count=updated_count)
    return updated_count


@celery_app.task(name="tasks.audit_exercise_effectiveness_daily", bind=True)
def audit_exercise_effectiveness_daily_task(self) -> dict[str, Any]:
    """Periodic task calculating observed improvement after practice for exercises."""

    async def _audit() -> int:
        async with async_session_factory() as db:
            return await audit_exercise_effectiveness_core(db)

    count = run_async(_audit())
    return {"status": "success", "exercises_audited": count}


async def generate_daily_beta_report_core(db: AsyncSession) -> dict[str, Any]:
    """Aggregates executive beta metrics for the daily operations briefing."""
    from app.modules.analytics.service import AnalyticsService

    overview = await AnalyticsService.get_overview_metrics(db=db, date_range="last_24_hours")
    report = {
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "total_registered": overview.total_registered_users,
        "active_users": overview.active_users,
        "activated_users": overview.activated_users,
        "activation_rate": overview.activation_rate,
        "ai_cost_usd": overview.ai_estimated_cost,
        "total_revenue_usd": overview.total_revenue,
        "assessments_completed": overview.assessments_completed,
    }
    logger.info("celery_daily_beta_report_generated", **report)
    return report


@celery_app.task(name="tasks.generate_daily_beta_report", bind=True)
def generate_daily_beta_report_task(self) -> dict[str, Any]:
    """Generates daily executive summary of private beta metrics."""

    async def _run() -> dict[str, Any]:
        async with async_session_factory() as db:
            return await generate_daily_beta_report_core(db)

    report = run_async(_run())
    return {"status": "success", "report": report}


async def detect_operational_anomalies_core(db: AsyncSession) -> list[dict[str, Any]]:
    """Scans telemetry for operational anomalies such as payment drops, AI failure spikes, or stalled queues."""
    from app.modules.analytics.service import AnalyticsService

    anomalies: list[dict[str, Any]] = []

    # 1. Check AI failure rates
    ai_analytics = await AnalyticsService.get_ai_analytics(db=db)
    if ai_analytics.ai_failure_rate > 0.05:
        anomalies.append({
            "severity": "high",
            "type": "ai_failure_spike",
            "message": f"AI failure rate elevated at {ai_analytics.ai_failure_rate * 100:.1f}%",
        })

    # 2. Check billing failure rates
    billing = await AnalyticsService.get_billing_analytics(db=db)
    if billing.failed_payments > 5 and billing.successful_payments == 0:
        anomalies.append({
            "severity": "critical",
            "type": "payment_failure_anomaly",
            "message": f"Consecutive failed payments ({billing.failed_payments}) with zero successes",
        })

    # 3. Check content expiration rate
    content = await AnalyticsService.get_content_analytics(db=db)
    if content.average_expiration_rate > 0.40:
        anomalies.append({
            "severity": "medium",
            "type": "assessment_abandonment_spike",
            "message": f"Assessment expiration rate is high ({content.average_expiration_rate * 100:.1f}%)",
        })

    if anomalies:
        logger.warning("operational_anomalies_detected", anomaly_count=len(anomalies), anomalies=anomalies)
    else:
        logger.info("operational_anomalies_scan_clean")

    return anomalies


@celery_app.task(name="tasks.detect_operational_anomalies", bind=True)
def detect_operational_anomalies_task(self) -> dict[str, Any]:
    """Scans platform telemetry for operational degradation and automated alerts."""

    async def _run() -> list[dict[str, Any]]:
        async with async_session_factory() as db:
            return await detect_operational_anomalies_core(db)

    anomalies = run_async(_run())
    return {"status": "success", "anomalies_detected": len(anomalies), "anomalies": anomalies}





