"""Canonical question identity hashing.

`Question.item_hash` is a 64-character hex digest, i.e. a SHA-256 of the
normalized prompt. The normalization defined here is the *single* contract for
this value and MUST stay byte-for-byte identical to the backfill performed by
Alembic revision ``0035_question_system_v2_foundation``:

    normalized = " ".join(prompt.strip().lower().split())
    item_hash = sha256(normalized.encode("utf-8")).hexdigest()

Collapsing internal whitespace matters: the digest must be insensitive to
inconsistent line wrapping and indentation, otherwise visually identical
questions would hash differently and defeat duplicate detection.
"""

from __future__ import annotations

import hashlib

__all__ = ["compute_item_hash", "normalize_prompt_for_hash"]


def normalize_prompt_for_hash(prompt: str | None) -> str:
    """Return the canonical prompt normalization used to derive ``item_hash``."""
    return " ".join((prompt or "").strip().lower().split())


def compute_item_hash(prompt: str | None) -> str:
    """Compute the deterministic ``item_hash`` for a question prompt.

    An empty prompt still yields a stable digest rather than ``None`` so that
    callers never have to special-case the degenerate input. The uniqueness
    guard belongs on the row, not on the hash.
    """
    normalized = normalize_prompt_for_hash(prompt)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()