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


class SkillDimension(str, enum.Enum):
    """Taxonomy V2 orthogonal competency dimensions."""

    REASONING = "reasoning"
    LANGUAGE = "language"

    @classmethod
    def _missing_(cls, value: object):
        if isinstance(value, str):
            val_lower = value.lower()
            for member in cls:
                if member.value == val_lower or member.name.lower() == val_lower:
                    return member
        return None


class SkillTagRole(str, enum.Enum):
    """Pedagogical role of a skill attached to an assessment question or exercise."""

    PRIMARY = "primary"
    SECONDARY = "secondary"

    @classmethod
    def _missing_(cls, value: object):
        if isinstance(value, str):
            val_lower = value.lower()
            for member in cls:
                if member.value == val_lower or member.name.lower() == val_lower:
                    return member
        return None


class SkillRelationType(str, enum.Enum):
    """Pedagogical dependency relationship between two skills in the graph."""

    PREREQUISITE = "prerequisite"
    DEPENDS_ON = "depends_on"
    SUPPORTS = "supports"
    RELATED = "related"

    @classmethod
    def _missing_(cls, value: object):
        if isinstance(value, str):
            val_lower = value.lower()
            for member in cls:
                if member.value == val_lower or member.name.lower() == val_lower:
                    return member
        return None


class TaxonomyLifecycleStatus(str, enum.Enum):
    """Lifecycle state of a taxonomy version snapshot or competency."""

    DRAFT = "draft"
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    ARCHIVED = "archived"

    @classmethod
    def _missing_(cls, value: object):
        if isinstance(value, str):
            val_lower = value.lower()
            for member in cls:
                if member.value == val_lower or member.name.lower() == val_lower:
                    return member
        return None


class CEFRBand(str, enum.Enum):
    """Standard Common European Framework of Reference for Languages bands."""

    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"

    @classmethod
    def _missing_(cls, value: object):
        if isinstance(value, str):
            val_upper = value.upper()
            for member in cls:
                if member.value == val_upper or member.name == val_upper:
                    return member
        return None

