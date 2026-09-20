"""Error tracking and diagnostic capture abstraction."""

from typing import Any
import structlog

from app.core.config import settings

logger = structlog.get_logger("tef-api.errors")


class ErrorTracker:
    """Abstraction for centralized error tracking (Sentry / OpenTelemetry / Datadog)."""

    def __init__(self) -> None:
        self.enabled = settings.is_production or settings.is_staging
        self.environment = settings.ENVIRONMENT
        self.version = settings.APP_VERSION
        self.commit = settings.GIT_COMMIT

    def capture_exception(
        self,
        exc: BaseException,
        request_id: str | None = None,
        correlation_id: str | None = None,
        user_id: str | None = None,
        extra_context: dict[str, Any] | None = None,
    ) -> str:
        """Captures an exception with context metadata, stripping sensitive personal content."""
        event_id = f"err_{id(exc)}_{int(structlog.processors.TimeStamper()._format_time() if hasattr(structlog.processors.TimeStamper(), '_format_time') else 0)}"
        
        # Sanitize extra context to prevent leaking private student essays or passwords
        clean_context: dict[str, Any] = {}
        if extra_context:
            for k, v in extra_context.items():
                if any(bad in k.lower() for bad in ("password", "token", "secret", "card", "transcript", "essay")):
                    clean_context[k] = "[REDACTED]"
                else:
                    clean_context[k] = str(v)[:256]

        logger.error(
            "unhandled_exception_captured",
            exception_type=type(exc).__name__,
            error_message=str(exc),
            request_id=request_id,
            correlation_id=correlation_id,
            user_id=user_id,
            environment=self.environment,
            release_version=self.version,
            context=clean_context,
            exc_info=exc,
        )

        return event_id

    def capture_message(
        self,
        message: str,
        level: str = "warning",
        extra_context: dict[str, Any] | None = None,
    ) -> None:
        """Log a diagnostic warning message with tracking tags."""
        logger.warning(
            "diagnostic_message_captured",
            message=message,
            level=level,
            environment=self.environment,
            release_version=self.version,
            context=extra_context or {},
        )


# Global error tracker singleton
error_tracker = ErrorTracker()
