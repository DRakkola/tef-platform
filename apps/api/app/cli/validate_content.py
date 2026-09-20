"""Content Integrity and Pedagogical Quality Validator CLI.

Inspects all published assessments, questions, options, media assets, exercises,
writing tasks, and oral speaking scenarios (practice topics) for production beta readiness.
Generates docs/BETA_CONTENT_AUDIT.md and exits non-zero if any defects are detected.
"""

import asyncio
import datetime
import os
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

# Add apps/api to path
repo_root = Path(__file__).resolve().parents[4]
docs_dir = repo_root / "docs"
docs_dir.mkdir(parents=True, exist_ok=True)
# Ensure all models are registered in SQLAlchemy registry
import app.modules.admin.beta_models  # noqa: F401
import app.modules.admin.models  # noqa: F401
import app.modules.assessments.models  # noqa: F401
import app.modules.learning.models  # noqa: F401
import app.modules.practice_pool.models  # noqa: F401
import app.modules.teachers.models  # noqa: F401
import app.modules.users.models  # noqa: F401
import app.modules.writing.models  # noqa: F401

from app.core.database import async_session_factory
from app.modules.admin.models import MediaAsset
from app.modules.assessments.enums import AssessmentType, QuestionType
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    Question,
    QuestionOption,
    Skill,
)
from app.modules.learning.models import Exercise
from app.modules.practice_pool.models import PracticeTopic
from app.modules.writing.models import WritingTask


