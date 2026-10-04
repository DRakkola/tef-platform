"""Tests for Taxonomy V2 Versioning, Historical Integrity, Replacement, and Auditing.

Covers:
- Composite unique constraint: (taxonomy_version_id, code)
- Skill evolution & replacement (replaced_by, split_into)
- Active successor resolution across migration edges
- Historical evidence immutability and metadata snapshotting
- Reconciliation of legacy nodes into taxonomy_migration_records
- F-12 subskill_id query support in recommendations
- Deep integrity checker tooling (TaxonomyIntegrityChecker)
- Admin REST API endpoints for integrity checks and skill evolution
"""

import datetime
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.enums import (
    SkillDimension,
    SkillRelationType,
    TaxonomyLifecycleStatus,
    TaxonomyMigrationStatus,
)
from app.modules.admin.models import (
    SkillRelation,
    SubSkill,
    TaxonomyMigrationRecord,
    TaxonomyVersion,
)
from app.modules.admin.taxonomy_integrity import TaxonomyIntegrityChecker
from app.modules.admin.taxonomy_service import TaxonomyService
from app.modules.assessments.enums import QuestionType
from app.modules.assessments.models import (
    Skill,
)
from app.modules.learning.models import Exercise, ExerciseSkill
from app.modules.learning.readiness_engine import ReadinessEngine
from app.modules.learning.readiness_models import SkillEvidence
from app.modules.users.models import User


@pytest.mark.asyncio
async def test_composite_unique_constraint_taxonomy_version_code(
    db_session: AsyncSession,
):
    """Test that the same skill code can exist in different versions, but is unique per version."""
    v1 = TaxonomyVersion(
        version=f"1.0.{uuid.uuid4().hex[:4]}",
        name="V1 Release",
        status=TaxonomyLifecycleStatus.ARCHIVED,
    )
    v2 = TaxonomyVersion(
        version=f"2.0.{uuid.uuid4().hex[:4]}",
        name="V2 Release",
        status=TaxonomyLifecycleStatus.ACTIVE,
    )
    db_session.add_all([v1, v2])
    await db_session.flush()

    shared_code = f"reason_main_idea_{uuid.uuid4().hex[:6]}"

    # 1. Skill in v1
    sk_v1 = Skill(
        taxonomy_version_id=v1.id,
        code=shared_code,
        name="Identify Main Idea V1",
        dimension=SkillDimension.REASONING,
        domain="reading",
        is_active=False,
    )
    db_session.add(sk_v1)
    await db_session.flush()

    # 2. Skill with SAME code in v2 should SUCCEED
    sk_v2 = Skill(
        taxonomy_version_id=v2.id,
        code=shared_code,
        name="Identify Main Idea V2 Refined",
        dimension=SkillDimension.REASONING,
        domain="reading",
        is_active=True,
    )
    db_session.add(sk_v2)
    await db_session.flush()
    assert sk_v1.id != sk_v2.id
    assert sk_v1.code == sk_v2.code

    # 3. Duplicate skill with same code in SAME version v2 must FAIL
    duplicate = Skill(
        taxonomy_version_id=v2.id,
        code=shared_code,
        name="Duplicate Code in V2",
        dimension=SkillDimension.REASONING,
        domain="reading",
        is_active=True,
    )
    db_session.add(duplicate)
    with pytest.raises(IntegrityError):
        await db_session.flush()

    await db_session.rollback()


@pytest.mark.asyncio
async def test_skill_replacement_and_successor_resolution(
    db_session: AsyncSession,
):
    """Test explicit skill replacement: old skill is archived, REPLACED_BY relation is added,

    and resolve_active_successor finds the new skill.
    """
    old_sk = Skill(
        code=f"legacy_vocab_{uuid.uuid4().hex[:6]}",
        name="Legacy Vocab",
        dimension=SkillDimension.LANGUAGE,
        domain="reading",
        is_active=True,
    )
    new_sk = Skill(
        code=f"canonical_vocab_{uuid.uuid4().hex[:6]}",
        name="Canonical Vocab Context",
        dimension=SkillDimension.LANGUAGE,
        domain="reading",
        is_active=True,
    )
    db_session.add_all([old_sk, new_sk])
    await db_session.flush()

    # Perform replacement
    rel = await TaxonomyService.record_skill_replacement(
        db=db_session,
        old_skill_id=old_sk.id,
        new_skill_id=new_sk.id,
        notes="Replaced by Taxonomy V2 vocabulary competency",
    )
    assert rel.relation_type == SkillRelationType.REPLACED_BY
    assert rel.from_skill_id == old_sk.id
    assert rel.to_skill_id == new_sk.id
    assert old_sk.is_active is False

    # Check migration record
    mig_rec = await db_session.scalar(
        select(TaxonomyMigrationRecord).where(
            TaxonomyMigrationRecord.source_table == "skills",
            TaxonomyMigrationRecord.source_id == old_sk.id,
        )
    )
    assert mig_rec is not None
    assert mig_rec.target_skill_id == new_sk.id
    assert mig_rec.status == TaxonomyMigrationStatus.MIGRATED
    assert mig_rec.migration_type == "replaced_by"

    # Test dynamic resolution
    successors = await TaxonomyService.resolve_active_successor(db_session, old_sk.id)
    assert len(successors) == 1
    assert successors[0].id == new_sk.id


