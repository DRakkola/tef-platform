"""Enums for Admin content management, lifecycle, media, and audit logging."""

import enum


class ContentStatus(str, enum.Enum):
    """Lifecycle state of an assessment, task, or exercise."""

    DRAFT = "draft"
    REVIEW = "review"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class MediaType(str, enum.Enum):
    """Classification of media assets in MinIO."""

    AUDIO = "audio"
    IMAGE = "image"
    DOCUMENT = "document"


class AuditAction(str, enum.Enum):
    """Types of administrative audit actions."""

    CREATE = "CREATE"
    UPDATE = "UPDATE"
    PUBLISH = "PUBLISH"
    ARCHIVE = "ARCHIVE"
    DELETE = "DELETE"
    ROLE_CHANGE = "ROLE_CHANGE"
    SECURITY_CHANGE = "SECURITY_CHANGE"
