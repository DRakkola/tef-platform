"""Unit and invariant tests for the TEF Readiness Engine & Adaptive Learning Engine.

Verifies:
1. Confidence score separation from performance score
2. Strict mathematical bounds: confidence in [0.0, 1.0], scores in [0.0, 100.0]
3. Exponential time-decay calculation (lambda = ln(2)/45)
4. Source type weighting (assessment 1.0, teacher 0.95, ai 0.85, exercise 0.70, practice 0.60)
5. Controlled readiness bands: returns 'insufficient_data' when evidence is below threshold
6. Blocking skill criteria: requires >= 2 observations, confidence >= 0.35, gap >= 10
7. CEFR/NCLC internal mapping provider
8. Adaptive difficulty selection: appropriate / challenging / too_easy tiers
"""

import datetime
import math
import uuid
import pytest
from app.modules.learning.adaptive_selector import AdaptiveDifficultySelector
from app.modules.learning.assessment_mapping import InternalNormalizedMappingProvider
from app.modules.learning.readiness_engine import ReadinessEngine
from app.modules.learning.readiness_models import ReadinessBand, SkillEvidenceSourceType


def test_confidence_bounds_and_separation():
    """Confidence must be strictly separated from score and bounded in [0.0, 1.0]."""
    # 0 observations -> confidence 0.0, insufficient data
    conf, label, is_insufficient = ReadinessEngine.calculate_skill_confidence(
        observation_count=0,
        source_types=set(),
        scores=[],
        days_since_last=0.0,
    )
    assert conf == 0.0
    assert label == "insufficient_data"
    assert is_insufficient is True

    # 1 observation -> insufficient data (< 2 observations required)
    conf_1, label_1, is_insufficient_1 = ReadinessEngine.calculate_skill_confidence(
        observation_count=1,
        source_types={"assessment"},
        scores=[85.0],
        days_since_last=2.0,
    )
    assert 0.0 <= conf_1 <= 1.0
    assert is_insufficient_1 is True

    # 6 diverse observations with low variance and high-trust sources
    conf_high, label_high, is_insufficient_high = ReadinessEngine.calculate_skill_confidence(
        observation_count=6,
        source_types={"assessment", "teacher_evaluation", "exercise"},
        scores=[72.0, 74.0, 71.0, 75.0, 73.0, 74.0],
        days_since_last=3.0,
    )
    assert 0.0 <= conf_high <= 1.0
    assert conf_high >= 0.70
    assert label_high == "high"
    assert is_insufficient_high is False


def test_exponential_time_decay_math():
    """Verify exponential time decay half-life of 45 days."""
    # Delta = 0 days -> decay factor = 1.0
    weight_0 = ReadinessEngine.calculate_recency_weight(0.0)
    assert weight_0 == pytest.approx(1.0, abs=1e-4)

    # Delta = 45 days -> decay factor = 0.50
    weight_45 = ReadinessEngine.calculate_recency_weight(45.0)
    assert weight_45 == pytest.approx(0.50, abs=1e-2)

    # Delta = 90 days -> decay factor = 0.25
    weight_90 = ReadinessEngine.calculate_recency_weight(90.0)
    assert weight_90 == pytest.approx(0.25, abs=1e-2)

    # Monotonic decrease
    assert weight_0 > weight_45 > weight_90 > 0.0


def test_source_weights_hierarchy():
    """Verify source weight configuration reflects reliability hierarchy."""
    weights = ReadinessEngine.SOURCE_WEIGHTS
    assert weights["assessment"] == 1.00
    assert weights["teacher_evaluation"] == 0.95
    assert weights["ai_evaluation"] == 0.85
    assert weights["exercise"] == 0.70
    assert weights["practice"] == 0.60
    assert (
        weights["assessment"]
        > weights["teacher_evaluation"]
        > weights["ai_evaluation"]
        > weights["exercise"]
        > weights["practice"]
    )


def test_readiness_band_assignment():
    """Readiness band assignment must strictly follow specified criteria and never claim certainty."""
    # Insufficient data: less than 2 core skills
    skills_insufficient = [
        {"category": "reading", "estimate": 75.0, "confidence": 0.8, "insufficient_data": False},
        {"category": "grammar", "estimate": 70.0, "confidence": 0.8, "insufficient_data": False},
    ]
    est, lvl, conf, clbl, band = ReadinessEngine.calculate_overall_readiness(
        skills_summary=skills_insufficient,
        target_level="B2",
    )
    assert band == ReadinessBand.INSUFFICIENT_DATA
    assert est is None

    # Target consistent: core skills average >= target (70 for B2), no major deficit
    skills_consistent = [
        {"category": "reading", "estimate": 72.0, "confidence": 0.8, "insufficient_data": False},
        {"category": "listening", "estimate": 70.0, "confidence": 0.8, "insufficient_data": False},
    ]
    est_c, lvl_c, conf_c, _, band_c = ReadinessEngine.calculate_overall_readiness(
        skills_summary=skills_consistent,
        target_level="B2",
    )
    assert band_c == ReadinessBand.TARGET_CONSISTENT
    assert est_c >= 70.0

    # Near target: between 57 and 64.9 for B2 (threshold 65.0)
    skills_near = [
        {"category": "reading", "estimate": 60.0, "confidence": 0.8, "insufficient_data": False},
        {"category": "listening", "estimate": 62.0, "confidence": 0.8, "insufficient_data": False},
    ]
    _, _, _, _, band_near = ReadinessEngine.calculate_overall_readiness(
        skills_summary=skills_near,
        target_level="B2",
    )
    assert band_near == ReadinessBand.NEAR_TARGET

    # Progressing: between 8 and 20 points below target
    skills_prog = [
        {"category": "reading", "estimate": 55.0, "confidence": 0.8, "insufficient_data": False},
        {"category": "listening", "estimate": 58.0, "confidence": 0.8, "insufficient_data": False},
    ]
    _, _, _, _, band_prog = ReadinessEngine.calculate_overall_readiness(
        skills_summary=skills_prog,
        target_level="B2",
    )
    assert band_prog == ReadinessBand.PROGRESSING


