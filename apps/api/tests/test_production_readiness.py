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
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY="a" * 48,
            POSTGRES_PASSWORD="tef_app_password",
            DATABASE_URL="postgresql+asyncpg://tef_app:tef_app_password@localhost:5432/tef_platform",
            REDIS_PASSWORD="strong_prod_redis_password_12345",
            STORAGE_ACCESS_KEY="prod_minio_key",
            STORAGE_SECRET_KEY="prod_minio_secret_key_12345",
        )
    assert "Default POSTGRES_PASSWORD must not be used in production" in str(exc_info.value)


def test_production_settings_rejects_default_redis_password() -> None:
    """Settings must fail fast in production if the default Redis password is used."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY="a" * 48,
            POSTGRES_HOST="db.prod.example.com",
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
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY="a" * 48,
            POSTGRES_HOST="db.prod.example.com",
            POSTGRES_PASSWORD="strong_prod_pg_password_12345",
            REDIS_HOST="redis.prod.example.com",
            REDIS_PASSWORD="strong_prod_redis_password_12345",
            STORAGE_ENDPOINT="localhost:9000",
            STORAGE_ACCESS_KEY="minioadmin",
            STORAGE_SECRET_KEY="minioadmin",
            CORS_ORIGINS=["https://app.example.com"],
        )
    assert "Default MinIO credentials must not be used in production" in str(exc_info.value)


def test_production_settings_succeeds_with_strong_credentials() -> None:
    """Settings successfully initializes in production when high-entropy credentials are provided."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="high-entropy-secure-production-secret-key-32chars",
        POSTGRES_HOST="db.prod.example.com",
        POSTGRES_PASSWORD="super-strong-db-password-12345!",
        REDIS_HOST="redis.prod.example.com",
        REDIS_PASSWORD="super-strong-redis-password-12345!",
        STORAGE_ACCESS_KEY="prod-minio-admin-user",
        STORAGE_SECRET_KEY="super-strong-minio-secret-12345!",
        CORS_ORIGINS=["https://tef-prep.example.com"],
    )
    assert prod_settings.is_production is True
    assert prod_settings.cookie_secure is True


