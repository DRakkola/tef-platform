"""Background tasks managed by Celery."""

import structlog

from app.core.celery_app import celery_app

logger = structlog.get_logger("tef-api.workers")


@celery_app.task(name="tasks.health_check", bind=True)
def health_check_task(self, check_id: str = "health-check") -> dict[str, str]:
    """Trivial health check task proving Celery worker connectivity."""
    logger.info("celery_health_check_executing", task_id=self.request.id, check_id=check_id)
    return {
        "status": "healthy",
        "task_id": str(self.request.id),
        "check_id": check_id,
    }
