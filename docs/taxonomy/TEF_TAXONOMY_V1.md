# TEF Platform — Canonical Production Taxonomy V1 Specification & Report

**Status:** Canonical Production Reference  
**Taxonomy Version:** `v1` (`TEF Canonical Taxonomy V1`)  
**Version ID:** `00000000-0000-4000-a000-000000000001`  
**Lifecycle Status:** `active`  
**Canonical Source File:** [`apps/api/app/modules/admin/seed/taxonomy_v1.yaml`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/admin/seed/taxonomy_v1.yaml)  
**Seeder Implementation:** [`apps/api/app/modules/admin/taxonomy_seeder.py`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/admin/taxonomy_seeder.py)  
**Automated Test Suite:** [`apps/api/tests/test_taxonomy_v1_seed.py`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/tests/test_taxonomy_v1_seed.py)  

---

## 1. Taxonomy Philosophy & Architectural Principles

### 1.1 Non-Equivalence & Psychometric Boundary Notice
> [!IMPORTANT]
> **Diagnostic Platform Framework vs. Official TEF Exam:**  
> This taxonomy is the platform's **internal diagnostic competency model** engineered for item tagging, automated diagnostic feedback, student skill estimation, and adaptive recommendations.  
> It is **not** an official trademark of CCI Paris Île-de-France / Le français des affaires.  
> The official TEF structure defines test administrative parameters (durations, question counts, stimulus modalities, scoring scales).  
> The platform taxonomy defines the **underlying cognitive reasoning operations and linguistic mechanics** evaluated across those tasks.

### 1.2 The Orthogonal Tripartite Architecture

Rather than conflating test formats, cognitive operations, and grammatical rules into a single unbalanced tree, the TEF Platform factors competency assessment into three orthogonal domains:

```text
                     TAXONOMY V1
                          │
         ┌────────────────┴────────────────┐
         │                                 │
     MODALITIES                       COMPETENCIES
         │                                 │
┌────────┼────────┐               ┌────────┴────────┐
│        │        │               │                 │
Reading Listening Writing      Reasoning         Language
 │                │               │                 │
Task Types   Task Types        Families          Families
 │                │               │                 │
 └────────────────┼───────────────┴─────────────────┘
                  │
        Content Tagging & Evidence
```

1. **Exam Modalities (`reading`, `listening`, `writing`, `speaking`):** The authentic application contexts of the TEF exam.
2. **Task Types (`TaskType`):** Standardized format containers (stimulus requirements, response formats, interaction modes). A task type is an assessment format, **never a skill**.
3. **Competency Dimensions:**
   - **Reasoning (`reasoning`):** Mental operations required to locate, interpret, synthesize, evaluate, or argue.
   - **Language (`language`):** Transversal linguistic knowledge and tools (lexicon, grammar, verb system, syntax, discourse) deployed across modalities.
4. **Single Canonical Competency Identity (`Skill`):**
   - Self-referencing hierarchy (`parent_id`).
   - Strict elimination of legacy duplicate tables (`sub_skills` is permanently dropped).
   - Strict separation between **Container Nodes** (`assessable = false`) and **Assessable Leaves** (`assessable = true`).

---

## 2. Canonical Exam Modalities

| Modality Code | French Title | Description | Assessment Focus |
|:---|:---|:---|:---|
| `reading` | Compréhension écrite | 40 questions, 60 minutes | Documents usuels, textes à trous, annonces, graphiques, articles de presse. |
| `listening` | Compréhension orale | 40 questions, 40 minutes | Messages répondeur, annonces publiques, reportages radio, sondages d'opinion, discrimination phonétique. |
| `writing` | Expression écrite | 2 sections, 60 minutes | Section A : suite de fait divers (min. 80 mots). Section B : lettre d'argumentation et d'opinion (min. 200 mots). |
| `speaking` | Expression orale | 2 sections, 15 minutes | Section A : recueil d'informations (10 questions, 5 min). Section B : persuasion et argumentation auprès d'un proche (10 min). |

---

## 3. Official TEF Canada Task Types (16 Tasks)

All 16 task types are grounded in the authentic administering format of the TEF Canada:

