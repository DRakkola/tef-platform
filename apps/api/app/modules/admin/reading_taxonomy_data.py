"""Canonical TEF Reading (Compréhension Écrite) Taxonomy V1 specification and seeder.

This module defines the platform's diagnostic reading taxonomy built around the official
TEF Reading construct. It decouples exam task types from cognitive reasoning and
transversal language competencies, with explicit CEFR benchmark descriptors and
directed dependency relationships.
"""

import asyncio
import datetime
import uuid
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Ensure all domain models are registered in metadata for relationship resolution
import app.modules.admin.ai_sandbox_models
import app.modules.admin.beta_models
import app.modules.admin.models
import app.modules.admin.speaking_config_models
import app.modules.admin.speaking_scenario_models
import app.modules.analytics.models
import app.modules.assessments.models
import app.modules.billing.models
import app.modules.learning.models
import app.modules.practice_pool.models
import app.modules.speaking.models
import app.modules.teachers.models
import app.modules.users.models
import app.modules.writing.models  # noqa: F401
from app.core.database import async_session_factory
from app.modules.admin.enums import (
    CEFRBand,
    SkillDimension,
    SkillRelationType,
    TaxonomyLifecycleStatus,
)
from app.modules.admin.models import (
    SkillLevelDescriptor,
    SkillModality,
    SkillRelation,
    TaskTypeSkill,
    TaxonomyVersion,
)
from app.modules.assessments.models import Skill, TaskType
from app.modules.learning.enums import SkillCategory

logger = structlog.get_logger("tef-api.taxonomy.reading")

CANONICAL_TAXONOMY_VERSION = "v2.0.0-canonical"
CANONICAL_TAXONOMY_UUID = uuid.UUID("00000000-0000-0000-0000-000000000002")

# ---------------------------------------------------------------------------
# 1. Reading Task Types (8 Official TEF Task Families)
# ---------------------------------------------------------------------------

READING_TASK_TYPES: list[dict[str, Any]] = [
    {
        "code": "daily_document",
        "name": "Documents de la vie quotidienne",
        "modality": "reading",
        "description": "Documents d'information pratique et de communication courante : petites annonces, affiches, prospectus, horaires, avis municipaux ou associatifs.",
        "is_active": True,
    },
    {
        "code": "sentence_gap",
        "name": "Phrases à compléter",
        "modality": "reading",
        "description": "Items de complétion lexicale ou grammaticale isolée testant la précision morphosyntaxique ou le choix lexical approprié.",
        "is_active": True,
    },
    {
        "code": "text_gap",
        "name": "Textes à trous (complétion textuelle)",
        "modality": "reading",
        "description": "Paragraphes ou courts passages à compléter exigeant la prise en compte de la cohérence globale, des connecteurs et des enchaînements logiques.",
        "is_active": True,
    },
    {
        "code": "document_matching",
        "name": "Appariement de documents",
        "modality": "reading",
        "description": "Mise en relation de profils, de besoins ou d'intentions avec une série de courts documents ou propositions (annonces, offres, services).",
        "is_active": True,
    },
    {
        "code": "graph_matching",
        "name": "Appariement graphiques et énoncés",
        "modality": "reading",
        "description": "Association d'énoncés, de tendances ou d'analyses à des représentations graphiques, diagrammes ou tableaux statistiques.",
        "is_active": True,
    },
    {
        "code": "administrative_document",
        "name": "Documents administratifs et réglementaires",
        "modality": "reading",
        "description": "Textes institutionnels, circulaires, règlements intérieurs, démarches d'immigration ou formulaires officiels énonçant des règles ou conditions.",
        "is_active": True,
    },
    {
        "code": "professional_document",
        "name": "Communications professionnelles",
        "modality": "reading",
        "description": "Courriels internes, notes de service, comptes-rendus de réunion, directives d'entreprise régissant le milieu du travail.",
        "is_active": True,
    },
    {
        "code": "press_article",
        "name": "Articles de presse et analyses",
        "modality": "reading",
        "description": "Articles de fond, reportages, chroniques et éditoriaux traitant de faits de société, d'actualité ou de débats d'idées avec argumentation et nuances.",
        "is_active": True,
    },
]

# ---------------------------------------------------------------------------
# 2. Reasoning Competencies (Cognitive Operations)
# ---------------------------------------------------------------------------

