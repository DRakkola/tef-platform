"""Level and preference compatibility engine for anonymous practice matchmaking."""

import uuid

from app.modules.practice_pool.enums import PracticeType

CEFR_LEVEL_RANKS: dict[str, int] = {
    "A1": 1,
    "A2": 2,
    "B1": 3,
    "B2": 4,
    "C1": 5,
    "C2": 6,
}


def is_level_compatible(level_a: str, level_b: str, max_step_difference: int = 1) -> bool:
    """Determine if two CEFR levels are close enough for effective oral practice.

    Default rule: within 1 step (e.g. B1 matches A2, B1, or B2; B2 matches B1, B2, or C1).
    """
    rank_a = CEFR_LEVEL_RANKS.get(level_a.upper(), 4)
    rank_b = CEFR_LEVEL_RANKS.get(level_b.upper(), 4)
    return abs(rank_a - rank_b) <= max_step_difference


def is_practice_type_compatible(type_a: PracticeType, type_b: PracticeType) -> bool:
    """Determine if requested practice modes can be paired."""
    if type_a == PracticeType.GENERAL_PRACTICE or type_b == PracticeType.GENERAL_PRACTICE:
        return True
    return type_a == type_b


def are_students_compatible(
    user_a_id: uuid.UUID,
    user_a_lang: str,
    user_a_level: str,
    user_a_type: PracticeType,
    user_b_id: uuid.UUID,
    user_b_lang: str,
    user_b_level: str,
    user_b_type: PracticeType,
    blocked_user_ids: set[uuid.UUID] | None = None,
) -> bool:
    """Check if two students satisfy all matchmaking constraints."""
    if user_a_id == user_b_id:
        return False

    if blocked_user_ids and (user_b_id in blocked_user_ids or user_a_id in blocked_user_ids):
        return False

    if user_a_lang.lower() != user_b_lang.lower():
        return False

    if not is_level_compatible(user_a_level, user_b_level):
        return False

    return is_practice_type_compatible(user_a_type, user_b_type)
