"""Pydantic schemas for Taxonomy V2 management, versioning, hierarchy, relationships, and CEFR descriptors."""

import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.modules.admin.enums import (
    CEFRBand,
    SkillDimension,
    SkillRelationType,
    TaxonomyLifecycleStatus,
)
from app.modules.admin.schemas import SkillUsageCounts, SubSkillResponse


# --- Taxonomy Version Schemas ---
class TaxonomyVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    version: str
    name: str
    status: TaxonomyLifecycleStatus
    description: str | None = None
    activated_at: datetime.datetime | None = None
    archived_at: datetime.datetime | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    skill_count: int = 0


class TaxonomyVersionCreate(BaseModel):
    version: str = Field(..., min_length=1, max_length=32, description="Semantic version string, e.g. '2.1.0'")
    name: str = Field(..., min_length=1, max_length=255, description="Human readable version name")
    description: str | None = None
    status: TaxonomyLifecycleStatus = TaxonomyLifecycleStatus.DRAFT


class TaxonomyVersionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: TaxonomyLifecycleStatus | None = None


# --- Task Type Schemas ---
class TaskTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    modality: str
    code: str
    name: str
    description: str | None = None
    is_active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime


class TaskTypeCreate(BaseModel):
    modality: str = Field(..., min_length=1, max_length=30, description="Exam modality e.g. 'reading', 'listening', 'writing', 'speaking'")
    code: str = Field(..., min_length=1, max_length=100, description="Unique code e.g. 'READ_FAITS_DIVERS'")
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    is_active: bool = True


class TaskTypeUpdate(BaseModel):
    modality: str | None = None
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


# --- Skill Level Descriptor (CEFR) Schemas ---
class SkillLevelDescriptorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    skill_id: uuid.UUID
    level: CEFRBand
    descriptor: str
    evidence_guidance: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class SkillLevelDescriptorCreate(BaseModel):
    level: CEFRBand
    descriptor: str = Field(..., min_length=3, description="CEFR can-do benchmark statement")
    evidence_guidance: str | None = Field(None, description="Guidance on what constitutes observable mastery evidence")


class SkillLevelDescriptorUpdate(BaseModel):
    descriptor: str | None = Field(None, min_length=3)
    evidence_guidance: str | None = None


# --- Skill Relation Schemas ---
class SkillRelationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    from_skill_id: uuid.UUID
    to_skill_id: uuid.UUID
    relation_type: SkillRelationType
    target_skill_code: str | None = None
    target_skill_name: str | None = None
    target_skill_dimension: str | None = None
    created_at: datetime.datetime


class SkillRelationCreate(BaseModel):
    to_skill_id: uuid.UUID
    relation_type: SkillRelationType = SkillRelationType.PREREQUISITE


class SkillRelationsListResponse(BaseModel):
    outgoing: list[SkillRelationResponse] = Field(default_factory=list)
    incoming: list[SkillRelationResponse] = Field(default_factory=list)


# --- Skill Base & Summary Schemas ---
class AdminSkillSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    dimension: SkillDimension
    domain: str
    category: str | None = None
    is_active: bool = True


class TaxonomySkillListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    taxonomy_version_id: uuid.UUID
    code: str
    name: str
    dimension: SkillDimension
    domain: str
    category: str | None = None
    description: str | None = None
    parent_id: uuid.UUID | None = None
    is_active: bool = True
    created_at: datetime.datetime
    updated_at: datetime.datetime
    subskill_count: int = 0
    usage_counts: SkillUsageCounts = Field(default_factory=SkillUsageCounts)


class TaxonomySkillListResponse(BaseModel):
    items: list[TaxonomySkillListItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class TaxonomySkillDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    taxonomy_version_id: uuid.UUID
    code: str
    name: str
    dimension: SkillDimension
    domain: str
    category: str | None = None
    description: str | None = None
    parent_id: uuid.UUID | None = None
    is_active: bool = True
    created_at: datetime.datetime
    updated_at: datetime.datetime
    parent: AdminSkillSummaryResponse | None = None
    children: list[AdminSkillSummaryResponse] = Field(default_factory=list)
    subskills_legacy: list[SubSkillResponse] = Field(default_factory=list)
    level_descriptors: list[SkillLevelDescriptorResponse] = Field(default_factory=list)
    outgoing_relations: list[SkillRelationResponse] = Field(default_factory=list)
    incoming_relations: list[SkillRelationResponse] = Field(default_factory=list)
    usage_counts: SkillUsageCounts = Field(default_factory=SkillUsageCounts)


class TaxonomyTreeNodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    dimension: SkillDimension
    domain: str
    category: str | None = None
    description: str | None = None
    parent_id: uuid.UUID | None = None
    is_active: bool = True
    children: list[TaxonomyTreeNodeResponse] = Field(default_factory=list)
    level_descriptors: list[SkillLevelDescriptorResponse] = Field(default_factory=list)
    usage_counts: SkillUsageCounts = Field(default_factory=SkillUsageCounts)


TaxonomyTreeNodeResponse.model_rebuild()


# --- Skill Mutation Schemas ---
class TaxonomySkillCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=100)
    name: str = Field(..., min_length=2, max_length=255)
    dimension: SkillDimension
    domain: str = Field(..., min_length=2, max_length=50)
    category: str | None = None
    description: str | None = None
    parent_id: uuid.UUID | None = None
    taxonomy_version_id: uuid.UUID | None = None
    is_active: bool = True


class TaxonomySkillUpdate(BaseModel):
    code: str | None = Field(None, min_length=2, max_length=100)
    name: str | None = Field(None, min_length=2, max_length=255)
    dimension: SkillDimension | None = None
    domain: str | None = Field(None, min_length=2, max_length=50)
    category: str | None = None
    description: str | None = None
    parent_id: uuid.UUID | None = None
    is_active: bool | None = None


class TaxonomyChildSkillCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=100)
    name: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    category: str | None = None
    dimension: SkillDimension | None = None  # Inherited from parent if omitted
    domain: str | None = None  # Inherited from parent if omitted
    is_active: bool = True


class TaxonomyReparentRequest(BaseModel):
    new_parent_id: uuid.UUID | None = None


# --- Metadata & Summary ---
class TaxonomyMetricsSummary(BaseModel):
    total_skills: int
    total_subskills: int
    total_competencies: int
    dimensions_breakdown: dict[str, int] = Field(default_factory=dict)
    domains_breakdown: dict[str, int] = Field(default_factory=dict)
    active_skills: int
    archived_skills: int
    total_relations: int
    total_descriptors: int


class TaxonomyMetadataResponse(BaseModel):
    dimensions: list[str]
    domains: list[str]
    relation_types: list[str]
    cefr_bands: list[str]
    active_version: TaxonomyVersionResponse | None = None
    metrics: TaxonomyMetricsSummary