REASONING_COMPETENCIES: list[dict[str, Any]] = [
    # Top-Level Container
    {
        "code": "reasoning_reading_root",
        "name": "Compétences cognitives de compréhension écrite",
        "internal_label": "Reading Cognitive Reasoning Root",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": None,
        "assessable": False,
        "description": "Opérations intellectuelles et cognitives mobilisées pour extraire, analyser et évaluer le sens d'un texte écrit.",
        "applicable_modalities": ["reading"],
        "applicable_task_types": [],
        "descriptors": {},
    },
    # Container 1: Information Extraction
    {
        "code": "reasoning_info_extraction",
        "name": "Extraction d'informations factuelles",
        "internal_label": "Factual Information Extraction",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": "reasoning_reading_root",
        "assessable": False,
        "description": "Capacité à parcourir un document pour localiser et prélever des données brutes explicites.",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": ["daily_document", "document_matching", "administrative_document"],
        "descriptors": {},
    },
    {
        "code": "reasoning_locate_information",
        "name": "Repérage d'informations factuelles",
        "internal_label": "Locate Factual Information (Scanning)",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": "reasoning_info_extraction",
        "assessable": True,
        "description": "Localiser rapidement et avec précision des données factuelles explicites (noms, chiffres, dates, horaires, lieux, adresses) dans des documents usuels ou discontinus.",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": ["daily_document", "document_matching", "administrative_document"],
        "descriptors": {
            CEFRBand.A1: (
                "Peut repérer des noms, des chiffres et des mots familiers sur une affiche, un horaire ou une annonce très simple.",
                "Questions directes à amorce littérale portant sur des coordonnées, dates ou montants sans piège de reformulation.",
            ),
            CEFRBand.A2: (
                "Peut localiser une information prévisible dans des documents courants (menus, horaires, petites annonces, répertoires).",
                "Recherche guidée dans un document court avec quelques distracteurs factuels.",
            ),
            CEFRBand.B1: (
                "Peut parcourir rapidement un document d'une page pour repérer des consignes ou des informations spécifiques dispersées.",
                "Balayage d'annonces comparatives ou de notes d'information avec vocabulaire usuel.",
            ),
        },
    },
    {
        "code": "reasoning_identify_specific_detail",
        "name": "Identification de détails précis",
        "internal_label": "Identify Specific Detail",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": "reasoning_info_extraction",
        "assessable": True,
        "description": "Comprendre et extraire une clause spécifique, une consigne, une condition d'éligibilité ou un fait ponctuel énoncé explicitement dans le corps du texte.",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": [
            "daily_document",
            "administrative_document",
            "professional_document",
            "press_article",
        ],
        "descriptors": {
            CEFRBand.A2: (
                "Peut identifier un détail pratique simple dans une consigne ou un avis d'usagers (durée, modalité d'inscription).",
                "Questions formulées avec des mots proches du texte.",
            ),
            CEFRBand.B1: (
                "Peut repérer et comprendre un détail significatif dans une note de service, un règlement ou un article court.",
                "Paraphrase légère dans la proposition correcte nécessitant d'éviter les faux amis textuels.",
            ),
            CEFRBand.B2: (
                "Peut isoler un détail technique, une nuance juridique ou une réserve dans un document institutionnel ou un article dense.",
                "Distracteurs plausibles basés sur des clauses limitatives ou des exceptions mentionnées dans le texte.",
            ),
        },
    },
    # Container 2: Global Comprehension
    {
        "code": "reasoning_global_comprehension",
        "name": "Compréhension globale et contextuelle",
        "internal_label": "Global Comprehension and Context",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": "reasoning_reading_root",
        "assessable": False,
        "description": "Capacité à dégager la structure, le thème principal et la situation d'énonciation d'un document.",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": [
            "daily_document",
            "press_article",
            "professional_document",
            "administrative_document",
            "text_gap",
        ],
        "descriptors": {},
    },
    {
        "code": "reasoning_identify_main_idea",
        "name": "Identification de l'idée principale",
        "internal_label": "Identify Main Idea / Gist",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": "reasoning_global_comprehension",
        "assessable": True,
        "description": "Dégager le thème central, le message clé ou la thèse directrice d'un document sans se laisser distraire par les détails secondaires.",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": [
            "daily_document",
            "press_article",
            "professional_document",
            "administrative_document",
            "text_gap",
        ],
        "descriptors": {
            CEFRBand.A2: (
                "Peut identifier l'objet global d'un message court ou d'une annonce (vente, invitation, offre de service).",
                "Options claires et contrastées résumant la finalité globale du document.",
            ),
            CEFRBand.B1: (
                "Peut dégager l'idée directrice d'un texte informatif ou d'un compte-rendu d'événement sans ambiguïté.",
                "Résumé d'un article narratif ou explicatif en une phrase de synthèse.",
            ),
            CEFRBand.B2: (
                "Peut synthétiser la problématique centrale d'un article d'analyse ou d'un rapport professionnel complexe.",
                "Distracteurs correspondant à des sous-thèmes réels du texte mais qui ne résument pas la thèse principale.",
            ),
            CEFRBand.C1: (
                "Peut appréhender l'articulation générale et la portée fondamentale d'un texte d'opinion dense ou hautement conceptuel.",
                "Textes polémiques ou philosophiques avec argumentation abstraite.",
            ),
        },
    },
    {
        "code": "reasoning_understand_context",
        "name": "Compréhension de la situation d'énonciation",
        "internal_label": "Understand Context and Communicative Situation",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": "reasoning_global_comprehension",
        "assessable": True,
        "description": "Identifier la nature du document, le profil de l'émetteur, le destinataire ciblé et le cadre pragmatique de la communication.",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": [
            "daily_document",
            "professional_document",
            "administrative_document",
        ],
        "descriptors": {
            CEFRBand.A1: (
                "Peut reconnaître le type de document le plus courant (carte postale, menu, petite annonce).",
                "Indices visuels et typographiques évidents.",
            ),
            CEFRBand.A2: (
                "Peut déduire la relation basique entre l'émetteur et le destinataire (client/fournisseur, employeur/employé, ami/ami).",
                "Formules de salutation et coordonnées explicites.",
            ),
            CEFRBand.B1: (
                "Peut identifier le cadre institutionnel ou professionnel précis d'une correspondance ou d'un avis officiel.",
                "Déduction du rôle de l'auteur et de la cible à partir du ton et des formules rituelles.",
            ),
            CEFRBand.B2: (
                "Peut analyser les enjeux de pouvoir, les non-dits déontologiques ou le contexte socio-politique d'un document professionnel sensible.",
                "Circulaires internes délicates, lettres de réclamation complexes ou négociations professionnelles.",
            ),
        },
    },
    {
        "code": "reasoning_understand_sequence",
        "name": "Compréhension de la chronologie et des étapes",
        "internal_label": "Understand Chronological & Procedural Sequence",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": "reasoning_global_comprehension",
        "assessable": True,
        "description": "Reconstituer la succession temporelle d'événements, l'ordre des étapes d'une procédure administrative ou le déroulement narratif d'un fait divers.",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": ["text_gap", "administrative_document", "press_article"],
        "descriptors": {
            CEFRBand.A2: (
                "Peut suivre un enchaînement d'instructions simples balisées par des repères temporels évidents (d'abord, ensuite, enfin).",
                "Consignes de transport, recettes ou horaires à étapes.",
            ),
            CEFRBand.B1: (
                "Peut reconstituer la chronologie d'un récit de fait divers comportant retours en arrière (flashbacks) et anticipation.",
                "Articles narratifs utilisant passé composé et plus-que-parfait.",
            ),
            CEFRBand.B2: (
                "Peut ordonner une procédure administrative ou judiciaire complexe comportant des délais, conditions suspensives et recours.",
                "Textes réglementaires denses avec imbrication de conditions préalables.",
            ),
        },
    },
    # Container 3: Relational Analysis
    {
        "code": "reasoning_relational_synthesis",
        "name": "Analyse relationnelle et comparaison",
        "internal_label": "Relational Analysis and Synthesis",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": "reasoning_reading_root",
        "assessable": False,
        "description": "Mise en relation d'éléments d'information multiples, de causes/effets et de données chiffrées.",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": [
            "document_matching",
            "graph_matching",
            "press_article",
            "professional_document",
        ],
        "descriptors": {},
    },
    {
        "code": "reasoning_identify_cause_effect",
        "name": "Identification des liens de cause et d'effet",
        "internal_label": "Identify Cause and Effect Relationships",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": "reasoning_relational_synthesis",
        "assessable": True,
        "description": "Identifier et relier les facteurs explicatifs, causes directes et conséquences logiques résultant d'une décision, d'un événement ou d'un phénomène.",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": ["press_article", "professional_document", "text_gap"],
        "descriptors": {
            CEFRBand.B1: (
                "Peut identifier la cause directe ou la conséquence explicite d'un événement rapporté dans la presse.",
                "Relations de cause/conséquence signalées par des connecteurs clairs (parce que, grâce à, donc).",
            ),
            CEFRBand.B2: (
                "Peut démêler un enchaînement causal complexe comportant causes multiples, effets secondaires et causalité indirecte.",
                "Articles économiques ou sociologiques où causes et conséquences sont disséminées dans différents paragraphes.",
            ),
            CEFRBand.C1: (
                "Peut évaluer la validité des relations de cause à effet postulées par l'auteur et détecter les amalgames ou corrélations douteuses.",
                "Analyses éditoriales polémiques et débats d'experts contradictoires.",
            ),
        },
    },
    {
        "code": "reasoning_compare_and_match",
        "name": "Comparaison et appariement d'informations",
        "internal_label": "Compare and Match Information",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": "reasoning_relational_synthesis",
        "assessable": True,
        "description": "Confronter plusieurs propositions, profils ou critères pour établir des analogies, identifier des divergences ou opérer un appariement objectif.",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": ["document_matching", "graph_matching", "daily_document"],
        "descriptors": {
            CEFRBand.A2: (
                "Peut associer deux critères simples (par ex. budget et disponibilité) à une annonce correspondante parmi plusieurs.",
                "Appariement direct avec lexique quasi-identique.",
            ),
            CEFRBand.B1: (
                "Peut croiser 3 à 4 critères distincts pour trouver l'unique offre répondant aux besoins formulés dans une mise en situation.",
                "Appariements comportant des contraintes d'exclusion (par ex. 'pas le week-end', 'avec animaux').",
            ),
            CEFRBand.B2: (
                "Peut comparer finement deux points de vue contradictoires sur un même sujet et relever points d'accord et divergences.",
                "Textes d'opinion croisés avec nuances et concessions mutuelles.",
            ),
        },
    },
    {
        "code": "reasoning_interpret_data",
        "name": "Interprétation de données visuelles et chiffrées",
        "internal_label": "Interpret Visual and Quantitative Data",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": "reasoning_relational_synthesis",
        "assessable": True,
        "description": "Analyser des données chiffrées, graphiques, pourcentages et tendances statistiques pour en extraire le constat ou la conclusion sous-jacente.",
        "applicable_modalities": ["reading"],
        "applicable_task_types": ["graph_matching", "press_article"],
        "descriptors": {
            CEFRBand.B1: (
                "Peut associer un énoncé simple à un graphique linéaire ou un diagramme circulaire représentant des proportions évidentes.",
                "Représentations statistiques usuelles (croissance, baisse, majorité).",
            ),
            CEFRBand.B2: (
                "Peut dégager la tendance de fond d'un tableau croisé ou d'un histogramme à plusieurs variables sans se tromper d'axe.",
                "Données économiques, démographiques ou sociologiques comparatives.",
            ),
            CEFRBand.C1: (
                "Peut vérifier si l'interprétation discursive des données par un auteur reflète fidèlement la réalité statistique présentée.",
                "Détection des extrapolations abusives ou des omissions sélectives de données.",
            ),
        },
    },
    # Container 4: Inference and Evaluation
    {
        "code": "reasoning_inference_and_evaluation",
        "name": "Inférence et analyse critique",
        "internal_label": "Inference and Critical Evaluation",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": "reasoning_reading_root",
        "assessable": False,
        "description": "Capacité à dépasser le sens littéral pour saisir l'implicite, l'intention et le positionnement idéologique ou affectif.",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": ["press_article", "professional_document"],
        "descriptors": {},
    },
    {
        "code": "reasoning_infer_implicit_meaning",
        "name": "Déduction du sens implicite",
        "internal_label": "Infer Implicit Meaning",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": "reasoning_inference_and_evaluation",
        "assessable": True,
        "description": "Inférer des conclusions logiques, des motivations inavouées ou des réalités sous-entendues à partir d'indices textuels convergents.",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": ["press_article", "professional_document"],
        "descriptors": {
            CEFRBand.B1: (
                "Peut déduire une information logique évidente qui n'est pas dite mot à mot mais découle directement du contexte.",
                "Questions du type 'Que peut-on en déduire ?' basées sur des faits transparents.",
            ),
            CEFRBand.B2: (
                "Peut inférer des intentions, des réticences ou des présupposés idéologiques dans un article d'analyse ou un courriel d'affaires.",
                "Déduction nécessitant le croisement de plusieurs indices disséminés dans le texte.",
            ),
            CEFRBand.C1: (
                "Peut appréhender sans effort les sous-entendus culturels, allusions historiques et figures de style implicites.",
                "Textes journalistiques denses, chroniques d'humeur et éditoriaux à double niveau de lecture.",
            ),
            CEFRBand.C2: (
                "Peut décoder avec acuité l'ambiguïté délibérée, le cynisme feint et les jeux d'esprit les plus subtils de la langue française.",
                "Essais littéraires ou tribunes polémiques complexes.",
            ),
        },
    },
    {
        "code": "reasoning_identify_author_position",
        "name": "Identification du point de vue de l'auteur",
        "internal_label": "Identify Author's Stance and Perspective",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": "reasoning_inference_and_evaluation",
        "assessable": True,
        "description": "Discerner le positionnement intellectuel de l'auteur (adhésion, plaidoyer, dénonciation, réserve sceptique ou neutralité feinte) dans un débat.",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": ["press_article"],
        "descriptors": {
            CEFRBand.B1: (
                "Peut déterminer si l'auteur est globalement favorable ou défavorable à la mesure ou au projet présenté.",
                "Prises de position explicites avec adjectifs évaluatifs simples (utile, dangereux, encourageant).",
            ),
            CEFRBand.B2: (
                "Peut identifier la thèse véritable de l'auteur derrière les concessions rhétoriques et contre-arguments apparents.",
                "Éditoriaux utilisant 'certes... mais', 'il n'en demeure pas moins que'.",
            ),
            CEFRBand.C1: (
                "Peut analyser la complexité et les nuances d'un point de vue qui refuse la dichotomie simpliste 'pour ou contre'.",
                "Tribunes intellectuelles avec positionnement modéré, critique ou prospectif.",
            ),
        },
    },
    {
        "code": "reasoning_identify_tone_and_intent",
        "name": "Identification du ton et de l'intention communicative",
        "internal_label": "Identify Tone and Communicative Intent",
        "dimension": SkillDimension.REASONING,
        "domain": "reading",
        "category": SkillCategory.READING,
        "parent_code": "reasoning_inference_and_evaluation",
        "assessable": True,
        "description": "Reconnaître le ton dominant (ironique, dramatique, polémique, bienveillant, officiel) et la visée pragmatique (sensibiliser, avertir, prescrire, critiquer).",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": ["press_article", "professional_document"],
        "descriptors": {
            CEFRBand.B1: (
                "Peut identifier la visée communicative claire d'un document (inviter, rassurer, réclamer, avertir).",
                "Documents d'entreprise ou notes d'information publiques.",
            ),
            CEFRBand.B2: (
                "Peut détecter l'ironie, l'exagération volontaire ou la tonalité polémique dans un texte d'opinion.",
                "Articles satiriques ou chroniques mordantes.",
            ),
            CEFRBand.C1: (
                "Peut distinguer les nuances fines entre dérision, sarcasme, détachement feint et gravité solennelle.",
                "Textes éditoriaux hautement stylisés à visée persuasive indirecte.",
            ),
        },
    },
]

