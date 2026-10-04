"""Canonical Deterministic Seeder and Validator for TEF Taxonomy V1.

Enforces strict taxonomy validation, cycle prevention, referential integrity,
and idempotent database persistence.
"""

from __future__ import annotations

import datetime
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any

import structlog
import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.modules.admin.enums import (
    CEFRBand,
    SkillDimension,
    SkillRelationType,
    TaxonomyLifecycleStatus,
)
from app.modules.admin.models import (
    SkillLevelDescriptor,
    SkillModality,
    SkillRelation,
    TaskTypeSkill,
    TaxonomyVersion,
)
from app.modules.assessments.models import Skill, TaskType

logger = structlog.get_logger("tef-api.taxonomy_seeder")

SEED_DIR = Path(__file__).parent / "seed"
DEFAULT_YAML_PATH = SEED_DIR / "taxonomy_v1.yaml"

VALID_MODALITIES = {"reading", "listening", "writing", "speaking"}
VALID_DIMENSIONS = {"reasoning", "language"}
VALID_CEFR_LEVELS = {"A1", "A2", "B1", "B2", "C1", "C2"}
VALID_RELATION_TYPES = {"prerequisite", "depends_on", "supports", "related"}

LEGACY_FORBIDDEN_CODES = {
    "reading_comprehension",
    "reading_comp",
    "read_faits",
    "reading_detail",
    "reading_main_idea",
    "listening_comprehension",
    "listening_comp",
    "list_radio",
    "grammar_mastery",
    "gram_subj",
    "writing_production",
    "writ_sectb",
    "reasoning_reading_root",
    "reasoning_info_extraction",
    "reasoning_global_comprehension",
    "reasoning_relational_synthesis",
    "reasoning_inference_and_evaluation",
    "reasoning_locate_information",
    "reasoning_identify_specific_detail",
    "reasoning_identify_main_idea",
    "reasoning_understand_context",
    "reasoning_understand_sequence",
    "reasoning_identify_cause_effect",
    "reasoning_compare_and_match",
    "reasoning_interpret_data",
    "reasoning_infer_implicit_meaning",
    "reasoning_identify_author_position",
    "reasoning_identify_tone_and_intent",
}


class TaxonomyValidationError(AppException):
    """Raised when taxonomy seed dataset fails semantic or relational validation."""

    def __init__(self, message: str, errors: list[str] | None = None):
        super().__init__(message, status_code=400)
        self.errors = errors or [message]


