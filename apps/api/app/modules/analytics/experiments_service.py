"""Product Experimentation Engine: deterministic A/B assignment, safety invariant enforcement, and evaluation."""

import hashlib
import uuid
from typing import Any

import structlog
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.modules.analytics.enums import EventType, ExperimentStatus
from app.modules.analytics.models import (
    AnalyticsEvent,
    Experiment,
    ExperimentAssignment,
    ExperimentVariant,
)
from app.modules.analytics.schemas import (
    ExperimentCreateRequest,
    ExperimentResponse,
    ExperimentResultItem,
    ExperimentResultsResponse,
    ExperimentUpdateRequest,
    ExperimentVariantResponse,
)
from app.modules.analytics.service import AnalyticsService

logger = structlog.get_logger("tef-api.experiments")

# Invariant safety: prohibited domains where A/B experimentation is strictly forbidden
FORBIDDEN_EXPERIMENT_KEYWORDS = {
    "payment",
    "checkout",
    "security",
    "auth",
    "scoring",
    "retention",
}


def validate_experiment_safety(key: str, target_audience: dict[str, Any] | None = None) -> None:
    """Enforces safety invariants preventing experiments from altering security, auth, billing, or TEF scoring."""
    lower_key = key.lower()
    for forbidden in FORBIDDEN_EXPERIMENT_KEYWORDS:
        if forbidden in lower_key:
            raise AppException(
                status_code=400,
                message=f"Experiment key '{key}' violates platform safety invariant: '{forbidden}' is a protected domain.",
            )

    if target_audience:
        target_str = str(target_audience).lower()
        for forbidden in FORBIDDEN_EXPERIMENT_KEYWORDS:
            if forbidden in target_str:
                raise AppException(
                    status_code=400,
                    message=f"Experiment target audience contains protected keyword '{forbidden}'.",
                )