| Modality | Task Type Code | French Name | Expected Response Type | Stimulus Requirement | Objective Scoring |
|:---|:---|:---|:---|:---|:---|
| **Reading** | `daily_document` | Documents de la vie quotidienne | `single_choice` | `short_document` | Yes |
| **Reading** | `sentence_gap` | Phrases à compléter | `single_choice` | `none` | Yes |
| **Reading** | `text_gap` | Textes à trous | `single_choice` | `passage` | Yes |
| **Reading** | `document_matching` | Appariement de documents | `matching` | `multi_document` | Yes |
| **Reading** | `graph_matching` | Appariement graphiques et énoncés | `matching` | `infographic_or_table` | Yes |
| **Reading** | `administrative_document` | Documents administratifs et réglementaires | `single_choice` | `passage` | Yes |
| **Reading** | `professional_document` | Communications professionnelles | `single_choice` | `passage` | Yes |
| **Reading** | `press_article` | Articles de presse et analyses | `single_choice` | `passage` | Yes |
| **Listening** | `short_announcement` | Annonces et messages courts | `single_choice` | `audio_clip` | Yes |
| **Listening** | `radio_broadcast` | Émissions et chroniques radiophoniques | `single_choice` | `audio_clip` | Yes |
| **Listening** | `public_survey` | Micro-trottoirs et sondages d'opinion | `matching` | `audio_clip` | Yes |
| **Listening** | `phonological_recognition` | Discrimination phonétique et intonation | `single_choice` | `audio_clip` | Yes |
| **Writing** | `fait_divers` | Rédaction d'un fait divers (Section A) | `long_text` | `prompt_excerpt` | No (Rubric/AI) |
| **Writing** | `opinion_letter` | Lettre d'argumentation et d'opinion (Section B) | `long_text` | `prompt_statement` | No (Rubric/AI) |
| **Speaking** | `information_gathering` | Recueil d'informations (Section A) | `spoken_response` | `advertisement_prompt` | No (Rubric/AI) |
| **Speaking** | `persuasive_argumentation` | Argumentation persuasive (Section B) | `spoken_response` | `prompt_topic` | No (Rubric/AI) |

---

## 4. Reasoning Competency Hierarchy (26 Nodes)

```
reasoning (Root Container)
├── information_retrieval (Container)
│   ├── locate_information (Assessable)
│   └── identify_specific_detail (Assessable)
├── comprehension (Container)
│   ├── identify_main_idea (Assessable)
│   ├── understand_context (Assessable)
│   ├── understand_sequence (Assessable)
│   └── understand_cause_consequence (Assessable)
├── integration (Container)
│   ├── compare_information (Assessable)
│   └── synthesize_information (Assessable)
├── inference (Container)
│   ├── infer_implicit_information (Assessable)
│   └── infer_pragmatic_meaning (Assessable)
├── discourse_interpretation (Container)
│   ├── identify_stance_and_perspective (Assessable)
│   ├── identify_tone (Assessable)
│   └── identify_communicative_intention (Assessable)
├── argumentation (Container)
│   ├── identify_claim (Assessable)
│   ├── identify_supporting_reason (Assessable)
│   └── handle_counterargument (Assessable)
└── data_interpretation (Container)
    ├── interpret_data_trends (Assessable)
    └── correlate_data_and_text (Assessable)
```

### Reasoning Competency Details

