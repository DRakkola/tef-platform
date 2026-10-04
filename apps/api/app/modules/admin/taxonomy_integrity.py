"""Taxonomy Integrity Audit Tooling for TEF Platform.

Performs deep integrity verification across:
1. Orphan skills & orphan references
2. Duplicate codes and concepts
3. Archived skills tagged on active/published content
4. Invalid taxonomy relationships and dependency cycles
5. Inactive taxonomy version references on active content
6. Unresolved migration mappings & unaccounted legacy nodes
"""

import uuid
from collections import defaultdict

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.enums import (
    SkillRelationType,
    TaxonomyLifecycleStatus,
    TaxonomyMigrationStatus,
)
from app.modules.admin.models import (
    SkillAlias,
    SkillLevelDescriptor,
    SkillModality,
    SkillRelation,
    TaxonomyMigrationRecord,
    TaxonomyVersion,
)
from app.modules.admin.taxonomy_schemas import (
    TaxonomyIntegrityIssue,
    TaxonomyIntegrityReport,
)
from app.modules.assessments.models import Question, QuestionSkillTag, Skill
from app.modules.learning.models import Exercise, ExerciseSkill
from app.modules.learning.readiness_models import SkillEvidence


class TaxonomyIntegrityChecker:
    """Performs comprehensive repository and database taxonomy integrity audits."""

    @classmethod
    async def run_integrity_check(cls, db: AsyncSession) -> TaxonomyIntegrityReport:
        """Run all taxonomy integrity audits and return an aggregated report."""
        issues: list[TaxonomyIntegrityIssue] = []

        # 1. Orphan skills & parent cycles
        await cls._check_orphan_skills_and_cycles(db, issues)

        # 2. Orphan foreign key references
        await cls._check_orphan_references(db, issues)

        # 3. Duplicate codes and concept collisions
        await cls._check_duplicate_codes_and_concepts(db, issues)

        # 4. Archived skills on active/published content
        await cls._check_archived_skills_on_active_content(db, issues)

        # 5. Invalid taxonomy relationships & cycles
        await cls._check_invalid_relationships(db, issues)

        # 6. Inactive taxonomy version references on active content
        await cls._check_inactive_version_references(db, issues)

        # 7. Unresolved migration mappings
        await cls._check_unresolved_migrations(db, issues)

        error_count = sum(1 for i in issues if i.severity == "error")
        warning_count = sum(1 for i in issues if i.severity == "warning")

        summary_by_category: dict[str, int] = defaultdict(int)
        for issue in issues:
            summary_by_category[issue.category] += 1

        return TaxonomyIntegrityReport(
            is_clean=(error_count == 0),
            total_issues=len(issues),
            error_count=error_count,
            warning_count=warning_count,
            summary_by_category=dict(summary_by_category),
            issues=issues,
        )

    # -------------------------------------------------------------------------
    # 1. Orphan Skills & Hierarchy Cycles
    # -------------------------------------------------------------------------

    @classmethod
    async def _check_orphan_skills_and_cycles(
        cls, db: AsyncSession, issues: list[TaxonomyIntegrityIssue]
    ) -> None:
        # Check skills pointing to a non-existent parent_id
        all_skills = (await db.execute(select(Skill.id, Skill.parent_id, Skill.code))).all()
        skill_ids = {s.id for s in all_skills}
        parent_map: dict[uuid.UUID, uuid.UUID] = {}

        for s_id, p_id, code in all_skills:
            if p_id is not None:
                parent_map[s_id] = p_id
                if p_id not in skill_ids:
                    issues.append(
                        TaxonomyIntegrityIssue(
                            category="orphan_skills",
                            severity="error",
                            message=f"Skill '{code}' ({s_id}) references non-existent parent_id {p_id}.",
                            entity_type="skill",
                            entity_id=str(s_id),
                            details={"parent_id": str(p_id), "code": code},
                        )
                    )

        # Check for cycles in parent hierarchy (e.g. A -> B -> A or self-parenting)
        for s_id, p_id in parent_map.items():
            visited = set()
            curr = s_id
            while curr in parent_map:
                if curr in visited:
                    issues.append(
                        TaxonomyIntegrityIssue(
                            category="orphan_skills",
                            severity="error",
                            message=f"Cycle detected in Skill parent hierarchy involving skill {curr}.",
                            entity_type="skill",
                            entity_id=str(curr),
                            details={"cycle_start": str(s_id)},
                        )
                    )
                    break
                visited.add(curr)
                curr = parent_map[curr]

    # -------------------------------------------------------------------------
    # 2. Orphan References
    # -------------------------------------------------------------------------

    @classmethod
    async def _check_orphan_references(
        cls, db: AsyncSession, issues: list[TaxonomyIntegrityIssue]
    ) -> None:
        skill_ids = set((await db.execute(select(Skill.id))).scalars().all())

        # QuestionSkillTag
        q_tags = (await db.execute(select(QuestionSkillTag.id, QuestionSkillTag.skill_id))).all()
        for tag_id, sk_id in q_tags:
            if sk_id not in skill_ids:
                issues.append(
                    TaxonomyIntegrityIssue(
                        category="orphan_references",
                        severity="error",
                        message=f"QuestionSkillTag {tag_id} references missing skill_id {sk_id}.",
                        entity_type="question_skill_tag",
                        entity_id=str(tag_id),
                        details={"skill_id": str(sk_id)},
                    )
                )

        # ExerciseSkill
        ex_tags = (await db.execute(select(ExerciseSkill.id, ExerciseSkill.skill_id))).all()
        for tag_id, sk_id in ex_tags:
            if sk_id not in skill_ids:
                issues.append(
                    TaxonomyIntegrityIssue(
                        category="orphan_references",
                        severity="error",
                        message=f"ExerciseSkill {tag_id} references missing skill_id {sk_id}.",
                        entity_type="exercise_skill",
                        entity_id=str(tag_id),
                        details={"skill_id": str(sk_id)},
                    )
                )

        # SkillRelation missing endpoints
        relations = (await db.execute(select(SkillRelation.id, SkillRelation.from_skill_id, SkillRelation.to_skill_id))).all()
        for rel_id, f_id, t_id in relations:
            if f_id not in skill_ids:
                issues.append(
                    TaxonomyIntegrityIssue(
                        category="orphan_references",
                        severity="error",
                        message=f"SkillRelation {rel_id} references missing from_skill_id {f_id}.",
                        entity_type="skill_relation",
                        entity_id=str(rel_id),
                        details={"from_skill_id": str(f_id)},
                    )
                )
            if t_id not in skill_ids:
                issues.append(
                    TaxonomyIntegrityIssue(
                        category="orphan_references",
                        severity="error",
                        message=f"SkillRelation {rel_id} references missing to_skill_id {t_id}.",
                        entity_type="skill_relation",
                        entity_id=str(rel_id),
                        details={"to_skill_id": str(t_id)},
                    )
                )

        # SkillLevelDescriptor
        desc_stmt = select(SkillLevelDescriptor.id, SkillLevelDescriptor.skill_id)
        for d_id, sk_id in (await db.execute(desc_stmt)).all():
            if sk_id not in skill_ids:
                issues.append(
                    TaxonomyIntegrityIssue(
                        category="orphan_references",
                        severity="error",
                        message=f"SkillLevelDescriptor {d_id} references missing skill_id {sk_id}.",
                        entity_type="skill_level_descriptor",
                        entity_id=str(d_id),
                        details={"skill_id": str(sk_id)},
                    )
                )

        # SkillModality
        mod_stmt = select(SkillModality.id, SkillModality.skill_id)
        for m_id, sk_id in (await db.execute(mod_stmt)).all():
            if sk_id not in skill_ids:
                issues.append(
                    TaxonomyIntegrityIssue(
                        category="orphan_references",
                        severity="error",
                        message=f"SkillModality {m_id} references missing skill_id {sk_id}.",
                        entity_type="skill_modality",
                        entity_id=str(m_id),
                        details={"skill_id": str(sk_id)},
                    )
                )

        # SkillAlias
        alias_stmt = select(SkillAlias.id, SkillAlias.skill_id, SkillAlias.alias_code)
        for a_id, sk_id, a_code in (await db.execute(alias_stmt)).all():
            if sk_id not in skill_ids:
                issues.append(
                    TaxonomyIntegrityIssue(
                        category="orphan_references",
                        severity="error",
                        message=f"SkillAlias '{a_code}' ({a_id}) references missing skill_id {sk_id}.",
                        entity_type="skill_alias",
                        entity_id=str(a_id),
                        details={"skill_id": str(sk_id), "alias_code": a_code},
                    )
                )

        # SkillEvidence missing taxonomy_version
        version_ids = set((await db.execute(select(TaxonomyVersion.id))).scalars().all())
        ev_stmt = select(SkillEvidence.id, SkillEvidence.skill_id, SkillEvidence.taxonomy_version_id).where(
            SkillEvidence.taxonomy_version_id.is_not(None)
        )
        for ev_id, sk_id, ver_id in (await db.execute(ev_stmt)).all():
            if sk_id not in skill_ids:
                issues.append(
                    TaxonomyIntegrityIssue(
                        category="orphan_references",
                        severity="error",
                        message=f"SkillEvidence {ev_id} references missing skill_id {sk_id}.",
                        entity_type="skill_evidence",
                        entity_id=str(ev_id),
                    )
                )
            if ver_id not in version_ids:
                issues.append(
                    TaxonomyIntegrityIssue(
                        category="orphan_references",
                        severity="error",
                        message=f"SkillEvidence {ev_id} references missing taxonomy_version_id {ver_id}.",
                        entity_type="skill_evidence",
                        entity_id=str(ev_id),
                    )
                )

    # -------------------------------------------------------------------------
    # 3. Duplicate Codes & Concepts
    # -------------------------------------------------------------------------

    @classmethod
    async def _check_duplicate_codes_and_concepts(
        cls, db: AsyncSession, issues: list[TaxonomyIntegrityIssue]
    ) -> None:
        # Check duplicate codes per taxonomy_version
        stmt = (
            select(Skill.taxonomy_version_id, Skill.code, func.count(Skill.id).label("cnt"))
            .group_by(Skill.taxonomy_version_id, Skill.code)
            .having(func.count(Skill.id) > 1)
        )
        for ver_id, code, cnt in (await db.execute(stmt)).all():
            issues.append(
                TaxonomyIntegrityIssue(
                    category="duplicate_codes",
                    severity="error",
                    message=f"Duplicate skill code '{code}' found ({cnt} times) in version {ver_id}.",
                    entity_type="skill",
                    details={"code": code, "taxonomy_version_id": str(ver_id), "count": cnt},
                )
            )

        # Duplicate concept warning: identical names in the same version and dimension
        concept_stmt = (
            select(Skill.taxonomy_version_id, Skill.dimension, Skill.name, func.count(Skill.id).label("cnt"))
            .group_by(Skill.taxonomy_version_id, Skill.dimension, Skill.name)
            .having(func.count(Skill.id) > 1)
        )
        for ver_id, dim, name, cnt in (await db.execute(concept_stmt)).all():
            dim_val = dim.value if hasattr(dim, "value") else str(dim)
            issues.append(
                TaxonomyIntegrityIssue(
                    category="duplicate_codes",
                    severity="warning",
                    message=f"Potential duplicate competency concept '{name}' ({cnt} skills) in dimension '{dim_val}'.",
                    entity_type="skill",
                    details={"name": name, "dimension": dim_val, "taxonomy_version_id": str(ver_id), "count": cnt},
                )
            )

    # -------------------------------------------------------------------------
    # 4. Archived Skills on Active Content
    # -------------------------------------------------------------------------

    @classmethod
    async def _check_archived_skills_on_active_content(
        cls, db: AsyncSession, issues: list[TaxonomyIntegrityIssue]
    ) -> None:
        # Published Questions tagged with inactive skill
        q_stmt = (
            select(QuestionSkillTag.id, Question.id, Question.prompt, Skill.id, Skill.code)
            .join(Question, QuestionSkillTag.question_id == Question.id)
            .join(Skill, QuestionSkillTag.skill_id == Skill.id)
            .where(
                Question.status == "published",
                Skill.is_active.is_(False),
            )
        )
        for tag_id, q_id, prompt, sk_id, sk_code in (await db.execute(q_stmt)).all():
            issues.append(
                TaxonomyIntegrityIssue(
                    category="archived_on_active_content",
                    severity="error",
                    message=(
                        f"Published question {q_id} ('{prompt[:40]}...') is tagged with archived skill "
                        f"'{sk_code}' ({sk_id})."
                    ),
                    entity_type="question_skill_tag",
                    entity_id=str(tag_id),
                    details={"question_id": str(q_id), "skill_id": str(sk_id), "skill_code": sk_code},
                )
            )

        # Published Exercises tagged with inactive skill
        ex_stmt = (
            select(ExerciseSkill.id, Exercise.id, Exercise.title, Skill.id, Skill.code)
            .join(Exercise, ExerciseSkill.exercise_id == Exercise.id)
            .join(Skill, ExerciseSkill.skill_id == Skill.id)
            .where(
                or_(Exercise.is_published.is_(True), Exercise.status == "published"),
                Skill.is_active.is_(False),
            )
        )
        for tag_id, ex_id, title, sk_id, sk_code in (await db.execute(ex_stmt)).all():
            issues.append(
                TaxonomyIntegrityIssue(
                    category="archived_on_active_content",
                    severity="error",
                    message=(
                        f"Published exercise {ex_id} ('{title}') is tagged with archived skill "
                        f"'{sk_code}' ({sk_id})."
                    ),
                    entity_type="exercise_skill",
                    entity_id=str(tag_id),
                    details={"exercise_id": str(ex_id), "skill_id": str(sk_id), "skill_code": sk_code},
                )
            )

    # -------------------------------------------------------------------------
    # 5. Invalid Relationships & Dependency Cycles
    # -------------------------------------------------------------------------

    @classmethod
    async def _check_invalid_relationships(
        cls, db: AsyncSession, issues: list[TaxonomyIntegrityIssue]
    ) -> None:
        # Self-referencing relations
        self_stmt = select(SkillRelation).where(SkillRelation.from_skill_id == SkillRelation.to_skill_id)
        for rel in (await db.execute(self_stmt)).scalars().all():
            issues.append(
                TaxonomyIntegrityIssue(
                    category="invalid_relationships",
                    severity="error",
                    message=f"Self-referencing SkillRelation {rel.id} on skill {rel.from_skill_id}.",
                    entity_type="skill_relation",
                    entity_id=str(rel.id),
                    details={"skill_id": str(rel.from_skill_id), "relation_type": str(rel.relation_type)},
                )
            )

        # Prerequisite cycle detection
        prereq_stmt = select(SkillRelation.from_skill_id, SkillRelation.to_skill_id).where(
            SkillRelation.relation_type == SkillRelationType.PREREQUISITE
        )
        graph: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
        for f_id, t_id in (await db.execute(prereq_stmt)).all():
            graph[f_id].append(t_id)

        # DFS with 3 colors: 0=unvisited, 1=visiting (gray), 2=visited (black)
        color: dict[uuid.UUID, int] = defaultdict(int)

        def dfs(node: uuid.UUID) -> bool:
            color[node] = 1
            for neighbor in graph[node]:
                if color[neighbor] == 1:
                    return True
                if color[neighbor] == 0 and dfs(neighbor):
                    return True
            color[node] = 2
            return False

        for node in list(graph.keys()):
            if color[node] == 0 and dfs(node):
                issues.append(
                    TaxonomyIntegrityIssue(
                        category="invalid_relationships",
                        severity="error",
                        message=f"Cycle detected in prerequisite graph involving skill {node}.",
                        entity_type="skill_relation",
                        details={"node": str(node)},
                    )
                )

        # Cross-version relation check: ensure relations between different versions are migration relations
        migration_relation_types = {
            SkillRelationType.REPLACED_BY,
            SkillRelationType.SPLIT_INTO,
            SkillRelationType.MERGED_INTO,
            SkillRelationType.DEPRECATED_BY,
        }
        all_skills_ver = dict((await db.execute(select(Skill.id, Skill.taxonomy_version_id))).all())
        all_rels = (await db.execute(select(SkillRelation))).scalars().all()
        for r in all_rels:
            from_ver = all_skills_ver.get(r.from_skill_id)
            to_ver = all_skills_ver.get(r.to_skill_id)
            if from_ver and to_ver and from_ver != to_ver and r.relation_type not in migration_relation_types:
                issues.append(
                    TaxonomyIntegrityIssue(
                        category="invalid_relationships",
                        severity="warning",
                        message=(
                            f"SkillRelation {r.id} ({r.relation_type}) links skills across different "
                            f"taxonomy versions ({from_ver} -> {to_ver}) without using a migration relation type."
                        ),
                            entity_type="skill_relation",
                            entity_id=str(r.id),
                            details={
                                "from_skill_id": str(r.from_skill_id),
                                "to_skill_id": str(r.to_skill_id),
                                "from_version": str(from_ver),
                                "to_version": str(to_ver),
                                "relation_type": str(r.relation_type),
                            },
                        )
                    )

    # -------------------------------------------------------------------------
    # 6. Inactive Version References on Active Content
    # -------------------------------------------------------------------------

    @classmethod
    async def _check_inactive_version_references(
        cls, db: AsyncSession, issues: list[TaxonomyIntegrityIssue]
    ) -> None:
        active_ver = await db.scalar(
            select(TaxonomyVersion).where(TaxonomyVersion.status == TaxonomyLifecycleStatus.ACTIVE)
        )
        if not active_ver:
            return

        # Published questions using non-active taxonomy version
        q_stmt = (
            select(Question.id, Question.prompt, Skill.id, Skill.code, Skill.taxonomy_version_id)
            .join(QuestionSkillTag, QuestionSkillTag.question_id == Question.id)
            .join(Skill, QuestionSkillTag.skill_id == Skill.id)
            .where(
                Question.status == "published",
                or_(
                    Skill.taxonomy_version_id.is_(None),
                    Skill.taxonomy_version_id != active_ver.id,
                ),
            )
        )
        for q_id, prompt, sk_id, code, ver_id in (await db.execute(q_stmt)).all():
            issues.append(
                TaxonomyIntegrityIssue(
                    category="inactive_version_references",
                    severity="warning",
                    message=(
                        f"Published question {q_id} uses skill '{code}' from inactive/unassigned taxonomy version "
                        f"({ver_id}) while active version is {active_ver.version} ({active_ver.id})."
                    ),
                    entity_type="question",
                    entity_id=str(q_id),
                    details={"skill_id": str(sk_id), "skill_code": code, "version_id": str(ver_id)},
                )
            )

        # Published exercises using non-active taxonomy version
        ex_stmt = (
            select(Exercise.id, Exercise.title, Skill.id, Skill.code, Skill.taxonomy_version_id)
            .join(ExerciseSkill, ExerciseSkill.exercise_id == Exercise.id)
            .join(Skill, ExerciseSkill.skill_id == Skill.id)
            .where(
                or_(Exercise.is_published.is_(True), Exercise.status == "published"),
                or_(
                    Skill.taxonomy_version_id.is_(None),
                    Skill.taxonomy_version_id != active_ver.id,
                ),
            )
        )
        for ex_id, title, sk_id, code, ver_id in (await db.execute(ex_stmt)).all():
            issues.append(
                TaxonomyIntegrityIssue(
                    category="inactive_version_references",
                    severity="warning",
                    message=(
                        f"Published exercise {ex_id} ('{title}') uses skill '{code}' from inactive taxonomy version "
                        f"({ver_id}) while active version is {active_ver.version}."
                    ),
                    entity_type="exercise",
                    entity_id=str(ex_id),
                    details={"skill_id": str(sk_id), "skill_code": code, "version_id": str(ver_id)},
                )
            )

    # -------------------------------------------------------------------------
    # 7. Unresolved Migration Mappings
    # -------------------------------------------------------------------------

    @classmethod
    async def _check_unresolved_migrations(
        cls, db: AsyncSession, issues: list[TaxonomyIntegrityIssue]
    ) -> None:
        # Check records explicitly flagged as UNRESOLVED
        unresolved_stmt = select(TaxonomyMigrationRecord).where(
            TaxonomyMigrationRecord.status == TaxonomyMigrationStatus.UNRESOLVED
        )
        for rec in (await db.execute(unresolved_stmt)).scalars().all():
            issues.append(
                TaxonomyIntegrityIssue(
                    category="unresolved_migrations",
                    severity="warning",
                    message=(
                        f"Unresolved legacy node {rec.source_table}.{rec.source_code} ({rec.source_id}) "
                        f"requires canonical mapping."
                    ),
                    entity_type="taxonomy_migration_record",
                    entity_id=str(rec.id),
                    details={
                        "source_table": rec.source_table,
                        "source_id": str(rec.source_id),
                        "source_code": rec.source_code,
                        "notes": rec.notes,
                    },
                )
            )