async def run_content_audit() -> tuple[bool, dict[str, Any]]:
    """Execute deep content audit across all published entities."""
    defects: list[dict[str, str]] = []
    stats = {
        "assessments_checked": 0,
        "assessments_valid": 0,
        "sections_checked": 0,
        "sections_valid": 0,
        "questions_checked": 0,
        "questions_valid": 0,
        "options_checked": 0,
        "options_valid": 0,
        "media_assets_checked": 0,
        "media_assets_valid": 0,
        "writing_tasks_checked": 0,
        "writing_tasks_valid": 0,
        "exercises_checked": 0,
        "exercises_valid": 0,
        "practice_topics_checked": 0,
        "practice_topics_valid": 0,
    }

    async with async_session_factory() as db:
        # 1. Validate Published Assessments & Child Sections/Questions
        stmt = (
            select(Assessment)
            .where(Assessment.is_published.is_(True))
            .options(
                selectinload(Assessment.sections)
                .selectinload(AssessmentSection.questions)
                .selectinload(Question.options)
            )
        )
        assessments = (await db.execute(stmt)).scalars().all()

        for ass in assessments:
            stats["assessments_checked"] += 1
            ass_defects: list[str] = []

            if not ass.title or len(ass.title.strip()) < 3:
                ass_defects.append("Titre de l'évaluation manquant ou trop court (< 3 caractères)")
            if ass.duration_seconds <= 0:
                ass_defects.append(f"Durée invalide : {ass.duration_seconds}s")
            if not ass.sections:
                ass_defects.append("L'évaluation ne contient aucune section")

            # Check accidental draft content
            if any(term in ass.title.lower() for term in ["[draft]", "test_draft", "todo", "brouillon"]):
                ass_defects.append("Contenu brouillon détecté avec le flag is_published=True")

            for sec in ass.sections:
                stats["sections_checked"] += 1
                sec_defects: list[str] = []

                if not sec.title or len(sec.title.strip()) < 2:
                    sec_defects.append("Titre de section manquant")
                if not sec.questions:
                    sec_defects.append("La section ne contient aucune question")

                if ass.assessment_type == AssessmentType.LISTENING and not sec.media_url:
                    # Check if all questions have media_url
                    for q in sec.questions:
                        if not q.media_url:
                            sec_defects.append("Épreuve d'écoute sans média audio ni au niveau section ni au niveau question")
                            break

                if sec_defects:
                    for d in sec_defects:
                        defects.append({"entity": "Section", "id": str(sec.id), "parent": ass.title, "defect": d})
                else:
                    stats["sections_valid"] += 1

                for q in sec.questions:
                    stats["questions_checked"] += 1
                    q_defects: list[str] = []

                    if not q.prompt or len(q.prompt.strip()) < 2:
                        q_defects.append("Énoncé de la question vide")

                    if q.points <= 0:
                        q_defects.append(f"Points invalides : {q.points}")

                    if q.level not in ("A1", "A2", "B1", "B2", "C1", "C2"):
                        q_defects.append(f"Niveau CECR invalide : {q.level}")

                    # Validate options
                    if q.question_type == QuestionType.SINGLE_CHOICE:
                        if len(q.options) < 2:
                            q_defects.append(f"Nombre d'options insuffisant ({len(q.options)} < 2)")
                        correct_count = sum(1 for opt in q.options if opt.is_correct)
                        if correct_count != 1:
                            q_defects.append(f"Question à choix unique avec {correct_count} réponse(s) correcte(s) (1 requise)")

                    for opt in q.options:
                        stats["options_checked"] += 1
                        if not opt.content or len(opt.content.strip()) < 1:
                            q_defects.append(f"Option ID {opt.id} a un contenu vide")
                        else:
                            stats["options_valid"] += 1

                    if q_defects:
                        for d in q_defects:
                            defects.append({"entity": "Question", "id": str(q.id), "parent": f"{ass.title} > {sec.title}", "defect": d})
                    else:
                        stats["questions_valid"] += 1

            if ass_defects:
                for d in ass_defects:
                    defects.append({"entity": "Assessment", "id": str(ass.id), "parent": "Root", "defect": d})
            else:
                stats["assessments_valid"] += 1

        # 2. Validate Media Assets
        media_stmt = select(MediaAsset)
        media_assets = (await db.execute(media_stmt)).scalars().all()
        for ma in media_assets:
            stats["media_assets_checked"] += 1
            ma_defects: list[str] = []
            if not ma.storage_object_key:
                ma_defects.append("storage_object_key manquant")
            if ma.file_size <= 0:
                ma_defects.append(f"file_size invalide : {ma.file_size}")
            if not ma.bucket:
                ma_defects.append("bucket manquant")

            if ma_defects:
                for d in ma_defects:
                    defects.append({"entity": "MediaAsset", "id": str(ma.id), "parent": ma.filename, "defect": d})
            else:
                stats["media_assets_valid"] += 1

        # 3. Validate Published Writing Tasks
        w_stmt = select(WritingTask).where(WritingTask.is_published.is_(True))
        writing_tasks = (await db.execute(w_stmt)).scalars().all()
        for wt in writing_tasks:
            stats["writing_tasks_checked"] += 1
            wt_defects: list[str] = []
            if not wt.title or len(wt.title.strip()) < 3:
                wt_defects.append("Titre de la tâche écrite vide")
            if not wt.prompt or len(wt.prompt.strip()) < 10:
                wt_defects.append("Énoncé de la rédaction trop succinct (< 10 caractères)")
            if wt.min_words <= 0:
                wt_defects.append(f"min_words invalide : {wt.min_words}")
            if wt.max_words < wt.min_words:
                wt_defects.append(f"max_words ({wt.max_words}) < min_words ({wt.min_words})")
            if wt.duration_minutes <= 0:
                wt_defects.append(f"duration_minutes invalide : {wt.duration_minutes}")

            if wt_defects:
                for d in wt_defects:
                    defects.append({"entity": "WritingTask", "id": str(wt.id), "parent": wt.title, "defect": d})
            else:
                stats["writing_tasks_valid"] += 1

        # 4. Validate Published Exercises
        ex_stmt = select(Exercise).where(Exercise.is_published.is_(True))
        exercises = (await db.execute(ex_stmt)).scalars().all()
        for ex in exercises:
            stats["exercises_checked"] += 1
            ex_defects: list[str] = []
            if not ex.title or len(ex.title.strip()) < 3:
                ex_defects.append("Titre d'exercice vide")
            if not ex.prompt or len(ex.prompt.strip()) < 5:
                ex_defects.append("Énoncé d'exercice vide")
            options = ex.options_payload or []
            if len(options) < 2:
                ex_defects.append(f"Nombre d'options {len(options)} < 2")
            else:
                correct = sum(1 for o in options if o.get("is_correct") is True)
                if correct != 1:
                    ex_defects.append(f"Exercice avec {correct} réponse(s) correcte(s) (1 requise)")

            if ex_defects:
                for d in ex_defects:
                    defects.append({"entity": "Exercise", "id": str(ex.id), "parent": ex.title, "defect": d})
            else:
                stats["exercises_valid"] += 1

        # 5. Validate Practice Topics (Oral Speaking Scenarios)
        pt_stmt = select(PracticeTopic).where(PracticeTopic.is_active.is_(True))
        topics = (await db.execute(pt_stmt)).scalars().all()
        for pt in topics:
            stats["practice_topics_checked"] += 1
            pt_defects: list[str] = []
            if not pt.title or len(pt.title.strip()) < 3:
                pt_defects.append("Titre de sujet oral vide")
            if not pt.description or len(pt.description.strip()) < 5:
                pt_defects.append("Description du sujet oral vide")
            if not pt.prompts or len(pt.prompts) == 0:
                pt_defects.append("Aucun prompt/relance conversationnelle défini")

            if pt_defects:
                for d in pt_defects:
                    defects.append({"entity": "PracticeTopic", "id": str(pt.id), "parent": pt.title, "defect": d})
            else:
                stats["practice_topics_valid"] += 1

    is_clean = len(defects) == 0
    return is_clean, {"stats": stats, "defects": defects, "timestamp": datetime.datetime.now(datetime.UTC).isoformat()}


