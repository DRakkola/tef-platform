#!/bin/sh
set -e

echo "=================================================="
echo " TEF Platform — Starting Application Container    "
echo "=================================================="

# Print target database host (credentials safely masked)
python -c "
import sys, urllib.parse
from app.core.config import settings

target_url = settings.DIRECT_DATABASE_URL or settings.DATABASE_URL
clean_db = target_url.replace('postgresql+asyncpg://', 'http://').replace('postgresql://', 'http://').replace('postgres://', 'http://')
parsed = urllib.parse.urlparse(clean_db)
print(f'[STARTUP] Environment: {settings.ENVIRONMENT}')
print(f'[STARTUP] Database Target: {parsed.hostname}:{parsed.port or 5432} (database: {parsed.path.lstrip(\"/\")})')

clean_redis = settings.REDIS_URL.replace('rediss://', 'http://').replace('redis://', 'http://')
parsed_redis = urllib.parse.urlparse(clean_redis)
print(f'[STARTUP] Redis Target: {parsed_redis.hostname}:{parsed_redis.port or 6379}')
"

echo "[STARTUP] Verifying database schema state..."
python -c "
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

async def widen_alembic_version():
    db_url = settings.DIRECT_DATABASE_URL or settings.DATABASE_URL
    connect_args = {}
    if 'pooler.supabase.com' in db_url or ':6543' in db_url:
        connect_args['statement_cache_size'] = 0
        connect_args['prepared_statement_cache_size'] = 0
    if 'supabase.com' in db_url or 'supabase.co' in db_url:
        connect_args['ssl'] = 'require'
    temp_engine = create_async_engine(db_url, connect_args=connect_args)
    try:
        async with temp_engine.begin() as conn:
            await conn.execute(text('ALTER TABLE IF EXISTS alembic_version ALTER COLUMN version_num TYPE VARCHAR(255);'))
        print('[STARTUP] alembic_version schema verified (VARCHAR(255)).')
    except Exception as e:
        print(f'[STARTUP] Pre-migration schema check: {e}')
    finally:
        await temp_engine.dispose()

asyncio.run(widen_alembic_version())
"

echo "[STARTUP] Applying database migrations (alembic upgrade head)..."
alembic upgrade head
echo "[STARTUP] Database migrations completed successfully."

# Seed database if not explicitly disabled via AUTO_SEED=false
if [ "$AUTO_SEED" != "false" ]; then
    echo "[STARTUP] Verifying initial platform seed data..."
    python -m app.cli.seed || echo "[STARTUP] Warning: Seeding step completed with warnings, continuing startup."
fi

# Start Celery worker in background if REDIS_URL is provided
if [ -n "$REDIS_URL" ]; then
    echo "[STARTUP] Starting Celery background worker with embedded Beat scheduler..."
    celery -A app.core.celery_app worker -B -l INFO -c 1 &
fi

echo "[STARTUP] Starting FastAPI application on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --no-access-log
