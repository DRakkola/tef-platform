"""SQLAlchemy models for the generic assessment domain."""

import datetime
import uuid
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.modules.admin.models import (
        AssessmentVersion,
        QuestionVersion,
        SkillAlias,
        SkillLevelDescriptor,
        SkillModality,
        SkillRelation,
        SubSkill,
        TaskTypeSkill,
        TaxonomyVersion,
    )

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import SQLEnumValues, TimeStampedUUIDModel, UUIDModel
from app.modules.admin.enums import SkillDimension, SkillTagRole
from app.modules.assessments.enums import (
    AssessmentType,
    AttemptStatus,
    NavigationPolicy,
    QuestionType,
    ScoringPolicy,
)
from app.modules.learning.enums import SkillCategory
from app.modules.users.models import User


class TaskType(TimeStampedUUIDModel):
    """Assessment task format and stimulus decoupled from competencies."""

    __tablename__ = "task_types"

    modality: Mapped[str] = mapped_column(
        String(30),
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
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    supported_skills: Mapped[list[TaskTypeSkill]] = relationship(
        "TaskTypeSkill",
        back_populates="task_type",
        cascade="all, delete-orphan",
    )


class Skill(TimeStampedUUIDModel):
    """Authoritative competency or subskill unit in the platform."""

    __tablename__ = "skills"
    __table_args__ = (
        UniqueConstraint("taxonomy_version_id", "code", name="uq_skills_taxonomy_version_code"),
    )

    taxonomy_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("taxonomy_versions.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    code: Mapped[str] = mapped_column(
        String(100),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    dimension: Mapped[SkillDimension] = mapped_column(
        SQLEnumValues(SkillDimension, name="skill_dimension", native_enum=False),
        default=SkillDimension.LANGUAGE,
        nullable=True,
        index=True,
    )
    domain: Mapped[str] = mapped_column(
        String(50),
        default="general",
        nullable=True,
        index=True,
    )
    category: Mapped[SkillCategory | None] = mapped_column(
        SQLEnum(SkillCategory, name="skill_category", native_enum=False),
        nullable=True,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    taxonomy_version: Mapped[TaxonomyVersion] = relationship(
        "TaxonomyVersion",
        back_populates="skills",
    )
    parent: Mapped[Skill | None] = relationship(
        "Skill",
        remote_side="Skill.id",
        back_populates="subskills",
    )
    subskills: Mapped[list[Skill]] = relationship(
        "Skill",
        back_populates="parent",
    )

    @property
    def children(self) -> list[Skill]:
        return self.subskills
    outgoing_relations: Mapped[list[SkillRelation]] = relationship(
        "SkillRelation",
        foreign_keys="SkillRelation.from_skill_id",
        back_populates="from_skill",
        cascade="all, delete-orphan",
    )
    incoming_relations: Mapped[list[SkillRelation]] = relationship(
        "SkillRelation",
        foreign_keys="SkillRelation.to_skill_id",
        back_populates="to_skill",
        cascade="all, delete-orphan",
    )
    level_descriptors: Mapped[list[SkillLevelDescriptor]] = relationship(
        "SkillLevelDescriptor",
        back_populates="skill",
        cascade="all, delete-orphan",
    )
    question_tags: Mapped[list[QuestionSkillTag]] = relationship(
        "QuestionSkillTag",
        foreign_keys="QuestionSkillTag.skill_id",
        back_populates="skill",
    )
    subskills_table: Mapped[list[SubSkill]] = relationship(
        "SubSkill",
        back_populates="skill",
        cascade="all, delete-orphan",
    )
    modalities: Mapped[list[SkillModality]] = relationship(
        "SkillModality",
        back_populates="skill",
        cascade="all, delete-orphan",
    )
    supported_task_types: Mapped[list[TaskTypeSkill]] = relationship(
        "TaskTypeSkill",
        back_populates="skill",
        cascade="all, delete-orphan",
    )
    aliases: Mapped[list[SkillAlias]] = relationship(
        "SkillAlias",
        back_populates="skill",
        cascade="all, delete-orphan",
    )


class Assessment(TimeStampedUUIDModel):
    """Reusable assessment definition for Reading, Listening, or Mixed mock exams."""

    __tablename__ = "assessments"

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    assessment_type: Mapped[AssessmentType] = mapped_column(
        SQLEnum(AssessmentType, name="assessment_type", native_enum=False),
        nullable=False,
        index=True,
    )
    duration_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    navigation_policy: Mapped[NavigationPolicy] = mapped_column(
        SQLEnum(NavigationPolicy, name="navigation_policy", native_enum=False),
        default=NavigationPolicy.FREE,
        nullable=False,
    )
    scoring_policy: Mapped[ScoringPolicy] = mapped_column(
        SQLEnum(ScoringPolicy, name="scoring_policy", native_enum=False),
        default=ScoringPolicy.STANDARD_POINTS,
        nullable=False,
    )
    max_attempts: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    pass_percentage: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="published",
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    sections: Mapped[list[AssessmentSection]] = relationship(
        "AssessmentSection",
        back_populates="assessment",
        cascade="all, delete-orphan",
        order_by="AssessmentSection.order_index",
    )
    attempts: Mapped[list[Attempt]] = relationship(
        "Attempt",
        back_populates="assessment",
        cascade="all, delete-orphan",
    )
    versions: Mapped[list[AssessmentVersion]] = relationship(
        "AssessmentVersion",
        back_populates="assessment",
        cascade="all, delete-orphan",
    )


class AssessmentSection(TimeStampedUUIDModel):
    """Section of an assessment grouping questions (e.g. reading passage, audio snippet)."""

    __tablename__ = "assessment_sections"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assessments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    instructions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    order_index: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    duration_seconds: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    media_url: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )
    passage_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    assessment: Mapped[Assessment] = relationship(
        "Assessment",
        back_populates="sections",
    )
    questions: Mapped[list[Question]] = relationship(
        "Question",
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="Question.order_index",
    )
    question_associations: Mapped[list[AssessmentSectionQuestion]] = relationship(
        "AssessmentSectionQuestion",
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="AssessmentSectionQuestion.order_index",
    )


class Stimulus(TimeStampedUUIDModel):
    """Reusable reading passage, listening audio, or graphic stimulus decoupled from questions."""

    __tablename__ = "stimuli"

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    modality: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
    )
    content_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    text_format: Mapped[str] = mapped_column(
        String(20),
        default="plain",
        nullable=False,
    )
    word_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    register: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    media_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("media_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    media_url: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )
    source_citation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    content_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
    )

    questions: Mapped[list[Question]] = relationship(
        "Question",
        back_populates="stimulus",
    )


class Question(TimeStampedUUIDModel):
    """Assessment question with metadata, points, difficulty, and options."""

    __tablename__ = "questions"

    section_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assessment_sections.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    stimulus_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stimuli.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    prompt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    question_type: Mapped[QuestionType] = mapped_column(
        SQLEnum(QuestionType, name="question_type", native_enum=False),
        default=QuestionType.SINGLE_CHOICE,
        nullable=False,
    )
    response_type: Mapped[str] = mapped_column(
        String(50),
        default="single_choice",
        nullable=False,
        index=True,
    )
    order_index: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    level: Mapped[str] = mapped_column(
        String(10),
        default="B1",
        nullable=False,
    )
    target_cefr: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        index=True,
    )
    difficulty: Mapped[int] = mapped_column(
        Integer,
        default=3,
        nullable=False,
    )
    difficulty_rating: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    cognitive_complexity: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    instructions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    explanation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    points: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    penalty_points: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    media_url: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="published",
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    is_live_delivered: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    item_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )
    scoring_payload: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    task_type_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_types.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    section: Mapped[AssessmentSection | None] = relationship(
        "AssessmentSection",
        back_populates="questions",
    )
    stimulus: Mapped[Stimulus | None] = relationship(
        "Stimulus",
        back_populates="questions",
    )
    section_associations: Mapped[list[AssessmentSectionQuestion]] = relationship(
        "AssessmentSectionQuestion",
        back_populates="question",
        cascade="all, delete-orphan",
    )
    options: Mapped[list[QuestionOption]] = relationship(
        "QuestionOption",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="QuestionOption.order_index",
    )
    skill_tags: Mapped[list[QuestionSkillTag]] = relationship(
        "QuestionSkillTag",
        back_populates="question",
        cascade="all, delete-orphan",
    )
    versions: Mapped[list[QuestionVersion]] = relationship(
        "QuestionVersion",
        back_populates="question",
        cascade="all, delete-orphan",
    )
    validations: Mapped[list[QuestionValidation]] = relationship(
        "QuestionValidation",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="QuestionValidation.checked_at.desc()",
    )
    provenance: Mapped[QuestionProvenance | None] = relationship(
        "QuestionProvenance",
        back_populates="question",
        uselist=False,
        cascade="all, delete-orphan",
    )