# ---------------------------------------------------------------------------
# 3. Transversal Language Competencies (Linguistic Processing)
# ---------------------------------------------------------------------------

LANGUAGE_COMPETENCIES: list[dict[str, Any]] = [
    # Domain 1: Vocabulary
    {
        "code": "language_vocabulary_domain",
        "name": "Compétences lexicales et vocabulaire",
        "internal_label": "Lexical Competence and Vocabulary",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "vocabulary",
        "category": SkillCategory.VOCABULARY,
        "parent_code": None,
        "assessable": False,
        "description": "Connaissance du lexique, compréhension en contexte, synonymie, collocations et maîtrise des registres.",
        "applicable_modalities": ["reading", "listening", "writing", "speaking"],
        "applicable_task_types": [],
        "descriptors": {},
    },
    {
        "code": "lang_vocab_in_context",
        "name": "Vocabulaire en contexte",
        "internal_label": "Vocabulary in Context",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "vocabulary",
        "category": SkillCategory.VOCABULARY,
        "parent_code": "language_vocabulary_domain",
        "assessable": True,
        "description": "Déduire la signification exacte d'un terme inconnu, d'un néologisme ou d'une acception rare à l'aide des indices sémantiques environnants.",
        "applicable_modalities": ["reading", "listening", "writing", "speaking"],
        "applicable_task_types": ["sentence_gap", "text_gap", "press_article", "daily_document"],
        "descriptors": {
            CEFRBand.A1: (
                "Comprend des mots isolés et des expressions courantes relatives à soi-même, à l'environnement quotidien immédiat.",
                "Termes transparents ou familiers du quotidien.",
            ),
            CEFRBand.A2: (
                "Comprend les mots les plus fréquents de la vie quotidienne, du travail et des loisirs.",
                "Items de complétion lexicale basés sur les besoins concrets.",
            ),
            CEFRBand.B1: (
                "Comprend le vocabulaire général de sujets familiers et déduit le sens d'un mot inconnu à partir du contexte immédiat.",
                "Articles d'information générale avec lexique professionnel courant.",
            ),
            CEFRBand.B2: (
                "Dispose d'un vocabulaire étendu sur les faits de société, l'actualité politique, économique et scientifique.",
                "Termes techniques ou abstraits à contextualiser sans aide de dictionnaire.",
            ),
            CEFRBand.C1: (
                "Maîtrise un répertoire lexical vaste, incluant expressions idiomatiques rares, nuances d'emploi et termes spécialisés.",
                "Textes denses aux champs lexicaux croisés et imagés.",
            ),
        },
    },
    {
        "code": "lang_paraphrase_and_synonyms",
        "name": "Reconnaissance de synonymes et périphrases",
        "internal_label": "Paraphrase and Synonym Recognition",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "vocabulary",
        "category": SkillCategory.VOCABULARY,
        "parent_code": "language_vocabulary_domain",
        "assessable": True,
        "description": "Identifier l'équivalence sémantique entre une formulation du texte source et une reformulation synonymique dans les options de réponse.",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": [
            "daily_document",
            "press_article",
            "document_matching",
            "professional_document",
        ],
        "descriptors": {
            CEFRBand.A2: (
                "Reconnaît des équivalences synonymiques directes mot-à-mot (voiture / automobile, achat / acquisition).",
                "Synonymes usuels et fréquents.",
            ),
            CEFRBand.B1: (
                "Associe une phrase simple à sa reformulation périphérique sans contresens (diminuer de moitié / chuter de 50%).",
                "Reformulation d'actions et de constats concrets.",
            ),
            CEFRBand.B2: (
                "Identifie des reformulations conceptuelles complexes et des équivalences métaphoriques d'arguments.",
                "Options d'examen résumant un paragraphe entier par une tournure nominale synthétique.",
            ),
            CEFRBand.C1: (
                "Perçoit la fidélité ou la distorsion subtile d'une idée paraphrasée avec condensation sémantique maximale.",
                "Options très proches où un seul adjectif crée une distorsion d'intensité.",
            ),
        },
    },
    {
        "code": "lang_collocations_and_idioms",
        "name": "Collocations et expressions figées",
        "internal_label": "Collocations and Idiomatic Usage",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "vocabulary",
        "category": SkillCategory.VOCABULARY,
        "parent_code": "language_vocabulary_domain",
        "assessable": True,
        "description": "Maîtriser les associations lexicales habituelles (verbe + complément figé, adjectif idoine) et expressions idiomatiques courantes.",
        "applicable_modalities": ["reading", "listening", "writing", "speaking"],
        "applicable_task_types": ["sentence_gap", "text_gap", "press_article"],
        "descriptors": {
            CEFRBand.B1: (
                "Reconnaît et emploie les collocations verbales usuelles (prendre une décision, poser une question, faire attention).",
                "Complétion de phrases à trous avec choix de verbe support.",
            ),
            CEFRBand.B2: (
                "Maîtrise les associations lexicales soutenues du français formel (porter un jugement, susciter l'engouement, tirer la sonnette d'alarme).",
                "Items de complétion dans des textes professionnels ou journalistiques.",
            ),
            CEFRBand.C1: (
                "Comprend et manie avec naturel les métaphores lexicalisées et tournures idiomatiques les plus raffinées de la langue.",
                "Reconnaissance d'allusions culturelles et d'expressions figées rares.",
            ),
        },
    },
    {
        "code": "lang_register_and_style",
        "name": "Registres de langue et niveau stylistique",
        "internal_label": "Register and Stylistic Variation",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "vocabulary",
        "category": SkillCategory.VOCABULARY,
        "parent_code": "language_vocabulary_domain",
        "assessable": True,
        "description": "Identifier les écarts stylistiques (familier, standard/courant, soutenu, administratif/juridique) appropriés au genre de texte.",
        "applicable_modalities": ["reading", "listening", "writing", "speaking"],
        "applicable_task_types": [
            "daily_document",
            "professional_document",
            "administrative_document",
            "press_article",
        ],
        "descriptors": {
            CEFRBand.B1: (
                "Distingue le style informel d'un courriel amical du ton neutre d'une note administrative.",
                "Repérage d'intrus stylistiques dans un texte professionnel.",
            ),
            CEFRBand.B2: (
                "Identifie les caractéristiques du style journalistique soutenu ou du jargon technico-administratif.",
                "Choix de la formule de politesse ou du lexique correspondant au niveau d'exigence protocolaire.",
            ),
            CEFRBand.C1: (
                "Analyse les effets stylistiques recherchés par l'auteur (ironie par décalage de registre, anoblissement ou trivialisation).",
                "Articles littéraires ou critiques culturelles.",
            ),
        },
    },
    # Domain 2: Grammar
    {
        "code": "language_grammar_domain",
        "name": "Compétences morphosyntaxiques et grammaticales",
        "internal_label": "Morphosyntax and Grammar",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "grammar",
        "category": SkillCategory.GRAMMAR,
        "parent_code": None,
        "assessable": False,
        "description": "Règles d'accord, système pronominal, rection prépositionnelle et structures de négation.",
        "applicable_modalities": ["reading", "listening", "writing", "speaking"],
        "applicable_task_types": [],
        "descriptors": {},
    },
    {
        "code": "lang_grammatical_agreement",
        "name": "Accords grammaticaux",
        "internal_label": "Grammatical Agreement",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "grammar",
        "category": SkillCategory.GRAMMAR,
        "parent_code": "language_grammar_domain",
        "assessable": True,
        "description": "Appliquer avec rigueur les accords en genre et en nombre (sujet-verbe, nom-adjectif) et l'accord complexe du participe passé.",
        "applicable_modalities": ["reading", "writing"],
        "applicable_task_types": ["sentence_gap", "text_gap"],
        "descriptors": {
            CEFRBand.A1: (
                "Accorde correctement le genre et le nombre des adjectifs réguliers simples.",
                "Items de complétion directe du groupe nominal.",
            ),
            CEFRBand.A2: (
                "Accorde le verbe avec un sujet simple et applique l'accord du participe passé avec l'auxiliaire être.",
                "Choix de la forme verbale ou adjective fléchie.",
            ),
            CEFRBand.B1: (
                "Maîtrise l'accord sujet-verbe éloigné ou inversé et l'accord du participe passé avec avoir précédé du COD.",
                "Phrases relatives où le COD antéposé commande l'accord.",
            ),
            CEFRBand.B2: (
                "Résout sans faute les accords délicats des verbes pronominaux et des participes passés suivis d'un infinitif.",
                "Textes de lacunes grammaticales avancées.",
            ),
        },
    },
    {
        "code": "lang_pronouns_and_anaphora",
        "name": "Système pronominal et anaphores",
        "internal_label": "Pronoun System and Anaphora Resolution",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "grammar",
        "category": SkillCategory.GRAMMAR,
        "parent_code": "language_grammar_domain",
        "assessable": True,
        "description": "Comprendre et manipuler les pronoms personnels, adverbiaux (en, y), possessifs, démonstratifs et relatifs simples ou composés.",
        "applicable_modalities": ["reading", "listening", "writing", "speaking"],
        "applicable_task_types": ["sentence_gap", "text_gap", "press_article"],
        "descriptors": {
            CEFRBand.A2: (
                "Identifie l'antécédent de pronoms personnels sujets ou objets directs simples (le, la, les, lui).",
                "Résolution anaphorique immédiate dans la phrase précédente.",
            ),
            CEFRBand.B1: (
                "Maîtrise l'emploi de 'y', 'en' et des pronoms relatifs simples (qui, que, où, dont).",
                "Remplacement pronominal et complétion de subordonnées relatives.",
            ),
            CEFRBand.B2: (
                "Interprète sans ambiguïté les pronoms relatifs composés (auquel, duquel, avec lesquels) et démonstratifs (celui-ci, ceux-là).",
                "Suivi de chaînes anaphoriques complexes sur plusieurs phrases dans un texte d'analyse.",
            ),
            CEFRBand.C1: (
                "Démêle immédiatement les références anaphoriques multiples ou abstraites (ce qui, le fait que, tel).",
                "Articles juridico-administratifs à syntaxe dense.",
            ),
        },
    },
    {
        "code": "lang_prepositions_and_governance",
        "name": "Prépositions et rection verbale",
        "internal_label": "Prepositions and Verbal Governance",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "grammar",
        "category": SkillCategory.GRAMMAR,
        "parent_code": "language_grammar_domain",
        "assessable": True,
        "description": "Sélectionner la préposition adéquate régie par un verbe ou un adjectif (penser à/de, s'intéresser à, être fier de) et prépositions spatiales/temporelles.",
        "applicable_modalities": ["reading", "writing", "speaking"],
        "applicable_task_types": ["sentence_gap", "text_gap"],
        "descriptors": {
            CEFRBand.A1: (
                "Emploie correctement les prépositions de lieu fondamentales (à, en, chez, dans).",
                "Phrases lacunaires simples de la vie pratique.",
            ),
            CEFRBand.A2: (
                "Maîtrise les prépositions temporelles et spatiales courantes (avant, après, depuis, pendant, vers).",
                "Itinéraires et plannings d'activités.",
            ),
            CEFRBand.B1: (
                "Sélectionne la préposition régie par les verbes fréquents (se souvenir de, décider de, participer à).",
                "Items de complétion syntaxique à 4 options prépositives.",
            ),
            CEFRBand.B2: (
                "Maîtrise les locutions prépositives soutenues et la rection des adjectifs et verbes abstraits (en dépit de, être enclin à, pallier sans préposition).",
                "Distracteurs portant sur les confusions courantes de rection verbale.",
            ),
        },
    },
    {
        "code": "lang_negation_and_restriction",
        "name": "Négation complexe et structures restrictives",
        "internal_label": "Negation and Restrictive Structures",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "grammar",
        "category": SkillCategory.GRAMMAR,
        "parent_code": "language_grammar_domain",
        "assessable": True,
        "description": "Interpréter la portée des négations doubles, partielles ou restrictives (ne... que, nullement, sans que, à moins que).",
        "applicable_modalities": ["reading", "listening"],
        "applicable_task_types": ["sentence_gap", "administrative_document", "press_article"],
        "descriptors": {
            CEFRBand.A2: (
                "Comprend la négation absolue simple (ne... pas, ne... plus, ne... jamais, ne... rien).",
                "Consignes et interdictions de la vie quotidienne.",
            ),
            CEFRBand.B1: (
                "Interprète correctement la restriction 'ne... que' (équivalente à 'seulement') sans la confondre avec une négation totale.",
                "Conditions d'accès à des tarifs ou services restreints.",
            ),
            CEFRBand.B2: (
                "Comprend la portée des négations combinées et termes privatifs (nullement, guère, faute de, sans pour autant).",
                "Règlements stricts et articles d'opinion nuançant une affirmation.",
            ),
            CEFRBand.C1: (
                "Décode la litote, la double négation affirmative (il n'est pas impossible que) et les négations explétives.",
                "Textes polémiques ou littéraires soutenus.",
            ),
        },
    },
    # Domain 3: Verb System
    {
        "code": "language_verb_system_domain",
        "name": "Système verbal et modes",
        "internal_label": "Verb System and Modes",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "conjugation",
        "category": SkillCategory.CONJUGATION,
        "parent_code": None,
        "assessable": False,
        "description": "Valeur temporelle des temps de l'indicatif, sélection du subjonctif et nuances du conditionnel.",
        "applicable_modalities": ["reading", "listening", "writing", "speaking"],
        "applicable_task_types": [],
        "descriptors": {},
    },
    {
        "code": "lang_tense_selection_and_aspect",
        "name": "Concordance et aspect temporel",
        "internal_label": "Tense Selection and Aspectual Nuance",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "conjugation",
        "category": SkillCategory.CONJUGATION,
        "parent_code": "language_verb_system_domain",
        "assessable": True,
        "description": "Distinguer les plans temporels du récit et du discours (imparfait vs passé composé, plus-que-parfait, futur antérieur).",
        "applicable_modalities": ["reading", "listening", "writing", "speaking"],
        "applicable_task_types": ["sentence_gap", "text_gap", "press_article"],
        "descriptors": {
            CEFRBand.A2: (
                "Distingue le présent, le passé composé et le futur proche dans des contextes biographiques simples.",
                "Complétion de phrases à indicateurs temporels explicites (hier, demain).",
            ),
            CEFRBand.B1: (
                "Maîtrise l'opposition aspectuelle fondamentale du récit : passé composé (action ponctuelle) vs imparfait (description, habitude).",
                "Récit de faits divers avec alternance action/décor.",
            ),
            CEFRBand.B2: (
                "Applique la concordance des temps dans le passé et manie le plus-que-parfait et le futur antérieur avec rigueur.",
                "Textes historiques ou d'analyse rétrospective à plusieurs strates temporelles.",
            ),
        },
    },
    {
        "code": "lang_verbal_moods",
        "name": "Modes verbaux (Subjonctif, Conditionnel)",
        "internal_label": "Verbal Moods (Subjunctive, Conditional, Indicative)",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "conjugation",
        "category": SkillCategory.CONJUGATION,
        "parent_code": "language_verb_system_domain",
        "assessable": True,
        "description": "Maîtriser les déclencheurs du subjonctif (nécessité, émotion, doute, volonté) et les emplois du conditionnel (atténuation, éventualité).",
        "applicable_modalities": ["reading", "listening", "writing", "speaking"],
        "applicable_task_types": [
            "sentence_gap",
            "text_gap",
            "professional_document",
            "press_article",
        ],
        "descriptors": {
            CEFRBand.B1: (
                "Reconnaît et emploie le subjonctif présent après les structures d'obligation impersonnelles fondamentales (il faut que...).",
                "Items de lacunes avec verbes réguliers fréquents au subjonctif.",
            ),
            CEFRBand.B2: (
                "Maîtrise le subjonctif après verbes d'opinion négatifs, de sentiment, et locutions conjonctives (bien que, pour que, avant que).",
                "Distinction fine entre indicatif (certitude) et subjonctif (doute/contestation).",
            ),
            CEFRBand.C1: (
                "Distingue le subjonctif passé pour marquer l'antériorité et comprend le conditionnel journalistique d'information non confirmée.",
                "Articles d'investigation de presse avec hypothèses et prudence énonciative.",
            ),
        },
    },
    # Domain 4: Syntax
    {
        "code": "language_syntax_domain",
        "name": "Syntaxe de la phrase complexe",
        "internal_label": "Syntax and Complex Sentences",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "syntax",
        "category": SkillCategory.GRAMMAR,
        "parent_code": None,
        "assessable": False,
        "description": "Architecture des propositions circonstancielles, complétives et systèmes conditionnels.",
        "applicable_modalities": ["reading", "writing"],
        "applicable_task_types": [],
        "descriptors": {},
    },
    {
        "code": "lang_subordination_and_clauses",
        "name": "Subordination et propositions enchâssées",
        "internal_label": "Subordination and Embedded Clauses",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "syntax",
        "category": SkillCategory.GRAMMAR,
        "parent_code": "language_syntax_domain",
        "assessable": True,
        "description": "Décrypter l'imbrication des propositions circonstancielles, complétives et relatives enchâssées dans des phrases longues.",
        "applicable_modalities": ["reading", "writing"],
        "applicable_task_types": [
            "sentence_gap",
            "text_gap",
            "administrative_document",
            "press_article",
        ],
        "descriptors": {
            CEFRBand.B1: (
                "Relie deux propositions par les conjonctions de subordination les plus usuelles (quand, comme, si, parce que).",
                "Phrases complexes à structure binaire équilibrée.",
            ),
            CEFRBand.B2: (
                "Comprend des phrases longues contenant plusieurs niveaux de subordination (complétive + relative + circonstancielle).",
                "Textes administratifs et éditoriaux à structure périodique.",
            ),
            CEFRBand.C1: (
                "Décortique sans ralentissement des phrases complexes comportant inversions stylistiques, participiales et incises multiples.",
                "Analyses critiques denses au style littéraire ou académique.",
            ),
        },
    },
    {
        "code": "lang_hypothetical_systems",
        "name": "Systèmes hypothétiques (Si...)",
        "internal_label": "Hypothetical Systems and Conditionals",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "syntax",
        "category": SkillCategory.GRAMMAR,
        "parent_code": "language_syntax_domain",
        "assessable": True,
        "description": "Interpréter les structures de la condition et de l'irréel (si + présent/futur, si + imparfait/conditionnel, si + PQP/conditionnel passé).",
        "applicable_modalities": ["reading", "listening", "writing", "speaking"],
        "applicable_task_types": ["sentence_gap", "text_gap", "press_article"],
        "descriptors": {
            CEFRBand.B1: (
                "Maîtrise le potentiel réel : 'si + présent -> futur simple' pour exprimer une hypothèse réalisable.",
                "Items de complétion verbale de condition standard.",
            ),
            CEFRBand.B2: (
                "Comprend l'irréel du présent ('si + imparfait -> conditionnel présent') et l'irréel du passé ('si + PQP -> conditionnel passé').",
                "Textes de prospective ou de regret/reproche historique.",
            ),
            CEFRBand.C1: (
                "Interprète les alternatives sophistiquées à 'si' (au cas où + cond., pourvu que + subj., à condition que + subj., en admettant que).",
                "Éditoriaux formulant des scénarios économiques ou géopolitiques hypothétiques.",
            ),
        },
    },
    # Domain 5: Discourse & Cohesion
    {
        "code": "language_discourse_domain",
        "name": "Discours, cohésion et argumentation",
        "internal_label": "Discourse, Cohesion and Argumentation",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "discourse",
        "category": SkillCategory.READING,
        "parent_code": None,
        "assessable": False,
        "description": "Marqueurs de relation, connecteurs logiques et organisation thématique du texte.",
        "applicable_modalities": ["reading", "writing", "speaking"],
        "applicable_task_types": [],
        "descriptors": {},
    },
    {
        "code": "lang_logical_connectors",
        "name": "Connecteurs logiques et argumentatifs",
        "internal_label": "Logical and Argumentative Connectors",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "discourse",
        "category": SkillCategory.READING,
        "parent_code": "language_discourse_domain",
        "assessable": True,
        "description": "Identifier le rôle des articulateurs logiques : cause (puisque, car), conséquence (donc, ainsi), opposition (néanmoins, or, bien que).",
        "applicable_modalities": ["reading", "listening", "writing", "speaking"],
        "applicable_task_types": ["text_gap", "press_article", "professional_document"],
        "descriptors": {
            CEFRBand.A2: (
                "Comprend les connecteurs chronologiques et d'addition basiques (et, mais, puis, parce que).",
                "Textes narratifs courts et annonces structurées.",
            ),
            CEFRBand.B1: (
                "Reconnaît les connecteurs de cause, conséquence et opposition courante (cependant, par conséquent, alors que).",
                "Items de textes à trous exigeant de restaurer la logique entre deux phrases.",
            ),
            CEFRBand.B2: (
                "Distingue avec précision les nuances concessives et restrictives (or, néanmoins, en revanche, d'ailleurs, par contre).",
                "Articles d'opinion où un connecteur inverse la polarité de l'argumentation.",
            ),
            CEFRBand.C1: (
                "Maîtrise le jeu des connecteurs argumentatifs rares ou implicites (nonobstant, qui plus est, qu'à cela ne tienne).",
                "Démonstrations dialectiques denses à contre-courant.",
            ),
        },
    },
    {
        "code": "lang_cohesion_and_progression",
        "name": "Cohésion textuelle et progression thématique",
        "internal_label": "Textual Cohesion and Thematic Progression",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "discourse",
        "category": SkillCategory.READING,
        "parent_code": "language_discourse_domain",
        "assessable": True,
        "description": "Suivre la continuité textuelle à travers les transitions inter-paragraphes, les reprises anaphoriques et la hiérarchie des idées.",
        "applicable_modalities": ["reading", "writing"],
        "applicable_task_types": ["text_gap", "press_article"],
        "descriptors": {
            CEFRBand.B1: (
                "Suit l'enchaînement des idées dans un paragraphe bien structuré avec répétition ou reprise thématique claire.",
                "Textes informatifs avec intertitres explicites.",
            ),
            CEFRBand.B2: (
                "Restitue l'agencement logique de paragraphes mélangés ou insère une phrase manquante au bon endroit dans le texte.",
                "Épreuves de complétion textuelle globale (text_gap).",
            ),
            CEFRBand.C1: (
                "Perçoit la progression thématique complexe (à thème constant, linéaire ou à thèmes dérivés) d'un essai volumineux.",
                "Articles d'analyse économique et sociologique denses.",
            ),
        },
    },
    # Domain 6: Semantics & Pragmatics
    {
        "code": "language_semantics_domain",
        "name": "Sémantique et modalisateurs",
        "internal_label": "Semantics and Pragmatics",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "semantics",
        "category": SkillCategory.READING,
        "parent_code": None,
        "assessable": False,
        "description": "Modalisation du discours, nuances de certitude et d'engagement de l'énonciateur.",
        "applicable_modalities": ["reading", "listening", "writing", "speaking"],
        "applicable_task_types": [],
        "descriptors": {},
    },
    {
        "code": "lang_semantic_nuance",
        "name": "Nuances sémantiques et modalisateurs",
        "internal_label": "Semantic Nuance and Epistemic Modality",
        "dimension": SkillDimension.LANGUAGE,
        "domain": "semantics",
        "category": SkillCategory.READING,
        "parent_code": "language_semantics_domain",
        "assessable": True,
        "description": "Évaluer le degré d'engagement de l'auteur par l'analyse des modalisateurs épistémiques (certitude, probabilité, conjecture, contestation).",
        "applicable_modalities": ["reading", "listening", "writing", "speaking"],
        "applicable_task_types": ["press_article", "professional_document"],
        "descriptors": {
            CEFRBand.B1: (
                "Identifie les expressions directes de certitude ou d'incertitude (peut-être, sans doute, il est certain que).",
                "Reconnaissance du degré de confiance accordé à une information.",
            ),
            CEFRBand.B2: (
                "Détecte la prise de distance de l'auteur grâce aux verbes modalisateurs (prétendre, sembler, paraître, insinuer).",
                "Distinction entre faits avérés et allégations non vérifiées.",
            ),
            CEFRBand.C1: (
                "Évalue avec finesse l'atténuation (euphémisme), la gradation ou l'emphase rhétorique et leur impact pragmatique.",
                "Articles éditoriaux et tribunes d'experts.",
            ),
            CEFRBand.C2: (
                "Perçoit toutes les subtilités d'expression du doute et de la contestation feinte dans les écrits académiques ou polémiques.",
                "Commentaires critiques et textes théoriques.",
            ),
        },
    },
]

