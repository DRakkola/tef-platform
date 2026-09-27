# syntax=docker/dockerfile:1
# ------------------------------------------------------------------------------
# Root Dockerfile for Monorepo Cloud Deployments (Koyeb, Railway, Render)
# Build Context: Repository Root (.)
# ------------------------------------------------------------------------------

# Stage 1: Build & dependency installation
FROM python:3.14-slim AS builder

WORKDIR /app

# Install uv for fast, deterministic dependency resolution
COPY --from=ghcr.io/astral-sh/uv:0.8.11 /uv /uvx /bin/

# Copy dependency specifications from apps/api
COPY apps/api/pyproject.toml apps/api/uv.lock ./

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

# Copy application source code from apps/api
COPY --chown=appuser:appgroup apps/api/app /app/app
COPY --chown=appuser:appgroup apps/api/alembic /app/alembic
COPY --chown=appuser:appgroup apps/api/alembic.ini apps/api/main.py apps/api/start.sh /app/

RUN chmod +x /app/start.sh

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

# Run with startup script (migrations + background worker + web server)
CMD ["/app/start.sh"]