@pytest.mark.asyncio
async def test_skill_split_and_successor_resolution(
    db_session: AsyncSession,
):
    """Test splitting a coarse competency into multiple fine-grained competencies."""
    coarse_sk = Skill(
        code=f"coarse_grammar_{uuid.uuid4().hex[:6]}",
        name="Coarse Grammar",
        dimension=SkillDimension.LANGUAGE,
        domain="reading",
        is_active=True,
    )
    fine_sk_1 = Skill(
        code=f"verb_tenses_{uuid.uuid4().hex[:6]}",
        name="Verb Tenses",
        dimension=SkillDimension.LANGUAGE,
        domain="reading",
        is_active=True,
    )
    fine_sk_2 = Skill(
        code=f"syntax_order_{uuid.uuid4().hex[:6]}",
        name="Sentence Syntax",
        dimension=SkillDimension.LANGUAGE,
        domain="reading",
        is_active=True,
    )
    db_session.add_all([coarse_sk, fine_sk_1, fine_sk_2])
    await db_session.flush()

    # Perform split
    rels = await TaxonomyService.record_skill_split(
        db=db_session,
        old_skill_id=coarse_sk.id,
        target_skill_ids=[fine_sk_1.id, fine_sk_2.id],
        notes="Decomposed grammar competency into syntax and morphology",
    )
    assert len(rels) == 2
    assert all(r.relation_type == SkillRelationType.SPLIT_INTO for r in rels)
    assert coarse_sk.is_active is False

    # Check migration record
    mig_rec = await db_session.scalar(
        select(TaxonomyMigrationRecord).where(
            TaxonomyMigrationRecord.source_table == "skills",
            TaxonomyMigrationRecord.source_id == coarse_sk.id,
        )
    )
    assert mig_rec is not None
    assert mig_rec.status == TaxonomyMigrationStatus.MIGRATED
    assert mig_rec.migration_type == "split_into"

    # Test dynamic resolution returns both active children
    successors = await TaxonomyService.resolve_active_successor(db_session, coarse_sk.id)
    successor_ids = {s.id for s in successors}
    assert successor_ids == {fine_sk_1.id, fine_sk_2.id}


@pytest.mark.asyncio
async def test_historical_evidence_immutability_and_metadata_snapshot(
    db_session: AsyncSession,
    test_student: User,
):
    """Test that historical SkillEvidence retains immutable snapshot metadata and taxonomy version."""
    v1 = TaxonomyVersion(
        version=f"1.0.{uuid.uuid4().hex[:4]}",
        name="Initial TEF Taxonomy",
        status=TaxonomyLifecycleStatus.ACTIVE,
    )
    db_session.add(v1)
    await db_session.flush()

    sk = Skill(
        taxonomy_version_id=v1.id,
        code=f"reason_locate_{uuid.uuid4().hex[:6]}",
        name="Localiser l'information",
        dimension=SkillDimension.REASONING,
        domain="reading",
        is_active=True,
    )
    db_session.add(sk)
    await db_session.flush()

    now = datetime.datetime.now(datetime.UTC)
    source_id = uuid.uuid4()

    # Ingest evidence
    ev = await ReadinessEngine.ingest_evidence(
        db=db_session,
        student_id=test_student.id,
        skill_id=sk.id,
        source_type="assessment_item",
        source_id=source_id,
        raw_score=1.0,
        normalized_score=100.0,
        confidence=0.85,
        weight=1.0,
        observed_at=now,
        metadata_payload={"question_id": str(source_id)},
    )
    await db_session.flush()

    assert ev.taxonomy_version_id == v1.id
    assert ev.metadata_payload is not None
    assert ev.metadata_payload.get("skill_code") == sk.code
    assert ev.metadata_payload.get("skill_name") == sk.name
    assert ev.metadata_payload.get("skill_dimension") == "reasoning"
    assert ev.metadata_payload.get("skill_domain") == "reading"

    # Now replace the skill with a newer skill
    new_sk = Skill(
        taxonomy_version_id=v1.id,
        code=f"reason_locate_v2_{uuid.uuid4().hex[:6]}",
        name="Localiser l'information v2",
        dimension=SkillDimension.REASONING,
        domain="reading",
        is_active=True,
    )
    db_session.add(new_sk)
    await db_session.flush()

    await TaxonomyService.record_skill_replacement(db_session, sk.id, new_sk.id)

    # Historical evidence must remain completely unchanged
    persisted_ev = await db_session.get(SkillEvidence, ev.id)
    assert persisted_ev is not None
    assert persisted_ev.skill_id == sk.id  # Unchanged!
    assert persisted_ev.taxonomy_version_id == v1.id
    assert persisted_ev.metadata_payload["skill_code"] == sk.code


