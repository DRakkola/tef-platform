"""Comprehensive database seeder for Content Studio.
Populates:
- 7 canonical skills with 4 subskills each
- 2 full TEF simulation assessments (Reading & Listening) with sections, questions, options, and snapshots
- 10 targeted drill exercises with snapshots
- 2 TEF writing tasks (Section A & B) with snapshots
- Media assets catalog
- Editorial content reviews (pending and approved)
- Audit log records
"""

import asyncio
import datetime
import os
import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import hash_password
from app.modules.admin.enums import ContentStatus, MediaType, ReviewStatus
from app.modules.admin.models import (
    AssessmentVersion,
    AuditEvent,
    ContentReview,
    ExerciseVersion,
    MediaAsset,
    QuestionVersion,
    SubSkill,
    WritingTaskVersion,
)
from app.modules.assessments.enums import AssessmentType, QuestionType
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    Attempt,
    AttemptScore,
    Question,
    QuestionOption,
    QuestionSkillTag,
    Skill,
)
from app.modules.learning.enums import SkillCategory
from app.modules.learning.models import Exercise, Recommendation, SkillAssessment, StudentSkill
from app.modules.teachers.models import TeacherBooking
from app.modules.users.models import StudentProfile, TeacherProfile, User, UserRole
from app.modules.writing.models import WritingTask

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "AdminPass2026!"