# ---------------------------------------------------------------------------
# 4. Canonical Learning Graph Dependencies & Bridge Relations
# ---------------------------------------------------------------------------

SKILL_RELATIONS: list[tuple[str, str, SkillRelationType]] = [
    # Reasoning Internal Prerequisites
    (
        "reasoning_locate_information",
        "reasoning_identify_specific_detail",
        SkillRelationType.PREREQUISITE,
    ),
    (
        "reasoning_identify_specific_detail",
        "reasoning_compare_and_match",
        SkillRelationType.PREREQUISITE,
    ),
    (
        "reasoning_identify_main_idea",
        "reasoning_identify_author_position",
        SkillRelationType.PREREQUISITE,
    ),
    (
        "reasoning_infer_implicit_meaning",
        "reasoning_identify_tone_and_intent",
        SkillRelationType.PREREQUISITE,
    ),
    # Language Internal Prerequisites
    ("lang_vocab_in_context", "lang_paraphrase_and_synonyms", SkillRelationType.PREREQUISITE),
    (
        "lang_grammatical_agreement",
        "lang_subordination_and_clauses",
        SkillRelationType.PREREQUISITE,
    ),
    (
        "lang_tense_selection_and_aspect",
        "lang_hypothetical_systems",
        SkillRelationType.PREREQUISITE,
    ),
    ("lang_logical_connectors", "lang_cohesion_and_progression", SkillRelationType.PREREQUISITE),
    # Cross-Dimension Supports (Language supports Reasoning)
    ("lang_logical_connectors", "reasoning_identify_cause_effect", SkillRelationType.SUPPORTS),
    (
        "lang_paraphrase_and_synonyms",
        "reasoning_identify_specific_detail",
        SkillRelationType.SUPPORTS,
    ),
    ("lang_semantic_nuance", "reasoning_identify_author_position", SkillRelationType.SUPPORTS),
    ("lang_semantic_nuance", "reasoning_identify_tone_and_intent", SkillRelationType.SUPPORTS),
    ("lang_pronouns_and_anaphora", "lang_cohesion_and_progression", SkillRelationType.SUPPORTS),
    ("lang_cohesion_and_progression", "reasoning_identify_main_idea", SkillRelationType.SUPPORTS),
    # Bridges to historical/legacy competencies (maintaining non-destructive continuity)
    ("reasoning_locate_information", "reading_detail", SkillRelationType.RELATED),
    ("reasoning_identify_main_idea", "reading_gist", SkillRelationType.RELATED),
    ("reasoning_infer_implicit_meaning", "reading_inference", SkillRelationType.RELATED),
    ("lang_verbal_moods", "subjunctive", SkillRelationType.RELATED),
    ("lang_logical_connectors", "connectors", SkillRelationType.RELATED),
    ("lang_pronouns_and_anaphora", "relative_pronouns", SkillRelationType.RELATED),
    ("lang_collocations_and_idioms", "collocations", SkillRelationType.RELATED),
]


