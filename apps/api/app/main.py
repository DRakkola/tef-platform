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
from app.core.middleware import CorrelationIdMiddleware, SecurityHeadersMiddleware
from app.core.redis import check_redis_health, redis_service
from app.core.storage import check_storage_health
from app.modules.admin.router import router as admin_router
from app.modules.assessments.router import router as assessments_router
from app.modules.auth.router import router as auth_router
from app.modules.students.router import router as students_router
from app.modules.teachers.router import router as teachers_router

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


# 4. Health Check Endpoints
@app.get("/health/live", tags=["Health"], status_code=status.HTTP_200_OK)
async def health_live() -> dict[str, str]:
    """Liveness probe to confirm the server process is responsive."""
    return {"status": "live", "service": "tef-api"}


@app.get("/health/ready", tags=["Health"])
async def health_ready() -> JSONResponse:
    """Readiness probe checking database, redis, and storage dependencies."""
    db_healthy = await check_db_health()
    redis_healthy = await check_redis_health()
    storage_healthy = check_storage_health()

    dependencies = {
        "database": "healthy" if db_healthy else "unhealthy",
        "redis": "healthy" if redis_healthy else "unhealthy",
        "storage": "healthy" if storage_healthy else "unhealthy",
    }

    all_healthy = db_healthy and redis_healthy and storage_healthy
    status_code = status.HTTP_200_OK if all_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if all_healthy else "degraded",
            "dependencies": dependencies,
        },
    )


# 5. API v1 Router prefix
api_v1_router = APIRouter(prefix=settings.API_V1_PREFIX)


@api_v1_router.get("/status", tags=["Status"])
async def get_system_status() -> dict[str, Any]:
    """System metadata and baseline status."""
    return {
        "platform": "tef-platform",
        "version": "0.1.0",
        "environment": settings.ENVIRONMENT,
        "baselines": {
            "python": "3.14",
            "postgres": "18",
            "redis": "7.4",
            "storage": "minio/s3",
        },
    }


api_v1_router.include_router(auth_router)
api_v1_router.include_router(assessments_router)
api_v1_router.include_router(students_router)
api_v1_router.include_router(teachers_router)
api_v1_router.include_router(admin_router)

app.include_router(api_v1_router)
