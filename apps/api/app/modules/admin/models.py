"""SQLAlchemy models for Admin Content Management, Media Assets, Versioning, and Audit Logging."""

import datetime
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import TimeStampedUUIDModel, UUIDModel
from app.modules.admin.enums import (
    CEFRBand,
    MediaType,
    SkillRelationType,
    TaxonomyLifecycleStatus,
)

if TYPE_CHECKING:
    from app.modules.assessments.models import Assessment, Question, Skill
    from app.modules.learning.models import Exercise
    from app.modules.users.models import User
    from app.modules.writing.models import WritingTask


class TaxonomyVersion(TimeStampedUUIDModel):
    """Immutable or managed release snapshot of the platform competency catalog."""

    __tablename__ = "taxonomy_versions"

    version: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    status: Mapped[TaxonomyLifecycleStatus] = mapped_column(
        SQLEnum(TaxonomyLifecycleStatus, name="taxonomy_lifecycle_status", native_enum=False),
        default=TaxonomyLifecycleStatus.DRAFT,
        nullable=False,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    activated_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    archived_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    skills: Mapped[list["Skill"]] = relationship(
        "Skill",
        back_populates="taxonomy_version",
    )


class SkillRelation(UUIDModel):
    """Directed dependency or equivalence edge between competencies in the learning graph."""

    __tablename__ = "skill_relations"
    __table_args__ = (
        UniqueConstraint("from_skill_id", "to_skill_id", "relation_type", name="uq_skill_relation"),
    )

    from_skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    to_skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relation_type: Mapped[SkillRelationType] = mapped_column(
        SQLEnum(SkillRelationType, name="skill_relation_type", native_enum=False),
        default=SkillRelationType.PREREQUISITE,
        nullable=False,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    from_skill: Mapped["Skill"] = relationship(
        "Skill",
        foreign_keys=[from_skill_id],
        back_populates="outgoing_relations",
    )
    to_skill: Mapped["Skill"] = relationship(
        "Skill",
        foreign_keys=[to_skill_id],
        back_populates="incoming_relations",
    )


class SkillLevelDescriptor(TimeStampedUUIDModel):
    """Pedagogical can-do benchmark statement contextualizing a skill at a specific CEFR band."""

    __tablename__ = "skill_level_descriptors"
    __table_args__ = (
        UniqueConstraint("skill_id", "level", name="uq_skill_cefr_level"),
    )

    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    level: Mapped[CEFRBand] = mapped_column(
        SQLEnum(CEFRBand, name="cefr_band", native_enum=False),
        nullable=False,
        index=True,
    )
    descriptor: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    evidence_guidance: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    skill: Mapped["Skill"] = relationship(
        "Skill",
        back_populates="level_descriptors",
    )


class SubSkill(TimeStampedUUIDModel):
    """Specific subskill unit categorized under a parent skill."""

    __tablename__ = "sub_skills"

    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    skill: Mapped["Skill"] = relationship("Skill", back_populates="subskills_table")


class AuditEvent(UUIDModel):
    """Immutable audit record of administrative and security-sensitive operations."""

    __tablename__ = "audit_events"

    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    entity_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
    )
    user_agent: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
        index=True,
    )

    actor: Mapped[User] = relationship("User", foreign_keys=[actor_user_id])


class MediaAsset(TimeStampedUUIDModel):
    """Private object storage asset metadata (listening audio, exam passages, diagrams)."""

    __tablename__ = "media_assets"

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    file_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    storage_object_key: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
    )
    bucket: Mapped[str] = mapped_column(
        String(100),
        default="tef-private",
        nullable=False,
    )
    checksum: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )
    duration_seconds: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    media_type: Mapped[MediaType] = mapped_column(
        SQLEnum(MediaType, name="media_type", native_enum=False),
        default=MediaType.AUDIO,
        nullable=False,
        index=True,
    )
    is_public: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    uploaded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    uploader: Mapped[User] = relationship("User", foreign_keys=[uploaded_by_user_id])


class AssessmentVersion(UUIDModel):
    """Immutable historical snapshot of a published assessment."""

    __tablename__ = "assessment_versions"
    __table_args__ = (UniqueConstraint("assessment_id", "version", name="uq_assessment_version"),)

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assessments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    assessment_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    duration_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    navigation_policy: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    scoring_policy: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    pass_percentage: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    sections_snapshot: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        default=list,
        nullable=False,
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    assessment: Mapped[Assessment] = relationship("Assessment", back_populates="versions")
    author: Mapped[User] = relationship("User", foreign_keys=[created_by_user_id])


class QuestionVersion(UUIDModel):
    """Immutable historical snapshot of a question."""

    __tablename__ = "question_versions"
    __table_args__ = (UniqueConstraint("question_id", "version", name="uq_question_version"),)

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    prompt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    explanation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    question_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    difficulty: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    level: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )
    points: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    options_snapshot: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        default=list,
        nullable=False,
    )
    media_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("media_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    question: Mapped[Question] = relationship("Question", back_populates="versions")
    author: Mapped[User] = relationship("User", foreign_keys=[created_by_user_id])


class ExerciseVersion(UUIDModel):
    """Immutable historical snapshot of an exercise."""

    __tablename__ = "exercise_versions"
    __table_args__ = (UniqueConstraint("exercise_id", "version", name="uq_exercise_version"),)

    exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("exercises.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    instructions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    level: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )
    difficulty: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    prompt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    explanation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    points: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    options_payload: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        default=list,
        nullable=False,
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    exercise: Mapped[Exercise] = relationship("Exercise", back_populates="versions")
    author: Mapped[User] = relationship("User", foreign_keys=[created_by_user_id])


class WritingTaskVersion(UUIDModel):
    """Immutable historical snapshot of a writing task."""

    __tablename__ = "writing_task_versions"
    __table_args__ = (UniqueConstraint("writing_task_id", "version", name="uq_writing_task_version"),)

    writing_task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("writing_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    instructions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    prompt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    task_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    level: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )
    min_words: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    max_words: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    evaluation_criteria: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        default=list,
        nullable=False,
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    writing_task: Mapped[WritingTask] = relationship("WritingTask", back_populates="versions")
    author: Mapped[User] = relationship("User", foreign_keys=[created_by_user_id])


class ContentReview(TimeStampedUUIDModel):
    """Peer-review and editorial gate for educational content before publication."""

    __tablename__ = "content_reviews"

    entity_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
        nullable=False,
        index=True,
    )
    comments: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    reviewer: Mapped[User] = relationship("User", foreign_keys=[reviewer_id])


# Ensure Beta Models, AI Sandbox Models, and Speaking Examiner Config Models are registered in Admin domain
from app.modules.admin.ai_sandbox_models import AIPromptTemplate, AISandboxRun  # noqa: F401
from app.modules.admin.beta_models import (  # noqa: F401
    BetaCohort,
    BetaInvitation,
    BetaRateLimit,
)
from app.modules.admin.speaking_config_models import SpeakingExaminerConfig  # noqa: F401
from app.modules.admin.speaking_scenario_models import SpeakingScenario  # noqa: F401

