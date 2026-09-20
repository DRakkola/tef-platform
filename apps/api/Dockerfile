# syntax=docker/dockerfile:1
# ------------------------------------------------------------------------------
# Stage 1: Build & dependency installation
# ------------------------------------------------------------------------------
FROM python:3.14-slim AS builder

WORKDIR /app

# Install uv for fast, deterministic dependency resolution
COPY --from=ghcr.io/astral-sh/uv:0.8.11 /uv /uvx /bin/

# Copy dependency specifications
COPY pyproject.toml uv.lock ./

# Install dependencies into a standalone virtualenv
RUN uv sync --frozen --no-dev --no-install-project

# ------------------------------------------------------------------------------
# Stage 2: Minimal runtime image
# ------------------------------------------------------------------------------
FROM python:3.14-slim AS runtime

WORKDIR /app

# Security: Create non-root system user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /sbin/nologin -M appuser

# Copy virtualenv from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application source code
COPY --chown=appuser:appgroup app /app/app
COPY --chown=appuser:appgroup alembic /app/alembic
COPY --chown=appuser:appgroup alembic.ini main.py /app/

# Set environment paths
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production

# Switch to non-root user
USER appuser

EXPOSE 8000

# Signal handling: allow uvicorn graceful shutdown on container termination
STOPSIGNAL SIGTERM

# Minimalist healthcheck without external curl/wget dependencies
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/live').read()"]

# Run with production uvicorn configuration
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]

