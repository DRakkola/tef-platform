"""Canonical Question V2 Serializer and Snapshot Utility.

Provides deterministic projections of Question entities for:
1. Student active test-taking (strictly sanitized; zero leak of answer keys or distractor rationales)
2. Admin authoring and pedagogical inspection (full metadata, rationales, validations, provenance)
3. Immutable version snapshots (frozen snapshot payload for QuestionVersion auditability)
"""

from __future__ import annotations

import datetime
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.modules.assessments.models import (
        Question,
    )

# Forbidden keys in student-facing views
FORBIDDEN_STUDENT_KEYS: frozenset[str] = frozenset({
    "is_correct",
    "misconception_type",
    "distractor_rationale",
    "scoring_payload",
    "validations",
    "provenance",
})


class QuestionSecurityViolation(Exception):
    """Raised when an internal diagnostic or answer key leaks into a student payload."""


class QuestionSerializer:
    """Canonical serializer and snapshot builder for Question entities."""

    @classmethod
    def to_student_dict(cls, question: Question) -> dict[str, Any]:
        """Serialize a question for student test-taking.

        Guarantees that no answer keys, distractor rationales, misconception types,
        or internal validation logs are leaked to the student.
        """
        options_data = []
        if getattr(question, "options", None):
            for opt in sorted(question.options, key=lambda o: o.order_index):
                options_data.append({
                    "id": str(opt.id),
                    "content": opt.content,
                    "order_index": opt.order_index,
                })

        stimulus_data = None
        if getattr(question, "stimulus", None) and question.stimulus:
            stim = question.stimulus
            stimulus_data = {
                "id": str(stim.id),
                "title": stim.title,
                "modality": stim.modality,
                "content_text": stim.content_text,
                "text_format": stim.text_format,
                "word_count": stim.word_count,
                "media_url": stim.media_url,
                "source_citation": stim.source_citation,
            }

        skill_tags_data = []
        if getattr(question, "skill_tags", None):
            for tag in question.skill_tags:
                skill_tags_data.append({
                    "id": str(tag.id),
                    "skill_id": str(tag.skill_id),
                    "subskill": getattr(tag, "subskill", None),
                    "weight": tag.weight,
                })

        q_type = question.question_type
        q_type_str = q_type.value if hasattr(q_type, "value") else str(q_type)

        sec_id = getattr(question, "section_id", None)
        sec_assocs = question.__dict__.get("section_associations") if hasattr(question, "__dict__") else None
        if not sec_id and sec_assocs:
            sec_id = sec_assocs[0].assessment_section_id

        student_payload: dict[str, Any] = {
            "id": str(question.id),
            "section_id": str(sec_id) if sec_id else None,
            "stimulus_id": str(question.stimulus_id) if getattr(question, "stimulus_id", None) else None,
            "stimulus": stimulus_data,
            "prompt": question.prompt,
            "instructions": question.instructions,
            "question_type": q_type_str,
            "response_type": question.response_type or "single_choice",
            "order_index": question.order_index,
            "level": question.level,
            "target_cefr": question.target_cefr,
            "difficulty": question.difficulty,
            "difficulty_rating": question.difficulty_rating,
            "cognitive_complexity": question.cognitive_complexity,
            "points": question.points,
            "media_url": question.media_url,
            "options": options_data,
            "skill_tags": skill_tags_data,
        }

        # Validate security invariants before returning
        cls.assert_no_student_leak(student_payload)
        return student_payload

    @classmethod
    def to_admin_dict(cls, question: Question) -> dict[str, Any]:
        """Serialize a question for administrative authoring and inspection.

        Includes full diagnostic metadata, distractor rationales, validation results,
        and provenance tracking.
        """
        options_data = []
        if getattr(question, "options", None):
            for opt in sorted(question.options, key=lambda o: o.order_index):
                options_data.append({
                    "id": str(opt.id),
                    "question_id": str(opt.question_id),
                    "content": opt.content,
                    "order_index": opt.order_index,
                    "is_correct": opt.is_correct,
                    "explanation": opt.explanation,
                    "misconception_type": opt.misconception_type,
                    "distractor_rationale": opt.distractor_rationale,
                })

        stimulus_data = None
        if getattr(question, "stimulus", None) and question.stimulus:
            stim = question.stimulus
            stimulus_data = {
                "id": str(stim.id),
                "title": stim.title,
                "modality": stim.modality,
                "content_text": stim.content_text,
                "text_format": stim.text_format,
                "word_count": stim.word_count,
                "register": stim.register,
                "media_asset_id": str(stim.media_asset_id) if stim.media_asset_id else None,
                "media_url": stim.media_url,
                "source_citation": stim.source_citation,
                "content_hash": stim.content_hash,
                "created_at": stim.created_at.isoformat() if stim.created_at else None,
                "updated_at": stim.updated_at.isoformat() if stim.updated_at else None,
            }

        skill_tags_data = []
        if getattr(question, "skill_tags", None):
            for tag in question.skill_tags:
                role_val = tag.role.value if hasattr(tag.role, "value") else str(tag.role)
                skill_tags_data.append({
                    "id": str(tag.id),
                    "skill_id": str(tag.skill_id),
                    "subskill_id": str(tag.subskill_id) if getattr(tag, "subskill_id", None) else None,
                    "subskill": getattr(tag, "subskill", None),
                    "role": role_val,
                    "weight": tag.weight,
                    "context": getattr(tag, "context", None),
                })

        validations_data = []
        if getattr(question, "validations", None):
            for val in question.validations:
                validations_data.append({
                    "id": str(val.id),
                    "question_id": str(val.question_id),
                    "validation_status": val.validation_status,
                    "blocking_error_count": val.blocking_error_count,
                    "warning_count": val.warning_count,
                    "issues_payload": val.issues_payload or [],
                    "checked_at": val.checked_at.isoformat() if val.checked_at else None,
                    "validated_by_system_version": val.validated_by_system_version,
                })

        provenance_data = None
        if getattr(question, "provenance", None) and question.provenance:
            prov = question.provenance
            provenance_data = {
                "id": str(prov.id),
                "question_id": str(prov.question_id),
                "author_type": prov.author_type,
                "source_type": prov.source_type,
                "source_reference": prov.source_reference,
                "generator_model": prov.generator_model,
                "generator_prompt_version": prov.generator_prompt_version,
                "generator_parameters": prov.generator_parameters,
                "taxonomy_version_id": str(prov.taxonomy_version_id) if prov.taxonomy_version_id else None,
                "created_by_user_id": str(prov.created_by_user_id) if prov.created_by_user_id else None,
                "reviewed_by_user_id": str(prov.reviewed_by_user_id) if prov.reviewed_by_user_id else None,
                "reviewed_at": prov.reviewed_at.isoformat() if prov.reviewed_at else None,
                "review_notes": prov.review_notes,
                "created_at": prov.created_at.isoformat() if prov.created_at else None,
            }

        q_type = question.question_type
        q_type_str = q_type.value if hasattr(q_type, "value") else str(q_type)

        admin_sec_id = getattr(question, "section_id", None)
        sec_assocs = question.__dict__.get("section_associations") if hasattr(question, "__dict__") else None
        if not admin_sec_id and sec_assocs:
            admin_sec_id = sec_assocs[0].assessment_section_id

        return {
            "id": str(question.id),
            "section_id": str(admin_sec_id) if admin_sec_id else None,
            "stimulus_id": str(question.stimulus_id) if question.stimulus_id else None,
            "stimulus": stimulus_data,
            "question_type": q_type_str,
            "response_type": question.response_type or "single_choice",
            "prompt": question.prompt,
            "instructions": question.instructions,
            "media_url": question.media_url,
            "order_index": question.order_index,
            "difficulty": question.difficulty,
            "difficulty_rating": question.difficulty_rating,
            "level": question.level,
            "target_cefr": question.target_cefr,
            "cognitive_complexity": question.cognitive_complexity,
            "explanation": question.explanation,
            "points": question.points,
            "penalty_points": question.penalty_points,
            "scoring_payload": question.scoring_payload,
            "status": question.status,
            "version": question.version,
            "is_live_delivered": question.is_live_delivered,
            "item_hash": question.item_hash,
            "task_type_id": str(question.task_type_id) if question.task_type_id else None,
            "created_by_user_id": str(question.created_by_user_id) if question.created_by_user_id else None,
            "updated_by_user_id": str(question.updated_by_user_id) if question.updated_by_user_id else None,
            "created_at": question.created_at.isoformat() if question.created_at else None,
            "updated_at": question.updated_at.isoformat() if question.updated_at else None,
            "options": options_data,
            "skill_tags": skill_tags_data,
            "validations": validations_data,
            "provenance": provenance_data,
        }

    @classmethod
    def to_frozen_snapshot(
        cls,
        question: Question,
        changelog: str | None = None,
    ) -> dict[str, Any]:
        """Build an immutable, self-contained snapshot payload for QuestionVersion.

        This payload preserves the exact state of the item (including embedded stimulus,
        distractors, scoring configuration, and pedagogical mappings) independently of
        future database mutations.
        """
        options_snapshot = []
        if getattr(question, "options", None):
            for opt in sorted(question.options, key=lambda o: o.order_index):
                options_snapshot.append({
                    "id": str(opt.id),
                    "content": opt.content,
                    "order_index": opt.order_index,
                    "is_correct": opt.is_correct,
                    "explanation": opt.explanation,
                    "misconception_type": opt.misconception_type,
                    "distractor_rationale": opt.distractor_rationale,
                })

        stimulus_snapshot = None
        if getattr(question, "stimulus", None) and question.stimulus:
            stim = question.stimulus
            stimulus_snapshot = {
                "id": str(stim.id),
                "title": stim.title,
                "modality": stim.modality,
                "content_text": stim.content_text,
                "text_format": stim.text_format,
                "word_count": stim.word_count,
                "register": stim.register,
                "media_url": stim.media_url,
                "source_citation": stim.source_citation,
                "content_hash": stim.content_hash,
            }

        skill_tags_snapshot = []
        if getattr(question, "skill_tags", None):
            for tag in question.skill_tags:
                role_val = tag.role.value if hasattr(tag.role, "value") else str(tag.role)
                skill_tags_snapshot.append({
                    "skill_id": str(tag.skill_id),
                    "subskill_id": str(tag.subskill_id) if getattr(tag, "subskill_id", None) else None,
                    "subskill": getattr(tag, "subskill", None),
                    "role": role_val,
                    "weight": tag.weight,
                    "context": getattr(tag, "context", None),
                })

        provenance_snapshot = None
        if getattr(question, "provenance", None) and question.provenance:
            prov = question.provenance
            provenance_snapshot = {
                "author_type": prov.author_type,
                "source_type": prov.source_type,
                "source_reference": prov.source_reference,
                "generator_model": prov.generator_model,
                "generator_prompt_version": prov.generator_prompt_version,
                "generator_parameters": prov.generator_parameters,
                "taxonomy_version_id": str(prov.taxonomy_version_id) if prov.taxonomy_version_id else None,
            }

        q_type = question.question_type
        q_type_str = q_type.value if hasattr(q_type, "value") else str(q_type)

        now_iso = datetime.datetime.now(datetime.UTC).isoformat()

        return {
            "snapshot_schema_version": 1,
            "snapshot_version": "2.0.0",
            "snapshot_timestamp": now_iso,
            "changelog": changelog,
            "question_id": str(question.id),
            "version": question.version,
            "prompt": question.prompt,
            "instructions": question.instructions,
            "question_type": q_type_str,
            "response_type": question.response_type or "single_choice",
            "level": question.level,
            "target_cefr": question.target_cefr,
            "difficulty": question.difficulty,
            "difficulty_rating": question.difficulty_rating,
            "cognitive_complexity": question.cognitive_complexity,
            "points": question.points,
            "penalty_points": question.penalty_points,
            "media_url": question.media_url,
            "explanation": question.explanation,
            "status": question.status,
            "is_live_delivered": question.is_live_delivered,
            "item_hash": question.item_hash,
            "task_type_id": str(question.task_type_id) if question.task_type_id else None,
            "scoring_payload": question.scoring_payload,
            "stimulus": stimulus_snapshot,
            "options": options_snapshot,
            "skill_tags": skill_tags_snapshot,
            "provenance": provenance_snapshot,
        }

    @classmethod
    def assert_no_student_leak(cls, data: Any, path: str = "root") -> None:
        """Defensively verify that no secret or teacher diagnostic metadata exists in the dict."""
        if isinstance(data, dict):
            for k, v in data.items():
                if k in FORBIDDEN_STUDENT_KEYS:
                    raise QuestionSecurityViolation(
                        f"Security invariant violated: forbidden key '{k}' detected at '{path}.{k}' in student payload"
                    )
                cls.assert_no_student_leak(v, f"{path}.{k}")
        elif isinstance(data, list):
            for idx, item in enumerate(data):
                cls.assert_no_student_leak(item, f"{path}[{idx}]")
