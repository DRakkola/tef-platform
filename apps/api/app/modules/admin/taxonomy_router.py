"""FastAPI Router for Canonical Taxonomy V2: /api/v1/admin/taxonomy."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.admin.enums import CEFRBand, SkillDimension
from app.modules.admin.taxonomy_schemas import (
    SkillLevelDescriptorCreate,
    SkillLevelDescriptorResponse,
    SkillRelationCreate,
    SkillRelationResponse,
    SkillRelationsListResponse,
    TaskTypeCreate,
    TaskTypeResponse,
    TaskTypeUpdate,
    TaxonomyChildSkillCreate,
    TaxonomyMetadataResponse,
    TaxonomyReparentRequest,
    TaxonomySkillCreate,
    TaxonomySkillDetailResponse,
    TaxonomySkillListItemResponse,
    TaxonomySkillListResponse,
    TaxonomySkillUpdate,
    TaxonomyTreeNodeResponse,
    TaxonomyVersionCreate,
    TaxonomyVersionResponse,
    TaxonomyVersionUpdate,
)
from app.modules.admin.taxonomy_service import TaxonomyService
from app.modules.auth.dependencies import require_role
from app.modules.users.models import User, UserRole

router = APIRouter(prefix="/admin/taxonomy", tags=["Admin Taxonomy V2"])


# ---------------------------------------------------------------------------
# Metadata & Versions
# ---------------------------------------------------------------------------


@router.get(
    "/metadata",
    response_model=TaxonomyMetadataResponse,
    summary="Get global taxonomy metadata, orthogonal dimensions, and counts",
)
async def get_taxonomy_metadata(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> TaxonomyMetadataResponse:
    """Retrieve canonical dimensions, domains, relation types, and active version info."""
    return await TaxonomyService.get_metadata(db)


@router.get(
    "/versions",
    response_model=list[TaxonomyVersionResponse],
    summary="List all taxonomy versions",
)
async def list_taxonomy_versions(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> list[TaxonomyVersionResponse]:
    """Retrieve all taxonomy release versions with annotated skill counts."""
    return await TaxonomyService.list_versions(db)


@router.post(
    "/versions",
    response_model=TaxonomyVersionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new taxonomy version snapshot",
)
async def create_taxonomy_version(
    payload: TaxonomyVersionCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> TaxonomyVersionResponse:
    """Create a new version snapshot for the competency catalog."""
    v = await TaxonomyService.create_version(db, payload, actor_id=current_admin.id)
    return TaxonomyVersionResponse(
        id=v.id,
        version=v.version,
        name=v.name,
        status=v.status,
        description=v.description,
        activated_at=v.activated_at,
        archived_at=v.archived_at,
        created_at=v.created_at,
        updated_at=v.updated_at,
        skill_count=0,
    )


@router.put(
    "/versions/{version_id}",
    response_model=TaxonomyVersionResponse,
    summary="Update or activate a taxonomy version",
)
async def update_taxonomy_version(
    version_id: uuid.UUID,
    payload: TaxonomyVersionUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> TaxonomyVersionResponse:
    """Update metadata or promote a taxonomy version to active."""
    v = await TaxonomyService.update_version(db, version_id, payload, actor_id=current_admin.id)
    versions = await TaxonomyService.list_versions(db)
    for item in versions:
        if item.id == v.id:
            return item
    return TaxonomyVersionResponse(
        id=v.id,
        version=v.version,
        name=v.name,
        status=v.status,
        description=v.description,
        activated_at=v.activated_at,
        archived_at=v.archived_at,
        created_at=v.created_at,
        updated_at=v.updated_at,
        skill_count=0,
    )


@router.get(
    "/tree",
    response_model=list[TaxonomyTreeNodeResponse],
    summary="Get full hierarchical taxonomy tree with Zero N+1 usage counts",
)
async def get_taxonomy_tree(
    version_id: uuid.UUID | None = None,
    dimension: SkillDimension | None = None,
    domain: str | None = None,
    is_active: bool | None = True,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> list[TaxonomyTreeNodeResponse]:
    """Retrieve full hierarchical competency tree with nested subskills and batch-aggregated metrics."""
    return await TaxonomyService.get_taxonomy_tree(
        db=db,
        version_id=version_id,
        dimension=dimension,
        domain=domain,
        is_active=is_active,
    )


# ---------------------------------------------------------------------------
# Task Types (Modality Formats Decoupled from Competencies)
# ---------------------------------------------------------------------------


@router.get(
    "/task-types",
    response_model=list[TaskTypeResponse],
    summary="List exam task types",
)
async def list_task_types(
    modality: str | None = None,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> list[TaskTypeResponse]:
    """List exam stimulus and question task types."""
    return await TaxonomyService.list_task_types(db, modality=modality, is_active=is_active)


@router.post(
    "/task-types",
    response_model=TaskTypeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new exam task type",
)
async def create_task_type(
    payload: TaskTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> TaskTypeResponse:
    return await TaxonomyService.create_task_type(db, payload, actor_id=current_admin.id)


@router.get(
    "/task-types/{task_type_id}",
    response_model=TaskTypeResponse,
    summary="Get task type details",
)
async def get_task_type(
    task_type_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> TaskTypeResponse:
    return await TaxonomyService.get_task_type(db, task_type_id)


@router.put(
    "/task-types/{task_type_id}",
    response_model=TaskTypeResponse,
    summary="Update exam task type",
)
async def update_task_type(
    task_type_id: uuid.UUID,
    payload: TaskTypeUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> TaskTypeResponse:
    return await TaxonomyService.update_task_type(db, task_type_id, payload, actor_id=current_admin.id)


@router.delete(
    "/task-types/{task_type_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete exam task type",
)
async def delete_task_type(
    task_type_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> None:
    await TaxonomyService.delete_task_type(db, task_type_id, actor_id=current_admin.id)


# ---------------------------------------------------------------------------
# Skills Management (Paginated, Search, Filters, Sorting)
# ---------------------------------------------------------------------------


@router.get(
    "/skills",
    response_model=TaxonomySkillListResponse,
    summary="List skills with server-side pagination, search, filters, and usage metrics",
)
async def list_skills(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    q: str | None = None,
    dimension: SkillDimension | None = None,
    domain: str | None = None,
    is_active: bool | None = None,
    parent_id: uuid.UUID | None = None,
    roots_only: bool = False,
    sort_by: str = "name",
    sort_dir: str = "asc",
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> TaxonomySkillListResponse:
    """Query competency catalog with zero N+1 relational dependency calculation."""
    return await TaxonomyService.list_skills(
        db=db,
        page=page,
        page_size=page_size,
        q=q,
        dimension=dimension,
        domain=domain,
        is_active=is_active,
        parent_id=parent_id,
        roots_only=roots_only,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )


@router.post(
    "/skills",
    response_model=TaxonomySkillDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new root or child skill",
)
async def create_skill(
    payload: TaxonomySkillCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> TaxonomySkillDetailResponse:
    return await TaxonomyService.create_skill(db, payload, actor_id=current_admin.id)


@router.get(
    "/skills/{skill_id}",
    response_model=TaxonomySkillDetailResponse,
    summary="Get skill details with descriptors, graph relations, and usage counts",
)
async def get_skill_detail(
    skill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> TaxonomySkillDetailResponse:
    return await TaxonomyService.get_skill_detail(db, skill_id)


@router.put(
    "/skills/{skill_id}",
    response_model=TaxonomySkillDetailResponse,
    summary="Update skill properties, dimension, domain, or re-parent",
)
async def update_skill(
    skill_id: uuid.UUID,
    payload: TaxonomySkillUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> TaxonomySkillDetailResponse:
    return await TaxonomyService.update_skill(db, skill_id, payload, actor_id=current_admin.id)


@router.post(
    "/skills/{skill_id}/archive",
    response_model=TaxonomySkillDetailResponse,
    summary="Archive a skill safely without breaking historical links",
)
async def archive_skill(
    skill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> TaxonomySkillDetailResponse:
    return await TaxonomyService.archive_skill(db, skill_id, actor_id=current_admin.id)


@router.post(
    "/skills/{skill_id}/restore",
    response_model=TaxonomySkillDetailResponse,
    summary="Restore an archived skill back to active",
)
async def restore_skill(
    skill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> TaxonomySkillDetailResponse:
    return await TaxonomyService.restore_skill(db, skill_id, actor_id=current_admin.id)


@router.delete(
    "/skills/{skill_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Hard delete skill only if zero dependencies exist",
)
async def delete_skill(
    skill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> None:
    await TaxonomyService.delete_skill_safe(db, skill_id, actor_id=current_admin.id)


# ---------------------------------------------------------------------------
# Children / Subskills
# ---------------------------------------------------------------------------


@router.get(
    "/skills/{skill_id}/children",
    response_model=list[TaxonomySkillListItemResponse],
    summary="List child subskills for a parent competency",
)
async def list_skill_children(
    skill_id: uuid.UUID,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    return await TaxonomyService.list_children(db, parent_id=skill_id, is_active=is_active)


@router.post(
    "/skills/{skill_id}/children",
    response_model=TaxonomySkillDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new child subskill under parent",
)
async def create_skill_child(
    skill_id: uuid.UUID,
    payload: TaxonomyChildSkillCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> TaxonomySkillDetailResponse:
    return await TaxonomyService.create_child(db, parent_id=skill_id, payload=payload, actor_id=current_admin.id)


@router.put(
    "/skills/{skill_id}/parent",
    response_model=TaxonomySkillDetailResponse,
    summary="Re-parent a skill or promote to root competency",
)
async def reparent_skill(
    skill_id: uuid.UUID,
    payload: TaxonomyReparentRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> TaxonomySkillDetailResponse:
    update_payload = TaxonomySkillUpdate(parent_id=payload.new_parent_id)
    return await TaxonomyService.update_skill(db, skill_id, update_payload, actor_id=current_admin.id)


# ---------------------------------------------------------------------------
# CEFR Level Descriptors
# ---------------------------------------------------------------------------


@router.get(
    "/skills/{skill_id}/descriptors",
    response_model=list[SkillLevelDescriptorResponse],
    summary="List CEFR descriptors for a skill",
)
async def list_skill_descriptors(
    skill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> list[SkillLevelDescriptorResponse]:
    return await TaxonomyService.list_descriptors(db, skill_id)


@router.get(
    "/skills/{skill_id}/descriptors/{level}",
    response_model=SkillLevelDescriptorResponse,
    summary="Get descriptor for a specific CEFR band",
)
async def get_skill_descriptor(
    skill_id: uuid.UUID,
    level: CEFRBand,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> SkillLevelDescriptorResponse:
    return await TaxonomyService.get_descriptor(db, skill_id, level)


@router.put(
    "/skills/{skill_id}/descriptors",
    response_model=SkillLevelDescriptorResponse,
    summary="Upsert CEFR can-do descriptor and evidence guidance for a skill",
)
async def upsert_skill_descriptor(
    skill_id: uuid.UUID,
    payload: SkillLevelDescriptorCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> SkillLevelDescriptorResponse:
    return await TaxonomyService.upsert_descriptor(db, skill_id, payload, actor_id=current_admin.id)


@router.delete(
    "/skills/{skill_id}/descriptors/{level}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete CEFR descriptor for a band",
)
async def delete_skill_descriptor(
    skill_id: uuid.UUID,
    level: CEFRBand,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> None:
    await TaxonomyService.delete_descriptor(db, skill_id, level, actor_id=current_admin.id)


# ---------------------------------------------------------------------------
# Skill Relationships & Graph
# ---------------------------------------------------------------------------


@router.get(
    "/skills/{skill_id}/relations",
    response_model=SkillRelationsListResponse,
    summary="List incoming and outgoing graph dependencies for a skill",
)
async def list_skill_relations(
    skill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> SkillRelationsListResponse:
    return await TaxonomyService.list_relations(db, skill_id)


@router.post(
    "/skills/{skill_id}/relations",
    response_model=SkillRelationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a directed dependency edge with cycle detection",
)
async def create_skill_relation(
    skill_id: uuid.UUID,
    payload: SkillRelationCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> SkillRelationResponse:
    return await TaxonomyService.create_relation(db, from_skill_id=skill_id, payload=payload, actor_id=current_admin.id)


@router.delete(
    "/skills/{skill_id}/relations/{relation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a dependency edge from the learning graph",
)
async def delete_skill_relation(
    skill_id: uuid.UUID,
    relation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> None:
    await TaxonomyService.delete_relation(db, relation_id=relation_id, actor_id=current_admin.id)