| Code | French Title | Type | Parent | Measurable Cognitive Operation |
|:---|:---|:---|:---|:---|
| `reasoning` | Compétences cognitives et raisonnement | Container | *Root* | Cadre global des opérations cognitives mobilisées. |
| `information_retrieval` | Recherche et repérage d'informations | Container | `reasoning` | Balayage et extraction de données factuelles explicites. |
| `locate_information` | Repérage d'informations factuelles | **Assessable** | `information_retrieval` | Localiser rapidement noms, chiffres, dates, horaires, lieux. |
| `identify_specific_detail` | Identification de détails précis | **Assessable** | `information_retrieval` | Identifier une précision, réserve, clause ou condition spécifique. |
| `comprehension` | Compréhension globale et contextuelle | Container | `reasoning` | Saisie de l'idée générale, du contexte et de la causalité. |
| `identify_main_idea` | Identification de l'idée principale | **Assessable** | `comprehension` | Dégager le thème central ou la thèse directrice d'un document. |
| `understand_context` | Compréhension de la situation de communication | **Assessable** | `comprehension` | Identifier les interlocuteurs, leur statut et le cadre d'échange. |
| `understand_sequence` | Compréhension de la chronologie et des étapes | **Assessable** | `comprehension` | Reconstituer l'ordre chronologique des faits ou étapes d'une procédure. |
| `understand_cause_consequence` | Compréhension des liens de cause et conséquence | **Assessable** | `comprehension` | Établir les relations explicatives et conséquences directes. |
| `integration` | Intégration et synthèse d'informations | Container | `reasoning` | Fusion et rapprochement d'éléments dispersés. |
| `compare_information` | Comparaison et mise en relation d'informations | **Assessable** | `integration` | Confronter options, profils ou points de vue contrastés. |
| `synthesize_information` | Synthèse d'informations multiples | **Assessable** | `integration` | Dégager un constat unifié à partir de sources multiples. |
| `inference` | Inférence et interprétation de l'implicite | Container | `reasoning` | Déduction d'éléments non formulés directement. |
| `infer_implicit_information` | Déduction d'informations implicites | **Assessable** | `inference` | Déduire des faits ou motivations suggérés par les indices. |
| `infer_pragmatic_meaning` | Interprétation pragmatique et sous-entendus | **Assessable** | `inference` | Interpréter l'ironie, l'humour, le second degré ou le sous-entendu poli. |
| `discourse_interpretation` | Interprétation discursive et intentions | Container | `reasoning` | Posture énonciative et intentions de l'auteur/locuteur. |
| `identify_stance_and_perspective` | Identification du point de vue et de la prise de position | **Assessable** | `discourse_interpretation` | Identifier l'avis favorable, défavorable ou neutre de l'intervenant. |
| `identify_tone` | Identification de la tonalité | **Assessable** | `discourse_interpretation` | Reconnaître le registre affectif ou stylistique (critique, alarmiste, etc.). |
| `identify_communicative_intention` | Identification de l'intention communicative | **Assessable** | `discourse_interpretation` | Déterminer le but premier : convaincre, avertir, conseiller, réclamer. |
| `argumentation` | Analyse et élaboration de l'argumentation | Container | `reasoning` | Agencement des thèses, arguments et réfutations. |
| `identify_claim` | Identification de la thèse et des arguments majeurs | **Assessable** | `argumentation` | Isoler la thèse centrale défendue dans un texte d'opinion. |
| `identify_supporting_reason` | Identification des éléments de justification | **Assessable** | `argumentation` | Repérer les preuves, chiffres ou exemples appuyant un argument. |
| `handle_counterargument` | Traitement et évaluation des contre-arguments | **Assessable** | `argumentation` | Répondre aux objections adverses et structurer la réfutation. |
| `data_interpretation` | Interprétation de données chiffrées et graphiques | Container | `reasoning` | Décodage de données visuelles et statistiques. |
| `interpret_data_trends` | Interprétation des tendances et variations | **Assessable** | `data_interpretation` | Analyser hausses, baisses et évolutions sur des infographies. |
| `correlate_data_and_text` | Mise en relation texte-données | **Assessable** | `data_interpretation` | Valider des assertions textuelles au regard de visualisations chiffrées. |

---

## 5. Language Competency Hierarchy (33 Nodes)

```
language (Root Container)
├── vocabulary (Container)
│   ├── vocabulary_in_context (Assessable)
│   ├── paraphrase_and_synonym_recognition (Assessable)
│   ├── collocations (Assessable)
│   ├── word_formation (Assessable)
│   ├── lexical_precision (Assessable)
│   └── register_and_formality (Assessable)
├── grammar (Container)
│   ├── grammatical_agreement (Assessable)
│   ├── articles_and_determiners (Assessable)
│   ├── pronoun_usage (Assessable)
│   ├── preposition_usage (Assessable)
│   └── negation_structures (Assessable)
├── verb_system (Container)
│   ├── verb_conjugation (Assessable)
│   ├── tense_selection (Assessable)
│   └── mood_selection (Assessable)
├── syntax (Container)
│   ├── sentence_structure (Assessable)
│   ├── relative_clauses (Assessable)
│   ├── subordination_and_coordination (Assessable)
│   └── conditional_structures (Assessable)
├── discourse (Container)
│   ├── discourse_connectors (Assessable)
│   ├── reference_resolution (Assessable)
│   └── textual_cohesion_and_coherence (Assessable)
├── writing_mechanics (Container)
│   ├── orthography (Assessable)
│   └── punctuation (Assessable)
└── oral_mechanics (Container)
    ├── phonological_control (Assessable)
    └── oral_fluency (Assessable)
```