def test_target_gap_and_priority_calculation():
    """Verify target gap calculation and urgency prioritization."""
    sk_id = uuid.uuid4()
    # 15 points below target, core skill, 20 days until exam
    gap_urgent = ReadinessEngine.calculate_target_gap(
        skill_id=sk_id,
        skill_name="Compréhension écrite",
        category="reading",
        current_estimate=55.0,
        confidence=0.75,
        target_level="B2",
        days_remaining=20,
        mistake_count=3,
    )
    assert gap_urgent["gap"] == 10.0
    assert gap_urgent["priority"] > 0
    assert gap_urgent["urgency"] == "urgent"

    # Same skill, but 100 days until exam
    gap_relaxed = ReadinessEngine.calculate_target_gap(
        skill_id=sk_id,
        skill_name="Compréhension écrite",
        category="reading",
        current_estimate=55.0,
        confidence=0.75,
        target_level="B2",
        days_remaining=100,
        mistake_count=3,
    )
    assert gap_urgent["priority"] > gap_relaxed["priority"]


def test_identify_blocking_skills_criteria():
    """Blocking skills require confidence >= 0.35 and material gap >= 10.0."""
    gaps = [
        {
            "skill_id": uuid.uuid4(),
            "skill_name": "Grammaire avancée",
            "category": "grammar",
            "current_estimate": 45.0,
            "target_estimate": 70.0,
            "gap": 25.0,
            "confidence": 0.20,  # Below threshold -> NOT a blocker
            "priority": 50,
        },
        {
            "skill_id": uuid.uuid4(),
            "skill_name": "Compréhension orale",
            "category": "listening",
            "current_estimate": 52.0,
            "target_estimate": 70.0,
            "gap": 18.0,
            "confidence": 0.80,  # Above threshold -> IS a blocker
            "priority": 75,
        },
        {
            "skill_id": uuid.uuid4(),
            "skill_name": "Compréhension écrite",
            "category": "reading",
            "current_estimate": 66.0,
            "target_estimate": 70.0,
            "gap": 4.0,  # Less than 10 pts -> NOT a blocker
            "confidence": 0.85,
            "priority": 30,
        },
    ]

    blockers = ReadinessEngine.identify_blocking_skills(gaps, min_gap_threshold=10.0)
    assert len(blockers) == 1
    assert blockers[0]["skill_name"] == "Compréhension orale"
    assert blockers[0]["gap"] == 18.0


def test_cefr_nclc_internal_mapping():
    """Internal mapping provider should return consistent CEFR & NCLC ranges."""
    provider = InternalNormalizedMappingProvider()

    # B2 threshold (70.0)
    est_b2 = provider.map_score_to_estimate(70.0)
    assert est_b2["estimated_cefr"] == "B2"
    assert est_b2["estimated_nclc"] == "NCLC 7"

    # C1 threshold (85.0)
    est_c1 = provider.map_score_to_estimate(85.0)
    assert est_c1["estimated_cefr"] == "C1"
    assert est_c1["estimated_nclc"] == "NCLC 9"

    # A2 threshold (40.0)
    est_a2 = provider.map_score_to_estimate(40.0)
    assert est_a2["estimated_cefr"] == "A2"
    assert est_a2["estimated_nclc"] == "NCLC 4"


def test_adaptive_difficulty_selector_tiers():
    """Adaptive difficulty categorizes exercises properly according to student estimate."""
    # When uncalibrated (None), low difficulty is appropriate, high difficulty is challenging
    assert AdaptiveDifficultySelector.evaluate_exercise_tier("B1", 2, None, "B2") == "appropriate"
    assert AdaptiveDifficultySelector.evaluate_exercise_tier("B2", 4, None, "B2") == "challenging"

    # High estimate (85%) -> B1 exercise is too_easy
    assert AdaptiveDifficultySelector.evaluate_exercise_tier("B1", 2, 85.0, "B2") == "too_easy"

    # Matching estimate (70%) -> B2 exercise is appropriate
    assert AdaptiveDifficultySelector.evaluate_exercise_tier("B2", 3, 70.0, "B2") == "appropriate"