class TaxonomySeedValidator:
    """Validates taxonomy seed payload in-memory prior to persistence."""

    @classmethod
    def validate_dataset(cls, data: dict[str, Any]) -> None:
        errors: list[str] = []

        # 1. Version header
        tv = data.get("taxonomy_version")
        if not tv or not isinstance(tv, dict):
            errors.append("Missing 'taxonomy_version' specification dictionary.")
        else:
            if not tv.get("version"):
                errors.append("Taxonomy version string is required.")
            if not tv.get("name"):
                errors.append("Taxonomy name string is required.")

        # 2. Modalities
        modalities_data = data.get("modalities", [])
        if not modalities_data:
            errors.append("Modalities list is missing or empty.")
        seen_modalities: set[str] = set()
        for mod in modalities_data:
            code = mod.get("code")
            if not code or code not in VALID_MODALITIES:
                errors.append(f"Invalid modality code: '{code}'. Allowed: {sorted(VALID_MODALITIES)}")
            if code in seen_modalities:
                errors.append(f"Duplicate modality code: '{code}'.")
            seen_modalities.add(code)

        # 3. Task Types
        task_types = data.get("task_types", [])
        seen_tasks: set[str] = set()
        for tt in task_types:
            code = tt.get("code")
            if not code:
                errors.append("Task type missing required 'code'.")
                continue
            if code in seen_tasks:
                errors.append(f"Duplicate task type code: '{code}'.")
            seen_tasks.add(code)
            if not tt.get("name"):
                errors.append(f"Task type '{code}' missing required 'name'.")
            modality = tt.get("modality")
            if modality not in VALID_MODALITIES:
                errors.append(f"Task type '{code}' references invalid modality '{modality}'.")

        # 4. Skills
        skills = data.get("skills", [])
        if not skills:
            errors.append("Skills catalog is missing or empty.")

        skill_map: dict[str, dict[str, Any]] = {}
        for s in skills:
            code = s.get("code")
            if not code:
                errors.append("Skill missing required 'code'.")
                continue

            # Code convention enforcement: lowercase, snake_case
            if code != code.lower() or " " in code or "-" in code:
                errors.append(f"Skill code '{code}' violates snake_case convention.")

            # Check legacy forbidden codes
            if code.lower() in LEGACY_FORBIDDEN_CODES:
                errors.append(f"Forbidden legacy skill code encountered: '{code}'.")

            if code in skill_map:
                errors.append(f"Duplicate skill code: '{code}'.")
            skill_map[code] = s

            # Dimension validation
            dim = s.get("dimension")
            if dim not in VALID_DIMENSIONS:
                errors.append(f"Skill '{code}' has invalid dimension '{dim}'. Allowed: {sorted(VALID_DIMENSIONS)}")

            # Domain validation
            if not s.get("domain"):
                errors.append(f"Skill '{code}' missing required 'domain'.")

            # Assessable requirements
            assessable = s.get("assessable", True)
            if assessable:
                if not s.get("description"):
                    errors.append(f"Assessable skill '{code}' must have a description.")
                mods = s.get("applicable_modalities", [])
                if not mods:
                    errors.append(f"Assessable skill '{code}' must have at least one applicable modality.")
                for m in mods:
                    if m not in VALID_MODALITIES:
                        errors.append(f"Skill '{code}' specifies invalid modality '{m}'.")

        # 5. Parent hierarchy and cycles
        parent_graph: dict[str, str] = {}
        for code, s in skill_map.items():
            parent_code = s.get("parent_code")
            if parent_code:
                if parent_code not in skill_map:
                    errors.append(f"Skill '{code}' references non-existent parent_code '{parent_code}'.")
                elif parent_code == code:
                    errors.append(f"Skill '{code}' cannot have itself as parent.")
                else:
                    parent_graph[code] = parent_code

        for start_code in parent_graph:
            visited = set()
            curr = start_code
            while curr in parent_graph:
                if curr in visited:
                    errors.append(f"Cycle detected in skill parent hierarchy involving '{curr}'.")
                    break
                visited.add(curr)
                curr = parent_graph[curr]

        # 6. Task Type -> Skill mappings
        task_skills = data.get("task_type_skills", {})
        for t_code, s_list in task_skills.items():
            if t_code not in seen_tasks:
                errors.append(f"task_type_skills maps unknown task_type '{t_code}'.")
            for sk_code in s_list:
                if sk_code not in skill_map:
                    errors.append(f"task_type_skills maps unknown skill '{sk_code}' to task '{t_code}'.")

        # 7. Skill Relations
        relations = data.get("skill_relations", [])
        seen_relations: set[tuple[str, str, str]] = set()
        adj_list: dict[str, list[str]] = defaultdict(list)

        for rel in relations:
            f_code = rel.get("from_skill")
            t_code = rel.get("to_skill")
            r_type = rel.get("relation_type", "prerequisite").lower()

            if not f_code or f_code not in skill_map:
                errors.append(f"Skill relation references unknown from_skill '{f_code}'.")
            if not t_code or t_code not in skill_map:
                errors.append(f"Skill relation references unknown to_skill '{t_code}'.")
            if f_code and t_code and f_code == t_code:
                errors.append(f"Self-relation not allowed on skill '{f_code}'.")
            if r_type not in VALID_RELATION_TYPES:
                errors.append(f"Invalid relation_type '{r_type}'. Allowed: {sorted(VALID_RELATION_TYPES)}")

            rel_key = (f_code, t_code, r_type)
            if rel_key in seen_relations:
                errors.append(f"Duplicate skill relation: {rel_key}.")
            seen_relations.add(rel_key)

            if r_type in {"prerequisite", "depends_on"}:
                adj_list[f_code].append(t_code)

        # Check for dependency cycles in prerequisite / depends_on graph using cycle finder
        has_rel_cycle, cycle_node = cls._has_dependency_cycle(adj_list)
        if has_rel_cycle:
            errors.append(f"Dependency cycle detected in skill relations starting at '{cycle_node}'.")

        # 8. CEFR Descriptors
        descriptors = data.get("cefr_descriptors", [])
        seen_descriptors: set[tuple[str, str]] = set()
        for desc in descriptors:
            sk_code = desc.get("skill_code")
            level = desc.get("level")
            text_desc = desc.get("descriptor")

            if not sk_code or sk_code not in skill_map:
                errors.append(f"CEFR descriptor references unknown skill '{sk_code}'.")
            if not level or level not in VALID_CEFR_LEVELS:
                errors.append(f"CEFR descriptor for '{sk_code}' has invalid level '{level}'. Allowed: {sorted(VALID_CEFR_LEVELS)}")
            if not text_desc or not text_desc.strip():
                errors.append(f"CEFR descriptor for '{sk_code}' [{level}] is empty.")

            desc_key = (sk_code, level)
            if desc_key in seen_descriptors:
                errors.append(f"Duplicate CEFR descriptor for skill '{sk_code}' at level '{level}'.")
            seen_descriptors.add(desc_key)

        if errors:
            raise TaxonomyValidationError(
                f"Taxonomy validation failed with {len(errors)} error(s).",
                errors=errors,
            )

    @classmethod
    def _has_dependency_cycle(cls, adj_list: dict[str, list[str]]) -> tuple[bool, str | None]:
        """Detect whether a directed dependency graph has any cycles."""
        visited: set[str] = set()
        rec_stack: set[str] = set()

        def dfs(node: str) -> bool:
            visited.add(node)
            rec_stack.add(node)
            for neighbor in adj_list.get(node, []):
                if neighbor not in visited:
                    if dfs(neighbor):
                        return True
                elif neighbor in rec_stack:
                    return True
            rec_stack.remove(node)
            return False

        for start_node in adj_list:
            if start_node not in visited and dfs(start_node):
                return True, start_node
        return False, None


