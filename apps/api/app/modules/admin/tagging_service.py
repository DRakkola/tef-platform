"""Canonical skill tagging validation engine for questions and exercises."""

import uuid
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.modules.admin.enums import SkillTagRole
from app.modules.admin.models import SkillModality, TaskTypeSkill
from app.modules.assessments.models import Skill, TaskType

logger = structlog.get_logger("tef-api.admin.tagging")

_WEIGHT_TOLERANCE: float = 0.01


class TaggingValidationEngine:
    """Validates canonical skill tag lists for questions and exercises."""

    @classmethod
    async def audit_skill_tags(
        cls,
        db: AsyncSession,
        tags: list[Any],
        task_type_id: uuid.UUID | None = None,
    ) -> tuple[list[Skill], list[dict[str, Any]]]:
        """Audit a skill tag list and return (resolved_skills, issues).

        Does not raise exceptions. Collects all validation issues.
        """
        if not tags:
            return [], []

        issues: list[dict[str, Any]] = []

        # Helper accessors
        def get_sid(t: Any) -> uuid.UUID:
            return getattr(t, "skill_id", None) or (t.get("skill_id") if isinstance(t, dict) else None)

        def get_w(t: Any) -> float:
            w_val = getattr(t, "weight", 1.0) if not isinstance(t, dict) else t.get("weight", 1.0)
            return float(w_val) if w_val is not None else 1.0

        def get_r(t: Any) -> Any:
            return getattr(t, "role", SkillTagRole.PRIMARY) if not isinstance(t, dict) else t.get("role", SkillTagRole.PRIMARY)

        # 1. Duplicate skill_id check
        seen_skill_ids: set[uuid.UUID] = set()
        for tag in tags:
            s_id = get_sid(tag)
            if s_id in seen_skill_ids:
                issues.append({
                    "code": "DUPLICATE_SKILL_TAG",
                    "severity": "blocking",
                    "field": "skill_tags",
                    "message": f"Duplicate skill_id {s_id} in tag list.",
                    "rule": "taxonomy",
                    "metadata": {"skill_id": str(s_id)},
                    "status_code": 400,
                })
            seen_skill_ids.add(s_id)

        # 2. Resolve all skills in one query
        skill_ids = [get_sid(tag) for tag in tags if get_sid(tag) is not None]
        result = await db.execute(select(Skill).where(Skill.id.in_(skill_ids)))
        skill_map: dict[uuid.UUID, Skill] = {s.id: s for s in result.scalars().all()}

        resolved: list[Skill] = []
        for tag in tags:
            s_id = get_sid(tag)
            skill = skill_map.get(s_id)
            if skill is None:
                issues.append({
                    "code": "INACTIVE_OR_MISSING_SKILL",
                    "severity": "blocking",
                    "field": "skill_tags",
                    "message": f"Skill {s_id} not found.",
                    "rule": "taxonomy",
                    "metadata": {"skill_id": str(s_id)},
                    "status_code": 422,
                })
            elif not skill.is_active:
                issues.append({
                    "code": "INACTIVE_OR_MISSING_SKILL",
                    "severity": "blocking",
                    "field": "skill_tags",
                    "message": f"Skill '{skill.code}' is archived and cannot be tagged on new content.",
                    "rule": "taxonomy",
                    "metadata": {"skill_id": str(s_id), "code": skill.code},
                    "status_code": 422,
                })
            else:
                resolved.append(skill)

        # 3. Individual weight validation
        for tag in tags:
            w = get_w(tag)
            s_id = get_sid(tag)
            if not (0.0 < w <= 1.0):
                issues.append({
                    "code": "INVALID_TAG_WEIGHT",
                    "severity": "blocking",
                    "field": "skill_tags",
                    "message": f"Tag weight {w} for skill {s_id} is invalid. Must be 0 < weight <= 1.0.",
                    "rule": "taxonomy",
                    "metadata": {"skill_id": str(s_id), "weight": w},
                    "status_code": 400,
                })

        # 4. Dimension weight sum validation
        dimension_weights: dict[str, float] = {}
        for tag, skill in zip(tags, resolved):
            if skill.dimension is not None:
                dim = skill.dimension.value if hasattr(skill.dimension, "value") else str(skill.dimension)
                dimension_weights[dim] = dimension_weights.get(dim, 0.0) + get_w(tag)

        for dim, total_weight in dimension_weights.items():
            if abs(total_weight - 1.0) > _WEIGHT_TOLERANCE:
                issues.append({
                    "code": "INVALID_TAG_WEIGHT",
                    "severity": "blocking",
                    "field": "skill_tags",
                    "message": (
                        f"Weights for dimension '{dim}' sum to {total_weight:.4f}, "
                        f"must equal 1.0 ± {_WEIGHT_TOLERANCE}."
                    ),
                    "rule": "taxonomy",
                    "metadata": {"dimension": dim, "sum": round(total_weight, 4)},
                    "status_code": 400,
                })

        # 5. At most one PRIMARY per dimension
        primary_per_dim: dict[str, int] = {}
        for tag, skill in zip(tags, resolved):
            role = get_r(tag)
            if hasattr(role, "value"):
                role_str = role.value
            else:
                role_str = str(role)
            if role_str == SkillTagRole.PRIMARY.value and skill.dimension is not None:
                dim = skill.dimension.value if hasattr(skill.dimension, "value") else str(skill.dimension)
                primary_per_dim[dim] = primary_per_dim.get(dim, 0) + 1
                if primary_per_dim[dim] > 1:
                    issues.append({
                        "code": "MULTIPLE_PRIMARY_PER_DIMENSION",
                        "severity": "blocking",
                        "field": "skill_tags",
                        "message": f"More than one PRIMARY skill tag for dimension '{dim}'.",
                        "rule": "taxonomy",
                        "metadata": {"dimension": dim, "primary_count": primary_per_dim[dim]},
                        "status_code": 400,
                    })

        # 6. Task type compatibility check against canonical taxonomy metadata
        if task_type_id is not None:
            task_type = await db.scalar(select(TaskType).where(TaskType.id == task_type_id))
            if task_type is not None:
                modality = task_type.modality.lower() if task_type.modality else None

                # 6a. Check explicit TaskTypeSkill associations if defined for this task type
                tts_stmt = select(TaskTypeSkill.skill_id).where(TaskTypeSkill.task_type_id == task_type_id)
                allowed_skill_ids = set((await db.execute(tts_stmt)).scalars().all())

                if allowed_skill_ids:
                    # All tagged skills must be in this supported set (or their parent container)
                    for skill in resolved:
                        if skill.id not in allowed_skill_ids and skill.parent_id not in allowed_skill_ids:
                            issues.append({
                                "code": "INCOMPATIBLE_SKILL_TASK_TYPE",
                                "severity": "blocking",
                                "field": "skill_tags",
                                "message": (
                                    f"Competency '{skill.code}' is not supported by "
                                    f"task type '{task_type.name}' ({task_type.code})."
                                ),
                                "rule": "taxonomy",
                                "metadata": {"skill_code": skill.code, "task_type_code": task_type.code},
                                "status_code": 422,
                            })

                # 6b. Check SkillModality associations from the taxonomy
                if modality:
                    sm_stmt = select(SkillModality.skill_id, SkillModality.modality).where(
                        SkillModality.skill_id.in_(skill_ids)
                    )
                    sm_rows = (await db.execute(sm_stmt)).all()
                    modalities_by_skill: dict[uuid.UUID, set[str]] = {}
                    for s_id, mod in sm_rows:
                        modalities_by_skill.setdefault(s_id, set()).add(mod.lower())

                    for skill in resolved:
                        skill_mods = modalities_by_skill.get(skill.id)
                        if skill_mods:
                            if modality not in skill_mods:
                                issues.append({
                                    "code": "INCOMPATIBLE_SKILL_TASK_TYPE",
                                    "severity": "blocking",
                                    "field": "skill_tags",
                                    "message": (
                                        f"Skill '{skill.code}' applies to modalities {sorted(skill_mods)}, "
                                        f"which does not include task type modality '{modality}'."
                                    ),
                                    "rule": "taxonomy",
                                    "metadata": {"skill_code": skill.code, "modalities": sorted(skill_mods), "task_modality": modality},
                                    "status_code": 422,
                                })
                        elif skill.domain:
                            domain = skill.domain.lower()
                            if domain in ("reading", "listening", "writing", "speaking") and domain != modality:
                                issues.append({
                                    "code": "INCOMPATIBLE_SKILL_TASK_TYPE",
                                    "severity": "blocking",
                                    "field": "skill_tags",
                                    "message": (
                                        f"Skill domain '{domain}' is incompatible with "
                                        f"task type modality '{modality}'."
                                    ),
                                    "rule": "taxonomy",
                                    "metadata": {"skill_domain": domain, "task_modality": modality},
                                    "status_code": 422,
                                })

        return resolved, issues

    @classmethod
    async def validate_skill_tags(
        cls,
        db: AsyncSession,
        tags: list[Any],
        task_type_id: uuid.UUID | None = None,
    ) -> list[Skill]:
        """Validate a skill tag list and return resolved Skill objects.

        Raises AppException for any violation.
        Returns the list of resolved Skill ORM objects in same order as input tags.
        """
        resolved, issues = await cls.audit_skill_tags(db, tags, task_type_id=task_type_id)
        if issues:
            first = issues[0]
            raise AppException(
                message=first["message"],
                code=first["code"],
                status_code=first.get("status_code", 400),
            )

        logger.debug(
            "tagging.validated",
            tag_count=len(tags),
            skill_ids=[str(s.id) for s in resolved],
        )
        return resolved