class QuestionOption(TimeStampedUUIDModel):
    """Possible answer choice for a question."""

    __tablename__ = "question_options"

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    order_index: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    is_correct: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    explanation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    misconception_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    distractor_rationale: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    question: Mapped[Question] = relationship(
        "Question",
        back_populates="options",
    )


class AssessmentSectionQuestion(UUIDModel):
    """Association linking questions to assessment sections, allowing item reuse."""

    __tablename__ = "assessment_section_questions"
    __table_args__ = (
        UniqueConstraint("assessment_section_id", "question_id", name="uq_section_question"),
        Index("ix_asq_section_order", "assessment_section_id", "order_index"),
    )

    assessment_section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assessment_sections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_index: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    points_override: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    question_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("question_versions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    section: Mapped[AssessmentSection] = relationship(
        "AssessmentSection",
        back_populates="question_associations",
    )
    question: Mapped[Question] = relationship(
        "Question",
        back_populates="section_associations",
    )
    question_version: Mapped[QuestionVersion | None] = relationship(
        "QuestionVersion",
        foreign_keys=[question_version_id],
    )


class QuestionValidation(UUIDModel):
    """Automated linting and quality audit log for a question."""

    __tablename__ = "question_validations"

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    validation_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )
    blocking_error_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    warning_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    issues_payload: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    checked_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )
    validated_by_system_version: Mapped[str] = mapped_column(
        String(50),
        default="v2.0.0",
        nullable=False,
    )

    question: Mapped[Question] = relationship(
        "Question",
        back_populates="validations",
    )