def test_production_settings_succeeds_with_cloud_connection_urls() -> None:
    """Settings must succeed in production when Supabase/Upstash connection URLs are provided directly."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="high-entropy-secure-production-secret-key-32chars",
        DATABASE_URL="postgresql://postgres:supabase_secure_pass_999@db.supabase.co:5432/postgres",
        REDIS_URL="rediss://default:upstash_token_123456789@upstash.io:6379",
        STORAGE_ENDPOINT="xyz.supabase.co/storage/v1/s3",
        STORAGE_ACCESS_KEY="supabase-s3-access-key",
        STORAGE_SECRET_KEY="supabase-s3-secret-key",
        CORS_ORIGINS=["https://tef-prep.example.com"],
    )
    assert prod_settings.is_production is True
    assert prod_settings.DATABASE_URL.startswith("postgresql+asyncpg://")
    assert prod_settings.CELERY_BROKER_URL == "rediss://default:upstash_token_123456789@upstash.io:6379"


def test_production_settings_rejects_localhost_cors() -> None:
    """Settings must fail fast in production if localhost or wildcard CORS origins are configured."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="high-entropy-secure-production-secret-key-32chars",
            POSTGRES_HOST="db.prod.example.com",
            POSTGRES_PASSWORD="super-strong-db-password-12345!",
            REDIS_HOST="redis.prod.example.com",
            REDIS_PASSWORD="super-strong-redis-password-12345!",
            STORAGE_ACCESS_KEY="prod-minio-admin-user",
            STORAGE_SECRET_KEY="super-strong-minio-secret-12345!",
            CORS_ORIGINS=["http://localhost:5173"],
        )
    assert "Insecure CORS origin" in str(exc_info.value)



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

    # Verify all 9 domain model modules are imported in alembic/env.py
    for module in [
        "app.modules.admin.models",
        "app.modules.analytics.models",
        "app.modules.assessments.models",
        "app.modules.billing.models",
        "app.modules.learning.models",
        "app.modules.practice_pool.models",
        "app.modules.speaking.models",
        "app.modules.teachers.models",
        "app.modules.users.models",
        "app.modules.writing.models",
    ]:
        assert f"import {module}" in env_content, f"alembic/env.py missing import of {module}"

    table_names = set(Base.metadata.tables.keys())
    assert len(table_names) == 90, f"Expected 90 tables in Base.metadata, found {len(table_names)}"

    expected_tables = {
        "users",
        "student_profiles",
        "teacher_profiles",
        "skills",
        "sub_skills",
        "assessments",
        "assessment_sections",
        "assessment_versions",
        "questions",
        "question_options",
        "question_versions",
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
        "exercise_versions",
        "recommendations",
        "student_activity_events",
        "writing_tasks",
        "writing_attempts",
        "writing_submissions",
        "writing_corrections",
        "writing_task_versions",
        "writing_draft_revisions",
        "writing_correction_items",
        "writing_correction_skills",
        "writing_assignments",
        "teacher_availability_rules",
        "teacher_availability_exceptions",
        "teacher_availability_overrides",
        "teacher_bookings",
        "speaking_sessions",
        "speaking_participants",
        "speaking_evaluations",
        "speaking_evaluation_skills",
        "practice_queue_entries",
        "practice_requests",
        "practice_matches",
        "practice_sessions",
        "practice_participants",
        "practice_topics",
        "practice_reports",
        "practice_blocks",
        "audit_events",
        "media_assets",
        "content_reviews",
        "notifications",
        "products",
        "product_prices",
        "product_entitlements",
        "subscriptions",
        "orders",
        "order_items",
        "credit_accounts",
        "credit_grants",
        "credit_consumptions",
        "billing_ledger_entries",
        "payment_webhook_events",
        "booking_reservations",
        "teacher_earnings",
        "ai_usage_records",
        "coupons",
        "user_entitlement_grants",
        "readiness_profiles",
        "skill_evidences",
        "readiness_snapshots",
        "exercise_effectiveness",
        "spaced_review_items",
        "analytics_events",
        "user_feedback",
        "support_tickets",
        "experiments",
        "experiment_variants",
        "experiment_assignments",
        "beta_cohorts",
        "beta_invitations",
        "beta_rate_limits",
        "ai_prompt_templates",
        "ai_sandbox_runs",
        "speaking_examiner_configs",
        "speaking_exams",
        "speaking_sections",
        "speaking_turns",
        "speaking_scenarios",
    }
    missing = expected_tables - table_names
    assert not missing, f"Missing tables from metadata: {missing}"


def test_supabase_database_urls_and_direct_url_normalization() -> None:
    """Verifies that Supabase pooler and direct URLs normalize to postgresql+asyncpg://."""
    s = Settings(
        DATABASE_URL="postgres://postgres.myproject:secret123@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
        DIRECT_DATABASE_URL="postgresql://postgres.myproject:secret123@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
    )
    assert s.DATABASE_URL.startswith("postgresql+asyncpg://")
    assert ":6543/postgres" in s.DATABASE_URL
    assert s.DIRECT_DATABASE_URL is not None
    assert s.DIRECT_DATABASE_URL.startswith("postgresql+asyncpg://")
    assert ":5432/postgres" in s.DIRECT_DATABASE_URL


def test_supabase_storage_alias_configuration() -> None:
    """Verifies that Supabase S3 storage settings can be set via aliases."""
    s = Settings(
        STORAGE_ENDPOINT="myref.supabase.co/storage/v1/s3",
        STORAGE_ACCESS_KEY="sb_s3_key_id",
        STORAGE_SECRET_KEY="sb_s3_secret_key",
        STORAGE_BUCKET_NAME="tef-private",
        STORAGE_USE_SSL=True,
    )
    assert s.STORAGE_ENDPOINT == "myref.supabase.co/storage/v1/s3"
    assert s.STORAGE_ACCESS_KEY == "sb_s3_key_id"
    assert s.STORAGE_SECRET_KEY == "sb_s3_secret_key"
    assert s.STORAGE_USE_SSL is True

