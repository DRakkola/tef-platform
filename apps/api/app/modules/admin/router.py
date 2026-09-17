"""FastAPI Router for administrative content management, media, audit logs, and RBAC."""

import uuid
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.storage import StorageService, get_storage
from app.modules.admin.enums import ContentStatus, MediaType
from app.modules.admin.schemas import (
    AdminAssessmentCreate,
    AdminAssessmentListResponse,
    AdminAssessmentResponse,
    AdminAssessmentUpdate,
    AdminExerciseCreate,
    AdminExerciseResponse,
    AdminOptionResponse,
    AdminQuestionCreate,
    AdminQuestionResponse,
    AdminSectionCreate,
    AdminSectionResponse,
    AdminSkillCreate,
    AdminSkillResponse,
    AdminUserRoleUpdate,
    AdminWritingTaskCreate,
    AdminWritingTaskResponse,
    AuditEventResponse,
    AuditLogListResponse,
    MediaAssetListResponse,
    MediaAssetResponse,
    MediaPresignedUrlResponse,
)
from app.modules.admin.service import AdminContentService, AuditService, MediaAssetService
from app.modules.auth.dependencies import require_role
from app.modules.users.models import User, UserRole
from app.modules.users.schemas import UserResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


# ---------------------------------------------------------------------------
# System & Audit Logging Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/system-overview",
    summary="Admin system overview metrics",
)
async def get_admin_system_overview(
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> dict[str, Any]:
    """Administrative overview endpoint restricted strictly to admin role."""
    return {
        "status": "operational",
        "restricted": True,
        "access": "admin_granted",
        "environment": "production-ready",
    }


@router.get(
    "/audit-logs",
    response_model=AuditLogListResponse,
    summary="List immutable system audit logs",
)
async def list_audit_logs(
    action: str | None = Query(None, description="Filter by action: CREATE, UPDATE, ROLE_CHANGE, etc."),
    entity_type: str | None = Query(None, description="Filter by entity type: assessment, user, etc."),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> AuditLogListResponse:
    """Query audit logs with pagination and filters."""
    items, total = await AuditService.list_logs(
        db=db,
        action=action,
        entity_type=entity_type,
        page=page,
        page_size=page_size,
    )
    return AuditLogListResponse(
        items=[AuditEventResponse.model_validate(it) for it in items],
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# Media Asset Management (MinIO Private Storage)
# ---------------------------------------------------------------------------


@router.post(
    "/media/upload",
    response_model=MediaAssetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload media asset (listening audio, exam diagram) to private storage",
)
async def upload_media_asset(
    file: UploadFile = File(...),
    title: str = Form(...),
    media_type: MediaType = Form(MediaType.AUDIO),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
    storage: StorageService = Depends(get_storage),
) -> MediaAssetResponse:
    """Upload media file to MinIO with server-generated key and metadata."""
    content_bytes = await file.read()
    asset = await MediaAssetService.upload_asset(
        db=db,
        title=title,
        media_type=media_type,
        file_bytes=content_bytes,
        filename=file.filename or "media_file",
        content_type=file.content_type or "application/octet-stream",
        uploader_id=current_admin.id,
        storage=storage,
    )
    return MediaAssetResponse.model_validate(asset)


@router.get(
    "/media",
    response_model=MediaAssetListResponse,
    summary="List media assets in library",
)
async def list_media_assets(
    media_type: MediaType | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> MediaAssetListResponse:
    """Retrieve catalog of uploaded media assets."""
    items, total = await MediaAssetService.list_assets(
        db=db,
        media_type=media_type,
        page=page,
        page_size=page_size,
    )
    return MediaAssetListResponse(
        items=[MediaAssetResponse.model_validate(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/media/{asset_id}/presigned-url",
    response_model=MediaPresignedUrlResponse,
    summary="Get temporary presigned URL for private asset",
)
async def get_media_presigned_url(
    asset_id: uuid.UUID,
    expires_in: Annotated[int, Query(ge=60, le=86400)] = 3600,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
    storage: StorageService = Depends(get_storage),
) -> MediaPresignedUrlResponse:
    """Generate time-limited presigned URL without revealing MinIO credentials."""
    url = await MediaAssetService.get_presigned_download_url(
        db=db,
        asset_id=asset_id,
        storage=storage,
        expires_in_seconds=expires_in,
    )
    return MediaPresignedUrlResponse(
        asset_id=asset_id,
        download_url=url,
        expires_in_seconds=expires_in,
    )


# ---------------------------------------------------------------------------
# Assessment Content Lifecycle & Management
# ---------------------------------------------------------------------------


@router.post(
    "/content/assessments",
    response_model=AdminAssessmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create assessment draft",
)
async def create_assessment(
    payload: AdminAssessmentCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminAssessmentResponse:
    """Create assessment definition in DRAFT status."""
    asmt = await AdminContentService.create_assessment(
        db=db,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminAssessmentResponse.model_validate(asmt)


@router.get(
    "/content/assessments",
    response_model=AdminAssessmentListResponse,
    summary="List assessments for administration",
)
async def list_admin_assessments(
    status_filter: ContentStatus | None = Query(None, alias="status"),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminAssessmentListResponse:
    """Browse assessments filtered by lifecycle state."""
    items, total = await AdminContentService.list_admin_assessments(
        db=db,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
    )
    return AdminAssessmentListResponse(
        items=[AdminAssessmentResponse.model_validate(it) for it in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/content/assessments/{assessment_id}",
    response_model=AdminAssessmentResponse,
    summary="Get full assessment content tree",
)
async def get_admin_assessment_detail(
    assessment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminAssessmentResponse:
    """Retrieve assessment with all sections, questions, and options."""
    asmt = await AdminContentService.get_assessment_with_tree(db=db, assessment_id=assessment_id)
    return AdminAssessmentResponse.model_validate(asmt)


@router.put(
    "/content/assessments/{assessment_id}",
    response_model=AdminAssessmentResponse,
    summary="Update assessment (bumps version if published with attempts)",
)
async def update_assessment(
    assessment_id: uuid.UUID,
    payload: AdminAssessmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminAssessmentResponse:
    """Update assessment configuration. Automatically increments version if published."""
    asmt = await AdminContentService.update_assessment(
        db=db,
        assessment_id=assessment_id,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminAssessmentResponse.model_validate(asmt)


@router.post(
    "/content/assessments/{assessment_id}/publish",
    response_model=AdminAssessmentResponse,
    summary="Publish assessment to students",
)
async def publish_assessment(
    assessment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminAssessmentResponse:
    """Transition assessment to PUBLISHED status making it available to test-takers."""
    asmt = await AdminContentService.transition_assessment_lifecycle(
        db=db,
        assessment_id=assessment_id,
        new_status=ContentStatus.PUBLISHED,
        actor_id=current_admin.id,
    )
    return AdminAssessmentResponse.model_validate(asmt)


@router.post(
    "/content/assessments/{assessment_id}/archive",
    response_model=AdminAssessmentResponse,
    summary="Archive assessment",
)
async def archive_assessment(
    assessment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminAssessmentResponse:
    """Archive assessment (preserves historical attempts while removing from new catalog)."""
    asmt = await AdminContentService.transition_assessment_lifecycle(
        db=db,
        assessment_id=assessment_id,
        new_status=ContentStatus.ARCHIVED,
        actor_id=current_admin.id,
    )
    return AdminAssessmentResponse.model_validate(asmt)


@router.post(
    "/content/assessments/{assessment_id}/sections",
    response_model=AdminSectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add section to assessment",
)
async def add_assessment_section(
    assessment_id: uuid.UUID,
    payload: AdminSectionCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminSectionResponse:
    """Add a section to an assessment."""
    sec = await AdminContentService.add_section(
        db=db,
        assessment_id=assessment_id,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminSectionResponse.model_validate(sec)


@router.post(
    "/content/sections/{section_id}/questions",
    response_model=AdminQuestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add question with options to section",
)
async def add_section_question(
    section_id: uuid.UUID,
    payload: AdminQuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminQuestionResponse:
    """Add a question and its options to an assessment section."""
    q = await AdminContentService.add_question(
        db=db,
        section_id=section_id,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminQuestionResponse.model_validate(q)


# ---------------------------------------------------------------------------
# Skills Taxonomy, Exercises & Writing Tasks Admin
# ---------------------------------------------------------------------------


@router.post(
    "/content/skills",
    response_model=AdminSkillResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Define a new skill or subskill in taxonomy",
)
async def create_skill(
    payload: AdminSkillCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminSkillResponse:
    """Register a new skill node."""
    skill = await AdminContentService.create_skill(
        db=db,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminSkillResponse.model_validate(skill)


@router.post(
    "/content/exercises",
    response_model=AdminExerciseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create targeted practice exercise",
)
async def create_exercise(
    payload: AdminExerciseCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminExerciseResponse:
    """Create a practice exercise mapped to specific skills."""
    ex = await AdminContentService.create_exercise(
        db=db,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminExerciseResponse.model_validate(ex)


@router.post(
    "/content/writing-tasks",
    response_model=AdminWritingTaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create TEF writing task",
)
async def create_writing_task(
    payload: AdminWritingTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminWritingTaskResponse:
    """Create a TEF writing prompt (Section A or B)."""
    task = await AdminContentService.create_writing_task(
        db=db,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminWritingTaskResponse.model_validate(task)


# ---------------------------------------------------------------------------
# User Administration & Role Management
# ---------------------------------------------------------------------------


@router.post(
    "/users/{user_id}/role",
    response_model=UserResponse,
    summary="Update user role (audited)",
)
async def update_user_role(
    user_id: uuid.UUID,
    payload: AdminUserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> UserResponse:
    """Change user role with mandatory security audit logging."""
    user = await AdminContentService.update_user_role(
        db=db,
        target_user_id=user_id,
        new_role=payload.role,
        actor_id=current_admin.id,
    )
    return UserResponse.model_validate(user)
