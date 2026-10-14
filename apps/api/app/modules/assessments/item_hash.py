"""Canonical question identity hashing.

`Question.item_hash` is a 64-character hex digest, i.e. a SHA-256 of the
normalized prompt (and optionally stimulus and options/gaps for composite questions).
The baseline prompt normalization defined here is the single contract for
this value and stays byte-for-byte identical to the backfill performed by
Alembic revision ``0035_question_system_v2_foundation``:

    normalized = " ".join(prompt.strip().lower().split())
    item_hash = sha256(normalized.encode("utf-8")).hexdigest()

When stimulus and/or options/gaps are supplied, a composite representation
is derived so questions sharing standardized instructions (e.g. cloze reading,
reading comprehension directions) with distinct passages and choices are correctly
differentiated rather than erroneously flagged as duplicates.
"""

from __future__ import annotations

import hashlib
import uuid
from typing import Any

__all__ = ["compute_item_hash", "normalize_prompt_for_hash", "normalize_text_for_hash"]


def normalize_text_for_hash(text: str | None) -> str:
    """Return canonical whitespace-collapsed, lowercase string."""
    return " ".join((text or "").strip().lower().split())


normalize_prompt_for_hash = normalize_text_for_hash


def _normalize_options_for_hash(options: list[Any] | None) -> str:
    """Derive deterministic, sorted representation of question options."""
    if not options:
        return ""
    extracted: list[str] = []
    for opt in options:
        if isinstance(opt, str):
            c = normalize_text_for_hash(opt)
        elif isinstance(opt, dict):
            c = normalize_text_for_hash(opt.get("content") or opt.get("text") or "")
        else:
            c = normalize_text_for_hash(getattr(opt, "content", ""))
        if c:
            extracted.append(c)
    extracted.sort()
    return "|".join(extracted)


def _normalize_gaps_for_hash(gaps: list[Any] | None) -> str:
    """Derive deterministic representation of gaps with discrete options and expected answers."""
    if not gaps:
        return ""
    gap_parts: list[str] = []
    for g in gaps:
        if isinstance(g, dict):
            gid = str(g.get("gap_id") or g.get("id") or g.get("order_index") or "")
            opts = g.get("options") or []
            exp = g.get("expected_answers") or []
        else:
            gid = str(getattr(g, "gap_id", "") or getattr(g, "id", "") or getattr(g, "order_index", ""))
            opts = getattr(g, "options", []) or []
            exp = getattr(g, "expected_answers", []) or []

        opt_str = _normalize_options_for_hash(opts)
        exp_list = exp if isinstance(exp, list) else [exp]
        exp_str = "|".join(sorted(normalize_text_for_hash(str(e)) for e in exp_list if str(e).strip()))
        gap_parts.append(f"{gid}:o={opt_str}:e={exp_str}")
    gap_parts.sort()
    return ";".join(gap_parts)


def compute_item_hash(
    prompt: str | None,
    stimulus_text: str | None = None,
    stimulus_title: str | None = None,
    stimulus_id: uuid.UUID | str | None = None,
    options: list[Any] | None = None,
    gaps: list[Any] | None = None,
) -> str:
    """Compute the deterministic ``item_hash`` for a question prompt.

    If only prompt is provided (and no stimulus or options/gaps),
    returns the exact canonical SHA-256(normalized prompt) byte-for-byte
    identical to Alembic revision 0035.

    When stimulus or options/gaps are present, computes a composite digest
    encompassing the full question identity (prompt + stimulus + options/gaps)
    so that questions sharing generic directions with distinct passages and choices
    are correctly identified as distinct items.
    """
    normalized_prompt = normalize_prompt_for_hash(prompt)

    # Derive canonical stimulus representation
    norm_stim = ""
    stim_parts: list[str] = []
    if stimulus_title and str(stimulus_title).strip():
        stim_parts.append(normalize_text_for_hash(str(stimulus_title)))
    if stimulus_text and str(stimulus_text).strip():
        stim_parts.append(normalize_text_for_hash(str(stimulus_text)))
    if stim_parts:
        norm_stim = " ".join(stim_parts)
    elif stimulus_id:
        norm_stim = str(stimulus_id).strip().lower()

    norm_opts = _normalize_options_for_hash(options)
    norm_gaps = _normalize_gaps_for_hash(gaps)

    # If neither stimulus nor options/gaps are present, maintain exact baseline prompt hash
    if not norm_stim and not norm_opts and not norm_gaps:
        return hashlib.sha256(normalized_prompt.encode("utf-8")).hexdigest()

    parts = [f"p:{normalized_prompt}"]
    if norm_stim:
        parts.append(f"s:{norm_stim}")
    if norm_gaps:
        parts.append(f"g:{norm_gaps}")
    elif norm_opts:
        parts.append(f"o:{norm_opts}")

    composite = "||".join(parts)
    return hashlib.sha256(composite.encode("utf-8")).hexdigest()