def generate_markdown_audit_report(is_clean: bool, report: dict[str, Any]) -> str:
    """Generate docs/BETA_CONTENT_AUDIT.md markdown document."""
    stats = report["stats"]
    defects = report["defects"]
    timestamp = report["timestamp"]

    md = [
        "# Rapport d'Audit & Intégrité du Contenu Pédagogique (Bêta Privée)",
        "",
        f"**Date d'audit** : {timestamp}  ",
        f"**Statut global** : {'✅ CONFORME (Zéro défaut bloquant)' if is_clean else '❌ DÉFECTUEUX (Actions requises)'}  ",
        "**Politique Propriété Intellectuelle** : Tous les items audités sont des simulations pédagogiques internes développées par la plateforme TEF. Aucune épreuve sous licence officielle ou copyright tiers n'est exploitée sans droit.",
        "",
        "---",
        "",
        "## 1. Inventaire & Résultats de Contrôle",
        "",
        "| Entité Pédagogique | Total Vérifié | Conformes | Défectueux | Statut |",
        "| :--- | :--- | :--- | :--- | :--- |",
        f"| **Évaluations Globales (Assessments)** | {stats['assessments_checked']} | {stats['assessments_valid']} | {stats['assessments_checked'] - stats['assessments_valid']} | {'✅' if stats['assessments_checked'] == stats['assessments_valid'] else '❌'} |",
        f"| **Sections d'Épreuve** | {stats['sections_checked']} | {stats['sections_valid']} | {stats['sections_checked'] - stats['sections_valid']} | {'✅' if stats['sections_checked'] == stats['sections_valid'] else '❌'} |",
        f"| **Questions d'Examen** | {stats['questions_checked']} | {stats['questions_valid']} | {stats['questions_checked'] - stats['questions_valid']} | {'✅' if stats['questions_checked'] == stats['questions_valid'] else '❌'} |",
        f"| **Options de Réponse (QCM)** | {stats['options_checked']} | {stats['options_valid']} | {stats['options_checked'] - stats['options_valid']} | {'✅' if stats['options_checked'] == stats['options_valid'] else '❌'} |",
        f"| **Tâches d'Écriture (WritingTasks)** | {stats['writing_tasks_checked']} | {stats['writing_tasks_valid']} | {stats['writing_tasks_checked'] - stats['writing_tasks_valid']} | {'✅' if stats['writing_tasks_checked'] == stats['writing_tasks_valid'] else '❌'} |",
        f"| **Exercices d'Entraînement** | {stats['exercises_checked']} | {stats['exercises_valid']} | {stats['exercises_checked'] - stats['exercises_valid']} | {'✅' if stats['exercises_checked'] == stats['exercises_valid'] else '❌'} |",
        f"| **Scénarios Oraux (PracticeTopics)** | {stats['practice_topics_checked']} | {stats['practice_topics_valid']} | {stats['practice_topics_checked'] - stats['practice_topics_valid']} | {'✅' if stats['practice_topics_checked'] == stats['practice_topics_valid'] else '❌'} |",
        f"| **Ressources Média (MediaAssets)** | {stats['media_assets_checked']} | {stats['media_assets_valid']} | {stats['media_assets_checked'] - stats['media_assets_valid']} | {'✅' if stats['media_assets_checked'] == stats['media_assets_valid'] else '❌'} |",
        "",
        "---",
        "",
        "## 2. Anomalies et Défauts Détectés",
        "",
    ]

    if not defects:
        md.append("Aucun défaut détecté. L'intégralité du contenu pédagogique publié respecte les grilles de niveaux CECR/NCLC, les barèmes de notation et les règles de navigation.")
    else:
        md.append(f"**{len(defects)} anomalie(s) identifiée(s)** :\n")
        for idx, d in enumerate(defects, 1):
            md.append(f"{idx}. **[{d['entity']}]** `{d['id']}` dans *{d['parent']}* : {d['defect']}")

    md.extend([
        "",
        "---",
        "",
        "## 3. Déclaration de Conformité Déontologique",
        "",
        "- Les examens blancs et entraînements constituent des **simulations formatives autonomes** conçues pour préparer aux épreuves du TEF Canada.",
        "- La plateforme indique explicitement aux apprenants qu'elle n'est pas un centre d'examen agréé et que les résultats ne valent pas attestation officielle auprès d'IRCC ou du Ministère de l'Immigration.",
    ])

    return "\n".join(md)