### Language Competency Details

| Code | French Title | Domain | Type | Linguistic Focus |
|:---|:---|:---|:---|:---|
| `language` | Compétences linguistiques et maîtrise de la langue | `language` | Container | Racine transversale des outils linguistiques. |
| `vocabulary` | Lexique et vocabulaire | `vocabulary` | Container | Vocabulaire, sémantique et registres lexicaux. |
| `vocabulary_in_context` | Sens des mots en contexte | `vocabulary` | **Assessable** | Déduire la signification exacte d'un terme en contexte. |
| `paraphrase_and_synonym_recognition` | Reconnaissance des synonymes et reformulations | `vocabulary` | **Assessable** | Identifier les équivalences lexicales entre stimulus et choix. |
| `collocations` | Collocations et expressions figées | `vocabulary` | **Assessable** | Maîtriser les associations lexicales privilégiées et locutions. |
| `word_formation` | Formation des mots et morphologie lexicale | `vocabulary` | **Assessable** | Dérivation préfixale et suffixale, familles de mots. |
| `lexical_precision` | Précision et richesse lexicale | `vocabulary` | **Assessable** | Employer le terme exact sans répétition ni mot passe-partout. |
| `register_and_formality` | Registres de langue et niveaux de formalité | `vocabulary` | **Assessable** | Adapter le registre (familier, courant, soutenu) au contexte. |
| `grammar` | Morphosyntaxe et grammaire | `grammar` | Container | Accords, déterminants, pronoms et rections. |
| `grammatical_agreement` | Accords grammaticaux | `grammar` | **Assessable** | Accords groupe nominal, sujet-verbe et participe passé. |
| `articles_and_determiners` | Articles et déterminants | `grammar` | **Assessable** | Articles définis, indéfinis, partitifs et déterminants. |
| `pronoun_usage` | Système pronominal | `grammar` | **Assessable** | Emploi et place des pronoms compléments (COD, COI, y, en). |
| `preposition_usage` | Régimes prépositionnels | `grammar` | **Assessable** | Rection prépositionnelle des verbes, noms et expressions de lieu/temps. |
| `negation_structures` | Structures de négation et restriction | `grammar` | **Assessable** | Formes négatives complexes (*ne... que*, *ne... guère*, etc.). |
| `verb_system` | Système verbal | `verb_system` | Container | Morphologie, sélection des temps et modes. |
| `verb_conjugation` | Conjugaison et morphologie verbale | `verb_system` | **Assessable** | Formes régulières et irrégulières aux divers temps/modes. |
| `tense_selection` | Sélection et alternance des temps | `verb_system` | **Assessable** | Alternance passé composé vs imparfait, futur et conditionnel. |
| `mood_selection` | Sélection des modes | `verb_system` | **Assessable** | Subjonctif vs indicatif vs conditionnel selon la structure. |
| `syntax` | Syntaxe et structure phrastique | `syntax` | Container | Ordre des mots, subordination et enchâssement. |
| `sentence_structure` | Ordre des mots et structure de phrase | `syntax` | **Assessable** | Ordre canonique, inversion interrogative, mises en relief. |
| `relative_clauses` | Propositions relatives | `syntax` | **Assessable** | Enchâssement avec pronoms simples (*dont*, *où*) et composés. |
| `subordination_and_coordination` | Subordination et coordination complexe | `syntax` | **Assessable** | Conjonctions de subordination (cause, but, concession). |
| `conditional_structures` | Structures hypothétiques et conditionnelles | `syntax` | **Assessable** | Systèmes de l'hypothèse avec « si » et locutions conditionnelles. |
| `discourse` | Organisation discursive et cohérence | `discourse` | Container | Continuité textuelle et articulation des idées. |
| `discourse_connectors` | Connecteurs logiques et articulateurs | `discourse` | **Assessable** | Articulateurs logiques de cause, conséquence, opposition, concession. |
| `reference_resolution` | Résolution des références et anaphores | `discourse` | **Assessable** | Identifier le référent d'un pronom ou d'une reprise anaphorique. |
| `textual_cohesion_and_coherence` | Cohésion et cohérence globale du texte | `discourse` | **Assessable** | Progression logique, fluidité et structuration en paragraphes. |
| `writing_mechanics` | Mécanismes de l'expression écrite | `writing_mechanics` | Container | Normes graphiques et orthographiques propres à l'écrit. |
| `orthography` | Orthographe d'usage et accentuation | `writing_mechanics` | **Assessable** | Orthographe lexicale et placement rigoureux des accents. |
| `punctuation` | Ponctuation et segmentation | `writing_mechanics` | **Assessable** | Découpage des propositions et clarification du sens. |
| `oral_mechanics` | Mécanismes de l'expression orale | `oral_mechanics` | Container | Phonétique, prosodie et aisance orale. |
| `phonological_control` | Maîtrise phonologique et prononciation | `oral_mechanics` | **Assessable** | Articulation des phonèmes, voyelles nasales, liaisons et intonation. |
| `oral_fluency` | Aisance et fluidité orale | `oral_mechanics` | **Assessable** | Débit naturel et régulier sans hésitations pénalisantes. |

