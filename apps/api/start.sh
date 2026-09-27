#!/bin/sh
set -e

echo "=================================================="
echo " TEF Platform — Starting Application Container    "
echo "=================================================="

# Print target database host (credentials safely masked)
python -c "
import sys, urllib.parse
from app.core.config import settings

clean_db = settings.DATABASE_URL.replace('postgresql+asyncpg://', 'http://').replace('postgresql://', 'http://').replace('postgres://', 'http://')
parsed = urllib.parse.urlparse(clean_db)
print(f'[STARTUP] Environment: {settings.ENVIRONMENT}')
print(f'[STARTUP] Database Target: {parsed.hostname}:{parsed.port or 5432} (database: {parsed.path.lstrip(\"/\")})')

clean_redis = settings.REDIS_URL.replace('rediss://', 'http://').replace('redis://', 'http://')
parsed_redis = urllib.parse.urlparse(clean_redis)
print(f'[STARTUP] Redis Target: {parsed_redis.hostname}:{parsed_redis.port or 6379}')
"

echo "[STARTUP] Applying database migrations (alembic upgrade head)..."
alembic upgrade head
echo "[STARTUP] Database migrations completed successfully."

# Start Celery worker in background if REDIS_URL is provided
if [ -n "$REDIS_URL" ]; then
    echo "[STARTUP] Starting Celery background worker with embedded Beat scheduler..."
    celery -A app.core.celery_app worker -B -l INFO -c 1 &
fi

echo "[STARTUP] Starting FastAPI application on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --no-access-log