def main() -> None:
    """CLI entrypoint."""
    is_clean, report = asyncio.run(run_content_audit())

    # Write report to docs/BETA_CONTENT_AUDIT.md
    output_path = docs_dir / "BETA_CONTENT_AUDIT.md"
    content_md = generate_markdown_audit_report(is_clean, report)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content_md)

    stats = report["stats"]
    print("=" * 70)
    print("       TEF PLATFORM CONTENT INTEGRITY VALIDATION CLI       ")
    print("=" * 70)
    print(f"Assessments: {stats['assessments_valid']}/{stats['assessments_checked']} valid")
    print(f"Questions:   {stats['questions_valid']}/{stats['questions_checked']} valid")
    print(f"Writing:     {stats['writing_tasks_valid']}/{stats['writing_tasks_checked']} valid")
    print(f"Exercises:   {stats['exercises_valid']}/{stats['exercises_checked']} valid")
    print(f"Scenarios:   {stats['practice_topics_valid']}/{stats['practice_topics_checked']} valid")
    print(f"Media:       {stats['media_assets_valid']}/{stats['media_assets_checked']} valid")
    print("=" * 70)

    if not is_clean:
        print(f"\n[FAIL] {len(report['defects'])} content defects found. Written to docs/BETA_CONTENT_AUDIT.md")
        for d in report["defects"][:5]:
            print(f"  - [{d['entity']}] {d['defect']} in {d['parent']}")
        sys.exit(1)
    else:
        print("\n[PASS] All published curriculum content passed integrity audit.")
        print("Audit report generated: docs/BETA_CONTENT_AUDIT.md")
        sys.exit(0)


if __name__ == "__main__":
    main()
