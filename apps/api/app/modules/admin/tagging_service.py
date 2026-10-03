"""Canonical skill tagging validation engine for questions and exercises."""

import uuid
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.modules.admin.enums import SkillTagRole
from app.modules.assessments.models import Skill, TaskType

logger = structlog.get_logger("tef-api.admin.tagging")

# Domain/modality incompatibility pairs
_INCOMPATIBLE_PAIRS: frozenset[tuple[str, str]] = frozenset({
    ("speaking", "reading"),
    ("speaking", "listening"),
    ("writing", "reading"),
    ("writing", "listening"),
    ("reading", "speaking"),
    ("reading", "writing"),
    ("listening", "speaking"),
    ("listening", "writing"),
})

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

        # 6. Task type compatibility check
        if task_type_id is not None:
            task_type = await db.scalar(select(TaskType).where(TaskType.id == task_type_id))
            if task_type is not None and task_type.modality:
                modality = task_type.modality.lower()
                for skill in resolved:
                    if skill.domain:
                        domain = skill.domain.lower()
                        if (domain, modality) in _INCOMPATIBLE_PAIRS:
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
