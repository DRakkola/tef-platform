"""Tests proving Celery background task execution."""

from app.workers.tasks import health_check_task


def test_celery_health_check_task():
    """Verify that health_check_task can be executed synchronously for testing."""
    result = health_check_task.apply(args=["test-run-123"])
    assert result.successful()
    data = result.result
    assert data["status"] == "healthy"
    assert data["check_id"] == "test-run-123"
