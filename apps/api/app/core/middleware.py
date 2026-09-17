"""FastAPI Middlewares: Request/Correlation ID, Logging, and Security Headers."""

import time
import uuid
from typing import ClassVar

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = structlog.get_logger("tef-api.middleware")


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Assigns or propagates X-Request-ID and X-Correlation-ID."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        correlation_id = request.headers.get("X-Correlation-ID") or request_id

        # Bind to structlog contextvars for the entire request lifecycle
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            correlation_id=correlation_id,
            path=request.url.path,
            method=request.method,
        )

        request.state.request_id = request_id
        request.state.correlation_id = correlation_id

        start_time = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error("request_failed", latency_ms=latency_ms)
            raise

        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Correlation-ID"] = correlation_id

        # Log completion
        if not request.url.path.startswith("/health/live"):
            logger.info(
                "request_completed",
                status_code=response.status_code,
                latency_ms=latency_ms,
            )

        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enforces baseline and hardened security headers on every response."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(self), geolocation=()"
        response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"

        # Enforce HSTS for HTTPS or production environments
        if request.url.scheme == "https" or request.headers.get("X-Forwarded-Proto") == "https":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )

        return response


class PayloadSizeLimitMiddleware(BaseHTTPMiddleware):
    """Enforces maximum request body size to prevent memory exhaustion and DoS."""

    DEFAULT_MAX_SIZE = 5 * 1024 * 1024  # 5 MB
    MULTIPART_MAX_SIZE = 15 * 1024 * 1024  # 15 MB

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        content_length = request.headers.get("content-length")
        content_type = request.headers.get("content-type", "")

        max_allowed = (
            self.MULTIPART_MAX_SIZE
            if "multipart/form-data" in content_type
            else self.DEFAULT_MAX_SIZE
        )

        if content_length:
            try:
                if int(content_length) > max_allowed:
                    logger.warning(
                        "payload_size_limit_exceeded",
                        size=int(content_length),
                        max_allowed=max_allowed,
                    )
                    from fastapi.responses import JSONResponse

                    return JSONResponse(
                        status_code=413,
                        content={
                            "error": {
                                "code": "PAYLOAD_TOO_LARGE",
                                "message": f"Request body exceeds maximum allowed size of {max_allowed // (1024 * 1024)}MB",
                            }
                        },
                    )
            except ValueError:
                pass

        return await call_next(request)


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """Enforces double-submit CSRF token validation on all mutating requests using cookie authentication."""

    SAFE_METHODS: ClassVar[set[str]] = {"GET", "HEAD", "OPTIONS", "TRACE"}
    EXCLUDED_PATHS: ClassVar[set[str]] = {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/api/v1/status",
        "/health/live",
        "/health/ready",
        "/docs",
        "/redoc",
        "/openapi.json",
    }

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        import hmac

        # Safe methods don't mutate state
        if request.method in self.SAFE_METHODS:
            return await call_next(request)

        # Excluded authentication/public endpoints where session is being initiated
        if any(request.url.path.startswith(prefix) for prefix in self.EXCLUDED_PATHS):
            return await call_next(request)

        # If request uses Bearer token authorization header, it is immune to standard browser CSRF
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return await call_next(request)

        # If request relies on cookie authentication (access_token or refresh_token in cookies)
        if "access_token" in request.cookies or "refresh_token" in request.cookies:
            cookie_csrf = request.cookies.get("csrf_token")
            header_csrf = request.headers.get("X-CSRF-Token")

            if not cookie_csrf or not header_csrf:
                logger.warning("csrf_token_missing", path=request.url.path)
                from fastapi.responses import JSONResponse

                return JSONResponse(
                    status_code=403,
                    content={
                        "error": {
                            "code": "CSRF_TOKEN_MISSING",
                            "message": "Missing CSRF token for cookie-authenticated mutation request",
                        }
                    },
                )

            if not hmac.compare_digest(cookie_csrf, header_csrf):
                logger.warning("csrf_token_mismatch", path=request.url.path)
                from fastapi.responses import JSONResponse

                return JSONResponse(
                    status_code=403,
                    content={
                        "error": {
                            "code": "CSRF_VALIDATION_FAILED",
                            "message": "CSRF token validation failed",
                        }
                    },
                )

        return await call_next(request)