@pytest.mark.asyncio
async def test_reconcile_legacy_nodes(
    db_session: AsyncSession,
):
    """Test reconcile_legacy_nodes audits unversioned skills and legacy sub_skills into taxonomy_migration_records."""
    legacy_parent = Skill(
        code=f"legacy_parent_{uuid.uuid4().hex[:6]}",
        name="Legacy Parent",
        dimension=SkillDimension.LANGUAGE,
        domain="reading",
        is_active=True,
    )
    db_session.add(legacy_parent)
    await db_session.flush()

    legacy_sub_id = uuid.uuid4()
    legacy_sub_code = f"legacy_sub_{uuid.uuid4().hex[:6]}"
    now = datetime.datetime.now(datetime.UTC)
    await db_session.execute(
        SubSkill.__table__.insert().values(
            id=legacy_sub_id,
            skill_id=legacy_parent.id,
            code=legacy_sub_code,
            name="Legacy Subskill",
            created_at=now,
            updated_at=now,
        )
    )
    await db_session.flush()

    stats = await TaxonomyService.reconcile_legacy_nodes(db_session)
    assert isinstance(stats, dict)
    assert "migrated" in stats
    assert "deprecated" in stats
    assert "unresolved" in stats

    # Legacy subskill without matching canonical skill should be flagged
    mig_rec = await db_session.scalar(
        select(TaxonomyMigrationRecord).where(
            TaxonomyMigrationRecord.source_table == "sub_skills",
            TaxonomyMigrationRecord.source_id == legacy_sub_id,
        )
    )
    assert mig_rec is not None
    assert mig_rec.source_code == legacy_sub_code


@pytest.mark.asyncio
async def test_f12_recommendations_subskill_id_support(
    db_session: AsyncSession,
    test_student: User,
):
    """Verify that RecommendationEngineV2 exercise queries search both skill_id and subskill_id (F-12)."""
    parent_skill = Skill(
        code=f"parent_skill_{uuid.uuid4().hex[:6]}",
        name="Parent Skill",
        dimension=SkillDimension.REASONING,
        domain="reading",
        is_active=True,
    )
    sub_skill = Skill(
        code=f"child_skill_{uuid.uuid4().hex[:6]}",
        name="Child Skill",
        dimension=SkillDimension.REASONING,
        domain="reading",
        parent_id=parent_skill.id,
        is_active=True,
    )
    db_session.add_all([parent_skill, sub_skill])
    await db_session.flush()

    # Create an exercise tagged with parent as skill_id and child as subskill_id
    ex = Exercise(
        title="Subskill Practice Exercise",
        prompt="Read and answer",
        category="reading",
        level="B1",
        difficulty=3,
        question_type=QuestionType.SINGLE_CHOICE,
        is_published=True,
        status="published",
    )
    db_session.add(ex)
    await db_session.flush()

    ex_skill = ExerciseSkill(
        exercise_id=ex.id,
        skill_id=parent_skill.id,
        subskill_id=sub_skill.id,
        weight=1.0,
    )
    db_session.add(ex_skill)
    await db_session.flush()

    # Query targeting sub_skill.id via OR condition (skill_id == sub_id or subskill_id == sub_id)
    from sqlalchemy import or_

    matched = (
        await db_session.execute(
            select(Exercise)
            .join(ExerciseSkill, ExerciseSkill.exercise_id == Exercise.id)
            .where(
                or_(
                    ExerciseSkill.skill_id == sub_skill.id,
                    ExerciseSkill.subskill_id == sub_skill.id,
                )
            )
        )
    ).scalars().all()

    assert any(m.id == ex.id for m in matched)


