# TEF Platform — AI Question Bank Generation Prompts & Taxonomy Reference

Ce guide fournit la bibliothèque officielle de prompts pour générer des banques de questions TEF (Test d'Évaluation de Français - CCI Paris / TEF Canada / TEF IRN) à l'aide de **Google Gemini** (Gemini Web ou Google AI Studio).

Les questions générées respectent rigoureusement la structure d'import par lot de la plateforme (`/admin/questions`), la taxonomie diagnostique canonique (`taxonomy_v1.yaml`), la diversité des types de questions (`single_choice`, `multiple_choice`, `gap_fill`, `matching`, `ordering`, `short_text`), et le découplage document-question via les champs `stimulus_title` et `stimulus_text`.

---

## Sommaire
1. [Spécification du Schéma JSON d'Import & Formats de Questions](#1-spécification-du-schéma-json-dimport--formats-de-questions)
2. [Référentiel Canonique de Taxonomie (V1)](#2-référentiel-canonique-de-taxonomie-v1)
3. [Prompt 1 : Compréhension Écrite (Reading - Multi-Types)](#prompt-1--compréhension-écrite-reading---multi-types)
4. [Prompt 2 : Compréhension Orale (Listening - Multi-Types)](#prompt-2--compréhension-orale-listening---multi-types)
5. [Prompt 3 : Lexique et Structure (Morphologie, Accords, Syntaxe)](#prompt-3--lexique-et-structure-morphologie-accords-syntaxe)
6. [Prompt 4 : Expression Écrite (Writing - Section A & B)](#prompt-4--expression-écrite-writing---section-a--b)
7. [Prompt 5 : Expression Orale (Speaking - Section A & B)](#prompt-5--expression-orale-speaking---section-a--b)
8. [Prompt 6 : Extracteur Universel de Documents Bruts en JSON TEF](#prompt-6--extracteur-universel-de-documents-bruts-en-json-tef)
9. [Guide d'Utilisation dans Gemini / AI Studio](#9-guide-dutilisation-dans-gemini--ai-studio)

---

## 1. Spécification du Schéma JSON d'Import & Formats de Questions

Chaque question dans le tableau `"items"` (ou `"questions"`) doit comporter les champs fondamentaux suivants :

| Champ | Type | Obligatoire | Description / Valeurs permises |
| :--- | :--- | :--- | :--- |
| `stimulus_title` | `string` | Recommandé | Titre du document ou de l'enregistrement sonore (ex: *"Article Le Monde - Rénovation urbaine"*, *"Annonce SNCF - Voie 3"*). |
| `stimulus_text` | `string` | Recommandé | Texte complet du document support (Markdown) ou transcription intégrale de l'audio avec locuteurs balisés. |
| `prompt` | `string` | **Oui** | Énoncé précis de la question posée au candidat (ex: *"Quel est l'objectif principal de cette mesure ?"*). |
| `task_type_code` | `string` | Recommandé | Code canonique du type de tâche (ex: `press_article`, `daily_document`, `sentence_gap`, `text_gap`, `document_matching`, `text_ordering`, `radio_broadcast`, `public_survey`). |
| `modality` | `string` | **Oui** | `reading` \| `listening` \| `lexique_structure` \| `writing` \| `speaking` |
| `level` | `string` | **Oui** | Niveau CECRL cible : `A1`, `A2`, `B1`, `B2`, `C1`, `C2` |
| `target_cefr` | `string` | Non | Alias identique au niveau (`A1`..`C2`). |
| `difficulty` | `integer` | **Oui** | Échelle 1 à 5 (1 = très accessible, 5 = très discriminatif / complexe). |
| `cognitive_complexity` | `string` | Non | `recall_recognition` \| `interpretation` \| `inferencing_synthesis` \| `critical_evaluation` |
| `question_type` | `string` | **Oui** | `single_choice` \| `multiple_choice` \| `text_input` |
| `response_type` | `string` | **Oui** | `single_choice` \| `multiple_choice` \| `gap_fill` \| `matching` \| `ordering` \| `short_text` \| `long_text` \| `spoken_response` |
| `points` | `integer` | **Oui** | Nombre de points attribués (généralement `1`). |
| `penalty_points` | `integer` | Non | Points négatifs en cas d'erreur (`0`). |
| `explanation` | `string` | **Oui** | Explication pédagogique en français justifiant la bonne réponse et réfutant les distracteurs. |
| `options` | `array` | **Oui (QCM)** | Liste d'objets : `{"content": str, "is_correct": bool, "explanation": str, "order_index": int}`. |
| `skill_codes` | `array[str]`| **Oui** | 1 à 3 codes de compétences canoniques évaluables (voir table ci-dessous). |

---

### Structure des Options par Type de Question (`response_type`)

#### 1. `single_choice` (QCM à Choix Unique)
- `question_type`: `"single_choice"`, `response_type`: `"single_choice"`
- Exactement 4 options, dont **exactement 1** avec `is_correct: true` et 3 avec `is_correct: false`.
```json
"options": [
  { "content": "Option A erronée", "is_correct": false, "order_index": 0 },
  { "content": "Option B exacte", "is_correct": true, "order_index": 1 },
  { "content": "Option C erronée", "is_correct": false, "order_index": 2 },
  { "content": "Option D erronée", "is_correct": false, "order_index": 3 }
]
```

#### 2. `multiple_choice` (QCM à Choix Multiples)
- `question_type`: `"multiple_choice"`, `response_type`: `"multiple_choice"`
- 4 ou 5 options, avec **au moins 2 options correctes** (`is_correct: true`).
```json
"options": [
  { "content": "Avoir moins de 26 ans", "is_correct": true, "order_index": 0 },
  { "content": "Habiter hors de l'Union Européenne", "is_correct": false, "order_index": 1 },
  { "content": "Présenter un justificatif étudiant valide", "is_correct": true, "order_index": 2 },
  { "content": "Effectuer sa réservation 30 jours à l'avance", "is_correct": false, "order_index": 3 }
]
```

#### 3. `gap_fill` (Texte à trous / Cloze)
Il existe deux variantes officielles dans le TEF :

**A. Phrase isolée à trou unique (`sentence_gap`) :**
- `question_type`: `"text_input"`, `response_type`: `"gap_fill"`, `task_type_code`: `"sentence_gap"`
- Le prompt contient un trou matérialisé par `___`.
- 4 options simples, avec **1 seule** `is_correct: true`.
```json
"prompt": "Complétez la phrase suivante : « Bien qu'il ___ très tard, les négociations se sont poursuivies. »",
"options": [
  { "content": "soit", "is_correct": true, "order_index": 0 },
  { "content": "est", "is_correct": false, "order_index": 1 },
  { "content": "sera", "is_correct": false, "order_index": 2 },
  { "content": "était", "is_correct": false, "order_index": 3 }
]
```

**B. Texte à trous multiples (`text_gap`) — Règle de question indivisible :**
- `question_type`: `"gap_fill"`, `response_type`: `"gap_fill"`, `task_type_code`: `"text_gap"`
- Le stimulus contient un texte suivi intégrant plusieurs lacunes numérotées `[1]`, `[2]`, `[3]`, etc.
- **RÈGLE CRITIQUE :** Le texte et tous ses trous forment **UNE SEULE ET UNIQUE QUESTION** (jamais découpée en plusieurs questions).
- Chaque trou est défini dans le tableau `gaps` avec ses 4 options (A, B, C, D) :
```json
"stimulus_text": "Le développement du télétravail s'accélère. [1], de nombreuses entreprises réorganisent leurs bureaux. Cette transition est [2] par les nouveaux outils collaboratifs.",
"prompt": "Complétez le texte en choisissant la bonne option pour chaque trou numéroté.",
"gaps": [
  {
    "gap_id": "1",
    "order_index": 0,
    "cue_text": "Connecteur logique",
    "options": [
      { "content": "En effet", "is_correct": true, "order_index": 0 },
      { "content": "Néanmoins", "is_correct": false, "order_index": 1 },
      { "content": "Par conséquent", "is_correct": false, "order_index": 2 },
      { "content": "Bien que", "is_correct": false, "order_index": 3 }
    ]
  },
  {
    "gap_id": "2",
    "order_index": 1,
    "cue_text": "Participe passé",
    "options": [
      { "content": "facilitée", "is_correct": true, "order_index": 0 },
      { "content": "retardée", "is_correct": false, "order_index": 1 },
      { "content": "interdite", "is_correct": false, "order_index": 2 },
      { "content": "oubliée", "is_correct": false, "order_index": 3 }
    ]
  }
]
```

#### 4. `matching` (Appariement de documents / profils / graphiques)
- `question_type`: `"multiple_choice"`, `response_type`: `"matching"`
- Chaque option représente la paire correcte sous la syntaxe standard `Élément gauche -> Élément droit`.
- Toutes les options ont `is_correct: true`.
```json
"options": [
  { "content": "Annonce 1 -> Profil A (Jeune diplômé cherchant un stage)", "is_correct": true, "order_index": 0 },
  { "content": "Annonce 2 -> Profil C (Famille recherchant un 4 pièces)", "is_correct": true, "order_index": 1 },
  { "content": "Annonce 3 -> Profil B (Professionnel en mobilité géographique)", "is_correct": true, "order_index": 2 },
  { "content": "Annonce 4 -> Profil D (Retraité souhaitant une maison de plain-pied)", "is_correct": true, "order_index": 3 }
]
```

#### 5. `ordering` (Remise en ordre chronologique ou logique)
- `question_type`: `"multiple_choice"`, `response_type`: `"ordering"`
- Les options présentent les segments dans la **séquence chronologique ou argumentative exacte** (du premier au dernier).
- Toutes les options ont `is_correct: true`.
```json
"options": [
  { "content": "Créer un compte candidat sur le portail officiel", "is_correct": true, "order_index": 0 },
  { "content": "Téléverser les pièces justificatives d'identité et de diplôme", "is_correct": true, "order_index": 1 },
  { "content": "Régler les frais d'inscription par carte bancaire", "is_correct": true, "order_index": 2 },
  { "content": "Télécharger sa convocation officielle avec numéro de table", "is_correct": true, "order_index": 3 }
]
```

#### 6. `short_text` (Réponse courte / extraction lexicale)
- `question_type`: `"text_input"`, `response_type`: `"short_text"`
- Les options contiennent les variantes acceptées (synonymes, graphies admises), toutes avec `is_correct: true`.
```json
"options": [
  { "content": "modernisation", "is_correct": true, "order_index": 0 },
  { "content": "rénovation", "is_correct": true, "order_index": 1 }
]
```

---

## 2. Référentiel Canonique de Taxonomie (V1)

### Types de tâches par modalité (`task_type_code`)

#### Compréhension Écrite (`reading`)
- `daily_document` : Documents de la vie quotidienne (annonces, horaires, menus, courriels de service, petites annonces).
- `press_article` : Articles de presse, éditoriaux, chroniques, tribunes et essais d'actualité.
- `administrative_document` : Notices administratives, circulaires officielles, chartes, règlements, formulaires.
- `professional_document` : Notes de service internes, courriels d'entreprise, ordres du jour, synthèses professionnelles.
- `sentence_gap` : Complétion de phrases isolées (lexique, prépositions, accords).
- `text_gap` : Textes à trous suivis (cohésion textuelle, connecteurs, connectivité logique).
- `document_matching` : Appariement profils-documents ou textes courts multiples.
- `graph_matching` : Corrélation entre affirmations et représentations statistiques / infographies.
- `text_ordering` : Remise en ordre logique de paragraphes ou phases d'une procédure.
- `reformulation` : Paraphrase et reformulation équivalente.

#### Compréhension Orale (`listening`)
- `short_announcement` : Annonces publiques (gares, aéroports, commerces), messages téléphoniques.
- `radio_broadcast` : Extraits d'émissions de radio, reportages, chroniques culturelles ou scientifiques.
- `public_survey` : Micro-trottoirs et sondages d'opinion avec multiples locuteurs exprimant un avis.
- `conversation_extract` : Dialogues entre deux personnes en contexte quotidien ou professionnel.
- `phonological_recognition` : Discrimination auditive fine, intonation, liaisons.
- `message_association` : Appariement d'extraits oraux à des catégories thématiques.

#### Lexique et Structure (`lexique_structure`)
- `word_formation` : Dérivation préfixale, suffixale et familles morphologiques de mots.
- `adjective_agreement` : Accord en genre et nombre, position de l'adjectif (antéposé vs postposé).
- `pronoun_reference` : Reprise anaphorique, pronoms compléments (`y`, `en`, `lui`, `leur`, pronoms relatifs).
- `syntax_construction` : Structures de phrases complexes, négations, subordonnées, hypothèses.

#### Expression Écrite (`writing`)
- `fait_divers` : Section A : rédaction d'un fait divers à partir d'une amorce (narration au passé, min. 80 mots).
- `opinion_letter` : Section B : lettre d'argumentation et d'opinion pour convaincre (min. 200 mots).

#### Expression Orale (`speaking`)
- `information_gathering` : Section A : recueil d'informations par 10 questions précises sur une annonce (5 min).
- `persuasive_argumentation` : Section B : argumentation persuasive pour convaincre un proche (10 min).

---

### Codes de Compétences Évaluables (`skill_codes`)

#### Dimension Raisonnement (`reasoning`)
| Code de compétence | Intitulé en français | Modalités applicables |
| :--- | :--- | :--- |
| `locate_information` | Repérage d'informations factuelles explicites (dates, chiffres, lieux, noms) | `reading`, `listening` |
| `identify_specific_detail` | Identification d'une condition, modalité, clause restrictive ou précision | `reading`, `listening` |
| `identify_main_idea` | Dégagement de l'idée principale, du sujet central ou de la thèse | `reading`, `listening` |
| `understand_context` | Compréhension du cadre spatiotemporel et de la relation entre interlocuteurs | `reading`, `listening`, `speaking` |
| `understand_sequence` | Compréhension de la chronologie, des étapes d'un récit ou d'une procédure | `reading`, `listening`, `writing` |
| `understand_cause_consequence` | Liens logiques de causalité, facteurs explicatifs et retombées | `reading`, `listening`, `writing`, `speaking` |
| `compare_information` | Comparaison, confrontation de points de vue, similitudes et contrastes | `reading`, `listening`, `writing`, `speaking` |
| `synthesize_information` | Synthèse d'informations dispersées à travers plusieurs passages | `reading`, `listening`, `writing`, `speaking` |
| `infer_implicit_information` | Déduction d'informations non dites, implicites ou sous-entendues | `reading`, `listening` |
| `infer_pragmatic_meaning` | Interprétation de l'ironie, des métaphores, de l'humour et du second degré | `reading`, `listening`, `speaking` |
| `identify_stance_and_perspective` | Prise de position de l'auteur / locuteur (favorable, opposé, critique, neutre) | `reading`, `listening`, `writing`, `speaking` |
| `identify_tone` | Tonalité du discours (alarmiste, polémique, bienveillant, enthousiaste) | `reading`, `listening` |
| `identify_communicative_intention`| Intention première (avertir, réclamer, inciter à agir, conseiller, informer) | `reading`, `listening`, `writing`, `speaking` |
| `identify_claim` | Identification de la thèse majeure ou de la revendication principale | `reading`, `listening`, `writing`, `speaking` |
| `identify_supporting_reason` | Identification des preuves, justifications, arguments et exemples à l'appui | `reading`, `listening`, `writing`, `speaking` |
| `handle_counterargument` | Repérage et réfutation des contre-arguments et concessions | `reading`, `listening`, `writing`, `speaking` |
| `interpret_data_trends` | Interprétation de tendances chiffrées, fluctuations, graphiques | `reading`, `writing` |
| `correlate_data_and_text` | Rapprochement et validation entre texte écrit et données chiffrées | `reading` |

#### Dimension Langue (`language`)
| Code de compétence | Intitulé en français | Modalités applicables |
| :--- | :--- | :--- |
| `vocabulary_in_context` | Sens précis d'un mot ou d'une locution en contexte | `reading`, `listening`, `lexique_structure` |
| `paraphrase_and_synonym_recognition` | Reconnaissance des synonymes, équivalences lexicales et paraphrases | `reading`, `listening` |
| `collocations` | Associations lexicales privilégiées et expressions idiomatiques courantes | `reading`, `listening`, `lexique_structure` |
| `word_formation` | Dérivation morphologique (préfixes, suffixes, familles de mots) | `reading`, `lexique_structure` |
| `lexical_precision` | Précision et richesse lexicale, nuances de sens | `reading`, `writing`, `speaking`, `lexique_structure` |
| `register_and_formality` | Niveaux de langue (familier, standard, soutenu) et adéquation au contexte | `reading`, `listening`, `writing`, `speaking` |
| `grammatical_agreement` | Accords dans le groupe nominal, sujet-verbe et participe passé | `reading`, `writing`, `lexique_structure` |
| `articles_and_determiners` | Articles (définis, indéfinis, partitifs) et déterminants possessifs/démonstratifs | `reading`, `writing`, `speaking` |
| `pronoun_usage` | Système pronominal (COD, COI, `y`, `en`, pronoms relatifs simples et composés) | `reading`, `listening`, `lexique_structure` |
| `preposition_usage` | Rections prépositionnelles verbales et compléments circonstanciels | `reading`, `writing`, `speaking` |
| `negation_structures` | Négations simples et complexes (`ne... jamais`, `ne... que`, `sans que`) | `reading`, `listening`, `lexique_structure` |
| `verb_conjugation` | Conjugaison et morphologie des verbes réguliers et irréguliers | `reading`, `writing`, `speaking` |
| `tense_selection` | Choix et alternance des temps (passé composé vs imparfait, futur, conditionnel) | `reading`, `writing`, `speaking` |
| `mood_selection` | Choix des modes (subjonctif vs indicatif vs conditionnel) | `reading`, `writing`, `speaking` |
| `sentence_structure` | Ordre des mots, inversion interrogative, mises en relief (`c'est... qui/que`) | `reading`, `lexique_structure` |
| `relative_clauses` | Propositions relatives enchâssées (`dont`, `auquel`, `lequel`) | `reading`, `listening`, `lexique_structure` |
| `subordination_and_coordination` | Articulation par conjonctions de subordination et coordination | `reading`, `lexique_structure` |
| `conditional_structures` | Systèmes hypothétiques avec « si » et locutions de condition | `reading`, `lexique_structure` |
| `discourse_connectors` | Connecteurs logiques (opposition, cause, conséquence, concession) | `reading`, `listening`, `lexique_structure` |
| `reference_resolution` | Repérage de l'antécédent et résolution anaphorique | `reading`, `listening`, `lexique_structure` |
| `textual_cohesion_and_coherence` | Progression thématique, enchaînement logique et segmentation textuelle | `reading`, `writing`, `speaking` |

---

## Prompt 1 : Compréhension Écrite (Reading - Multi-Types)

> Copiez le bloc ci-dessous dans Google Gemini / AI Studio pour générer un lot équilibré de 25 questions de compréhension écrite combinant l'ensemble des types de questions de l'examen TEF.

```markdown
Tu es un concepteur expert d'épreuves de certification linguistique de français langue étrangère, spécialisé dans l'examen officiel du TEF (Test d'Évaluation de Français - CCI Paris Île-de-France / TEF Canada).

Génère un fichier JSON strict et directement importable contenant exactement 25 questions de Compréhension Écrite, réparties sur une combinaison variée et authentique de types de questions :

### 1. Répartition des Types de Questions (Total : 25 questions)
- **13 questions `single_choice`** : QCM à choix unique (4 options, exactement 1 bonne réponse) portant sur la compréhension globale, les détails, les intentions ou le ton.
- **4 questions `multiple_choice`** : QCM à choix multiples (4 ou 5 options, avec 2 réponses correctes à cocher).
- **3 questions `gap_fill`** : Textes ou phrases à trous avec `___` où le candidat choisit parmi 4 options la complétion exacte (connecteur logique, mot en contexte, ou accord).
- **3 questions `matching`** : Appariement de profils de personnes avec des annonces ou des documents courts (`task_type_code: "document_matching"`). Syntaxe obligatoire des options : `"Annonce X -> Profil Y"`, toutes avec `is_correct: true`.
- **2 questions `ordering`** : Remise en ordre logique ou chronologique de 4 étapes d'une démarche ou paragraphes d'un récit (`task_type_code: "text_ordering"`). Propositions ordonnées dans la séquence exacte (order_index 0 à 3), toutes avec `is_correct: true`.

### 2. Répartition par Niveaux CECRL
- 5 questions A2 (annonces, horaires, courriels de la vie quotidienne)
- 10 questions B1 (articles d'information, notes d'entreprise, courriers de lecteurs)
- 7 questions B2 (tribunes d'opinion, analyses de presse, débats de société)
- 3 questions C1 (éditoriaux complexes, nuances argumentatives et implicite)

### 3. Règles Impératives de Conception
1. **Séparation Document / Question** :
   - `stimulus_title` : Titre réaliste du document (ex: "Chronique Environnement - Le Figaro", "Note interne n°42").
   - `stimulus_text` : Le texte intégral support en français naturel (pas d'extraits tronqués).
   - `prompt` : L'énoncé direct de la question posée au candidat.
2. **Options par Type** :
   - `single_choice` : 4 options, exactement 1 avec `is_correct: true`.
   - `multiple_choice` : 4-5 options, au moins 2 avec `is_correct: true`.
   - `gap_fill` : 4 options, exactement 1 avec `is_correct: true`.
   - `matching` : 4 paires au format `"Élément A -> Élément B"`, toutes avec `is_correct: true`.
   - `ordering` : 4 étapes dans l'ordre chronologique exact, toutes avec `is_correct: true`.
3. **Taxonomie Canonique** :
   - `task_type_code` : Choisir obligatoirement parmi `daily_document`, `press_article`, `administrative_document`, `professional_document`, `sentence_gap`, `text_gap`, `document_matching`, `text_ordering`.
   - `cognitive_complexity` : `recall_recognition`, `interpretation`, `inferencing_synthesis`, `critical_evaluation`.
   - `skill_codes` : 1 à 2 codes valides parmi : `locate_information`, `identify_specific_detail`, `identify_main_idea`, `understand_sequence`, `understand_cause_consequence`, `compare_information`, `synthesize_information`, `infer_implicit_information`, `identify_stance_and_perspective`, `identify_tone`, `vocabulary_in_context`, `paraphrase_and_synonym_recognition`, `discourse_connectors`, `reference_resolution`.
4. **Explication Pédagogique** :
   - Fournir dans `explanation` une explication rigoureuse en français justifiant pourquoi la réponse est exacte en citant le texte support.

### Format de Sortie
Renvoie UNIQUEMENT le bloc JSON brut suivant, sans aucun texte d'introduction ni de conclusion :

```json
{
  "items": [
    {
      "stimulus_title": "Note d'information - Mobilité urbaine",
      "stimulus_text": "À compter du 1er novembre, la communauté urbaine met en place une navette électrique reliant le pôle multimodal au parc technologique. Ce service gratuit fonctionnera du lundi au vendredi, de 7h30 à 19h30, avec une rotation toutes les quinze minutes aux heures de pointe. Les usagers sont invités à télécharger l'application mobile pour suivre en temps réel la position des véhicules.",
      "prompt": "Pour quel motif principal les usagers sont-ils encouragés à installer l'application mobile ?",
      "task_type_code": "daily_document",
      "modality": "reading",
      "level": "A2",
      "target_cefr": "A2",
      "difficulty": 2,
      "cognitive_complexity": "recall_recognition",
      "question_type": "single_choice",
      "response_type": "single_choice",
      "points": 1,
      "penalty_points": 0,
      "explanation": "Le texte indique que l'application permet de suivre la position des véhicules en direct.",
      "options": [
        { "content": "Pour acheter leurs titres de transport", "is_correct": false, "order_index": 0 },
        { "content": "Pour localiser les navettes en temps réel", "is_correct": true, "order_index": 1 },
        { "content": "Pour réserver un siège à l'avance", "is_correct": false, "order_index": 2 },
        { "content": "Pour contacter le service réclamation", "is_correct": false, "order_index": 3 }
      ],
      "skill_codes": ["locate_information", "identify_specific_detail"]
    },
    {
      "stimulus_title": "Conditions de souscription - Pass Culture",
      "stimulus_text": "Le Pass Culture annuel s'adresse aux résidents de la métropole. Pour en bénéficier au tarif préférentiel de 15 euros par mois, le demandeur doit soit justifier du statut d'étudiant de moins de 28 ans, soit être demandeur d'emploi inscrit depuis plus de six mois.",
      "prompt": "Quelles conditions permettent de bénéficier du tarif préférentiel ? (Sélectionnez les 2 bonnes réponses)",
      "task_type_code": "administrative_document",
      "modality": "reading",
      "level": "B1",
      "target_cefr": "B1",
      "difficulty": 3,
      "cognitive_complexity": "interpretation",
      "question_type": "multiple_choice",
      "response_type": "multiple_choice",
      "points": 1,
      "penalty_points": 0,
      "explanation": "Le document mentionne deux catégories : les étudiants de moins de 28 ans et les demandeurs d'emploi inscrits depuis plus de six mois.",
      "options": [
        { "content": "Être étudiant âgé de moins de 28 ans", "is_correct": true, "order_index": 0 },
        { "content": "Être propriétaire de son logement principal", "is_correct": false, "order_index": 1 },
        { "content": "Être inscrit comme demandeur d'emploi depuis plus de six mois", "is_correct": true, "order_index": 2 },
        { "content": "Avoir exercé une activité bénévole au cours de l'année", "is_correct": false, "order_index": 3 }
      ],
      "skill_codes": ["locate_information", "identify_specific_detail"]
    },
    {
      "stimulus_title": "Éditorial - Transition écologique",
      "stimulus_text": "Les investissements massifs dans les énergies renouvelables ont permis d'infléchir la courbe des émissions. [1], plusieurs experts alertent sur la dépendance accrue aux métaux rares. Cette situation pourrait [2] la souveraineté industrielle des pays importateurs.",
      "prompt": "Complétez le texte en sélectionnant le terme approprié pour chaque trou numéroté.",
      "task_type_code": "text_gap",
      "modality": "reading",
      "level": "B2",
      "target_cefr": "B2",
      "difficulty": 3,
      "cognitive_complexity": "inferencing_synthesis",
      "question_type": "gap_fill",
      "response_type": "gap_fill",
      "points": 1,
      "penalty_points": 0,
      "explanation": "Pour le trou [1], « Néanmoins » marque la restriction exigée. Pour le trou [2], « compromettre » est la seule collocation sémantiquement adaptée au risque pesant sur la souveraineté.",
      "gaps": [
        {
          "gap_id": "1",
          "order_index": 0,
          "cue_text": "Connecteur logique de restriction",
          "options": [
            { "content": "Néanmoins", "is_correct": true, "order_index": 0, "explanation": "Introduit une restriction appropriée." },
            { "content": "En conséquence", "is_correct": false, "order_index": 1, "misconception_type": "contradiction" },
            { "content": "De surcroît", "is_correct": false, "order_index": 2, "misconception_type": "false_friend" },
            { "content": "C'est pourquoi", "is_correct": false, "order_index": 3, "misconception_type": "contradiction" }
          ]
        },
        {
          "gap_id": "2",
          "order_index": 1,
          "cue_text": "Verbe infinitif de risque",
          "options": [
            { "content": "compromettre", "is_correct": true, "order_index": 0, "explanation": "Collocation naturelle avec la souveraineté menacée." },
            { "content": "renforcer", "is_correct": false, "order_index": 1, "misconception_type": "contradiction" },
            { "content": "consolider", "is_correct": false, "order_index": 2, "misconception_type": "contradiction" },
            { "content": "contourner", "is_correct": false, "order_index": 3, "misconception_type": "false_friend" }
          ]
        }
      ],
      "skill_codes": ["discourse_connectors", "textual_cohesion_and_coherence"]
    },
    {
      "stimulus_title": "Appariement d'offres d'hébergement",
      "stimulus_text": "Annonce 1 : Studio meublé au calme proche campus.\nAnnonce 2 : Maison 5 pièces avec jardin arboré.\nAnnonce 3 : Chambre chez l'habitant avec demi-pension.\nAnnonce 4 : Appartement central proche gare pour séjour professionnel.",
      "prompt": "Associez chaque annonce au profil de voyageur qui lui correspond le mieux.",
      "task_type_code": "document_matching",
      "modality": "reading",
      "level": "B1",
      "target_cefr": "B1",
      "difficulty": 3,
      "cognitive_complexity": "interpretation",
      "question_type": "multiple_choice",
      "response_type": "matching",
      "points": 1,
      "penalty_points": 0,
      "explanation": "L'appariement repose sur l'adéquation entre localisation, superficie et besoin du voyageur.",
      "options": [
        { "content": "Annonce 1 -> Étudiant universitaire cherchant l'autonomie", "is_correct": true, "order_index": 0 },
        { "content": "Annonce 2 -> Famille avec enfants souhaitant de l'espace", "is_correct": true, "order_index": 1 },
        { "content": "Annonce 3 -> Stagiaire étranger désireux de pratiquer la langue", "is_correct": true, "order_index": 2 },
        { "content": "Annonce 4 -> Cadre en mission courte de quelques jours", "is_correct": true, "order_index": 3 }
      ],
      "skill_codes": ["compare_information", "locate_information"]
    },
    {
      "stimulus_title": "Procédure de demande de visa",
      "stimulus_text": "Le dossier de demande de visa long séjour requiert le respect scrupuleux d'étapes administratives successives.",
      "prompt": "Remettez dans l'ordre chronologique les étapes de la demande de visa.",
      "task_type_code": "text_ordering",
      "modality": "reading",
      "level": "B2",
      "target_cefr": "B2",
      "difficulty": 3,
      "cognitive_complexity": "interpretation",
      "question_type": "multiple_choice",
      "response_type": "ordering",
      "points": 1,
      "penalty_points": 0,
      "explanation": "La chronologie impose de remplir le formulaire en ligne avant de déposer les pièces au consulat et de retirer son passeport.",
      "options": [
        { "content": "Remplir le formulaire officiel sur le portail en ligne", "is_correct": true, "order_index": 0 },
        { "content": "Prendre rendez-vous auprès du centre des visas agréé", "is_correct": true, "order_index": 1 },
        { "content": "Déposer son passeport et ses données biométriques au guichet", "is_correct": true, "order_index": 2 },
        { "content": "Retirer son passeport muni de la vignette visée", "is_correct": true, "order_index": 3 }
      ],
      "skill_codes": ["understand_sequence", "discourse_connectors"]
    }
  ]
}
```
```

---

## Prompt 2 : Compréhension Orale (Listening - Multi-Types)

> Ce prompt génère des questions de compréhension orale diversifiées (`single_choice`, `matching` pour les micro-trottoirs/sondages d'opinion, et `multiple_choice`) avec transcription complète balisée par des tags de locuteurs dans `stimulus_text`.

```markdown
Tu es un concepteur expert d'épreuves de Compréhension Orale pour le TEF (Test d'Évaluation de Français - CCI Paris Île-de-France / TEF Canada).

Génère un fichier JSON strict et directement importable contenant 20 questions de Compréhension Orale réparties sur plusieurs types d'exercices :
- **13 questions `single_choice`** : Messages courts, annonces en gare/aéroport, chroniques radio ou interviews (1 réponse correcte sur 4).
- **4 questions `matching` (`public_survey`)** : Micro-trottoirs ou sondages d'opinion où 4 personnes s'expriment sur un sujet d'actualité. Les options associent chaque personne à son avis sous la syntaxe `"Locuteur X -> Avis/Position"`, toutes avec `is_correct: true`.
- **3 questions `multiple_choice`** : Dialogues ou reportages où le candidat doit repérer deux informations exactes parmi 4 ou 5 propositions.

### Règles de Conception
1. **Transcription Intégrale dans `stimulus_text`** :
   - Inclure la transcription exacte de la bande sonore avec balisage systématique des intervenants (ex: `[Annonceur]`, `[Journaliste]`, `[Locuteur 1]`, `[Locuteur 2]`).
2. **Types de Tâches Canoniques (`task_type_code`)** :
   - `short_announcement`, `radio_broadcast`, `public_survey`, `conversation_extract`, `phonological_recognition`.
3. **Compétences Canoniques (`skill_codes`)** :
   - `locate_information`, `identify_specific_detail`, `identify_main_idea`, `understand_context`, `infer_implicit_information`, `identify_stance_and_perspective`, `identify_tone`, `identify_communicative_intention`, `vocabulary_in_context`, `register_and_formality`.

### Format de Sortie
Renvoie UNIQUEMENT le bloc JSON brut :

```json
{
  "items": [
    {
      "stimulus_title": "Chronique radio France Info - Consigne en verre",
      "stimulus_text": "[Journaliste] : Ce matin, nous parlons du retour de la consigne des bouteilles en verre dans l'ouest de la France.\n[Invité] : Les consommateurs ont immédiatement adhéré. En trois mois, le taux de retour dépasse déjà 80 %, même si la logistique de lavage reste coûteuse.",
      "prompt": "Quelle réaction majeure des usagers l'invité met-il en avant ?",
      "task_type_code": "radio_broadcast",
      "modality": "listening",
      "level": "B1",
      "target_cefr": "B1",
      "difficulty": 3,
      "cognitive_complexity": "interpretation",
      "question_type": "single_choice",
      "response_type": "single_choice",
      "points": 1,
      "penalty_points": 0,
      "explanation": "L'invité indique que les clients ont massivement adopté la consigne avec 80 % de retours.",
      "options": [
        { "content": "Ils ont boudé l'initiative à cause des tarifs", "is_correct": false, "order_index": 0 },
        { "content": "Ils ont adopté avec enthousiasme le dispositif", "is_correct": true, "order_index": 1 },
        { "content": "Ils réclament un remboursement intégral en espèces", "is_correct": false, "order_index": 2 },
        { "content": "Ils déplorent le manque d'informations en magasin", "is_correct": false, "order_index": 3 }
      ],
      "skill_codes": ["identify_main_idea", "identify_stance_and_perspective"]
    },
    {
      "stimulus_title": "Micro-trottoir : La semaine de 4 jours en entreprise",
      "stimulus_text": "[Journaliste] : Que pensez-vous du passage à la semaine de quatre jours sans baisse de salaire ?\n[Personne 1] : C'est une révolution formidable pour la vie de famille.\n[Personne 2] : J'ai peur que les journées deviennent intenables avec 9h ou 10h de travail par jour.\n[Personne 3] : Pour les commerces et les services publics, cela me semble inapplicable.\n[Personne 4] : Si la productivité reste la même, c'est une excellente façon d'attirer les jeunes recrues.",
      "prompt": "Associez chaque intervenant à la position qu'il exprime.",
      "task_type_code": "public_survey",
      "modality": "listening",
      "level": "B2",
      "target_cefr": "B2",
      "difficulty": 3,
      "cognitive_complexity": "interpretation",
      "question_type": "multiple_choice",
      "response_type": "matching",
      "points": 1,
      "penalty_points": 0,
      "explanation": "L'appariement associe la nuance d'argumentation de chaque interlocuteur.",
      "options": [
        { "content": "Personne 1 -> Met en avant l'équilibre entre vie privée et travail", "is_correct": true, "order_index": 0 },
        { "content": "Personne 2 -> Redoute la fatigue engendrée par des journées trop longues", "is_correct": true, "order_index": 1 },
        { "content": "Personne 3 -> Souligne l'incompatibilité avec certains secteurs d'activité", "is_correct": true, "order_index": 2 },
        { "content": "Personne 4 -> Y voit un levier efficace pour le recrutement", "is_correct": true, "order_index": 3 }
      ],
      "skill_codes": ["identify_stance_and_perspective", "compare_information"]
    }
  ]
}
```
```

---

## Prompt 3 : Lexique et Structure (Morphologie, Accords, Syntaxe)

> Ce prompt génère des questions fermées de morphologie lexicale, accords grammaticaux, pronoms et syntaxe française sous format `single_choice` et `gap_fill`.

```markdown
Tu es un spécialiste de la didactique de la grammaire française et concepteur d'items pour l'épreuve de Lexique et Structure du TEF Canada.

Génère un fichier JSON strict de 20 questions réparties entre choix unique (`single_choice`) et phrases à trous (`gap_fill`) couvrant les niveaux A2, B1, B2 et C1 :
- 5 items de morphologie lexicale (`word_formation` : préfixes, suffixes, dérivés)
- 5 items d'accord et place de l'adjectif (`adjective_agreement`)
- 5 items de reprise anaphorique et pronoms (`pronoun_reference` : COD/COI, y, en, pronoms relatifs)
- 5 items de construction syntaxique (`syntax_construction` : subordonnées, concordance des temps, hypothèses avec si)

### Règles de Conception
1. `stimulus_text` : Une phrase courte isolée (ou un mini-contexte de 2 phrases maximum) contenant l'élément cible.
2. `prompt` : L'énoncé direct (ex: "Quelle forme de l'adjectif complète correctement la phrase suivante ?" ou "Choisissez le mot manquant.").
3. `task_type_code` : Choisir obligatoirement parmi `word_formation`, `adjective_agreement`, `pronoun_reference`, `syntax_construction`.
4. `skill_codes` : Assigner parmi `word_formation`, `grammatical_agreement`, `pronoun_usage`, `tense_selection`, `mood_selection`, `conditional_structures`, `relative_clauses`, `subordination_and_coordination`.

### Format de Sortie
Renvoie UNIQUEMENT le bloc JSON brut :

```json
{
  "items": [
    {
      "stimulus_title": "Item morphologie lexicale - Suffixe nominal",
      "stimulus_text": "La nouvelle directrice souhaite accélérer la modern_______ des infrastructures informatiques de l'entreprise.",
      "prompt": "Quel suffixe permet de former le nom correct désignant l'action de moderniser ?",
      "task_type_code": "word_formation",
      "modality": "lexique_structure",
      "level": "B1",
      "target_cefr": "B1",
      "difficulty": 2,
      "cognitive_complexity": "recall_recognition",
      "question_type": "single_choice",
      "response_type": "single_choice",
      "points": 1,
      "penalty_points": 0,
      "explanation": "Le suffixe d'action dérivé du verbe 'moderniser' est '-isation', formant le substantif féminin 'modernisation'.",
      "options": [
        { "content": "-itude", "is_correct": false, "order_index": 0 },
        { "content": "-isation", "is_correct": true, "order_index": 1 },
        { "content": "-ité", "is_correct": false, "order_index": 2 },
        { "content": "-ance", "is_correct": false, "order_index": 3 }
      ],
      "skill_codes": ["word_formation"]
    },
    {
      "stimulus_title": "Item syntaxe - Système hypothétique",
      "stimulus_text": "Si le budget avait été voté à temps, nous ___ lancer les travaux dès le mois dernier.",
      "prompt": "Quelle forme verbale complète correctement cette hypothèse non réalisée dans le passé ?",
      "task_type_code": "syntax_construction",
      "modality": "lexique_structure",
      "level": "B2",
      "target_cefr": "B2",
      "difficulty": 3,
      "cognitive_complexity": "interpretation",
      "question_type": "text_input",
      "response_type": "gap_fill",
      "points": 1,
      "penalty_points": 0,
      "explanation": "La structure d'hypothèse dans le passé 'Si + plus-que-parfait' appelle le conditionnel passé dans la proposition principale.",
      "options": [
        { "content": "aurions pu", "is_correct": true, "order_index": 0 },
        { "content": "pouvons", "is_correct": false, "order_index": 1 },
        { "content": "pourrions", "is_correct": false, "order_index": 2 },
        { "content": "avions pu", "is_correct": false, "order_index": 3 }
      ],
      "skill_codes": ["conditional_structures", "mood_selection"]
    }
  ]
}
```
```

---

## Prompt 4 : Expression Écrite (Writing - Section A & B)

> Ce prompt génère des sujets d'entraînement à l'Expression Écrite du TEF pour les deux sections officielles : Section A (Fait divers) et Section B (Lettre d'argumentation).

```markdown
Tu es un examinateur officiel certifié pour l'épreuve d'Expression Écrite du TEF (CCI Paris).

Génère un fichier JSON contenant 6 sujets complets d'entraînement :
- 3 sujets Section A (`task_type_code`: `fait_divers`, min. 80 mots) : amorce journalistique brève d'un événement insolite ou inattendu.
- 3 sujets Section B (`task_type_code`: `opinion_letter`, min. 200 mots) : prise de position sur un sujet de société polémique (ex: télétravail obligatoire, interdiction des vols courts, uniforme à l'école).

### Structure des Items
- `stimulus_title` : Titre du sujet (ex: "Fait divers - Découverte insolite dans le métro", "Lettre d'opinion - Ville sans voiture").
- `stimulus_text` : Le texte d'amorce officiel ou la consigne détaillée.
- `prompt` : La consigne d'écriture explicite incluant le volume de mots exigé et le destinataire.
- `response_type` : `long_text`
- `question_type` : `single_choice` (placeholder système)
- `options` : Laisser vide (`[]`).
- `explanation` : Grille d'évaluation indicative (respect de la consigne, cohérence, richesse lexicale, correction morphosyntaxique).
- `skill_codes` : `textual_cohesion_and_coherence`, `lexical_precision`, `grammatical_agreement`, `tense_selection`, `discourse_connectors`, `handle_counterargument`.

### Format de Sortie
Renvoie UNIQUEMENT le bloc JSON brut :

```json
{
  "items": [
    {
      "stimulus_title": "Section B - Lettre d'opinion : L'usage des smartphones à l'école",
      "stimulus_text": "« Faut-il interdire totalement les téléphones portables dans tous les établissements scolaires, y compris au lycée ? » Un collectif de parents d'élèves soutient cette mesure radicale, tandis que les enseignants mettent en avant l'intérêt pédagogique des outils numériques.",
      "prompt": "Vous écrivez une lettre au rédacteur en chef du journal local pour exprimer votre point de vue argumenté sur cette question. Vous défendez votre position en présentant des arguments variés et des exemples concrets pour convaincre les lecteurs (minimum 200 mots).",
      "task_type_code": "opinion_letter",
      "modality": "writing",
      "level": "B2",
      "target_cefr": "B2",
      "difficulty": 4,
      "cognitive_complexity": "critical_evaluation",
      "question_type": "single_choice",
      "response_type": "long_text",
      "points": 10,
      "penalty_points": 0,
      "explanation": "Critères d'évaluation : Adéquation sociolinguistique (formules d'appel et de prise de congé épistolaires), structuration logique des arguments et contre-arguments, maîtrise des connecteurs logiques et variété du lexique abstrait.",
      "options": [],
      "skill_codes": ["identify_claim", "handle_counterargument", "textual_cohesion_and_coherence", "lexical_precision"]
    }
  ]
}
```
```

---

## Prompt 5 : Expression Orale (Speaking - Section A & B)

> Ce prompt génère des sujets de simulation pour l'épreuve d'Expression Orale : Section A (Recueil d'informations, 10 questions en 5 min) et Section B (Convaincre un proche, 10 min).

```markdown
Tu es un examinateur officiel certifié pour l'épreuve d'Expression Orale du TEF (CCI Paris).

Génère un fichier JSON contenant 6 sujets complets d'entraînement :
- 3 sujets Section A (`task_type_code`: `information_gathering`, 5 minutes) : petite annonce de la vie quotidienne avec consigne de poser une dizaine de questions précises pour obtenir des renseignements complémentaires.
- 3 sujets Section B (`task_type_code`: `persuasive_argumentation`, 10 minutes) : sujet engageant où le candidat doit convaincre un ami ou un collègue hésitant de participer à un projet ou d'adopter une décision.

### Structure des Items
- `stimulus_title` : Titre de l'annonce ou de la situation.
- `stimulus_text` : Le texte de l'annonce (Section A) ou le contexte de la discussion (Section B).
- `prompt` : Le rôle attribué au candidat et à l'examinateur avec le temps imparti.
- `response_type` : `spoken_response`
- `question_type` : `single_choice` (placeholder système)
- `options` : Laisser vide (`[]`).
- `skill_codes` : `understand_context`, `identify_stance_and_perspective`, `handle_counterargument`, `oral_fluency`, `register_and_formality`, `sentence_structure`.

### Format de Sortie
Renvoie UNIQUEMENT le bloc JSON brut :

```json
{
  "items": [
    {
      "stimulus_title": "Section A - Annonce : Atelier de cuisine du terroir",
      "stimulus_text": "« L'Atelier Gourmand vous propose des cours de cuisine traditionnelle le week-end en plein cœur de Bordeaux. Groupes réduits, matériel fourni, dégustation conviviale sur place. Inscriptions ouvertes. Contact : 05 56 00 00 00. »",
      "prompt": "Vous êtes intéressé(e) par cette annonce. Vous téléphonez à l'organisateur (l'examinateur). Posez-lui une dizaine de questions pour obtenir des informations précises sur le déroulement, les tarifs, les dates et les conditions de participation (Durée : 5 minutes).",
      "task_type_code": "information_gathering",
      "modality": "speaking",
      "level": "B1",
      "target_cefr": "B1",
      "difficulty": 3,
      "cognitive_complexity": "interpretation",
      "question_type": "single_choice",
      "response_type": "spoken_response",
      "points": 10,
      "penalty_points": 0,
      "explanation": "Critères d'évaluation : Capacité à initier l'échange, variété et correction des formes interrogatives (inversion, est-ce que, intonation), pertinence des questions par rapport à l'annonce, réactivité aux réponses de l'interlocuteur.",
      "options": [],
      "skill_codes": ["understand_context", "sentence_structure", "oral_fluency", "register_and_formality"]
    }
  ]
}
```
```

---

## Prompt 6 : Extracteur Universel de Documents Bruts en JSON TEF

> **Usage** : Utilisez ce prompt lorsque vous disposez d'un document brut, d'un scan OCR, de notes ou de questions en vrac (ex: annonces, cartes de visite, articles de presse avec QCM) et que vous souhaitez obtenir un JSON d'importation parfaitement structuré, calibré et conforme.

```markdown
Tu es un expert psychométricien, linguiste certifié et concepteur officiel d'épreuves pour le TEF (Test d'Évaluation de Français - CCI Paris / TEF Canada / TEF IRN).

### Mission
Analyse le document brut fourni ci-dessous, découpe et structure rigoureusement chaque document support et chaque question associée, puis convertis l'ensemble en un tableau JSON strict prêt à l'import selon le schéma officiel de la plateforme TEF.

---

### Règles d'Analyse et d'Extraction

#### 1. Séparation Document Support (Stimulus) vs Question
- Pour chaque groupe de questions, identifie le texte source (carte de visite, petite annonce, courriel, article de presse, fait divers, dialogue, notice administrative).
- Stocke le texte intégral et propre du document dans `stimulus_text` (préserve les sauts de ligne réels et la mise en page).
- Donne un titre clair, concis et contextuel dans `stimulus_title` (ex: "Carte de visite professionnelle — Mathieu Leroux", "Petite annonce — Vente de réfrigérateur d'occasion").
- Détermine le `task_type_code` adéquat :
  - `daily_document` : cartes de visite, petites annonces, menus, horaires, courriels courts, affiches.
  - `press_article` : articles de journaux, éditoriaux, analyses de société.
  - `administrative_document` : règlements, démarches officielles, avis municipaux, formulaires.
  - `fait_divers` : récits d'événements insolites ou inattendus au passé.
  - `radio_broadcast` : chroniques radio, extraits audio retranscrits.
  - `short_announcement` : annonces sonores de gare, messages téléphoniques.

#### 2. Énoncé de la Question (`prompt`)
- Extrais l'énoncé exact posé au candidat.
- Supprime les numérotations superflues en tête d'énoncé (retire "1.", "2.", "Question 3 :", etc.).
- Si l'énoncé est une phrase à compléter (ex: "Ce document est", "Le produit vendu dans cette annonce"), conserve-la telle quelle.

#### 3. Options de Réponse & Résolution de la Bonne Réponse
- Découpe chaque option (retire les préfixes A, B, C, D, 1, 2, 3, 4).
- Assigne l'indice séquentiel `order_index` (0 pour A, 1 pour B, 2 pour C, 3 pour D).
- Résolution Didactique de la Bonne Réponse :
  - Si le document source contient déjà la clé de réponse, respecte-la impérativement.
  - Si aucun corrigé n'est fourni, résous la question toi-même avec une certitude absolue basée sur l'analyse logique et lexicale du document.
  - Marque exactement une option avec `"is_correct": true`, et les autres avec `"is_correct": false`.
- Didactique & Pièges TEF (`misconception_type` et `distractor_rationale`) :
  - Pour chaque option fausse (`is_correct: false`), définis obligatoirement :
    - `misconception_type` parmi les 9 pièges canoniques TEF :
      - `overgeneralization` (généralisation hâtive)
      - `false_friend` (piège lexical, phonétique ou mot attracteur hors contexte)
      - `contradiction` (en contradiction directe avec le texte)
      - `extrapolation` (information plausible mais non mentionnée)
      - `literal_interpretation` (contresens ou interprétation trop littérale)
      - `incomplete_comprehension` (compréhension partielle d'un détail)
      - `content_mismatch` (non-concordance documentaire / mauvais objet)
      - `morphosyntax` (erreur grammaticale)
      - `intonation_mismatch` (intonation trompeuse)
    - `distractor_rationale` : brève phrase expliquant précisément en quoi cette option constitue un piège pour l'apprenant.
  - Rédige une `explanation` globale pédagogique en français démontrant pourquoi la bonne réponse est exacte en citant le texte.

#### 4. Calibrage Psychométrique & Taxonomie
- `modality` : "reading" ou "listening".
- `level` & `target_cefr` :
  - A1 : Documents très courts de repérage simple (cartes de visite, prix, panneaux, dates, contacts).
  - A2 : Petites annonces simples, courriels de la vie quotidienne, horaires, instructions directes.
  - B1 : Documents informatifs plus longs, notes de service, brèves de presse, courriers d'usagers.
  - B2 : Articles d'analyse, argumentations, débats d'opinion, faits de société nuancés.
  - C1/C2 : Textes littéraires, critiques complexes, subtilités rhétoriques ou ironiques.
- `difficulty` : Entier de 1 (très direct / explicite) à 5 (hautement inférentiel).
- `cognitive_complexity` : `recall_recognition` | `interpretation` | `inferencing_synthesis` | `critical_evaluation`
- **RÈGLE STRICTE SUR LES COMPÉTENCES (`skill_codes`)** :
  Tu NE DOIS JAMAIS inventer de code de compétence (n'utilise pas `reading_comprehension`, `grammar`, etc.).
  Tu dois impérativement choisir 1 à 3 codes autorisés selon le `task_type_code` de la question dans la matrice ci-dessous :

  *Matrice d'admissibilité Tâche ➔ Compétences autorisées :*
  - `daily_document` : `locate_information`, `identify_specific_detail`, `understand_context`, `vocabulary_in_context`, `register_and_formality`, `preposition_usage`
  - `press_article` : `identify_main_idea`, `identify_stance_and_perspective`, `identify_tone`, `identify_communicative_intention`, `infer_implicit_information`, `infer_pragmatic_meaning`, `identify_claim`, `identify_supporting_reason`, `handle_counterargument`, `vocabulary_in_context`, `paraphrase_and_synonym_recognition`, `relative_clauses`, `discourse_connectors`, `reference_resolution`
  - `administrative_document` : `locate_information`, `identify_specific_detail`, `understand_context`, `vocabulary_in_context`, `register_and_formality`, `conditional_structures`, `negation_structures`
  - `professional_document` : `identify_main_idea`, `identify_specific_detail`, `understand_context`, `identify_communicative_intention`, `vocabulary_in_context`, `register_and_formality`, `discourse_connectors`
  - `sentence_gap` : `vocabulary_in_context`, `collocations`, `grammatical_agreement`, `articles_and_determiners`, `pronoun_usage`, `preposition_usage`, `negation_structures`, `verb_conjugation`, `tense_selection`, `mood_selection`, `relative_clauses`
  - `text_gap` : `understand_sequence`, `understand_cause_consequence`, `vocabulary_in_context`, `word_formation`, `discourse_connectors`, `reference_resolution`, `subordination_and_coordination`
  - `document_matching` : `locate_information`, `identify_specific_detail`, `compare_information`, `vocabulary_in_context`, `paraphrase_and_synonym_recognition`
  - `graph_matching` : `locate_information`, `interpret_data_trends`, `correlate_data_and_text`, `compare_information`, `vocabulary_in_context`
  - `text_ordering` : `understand_sequence`, `textual_cohesion_and_coherence`, `discourse_connectors`, `identify_main_idea`
  - `reformulation` : `paraphrase_and_synonym_recognition`, `lexical_precision`, `collocations`, `register_and_formality`
  - `short_announcement` : `locate_information`, `identify_specific_detail`, `understand_context`, `identify_communicative_intention`, `vocabulary_in_context`, `register_and_formality`
  - `radio_broadcast` : `identify_main_idea`, `understand_sequence`, `understand_cause_consequence`, `synthesize_information`, `infer_implicit_information`, `identify_stance_and_perspective`, `vocabulary_in_context`, `paraphrase_and_synonym_recognition`, `discourse_connectors`
  - `public_survey` : `compare_information`, `identify_stance_and_perspective`, `identify_tone`, `infer_pragmatic_meaning`, `vocabulary_in_context`, `register_and_formality`
  - `conversation_extract` : `locate_information`, `identify_specific_detail`, `understand_context`, `infer_implicit_information`, `identify_communicative_intention`
  - `word_formation` : `word_formation`, `lexical_precision`, `vocabulary_in_context`, `collocations`, `orthography`
  - `adjective_agreement` : `grammatical_agreement`, `orthography`, `sentence_structure`
  - `pronoun_reference` : `reference_resolution`, `pronoun_usage`, `discourse_connectors`, `textual_cohesion_and_coherence`
  - `syntax_construction` : `sentence_structure`, `subordination_and_coordination`, `relative_clauses`, `conditional_structures`, `negation_structures`, `grammatical_agreement`, `discourse_connectors`
  - `fait_divers` : `understand_sequence`, `understand_cause_consequence`, `verb_conjugation`, `tense_selection`, `grammatical_agreement`, `lexical_precision`, `orthography`, `punctuation`, `textual_cohesion_and_coherence`
  - `opinion_letter` : `identify_claim`, `identify_supporting_reason`, `handle_counterargument`, `synthesize_information`, `discourse_connectors`, `mood_selection`, `conditional_structures`, `subordination_and_coordination`, `lexical_precision`, `register_and_formality`, `textual_cohesion_and_coherence`, `orthography`, `punctuation`
  - `information_gathering` : `understand_context`, `locate_information`, `sentence_structure`, `register_and_formality`, `phonological_control`, `oral_fluency`, `articles_and_determiners`, `preposition_usage`
  - `persuasive_argumentation` : `identify_claim`, `identify_supporting_reason`, `handle_counterargument`, `infer_pragmatic_meaning`, `discourse_connectors`, `conditional_structures`, `lexical_precision`, `register_and_formality`, `phonological_control`, `oral_fluency`, `textual_cohesion_and_coherence`

---

### Format de Sortie Strict
Renvoie UNIQUEMENT un bloc de code JSON valide au format suivant, sans aucune introduction, sans texte d'accompagnement :

```json
{
  "items": [
    {
      "stimulus_title": "string",
      "stimulus_text": "string (texte complet en Markdown)",
      "prompt": "string",
      "task_type_code": "string",
      "modality": "reading",
      "level": "A1|A2|B1|B2|C1|C2",
      "target_cefr": "A1|A2|B1|B2|C1|C2",
      "difficulty": 1,
      "cognitive_complexity": "recall_recognition|interpretation|inferencing_synthesis|critical_evaluation",
      "question_type": "single_choice",
      "response_type": "single_choice",
      "points": 1,
      "penalty_points": 0,
      "explanation": "string (justification didactique)",
      "options": [
        {
          "content": "string",
          "is_correct": false,
          "order_index": 0,
          "misconception_type": "type_de_piege",
          "distractor_rationale": "pourquoi cette option est un piège"
        },
        {
          "content": "string",
          "is_correct": true,
          "order_index": 1,
          "explanation": "pourquoi c'est la bonne réponse"
        }
      ],
      "skill_codes": ["code_competence_1", "code_competence_2"]
    }
  ]
}
```

---

### Document Brut à Traiter :
[COLLEZ VOTRE DOCUMENT BRUT ICI]
```

---

## 9. Guide d'Utilisation dans Gemini / AI Studio

### Dans Google AI Studio (Recommandé pour de grands volumes)
1. Rendez-vous sur [aistudio.google.com](https://aistudio.google.com).
2. Créez un nouveau **Chat Prompt** avec le modèle **Gemini 1.5 Pro** ou **Gemini 2.0 Flash**.
3. Réglez les hyperparamètres recommandés :
   - **Temperature** : `0.3` (favorise la rigueur grammaticale et la conformité stricte du schéma JSON).
   - **Response MIME Type** : `application/json` (force une réponse JSON syntaxiquement valide).
4. Collez l'un des prompts ci-dessus dans la boîte de dialogue et exécutez.
5. Copiez le résultat JSON produit.

### Dans Gemini Web (gemini.google.com)
1. Collez directement le prompt choisi dans la conversation.
2. Si le modèle s'arrête en cours de route (limite de tokens sur les gros lots), écrivez simplement : `Continue exactement à partir de l'élément numéro N sans répéter le début`.
3. Cliquez sur l'icône de copie du bloc de code JSON (` ```json ... ``` `).

### Import sur la plateforme TEF
1. Connectez-vous avec un compte administrateur sur la plateforme (`/login`).
2. Rendez-vous dans **Admin -> Banque de Questions** (`/admin/questions`).
3. Cliquez sur **Importer en lot** (Bulk Import).
4. Sélectionnez l'onglet **Coller du code JSON** et collez votre résultat (ou glissez votre fichier `.json`).
5. Cliquez sur **Analyser et Prévisualiser** :
   - Le tableau de prévisualisation affiche chaque type (`single_choice`, `multiple_choice`, `gap_fill`, `matching`, `ordering`), document support, et statut.
   - Les questions invalides peuvent être inspectées (détail des erreurs en cliquant sur l'insigne rouge) ou retirées d'un clic.
6. Cliquez sur **Confirmer l'import** : les questions et les documents (`Stimulus`) sont immédiatement insérés et indexés en base de données.