# ---------------------------------------------------------------------------
# 5. Specification Validation Engine
# ---------------------------------------------------------------------------


def validate_reading_taxonomy_spec() -> list[str]:
    """Verify taxonomy integrity rules prior to database emission.

    Rules checked:
    1. Codes are unique across all task types and skills.
    2. Parent relationships reference declared codes (no dangling or missing parents).
    3. No duplicate competency concepts are created.
    4. All referenced relationships exist in the specification or known legacy sets.
    5. No self-referential relations (from == to).
    6. CEFR levels are valid members of CEFRBand enum.
    7. Dimensions and domains are properly typed.
    """
    errors: list[str] = []

    # 1. Unique task type codes
    seen_task_codes: set[str] = set()
    for tt in READING_TASK_TYPES:
        code = tt["code"]
        if code in seen_task_codes:
            errors.append(f"Duplicate task type code detected: '{code}'")
        seen_task_codes.add(code)

    # 2. Unique skill codes
    all_skill_specs = REASONING_COMPETENCIES + LANGUAGE_COMPETENCIES
    seen_skill_codes: set[str] = set()
    for sk in all_skill_specs:
        code = sk["code"]
        if code in seen_skill_codes:
            errors.append(f"Duplicate skill code detected: '{code}'")
        if code in seen_task_codes:
            errors.append(f"Skill code '{code}' collides with task type code")
        seen_skill_codes.add(code)

    # 3. Parent code validity
    for sk in all_skill_specs:
        parent_code = sk["parent_code"]
        if parent_code is not None and parent_code not in seen_skill_codes:
            errors.append(
                f"Skill '{sk['code']}' references nonexistent parent_code '{parent_code}'"
            )

    # 4. Task type applicability check
    for sk in all_skill_specs:
        for tt_code in sk.get("applicable_task_types", []):
            if tt_code not in seen_task_codes:
                errors.append(f"Skill '{sk['code']}' references unknown task type '{tt_code}'")

    # 5. CEFR Descriptors validation
    for sk in all_skill_specs:
        descriptors = sk.get("descriptors", {})
        for band, (desc, guidance) in descriptors.items():
            if not isinstance(band, CEFRBand):
                errors.append(
                    f"Skill '{sk['code']}' descriptor key '{band}' is not a valid CEFRBand"
                )
            if not desc or len(desc.strip()) < 10:
                errors.append(
                    f"Skill '{sk['code']}' CEFR {band} descriptor statement is too short or empty"
                )

    # 6. Skill Relations validation
    known_codes = seen_skill_codes.union(
        {
            "reading_detail",
            "reading_gist",
            "reading_inference",
            "reading_comp",
            "reading_comprehension",
            "subjunctive",
            "connectors",
            "relative_pronouns",
            "collocations",
        }
    )

    for from_code, to_code, rel_type in SKILL_RELATIONS:
        if from_code == to_code:
            errors.append(f"Illegal self-relation detected on skill '{from_code}'")
        if from_code not in known_codes:
            errors.append(
                f"Relation source skill '{from_code}' is neither in spec nor known legacy set"
            )
        if to_code not in known_codes:
            errors.append(
                f"Relation target skill '{to_code}' is neither in spec nor known legacy set"
            )
        if not isinstance(rel_type, SkillRelationType):
            errors.append(
                f"Relation between '{from_code}' and '{to_code}' has invalid type '{rel_type}'"
            )

    return errors


