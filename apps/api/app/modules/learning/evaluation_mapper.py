"""Evaluation to Canonical Skill Evidence Mapping Engine (Taxonomy V2).

Ensures Speaking and Writing evaluations map criteria to canonical competencies
and emit SkillEvidence and StudentSkill projections without hardcoded arbitrary
queries or contaminating cross-modality reasoning competencies.

Separation of Concerns:
    Evaluator Criterion != Canonical Competency != Student Mastery
"""

import datetime
import uuid
from typing import Any, ClassVar

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.enums import SkillDimension
from app.modules.admin.models import SkillModality
from app.modules.assessments.models import Skill, SkillCategory
from app.modules.learning.engine import SkillEngine
from app.modules.learning.levels import LevelEstimationService
from app.modules.learning.models import SkillAssessment, StudentSkill
from app.modules.learning.readiness_engine import ReadinessEngine
from app.modules.learning.readiness_models import SkillEvidenceSourceType
from app.modules.speaking.models import SpeakingEvaluation, SpeakingEvaluationSkill
from app.modules.writing.models import WritingCorrection, WritingCorrectionSkill

logger = structlog.get_logger("tef-api.learning.evaluation_mapper")


class EvaluationSkillMapper:
    """Canonical mapping engine translating oral and written evaluation criteria to taxonomy skills."""

    SPEAKING_CRITERION_MAP: ClassVar[dict[str, list[str]]] = {
        "fluency": [
            "speaking_fluency_phonetics",
            "speaking_fluency",
            "speaking_expression",
            "speaking_interaction",
        ],
        "vocabulary": [
            "lang_vocab_in_context",
            "lang_collocations_and_idioms",
            "lang_register_and_style",
            "vocab_abstract_argumentation",
            "vocabulary_lexicon",
            "vocabulary",
        ],
        "grammar": [
            "lang_grammatical_agreement",
            "lang_verbal_moods",
            "lang_prepositions_and_governance",
            "lang_pronouns_and_anaphora",
            "grammar_morphology",
            "grammar",
        ],
        "coherence": [
            "lang_logical_connectors",
            "speaking_section_b_persuasion",
            "speaking_rebuttal_objections",
            "lang_cohesion_and_progression",
        ],
        "pronunciation": [
            "speaking_fluency_phonetics",
            "speaking_pronunciation",
        ],
        "task_completion": [
            "speaking_section_a_inquiries",
            "speaking_section_b_persuasion",
            "speaking_interaction",
        ],
    }

    WRITING_CRITERION_MAP: ClassVar[dict[str, list[str]]] = {
        "task_completion": [
            "writing_narrative_fait_divers",
            "writing_persuasive_letter",
            "writing_production",
            "writing_expression",
            "writing",
        ],
        "coherence": [
            "writing_textual_cohesion",
            "lang_logical_connectors",
            "lang_cohesion_and_progression",
        ],
        "vocabulary": [
            "lang_vocab_in_context",
            "lang_collocations_and_idioms",
            "vocab_abstract_argumentation",
            "vocabulary_lexicon",
            "vocabulary",
        ],
        "grammar": [
            "lang_grammatical_agreement",
            "lang_prepositions_and_governance",
            "grammar_morphology",
            "grammar",
        ],
        "syntax": [
            "writing_syntactic_variety",
            "lang_subordination_and_clauses",
            "lang_hypothetical_systems",
        ],
        "spelling": [
            "lang_grammatical_agreement",
            "orthography",
        ],
        "register": [
            "lang_register_and_style",
        ],
    }

    @classmethod
    def is_skill_compatible_with_modality(
        cls,
        skill: Skill,
        modality: str,
        skill_modalities: set[str] | None = None,
    ) -> bool:
        """Validate that a skill is compatible with the target modality and rejects cross-modality leaks."""
        mod = modality.lower().strip()
        sk_domain = (skill.domain or "").lower().strip()

        # 1. Negative rules:
        # a. Reasoning skills for reading or listening must NEVER be used in speaking or writing
        if skill.dimension == SkillDimension.REASONING:
            if mod in ("speaking", "writing") and sk_domain in ("reading", "listening"):
                return False
            if mod in ("speaking", "writing") and skill.category in (
                SkillCategory.READING,
                SkillCategory.LISTENING,
            ):
                return False
            if mod == "speaking" and sk_domain == "writing":
                return False
            if mod == "writing" and sk_domain == "speaking":
                return False

        # b. Domain exclusivity: a speaking-only domain skill is not for writing, and vice versa
        if mod == "speaking" and sk_domain in ("writing", "reading", "listening"):
            return False
        if mod == "writing" and sk_domain in ("speaking", "reading", "listening"):
            return False
        if mod in ("speaking", "writing") and skill.category in (
            SkillCategory.READING,
            SkillCategory.LISTENING,
        ) and skill.dimension != SkillDimension.LANGUAGE:
            return False

        # 2. Positive rules:
        # a. Explicit junction in SkillModality
        if skill_modalities is not None and mod in skill_modalities:
            return True

        # b. Exact domain match or category match
        if sk_domain == mod:
            return True
        if hasattr(skill.category, "value") and skill.category.value == mod:
            return True

        # c. Transversal language competencies (vocabulary, grammar, conjugation, syntax, discourse)
        if skill.dimension == SkillDimension.LANGUAGE and sk_domain in (
            "vocabulary",
            "grammar",
            "conjugation",
            "syntax",
            "discourse",
            "semantics",
            "general",
            "",
        ):
            return True
        return bool(
            skill.category
            in (
                SkillCategory.VOCABULARY,
                SkillCategory.GRAMMAR,
                SkillCategory.CONJUGATION,
            )
        )

    @classmethod
    async def resolve_canonical_skills_for_criterion(
        cls,
        db: AsyncSession,
        modality: str,
        criterion: str,
        task_context: str | None = None,
    ) -> list[Skill]:
        """Resolve active canonical skills mapped to an evaluator criterion."""
        mod = modality.lower().strip()
        crit = criterion.lower().strip()

        crit_map = cls.SPEAKING_CRITERION_MAP if mod == "speaking" else cls.WRITING_CRITERION_MAP
        candidate_codes = list(crit_map.get(crit, []))

        # Context-based filtering and prioritization (e.g. Section A vs Section B)
        if task_context:
            ctx = task_context.lower()
            if mod == "writing":
                if "section_a" in ctx or "narrative" in ctx or "fait_divers" in ctx:
                    if "writing_persuasive_letter" in candidate_codes:
                        candidate_codes.remove("writing_persuasive_letter")
                    if "writing_narrative_fait_divers" in candidate_codes:
                        candidate_codes.remove("writing_narrative_fait_divers")
                        candidate_codes.insert(0, "writing_narrative_fait_divers")
                elif "section_b" in ctx or "letter" in ctx or "persuasive" in ctx:
                    if "writing_narrative_fait_divers" in candidate_codes:
                        candidate_codes.remove("writing_narrative_fait_divers")
                    if "writing_persuasive_letter" in candidate_codes:
                        candidate_codes.remove("writing_persuasive_letter")
                        candidate_codes.insert(0, "writing_persuasive_letter")
            elif mod == "speaking":
                if "section_a" in ctx or "inquiry" in ctx or "renseignement" in ctx:
                    if "speaking_section_b_persuasion" in candidate_codes:
                        candidate_codes.remove("speaking_section_b_persuasion")
                    if "speaking_section_a_inquiries" in candidate_codes:
                        candidate_codes.remove("speaking_section_a_inquiries")
                        candidate_codes.insert(0, "speaking_section_a_inquiries")
                elif "section_b" in ctx or "persuasion" in ctx:
                    if "speaking_section_a_inquiries" in candidate_codes:
                        candidate_codes.remove("speaking_section_a_inquiries")
                    if "speaking_section_b_persuasion" in candidate_codes:
                        candidate_codes.remove("speaking_section_b_persuasion")
                        candidate_codes.insert(0, "speaking_section_b_persuasion")

        resolved_skills: list[Skill] = []
        seen_skill_ids: set[uuid.UUID] = set()

        from app.modules.admin.taxonomy_service import TaxonomyService

        for code in candidate_codes:
            skill = await TaxonomyService.resolve_skill_by_code_or_alias(db, code)
            if skill and skill.is_active and skill.id not in seen_skill_ids:
                # Fetch modalities for this skill
                sm_rows = await db.scalars(
                    select(SkillModality.modality).where(SkillModality.skill_id == skill.id)
                )
                skill_mods = {m.lower() for m in sm_rows}

                if cls.is_skill_compatible_with_modality(skill, mod, skill_mods):
                    resolved_skills.append(skill)
                    seen_skill_ids.add(skill.id)
                    if len(resolved_skills) >= 2:
                        break

        # Fallback if no specific candidate was found in DB
        if not resolved_skills:
            mod_skills = await TaxonomyService.get_skills_by_modality(db, mod)
            for sk in mod_skills:
                if (
                    sk.is_active
                    and sk.id not in seen_skill_ids
                    and cls.is_skill_compatible_with_modality(sk, mod)
                ):
                    resolved_skills.append(sk)
                    seen_skill_ids.add(sk.id)
                    break

        return resolved_skills

    @classmethod
    async def apply_speaking_evaluation_evidence(
        cls,
        db: AsyncSession,
        evaluation: SpeakingEvaluation,
        student_id: uuid.UUID,
        section_context: str | None = None,
    ) -> list[SpeakingEvaluationSkill]:
        """Attach canonical competencies to a speaking evaluation and ingest criterion-level SkillEvidence."""
        criteria_scores: dict[str, float] = {
            "fluency": float(evaluation.fluency),
            "vocabulary": float(evaluation.vocabulary),
            "grammar": float(evaluation.grammar),
            "coherence": float(evaluation.coherence),
            "pronunciation": float(evaluation.pronunciation),
        }

        # Track skill to criterion scores mapping
        skill_evidence_map: dict[uuid.UUID, tuple[Skill, list[float], list[str]]] = {}

        for crit, score in criteria_scores.items():
            if score is None or score <= 0.0:
                continue
            skills = await cls.resolve_canonical_skills_for_criterion(
                db=db,
                modality="speaking",
                criterion=crit,
                task_context=section_context,
            )
            for sk in skills:
                if sk.id not in skill_evidence_map:
                    skill_evidence_map[sk.id] = (sk, [], [])
                skill_evidence_map[sk.id][1].append(score)
                skill_evidence_map[sk.id][2].append(crit)

        # Fallback: if no criteria mapped, map overall score to speaking modality skills
        if not skill_evidence_map and evaluation.overall_score > 0.0:
            from app.modules.admin.taxonomy_service import TaxonomyService

            mod_skills = await TaxonomyService.get_skills_by_modality(db, "speaking")
            if not mod_skills:
                fb_stmt = (
                    select(Skill)
                    .where(Skill.category == SkillCategory.SPEAKING)
                    .order_by(Skill.name.asc())
                    .limit(1)
                )
                mod_skills = list((await db.execute(fb_stmt)).scalars().all())

            for sk in mod_skills:
                if cls.is_skill_compatible_with_modality(sk, "speaking"):
                    skill_evidence_map[sk.id] = (sk, [evaluation.overall_score], ["overall"])
                    break

        now = datetime.datetime.now(datetime.UTC)
        is_teacher = evaluation.evaluator_type.value == "teacher" if hasattr(evaluation.evaluator_type, "value") else str(evaluation.evaluator_type) == "teacher"
        source_type = (
            SkillEvidenceSourceType.TEACHER_EVALUATION.value
            if is_teacher
            else SkillEvidenceSourceType.AI_EVALUATION.value
        )
        confidence = 0.95 if is_teacher else 0.85

        created_eval_skills: list[SpeakingEvaluationSkill] = []
        for skill, scores, crit_names in skill_evidence_map.values():
            mean_score = round(sum(scores) / len(scores), 2)

            eval_skill = SpeakingEvaluationSkill(
                evaluation_id=evaluation.id,
                skill_id=skill.id,
                score=mean_score,
                notes=f"Critères évalués : {', '.join(crit_names)}",
            )
            eval_skill.skill = skill
            db.add(eval_skill)
            created_eval_skills.append(eval_skill)

            cefr_lvl = LevelEstimationService.estimate_cefr(mean_score)

            # Record SkillAssessment
            sa = SkillAssessment(
                user_id=student_id,
                skill_id=skill.id,
                source_type="speaking_evaluation",
                source_id=evaluation.id,
                score=mean_score,
                points_earned=mean_score,
                points_possible=100.0,
                estimated_level=evaluation.estimated_level or cefr_lvl,
                confidence=confidence,
                assessed_at=now,
            )
            db.add(sa)

            # Update rolling StudentSkill
            st_skill = await db.scalar(
                select(StudentSkill).where(
                    StudentSkill.user_id == student_id,
                    StudentSkill.skill_id == skill.id,
                )
            )
            if st_skill:
                new_mastery, new_conf = SkillEngine.update_mastery(
                    current_mastery=st_skill.mastery_score,
                    attempts_count=st_skill.attempts_count,
                    new_score=mean_score,
                )
                st_skill.mastery_score = new_mastery
                st_skill.confidence = new_conf
                st_skill.attempts_count += 1
                st_skill.last_assessed_at = now
                st_skill.estimated_level = LevelEstimationService.estimate_cefr(new_mastery)
            else:
                st_skill = StudentSkill(
                    user_id=student_id,
                    skill_id=skill.id,
                    mastery_score=mean_score,
                    confidence=0.5,
                    attempts_count=1,
                    last_assessed_at=now,
                    estimated_level=evaluation.estimated_level or cefr_lvl,
                )
                db.add(st_skill)

            # Ingest append-only SkillEvidence
            try:
                async with db.begin_nested():
                    await ReadinessEngine.ingest_evidence(
                        db=db,
                        student_id=student_id,
                        skill_id=skill.id,
                        source_type=source_type,
                        source_id=evaluation.id,
                        raw_score=mean_score,
                        normalized_score=mean_score,
                        confidence=confidence,
                        weight=1.0,
                        observed_at=now,
                        metadata_payload={
                            "evaluation_id": str(evaluation.id),
                            "criteria": crit_names,
                            "modality": "speaking",
                            "evaluator": "teacher" if is_teacher else (evaluation.evaluator_model or "ai"),
                        },
                    )
            except Exception as e_ev:  # noqa: BLE001
                logger.warning("speaking_evidence_ingest_failed", skill=skill.code, error=str(e_ev))

        if skill_evidence_map:
            try:
                await ReadinessEngine.recalculate_student_readiness(db, student_id)
            except Exception as e_readiness:  # noqa: BLE001
                logger.warning("speaking_readiness_recalc_failed", error=str(e_readiness))

        await db.flush()
        return created_eval_skills

    @classmethod
    async def apply_writing_evaluation_evidence(
        cls,
        db: AsyncSession,
        correction: WritingCorrection,
        student_id: uuid.UUID,
        task_type: str | None = None,
        is_teacher: bool = False,
        custom_skills: list[Any] | None = None,
    ) -> list[WritingCorrectionSkill]:
        """Attach canonical competencies to a writing correction and ingest criterion-level SkillEvidence."""
        now = datetime.datetime.now(datetime.UTC)
        source_type = (
            SkillEvidenceSourceType.TEACHER_EVALUATION.value
            if is_teacher
            else SkillEvidenceSourceType.AI_EVALUATION.value
        )
        confidence = 0.95 if is_teacher else 0.85

        created_correction_skills: list[WritingCorrectionSkill] = []

        # Case 1: Teacher submitted explicit skill list
        if custom_skills:
            for skill_data in custom_skills:
                c_skill = WritingCorrectionSkill(
                    correction_id=correction.id,
                    skill_id=skill_data.skill_id,
                    score=skill_data.score,
                    level=skill_data.level,
                    feedback=skill_data.feedback,
                )
                db.add(c_skill)
                created_correction_skills.append(c_skill)

                # Record SkillAssessment
                existing_sa = await db.scalar(
                    select(SkillAssessment).where(
                        SkillAssessment.source_id == correction.id,
                        SkillAssessment.skill_id == skill_data.skill_id,
                        SkillAssessment.source_type == "writing_correction",
                    )
                )
                if not existing_sa:
                    sa = SkillAssessment(
                        user_id=student_id,
                        skill_id=skill_data.skill_id,
                        source_type="writing_correction",
                        source_id=correction.id,
                        score=skill_data.score,
                        points_earned=skill_data.score,
                        points_possible=100.0,
                        estimated_level=skill_data.level,
                        confidence=confidence,
                        assessed_at=now,
                    )
                    db.add(sa)

                # Update rolling StudentSkill
                st_skill = await db.scalar(
                    select(StudentSkill).where(
                        StudentSkill.user_id == student_id,
                        StudentSkill.skill_id == skill_data.skill_id,
                    )
                )
                if st_skill:
                    new_mastery, new_conf = SkillEngine.update_mastery(
                        current_mastery=st_skill.mastery_score,
                        attempts_count=st_skill.attempts_count,
                        new_score=skill_data.score,
                    )
                    st_skill.mastery_score = new_mastery
                    st_skill.confidence = new_conf
                    st_skill.attempts_count += 1
                    st_skill.last_assessed_at = now
                    st_skill.estimated_level = LevelEstimationService.estimate_cefr(new_mastery)
                else:
                    st_skill = StudentSkill(
                        user_id=student_id,
                        skill_id=skill_data.skill_id,
                        mastery_score=skill_data.score,
                        confidence=0.5,
                        attempts_count=1,
                        last_assessed_at=now,
                        estimated_level=skill_data.level,
                    )
                    db.add(st_skill)

                # Ingest SkillEvidence
                try:
                    async with db.begin_nested():
                        await ReadinessEngine.ingest_evidence(
                            db=db,
                            student_id=student_id,
                            skill_id=skill_data.skill_id,
                            source_type=source_type,
                            source_id=correction.id,
                            raw_score=skill_data.score,
                            normalized_score=skill_data.score,
                            confidence=confidence,
                            weight=1.0,
                            observed_at=now,
                            metadata_payload={
                                "correction_id": str(correction.id),
                                "modality": "writing",
                                "is_custom": True,
                            },
                        )
                except Exception as e_ev:  # noqa: BLE001
                    logger.warning("writing_custom_evidence_ingest_failed", error=str(e_ev))

        # Case 2: Derive skills from criteria breakdown on WritingCorrection
        else:
            criteria_scores: dict[str, float | None] = {
                "task_completion": correction.task_completion,
                "coherence": correction.coherence,
                "vocabulary": correction.vocabulary,
                "grammar": correction.grammar,
                "syntax": correction.syntax,
                "spelling": correction.spelling,
                "register": correction.register,
            }

            valid_criteria = {k: v for k, v in criteria_scores.items() if v is not None and v > 0.0}
            if not valid_criteria and correction.score > 0.0:
                valid_criteria = {"task_completion": correction.score}

            skill_evidence_map: dict[uuid.UUID, tuple[Skill, list[float], list[str]]] = {}

            for crit, score in valid_criteria.items():
                skills = await cls.resolve_canonical_skills_for_criterion(
                    db=db,
                    modality="writing",
                    criterion=crit,
                    task_context=task_type,
                )
                for sk in skills:
                    if sk.id not in skill_evidence_map:
                        skill_evidence_map[sk.id] = (sk, [], [])
                    skill_evidence_map[sk.id][1].append(score)
                    skill_evidence_map[sk.id][2].append(crit)

            for skill, scores, crit_names in skill_evidence_map.values():
                mean_score = round(sum(scores) / len(scores), 2)
                cefr_lvl = LevelEstimationService.estimate_cefr(mean_score)

                c_skill = WritingCorrectionSkill(
                    correction_id=correction.id,
                    skill_id=skill.id,
                    score=mean_score,
                    level=cefr_lvl,
                    feedback=f"Évaluation sur {', '.join(crit_names)} : {mean_score}/100 ({cefr_lvl})",
                )
                c_skill.skill = skill
                db.add(c_skill)
                created_correction_skills.append(c_skill)

                # SkillAssessment
                sa = SkillAssessment(
                    user_id=student_id,
                    skill_id=skill.id,
                    source_type="writing_correction",
                    source_id=correction.id,
                    score=mean_score,
                    points_earned=mean_score,
                    points_possible=100.0,
                    estimated_level=cefr_lvl,
                    confidence=confidence,
                    assessed_at=now,
                )
                db.add(sa)

                # StudentSkill
                st_skill = await db.scalar(
                    select(StudentSkill).where(
                        StudentSkill.user_id == student_id,
                        StudentSkill.skill_id == skill.id,
                    )
                )
                if st_skill:
                    new_mastery, new_conf = SkillEngine.update_mastery(
                        current_mastery=st_skill.mastery_score,
                        attempts_count=st_skill.attempts_count,
                        new_score=mean_score,
                    )
                    st_skill.mastery_score = new_mastery
                    st_skill.confidence = new_conf
                    st_skill.attempts_count += 1
                    st_skill.last_assessed_at = now
                    st_skill.estimated_level = LevelEstimationService.estimate_cefr(new_mastery)
                else:
                    st_skill = StudentSkill(
                        user_id=student_id,
                        skill_id=skill.id,
                        mastery_score=mean_score,
                        confidence=0.5,
                        attempts_count=1,
                        last_assessed_at=now,
                        estimated_level=cefr_lvl,
                    )
                    db.add(st_skill)

                # SkillEvidence
                try:
                    async with db.begin_nested():
                        await ReadinessEngine.ingest_evidence(
                            db=db,
                            student_id=student_id,
                            skill_id=skill.id,
                            source_type=source_type,
                            source_id=correction.id,
                            raw_score=mean_score,
                            normalized_score=mean_score,
                            confidence=confidence,
                            weight=1.0,
                            observed_at=now,
                            metadata_payload={
                                "correction_id": str(correction.id),
                                "criteria": crit_names,
                                "modality": "writing",
                            },
                        )
                except Exception as e_ev:  # noqa: BLE001
                    logger.warning("writing_evidence_ingest_failed", skill=skill.code, error=str(e_ev))

        # Recalculate readiness
        try:
            await ReadinessEngine.recalculate_student_readiness(db, student_id)
        except Exception as e_readiness:  # noqa: BLE001
            logger.warning("writing_readiness_recalc_failed", error=str(e_readiness))

        await db.flush()
        return created_correction_skills