---

## 6. Modality Applicability Matrix (`SkillModality`)

All 43 assessable competencies are mapped explicitly to the exam modalities where they can be evaluated:

| Competency Code | Reading | Listening | Writing | Speaking | Total Modalities |
|:---|:---:|:---:|:---:|:---:|:---:|
| `locate_information` | ✅ | ✅ | — | — | 2 |
| `identify_specific_detail` | ✅ | ✅ | — | — | 2 |
| `identify_main_idea` | ✅ | ✅ | — | — | 2 |
| `understand_context` | ✅ | ✅ | — | ✅ | 3 |
| `understand_sequence` | ✅ | ✅ | ✅ | — | 3 |
| `understand_cause_consequence` | ✅ | ✅ | ✅ | ✅ | 4 |
| `compare_information` | ✅ | ✅ | ✅ | ✅ | 4 |
| `synthesize_information` | ✅ | ✅ | ✅ | ✅ | 4 |
| `infer_implicit_information` | ✅ | ✅ | — | — | 2 |
| `infer_pragmatic_meaning` | ✅ | ✅ | — | ✅ | 3 |
| `identify_stance_and_perspective` | ✅ | ✅ | ✅ | ✅ | 4 |
| `identify_tone` | ✅ | ✅ | — | — | 2 |
| `identify_communicative_intention` | ✅ | ✅ | ✅ | ✅ | 4 |
| `identify_claim` | ✅ | ✅ | ✅ | ✅ | 4 |
| `identify_supporting_reason` | ✅ | ✅ | ✅ | ✅ | 4 |
| `handle_counterargument` | ✅ | ✅ | ✅ | ✅ | 4 |
| `interpret_data_trends` | ✅ | — | ✅ | — | 2 |
| `correlate_data_and_text` | ✅ | — | — | — | 1 |
| `vocabulary_in_context` | ✅ | ✅ | — | — | 2 |
| `paraphrase_and_synonym_recognition` | ✅ | ✅ | — | — | 2 |
| `collocations` | ✅ | ✅ | ✅ | ✅ | 4 |
| `word_formation` | ✅ | — | ✅ | — | 2 |
| `lexical_precision` | — | — | ✅ | ✅ | 2 |
| `register_and_formality` | ✅ | ✅ | ✅ | ✅ | 4 |
| `grammatical_agreement` | ✅ | — | ✅ | — | 2 |
| `articles_and_determiners` | ✅ | — | ✅ | ✅ | 3 |
| `pronoun_usage` | ✅ | ✅ | ✅ | ✅ | 4 |
| `preposition_usage` | ✅ | — | ✅ | ✅ | 3 |
| `negation_structures` | ✅ | ✅ | ✅ | ✅ | 4 |
| `verb_conjugation` | ✅ | — | ✅ | ✅ | 3 |
| `tense_selection` | ✅ | — | ✅ | ✅ | 3 |
| `mood_selection` | ✅ | — | ✅ | ✅ | 3 |
| `sentence_structure` | ✅ | — | ✅ | ✅ | 3 |
| `relative_clauses` | ✅ | ✅ | ✅ | ✅ | 4 |
| `subordination_and_coordination` | ✅ | — | ✅ | ✅ | 3 |
| `conditional_structures` | ✅ | ✅ | ✅ | ✅ | 4 |
| `discourse_connectors` | ✅ | ✅ | ✅ | ✅ | 4 |
| `reference_resolution` | ✅ | ✅ | — | — | 2 |
| `textual_cohesion_and_coherence` | — | — | ✅ | ✅ | 2 |
| `orthography` | — | — | ✅ | — | 1 |
| `punctuation` | — | — | ✅ | — | 1 |
| `phonological_control` | — | — | — | ✅ | 1 |
| `oral_fluency` | — | — | — | ✅ | 1 |
| **Total Mappings** | **31** | **23** | **23** | **22** | **174** |