# ---------------------------------------------------------------------------
# 6. Safe Idempotent Database Seeder
# ---------------------------------------------------------------------------


async def seed_reading_taxonomy(db: AsyncSession) -> dict[str, int]:
    """Execute safe, idempotent emission of the canonical Reading taxonomy.

    Inserts:
    - 8 standard TEF reading task types
    - Canonical reasoning and transversal language competencies
    - Standard CEFR level descriptors (A1-C2)
    - Directed learning graph relations and legacy bridge edges
    """
    # Step A: Validate spec in-memory first
    validation_errors = validate_reading_taxonomy_spec()
    if validation_errors:
        err_msg = "Reading taxonomy specification validation failed:\n" + "\n".join(
            f"- {e}" for e in validation_errors
        )
        logger.error("taxonomy.reading.validation_failed", error_count=len(validation_errors))
        raise ValueError(err_msg)

    logger.info("taxonomy.reading.validation_passed")

    # Step B: Ensure active taxonomy version
    stmt_v = (
        select(TaxonomyVersion)
        .where(TaxonomyVersion.status == TaxonomyLifecycleStatus.ACTIVE)
        .limit(1)
    )
    active_version = (await db.execute(stmt_v)).scalar_one_or_none()

    now = datetime.datetime.now(datetime.UTC)

    if not active_version:
        # Check by fixed UUID
        stmt_fixed = select(TaxonomyVersion).where(TaxonomyVersion.id == CANONICAL_TAXONOMY_UUID)
        active_version = (await db.execute(stmt_fixed)).scalar_one_or_none()

    if not active_version:
        active_version = TaxonomyVersion(
            id=CANONICAL_TAXONOMY_UUID,
            version=CANONICAL_TAXONOMY_VERSION,
            name="TEF Canada Standard Taxonomy 2026",
            status=TaxonomyLifecycleStatus.ACTIVE,
            description="Authoritative competency catalog decoupling exam task formats from reasoning and language competencies.",
            activated_at=now,
            created_at=now,
            updated_at=now,
        )
        db.add(active_version)
        await db.flush()

    tax_id = active_version.id

    counts = {
        "task_types": 0,
        "skills": 0,
        "descriptors": 0,
        "relations": 0,
    }

    # Step C: Upsert Reading Task Types
    for tt_spec in READING_TASK_TYPES:
        stmt_tt = select(TaskType).where(TaskType.code == tt_spec["code"])
        tt_obj = (await db.execute(stmt_tt)).scalar_one_or_none()
        if not tt_obj:
            tt_obj = TaskType(
                id=uuid.uuid4(),
                code=tt_spec["code"],
                name=tt_spec["name"],
                modality=tt_spec["modality"],
                description=tt_spec["description"],
                is_active=tt_spec["is_active"],
                created_at=now,
                updated_at=now,
            )
            db.add(tt_obj)
            counts["task_types"] += 1
        else:
            # Update attributes to canonical definitions
            tt_obj.name = tt_spec["name"]
            tt_obj.modality = tt_spec["modality"]
            tt_obj.description = tt_spec["description"]
            tt_obj.is_active = tt_spec["is_active"]
            tt_obj.updated_at = now

    await db.flush()

    # Step D: Upsert Skills in Hierarchical Order
    all_skill_specs = REASONING_COMPETENCIES + LANGUAGE_COMPETENCIES
    code_to_skill_map: dict[str, Skill] = {}

    # Load existing skills into map
    existing_skills_res = await db.execute(select(Skill))
    for s in existing_skills_res.scalars().all():
        code_to_skill_map[s.code] = s

    # Phase 1: Parents (parent_code is None)
    for sk_spec in all_skill_specs:
        if sk_spec["parent_code"] is None:
            code = sk_spec["code"]
            skill_obj = code_to_skill_map.get(code)
            if not skill_obj:
                skill_obj = Skill(
                    id=uuid.uuid4(),
                    taxonomy_version_id=tax_id,
                    code=code,
                    name=sk_spec["name"],
                    dimension=sk_spec["dimension"],
                    domain=sk_spec["domain"],
                    category=sk_spec.get("category"),
                    description=sk_spec["description"],
                    parent_id=None,
                    is_active=True,
                    created_at=now,
                    updated_at=now,
                )
                db.add(skill_obj)
                counts["skills"] += 1
            else:
                skill_obj.name = sk_spec["name"]
                skill_obj.dimension = sk_spec["dimension"]
                skill_obj.domain = sk_spec["domain"]
                skill_obj.category = sk_spec.get("category")
                skill_obj.description = sk_spec["description"]
                skill_obj.is_active = True
                skill_obj.updated_at = now
            code_to_skill_map[code] = skill_obj

    await db.flush()

    # Phase 2: Children (parent_code is not None)
    for sk_spec in all_skill_specs:
        if sk_spec["parent_code"] is not None:
            code = sk_spec["code"]
            parent_skill = code_to_skill_map.get(sk_spec["parent_code"])
            parent_id = parent_skill.id if parent_skill else None

            skill_obj = code_to_skill_map.get(code)
            if not skill_obj:
                skill_obj = Skill(
                    id=uuid.uuid4(),
                    taxonomy_version_id=tax_id,
                    code=code,
                    name=sk_spec["name"],
                    dimension=sk_spec["dimension"],
                    domain=sk_spec["domain"],
                    category=sk_spec.get("category"),
                    description=sk_spec["description"],
                    parent_id=parent_id,
                    is_active=True,
                    created_at=now,
                    updated_at=now,
                )
                db.add(skill_obj)
                counts["skills"] += 1
            else:
                skill_obj.name = sk_spec["name"]
                skill_obj.dimension = sk_spec["dimension"]
                skill_obj.domain = sk_spec["domain"]
                skill_obj.category = sk_spec.get("category")
                skill_obj.description = sk_spec["description"]
                skill_obj.parent_id = parent_id
                skill_obj.is_active = True
                skill_obj.updated_at = now
            code_to_skill_map[code] = skill_obj

    await db.flush()

    # Step E: Upsert CEFR Level Descriptors
    for sk_spec in all_skill_specs:
        skill_obj = code_to_skill_map.get(sk_spec["code"])
        if not skill_obj:
            continue
        descriptors = sk_spec.get("descriptors", {})
        for band, (desc, guidance) in descriptors.items():
            stmt_desc = select(SkillLevelDescriptor).where(
                SkillLevelDescriptor.skill_id == skill_obj.id,
                SkillLevelDescriptor.level == band,
            )
            desc_obj = (await db.execute(stmt_desc)).scalar_one_or_none()
            if not desc_obj:
                desc_obj = SkillLevelDescriptor(
                    id=uuid.uuid4(),
                    skill_id=skill_obj.id,
                    level=band,
                    descriptor=desc,
                    evidence_guidance=guidance,
                    created_at=now,
                    updated_at=now,
                )
                db.add(desc_obj)
                counts["descriptors"] += 1
            else:
                desc_obj.descriptor = desc
                desc_obj.evidence_guidance = guidance
                desc_obj.updated_at = now

    await db.flush()

    # Step F: Upsert Skill Relations
    for from_code, to_code, rel_type in SKILL_RELATIONS:
        from_sk = code_to_skill_map.get(from_code)
        to_sk = code_to_skill_map.get(to_code)
        if not from_sk or not to_sk:
            continue

        stmt_rel = select(SkillRelation).where(
            SkillRelation.from_skill_id == from_sk.id,
            SkillRelation.to_skill_id == to_sk.id,
            SkillRelation.relation_type == rel_type,
        )
        rel_obj = (await db.execute(stmt_rel)).scalar_one_or_none()
        if not rel_obj:
            rel_obj = SkillRelation(
                id=uuid.uuid4(),
                from_skill_id=from_sk.id,
                to_skill_id=to_sk.id,
                relation_type=rel_type,
                created_at=now,
            )
            db.add(rel_obj)
            counts["relations"] += 1

    await db.flush()

    # Step G: Upsert Skill Modalities
    counts["modalities"] = 0
    for sk_spec in all_skill_specs:
        skill_obj = code_to_skill_map.get(sk_spec["code"])
        if not skill_obj:
            continue
        applicable_modalities = sk_spec.get("applicable_modalities", [])
        for mod in applicable_modalities:
            m_stmt = select(SkillModality).where(
                SkillModality.skill_id == skill_obj.id,
                SkillModality.modality == mod.lower(),
            )
            mod_obj = (await db.execute(m_stmt)).scalar_one_or_none()
            if not mod_obj:
                mod_obj = SkillModality(
                    id=uuid.uuid4(),
                    skill_id=skill_obj.id,
                    modality=mod.lower(),
                    is_primary=(mod.lower() == str(sk_spec.get("domain", "")).lower()),
                    created_at=now,
                )
                db.add(mod_obj)
                counts["modalities"] += 1

    await db.flush()

    # Step H: Upsert Task Type Supported Skills
    counts["task_type_skills"] = 0
    # Map task types by code
    tt_stmt = select(TaskType)
    tt_map = {tt.code: tt for tt in (await db.execute(tt_stmt)).scalars().all()}

    for sk_spec in all_skill_specs:
        skill_obj = code_to_skill_map.get(sk_spec["code"])
        if not skill_obj:
            continue
        applicable_tt_codes = sk_spec.get("applicable_task_types", [])
        for tt_code in applicable_tt_codes:
            tt_obj = tt_map.get(tt_code)
            if not tt_obj:
                continue
            tts_stmt = select(TaskTypeSkill).where(
                TaskTypeSkill.task_type_id == tt_obj.id,
                TaskTypeSkill.skill_id == skill_obj.id,
            )
            tts_obj = (await db.execute(tts_stmt)).scalar_one_or_none()
            if not tts_obj:
                tts_obj = TaskTypeSkill(
                    id=uuid.uuid4(),
                    task_type_id=tt_obj.id,
                    skill_id=skill_obj.id,
                    created_at=now,
                )
                db.add(tts_obj)
                counts["task_type_skills"] += 1

    await db.flush()

    logger.info(
        "taxonomy.reading.seeded_successfully",
        task_types=counts["task_types"],
        skills=counts["skills"],
        descriptors=counts["descriptors"],
        relations=counts["relations"],
        modalities=counts.get("modalities", 0),
        task_type_skills=counts.get("task_type_skills", 0),
    )
    return counts


async def main() -> None:
    """Standalone CLI entry point for reading taxonomy initialization."""
    print("==================================================")
    print(" TEF Reading Taxonomy V1 — Canonical Seed Runner  ")
    print("==================================================")
    async with async_session_factory() as session:
        result = await seed_reading_taxonomy(session)
        await session.commit()
        print("Emitted Canonical Reading Taxonomy:")
        print(f"  - Task Types Upserted:       {result['task_types']}")
        print(f"  - Competencies Upserted:     {result['skills']}")
        print(f"  - CEFR Descriptors Upserted: {result['descriptors']}")
        print(f"  - Dependency Edges Upserted: {result['relations']}")
        print("==================================================")


if __name__ == "__main__":
    asyncio.run(main())
