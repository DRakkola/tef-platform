"""FastAPI application entrypoint for TEF Platform."""

from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import APIRouter, FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import check_db_health
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging
from app.core.middleware import (
    CorrelationIdMiddleware,
    CSRFProtectionMiddleware,
    PayloadSizeLimitMiddleware,
    SecurityHeadersMiddleware,
)
from app.core.redis import check_redis_health, redis_service
from app.core.storage import check_storage_health, storage_service
from app.modules.admin.beta_router import router as beta_router
from app.modules.admin.router import router as admin_router
from app.modules.analytics.router import (
    admin_analytics_router,
    admin_ops_router,
    analytics_router,
)
from app.modules.assessments.router import router as assessments_router
from app.modules.auth.router import router as auth_router
from app.modules.billing.router import (
    admin_billing_router,
    teacher_billing_router,
)
from app.modules.billing.router import (
    router as billing_router,
)
from app.modules.bookings.router import router as bookings_router
from app.modules.exercises.router import (
    exercise_attempts_router,
    router as exercises_router,
)
from app.modules.learning.readiness_router import (
    admin_readiness_router,
    student_readiness_router,
)
from app.modules.learning.router import router as learning_router
from app.modules.notifications.router import router as notifications_router
from app.modules.practice_pool.router import router as practice_pool_router
from app.modules.speaking.router import router as speaking_router
from app.modules.students.router import router as students_router
from app.modules.system.router import (
    admin_system_router,
    support_router,
    system_router,
)
from app.modules.teachers.router import router as teachers_router
from app.modules.writing.router import router as writing_router

# Initialize structured logging
setup_logging()
logger = structlog.get_logger("tef-api.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan managing startup and shutdown of shared resources."""
    logger.info(
        "tef_api_starting",
        environment=settings.ENVIRONMENT,
        version="0.1.0",
        python_baseline="3.14",
    )
    storage_service.ensure_bucket_exists()
    yield
    logger.info("tef_api_shutting_down")
    await redis_service.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Production-grade API for the TEF Platform",
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
    lifespan=lifespan,
)

# 1. Register security & correlation middlewares
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(PayloadSizeLimitMiddleware)
app.add_middleware(CSRFProtectionMiddleware)

# 2. Register CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Correlation-ID"],
)

# 3. Register centralized exception handlers
register_exception_handlers(app)


from starlette.requests import Request
from starlette.responses import Response

from app.core.metrics import metrics


# 4. Health Check Endpoints
@app.get("/health/live", tags=["Health"], status_code=status.HTTP_200_OK)
async def health_live() -> dict[str, str]:
    """Liveness probe to confirm the server process is responsive."""
    return {"status": "live", "service": "tef-api"}


@app.get("/health/ready", tags=["Health"])
async def health_ready(request: Request) -> JSONResponse:
    """Readiness probe checking database, redis, and storage dependencies."""
    db_healthy = await check_db_health()
    redis_healthy = await check_redis_health()
    storage_healthy = check_storage_health()

    all_healthy = db_healthy and redis_healthy and storage_healthy
    status_code = status.HTTP_200_OK if all_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    # In production or staging, do not leak internal dependency details to unauthenticated callers
    if settings.is_production or settings.is_staging:
        return JSONResponse(
            status_code=status_code,
            content={"status": "ready" if all_healthy else "degraded"},
        )

    dependencies = {
        "database": "healthy" if db_healthy else "unhealthy",
        "redis": "healthy" if redis_healthy else "unhealthy",
        "storage": "healthy" if storage_healthy else "unhealthy",
    }

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if all_healthy else "degraded",
            "dependencies": dependencies,
        },
    )


@app.get("/metrics", tags=["Metrics"])
async def get_metrics() -> Response:
    """Exposes Prometheus application performance and domain metrics."""
    return Response(content=metrics.render_prometheus(), media_type="text/plain; version=0.0.4")


# 5. API v1 Router prefix
api_v1_router = APIRouter(prefix=settings.API_V1_PREFIX)


@api_v1_router.get("/status", tags=["Status"])
async def get_system_status() -> dict[str, Any]:
    """System metadata and baseline status."""
    return {
        "platform": "tef-platform",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "baselines": {
            "python": "3.14",
            "postgres": "18",
            "redis": "7.4",
            "storage": "minio/s3",
        },
    }


@api_v1_router.get("/system/version", tags=["System"])
async def get_system_version() -> dict[str, Any]:
    """Exposes software release version, commit hash, and build timestamp without leaking secrets."""
    return {
        "version": settings.APP_VERSION,
        "git_commit": settings.GIT_COMMIT,
        "build_timestamp": settings.BUILD_TIMESTAMP,
        "environment": settings.ENVIRONMENT,
    }


api_v1_router.include_router(auth_router)
api_v1_router.include_router(assessments_router)
api_v1_router.include_router(learning_router)
api_v1_router.include_router(exercises_router)
api_v1_router.include_router(exercise_attempts_router)
api_v1_router.include_router(students_router)
api_v1_router.include_router(student_readiness_router)
api_v1_router.include_router(admin_readiness_router)
api_v1_router.include_router(teachers_router)
api_v1_router.include_router(bookings_router)
api_v1_router.include_router(writing_router)
api_v1_router.include_router(speaking_router)
api_v1_router.include_router(practice_pool_router)
api_v1_router.include_router(notifications_router)
api_v1_router.include_router(billing_router)
api_v1_router.include_router(teacher_billing_router)
api_v1_router.include_router(admin_billing_router)
api_v1_router.include_router(admin_router)
api_v1_router.include_router(system_router)
api_v1_router.include_router(admin_system_router)
api_v1_router.include_router(support_router)
api_v1_router.include_router(analytics_router)
api_v1_router.include_router(admin_analytics_router)
api_v1_router.include_router(admin_ops_router)
api_v1_router.include_router(beta_router)

app.include_router(api_v1_router)
