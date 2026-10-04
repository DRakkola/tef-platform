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
        if not tags:
            return []

        # 1. Duplicate skill_id check
        seen_skill_ids: set[uuid.UUID] = set()
        for tag in tags:
            if tag.skill_id in seen_skill_ids:
                raise AppException(
                    message=f"Duplicate skill_id {tag.skill_id} in tag list.",
                    code="DUPLICATE_SKILL_TAG",
                    status_code=400,
                )
            seen_skill_ids.add(tag.skill_id)

        # 2. Resolve all skills in one query
        skill_ids = [tag.skill_id for tag in tags]
        result = await db.execute(select(Skill).where(Skill.id.in_(skill_ids)))
        skill_map: dict[uuid.UUID, Skill] = {s.id: s for s in result.scalars().all()}

        resolved: list[Skill] = []
        for tag in tags:
            skill = skill_map.get(tag.skill_id)
            if skill is None:
                raise AppException(
                    message=f"Skill {tag.skill_id} not found.",
                    code="INACTIVE_OR_MISSING_SKILL",
                    status_code=422,
                )
            if not skill.is_active:
                raise AppException(
                    message=f"Skill '{skill.code}' is archived and cannot be tagged on new content.",
                    code="INACTIVE_OR_MISSING_SKILL",
                    status_code=422,
                )
            resolved.append(skill)

        # 3. Individual weight validation
        for tag in tags:
            if not (0.0 < tag.weight <= 1.0):
                raise AppException(
                    message=f"Tag weight {tag.weight} for skill {tag.skill_id} is invalid. Must be 0 < weight <= 1.0.",
                    code="INVALID_TAG_WEIGHT",
                    status_code=400,
                )

        # 4. Dimension weight sum validation
        # Group tags by dimension (skip if skill.dimension is None)
        dimension_weights: dict[str, float] = {}
        for tag, skill in zip(tags, resolved):
            if skill.dimension is not None:
                dim = skill.dimension.value if hasattr(skill.dimension, "value") else str(skill.dimension)
                dimension_weights[dim] = dimension_weights.get(dim, 0.0) + tag.weight

        for dim, total_weight in dimension_weights.items():
            if abs(total_weight - 1.0) > _WEIGHT_TOLERANCE:
                raise AppException(
                    message=(
                        f"Weights for dimension '{dim}' sum to {total_weight:.4f}, "
                        f"must equal 1.0 ± {_WEIGHT_TOLERANCE}."
                    ),
                    code="INVALID_TAG_WEIGHT",
                    status_code=400,
                )

        # 5. At most one PRIMARY per dimension
        primary_per_dim: dict[str, int] = {}
        for tag, skill in zip(tags, resolved):
            role = tag.role if hasattr(tag, "role") else SkillTagRole.PRIMARY
            if role == SkillTagRole.PRIMARY and skill.dimension is not None:
                dim = skill.dimension.value if hasattr(skill.dimension, "value") else str(skill.dimension)
                primary_per_dim[dim] = primary_per_dim.get(dim, 0) + 1
                if primary_per_dim[dim] > 1:
                    raise AppException(
                        message=f"More than one PRIMARY skill tag for dimension '{dim}'.",
                        code="MULTIPLE_PRIMARY_PER_DIMENSION",
                        status_code=400,
                    )

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
                            raise AppException(
                                message=(
                                    f"Competency '{skill.code}' is not supported by "
                                    f"task type '{task_type.name}' ({task_type.code})."
                                ),
                                code="INCOMPATIBLE_SKILL_TASK_TYPE",
                                status_code=422,
                            )

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
                                raise AppException(
                                    message=(
                                        f"Skill '{skill.code}' applies to modalities {sorted(skill_mods)}, "
                                        f"which does not include task type modality '{modality}'."
                                    ),
                                    code="INCOMPATIBLE_SKILL_TASK_TYPE",
                                    status_code=422,
                                )
                        elif skill.domain:
                            # Fallback check for unmigrated skills where skill_modalities hasn't been populated
                            domain = skill.domain.lower()
                            if domain in ("reading", "listening", "writing", "speaking") and domain != modality:
                                raise AppException(
                                    message=(
                                        f"Skill domain '{domain}' is incompatible with "
                                        f"task type modality '{modality}'."
                                    ),
                                    code="INCOMPATIBLE_SKILL_TASK_TYPE",
                                    status_code=422,
                                )

        logger.debug(
            "tagging.validated",
            tag_count=len(tags),
            skill_ids=[str(s.id) for s in resolved],
        )
        return resolved