---

## 7. Task Type to Competency Mappings (`TaskTypeSkill`)

Summary of primary competencies assessable within each task type:

- **`daily_document`:** `locate_information`, `identify_specific_detail`, `understand_context`, `vocabulary_in_context`, `register_and_formality`, `preposition_usage`.
- **`sentence_gap`:** `understand_cause_consequence`, `vocabulary_in_context`, `collocations`, `grammatical_agreement`, `articles_and_determiners`, `pronoun_usage`, `preposition_usage`, `negation_structures`, `verb_conjugation`, `tense_selection`, `mood_selection`, `relative_clauses`.
- **`text_gap`:** `understand_sequence`, `understand_cause_consequence`, `vocabulary_in_context`, `word_formation`, `discourse_connectors`, `reference_resolution`, `subordination_and_coordination`.
- **`document_matching`:** `locate_information`, `identify_specific_detail`, `compare_information`, `vocabulary_in_context`, `paraphrase_and_synonym_recognition`.
- **`graph_matching`:** `locate_information`, `interpret_data_trends`, `correlate_data_and_text`, `compare_information`, `vocabulary_in_context`.
- **`administrative_document`:** `locate_information`, `identify_specific_detail`, `understand_context`, `vocabulary_in_context`, `register_and_formality`, `conditional_structures`, `negation_structures`.
- **`professional_document`:** `identify_main_idea`, `identify_specific_detail`, `understand_context`, `identify_communicative_intention`, `vocabulary_in_context`, `register_and_formality`, `discourse_connectors`.
- **`press_article`:** `identify_main_idea`, `identify_stance_and_perspective`, `identify_tone`, `identify_communicative_intention`, `infer_implicit_information`, `infer_pragmatic_meaning`, `identify_claim`, `identify_supporting_reason`, `handle_counterargument`, `vocabulary_in_context`, `paraphrase_and_synonym_recognition`, `relative_clauses`, `discourse_connectors`, `reference_resolution`.
- **`short_announcement`:** `locate_information`, `identify_specific_detail`, `understand_context`, `identify_communicative_intention`, `vocabulary_in_context`, `register_and_formality`.
- **`radio_broadcast`:** `identify_main_idea`, `understand_sequence`, `understand_cause_consequence`, `synthesize_information`, `infer_implicit_information`, `identify_stance_and_perspective`, `vocabulary_in_context`, `paraphrase_and_synonym_recognition`, `discourse_connectors`.
- **`public_survey`:** `compare_information`, `identify_stance_and_perspective`, `identify_tone`, `infer_pragmatic_meaning`, `vocabulary_in_context`, `register_and_formality`.
- **`phonological_recognition`:** `vocabulary_in_context`, `pronoun_usage`, `negation_structures`, `sentence_structure`.
- **`fait_divers`:** `understand_sequence`, `understand_cause_consequence`, `verb_conjugation`, `tense_selection`, `grammatical_agreement`, `lexical_precision`, `orthography`, `punctuation`, `textual_cohesion_and_coherence`.
- **`opinion_letter`:** `identify_claim`, `identify_supporting_reason`, `handle_counterargument`, `synthesize_information`, `discourse_connectors`, `mood_selection`, `conditional_structures`, `subordination_and_coordination`, `lexical_precision`, `register_and_formality`, `textual_cohesion_and_coherence`, `orthography`, `punctuation`.
- **`information_gathering`:** `understand_context`, `locate_information`, `sentence_structure`, `register_and_formality`, `phonological_control`, `oral_fluency`, `articles_and_determiners`, `preposition_usage`.
- **`persuasive_argumentation`:** `identify_claim`, `identify_supporting_reason`, `handle_counterargument`, `infer_pragmatic_meaning`, `discourse_connectors`, `conditional_structures`, `lexical_precision`, `register_and_formality`, `phonological_control`, `oral_fluency`, `textual_cohesion_and_coherence`.

---