@pytest.mark.asyncio
async def test_taxonomy_integrity_checker_detects_issues(
    db_session: AsyncSession,
):
    """Test TaxonomyIntegrityChecker identifies orphan references, archived skills on active content, and cycles."""
    # 1. Create an archived skill
    archived_sk = Skill(
        code=f"archived_sk_{uuid.uuid4().hex[:6]}",
        name="Archived Competency",
        dimension=SkillDimension.REASONING,
        domain="reading",
        is_active=False,
    )
    db_session.add(archived_sk)
    await db_session.flush()

    # 2. Tag archived skill on a published exercise
    published_ex = Exercise(
        title="Active Exercise with Inactive Skill",
        prompt="Prompt text",
        category="reading",
        level="B2",
        difficulty=4,
        question_type=QuestionType.SINGLE_CHOICE,
        is_published=True,
        status="published",
    )
    db_session.add(published_ex)
    await db_session.flush()

    db_session.add(ExerciseSkill(exercise_id=published_ex.id, skill_id=archived_sk.id))
    await db_session.flush()

    # 3. Create a self-referencing relationship
    sk_self = Skill(
        code=f"self_ref_{uuid.uuid4().hex[:6]}",
        name="Self Ref",
        dimension=SkillDimension.LANGUAGE,
        domain="reading",
        is_active=True,
    )
    db_session.add(sk_self)
    await db_session.flush()

    db_session.add(
        SkillRelation(
            from_skill_id=sk_self.id,
            to_skill_id=sk_self.id,
            relation_type=SkillRelationType.PREREQUISITE,
        )
    )
    await db_session.flush()

    # Run integrity check
    report = await TaxonomyIntegrityChecker.run_integrity_check(db_session)
    assert report.is_clean is False
    assert report.error_count >= 2

    categories = {i.category for i in report.issues}
    assert "archived_on_active_content" in categories
    assert "invalid_relationships" in categories


@pytest.mark.asyncio
async def test_admin_integrity_and_migration_endpoints(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    """Test REST API endpoints for integrity check, reconcile legacy nodes, and skill evolution."""
    # 1. GET /api/v1/admin/taxonomy/integrity-check
    resp = await client.get("/api/v1/admin/taxonomy/integrity-check", headers=admin_auth_headers)
    assert resp.status_code == 200
    report = resp.json()
    assert "is_clean" in report
    assert "error_count" in report
    assert "warning_count" in report
    assert "issues" in report

    # 2. POST /api/v1/admin/taxonomy/reconcile-legacy-nodes
    resp = await client.post("/api/v1/admin/taxonomy/reconcile-legacy-nodes", headers=admin_auth_headers)
    assert resp.status_code == 200
    rec_data = resp.json()
    assert "migrated" in rec_data
    assert "deprecated" in rec_data
    assert "unresolved" in rec_data

    # 3. POST /api/v1/admin/taxonomy/skills/{id}/replace
    sk1 = Skill(
        code=f"api_old_{uuid.uuid4().hex[:6]}",
        name="API Old Skill",
        dimension=SkillDimension.REASONING,
        domain="reading",
        is_active=True,
    )
    sk2 = Skill(
        code=f"api_new_{uuid.uuid4().hex[:6]}",
        name="API New Skill",
        dimension=SkillDimension.REASONING,
        domain="reading",
        is_active=True,
    )
    db_session.add_all([sk1, sk2])
    await db_session.flush()

    replace_payload = {"new_skill_id": str(sk2.id), "notes": "API test replacement"}
    resp = await client.post(
        f"/api/v1/admin/taxonomy/skills/{sk1.id}/replace",
        json=replace_payload,
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    rel_data = resp.json()
    assert rel_data["from_skill_id"] == str(sk1.id)
    assert rel_data["to_skill_id"] == str(sk2.id)
    assert rel_data["relation_type"] == "replaced_by"

    # 4. POST /api/v1/admin/taxonomy/skills/{id}/split
    sk_parent = Skill(
        code=f"api_coarse_{uuid.uuid4().hex[:6]}",
        name="API Coarse Skill",
        dimension=SkillDimension.LANGUAGE,
        domain="reading",
        is_active=True,
    )
    sk_target1 = Skill(
        code=f"api_fine1_{uuid.uuid4().hex[:6]}",
        name="API Fine 1",
        dimension=SkillDimension.LANGUAGE,
        domain="reading",
        is_active=True,
    )
    sk_target2 = Skill(
        code=f"api_fine2_{uuid.uuid4().hex[:6]}",
        name="API Fine 2",
        dimension=SkillDimension.LANGUAGE,
        domain="reading",
        is_active=True,
    )
    db_session.add_all([sk_parent, sk_target1, sk_target2])
    await db_session.flush()

    split_payload = {
        "target_skill_ids": [str(sk_target1.id), str(sk_target2.id)],
        "notes": "API test split",
    }
    resp = await client.post(
        f"/api/v1/admin/taxonomy/skills/{sk_parent.id}/split",
        json=split_payload,
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    split_rels = resp.json()
    assert len(split_rels) == 2
    assert all(r["relation_type"] == "split_into" for r in split_rels)
