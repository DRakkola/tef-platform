#!/bin/sh
set -e

echo "[STARTUP] Applying database migrations..."
alembic upgrade head

# Start Celery worker in background if REDIS_URL is provided
if [ -n "$REDIS_URL" ]; then
    echo "[STARTUP] Starting Celery background worker with embedded Beat scheduler..."
    celery -A app.core.celery_app worker -B -l INFO -c 1 &
fi

echo "[STARTUP] Starting FastAPI application on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --no-access-log