## 8. Pedagogical Prerequisites & Relationships (`SkillRelation`)

All graph edges are directed, strictly acyclic, and pedagogically verified:

| From Skill | Relation Type | To Skill | Pedagogical Rationale |
|:---|:---:|:---|:---|
| `infer_implicit_information` | `depends_on` | `reference_resolution` | Deducing unstated facts requires tracking who/what pronouns refer to across sentences. |
| `infer_pragmatic_meaning` | `depends_on` | `infer_implicit_information` | Understanding irony or nuance builds upon the ability to infer implicit information. |
| `synthesize_information` | `depends_on` | `compare_information` | Synthesizing disparate elements requires comparing and reconciling differences first. |
| `handle_counterargument` | `depends_on` | `identify_claim` | A counter-argument cannot be addressed without first understanding the core thesis. |
| `handle_counterargument` | `depends_on` | `identify_supporting_reason` | Refuting an objection requires analyzing the supporting evidence. |
| `correlate_data_and_text` | `depends_on` | `interpret_data_trends` | Correlating textual claims requires reading and interpreting data trends. |
| `relative_clauses` | `prerequisite` | `sentence_structure` | Embedding relative clauses strictly requires mastering canonical sentence structure. |
| `subordination_and_coordination` | `depends_on` | `sentence_structure` | Subordinate clauses attach to independent main clauses. |
| `conditional_structures` | `depends_on` | `mood_selection` | Formulating hypothetical *si* clauses requires selecting subjunctive/conditional moods. |
| `tense_selection` | `depends_on` | `verb_conjugation` | Choosing the correct tense requires knowing the conjugated verbal forms. |
| `mood_selection` | `depends_on` | `verb_conjugation` | Subjunctive and conditional usage relies on irregular mood conjugation mastery. |
| `textual_cohesion_and_coherence` | `depends_on` | `discourse_connectors` | Cohesive textual flow requires accurate use of logical connectors. |
| `textual_cohesion_and_coherence` | `depends_on` | `reference_resolution` | Coherence depends on clear anaphoric links without ambiguous referents. |
| `identify_stance_and_perspective` | `related` | `identify_claim` | Stance and thesis claims closely interact in argumentative discourse. |
| `identify_tone` | `related` | `infer_pragmatic_meaning` | Detecting irony and tone shares subtextual inferencing mechanisms. |
| `identify_specific_detail` | `related` | `locate_information` | Detailed analysis refines broad factual scanning. |
| `paraphrase_and_synonym_recognition` | `related` | `vocabulary_in_context` | Recognizing reformulations relies directly on lexical understanding in context. |
| `collocations` | `related` | `vocabulary_in_context` | Idiomatic pairings are validated against context. |
| `lexical_precision` | `related` | `vocabulary_in_context` | Precise word choice builds upon contextual lexical recognition. |
| `oral_fluency` | `related` | `phonological_control` | Delivery rhythm interacts with phonemic articulation. |

---

## 9. Structured CEFR Benchmark Descriptors (`SkillLevelDescriptor`)

Representative sample of calibrated diagnostic benchmarks:

| Skill Code | Level | Diagnostic Can-Do Benchmark | Observable Student Evidence |
|:---|:---:|:---|:---|
| `locate_information` | **A1** | Peut repérer des mots familiers, des noms et des chiffres très simples. | Sélection directe d'une coordonnée ou d'une date sans reformulation. |
| `locate_information` | **A2** | Peut localiser une information factuelle prévisible dans des documents quotidiens. | Recherche ciblée dans un document avec 2 à 3 distracteurs proches. |
| `locate_information` | **B1** | Peut parcourir rapidement un texte pour localiser des consignes spécifiques. | Balayage d'un avis officiel d'une page avec variation lexicale. |
| `identify_main_idea` | **A2** | Peut identifier le sujet principal d'un message court ou d'une annonce simple. | Choix du thème général parmi 4 options contrastées. |
| `identify_main_idea` | **B1** | Peut dégager l'idée directrice d'un article informatif ou professionnel. | Distinction de l'idée directrice par rapport aux exemples illustratifs. |
| `identify_main_idea` | **B2** | Peut saisir la problématique centrale d'un article d'analyse complexe. | Identification de la thèse de fond dans un texte avec digressions. |
| `identify_main_idea` | **C1** | Peut identifier l'angle d'analyse et les enjeux implicites d'un essai. | Reconnaissance d'une thèse complexe formulée de manière allusive. |
| `infer_implicit_information` | **B1** | Peut déduire des conclusions simples et des motifs évidents à partir d'indices. | Déduction d'une cause probable non formulée directement. |
| `infer_implicit_information` | **B2** | Peut inférer des présupposés et motivations inavouées dans des textes élaborés. | Sélection d'une conclusion implicite croisant plusieurs indices. |
| `infer_implicit_information` | **C1** | Peut restituer avec finesse les non-dits et arrière-pensées d'un discours. | Interprétation d'un sous-entendu critique dans un texte polémique. |
| `discourse_connectors` | **A2** | Utilise et comprend des connecteurs logiques très simples (*et, mais, parce que*). | Sélection du bon connecteur de base dans une phrase courte coordonnée. |
| `discourse_connectors` | **B1** | Comprend et utilise des connecteurs d'opposition et cause courants (*cependant, car*). | Complétion de lacunes dans un texte avec choix entre connecteurs opposés. |
| `discourse_connectors` | **B2** | Maîtrise un éventail varié d'articulateurs logiques complexes (*néanmoins, bien que*). | Insertion adéquate d'un articulateur de concession dans un paragraphe. |
| `discourse_connectors` | **C1** | Mobilise avec souplesse et variété les connecteurs pour ordonner une pensée complexe. | Emploi sans faille de transitions rhétoriques soutenues. |
| `tense_selection` | **A2** | Distingue et utilise présent, passé composé et futur proche. | Sélection du passé composé pour une action achevée dans le passé. |
| `tense_selection` | **B1** | Maîtrise l'alternance fondamentale passé composé / imparfait dans un récit. | Choix correct entre imparfait (durée/cadre) et passé composé (rupture). |
| `tense_selection` | **B2** | Gère la concordance des temps complexe (plus-que-parfait, conditionnel). | Respect rigoureux de l'antériorité dans le passé au sein d'une narration. |
| `mood_selection` | **B1** | Utilise le subjonctif présent après les structures d'obligation impersonnelle. | Sélection de la forme subjonctive après *il faut que*. |
| `mood_selection` | **B2** | Maîtrise l'opposition indicatif / subjonctif après verbes d'opinion et conjonctions. | Choix du mode après *bien que*, *pour que*, *je ne pense pas que*. |
| `mood_selection` | **C1** | Maîtrise les nuances subtiles entre indicatif, subjonctif et conditionnel. | Conditionnel journalistique et subjonctif dans les relatives hypothétiques. |

---

## 10. Canonical Code Registry (Stable Machine Slugs)

All codes strictly comply with:
- Lowercase snake_case.
- Zero CEFR levels in code.
- Zero version numbers in code.
- Purely semantic and stable.

```text
# Modalities (4)
reading, listening, writing, speaking

# Task Types (16)
daily_document, sentence_gap, text_gap, document_matching, graph_matching,
administrative_document, professional_document, press_article,
short_announcement, radio_broadcast, public_survey, phonological_recognition,
fait_divers, opinion_letter, information_gathering, persuasive_argumentation

# Reasoning Containers (8)
reasoning, information_retrieval, comprehension, integration, inference,
discourse_interpretation, argumentation, data_interpretation

# Reasoning Assessable Leaves (18)
locate_information, identify_specific_detail, identify_main_idea, understand_context,
understand_sequence, understand_cause_consequence, compare_information,
synthesize_information, infer_implicit_information, infer_pragmatic_meaning,
identify_stance_and_perspective, identify_tone, identify_communicative_intention,
identify_claim, identify_supporting_reason, handle_counterargument,
interpret_data_trends, correlate_data_and_text

# Language Containers (8)
language, vocabulary, grammar, verb_system, syntax, discourse,
writing_mechanics, oral_mechanics

# Language Assessable Leaves (25)
vocabulary_in_context, paraphrase_and_synonym_recognition, collocations,
word_formation, lexical_precision, register_and_formality, grammatical_agreement,
articles_and_determiners, pronoun_usage, preposition_usage, negation_structures,
verb_conjugation, tense_selection, mood_selection, sentence_structure,
relative_clauses, subordination_and_coordination, conditional_structures,
discourse_connectors, reference_resolution, textual_cohesion_and_coherence,
orthography, punctuation, phonological_control, oral_fluency
```