class TaxonomySeeder:
    """Deterministic, idempotent seeder for Canonical TEF Taxonomy."""

    @classmethod
    def load_yaml(cls, yaml_path: str | Path | None = None) -> dict[str, Any]:
        path = Path(yaml_path) if yaml_path else DEFAULT_YAML_PATH
        if not path.exists():
            raise FileNotFoundError(f"Taxonomy seed file not found: {path.resolve()}")
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return data

    @classmethod
    async def seed(
        cls,
        db: AsyncSession,
        yaml_path: str | Path | None = None,
        force_archive_others: bool = True,
    ) -> dict[str, Any]:
        """Seed taxonomy idempotently from structured YAML source with bulk operations."""
        data = cls.load_yaml(yaml_path)

        # 1. In-memory validation
        TaxonomySeedValidator.validate_dataset(data)
        logger.info("taxonomy_seed_validation_passed")

        tv_info = data["taxonomy_version"]
        version_str = tv_info["version"]
        target_version_id = uuid.UUID(tv_info["id"]) if tv_info.get("id") else uuid.UUID("00000000-0000-4000-a000-000000000001")

        # 2. Upsert TaxonomyVersion
        stmt = select(TaxonomyVersion).where(TaxonomyVersion.version == version_str)
        taxonomy_version = (await db.execute(stmt)).scalar_one_or_none()

        now = datetime.datetime.now(datetime.UTC)
        if not taxonomy_version:
            existing_by_id = await db.get(TaxonomyVersion, target_version_id)
            if existing_by_id:
                taxonomy_version = existing_by_id
                taxonomy_version.version = version_str
                taxonomy_version.name = tv_info["name"]
                taxonomy_version.description = tv_info.get("description")
                taxonomy_version.status = TaxonomyLifecycleStatus.ACTIVE
                taxonomy_version.activated_at = now
            else:
                taxonomy_version = TaxonomyVersion(
                    id=target_version_id,
                    version=version_str,
                    name=tv_info["name"],
                    description=tv_info.get("description"),
                    status=TaxonomyLifecycleStatus.ACTIVE,
                    activated_at=now,
                )
                db.add(taxonomy_version)
        else:
            taxonomy_version.name = tv_info["name"]
            taxonomy_version.description = tv_info.get("description")
            taxonomy_version.status = TaxonomyLifecycleStatus.ACTIVE
            if not taxonomy_version.activated_at:
                taxonomy_version.activated_at = now

        if force_archive_others:
            other_versions = (
                await db.execute(
                    select(TaxonomyVersion).where(
                        TaxonomyVersion.id != taxonomy_version.id,
                        TaxonomyVersion.status == TaxonomyLifecycleStatus.ACTIVE,
                    )
                )
            ).scalars().all()
            for ov in other_versions:
                ov.status = TaxonomyLifecycleStatus.ARCHIVED
                ov.archived_at = now

        await db.flush()

        # 3. Bulk fetch and upsert TaskTypes
        existing_tts = (await db.execute(select(TaskType))).scalars().all()
        existing_tt_map = {tt.code: tt for tt in existing_tts}

        task_types_data = data.get("task_types", [])
        task_type_map: dict[str, TaskType] = {}
        for tt_data in task_types_data:
            code = tt_data["code"]
            tt = existing_tt_map.get(code)
            if not tt:
                tt = TaskType(
                    modality=tt_data["modality"],
                    code=code,
                    name=tt_data["name"],
                    description=tt_data.get("description"),
                    default_response_type=tt_data.get("default_response_type", "single_choice"),
                    is_active=True,
                )
                db.add(tt)
            else:
                tt.modality = tt_data["modality"]
                tt.name = tt_data["name"]
                tt.description = tt_data.get("description")
                tt.default_response_type = tt_data.get("default_response_type", "single_choice")
                tt.is_active = True
            task_type_map[code] = tt

        await db.flush()

        # 4. Bulk fetch and upsert Skills
        existing_skills = (
            await db.execute(select(Skill).where(Skill.taxonomy_version_id == taxonomy_version.id))
        ).scalars().all()
        existing_skill_map = {s.code: s for s in existing_skills}

        skills_data = data.get("skills", [])
        skill_map: dict[str, Skill] = {}

        # Pass 1: Upsert skills without parent_id
        for s_data in skills_data:
            code = s_data["code"]
            dim = SkillDimension(s_data["dimension"].lower())
            skill = existing_skill_map.get(code)
            if not skill:
                skill = Skill(
                    taxonomy_version_id=taxonomy_version.id,
                    code=code,
                    name=s_data["name"],
                    dimension=dim,
                    domain=s_data.get("domain", "general"),
                    description=s_data.get("description"),
                    is_assessable=s_data.get("assessable", True),
                    order_index=s_data.get("order_index", 0),
                    is_active=True,
                )
                db.add(skill)
            else:
                skill.name = s_data["name"]
                skill.dimension = dim
                skill.domain = s_data.get("domain", "general")
                skill.description = s_data.get("description")
                skill.is_assessable = s_data.get("assessable", True)
                skill.order_index = s_data.get("order_index", 0)
                skill.is_active = True
            skill_map[code] = skill

        # Single flush so all skills have IDs
        await db.flush()

        # Pass 2: Set parent_id
        for s_data in skills_data:
            code = s_data["code"]
            parent_code = s_data.get("parent_code")
            skill = skill_map[code]
            if parent_code:
                parent_skill = skill_map.get(parent_code)
                skill.parent_id = parent_skill.id if parent_skill else None
            else:
                skill.parent_id = None

        await db.flush()

        # 5. Bulk fetch and upsert SkillModality
        existing_modalities = (await db.execute(select(SkillModality))).scalars().all()
        existing_mod_set = {(m.skill_id, m.modality) for m in existing_modalities}

        skill_modality_count = 0
        for s_data in skills_data:
            code = s_data["code"]
            skill = skill_map[code]
            mods = s_data.get("applicable_modalities", [])
            for mod in mods:
                key = (skill.id, mod)
                if key not in existing_mod_set:
                    sm = SkillModality(
                        skill_id=skill.id,
                        modality=mod,
                        is_primary=True,
                    )
                    db.add(sm)
                    existing_mod_set.add(key)
                skill_modality_count += 1

        # 6. Bulk fetch and upsert TaskTypeSkill
        existing_task_skills = (await db.execute(select(TaskTypeSkill))).scalars().all()
        existing_task_skill_set = {(t.task_type_id, t.skill_id) for t in existing_task_skills}

        task_skill_count = 0
        task_type_skills_data = data.get("task_type_skills", {})
        for t_code, sk_codes in task_type_skills_data.items():
            tt = task_type_map.get(t_code)
            if not tt:
                continue
            for sk_code in sk_codes:
                sk = skill_map.get(sk_code)
                if not sk:
                    continue
                key = (tt.id, sk.id)
                if key not in existing_task_skill_set:
                    tts = TaskTypeSkill(
                        task_type_id=tt.id,
                        skill_id=sk.id,
                    )
                    db.add(tts)
                    existing_task_skill_set.add(key)
                task_skill_count += 1

        # 7. Bulk fetch and upsert SkillRelation
        existing_relations = (await db.execute(select(SkillRelation))).scalars().all()
        existing_rel_set = {
            (r.from_skill_id, r.to_skill_id, r.relation_type) for r in existing_relations
        }

        relation_count = 0
        relations_data = data.get("skill_relations", [])
        for rel in relations_data:
            f_code = rel["from_skill"]
            t_code = rel["to_skill"]
            r_type = SkillRelationType(rel.get("relation_type", "prerequisite").lower())

            f_skill = skill_map.get(f_code)
            t_skill = skill_map.get(t_code)
            if not f_skill or not t_skill:
                continue

            key = (f_skill.id, t_skill.id, r_type)
            if key not in existing_rel_set:
                sr = SkillRelation(
                    from_skill_id=f_skill.id,
                    to_skill_id=t_skill.id,
                    relation_type=r_type,
                )
                db.add(sr)
                existing_rel_set.add(key)
            relation_count += 1

        # 8. Bulk fetch and upsert CEFR Descriptors
        existing_descriptors = (await db.execute(select(SkillLevelDescriptor))).scalars().all()
        existing_desc_map = {(d.skill_id, d.level): d for d in existing_descriptors}

        descriptor_count = 0
        descriptors_data = data.get("cefr_descriptors", [])
        for desc_data in descriptors_data:
            sk_code = desc_data["skill_code"]
            skill = skill_map.get(sk_code)
            if not skill:
                continue

            level = CEFRBand(desc_data["level"].upper())
            key = (skill.id, level)
            sld = existing_desc_map.get(key)
            if not sld:
                sld = SkillLevelDescriptor(
                    skill_id=skill.id,
                    level=level,
                    descriptor=desc_data["descriptor"],
                    evidence_guidance=desc_data.get("evidence_guidance"),
                )
                db.add(sld)
                existing_desc_map[key] = sld
            else:
                sld.descriptor = desc_data["descriptor"]
                sld.evidence_guidance = desc_data.get("evidence_guidance")
            descriptor_count += 1

        await db.commit()

        stats = {
            "taxonomy_version": taxonomy_version.version,
            "taxonomy_version_id": str(taxonomy_version.id),
            "task_types": len(task_type_map),
            "skills": len(skill_map),
            "assessable_skills": sum(1 for s in skill_map.values() if s.is_assessable),
            "container_skills": sum(1 for s in skill_map.values() if not s.is_assessable),
            "reasoning_skills": sum(1 for s in skill_map.values() if s.dimension == SkillDimension.REASONING),
            "language_skills": sum(1 for s in skill_map.values() if s.dimension == SkillDimension.LANGUAGE),
            "skill_modalities": skill_modality_count,
            "task_type_skills": task_skill_count,
            "skill_relations": relation_count,
            "cefr_descriptors": descriptor_count,
        }

        logger.info("taxonomy_seeded_successfully", **stats)
        return stats
