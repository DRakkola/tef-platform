"""Enums for Admin content management, lifecycle, media, reviews, and audit logging."""

import enum


class ContentStatus(str, enum.Enum):
    """Lifecycle state of an educational content entity."""

    DRAFT = "draft"
    IN_REVIEW = "in_review"
    PUBLISHED = "published"
    ARCHIVED = "archived"

    @classmethod
    def _missing_(cls, value: object):
        # Backward compatibility for legacy "review" status
        if str(value).lower() in ("review", "in_review"):
            return cls.IN_REVIEW
        return None


class ReviewStatus(str, enum.Enum):
    """Status of editorial peer-review."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


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


class ContentAuditEventType(str, enum.Enum):
    """Fine-grained domain audit events for educational content lifecycle."""

    CONTENT_CREATED = "content.created"
    CONTENT_UPDATED = "content.updated"
    CONTENT_SUBMITTED_FOR_REVIEW = "content.submitted_for_review"
    CONTENT_APPROVED = "content.approved"
    CONTENT_PUBLISHED = "content.published"
    CONTENT_ARCHIVED = "content.archived"
    MEDIA_UPLOADED = "media.uploaded"
    MEDIA_DELETED = "media.deleted"
