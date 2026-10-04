"""Canonical Taxonomy V2 Service.

Provides complete management for the TEF unified competency taxonomy:
- Taxonomy versions and lifecycle management
- Hierarchical competencies and subskills
- Orthogonal dimensions (reasoning, language) and exam modalities
- Task types (stimulus & format decoupled from competencies)
- Directed learning graph relations with cycle prevention
- CEFR level descriptors & observable evidence guidance
- Zero N+1 aggregated usage metrics across questions, exercises, student skills, and evaluations
- Audit logging and backward compatibility synchronization
"""

import datetime
import re
import uuid
from collections import defaultdict
from collections.abc import Sequence
from typing import Any

from sqlalchemy import String, cast, delete, func, or_, select, union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.modules.admin.enums import (
    AuditAction,
    CEFRBand,
    SkillDimension,
    SkillRelationType,
    TaxonomyLifecycleStatus,
    TaxonomyMigrationStatus,
)
from app.modules.admin.models import (
    SkillAlias,
    SkillLevelDescriptor,
    SkillModality,
    SkillRelation,
    SubSkill,
    TaskTypeSkill,
    TaxonomyMigrationRecord,
    TaxonomyVersion,
)
from app.modules.admin.schemas import (
    SkillUsageCounts,
    SubSkillResponse,
)
from app.modules.admin.service import AuditService
from app.modules.admin.taxonomy_schemas import (
    AdminSkillSummaryResponse,
    SkillAliasResponse,
    SkillLevelDescriptorCreate,
    SkillLevelDescriptorResponse,
    SkillModalityResponse,
    SkillRelationCreate,
    SkillRelationResponse,
    SkillRelationsListResponse,
    TaskTypeCreate,
    TaskTypeResponse,
    TaskTypeUpdate,
    TaxonomyChildSkillCreate,
    TaxonomyMetadataResponse,
    TaxonomyMetricsSummary,
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
from app.modules.assessments.models import (
    AssessmentSection,
    Question,
    QuestionSkillTag,
    Skill,
    TaskType,
)
from app.modules.learning.models import (
    ExerciseSkill,
    SkillAssessment,
    StudentSkill,
)
from app.modules.learning.readiness_models import SkillEvidence
from app.modules.speaking.models import SpeakingEvaluationSkill
from app.modules.writing.models import WritingCorrectionSkill


class TaxonomyService:
    """Authoritative service for Taxonomy V2."""

    # ---------------------------------------------------------------------------
    # Zero N+1 Batch Relational Usage Counting
    # ---------------------------------------------------------------------------

    @staticmethod
    async def batch_get_skill_usage(
        db: AsyncSession,
        skill_ids: Sequence[uuid.UUID],
    ) -> dict[uuid.UUID, SkillUsageCounts]:
        """Aggregate relational dependencies across all subsystems in 8 constant queries total."""
        if not skill_ids:
            return {}

        unique_ids = list(set(skill_ids))
        results: dict[uuid.UUID, dict[str, int]] = defaultdict(
            lambda: {
                "questions": 0,
                "exercises": 0,
                "assessments": 0,
                "student_mastery": 0,
                "skill_assessments": 0,
                "skill_evidence": 0,
                "writing_evaluations": 0,
                "speaking_evaluations": 0,
            }
        )

        # 1. Questions tagged with skills (either as primary skill_id or subskill_id)
        q_primary = select(
            QuestionSkillTag.skill_id.label("matched_skill_id"),
            QuestionSkillTag.question_id.label("question_id"),
        ).where(QuestionSkillTag.skill_id.in_(unique_ids))

        q_sub = select(
            QuestionSkillTag.subskill_id.label("matched_skill_id"),
            QuestionSkillTag.question_id.label("question_id"),
        ).where(
            QuestionSkillTag.subskill_id.is_not(None),
            QuestionSkillTag.subskill_id.in_(unique_ids),
        )

        q_union = union(q_primary, q_sub).subquery()
        q_stmt = (
            select(
                q_union.c.matched_skill_id,
                func.count(func.distinct(q_union.c.question_id)),
            )
            .group_by(q_union.c.matched_skill_id)
        )
        for sk_id, count in (await db.execute(q_stmt)).all():
            results[sk_id]["questions"] = count

        # 2. Exercises tagged with skills (either as primary skill_id or subskill_id)
        ex_primary = select(
            ExerciseSkill.skill_id.label("matched_skill_id"),
            ExerciseSkill.exercise_id.label("exercise_id"),
        ).where(ExerciseSkill.skill_id.in_(unique_ids))

        ex_sub = select(
            ExerciseSkill.subskill_id.label("matched_skill_id"),
            ExerciseSkill.exercise_id.label("exercise_id"),
        ).where(
            ExerciseSkill.subskill_id.is_not(None),
            ExerciseSkill.subskill_id.in_(unique_ids),
        )

        ex_union = union(ex_primary, ex_sub).subquery()
        ex_stmt = (
            select(
                ex_union.c.matched_skill_id,
                func.count(func.distinct(ex_union.c.exercise_id)),
            )
            .group_by(ex_union.c.matched_skill_id)
        )
        for sk_id, count in (await db.execute(ex_stmt)).all():
            results[sk_id]["exercises"] = count

        # 3. Assessments containing questions tagged with skills (either as primary skill_id or subskill_id)
        asmt_primary = (
            select(
                QuestionSkillTag.skill_id.label("matched_skill_id"),
                AssessmentSection.assessment_id.label("assessment_id"),
            )
            .join(Question, Question.id == QuestionSkillTag.question_id)
            .join(AssessmentSection, AssessmentSection.id == Question.section_id)
            .where(QuestionSkillTag.skill_id.in_(unique_ids))
        )

        asmt_sub = (
            select(
                QuestionSkillTag.subskill_id.label("matched_skill_id"),
                AssessmentSection.assessment_id.label("assessment_id"),
            )
            .join(Question, Question.id == QuestionSkillTag.question_id)
            .join(AssessmentSection, AssessmentSection.id == Question.section_id)
            .where(
                QuestionSkillTag.subskill_id.is_not(None),
                QuestionSkillTag.subskill_id.in_(unique_ids),
            )
        )

        asmt_union = union(asmt_primary, asmt_sub).subquery()
        asmt_stmt = (
            select(
                asmt_union.c.matched_skill_id,
                func.count(func.distinct(asmt_union.c.assessment_id)),
            )
            .group_by(asmt_union.c.matched_skill_id)
        )
        for sk_id, count in (await db.execute(asmt_stmt)).all():
            results[sk_id]["assessments"] = count

        # 4. Student mastery records
        sm_stmt = (
            select(
                StudentSkill.skill_id,
                func.count(func.distinct(StudentSkill.user_id)),
            )
            .where(StudentSkill.skill_id.in_(unique_ids))
            .group_by(StudentSkill.skill_id)
        )
        for sk_id, count in (await db.execute(sm_stmt)).all():
            results[sk_id]["student_mastery"] = count

        # 5. Historical evaluation snapshots
        sa_stmt = (
            select(
                SkillAssessment.skill_id,
                func.count(SkillAssessment.id),
            )
            .where(SkillAssessment.skill_id.in_(unique_ids))
            .group_by(SkillAssessment.skill_id)
        )
        for sk_id, count in (await db.execute(sa_stmt)).all():
            results[sk_id]["skill_assessments"] = count

        # 6. Skill readiness evidence
        se_stmt = (
            select(
                SkillEvidence.skill_id,
                func.count(SkillEvidence.id),
            )
            .where(SkillEvidence.skill_id.in_(unique_ids))
            .group_by(SkillEvidence.skill_id)
        )
        for sk_id, count in (await db.execute(se_stmt)).all():
            results[sk_id]["skill_evidence"] = count

        # 7. Writing evaluations
        we_stmt = (
            select(
                WritingCorrectionSkill.skill_id,
                func.count(WritingCorrectionSkill.id),
            )
            .where(WritingCorrectionSkill.skill_id.in_(unique_ids))
            .group_by(WritingCorrectionSkill.skill_id)
        )
        for sk_id, count in (await db.execute(we_stmt)).all():
            results[sk_id]["writing_evaluations"] = count

        # 8. Speaking evaluations
        spe_stmt = (
            select(
                SpeakingEvaluationSkill.skill_id,
                func.count(SpeakingEvaluationSkill.id),
            )
            .where(SpeakingEvaluationSkill.skill_id.in_(unique_ids))
            .group_by(SpeakingEvaluationSkill.skill_id)
        )
        for sk_id, count in (await db.execute(spe_stmt)).all():
            results[sk_id]["speaking_evaluations"] = count

        output: dict[uuid.UUID, SkillUsageCounts] = {}
        for sk_id in unique_ids:
            counts = results[sk_id]
            total_deps = (
                counts["questions"]
                + counts["exercises"]
                + counts["assessments"]
                + counts["student_mastery"]
                + counts["skill_assessments"]
                + counts["skill_evidence"]
                + counts["writing_evaluations"]
                + counts["speaking_evaluations"]
            )
            output[sk_id] = SkillUsageCounts(
                questions=counts["questions"],
                exercises=counts["exercises"],
                assessments=counts["assessments"],
                student_mastery=counts["student_mastery"],
                skill_assessments=counts["skill_assessments"],
                skill_evidence=counts["skill_evidence"],
                writing_evaluations=counts["writing_evaluations"],
                speaking_evaluations=counts["speaking_evaluations"],
                total_dependencies=total_deps,
            )

        return output

    # ---------------------------------------------------------------------------
    # Taxonomy Versions
    # ---------------------------------------------------------------------------

    @staticmethod
    async def list_versions(db: AsyncSession) -> list[TaxonomyVersionResponse]:
        """List all taxonomy versions with annotated skill count."""
        stmt = select(TaxonomyVersion).order_by(TaxonomyVersion.created_at.desc())
        versions = list((await db.execute(stmt)).scalars().all())

        if not versions:
            return []

        # Count skills per version in a single query
        version_ids = [v.id for v in versions]
        count_stmt = (
            select(Skill.taxonomy_version_id, func.count(Skill.id))
            .where(Skill.taxonomy_version_id.in_(version_ids))
            .group_by(Skill.taxonomy_version_id)
        )
        skill_counts = dict((await db.execute(count_stmt)).all())

        return [
            TaxonomyVersionResponse(
                id=v.id,
                version=v.version,
                name=v.name,
                status=v.status,
                description=v.description,
                activated_at=v.activated_at,
                archived_at=v.archived_at,
                created_at=v.created_at,
                updated_at=v.updated_at,
                skill_count=skill_counts.get(v.id, 0),
            )
            for v in versions
        ]

    @staticmethod
    async def get_active_version(db: AsyncSession) -> TaxonomyVersion:
        """Retrieve the currently active taxonomy version or the default fallback."""
        stmt = (
            select(TaxonomyVersion)
            .where(TaxonomyVersion.status == TaxonomyLifecycleStatus.ACTIVE)
            .order_by(TaxonomyVersion.created_at.desc())
            .limit(1)
        )
        active = (await db.execute(stmt)).scalar_one_or_none()
        if active:
            return active

        # Fallback to the latest version
        fallback_stmt = select(TaxonomyVersion).order_by(TaxonomyVersion.created_at.desc()).limit(1)
        fallback = (await db.execute(fallback_stmt)).scalar_one_or_none()
        if not fallback:
            # Create standard default version if missing
            fallback = TaxonomyVersion(
                version="2.0.0",
                name="TEF Official Framework 2026",
                status=TaxonomyLifecycleStatus.ACTIVE,
                description="Canonical TEF Canada / TEF IRN competency framework",
                activated_at=datetime.datetime.now(datetime.UTC),
            )
            db.add(fallback)
            await db.flush()
        return fallback

    @staticmethod
    async def create_version(
        db: AsyncSession,
        payload: TaxonomyVersionCreate,
        actor_id: uuid.UUID | None = None,
    ) -> TaxonomyVersion:
        """Create a new taxonomy version snapshot."""
        existing = await db.scalar(select(TaxonomyVersion).where(TaxonomyVersion.version == payload.version.strip()))
        if existing:
            raise AppException(f"Taxonomy version '{payload.version}' already exists", status_code=400)

        now = datetime.datetime.now(datetime.UTC)
        version = TaxonomyVersion(
            version=payload.version.strip(),
            name=payload.name.strip(),
            description=payload.description.strip() if payload.description else None,
            status=payload.status,
            activated_at=now if payload.status == TaxonomyLifecycleStatus.ACTIVE else None,
        )
        db.add(version)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.CREATE,
            entity_type="taxonomy_version",
            entity_id=version.id,
            payload={"version": version.version, "name": version.name, "status": version.status.value},
        )
        return version

    @staticmethod
    async def update_version(
        db: AsyncSession,
        version_id: uuid.UUID,
        payload: TaxonomyVersionUpdate,
        actor_id: uuid.UUID | None = None,
    ) -> TaxonomyVersion:
        """Update metadata or status of a taxonomy version."""
        version = await db.get(TaxonomyVersion, version_id)
        if not version:
            raise AppException("Taxonomy version not found", status_code=404)

        now = datetime.datetime.now(datetime.UTC)
        if payload.name is not None:
            version.name = payload.name.strip()
        if payload.description is not None:
            version.description = payload.description.strip() if payload.description else None
        if payload.status is not None:
            if payload.status == TaxonomyLifecycleStatus.ACTIVE and version.status != TaxonomyLifecycleStatus.ACTIVE:
                # Mark other active versions as deprecated
                deprecate_stmt = (
                    select(TaxonomyVersion)
                    .where(TaxonomyVersion.status == TaxonomyLifecycleStatus.ACTIVE, TaxonomyVersion.id != version.id)
                )
                other_actives = (await db.execute(deprecate_stmt)).scalars().all()
                for other in other_actives:
                    other.status = TaxonomyLifecycleStatus.DEPRECATED
                version.activated_at = now
            elif payload.status == TaxonomyLifecycleStatus.ARCHIVED:
                version.archived_at = now
            version.status = payload.status

        await db.flush()
        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.UPDATE,
            entity_type="taxonomy_version",
            entity_id=version.id,
            payload={"version": version.version, "status": version.status.value},
        )
        return version

    # ---------------------------------------------------------------------------
    # Taxonomy Metadata & Metrics
    # ---------------------------------------------------------------------------

    @staticmethod
    async def get_metadata(db: AsyncSession) -> TaxonomyMetadataResponse:
        """Retrieve taxonomy dimensions, active domains, relation types, and summary counts."""
        active_version = await TaxonomyService.get_active_version(db)

        # Distinct domains in DB
        domain_stmt = select(func.distinct(Skill.domain)).where(Skill.domain.is_not(None)).order_by(Skill.domain)
        domains = list((await db.execute(domain_stmt)).scalars().all())

        # Total skills & breakdown
        total_skills_stmt = select(func.count(Skill.id))
        total_skills = (await db.scalar(total_skills_stmt)) or 0

        total_roots_stmt = select(func.count(Skill.id)).where(Skill.parent_id.is_(None))
        total_roots = (await db.scalar(total_roots_stmt)) or 0

        total_subskills_stmt = select(func.count(Skill.id)).where(Skill.parent_id.is_not(None))
        total_subskills = (await db.scalar(total_subskills_stmt)) or 0

        active_stmt = select(func.count(Skill.id)).where(Skill.is_active.is_(True))
        active_skills = (await db.scalar(active_stmt)) or 0

        archived_skills = total_skills - active_skills

        # Dimension breakdown
        dim_stmt = select(Skill.dimension, func.count(Skill.id)).group_by(Skill.dimension)
        dimensions_breakdown = {
            (d.value if hasattr(d, "value") else str(d)): cnt
            for d, cnt in (await db.execute(dim_stmt)).all()
        }

        # Domain breakdown
        dom_stmt = select(Skill.domain, func.count(Skill.id)).group_by(Skill.domain)
        domains_breakdown = {dom: cnt for dom, cnt in (await db.execute(dom_stmt)).all()}

        # Total relations & descriptors
        rel_stmt = select(func.count(SkillRelation.id))
        total_relations = (await db.scalar(rel_stmt)) or 0

        desc_stmt = select(func.count(SkillLevelDescriptor.id))
        total_descriptors = (await db.scalar(desc_stmt)) or 0

        metrics = TaxonomyMetricsSummary(
            total_skills=total_skills,
            total_subskills=total_subskills,
            total_competencies=total_roots,
            dimensions_breakdown=dimensions_breakdown,
            domains_breakdown=domains_breakdown,
            active_skills=active_skills,
            archived_skills=archived_skills,
            total_relations=total_relations,
            total_descriptors=total_descriptors,
        )

        active_version_resp = None
        if active_version:
            # Count skills in this version
            v_cnt = (
                await db.scalar(select(func.count(Skill.id)).where(Skill.taxonomy_version_id == active_version.id))
            ) or 0
            active_version_resp = TaxonomyVersionResponse(
                id=active_version.id,
                version=active_version.version,
                name=active_version.name,
                status=active_version.status,
                description=active_version.description,
                activated_at=active_version.activated_at,
                archived_at=active_version.archived_at,
                created_at=active_version.created_at,
                updated_at=active_version.updated_at,
                skill_count=v_cnt,
            )

        return TaxonomyMetadataResponse(
            dimensions=[d.value for d in SkillDimension],
            domains=domains,
            relation_types=[r.value for r in SkillRelationType],
            cefr_bands=[b.value for b in CEFRBand],
            active_version=active_version_resp,
            metrics=metrics,
        )

    # ---------------------------------------------------------------------------
    # Hierarchical Taxonomy Tree (Batch-optimized)
    # ---------------------------------------------------------------------------

    @staticmethod
    async def get_taxonomy_tree(
        db: AsyncSession,
        version_id: uuid.UUID | None = None,
        dimension: SkillDimension | None = None,
        domain: str | None = None,
        is_active: bool | None = True,
    ) -> list[TaxonomyTreeNodeResponse]:
        """Load entire competency tree with nested children, descriptors, and batch usage counts."""
        stmt = select(Skill).options(selectinload(Skill.level_descriptors))

        if version_id is not None:
            stmt = stmt.where(Skill.taxonomy_version_id == version_id)
        if dimension is not None:
            stmt = stmt.where(Skill.dimension == dimension)
        if domain and domain.strip():
            stmt = stmt.where(Skill.domain == domain.strip())
        if is_active is not None:
            stmt = stmt.where(Skill.is_active == is_active)

        stmt = stmt.order_by(Skill.name.asc())
        skills = list((await db.execute(stmt)).scalars().all())

        if not skills:
            return []

        # Zero N+1: Batch get usage counts for all skills in one round
        usage_map = await TaxonomyService.batch_get_skill_usage(db, [s.id for s in skills])

        # Separate roots and children in memory
        skills_by_id = {s.id: s for s in skills}
        children_by_parent: dict[uuid.UUID, list[Skill]] = defaultdict(list)
        root_skills: list[Skill] = []

        for s in skills:
            if s.parent_id and s.parent_id in skills_by_id:
                children_by_parent[s.parent_id].append(s)
            elif s.parent_id is None:
                root_skills.append(s)
            else:
                # Skill has parent_id outside the filtered set; treat as root node
                root_skills.append(s)

        def build_node(sk: Skill) -> TaxonomyTreeNodeResponse:
            child_skills = children_by_parent.get(sk.id, [])
            child_nodes = [build_node(c) for c in child_skills]
            descriptors = [
                SkillLevelDescriptorResponse.model_validate(desc)
                for desc in (sk.level_descriptors or [])
            ]
            descriptors.sort(key=lambda d: ["A1", "A2", "B1", "B2", "C1", "C2"].index(d.level) if d.level in ["A1", "A2", "B1", "B2", "C1", "C2"] else 99)

            return TaxonomyTreeNodeResponse(
                id=sk.id,
                code=sk.code,
                name=sk.name,
                dimension=sk.dimension,
                domain=sk.domain,
                category=sk.category.value if hasattr(sk.category, "value") and sk.category else (str(sk.category) if sk.category else None),
                description=sk.description,
                parent_id=sk.parent_id,
                is_active=sk.is_active,
                children=child_nodes,
                level_descriptors=descriptors,
                usage_counts=usage_map.get(sk.id, SkillUsageCounts()),
            )

        return [build_node(root) for root in root_skills]

    # ---------------------------------------------------------------------------
    # Task Types Management
    # ---------------------------------------------------------------------------

    @staticmethod
    async def list_task_types(
        db: AsyncSession,
        modality: str | None = None,
        is_active: bool | None = None,
    ) -> list[TaskTypeResponse]:
        """List assessment task types decoupled from competencies."""
        stmt = select(TaskType)
        if modality and modality.strip():
            stmt = stmt.where(TaskType.modality == modality.strip().lower())
        if is_active is not None:
            stmt = stmt.where(TaskType.is_active == is_active)
        stmt = stmt.order_by(TaskType.modality.asc(), TaskType.name.asc())

        items = list((await db.execute(stmt)).scalars().all())
        return [TaskTypeResponse.model_validate(item) for item in items]

    @staticmethod
    async def get_task_type(db: AsyncSession, task_type_id: uuid.UUID) -> TaskTypeResponse:
        """Retrieve task type details."""
        item = await db.get(TaskType, task_type_id)
        if not item:
            raise AppException("Task type not found", status_code=404)
        return TaskTypeResponse.model_validate(item)

    @staticmethod
    async def create_task_type(
        db: AsyncSession,
        payload: TaskTypeCreate,
        actor_id: uuid.UUID | None = None,
    ) -> TaskTypeResponse:
        """Create a new exam task type."""
        code = payload.code.strip().upper()
        existing = await db.scalar(select(TaskType).where(TaskType.code == code))
        if existing:
            raise AppException(f"Task type with code '{code}' already exists", status_code=400)

        item = TaskType(
            modality=payload.modality.strip().lower(),
            code=code,
            name=payload.name.strip(),
            description=payload.description.strip() if payload.description else None,
            is_active=payload.is_active,
        )
        db.add(item)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.CREATE,
            entity_type="task_type",
            entity_id=item.id,
            payload={"code": item.code, "name": item.name, "modality": item.modality},
        )
        return TaskTypeResponse.model_validate(item)

    @staticmethod
    async def update_task_type(
        db: AsyncSession,
        task_type_id: uuid.UUID,
        payload: TaskTypeUpdate,
        actor_id: uuid.UUID | None = None,
    ) -> TaskTypeResponse:
        """Update an existing task type."""
        item = await db.get(TaskType, task_type_id)
        if not item:
            raise AppException("Task type not found", status_code=404)

        if payload.modality is not None:
            item.modality = payload.modality.strip().lower()
        if payload.name is not None:
            item.name = payload.name.strip()
        if payload.description is not None:
            item.description = payload.description.strip() if payload.description else None
        if payload.is_active is not None:
            item.is_active = payload.is_active

        await db.flush()
        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.UPDATE,
            entity_type="task_type",
            entity_id=item.id,
            payload={"code": item.code, "name": item.name},
        )
        return TaskTypeResponse.model_validate(item)

    @staticmethod
    async def delete_task_type(
        db: AsyncSession,
        task_type_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> None:
        """Delete task type if safe."""
        item = await db.get(TaskType, task_type_id)
        if not item:
            raise AppException("Task type not found", status_code=404)

        await db.delete(item)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.DELETE,
            entity_type="task_type",
            entity_id=task_type_id,
            payload={"code": item.code},
        )

    # ---------------------------------------------------------------------------
    # Skills Listing (Server-side Paginated, Search, Filters, Sorting)
    # ---------------------------------------------------------------------------

    @staticmethod
    async def list_skills(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        q: str | None = None,
        dimension: SkillDimension | None = None,
        domain: str | None = None,
        is_active: bool | None = None,
        parent_id: uuid.UUID | None = None,
        roots_only: bool = False,
        sort_by: str = "name",
        sort_dir: str = "asc",
    ) -> TaxonomySkillListResponse:
        """List skills with server-side pagination, sorting, search, filtering, and Zero N+1 usage counts."""
        stmt = select(Skill)

        if roots_only:
            stmt = stmt.where(Skill.parent_id.is_(None))
        elif parent_id is not None:
            stmt = stmt.where(Skill.parent_id == parent_id)

        if q and q.strip():
            pat = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Skill.name.ilike(pat),
                    Skill.code.ilike(pat),
                    Skill.description.ilike(pat),
                )
            )

        if dimension is not None:
            stmt = stmt.where(Skill.dimension == dimension)

        if domain and domain.strip():
            stmt = stmt.where(Skill.domain == domain.strip())

        if is_active is not None:
            stmt = stmt.where(Skill.is_active == is_active)

        # Count query
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await db.scalar(count_stmt)) or 0

        # Sorting
        sort_column = Skill.name
        if sort_by == "code":
            sort_column = Skill.code
        elif sort_by == "domain":
            sort_column = Skill.domain
        elif sort_by == "dimension":
            sort_column = Skill.dimension
        elif sort_by == "created_at":
            sort_column = Skill.created_at

        if sort_dir.lower() == "desc":
            stmt = stmt.order_by(sort_column.desc())
        else:
            stmt = stmt.order_by(sort_column.asc())

        # Pagination slice
        offset = (page - 1) * page_size
        stmt = stmt.offset(offset).limit(page_size)

        skills = list((await db.execute(stmt)).scalars().all())

        if not skills:
            return TaxonomySkillListResponse(
                items=[],
                total=total,
                page=page,
                page_size=page_size,
                total_pages=(total + page_size - 1) // page_size if page_size > 0 else 0,
            )

        skill_ids = [s.id for s in skills]

        # Zero N+1: Batch get usage counts for page items
        usage_map = await TaxonomyService.batch_get_skill_usage(db, skill_ids)

        # Count subskills for each skill in page in 1 query
        child_count_stmt = (
            select(Skill.parent_id, func.count(Skill.id))
            .where(Skill.parent_id.in_(skill_ids))
            .group_by(Skill.parent_id)
        )
        child_counts = dict((await db.execute(child_count_stmt)).all())

        items = [
            TaxonomySkillListItemResponse(
                id=s.id,
                taxonomy_version_id=s.taxonomy_version_id,
                code=s.code,
                name=s.name,
                dimension=s.dimension,
                domain=s.domain,
                category=s.category.value if hasattr(s.category, "value") and s.category else (str(s.category) if s.category else None),
                description=s.description,
                parent_id=s.parent_id,
                is_active=s.is_active,
                created_at=s.created_at,
                updated_at=s.updated_at,
                subskill_count=child_counts.get(s.id, 0),
                usage_counts=usage_map.get(s.id, SkillUsageCounts()),
            )
            for s in skills
        ]

        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        return TaxonomySkillListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    # ---------------------------------------------------------------------------
    # Skill Detail
    # ---------------------------------------------------------------------------

    @staticmethod
    async def get_skill_detail(db: AsyncSession, skill_id: uuid.UUID) -> TaxonomySkillDetailResponse:
        """Retrieve full skill graph node details, including relations, descriptors, and usage stats."""
        stmt = (
            select(Skill)
            .options(
                selectinload(Skill.parent),
                selectinload(Skill.subskills),
                selectinload(Skill.level_descriptors),
                selectinload(Skill.outgoing_relations).joinedload(SkillRelation.to_skill),
                selectinload(Skill.incoming_relations).joinedload(SkillRelation.from_skill),
                selectinload(Skill.modalities),
                selectinload(Skill.aliases),
            )
            .where(Skill.id == skill_id)
        )
        skill = (await db.execute(stmt)).scalar_one_or_none()
        if not skill:
            raise AppException("Skill not found in taxonomy", status_code=404)

        usage_map = await TaxonomyService.batch_get_skill_usage(db, [skill.id])
        usage = usage_map.get(skill.id, SkillUsageCounts())

        parent_summary = None
        if skill.parent:
            parent_summary = AdminSkillSummaryResponse(
                id=skill.parent.id,
                code=skill.parent.code,
                name=skill.parent.name,
                dimension=skill.parent.dimension,
                domain=skill.parent.domain,
                category=skill.parent.category.value if hasattr(skill.parent.category, "value") and skill.parent.category else (str(skill.parent.category) if skill.parent.category else None),
                is_active=skill.parent.is_active,
            )

        children_summaries = [
            AdminSkillSummaryResponse(
                id=c.id,
                code=c.code,
                name=c.name,
                dimension=c.dimension,
                domain=c.domain,
                category=c.category.value if hasattr(c.category, "value") and c.category else (str(c.category) if c.category else None),
                is_active=c.is_active,
            )
            for c in (skill.subskills or [])
        ]

        descriptors = [
            SkillLevelDescriptorResponse.model_validate(desc)
            for desc in (skill.level_descriptors or [])
        ]
        descriptors.sort(key=lambda d: ["A1", "A2", "B1", "B2", "C1", "C2"].index(d.level) if d.level in ["A1", "A2", "B1", "B2", "C1", "C2"] else 99)

        outgoing = [
            SkillRelationResponse(
                id=rel.id,
                from_skill_id=rel.from_skill_id,
                to_skill_id=rel.to_skill_id,
                relation_type=rel.relation_type,
                target_skill_code=rel.to_skill.code if rel.to_skill else None,
                target_skill_name=rel.to_skill.name if rel.to_skill else None,
                target_skill_dimension=rel.to_skill.dimension.value if rel.to_skill else None,
                created_at=rel.created_at,
            )
            for rel in (skill.outgoing_relations or [])
        ]

        incoming = [
            SkillRelationResponse(
                id=rel.id,
                from_skill_id=rel.from_skill_id,
                to_skill_id=rel.to_skill_id,
                relation_type=rel.relation_type,
                target_skill_code=rel.from_skill.code if rel.from_skill else None,
                target_skill_name=rel.from_skill.name if rel.from_skill else None,
                target_skill_dimension=rel.from_skill.dimension.value if rel.from_skill else None,
                created_at=rel.created_at,
            )
            for rel in (skill.incoming_relations or [])
        ]

        modalities = [
            SkillModalityResponse.model_validate(m)
            for m in (skill.modalities or [])
        ]
        aliases = [
            SkillAliasResponse.model_validate(a)
            for a in (skill.aliases or [])
        ]

        return TaxonomySkillDetailResponse(
            id=skill.id,
            taxonomy_version_id=skill.taxonomy_version_id,
            code=skill.code,
            name=skill.name,
            dimension=skill.dimension,
            domain=skill.domain,
            category=skill.category.value if hasattr(skill.category, "value") and skill.category else (str(skill.category) if skill.category else None),
            description=skill.description,
            parent_id=skill.parent_id,
            is_active=skill.is_active,
            created_at=skill.created_at,
            updated_at=skill.updated_at,
            parent=parent_summary,
            children=children_summaries,
            subskills_legacy=[SubSkillResponse.model_validate(sub) for sub in (skill.subskills or [])],
            level_descriptors=descriptors,
            outgoing_relations=outgoing,
            incoming_relations=incoming,
            modalities=modalities,
            aliases=aliases,
            usage_counts=usage,
        )

    # ---------------------------------------------------------------------------
    # Skill Mutations (Create, Update, Archive, Restore, Delete Safe)
    # ---------------------------------------------------------------------------

    @staticmethod
    def validate_canonical_code(code: str) -> str:
        """Validate and format skill code to canonical convention (lowercase, snake_case)."""
        cleaned = code.strip().lower()
        if not re.match(r"^[a-z0-9]+(?:_[a-z0-9]+)*$", cleaned):
            raise AppException(
                message=f"Skill code '{code}' violates canonical convention. Must be lowercase snake_case (e.g. 'reasoning_locate_information').",
                code="INVALID_SKILL_CODE",
                status_code=400,
            )
        return cleaned

    @staticmethod
    async def create_skill(
        db: AsyncSession,
        payload: TaxonomySkillCreate,
        actor_id: uuid.UUID | None = None,
    ) -> TaxonomySkillDetailResponse:
        """Create a new root or child skill node in the unified taxonomy."""
        code = TaxonomyService.validate_canonical_code(payload.code)
        existing = await db.scalar(select(Skill).where(Skill.code == code))
        if existing:
            raise AppException(f"Skill with code '{code}' already exists", status_code=400)

        # Resolve taxonomy version
        version_id = payload.taxonomy_version_id
        if not version_id:
            active_version = await TaxonomyService.get_active_version(db)
            version_id = active_version.id

        # Verify parent exists if provided
        dimension = payload.dimension
        domain = payload.domain.strip()
        if payload.parent_id:
            parent = await db.get(Skill, payload.parent_id)
            if not parent:
                raise AppException("Parent skill does not exist", status_code=404)
            # Inherit domain and dimension from parent if needed
            dimension = parent.dimension
            domain = parent.domain

        skill = Skill(
            code=code,
            name=payload.name.strip(),
            dimension=dimension,
            domain=domain,
            category=payload.category,
            description=payload.description.strip() if payload.description else None,
            parent_id=payload.parent_id,
            taxonomy_version_id=version_id,
            is_active=payload.is_active,
        )
        db.add(skill)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.CREATE,
            entity_type="skill",
            entity_id=skill.id,
            payload={
                "code": skill.code,
                "name": skill.name,
                "dimension": skill.dimension.value,
                "domain": skill.domain,
                "parent_id": str(skill.parent_id) if skill.parent_id else None,
            },
        )
        return await TaxonomyService.get_skill_detail(db, skill.id)

    @staticmethod
    async def update_skill(
        db: AsyncSession,
        skill_id: uuid.UUID,
        payload: TaxonomySkillUpdate,
        actor_id: uuid.UUID | None = None,
    ) -> TaxonomySkillDetailResponse:
        """Update skill attributes, dimension, domain, or parent with cycle verification."""
        skill = await db.get(Skill, skill_id)
        if not skill:
            raise AppException("Skill not found in taxonomy", status_code=404)

        if payload.code is not None:
            new_code = TaxonomyService.validate_canonical_code(payload.code)
            if new_code != skill.code:
                existing = await db.scalar(select(Skill).where(Skill.code == new_code))
                if existing and existing.id != skill.id:
                    raise AppException(f"Skill code '{new_code}' is already taken", status_code=400)
                skill.code = new_code

        if payload.name is not None:
            skill.name = payload.name.strip()
        if payload.dimension is not None:
            skill.dimension = payload.dimension
        if payload.domain is not None:
            skill.domain = payload.domain.strip()
        if payload.category is not None:
            skill.category = payload.category
        if payload.description is not None:
            skill.description = payload.description.strip() if payload.description else None
        if payload.is_active is not None:
            skill.is_active = payload.is_active

        # Re-parenting check
        if payload.parent_id is not None or "parent_id" in payload.model_fields_set:
            new_parent_id = payload.parent_id
            if new_parent_id == skill.id:
                raise AppException("A skill cannot be its own parent", status_code=400)

            if new_parent_id is not None:
                parent = await db.get(Skill, new_parent_id)
                if not parent:
                    raise AppException("Target parent skill does not exist", status_code=404)

                # Check if target parent is a descendant of skill (cycle prevention)
                curr = parent
                visited = {skill.id}
                while curr and curr.parent_id:
                    if curr.parent_id in visited:
                        raise AppException("Cannot re-parent a skill under one of its own descendants", status_code=400)
                    visited.add(curr.id)
                    curr = await db.get(Skill, curr.parent_id)

                skill.parent_id = new_parent_id
            else:
                # Making skill a root competency
                skill.parent_id = None

        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.UPDATE,
            entity_type="skill",
            entity_id=skill.id,
            payload={"code": skill.code, "name": skill.name, "parent_id": str(skill.parent_id) if skill.parent_id else None},
        )
        return await TaxonomyService.get_skill_detail(db, skill.id)

    @staticmethod
    async def archive_skill(
        db: AsyncSession,
        skill_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> TaxonomySkillDetailResponse:
        """Safely soft-archive a skill node without breaking historical references."""
        skill = await db.get(Skill, skill_id)
        if not skill:
            raise AppException("Skill not found in taxonomy", status_code=404)

        skill.is_active = False
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.ARCHIVE,
            entity_type="skill",
            entity_id=skill.id,
            payload={"code": skill.code, "is_active": False},
        )
        return await TaxonomyService.get_skill_detail(db, skill.id)

    @staticmethod
    async def restore_skill(
        db: AsyncSession,
        skill_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> TaxonomySkillDetailResponse:
        """Restore an archived skill back to active status."""
        skill = await db.get(Skill, skill_id)
        if not skill:
            raise AppException("Skill not found in taxonomy", status_code=404)

        skill.is_active = True
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.UPDATE,
            entity_type="skill",
            entity_id=skill.id,
            payload={"code": skill.code, "is_active": True},
        )
        return await TaxonomyService.get_skill_detail(db, skill.id)

    @staticmethod
    async def delete_skill_safe(
        db: AsyncSession,
        skill_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> None:
        """Hard-delete skill only if ZERO relational dependencies and NO child subskills exist."""
        skill = await db.get(Skill, skill_id)
        if not skill:
            raise AppException("Skill not found in taxonomy", status_code=404)

        # Check child skills
        child_count = (
            await db.scalar(select(func.count(Skill.id)).where(Skill.parent_id == skill_id))
        ) or 0
        if child_count > 0:
            raise AppException(
                f"Cannot delete skill '{skill.code}' because it has {child_count} child subskills. Delete or reassign children first.",
                status_code=400,
            )

        # Check dependencies
        usage_map = await TaxonomyService.batch_get_skill_usage(db, [skill_id])
        usage = usage_map.get(skill_id, SkillUsageCounts())
        if usage.total_dependencies > 0:
            raise AppException(
                f"Cannot delete skill '{skill.code}' with {usage.total_dependencies} active dependencies "
                f"({usage.questions} questions, {usage.exercises} exercises, {usage.student_mastery} student records). "
                "Archive the skill instead to maintain educational history integrity.",
                status_code=400,
            )

        await db.delete(skill)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.DELETE,
            entity_type="skill",
            entity_id=skill_id,
            payload={"code": skill.code, "name": skill.name},
        )

    # ---------------------------------------------------------------------------
    # Child Competencies / Subskills Management
    # ---------------------------------------------------------------------------

    @staticmethod
    async def list_children(
        db: AsyncSession,
        parent_id: uuid.UUID,
        is_active: bool | None = None,
    ) -> list[TaxonomySkillListItemResponse]:
        """List all child subskills for a parent competency."""
        parent = await db.get(Skill, parent_id)
        if not parent:
            raise AppException("Parent skill not found", status_code=404)

        stmt = select(Skill).where(Skill.parent_id == parent_id)
        if is_active is not None:
            stmt = stmt.where(Skill.is_active == is_active)
        stmt = stmt.order_by(Skill.name.asc())

        children = list((await db.execute(stmt)).scalars().all())
        if not children:
            return []

        child_ids = [c.id for c in children]
        usage_map = await TaxonomyService.batch_get_skill_usage(db, child_ids)

        return [
            TaxonomySkillListItemResponse(
                id=c.id,
                taxonomy_version_id=c.taxonomy_version_id,
                code=c.code,
                name=c.name,
                dimension=c.dimension,
                domain=c.domain,
                category=c.category.value if hasattr(c.category, "value") and c.category else (str(c.category) if c.category else None),
                description=c.description,
                parent_id=c.parent_id,
                is_active=c.is_active,
                created_at=c.created_at,
                updated_at=c.updated_at,
                subskill_count=0,
                usage_counts=usage_map.get(c.id, SkillUsageCounts()),
            )
            for c in children
        ]

    @staticmethod
    async def create_child(
        db: AsyncSession,
        parent_id: uuid.UUID,
        payload: TaxonomyChildSkillCreate,
        actor_id: uuid.UUID | None = None,
    ) -> TaxonomySkillDetailResponse:
        """Create a child subskill inheriting dimension, domain, and version from its parent."""
        parent = await db.get(Skill, parent_id)
        if not parent:
            raise AppException("Parent skill not found", status_code=404)

        full_create = TaxonomySkillCreate(
            code=payload.code,
            name=payload.name,
            dimension=payload.dimension or parent.dimension,
            domain=payload.domain or parent.domain,
            category=payload.category or (parent.category.value if hasattr(parent.category, "value") and parent.category else (str(parent.category) if parent.category else None)),
            description=payload.description,
            parent_id=parent_id,
            taxonomy_version_id=parent.taxonomy_version_id,
            is_active=payload.is_active,
        )
        return await TaxonomyService.create_skill(db, full_create, actor_id=actor_id)

    # ---------------------------------------------------------------------------
    # CEFR Level Descriptors
    # ---------------------------------------------------------------------------

    @staticmethod
    async def list_descriptors(
        db: AsyncSession,
        skill_id: uuid.UUID,
    ) -> list[SkillLevelDescriptorResponse]:
        """List pedagogical CEFR descriptors for a skill ordered by CEFR band."""
        skill = await db.get(Skill, skill_id)
        if not skill:
            raise AppException("Skill not found", status_code=404)

        stmt = select(SkillLevelDescriptor).where(SkillLevelDescriptor.skill_id == skill_id)
        items = list((await db.execute(stmt)).scalars().all())
        responses = [SkillLevelDescriptorResponse.model_validate(it) for it in items]
        responses.sort(key=lambda d: ["A1", "A2", "B1", "B2", "C1", "C2"].index(d.level) if d.level in ["A1", "A2", "B1", "B2", "C1", "C2"] else 99)
        return responses

    @staticmethod
    async def get_descriptor(
        db: AsyncSession,
        skill_id: uuid.UUID,
        level: CEFRBand,
    ) -> SkillLevelDescriptorResponse:
        """Retrieve descriptor for a specific CEFR band."""
        stmt = select(SkillLevelDescriptor).where(
            SkillLevelDescriptor.skill_id == skill_id,
            SkillLevelDescriptor.level == level,
        )
        desc = (await db.execute(stmt)).scalar_one_or_none()
        if not desc:
            raise AppException(f"Descriptor for CEFR level '{level.value}' not found on this skill", status_code=404)
        return SkillLevelDescriptorResponse.model_validate(desc)

    @staticmethod
    async def upsert_descriptor(
        db: AsyncSession,
        skill_id: uuid.UUID,
        payload: SkillLevelDescriptorCreate,
        actor_id: uuid.UUID | None = None,
    ) -> SkillLevelDescriptorResponse:
        """Create or update a CEFR can-do statement and evidence guidance."""
        skill = await db.get(Skill, skill_id)
        if not skill:
            raise AppException("Skill not found", status_code=404)

        stmt = select(SkillLevelDescriptor).where(
            SkillLevelDescriptor.skill_id == skill_id,
            SkillLevelDescriptor.level == payload.level,
        )
        desc = (await db.execute(stmt)).scalar_one_or_none()

        action = AuditAction.UPDATE if desc else AuditAction.CREATE
        if desc:
            desc.descriptor = payload.descriptor.strip()
            desc.evidence_guidance = payload.evidence_guidance.strip() if payload.evidence_guidance else None
        else:
            desc = SkillLevelDescriptor(
                skill_id=skill_id,
                level=payload.level,
                descriptor=payload.descriptor.strip(),
                evidence_guidance=payload.evidence_guidance.strip() if payload.evidence_guidance else None,
            )
            db.add(desc)

        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=action,
            entity_type="skill_level_descriptor",
            entity_id=desc.id,
            payload={"skill_id": str(skill_id), "level": payload.level.value},
        )
        return SkillLevelDescriptorResponse.model_validate(desc)

    @staticmethod
    async def delete_descriptor(
        db: AsyncSession,
        skill_id: uuid.UUID,
        level: CEFRBand,
        actor_id: uuid.UUID | None = None,
    ) -> None:
        """Delete CEFR descriptor."""
        stmt = select(SkillLevelDescriptor).where(
            SkillLevelDescriptor.skill_id == skill_id,
            SkillLevelDescriptor.level == level,
        )
        desc = (await db.execute(stmt)).scalar_one_or_none()
        if not desc:
            raise AppException("Descriptor not found", status_code=404)

        await db.delete(desc)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.DELETE,
            entity_type="skill_level_descriptor",
            entity_id=desc.id,
            payload={"skill_id": str(skill_id), "level": level.value},
        )

    # ---------------------------------------------------------------------------
    # Skill Relationships & Graph (Cycle Prevention)
    # ---------------------------------------------------------------------------

    @staticmethod
    async def list_relations(
        db: AsyncSession,
        skill_id: uuid.UUID,
    ) -> SkillRelationsListResponse:
        """List incoming and outgoing directed edges in the learning graph."""
        out_stmt = (
            select(SkillRelation)
            .options(selectinload(SkillRelation.to_skill))
            .where(SkillRelation.from_skill_id == skill_id)
        )
        outgoing = list((await db.execute(out_stmt)).scalars().all())

        in_stmt = (
            select(SkillRelation)
            .options(selectinload(SkillRelation.from_skill))
            .where(SkillRelation.to_skill_id == skill_id)
        )
        incoming = list((await db.execute(in_stmt)).scalars().all())

        return SkillRelationsListResponse(
            outgoing=[
                SkillRelationResponse(
                    id=r.id,
                    from_skill_id=r.from_skill_id,
                    to_skill_id=r.to_skill_id,
                    relation_type=r.relation_type,
                    target_skill_code=r.to_skill.code if r.to_skill else None,
                    target_skill_name=r.to_skill.name if r.to_skill else None,
                    target_skill_dimension=r.to_skill.dimension.value if r.to_skill else None,
                    created_at=r.created_at,
                )
                for r in outgoing
            ],
            incoming=[
                SkillRelationResponse(
                    id=r.id,
                    from_skill_id=r.from_skill_id,
                    to_skill_id=r.to_skill_id,
                    relation_type=r.relation_type,
                    target_skill_code=r.from_skill.code if r.from_skill else None,
                    target_skill_name=r.from_skill.name if r.from_skill else None,
                    target_skill_dimension=r.from_skill.dimension.value if r.from_skill else None,
                    created_at=r.created_at,
                )
                for r in incoming
            ],
        )

    @staticmethod
    async def create_relation(
        db: AsyncSession,
        from_skill_id: uuid.UUID,
        payload: SkillRelationCreate,
        actor_id: uuid.UUID | None = None,
    ) -> SkillRelationResponse:
        """Create a directed dependency edge with cycle detection."""
        to_skill_id = payload.to_skill_id
        if from_skill_id == to_skill_id:
            raise AppException("A skill cannot have a dependency relationship with itself", status_code=400)

        from_skill = await db.get(Skill, from_skill_id)
        if not from_skill:
            raise AppException("Source skill not found", status_code=404)

        to_skill = await db.get(Skill, to_skill_id)
        if not to_skill:
            raise AppException("Target skill not found", status_code=404)

        # Check existing edge
        dup_stmt = select(SkillRelation).where(
            SkillRelation.from_skill_id == from_skill_id,
            SkillRelation.to_skill_id == to_skill_id,
            SkillRelation.relation_type == payload.relation_type,
        )
        if await db.scalar(dup_stmt):
            raise AppException("This relation already exists between these skills", status_code=400)

        # Graph cycle check for PREREQUISITE or DEPENDS_ON
        if payload.relation_type in (SkillRelationType.PREREQUISITE, SkillRelationType.DEPENDS_ON):
            # Check if there is already a directed path from to_skill_id to from_skill_id
            queue = [to_skill_id]
            visited = {to_skill_id}
            depth = 0
            while queue and depth < 30:
                curr_id = queue.pop(0)
                if curr_id == from_skill_id:
                    raise AppException("Cycle detected: this dependency edge creates a circular prerequisite loop", status_code=400)

                edges_stmt = select(SkillRelation.to_skill_id).where(
                    SkillRelation.from_skill_id == curr_id,
                    SkillRelation.relation_type.in_([SkillRelationType.PREREQUISITE, SkillRelationType.DEPENDS_ON]),
                )
                next_nodes = list((await db.execute(edges_stmt)).scalars().all())
                for nxt in next_nodes:
                    if nxt not in visited:
                        visited.add(nxt)
                        queue.append(nxt)
                depth += 1

        relation = SkillRelation(
            from_skill_id=from_skill_id,
            to_skill_id=to_skill_id,
            relation_type=payload.relation_type,
        )
        db.add(relation)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.CREATE,
            entity_type="skill_relation",
            entity_id=relation.id,
            payload={
                "from_skill": from_skill.code,
                "to_skill": to_skill.code,
                "relation_type": payload.relation_type.value,
            },
        )

        return SkillRelationResponse(
            id=relation.id,
            from_skill_id=relation.from_skill_id,
            to_skill_id=relation.to_skill_id,
            relation_type=relation.relation_type,
            target_skill_code=to_skill.code,
            target_skill_name=to_skill.name,
            target_skill_dimension=to_skill.dimension.value,
            created_at=relation.created_at,
        )

    @staticmethod
    async def delete_relation(
        db: AsyncSession,
        relation_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> None:
        """Remove a dependency edge from the learning graph."""
        relation = await db.get(SkillRelation, relation_id)
        if not relation:
            raise AppException("Relation not found", status_code=404)

        await db.delete(relation)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.DELETE,
            entity_type="skill_relation",
            entity_id=relation_id,
            payload={"relation_type": relation.relation_type.value},
        )

    # ---------------------------------------------------------------------------
    # Database Integrity & Sole Source Verification
    # ---------------------------------------------------------------------------

    @staticmethod
    async def verify_canonical_taxonomy_integrity(db: AsyncSession) -> dict[str, Any]:
        """Verify that every active taxonomy competency exists exclusively in canonical skills hierarchy."""
        total_skills = (await db.scalar(select(func.count(Skill.id)))) or 0
        active_skills = (await db.scalar(select(func.count(Skill.id)).where(Skill.is_active.is_(True)))) or 0
        root_skills = (await db.scalar(select(func.count(Skill.id)).where(Skill.parent_id.is_(None)))) or 0
        child_skills = (await db.scalar(select(func.count(Skill.id)).where(Skill.parent_id.is_not(None)))) or 0

        # Check for broken parent references
        orphan_children_stmt = (
            select(Skill.id, Skill.code)
            .where(
                Skill.parent_id.is_not(None),
                ~Skill.parent_id.in_(select(Skill.id)),
            )
        )
        orphan_children = list((await db.execute(orphan_children_stmt)).all())

        # Check legacy sub_skills parity: any row in sub_skills that does not exist in skills
        unmapped_subskills_stmt = (
            select(SubSkill.id, SubSkill.code)
            .where(~SubSkill.id.in_(select(Skill.id)))
        )
        unmapped_subskills = list((await db.execute(unmapped_subskills_stmt)).all())

        # Check tagging foreign keys: question tags without valid skill
        broken_q_tags_stmt = (
            select(QuestionSkillTag.id)
            .where(
                ~QuestionSkillTag.skill_id.in_(select(Skill.id))
                | (QuestionSkillTag.subskill_id.is_not(None) & ~QuestionSkillTag.subskill_id.in_(select(Skill.id)))
            )
        )
        broken_q_tags = list((await db.execute(broken_q_tags_stmt)).all())

        # Check exercise tagging foreign keys
        broken_ex_tags_stmt = (
            select(ExerciseSkill.id)
            .where(
                ~ExerciseSkill.skill_id.in_(select(Skill.id))
                | (ExerciseSkill.subskill_id.is_not(None) & ~ExerciseSkill.subskill_id.in_(select(Skill.id)))
            )
        )
        broken_ex_tags = list((await db.execute(broken_ex_tags_stmt)).all())

        is_valid = (
            len(orphan_children) == 0
            and len(unmapped_subskills) == 0
            and len(broken_q_tags) == 0
            and len(broken_ex_tags) == 0
        )

        return {
            "is_valid": is_valid,
            "total_skills": total_skills,
            "active_skills": active_skills,
            "root_skills": root_skills,
            "child_skills": child_skills,
            "orphan_children_count": len(orphan_children),
            "unmapped_legacy_subskills_count": len(unmapped_subskills),
            "broken_question_tags_count": len(broken_q_tags),
            "broken_exercise_tags_count": len(broken_ex_tags),
            "canonical_sole_source": is_valid,
        }

    # ---------------------------------------------------------------------------
    # Relational Taxonomy Metadata & Aliases (F-06, F-10, F-15)
    # ---------------------------------------------------------------------------

    @classmethod
    async def resolve_skill_by_code_or_alias(
        cls,
        db: AsyncSession,
        identifier: str,
        taxonomy_version_id: uuid.UUID | None = None,
    ) -> Skill | None:
        """Resolve a competency by canonical code or registered legacy alias with version-scoping."""
        if not identifier or not identifier.strip():
            return None
        target = identifier.strip().lower()

        # If taxonomy_version_id is provided, search within that version first
        if taxonomy_version_id is not None:
            skill = await db.scalar(
                select(Skill).where(
                    Skill.taxonomy_version_id == taxonomy_version_id,
                    Skill.code == target,
                )
            )
            if skill:
                return skill

            skill = await db.scalar(
                select(Skill).where(
                    Skill.taxonomy_version_id == taxonomy_version_id,
                    func.lower(Skill.code) == target,
                )
            )
            if skill:
                return skill

            alias_stmt = (
                select(Skill)
                .join(SkillAlias, SkillAlias.skill_id == Skill.id)
                .where(
                    Skill.taxonomy_version_id == taxonomy_version_id,
                    func.lower(SkillAlias.alias_code) == target,
                )
            )
            skill = await db.scalar(alias_stmt)
            if skill:
                return skill

        # If not found or taxonomy_version_id was not provided, check the active taxonomy version
        active_ver = await cls.get_active_version(db)
        if active_ver and (taxonomy_version_id is None or active_ver.id != taxonomy_version_id):
            skill = await db.scalar(
                select(Skill).where(
                    Skill.taxonomy_version_id == active_ver.id,
                    func.lower(Skill.code) == target,
                )
            )
            if skill:
                return skill

            alias_stmt = (
                select(Skill)
                .join(SkillAlias, SkillAlias.skill_id == Skill.id)
                .where(
                    Skill.taxonomy_version_id == active_ver.id,
                    func.lower(SkillAlias.alias_code) == target,
                )
            )
            skill = await db.scalar(alias_stmt)
            if skill:
                return skill

        # Global fallback (any version, prioritizing active skills and latest versions)
        skill = await db.scalar(
            select(Skill)
            .where(func.lower(Skill.code) == target)
            .order_by(Skill.is_active.desc(), Skill.created_at.desc())
        )
        if skill:
            return skill

        alias_stmt = (
            select(Skill)
            .join(SkillAlias, SkillAlias.skill_id == Skill.id)
            .where(func.lower(SkillAlias.alias_code) == target)
            .order_by(Skill.is_active.desc(), Skill.created_at.desc())
        )
        return await db.scalar(alias_stmt)

    @classmethod
    async def resolve_active_successor(
        cls,
        db: AsyncSession,
        skill_id: uuid.UUID,
    ) -> list[Skill]:
        """Resolve active canonical successor skill(s) through migration relation edges."""
        skill = await db.get(Skill, skill_id)
        if not skill:
            return []

        active_ver = await cls.get_active_version(db)
        if skill.is_active and (active_ver is None or skill.taxonomy_version_id == active_ver.id):
            return [skill]

        # 1. Traverse explicit replacement, split, or merge relations
        stmt = (
            select(Skill)
            .join(SkillRelation, SkillRelation.to_skill_id == Skill.id)
            .where(
                SkillRelation.from_skill_id == skill_id,
                SkillRelation.relation_type.in_(
                    [
                        SkillRelationType.REPLACED_BY,
                        SkillRelationType.SPLIT_INTO,
                        SkillRelationType.MERGED_INTO,
                    ]
                ),
            )
        )
        successors = list((await db.execute(stmt)).scalars().all())
        if successors:
            return successors

        # 2. Match active skill with the same code in active version
        if active_ver:
            active_counterpart = await db.scalar(
                select(Skill).where(
                    Skill.taxonomy_version_id == active_ver.id,
                    Skill.code == skill.code,
                    Skill.is_active.is_(True),
                )
            )
            if active_counterpart:
                return [active_counterpart]

        # 3. Retain historical identity
        return [skill]

    @classmethod
    async def record_skill_replacement(
        cls,
        db: AsyncSession,
        old_skill_id: uuid.UUID,
        new_skill_id: uuid.UUID,
        notes: str | None = None,
    ) -> SkillRelation:
        """Record that old_skill was replaced by new_skill."""
        old_skill = await db.get(Skill, old_skill_id)
        new_skill = await db.get(Skill, new_skill_id)
        if not old_skill or not new_skill:
            raise AppException("Source or target skill not found", status_code=404)

        existing = await db.scalar(
            select(SkillRelation).where(
                SkillRelation.from_skill_id == old_skill_id,
                SkillRelation.to_skill_id == new_skill_id,
                SkillRelation.relation_type == SkillRelationType.REPLACED_BY,
            )
        )
        if not existing:
            existing = SkillRelation(
                from_skill_id=old_skill_id,
                to_skill_id=new_skill_id,
                relation_type=SkillRelationType.REPLACED_BY,
                created_at=datetime.datetime.now(datetime.UTC),
            )
            db.add(existing)

        old_skill.is_active = False

        if old_skill.code != new_skill.code:
            await cls.register_skill_alias(
                db=db,
                skill_id=new_skill_id,
                alias_code=old_skill.code,
                notes=f"Replaced {old_skill.code} with {new_skill.code}",
            )

        mig_rec = await db.scalar(
            select(TaxonomyMigrationRecord).where(
                TaxonomyMigrationRecord.source_table == "skills",
                TaxonomyMigrationRecord.source_id == old_skill_id,
            )
        )
        if not mig_rec:
            mig_rec = TaxonomyMigrationRecord(
                source_table="skills",
                source_id=old_skill_id,
                source_code=old_skill.code,
                source_name=old_skill.name,
                target_skill_id=new_skill_id,
                status=TaxonomyMigrationStatus.MIGRATED,
                migration_type="replaced_by",
                notes=notes,
            )
            db.add(mig_rec)
        else:
            mig_rec.target_skill_id = new_skill_id
            mig_rec.status = TaxonomyMigrationStatus.MIGRATED
            mig_rec.migration_type = "replaced_by"
            mig_rec.notes = notes

        await db.flush()
        return existing

    @classmethod
    async def record_skill_split(
        cls,
        db: AsyncSession,
        old_skill_id: uuid.UUID,
        target_skill_ids: list[uuid.UUID],
        notes: str | None = None,
    ) -> list[SkillRelation]:
        """Record that old_skill was split into multiple finer-grained skills."""
        old_skill = await db.get(Skill, old_skill_id)
        if not old_skill:
            raise AppException("Old skill not found", status_code=404)

        relations: list[SkillRelation] = []
        for tid in target_skill_ids:
            target = await db.get(Skill, tid)
            if not target:
                continue
            existing = await db.scalar(
                select(SkillRelation).where(
                    SkillRelation.from_skill_id == old_skill_id,
                    SkillRelation.to_skill_id == tid,
                    SkillRelation.relation_type == SkillRelationType.SPLIT_INTO,
                )
            )
            if not existing:
                existing = SkillRelation(
                    from_skill_id=old_skill_id,
                    to_skill_id=tid,
                    relation_type=SkillRelationType.SPLIT_INTO,
                    created_at=datetime.datetime.now(datetime.UTC),
                )
                db.add(existing)
            relations.append(existing)

        old_skill.is_active = False

        target_summary = f"Split into {len(target_skill_ids)} skills: {[str(t) for t in target_skill_ids]}"
        mig_rec = await db.scalar(
            select(TaxonomyMigrationRecord).where(
                TaxonomyMigrationRecord.source_table == "skills",
                TaxonomyMigrationRecord.source_id == old_skill_id,
            )
        )
        if not mig_rec:
            mig_rec = TaxonomyMigrationRecord(
                source_table="skills",
                source_id=old_skill_id,
                source_code=old_skill.code,
                source_name=old_skill.name,
                target_skill_id=target_skill_ids[0] if target_skill_ids else None,
                status=TaxonomyMigrationStatus.MIGRATED,
                migration_type="split_into",
                notes=f"{notes or ''} | {target_summary}".strip(" |"),
            )
            db.add(mig_rec)
        else:
            mig_rec.status = TaxonomyMigrationStatus.MIGRATED
            mig_rec.migration_type = "split_into"
            mig_rec.notes = f"{notes or ''} | {target_summary}".strip(" |")

        await db.flush()
        return relations

    @classmethod
    async def reconcile_legacy_nodes(cls, db: AsyncSession) -> dict[str, int]:
        """Audit and resolve all legacy skills/subskills with zero silent orphaning.

        Ensures every legacy skill or subskill record ends in one of:
        - MIGRATED (with target_skill_id)
        - DEPRECATED (explicitly retired)
        - UNRESOLVED (flagged for administrator review)
        """
        active_ver = await cls.get_active_version(db)
        stats = {"migrated": 0, "deprecated": 0, "unresolved": 0}

        # 1. Inspect unversioned or historical skills
        historical_skills = (
            await db.execute(
                select(Skill).where(
                    or_(
                        Skill.taxonomy_version_id.is_(None),
                        Skill.taxonomy_version_id != (active_ver.id if active_ver else None),
                    )
                )
            )
        ).scalars().all()

        for h_skill in historical_skills:
            existing_rec = await db.scalar(
                select(TaxonomyMigrationRecord).where(
                    TaxonomyMigrationRecord.source_table == "skills",
                    TaxonomyMigrationRecord.source_id == h_skill.id,
                )
            )
            if existing_rec:
                continue

            active_match = None
            if active_ver:
                active_match = await db.scalar(
                    select(Skill).where(
                        Skill.taxonomy_version_id == active_ver.id,
                        Skill.code == h_skill.code,
                    )
                )

            if active_match:
                rec = TaxonomyMigrationRecord(
                    source_table="skills",
                    source_id=h_skill.id,
                    source_code=h_skill.code,
                    source_name=h_skill.name,
                    target_skill_id=active_match.id,
                    status=TaxonomyMigrationStatus.MIGRATED,
                    migration_type="direct",
                    notes="Direct code alignment with active taxonomy version.",
                )
                stats["migrated"] += 1
            elif not h_skill.is_active:
                rec = TaxonomyMigrationRecord(
                    source_table="skills",
                    source_id=h_skill.id,
                    source_code=h_skill.code,
                    source_name=h_skill.name,
                    target_skill_id=None,
                    status=TaxonomyMigrationStatus.DEPRECATED,
                    migration_type="deprecated",
                    notes="Explicitly archived legacy skill without active counterpart.",
                )
                stats["deprecated"] += 1
            else:
                rec = TaxonomyMigrationRecord(
                    source_table="skills",
                    source_id=h_skill.id,
                    source_code=h_skill.code,
                    source_name=h_skill.name,
                    target_skill_id=None,
                    status=TaxonomyMigrationStatus.UNRESOLVED,
                    migration_type=None,
                    notes="Legacy skill active without active taxonomy counterpart. Requires mapping.",
                )
                stats["unresolved"] += 1
            db.add(rec)

        # 2. Inspect sub_skills table
        subskills = (await db.execute(select(SubSkill))).scalars().all()
        for sub in subskills:
            existing_rec = await db.scalar(
                select(TaxonomyMigrationRecord).where(
                    TaxonomyMigrationRecord.source_table == "sub_skills",
                    TaxonomyMigrationRecord.source_id == sub.id,
                )
            )
            if existing_rec:
                continue

            matching_skill = await db.scalar(select(Skill).where(Skill.id == sub.id))
            if matching_skill:
                rec = TaxonomyMigrationRecord(
                    source_table="sub_skills",
                    source_id=sub.id,
                    source_code=sub.code,
                    source_name=sub.name,
                    target_skill_id=matching_skill.id,
                    status=TaxonomyMigrationStatus.MIGRATED,
                    migration_type="direct_shadow",
                    notes="Migrated from legacy sub_skills to canonical skills table.",
                )
                stats["migrated"] += 1
            else:
                rec = TaxonomyMigrationRecord(
                    source_table="sub_skills",
                    source_id=sub.id,
                    source_code=sub.code,
                    source_name=sub.name,
                    target_skill_id=None,
                    status=TaxonomyMigrationStatus.UNRESOLVED,
                    migration_type=None,
                    notes="SubSkill not found in canonical skills table.",
                )
                stats["unresolved"] += 1
            db.add(rec)

        await db.flush()
        return stats

    @staticmethod
    async def get_skill_modalities(db: AsyncSession, skill_id: uuid.UUID) -> list[str]:
        """Query all exam modalities associated with a competency."""
        stmt = (
            select(SkillModality.modality)
            .where(SkillModality.skill_id == skill_id)
            .order_by(SkillModality.modality)
        )
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def set_skill_modalities(
        db: AsyncSession,
        skill_id: uuid.UUID,
        modalities: list[str],
        primary_modality: str | None = None,
    ) -> list[str]:
        """Set the allowed exam modalities for a skill, replacing existing mappings."""
        skill = await db.get(Skill, skill_id)
        if not skill:
            raise AppException("Skill not found", status_code=404)
        await db.execute(delete(SkillModality).where(SkillModality.skill_id == skill_id))
        now = datetime.datetime.now(datetime.UTC)
        cleaned = [m.strip().lower() for m in modalities if m and m.strip()]
        for m in cleaned:
            db.add(
                SkillModality(
                    skill_id=skill_id,
                    modality=m,
                    is_primary=(m == primary_modality) if primary_modality else True,
                    created_at=now,
                )
            )
        await db.flush()
        return cleaned

    @staticmethod
    async def get_skills_by_modality(
        db: AsyncSession,
        modality: str,
        is_active: bool = True,
    ) -> list[Skill]:
        """Retrieve all skills linked to an exam modality via SkillModality with legacy fallback."""
        target_mod = modality.strip().lower()

        # 1. Query canonical SkillModality table
        stmt = (
            select(Skill)
            .join(SkillModality, SkillModality.skill_id == Skill.id)
            .where(SkillModality.modality == target_mod)
        )
        if is_active is not None:
            stmt = stmt.where(Skill.is_active == is_active)
        stmt = stmt.order_by(SkillModality.is_primary.desc(), Skill.name.asc())
        skills = list((await db.execute(stmt)).scalars().all())
        if skills:
            return skills

        # 2. Fallback to domain/category if skill_modalities not yet populated
        fb_stmt = select(Skill).where(
            or_(
                func.lower(Skill.domain) == target_mod,
                func.lower(cast(Skill.category, String)) == target_mod,
            )
        )
        if is_active is not None:
            fb_stmt = fb_stmt.where(Skill.is_active == is_active)
        fb_stmt = fb_stmt.order_by(Skill.name.asc())
        return list((await db.execute(fb_stmt)).scalars().all())

    @staticmethod
    async def get_task_type_skills(db: AsyncSession, task_type_id: uuid.UUID) -> list[Skill]:
        """Retrieve all skills supported by a task type via TaskTypeSkill."""
        stmt = (
            select(Skill)
            .join(TaskTypeSkill, TaskTypeSkill.skill_id == Skill.id)
            .where(TaskTypeSkill.task_type_id == task_type_id)
            .order_by(Skill.name.asc())
        )
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def add_task_type_skill(
        db: AsyncSession,
        task_type_id: uuid.UUID,
        skill_id: uuid.UUID,
    ) -> TaskTypeSkill:
        """Associate a supported skill with a task type."""
        tt = await db.get(TaskType, task_type_id)
        if not tt:
            raise AppException("Task type not found", status_code=404)
        sk = await db.get(Skill, skill_id)
        if not sk:
            raise AppException("Skill not found", status_code=404)
        existing = await db.scalar(
            select(TaskTypeSkill).where(
                TaskTypeSkill.task_type_id == task_type_id,
                TaskTypeSkill.skill_id == skill_id,
            )
        )
        if existing:
            return existing
        link = TaskTypeSkill(
            task_type_id=task_type_id,
            skill_id=skill_id,
            created_at=datetime.datetime.now(datetime.UTC),
        )
        db.add(link)
        await db.flush()
        return link

    @staticmethod
    async def remove_task_type_skill(
        db: AsyncSession,
        task_type_id: uuid.UUID,
        skill_id: uuid.UUID,
    ) -> bool:
        """Remove a skill relationship from a task type."""
        res = await db.execute(
            delete(TaskTypeSkill).where(
                TaskTypeSkill.task_type_id == task_type_id,
                TaskTypeSkill.skill_id == skill_id,
            )
        )
        await db.flush()
        return bool(res.rowcount and res.rowcount > 0)

    @staticmethod
    async def register_skill_alias(
        db: AsyncSession,
        skill_id: uuid.UUID,
        alias_code: str,
        notes: str | None = None,
    ) -> SkillAlias:
        """Register a legacy alias pointing to a canonical skill."""
        skill = await db.get(Skill, skill_id)
        if not skill:
            raise AppException("Skill not found", status_code=404)
        target_alias = alias_code.strip()
        existing = await db.scalar(select(SkillAlias).where(SkillAlias.alias_code == target_alias))
        if existing:
            if existing.skill_id == skill_id:
                return existing
            raise AppException(f"Alias '{target_alias}' already maps to skill {existing.skill_id}", status_code=400)
        alias = SkillAlias(
            skill_id=skill_id,
            alias_code=target_alias,
            notes=notes,
            created_at=datetime.datetime.now(datetime.UTC),
        )
        db.add(alias)
        await db.flush()
        return alias

    @staticmethod
    async def remove_skill_alias(db: AsyncSession, alias_code: str) -> bool:
        """Remove a registered skill alias."""
        res = await db.execute(delete(SkillAlias).where(SkillAlias.alias_code == alias_code.strip()))
        await db.flush()
        return bool(res.rowcount and res.rowcount > 0)