class QuestionProvenance(UUIDModel):
    """Author, AI model generator, and review metadata for content provenance."""

    __tablename__ = "question_provenance"
    __table_args__ = (UniqueConstraint("question_id", name="uq_question_provenance_question"),)

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_type: Mapped[str] = mapped_column(
        String(30),
        default="human",
        nullable=False,
    )
    source_type: Mapped[str] = mapped_column(
        String(50),
        default="original",
        nullable=False,
    )
    source_reference: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    generator_model: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    generator_prompt_version: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    generator_parameters: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )
    taxonomy_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("taxonomy_versions.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    review_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    question: Mapped[Question] = relationship(
        "Question",
        back_populates="provenance",
    )


class QuestionSkillTag(TimeStampedUUIDModel):
    """Associates a question with a primary or secondary competency with weight and subskill FK."""

    __tablename__ = "question_skill_tags"
    __table_args__ = (
        Index("ix_question_skill_tags_skill_role", "skill_id", "role"),
    )

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    subskill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    subskill: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    role: Mapped[SkillTagRole] = mapped_column(
        SQLEnumValues(SkillTagRole, name="skill_tag_role", native_enum=False),
        default=SkillTagRole.PRIMARY,
        nullable=False,
        index=True,
    )
    weight: Mapped[float] = mapped_column(
        Float,
        default=1.0,
        nullable=False,
    )
    context: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    question: Mapped[Question] = relationship(
        "Question",
        back_populates="skill_tags",
    )
    skill: Mapped[Skill] = relationship(
        "Skill",
        foreign_keys=[skill_id],
        back_populates="question_tags",
    )
    subskill_ref: Mapped[Skill | None] = relationship(
        "Skill",
        foreign_keys=[subskill_id],
    )


class Attempt(TimeStampedUUIDModel):
    """A student's exam attempt with server-controlled lifecycle and timestamps."""

    __tablename__ = "attempts"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assessments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[AttemptStatus] = mapped_column(
        SQLEnum(AttemptStatus, name="attempt_status", native_enum=False),
        default=AttemptStatus.CREATED,
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    expires_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    submitted_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    assessment_version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    assessment_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assessment_versions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    assessment: Mapped[Assessment] = relationship(
        "Assessment",
        back_populates="attempts",
    )
    version_snapshot: Mapped[AssessmentVersion | None] = relationship(
        "AssessmentVersion",
        foreign_keys=[assessment_version_id],
    )
    user: Mapped[User] = relationship(
        "User",
    )
    answers: Mapped[list[AttemptAnswer]] = relationship(
        "AttemptAnswer",
        back_populates="attempt",
        cascade="all, delete-orphan",
    )
    score: Mapped[AttemptScore | None] = relationship(
        "AttemptScore",
        back_populates="attempt",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def student_id(self) -> uuid.UUID:
        return self.user_id


class AttemptAnswer(TimeStampedUUIDModel):
    """Answer submitted by a user for a question within an attempt."""

    __tablename__ = "attempt_answers"
    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_attempt_question_answer"),
    )

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    selected_option_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("question_options.id", ondelete="SET NULL"),
        nullable=True,
    )
    selected_option_ids: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    text_response: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    response_payload: Mapped[dict | list | None] = mapped_column(
        JSON,
        nullable=True,
    )
    is_correct: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )
    points_awarded: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    scoring_status: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )
    answered_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )
    question_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("question_versions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    attempt: Mapped[Attempt] = relationship(
        "Attempt",
        back_populates="answers",
    )
    question: Mapped[Question] = relationship(
        "Question",
    )
    question_version: Mapped[QuestionVersion | None] = relationship(
        "QuestionVersion",
        foreign_keys=[question_version_id],
    )
    selected_option: Mapped[QuestionOption | None] = relationship(
        "QuestionOption",
    )


class AttemptScore(TimeStampedUUIDModel):
    """Calculated score and skill assessment result for a completed attempt."""

    __tablename__ = "attempt_scores"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attempts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    total_points: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    max_points: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    percentage: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    is_passed: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )
    estimated_level: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )
    scoring_algorithm_version: Mapped[str] = mapped_column(
        String(20),
        default="v2",
        nullable=False,
    )
    skill_scores: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    scored_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )

    attempt: Mapped[Attempt] = relationship(
        "Attempt",
        back_populates="score",
    )