class ExperimentsService:
    """Service providing deterministic hash assignment and controlled experiment lifecycle."""

    @classmethod
    async def create_experiment(
        cls,
        db: AsyncSession,
        req: ExperimentCreateRequest,
    ) -> ExperimentResponse:
        """Validates and creates a new experiment with configured variants."""
        validate_experiment_safety(req.key, req.target_audience)

        existing = await db.scalar(select(Experiment).where(Experiment.key == req.key))
        if existing:
            raise AppException(
                status_code=409,
                message=f"Experiment with key '{req.key}' already exists.",
            )

        # Validate variant keys are unique and weights are valid
        variant_keys = [v.key for v in req.variants]
        if len(variant_keys) != len(set(variant_keys)):
            raise AppException(status_code=400, message="Experiment variant keys must be unique.")

        experiment = Experiment(
            id=uuid.uuid4(),
            key=req.key,
            name=req.name,
            description=req.description,
            status=ExperimentStatus.DRAFT,
            target_audience=req.target_audience,
        )
        db.add(experiment)
        await db.flush()

        created_variants: list[ExperimentVariant] = []
        for v in req.variants:
            var = ExperimentVariant(
                id=uuid.uuid4(),
                experiment_id=experiment.id,
                key=v.key,
                weight=v.weight,
                config_payload=v.config,
            )
            db.add(var)
            created_variants.append(var)

        await db.commit()
        await db.refresh(experiment)

        return ExperimentResponse(
            id=experiment.id,
            key=experiment.key,
            name=experiment.name,
            description=experiment.description,
            status=experiment.status.value,
            variants=[
                ExperimentVariantResponse(
                    id=v.id,
                    key=v.key,
                    weight=v.weight,
                    config_payload=v.config_payload,
                )
                for v in created_variants
            ],
            created_at=experiment.created_at,
            updated_at=experiment.updated_at,
        )

    @classmethod
    async def list_experiments(cls, db: AsyncSession) -> list[ExperimentResponse]:
        """Lists all product experiments and their variant definitions."""
        result = await db.scalars(
            select(Experiment).options(selectinload(Experiment.variants)).order_by(Experiment.created_at.desc())
        )
        experiments = list(result.all())

        return [
            ExperimentResponse(
                id=exp.id,
                key=exp.key,
                name=exp.name,
                description=exp.description,
                status=exp.status.value,
                variants=[
                    ExperimentVariantResponse(
                        id=v.id,
                        key=v.key,
                        weight=v.weight,
                        config_payload=v.config_payload,
                    )
                    for v in exp.variants
                ],
                created_at=exp.created_at,
                updated_at=exp.updated_at,
            )
            for exp in experiments
        ]

    @classmethod
    async def get_experiment(cls, db: AsyncSession, key: str) -> Experiment | None:
        """Fetches an experiment by key including variants."""
        return await db.scalar(
            select(Experiment)
            .options(selectinload(Experiment.variants))
            .where(Experiment.key == key)
        )

    @classmethod
    async def update_experiment(
        cls,
        db: AsyncSession,
        key: str,
        req: ExperimentUpdateRequest,
    ) -> ExperimentResponse:
        """Updates metadata or transitions experiment lifecycle (DRAFT -> ACTIVE -> PAUSED -> CONCLUDED)."""
        exp = await cls.get_experiment(db, key)
        if not exp:
            raise AppException(status_code=404, message=f"Experiment '{key}' not found.")

        if req.name is not None:
            exp.name = req.name
        if req.description is not None:
            exp.description = req.description
        if req.status is not None:
            exp.status = req.status

        await db.commit()
        await db.refresh(exp)

        return ExperimentResponse(
            id=exp.id,
            key=exp.key,
            name=exp.name,
            description=exp.description,
            status=exp.status.value,
            variants=[
                ExperimentVariantResponse(
                    id=v.id,
                    key=v.key,
                    weight=v.weight,
                    config_payload=v.config_payload,
                )
                for v in exp.variants
            ],
            created_at=exp.created_at,
            updated_at=exp.updated_at,
        )

    @classmethod
    async def assign_user_variant(
        cls,
        db: AsyncSession,
        experiment_key: str,
        user_id: uuid.UUID,
    ) -> ExperimentVariant | None:
        """Deterministically assigns a user to an experiment variant using SHA-256 hash partitioning."""
        exp = await cls.get_experiment(db, experiment_key)
        if not exp or exp.status != ExperimentStatus.ACTIVE or not exp.variants:
            return None

        # 1. Check existing assignment to maintain deterministic consistency
        existing_assignment = await db.scalar(
            select(ExperimentAssignment).where(
                ExperimentAssignment.experiment_id == exp.id,
                ExperimentAssignment.user_id == user_id,
            )
        )
        if existing_assignment:
            for v in exp.variants:
                if v.id == existing_assignment.variant_id:
                    return v

        # 2. Deterministic assignment via SHA-256
        hash_input = f"{user_id}:{experiment_key}".encode("utf-8")
        hash_hex = hashlib.sha256(hash_input).hexdigest()
        bucket = int(hash_hex[:8], 16) % 100

        # Sort variants by key for consistent accumulation order
        sorted_variants = sorted(exp.variants, key=lambda x: x.key)
        total_weight = sum(v.weight for v in sorted_variants) or 100

        running_sum = 0
        assigned_variant: ExperimentVariant = sorted_variants[0]

        for v in sorted_variants:
            normalized_weight = int((v.weight / total_weight) * 100)
            running_sum += normalized_weight
            if bucket < running_sum:
                assigned_variant = v
                break

        # 3. Persist assignment
        assignment = ExperimentAssignment(
            id=uuid.uuid4(),
            experiment_id=exp.id,
            user_id=user_id,
            variant_id=assigned_variant.id,
        )
        db.add(assignment)
        await db.commit()

        # 4. Emit telemetry
        await AnalyticsService.track(
            db=db,
            event_type=EventType.EXPERIMENT_ASSIGNED.value,
            actor_id=user_id,
            entity_type="experiment",
            entity_id=exp.id,
            metadata={
                "experiment_key": experiment_key,
                "variant_key": assigned_variant.key,
            },
        )

        return assigned_variant

    @classmethod
    async def evaluate_experiment_results(
        cls,
        db: AsyncSession,
        experiment_key: str,
    ) -> ExperimentResultsResponse:
        """Evaluates conversion performance across all variants for an experiment."""
        exp = await cls.get_experiment(db, experiment_key)
        if not exp:
            raise AppException(status_code=404, message=f"Experiment '{experiment_key}' not found.")

        # Total assignments per variant
        variant_stats: list[ExperimentResultItem] = []
        total_assignments = 0

        for variant in exp.variants:
            assigned_count = await db.scalar(
                select(func.count(ExperimentAssignment.id)).where(
                    ExperimentAssignment.experiment_id == exp.id,
                    ExperimentAssignment.variant_id == variant.id,
                )
            ) or 0
            total_assignments += assigned_count

            # Count conversions: users assigned to this variant who emitted EXPERIMENT_CONVERTED
            assigned_user_ids = select(ExperimentAssignment.user_id).where(
                ExperimentAssignment.experiment_id == exp.id,
                ExperimentAssignment.variant_id == variant.id,
            )
            conversions = await db.scalar(
                select(func.count(distinct(AnalyticsEvent.actor_id))).where(
                    AnalyticsEvent.event_type.in_([
                        EventType.EXPERIMENT_CONVERTED.value,
                        "experiment_converted",
                    ]),
                    AnalyticsEvent.actor_id.in_(assigned_user_ids),
                )
            ) or 0

            rate = round((conversions / assigned_count) if assigned_count > 0 else 0.0, 4)
            variant_stats.append(
                ExperimentResultItem(
                    variant_key=variant.key,
                    assigned_count=assigned_count,
                    conversion_count=conversions,
                    conversion_rate=rate,
                )
            )

        return ExperimentResultsResponse(
            experiment_key=exp.key,
            status=exp.status.value,
            total_assignments=total_assignments,
            variants=variant_stats,
        )
