"""Tests for the Product Experimentation Engine."""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.modules.analytics.enums import EventType, ExperimentStatus
from app.modules.analytics.experiments_service import ExperimentsService, validate_experiment_safety
from app.modules.analytics.schemas import (
    ExperimentCreateRequest,
    ExperimentUpdateRequest,
    ExperimentVariantConfig,
)
from app.modules.analytics.service import AnalyticsService
from app.modules.users.models import User


def test_experiment_safety_invariants():
    """Ensure experiments targeting protected sensitive keywords are rejected."""
    protected_keys = [
        "payment_button_color",
        "checkout_flow_v2",
        "security_modal_skip",
        "auth_bypass_test",
        "tef_scoring_algorithm_v2",
        "retention_policy_bypass",
    ]
    for key in protected_keys:
        with pytest.raises(AppException) as exc:
            validate_experiment_safety(key)
        assert exc.value.status_code == 400
        assert "protected domain" in exc.value.message


@pytest.mark.asyncio
async def test_experiment_lifecycle_and_deterministic_assignment(
    db_session: AsyncSession,
    test_student: User,
):
    """Verify experiment creation, status transition, and deterministic variant assignment."""
    exp_key = f"onboarding_header_test_{uuid.uuid4().hex[:6]}"

    # 1. Create experiment in DRAFT
    req = ExperimentCreateRequest(
        key=exp_key,
        name="Onboarding Header Text Test",
        description="Testing conversion with motivating hero header",
        variants=[
            ExperimentVariantConfig(key="control", weight=50, config={"title": "Préparez votre TEF"}),
            ExperimentVariantConfig(key="variant_a", weight=50, config={"title": "Réussissez votre TEF Canada"}),
        ],
    )
    exp = await ExperimentsService.create_experiment(db=db_session, req=req)
    assert exp.key == exp_key
    assert exp.status == ExperimentStatus.DRAFT.value
    assert len(exp.variants) == 2

    # 2. Assigning while DRAFT returns None
    assigned_draft = await ExperimentsService.assign_user_variant(
        db=db_session, experiment_key=exp_key, user_id=test_student.id
    )
    assert assigned_draft is None

    # 3. Activate experiment
    update_req = ExperimentUpdateRequest(status=ExperimentStatus.ACTIVE)
    updated = await ExperimentsService.update_experiment(
        db=db_session, key=exp_key, req=update_req
    )
    assert updated.status == ExperimentStatus.ACTIVE.value

    # 4. Deterministic assignment
    v1 = await ExperimentsService.assign_user_variant(
        db=db_session, experiment_key=exp_key, user_id=test_student.id
    )
    assert v1 is not None
    assert v1.key in ["control", "variant_a"]

    # 5. Calling again with the same user yields the exact same variant (idempotent & persistent)
    v2 = await ExperimentsService.assign_user_variant(
        db=db_session, experiment_key=exp_key, user_id=test_student.id
    )
    assert v2 is not None
    assert v2.id == v1.id
    assert v2.key == v1.key


@pytest.mark.asyncio
async def test_experiment_results_evaluation(db_session: AsyncSession, test_student: User):
    """Verify conversion rate calculation for experiment variants."""
    exp_key = f"cta_style_test_{uuid.uuid4().hex[:6]}"

    req = ExperimentCreateRequest(
        key=exp_key,
        name="Call To Action Button Style",
        variants=[
            ExperimentVariantConfig(key="green_btn", weight=50, config={"color": "green"}),
            ExperimentVariantConfig(key="blue_btn", weight=50, config={"color": "blue"}),
        ],
    )
    await ExperimentsService.create_experiment(db=db_session, req=req)
    await ExperimentsService.update_experiment(
        db=db_session, key=exp_key, req=ExperimentUpdateRequest(status=ExperimentStatus.ACTIVE)
    )

    # Assign student
    assigned = await ExperimentsService.assign_user_variant(
        db=db_session, experiment_key=exp_key, user_id=test_student.id
    )
    assert assigned is not None

    # Emit conversion event
    await AnalyticsService.track(
        db=db_session,
        event_type=EventType.EXPERIMENT_CONVERTED.value,
        actor_id=test_student.id,
        metadata={"experiment_key": exp_key, "variant_key": assigned.key},
    )

    # Evaluate results
    results = await ExperimentsService.evaluate_experiment_results(
        db=db_session, experiment_key=exp_key
    )
    assert results.experiment_key == exp_key
    assert results.total_assignments == 1
    variant_res = next(v for v in results.variants if v.variant_key == assigned.key)
    assert variant_res.assigned_count == 1
    assert variant_res.conversion_count == 1
    assert variant_res.conversion_rate == 1.0
