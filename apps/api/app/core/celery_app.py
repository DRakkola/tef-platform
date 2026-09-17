"""Celery application configuration with Redis broker and backend."""

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "tef_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes maximum runtime for worker tasks
    worker_prefetch_multiplier=1,
    task_acks_late=True,  # Only ack task when execution finishes successfully
    task_reject_on_worker_lost=True,  # Re-queue task if worker process is abruptly terminated
    broker_connection_retry_on_startup=True,  # Retry connecting to broker on worker launch
    task_default_retry_delay=30,  # Default retry delay in seconds
    task_max_retries=3,  # Cap default retries
)
