"""Regression tests for production readiness, fail-safes, and operational reliability."""

import pytest
from pydantic import ValidationError

from app.core.celery_app import celery_app
from app.core.config import Settings
from app.core.database import Base


def test_production_settings_rejects_default_secret_key() -> None:
    """Settings must fail fast in production if the default development secret is used."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="dev-secret-key-change-in-production-must-be-32-chars-long",
            POSTGRES_PASSWORD="strong_prod_pg_password_12345",
            REDIS_PASSWORD="strong_prod_redis_password_12345",
            STORAGE_ACCESS_KEY="prod_minio_key",
            STORAGE_SECRET_KEY="prod_minio_secret_key_12345",
        )
    assert "Insecure or too short SECRET_KEY configured for production" in str(exc_info.value)


def test_production_settings_rejects_short_secret_key() -> None:
    """Settings must fail fast in production if SECRET_KEY has fewer than 32 characters."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="short-secret-key-less-than-32",
            POSTGRES_PASSWORD="strong_prod_pg_password_12345",
            REDIS_PASSWORD="strong_prod_redis_password_12345",
            STORAGE_ACCESS_KEY="prod_minio_key",
            STORAGE_SECRET_KEY="prod_minio_secret_key_12345",
        )
    assert "Insecure or too short SECRET_KEY configured for production" in str(exc_info.value)


def test_production_settings_rejects_default_postgres_password() -> None:
    """Settings must fail fast in production if the default database password is used."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a" * 48,
            POSTGRES_PASSWORD="tef_app_password",
            REDIS_PASSWORD="strong_prod_redis_password_12345",
            STORAGE_ACCESS_KEY="prod_minio_key",
            STORAGE_SECRET_KEY="prod_minio_secret_key_12345",
        )
    assert "Default POSTGRES_PASSWORD must not be used in production" in str(exc_info.value)


def test_production_settings_rejects_default_redis_password() -> None:
    """Settings must fail fast in production if the default Redis password is used."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a" * 48,
            POSTGRES_PASSWORD="strong_prod_pg_password_12345",
            REDIS_PASSWORD="tef_redis_password",
            STORAGE_ACCESS_KEY="prod_minio_key",
            STORAGE_SECRET_KEY="prod_minio_secret_key_12345",
        )
    assert "Default REDIS_PASSWORD must not be used in production" in str(exc_info.value)


def test_production_settings_rejects_default_minio_credentials() -> None:
    """Settings must fail fast in production if default MinIO credentials are used."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a" * 48,
            POSTGRES_PASSWORD="strong_prod_pg_password_12345",
            REDIS_PASSWORD="strong_prod_redis_password_12345",
            STORAGE_ACCESS_KEY="minioadmin",
            STORAGE_SECRET_KEY="minioadmin",
        )
    assert "Default MinIO credentials must not be used in production" in str(exc_info.value)


def test_production_settings_succeeds_with_strong_credentials() -> None:
    """Settings successfully initializes in production when high-entropy credentials are provided."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="high-entropy-secure-production-secret-key-32chars",
        POSTGRES_PASSWORD="super-strong-db-password-12345!",
        REDIS_PASSWORD="super-strong-redis-password-12345!",
        STORAGE_ACCESS_KEY="prod-minio-admin-user",
        STORAGE_SECRET_KEY="super-strong-minio-secret-12345!",
    )
    assert prod_settings.is_production is True
    assert prod_settings.cookie_secure is True


def test_celery_worker_resilience_configuration() -> None:
    """Celery worker must be configured with acks_late and worker lost rejection."""
    assert celery_app.conf.task_acks_late is True
    assert celery_app.conf.task_reject_on_worker_lost is True
    assert celery_app.conf.broker_connection_retry_on_startup is True
    assert celery_app.conf.task_default_retry_delay == 30
    assert celery_app.conf.task_max_retries == 3


def test_alembic_metadata_contains_all_models() -> None:
    """Alembic target_metadata must have visibility over all 37 database tables."""
    from pathlib import Path

    env_path = Path(__file__).parent.parent / "alembic" / "env.py"
    env_content = env_path.read_text(encoding="utf-8")

    # Verify all 7 domain model modules are imported in alembic/env.py
    for module in [
        "app.modules.assessments.models",
        "app.modules.learning.models",
        "app.modules.practice_pool.models",
        "app.modules.speaking.models",
        "app.modules.teachers.models",
        "app.modules.users.models",
        "app.modules.writing.models",
    ]:
        assert f"import {module}" in env_content, f"alembic/env.py missing import of {module}"

    table_names = set(Base.metadata.tables.keys())
    assert len(table_names) == 40, f"Expected 40 tables in Base.metadata, found {len(table_names)}"

    expected_tables = {
        "users",
        "refresh_tokens",
        "student_profiles",
        "teacher_profiles",
        "skills",
        "assessments",
        "assessment_sections",
        "questions",
        "question_options",
        "question_skill_tags",
        "attempts",
        "attempt_answers",
        "attempt_scores",
        "student_skills",
        "skill_assessments",
        "mistakes",
        "exercises",
        "exercise_skills",
        "exercise_attempts",
        "recommendations",
        "writing_tasks",
        "writing_attempts",
        "writing_submissions",
        "writing_corrections",
        "teacher_availability_rules",
        "teacher_availability_exceptions",
        "teacher_bookings",
        "speaking_sessions",
        "speaking_participants",
        "speaking_evaluations",
        "speaking_evaluation_skills",
        "practice_queue_entries",
        "practice_requests",
        "practice_matches",
        "practice_sessions",
        "practice_reports",
        "practice_blocks",
        "audit_events",
        "media_assets",
        "notifications",
    }
    missing = expected_tables - table_names
    assert not missing, f"Missing tables from metadata: {missing}"