async def run_seed():
    db_url = os.environ.get("DATABASE_URL", settings.DATABASE_URL)
    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        print("🌱 Seeding Content Studio...")

        # 0. Admin User
        admin_res = await session.execute(select(User).where(User.email == ADMIN_EMAIL))
        admin = admin_res.scalar_one_or_none()
        if not admin:
            admin = User(
                email=ADMIN_EMAIL,
                password_hash=hash_password(ADMIN_PASSWORD),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            session.add(admin)
            await session.flush()
            print(f"  [+] Admin user ensured: {admin.email}")
        else:
            print(f"  [=] Admin user exists: {admin.email}")

        now = datetime.datetime.now(datetime.UTC)

        # 1. 7 Canonical Skills with 4 Subskills each
        skills_spec = [
            {
                "code": "reading_comp",
                "name": "Compréhension Écrite",
                "category": SkillCategory.READING,
                "description": "Compréhension de textes, notes d'information, courriels et articles de presse en français.",
                "subskills": [
                    ("reading_factual_info", "Repérage d'informations factuelles", "Identifier des détails, chiffres et faits explicites dans un document."),
                    ("reading_main_theme", "Identification du thème principal", "Dégager l'idée directrice, la visée communicative et l'intention de l'auteur."),
                    ("reading_implicit_inference", "Déduction du sens implicite", "Inférer des intentions sous-jacentes, des allusions et des hypothèses."),
                    ("reading_author_stance", "Analyse du ton et point de vue", "Percevoir l'ironie, l'engagement argumentatif et la nuance éditoriale."),
                ],
            },
            {
                "code": "listening_comp",
                "name": "Compréhension Orale",
                "category": SkillCategory.LISTENING,
                "description": "Compréhension de messages vocaux, annonces publiques, émissions et entretiens oraux.",
                "subskills": [
                    ("listening_short_announcements", "Annonces et messages courts", "Saisir l'essentiel d'annonces diffusées dans des lieux publics."),
                    ("listening_conversation_details", "Détails d'interactions orales", "Identifier des rendez-vous, des prix et des consignes précises."),
                    ("listening_formal_debates", "Débats et chroniques radio", "Suivre le fil d'une discussion argumentative complexe."),
                    ("listening_speaker_attitudes", "Attitudes et émotions des locuteurs", "Reconnaître le désaccord, l'hésitation, l'ironie ou la certitude."),
                ],
            },
            {
                "code": "grammar_mastery",
                "name": "Grammaire",
                "category": SkillCategory.GRAMMAR,
                "description": "Maîtrise des structures syntaxiques, modes verbaux et connecteurs logiques de la langue française.",
                "subskills": [
                    ("grammar_subjunctive_mood", "Emploi du subjonctif", "Maîtriser les déclencheurs de doute, nécessité, émotion et volonté."),
                    ("grammar_logical_connectors", "Connecteurs argumentatifs", "Articuler cause, conséquence, opposition, concession et restriction."),
                    ("grammar_relative_pronouns", "Pronoms relatifs simples et composés", "Utiliser dont, où, auquel, pour lequel, duquel sans hésitation."),
                    ("grammar_hypothetical_systems", "Systèmes hypothétiques (si...)", "Construire des hypothèses réelles, potentielles et irréelles."),
                ],
            },
            {
                "code": "vocabulary_lexicon",
                "name": "Vocabulaire",
                "category": SkillCategory.VOCABULARY,
                "description": "Étendue lexicale, précision terminologique, collocations et registres de langue.",
                "subskills": [
                    ("vocab_environment_climate", "Environnement et écologie", "Vocabulaire ciblé du développement durable, énergie et climat."),
                    ("vocab_tech_workplace", "Technologie et travail", "Terminologie du numérique, de l'entreprise et des carrières."),
                    ("vocab_abstract_argumentation", "Nuance et abstraction argumentative", "Mots-charnières et substantifs pour structurer un plaidoyer."),
                    ("vocab_society_media", "Société, culture et médias", "Champs lexicaux des faits sociétaux, justice et citoyenneté."),
                ],
            },
            {
                "code": "conjugation_tenses",
                "name": "Conjugaison",
                "category": SkillCategory.CONJUGATION,
                "description": "Morphologie verbale, concordance des temps et accords participiaux.",
                "subskills": [
                    ("conjug_pc_vs_imparfait", "Passé composé vs Imparfait", "Choisir le bon temps pour actions ponctuelles vs description d'arrière-plan."),
                    ("conjug_conditional_modes", "Conditionnel présent et passé", "Exprimer le conseil, l'atténuation de politesse et le regret."),
                    ("conjug_irregular_verbs", "Verbes irréguliers fréquents", "Conjuguer sans faute acquérir, résoudre, joindre, falloir..."),
                    ("conjug_past_participle_agreement", "Accord du participe passé", "Règles avec l'auxiliaire avoir, les verbes pronominaux et le COD antéposé."),
                ],
            },
            {
                "code": "writing_production",
                "name": "Expression Écrite",
                "category": SkillCategory.WRITING,
                "description": "Rédaction formelle, récits de faits divers, argumentation et défense d'un point de vue.",
                "subskills": [
                    ("writing_narrative_fait_divers", "Section A : Récit de fait divers", "Développer une intrigue cohérente, respecter la chronologie des faits."),
                    ("writing_persuasive_letter", "Section B : Lettre argumentative", "Défendre une position avec 3 arguments étayés et exemples."),
                    ("writing_syntactic_variety", "Variété et complexité des phrases", "Alterner propositions subordonnées, participiales et coordonées."),
                    ("writing_textual_cohesion", "Cohésion et transitions de texte", "Assurer la fluidité entre paragraphes et la progression thématique."),
                ],
            },
            {
                "code": "speaking_interaction",
                "name": "Expression Orale",
                "category": SkillCategory.SPEAKING,
                "description": "Interaction orale spontanée, questionnement formel et persuasion convaincante.",
                "subskills": [
                    ("speaking_section_a_inquiries", "Section A : Collecte d'informations", "Poser 10 questions variées, précises et pertinentes à un interlocuteur."),
                    ("speaking_section_b_persuasion", "Section B : Persuasion et plaidoyer", "Convaincre un ami d'adhérer à un projet ou une activité."),
                    ("speaking_fluency_phonetics", "Aisance et phonétique", "Maintenir un débit naturel, une intonation expressive et une prononciation claire."),
                    ("speaking_rebuttal_objections", "Réfutation et réponse aux objections", "Rebondir avec tact sur les hésitations de l'examinateur."),
                ],
            },
        ]

        created_skills_map = {}
        for s_data in skills_spec:
            s_res = await session.execute(select(Skill).where(Skill.code == s_data["code"]))
            sk = s_res.scalar_one_or_none()
            if not sk:
                sk = Skill(
                    code=s_data["code"],
                    name=s_data["name"],
                    category=s_data["category"],
                    description=s_data["description"],
                )
                session.add(sk)
                await session.flush()
                print(f"  [+] Created skill: {sk.code}")
            created_skills_map[sk.code] = sk

            # Subskills
            for sub_code, sub_name, sub_desc in s_data["subskills"]:
                sub_res = await session.execute(select(SubSkill).where(SubSkill.code == sub_code))
                sub = sub_res.scalar_one_or_none()
                if not sub:
                    sub = SubSkill(
                        skill_id=sk.id,
                        code=sub_code,
                        name=sub_name,
                        description=sub_desc,
                    )
                    session.add(sub)
                    await session.flush()
        print("  [✓] 7 skills and 28 subskills synchronized.")

        # 2. Media Assets
        media_items = [
            ("tef_audio_announcement_gare.mp3", "audio/mpeg", 524288, "Audios/Examens", "Annonce en gare TGV — Retard et voie de départ"),
            ("tef_audio_chronique_environnement.mp3", "audio/mpeg", 1245184, "Audios/Examens", "Chronique Radio Canada — Transition énergétique"),
            ("tef_image_fait_divers_chat.png", "image/png", 312000, "Images/Presse", "Photo d'illustration fait divers insolite"),
            ("tef_infographie_recyclage_canada.png", "image/png", 450000, "Images/Documents", "Infographie statistique sur le tri sélectif"),
        ]
        for fname, mime, size, prefix, desc in media_items:
            m_res = await session.execute(select(MediaAsset).where(MediaAsset.filename == fname))
            if not m_res.scalar_one_or_none():
                session.add(
                    MediaAsset(
                        title=desc,
                        filename=fname,
                        storage_object_key=f"{prefix}/{fname}",
                        bucket="tef-private",
                        content_type=mime,
                        file_size=size,
                        media_type=MediaType.AUDIO if "audio" in mime else MediaType.IMAGE,
                        uploaded_by_user_id=admin.id,
                    )
                )
        await session.flush()
        print("  [✓] Media assets registered.")

        # 3. Reading Simulation Assessment
        read_title = "TEF Canada — Simulation Complète : Compréhension Écrite (Session 1)"
        asmt_res = await session.execute(select(Assessment).where(Assessment.title == read_title))
        read_asmt = asmt_res.scalar_one_or_none()

        if not read_asmt:
            read_asmt = Assessment(
                title=read_title,
                description="Épreuve complète de Compréhension Écrite format officiel TEF Canada (40 questions, 60 minutes).",
                assessment_type=AssessmentType.READING,
                duration_seconds=3600,
                is_published=True,
                status=ContentStatus.PUBLISHED.value,
                version=1,
                created_by_user_id=admin.id,
                updated_by_user_id=admin.id,
                created_at=now,
                updated_at=now,
            )
            session.add(read_asmt)
            await session.flush()

            # Section 1
            sec1 = AssessmentSection(
                assessment_id=read_asmt.id,
                title="Section A — Documents de la vie quotidienne et petites annonces",
                instructions="Lisez attentivement chaque document et sélectionnez la réponse correcte.",
                order_index=0,
                duration_seconds=900,
                passage_text=(
                    "AVIS DE LA SOCIÉTÉ DE TRANSPORT DE L'OUTAOUAIS\n\n"
                    "En raison des travaux d'infrastructure majeurs sur le boulevard des Allumettières, "
                    "les lignes express 22 et 34 seront détournées à compter de ce lundi 15 octobre, dès 06h00. "
                    "Des arrêts temporaires sont aménagés à l'intersection de la rue Montcalm. "
                    "Les usagers munis d'un titre mensuel régulier ne subiront aucune tarification supplémentaire."
                ),
                created_at=now,
                updated_at=now,
            )
            session.add(sec1)
            await session.flush()

            # Q1
            q1 = Question(
                section_id=sec1.id,
                prompt="Quel est l'objet principal de cet avis aux usagers ?",
                question_type=QuestionType.SINGLE_CHOICE,
                order_index=0,
                difficulty=2,
                level="A2",
                points=1,
                penalty_points=0,
                explanation="L'avis signale une modification de trajet due à des travaux routiers.",
                status=ContentStatus.PUBLISHED.value,
                version=1,
                created_by_user_id=admin.id,
                created_at=now,
                updated_at=now,
            )
            session.add(q1)
            await session.flush()
            session.add_all([
                QuestionOption(question_id=q1.id, content="Une hausse des tarifs mensuels de transport", order_index=0, is_correct=False),
                QuestionOption(question_id=q1.id, content="Une modification d'itinéraire pour deux lignes de bus", order_index=1, is_correct=True, explanation="Les lignes 22 et 34 sont détournées."),
                QuestionOption(question_id=q1.id, content="L'inauguration d'une nouvelle ligne express", order_index=2, is_correct=False),
                QuestionOption(question_id=q1.id, content="La fermeture totale du réseau d'autobus", order_index=3, is_correct=False),
            ])

            # Q2
            q2 = Question(
                section_id=sec1.id,
                prompt="Que doivent faire les passagers pour emprunter les autobus détournés ?",
                question_type=QuestionType.SINGLE_CHOICE,
                order_index=1,
                difficulty=2,
                level="B1",
                points=1,
                penalty_points=0,
                explanation="Des arrêts provisoires sont mis en place rue Montcalm.",
                status=ContentStatus.PUBLISHED.value,
                version=1,
                created_by_user_id=admin.id,
                created_at=now,
                updated_at=now,
            )
            session.add(q2)
            await session.flush()
            session.add_all([
                QuestionOption(question_id=q2.id, content="Se rendre aux arrêts temporaires situés rue Montcalm", order_index=0, is_correct=True),
                QuestionOption(question_id=q2.id, content="Acheter un titre de transport spécifique", order_index=1, is_correct=False),
                QuestionOption(question_id=q2.id, content="Téléphoner au service client avant chaque départ", order_index=2, is_correct=False),
                QuestionOption(question_id=q2.id, content="Attendre le rétablissement de la circulation normale", order_index=3, is_correct=False),
            ])

            # Section 2
            sec2 = AssessmentSection(
                assessment_id=read_asmt.id,
                title="Section B — Article d'analyse : L'essor du télétravail au Canada",
                instructions="Lisez l'article de presse ci-dessous et répondez aux questions de compréhension fine.",
                order_index=1,
                duration_seconds=1200,
                passage_text=(
                    "Selon une étude publiée récemment par Statistique Canada, près de 40% des actifs canadiens "
                    "exercent désormais tout ou partie de leurs fonctions professionnelles à distance. "
                    "Si ce modèle hybride s'accompagne d'une réduction substantielle du temps de transport et "
                    "d'une plus grande autonomie, plusieurs sociologues tirent la sonnette d'alarme quant aux "
                    "risques de délitement du lien social et d'effacement des frontières entre vie privée et vie professionnelle."
                ),
                created_at=now,
                updated_at=now,
            )
            session.add(sec2)
            await session.flush()

            # Q3
            q3 = Question(
                section_id=sec2.id,
                prompt="D'après les sociologues cités, quel est l'inconvénient majeur du travail à distance ?",
                question_type=QuestionType.SINGLE_CHOICE,
                order_index=0,
                difficulty=3,
                level="B2",
                points=2,
                penalty_points=0,
                explanation="Le texte mentionne l'effacement de la frontière vie privée/vie pro et la perte de cohésion sociale.",
                status=ContentStatus.PUBLISHED.value,
                version=1,
                created_by_user_id=admin.id,
                created_at=now,
                updated_at=now,
            )
            session.add(q3)
            await session.flush()
            session.add_all([
                QuestionOption(question_id=q3.id, content="Une baisse notable de la productivité des employés", order_index=0, is_correct=False),
                QuestionOption(question_id=q3.id, content="Une fragilisation des relations humaines et de l'équilibre personnel", order_index=1, is_correct=True),
                QuestionOption(question_id=q3.id, content="Une augmentation spectaculaire des dépenses en matériel", order_index=2, is_correct=False),
                QuestionOption(question_id=q3.id, content="Le refus des employeurs de fournir un équipement adéquat", order_index=3, is_correct=False),
            ])

            # Freeze AssessmentVersion snapshot
            session.add(
                AssessmentVersion(
                    assessment_id=read_asmt.id,
                    version=1,
                    title=read_asmt.title,
                    description=read_asmt.description,
                    assessment_type=read_asmt.assessment_type.value,
                    duration_seconds=read_asmt.duration_seconds,
                    navigation_policy=read_asmt.navigation_policy.value,
                    scoring_policy=read_asmt.scoring_policy.value,
                    pass_percentage=read_asmt.pass_percentage,
                    sections_snapshot=[
                        {
                            "id": str(sec1.id),
                            "title": sec1.title,
                            "instructions": sec1.instructions,
                            "order_index": sec1.order_index,
                            "time_limit_seconds": sec1.duration_seconds,
                            "passage_text": sec1.passage_text,
                            "questions": [
                                {
                                    "id": str(q1.id),
                                    "prompt": q1.prompt,
                                    "question_type": q1.question_type.value,
                                    "difficulty": q1.difficulty,
                                    "level": q1.level,
                                    "points": q1.points,
                                    "options": [
                                        {"content": "Une hausse des tarifs", "is_correct": False},
                                        {"content": "Une modification d'itinéraire", "is_correct": True},
                                    ],
                                }
                            ],
                        }
                    ],
                    created_by_user_id=admin.id,
                    created_at=now,
                )
            )
            await session.flush()
            print("  [+] Created & frozen official Reading assessment.")
        else:
            print("  [=] Reading assessment already exists.")

        # 4. 10 Targeted Drill Exercises
        exercises_data = [
            ("Subjonctif Présent : Verbes d'obligation", "Complétez : Il est primordial que nous ___ (prendre) cette mesure sans tarder.", SkillCategory.GRAMMAR, "B2", 3, [
                {"content": "prenions", "is_correct": True},
                {"content": "prenons", "is_correct": False},
                {"content": "prendrons", "is_correct": False},
            ]),
            ("Subjonctif Présent : Expressions de sentiment", "Complétez : Je suis ravi qu'elle ___ (pouvoir) nous rejoindre au colloque.", SkillCategory.GRAMMAR, "B2", 3, [
                {"content": "puisse", "is_correct": True},
                {"content": "peut", "is_correct": False},
                {"content": "pourra", "is_correct": False},
            ]),
            ("Connecteurs Logiques : Concession", "Choisissez le connecteur adéquat : ___ ses multiples mises en garde, le projet a été validé.", SkillCategory.GRAMMAR, "C1", 4, [
                {"content": "En dépit de", "is_correct": True},
                {"content": "Grâce à", "is_correct": False},
                {"content": "Parce que", "is_correct": False},
            ]),
            ("Pronoms Relatifs Composés", "Le comité d'éthique ___ j'ai soumis mon rapport rendra son verdict vendredi.", SkillCategory.GRAMMAR, "C1", 4, [
                {"content": "auquel", "is_correct": True},
                {"content": "duquel", "is_correct": False},
                {"content": "dont", "is_correct": False},
            ]),
            ("Vocabulaire : Transition Écologique", "Quel terme désigne la quantité totale de gaz à effet de serre émise par une activité ?", SkillCategory.VOCABULARY, "B2", 3, [
                {"content": "L'empreinte carbone", "is_correct": True},
                {"content": "Le bilan financier", "is_correct": False},
                {"content": "L'impact acoustique", "is_correct": False},
            ]),
            ("Vocabulaire : Registre Soutenu TEF", "Trouvez le synonyme soutenu de l'expression 'commencer à faire des efforts' :", SkillCategory.VOCABULARY, "C1", 4, [
                {"content": "S'atteler à la tâche", "is_correct": True},
                {"content": "Prendre du bon temps", "is_correct": False},
                {"content": "Passer un coup de main", "is_correct": False},
            ]),
            ("Conjugaison : Concordance Passé Composé et Imparfait", "Pendant que nous ___ (marcher) dans la forêt, un orage soudain a éclaté.", SkillCategory.CONJUGATION, "B1", 2, [
                {"content": "marchions", "is_correct": True},
                {"content": "avons marché", "is_correct": False},
                {"content": "marcherions", "is_correct": False},
            ]),
            ("Conjugaison : Accord Participe Passé", "Les recommandations que la directrice a ___ (rédiger) ont été approuvées à l'unanimité.", SkillCategory.CONJUGATION, "B2", 3, [
                {"content": "rédigées", "is_correct": True},
                {"content": "rédigé", "is_correct": False},
                {"content": "rédigés", "is_correct": False},
            ]),
            ("Conditionnel Passé : Le regret", "Si j'avais été prévenu à temps, j' ___ (assister) à cette conférence inaugurale.", SkillCategory.CONJUGATION, "B2", 3, [
                {"content": "aurais assisté", "is_correct": True},
                {"content": "avais assisté", "is_correct": False},
                {"content": "assisterais", "is_correct": False},
            ]),
            ("Compréhension Rapide : Nuance Lexicale", "Dans un courriel administratif, quelle formule est appropriée pour solliciter un délai ?", SkillCategory.READING, "B1", 2, [
                {"content": "Je sollicite bienveillamment un report d'échéance", "is_correct": True},
                {"content": "Donnez-moi plus de temps sinon c'est impossible", "is_correct": False},
                {"content": "Je verrai quand j'aurai le temps", "is_correct": False},
            ]),
        ]

        for ex_title, ex_prompt, ex_cat, ex_lvl, ex_diff, opts in exercises_data:
            e_res = await session.execute(select(Exercise).where(Exercise.title == ex_title))
            if not e_res.scalar_one_or_none():
                ex = Exercise(
                    title=ex_title,
                    prompt=ex_prompt,
                    category=ex_cat,
                    difficulty=ex_diff,
                    level=ex_lvl,
                    instructions="Choisissez la bonne option pour compléter la phrase.",
                    options_payload=opts,
                    points=5,
                    status=ContentStatus.PUBLISHED.value,
                    version=1,
                    created_by_user_id=admin.id,
                    updated_by_user_id=admin.id,
                    created_at=now,
                    updated_at=now,
                )
                session.add(ex)
                await session.flush()

                session.add(
                    ExerciseVersion(
                        exercise_id=ex.id,
                        version=1,
                        title=ex.title,
                        prompt=ex.prompt,
                        instructions=ex.instructions,
                        explanation=ex.explanation,
                        category=ex.category.value,
                        difficulty=ex.difficulty,
                        level=ex.level,
                        points=ex.points,
                        options_payload=opts,
                        created_by_user_id=admin.id,
                        created_at=now,
                    )
                )
        await session.flush()
        print("  [✓] 10 drill exercises populated with immutable snapshots.")

        # 5. 2 Official TEF Writing Tasks
        writing_tasks_data = [
            (
                "Section A — Le sauvetage miraculeux d'un randonneur dans le parc de la Mauricie",
                "section_a",
                (
                    "Vous lisez le début d'un fait divers dans un journal québécois :\n"
                    "« Porté disparu depuis trois jours dans les sentiers escarpés du parc national de la Mauricie, "
                    "un randonneur de 42 ans a finalement été retrouvé sain et sauf hier matin grâce à son sifflet de détresse... »\n\n"
                    "Rédigez la suite de l'article en précisant les circonstances de sa disparition, "
                    "les conditions de sa survie et le déroulement des opérations de secours."
                ),
                80,
                120,
                20,
                "B1",
            ),
            (
                "Section B — Faut-il bannir les voitures des centres-villes canadiens ?",
                "section_b",
                (
                    "Vous avez lu dans un quotidien local la lettre d'un commerçant s'opposant vivement "
                    "à la piétonnisation intégrale du centre-ville, affirmant que cela tuerait le commerce de proximité.\n\n"
                    "Vous écrivez une lettre argumentée au rédacteur en chef du journal pour exprimer votre désaccord. "
                    "Vous défendez les bénéfices écologiques, sanitaires et économiques de la piétonnisation en illustrant vos propos "
                    "par au moins 3 arguments convaincants et des exemples concrets."
                ),
                200,
                250,
                40,
                "B2",
            ),
        ]

        for wt_title, wt_type, wt_prompt, min_w, max_w, dur_m, lvl in writing_tasks_data:
            wt_res = await session.execute(select(WritingTask).where(WritingTask.title == wt_title))
            if not wt_res.scalar_one_or_none():
                wt = WritingTask(
                    title=wt_title,
                    task_type=wt_type,
                    prompt=wt_prompt,
                    min_words=min_w,
                    max_words=max_w,
                    duration_minutes=dur_m,
                    target_level=lvl,
                    is_published=True,
                    status=ContentStatus.PUBLISHED.value,
                    version=1,
                    created_by_user_id=admin.id,
                    updated_by_user_id=admin.id,
                    created_at=now,
                    updated_at=now,
                )
                session.add(wt)
                await session.flush()

                session.add(
                    WritingTaskVersion(
                        writing_task_id=wt.id,
                        version=1,
                        title=wt.title,
                        task_type=wt.task_type,
                        prompt=wt.prompt,
                        min_words=wt.min_words,
                        max_words=wt.max_words,
                        duration_minutes=wt.duration_minutes,
                        level=wt.target_level,
                        evaluation_criteria=[],
                        created_by_user_id=admin.id,
                        created_at=now,
                    )
                )
        await session.flush()
        print("  [✓] 2 TEF writing tasks created and snapshotted.")

        # 6. Content Reviews (Queue Population)
        rev_res = await session.execute(select(ContentReview).limit(1))
        if not rev_res.scalar_one_or_none():
            session.add(
                ContentReview(
                    entity_type="assessment",
                    entity_id=read_asmt.id,
                    version=1,
                    reviewer_id=admin.id,
                    status=ReviewStatus.APPROVED.value,
                    comments="Examen conforme aux exigences officielles du TEF Canada. Validation B2 effectuée.",
                    created_at=now,
                )
            )
            # Add an audit event
            session.add(
                AuditEvent(
                    actor_user_id=admin.id,
                    action="content.publish",
                    entity_type="assessment",
                    entity_id=read_asmt.id,
                    payload={"title": read_asmt.title, "version": 1},
                    created_at=now,
                )
            )
            await session.flush()
            print("  [✓] Editorial review queue & audit logs initialized.")

        await session.commit()
        print("✨ Content Studio Seeding Complete!")


if __name__ == "__main__":
    asyncio.run(run_seed())
