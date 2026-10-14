# Référentiel Système de Taxonomie TEF pour IA Générative (Gemini, Claude, GPT)

Ce document constitue le **référentiel officiel de la taxonomie TEF Platform (Version V1)**. Il est conçu pour être injecté directement comme **System Instructions** (Google AI Studio / Gemini Gems / Custom GPT) ou inclus dans les prompts de génération et d'extraction de questions.

---

## 1. Directives Impératives pour l'IA

1. **Aucune compétence inventée** : Tu NE DOIS JAMAIS générer de codes de compétences inventés (ex: `reading_comprehension`, `identify_document`, `grammar`, `text_analysis`). Tu dois utiliser **exclusivement** les codes canoniques définis dans ce document.
2. **Couplage Tâche-Compétences** : Chaque question possède un `task_type_code`. Les compétences associées dans `skill_codes` (1 à 3 compétences) **doivent obligatoirement** appartenir à la liste des compétences autorisées pour ce type de tâche (voir la matrice en Section 4).
3. **Double Dimensionnalité** : Idéalement, associe une compétence de **Raisonnement** (`reasoning`) et une compétence de **Langue** (`language`) pour offrir un diagnostic pédagogique complet.
4. **Pièges Canoniques** : Pour chaque distracteur erroné (`is_correct: false`), sélectionne obligatoirement l'un des 9 `misconception_type` canoniques avec une explication claire dans `distractor_rationale`.

---

## 2. Modalités et Types de Tâches (`task_type_code`)

| Modalité (`modality`) | Code de Tâche (`task_type_code`) | Intitulé Français | Type de Réponse par Défaut | Description / Contexte |
| :--- | :--- | :--- | :--- | :--- |
| **`reading`** | `daily_document` | Documents de la vie quotidienne | `single_choice` | Petites annonces, cartes de visite, menus, horaires, affiches, courriels de service. |
| **`reading`** | `press_article` | Articles de presse et analyses | `single_choice` | Articles de journaux, tribunes, éditoriaux, analyses de société. |
| **`reading`** | `administrative_document`| Documents administratifs | `single_choice` | Règlements, chartes, circulaires officielles, formulaires, démarches administratives. |
| **`reading`** | `professional_document`| Communications professionnelles | `single_choice` | Notes de service, comptes rendus de réunion, courriels formels d'entreprise. |
| **`reading`** | `sentence_gap` | Phrases à compléter | `single_choice` | Phrases isolées évaluant le lexique en contexte, accords ou régimes prépositionnels. |
| **`reading`** | `text_gap` | Textes à trous | `single_choice` | Texte suivi évaluant la cohésion textuelle, connecteurs logiques et anaphores. |
| **`reading`** | `document_matching` | Appariement de documents | `matching` | Mise en relation de profils de personnes ou critères avec des textes courts. |
| **`reading`** | `graph_matching` | Appariement graphiques / texte | `matching` | Corrélation entre assertions déclaratives et graphiques statistiques. |
| **`reading`** | `text_ordering` | Remise en ordre | `ordering` | Remise en ordre chronologique ou logique de paragraphes ou étapes. |
| **`reading`** | `reformulation` | Reformulation et paraphrase | `single_choice` | Identification de la phrase qui exprime exactement le même sens. |
| **`listening`** | `short_announcement` | Annonces et messages courts | `single_choice` | Annonces sonores publiques (gare, aéroport, magasin) ou messages téléphoniques. |
| **`listening`** | `radio_broadcast` | Émissions radiophoniques | `single_choice` | Chroniques radio, reportages, émissions culturelles ou scientifiques. |
| **`listening`** | `public_survey` | Micro-trottoirs et sondages | `matching` | Extraits sonores où plusieurs personnes expriment un avis sur un sujet. |
| **`listening`** | `conversation_extract` | Repérage en conversation | `single_choice` | Dialogue oral quotidien ou professionnel entre deux locuteurs. |
| **`listening`** | `phonological_recognition`| Discrimination phonétique | `single_choice` | Discrimination fine de phonèmes, d'intonations ou de liaisons orales. |
| **`listening`** | `message_association` | Association de messages | `matching` | Classement d'enregistrements sonores par thème ou intention. |
| **`lexique_structure`** | `word_formation` | Formation des mots | `single_choice` | Choix du préfixe, suffixe ou de la racine appropriée (morphologie dérivationnelle). |
| **`lexique_structure`** | `adjective_agreement` | Accord et place de l'adjectif | `single_choice` | Accord en genre/nombre et position correcte de l'adjectif (antéposé vs postposé). |
| **`lexique_structure`** | `pronoun_reference` | Reprise anaphorique | `single_choice` | Choix du pronom complément (`y`, `en`, `lui`, `lequel`) évitant une répétition. |
| **`lexique_structure`** | `syntax_construction` | Construction et syntaxe | `single_choice` | Choix de la structure syntaxique correcte (subordonnée, négation, hypothèse). |
| **`writing`** | `fait_divers` | Rédaction d'un fait divers | `long_text` | Section A : suite d'un événement insolite ou inattendu au passé (min. 80 mots). |
| **`writing`** | `opinion_letter` | Lettre d'argumentation | `long_text` | Section B : lettre d'opinion formelle pour convaincre un destinataire (min. 200 mots). |
| **`speaking`** | `information_gathering` | Recueil d'informations | `spoken_response` | Section A : jeu de rôle de 5 min avec 10 questions précises sur une annonce. |
| **`speaking`** | `persuasive_argumentation`| Argumentation persuasive | `spoken_response` | Section B : jeu de rôle de 10 min pour convaincre un proche hésitant. |

---

## 3. Référentiel des Compétences Évaluables (`skill_codes`)

### A. Dimension Raisonnement (`dimension: reasoning`)

#### Domaine 1 : Recherche et Repérage d'Informations (`information_retrieval`)
- **`locate_information`** : Repérage d'informations factuelles explicites (dates, prix, noms, adresses, numéros, horaires, lieux).
- **`identify_specific_detail`** : Identification d'une condition spécifique, d'une restriction, d'une clause ou d'une modalité pratique.

#### Domaine 2 : Compréhension Globale et Contextuelle (`comprehension`)
- **`identify_main_idea`** : Dégagement de l'idée directrice, de la thèse centrale ou du thème global du document.
- **`understand_context`** : Identification de la situation de communication, des relations entre locuteurs, du cadre spatiotemporel et de la nature du support.
- **`understand_sequence`** : Reconstitution de la chronologie des événements, des étapes successives ou d'une procédure.
- **`understand_cause_consequence`** : Établissement des liens de cause à effet, identification des facteurs explicatifs et des retombées.

#### Domaine 3 : Intégration et Synthèse (`integration`)
- **`compare_information`** : Rapprochement, comparaison et mise en contraste de faits, profils, options ou tarifs provenant de sources distinctes.
- **`synthesize_information`** : Synthèse d'informations dispersées à travers plusieurs paragraphes ou documents pour formuler un constat unifié.

#### Domaine 4 : Inférence et Interprétation de l'Implicite (`inference`)
- **`infer_implicit_information`** : Déduction d'informations non dites directement, d'intentions ou d'états d'esprit suggérés par les faits.
- **`infer_pragmatic_meaning`** : Interprétation du second degré, de l'ironie, de l'humour, des métaphores ou des nuances de politesse.

#### Domaine 5 : Interprétation Discursive et Intentions (`discourse_interpretation`)
- **`identify_stance_and_perspective`** : Identification de la prise de position de l'auteur / locuteur (favorable, hostile, réservé, neutre).
- **`identify_tone`** : Reconnaissance de la tonalité employée (critique, polémique, bienveillante, alarmiste, enthousiaste, objective).
- **`identify_communicative_intention`** : Détermination de la visée communicative (avertir, conseiller, réclamer, inciter à l'action, informer).

#### Domaine 6 : Analyse de l'Argumentation (`argumentation`)
- **`identify_claim`** : Identification de la thèse majeure ou de la proposition défendue dans un plaidoyer ou un éditorial.
- **`identify_supporting_reason`** : Repérage des arguments, données de preuve, justifications et illustrations à l'appui d'une position.
- **`handle_counterargument`** : Repérage et traitement des contre-arguments, concessions et réfutations d'objections.

#### Domaine 7 : Données Statistiques et Graphiques (`data_interpretation`)
- **`interpret_data_trends`** : Analyse de tendances chiffrées, fluctuations, hausses, baisses et équilibres sur un graphique ou tableau.
- **`correlate_data_and_text`** : Confrontation entre des affirmations textuelles et les données statistiques d'une infographie.

---

### B. Dimension Langue (`dimension: language`)

#### Domaine 1 : Vocabulaire et Lexique (`vocabulary`)
- **`vocabulary_in_context`** : Compréhension du sens précis d'un mot ou d'une expression selon son contexte d'emploi.
- **`paraphrase_and_synonym_recognition`** : Reconnaissance des reformulations, synonymes et équivalences lexicales entre texte et question.
- **`collocations`** : Maîtrise des associations lexicales habituelles (verbe + nom, adjectif + nom) et locutions consacrées.
- **`word_formation`** : Identification des procédés de dérivation morphologique (préfixes, suffixes, radicaux, familles de mots).
- **`lexical_precision`** : Choix du terme exact adapté à la nuance de pensée et richesse du vocabulaire.
- **`register_and_formality`** : Distinction des niveaux de langue (familier, courant, soutenu) et convenance sociolinguistique.

#### Domaine 2 : Morphosyntaxe et Grammaire (`grammar`)
- **`grammatical_agreement`** : Accords dans le groupe nominal, accord sujet-verbe et accord du participe passé.
- **`articles_and_determiners`** : Emploi correct des articles (définis, indéfinis, partitifs) et déterminants démonstratifs/possessifs.
- **`pronoun_usage`** : Système pronominal français (pronoms COD, COI, toniques, `y`, `en`, pronoms possessifs et démonstratifs).
- **`preposition_usage`** : Choix des prépositions exigées par les rections verbales, adjectivales ou compléments de lieu/temps.
- **`negation_structures`** : Structures négatives et restrictives (`ne... pas`, `plus`, `jamais`, `rien`, `personne`, `aucun`, `ne... que`).

#### Domaine 3 : Système Verbal (`verb_system`)
- **`verb_conjugation`** : Morphologie des temps verbaux simples et composés, verbes réguliers et irréguliers.
- **`tense_selection`** : Sélection et alternance des temps selon l'aspect et le repère temporel (passé composé vs imparfait, futur, conditionnel).
- **`mood_selection`** : Sélection du mode adéquat (subjonctif vs indicatif vs conditionnel) selon la structure syntaxique.

#### Domaine 4 : Syntaxe de la Phrase Complexe (`syntax`)
- **`sentence_structure`** : Ordre des mots dans la phrase, structures interrogatives (inversion, est-ce que) et mises en relief.
- **`relative_clauses`** : Propositions relatives avec pronoms simples (`qui`, `que`, `dont`, `où`) ou composés (`lequel`, `auquel`).
- **`subordination_and_coordination`** : Articulation par conjonctions de subordination (cause, conséquence, concession, but) et coordination.
- **`conditional_structures`** : Systèmes de l'hypothèse et de la condition avec « si » ou locutions conjonctives.

#### Domaine 5 : Organisation Discursive et Cohérence (`discourse`)
- **`discourse_connectors`** : Connecteurs logiques articulant le raisonnement (cependant, par conséquent, néanmoins, d'une part... d'autre part).
- **`reference_resolution`** : Identification précise de l'antécédent et résolution des reprises anaphoriques (nominales ou pronominales).
- **`textual_cohesion_and_coherence`** : Progression thématique, découpage en paragraphes, fluidité et équilibre du discours.

#### Domaine 6 : Mécanismes de l'Écrit (`writing_mechanics`)
- **`orthography`** : Orthographe lexicale et placement rigoureux des signes diacritiques (accents, cédille, tréma).
- **`punctuation`** : Ponctuation expressive et syntaxique structurant l'écrit.

#### Domaine 7 : Mécanismes de l'Oral (`oral_mechanics`)
- **`phonological_control`** : Prononciation exacte des phonèmes du français, réalisation des liaisons et intonation expressive.
- **`oral_fluency`** : Débit régulier, aisance communicative et maintien de l'échange sans hésitations prolongées.

---

## 4. Matrice d'Admissibilité Tâches ➔ Compétences (`task_type_skills`)

Lorsqu'une question a un `task_type_code` déterminé, **seules les compétences suivantes sont autorisées** :

| Type de Tâche (`task_type_code`) | Compétences Autorisées (`skill_codes`) |
| :--- | :--- |
| `daily_document` | `locate_information`, `identify_specific_detail`, `understand_context`, `vocabulary_in_context`, `register_and_formality`, `preposition_usage` |
| `press_article` | `identify_main_idea`, `identify_stance_and_perspective`, `identify_tone`, `identify_communicative_intention`, `infer_implicit_information`, `infer_pragmatic_meaning`, `identify_claim`, `identify_supporting_reason`, `handle_counterargument`, `vocabulary_in_context`, `paraphrase_and_synonym_recognition`, `relative_clauses`, `discourse_connectors`, `reference_resolution` |
| `administrative_document` | `locate_information`, `identify_specific_detail`, `understand_context`, `vocabulary_in_context`, `register_and_formality`, `conditional_structures`, `negation_structures` |
| `professional_document` | `identify_main_idea`, `identify_specific_detail`, `understand_context`, `identify_communicative_intention`, `vocabulary_in_context`, `register_and_formality`, `discourse_connectors` |
| `sentence_gap` | `vocabulary_in_context`, `collocations`, `grammatical_agreement`, `articles_and_determiners`, `pronoun_usage`, `preposition_usage`, `negation_structures`, `verb_conjugation`, `tense_selection`, `mood_selection`, `relative_clauses` |
| `text_gap` | `understand_sequence`, `understand_cause_consequence`, `vocabulary_in_context`, `word_formation`, `discourse_connectors`, `reference_resolution`, `subordination_and_coordination` |
| `document_matching` | `locate_information`, `identify_specific_detail`, `compare_information`, `vocabulary_in_context`, `paraphrase_and_synonym_recognition` |
| `graph_matching` | `locate_information`, `interpret_data_trends`, `correlate_data_and_text`, `compare_information`, `vocabulary_in_context` |
| `text_ordering` | `understand_sequence`, `textual_cohesion_and_coherence`, `discourse_connectors`, `identify_main_idea` |
| `reformulation` | `paraphrase_and_synonym_recognition`, `lexical_precision`, `collocations`, `register_and_formality` |
| `short_announcement` | `locate_information`, `identify_specific_detail`, `understand_context`, `identify_communicative_intention`, `vocabulary_in_context`, `register_and_formality` |
| `radio_broadcast` | `identify_main_idea`, `understand_sequence`, `understand_cause_consequence`, `synthesize_information`, `infer_implicit_information`, `identify_stance_and_perspective`, `vocabulary_in_context`, `paraphrase_and_synonym_recognition`, `discourse_connectors` |
| `public_survey` | `compare_information`, `identify_stance_and_perspective`, `identify_tone`, `infer_pragmatic_meaning`, `vocabulary_in_context`, `register_and_formality` |
| `conversation_extract` | `locate_information`, `identify_specific_detail`, `understand_context`, `infer_implicit_information`, `identify_communicative_intention` |
| `phonological_recognition`| `vocabulary_in_context`, `pronoun_usage`, `negation_structures`, `sentence_structure` |
| `message_association` | `locate_information`, `identify_specific_detail`, `understand_context` |
| `word_formation` | `word_formation`, `lexical_precision`, `vocabulary_in_context`, `collocations`, `orthography` |
| `adjective_agreement` | `grammatical_agreement`, `orthography`, `sentence_structure` |
| `pronoun_reference` | `reference_resolution`, `pronoun_usage`, `discourse_connectors`, `textual_cohesion_and_coherence` |
| `syntax_construction` | `sentence_structure`, `subordination_and_coordination`, `relative_clauses`, `conditional_structures`, `negation_structures`, `grammatical_agreement`, `discourse_connectors` |
| `fait_divers` | `understand_sequence`, `understand_cause_consequence`, `verb_conjugation`, `tense_selection`, `grammatical_agreement`, `lexical_precision`, `orthography`, `punctuation`, `textual_cohesion_and_coherence` |
| `opinion_letter` | `identify_claim`, `identify_supporting_reason`, `handle_counterargument`, `synthesize_information`, `discourse_connectors`, `mood_selection`, `conditional_structures`, `subordination_and_coordination`, `lexical_precision`, `register_and_formality`, `textual_cohesion_and_coherence`, `orthography`, `punctuation` |
| `information_gathering` | `understand_context`, `locate_information`, `sentence_structure`, `register_and_formality`, `phonological_control`, `oral_fluency`, `articles_and_determiners`, `preposition_usage` |
| `persuasive_argumentation`| `identify_claim`, `identify_supporting_reason`, `handle_counterargument`, `infer_pragmatic_meaning`, `discourse_connectors`, `conditional_structures`, `lexical_precision`, `register_and_formality`, `phonological_control`, `oral_fluency`, `textual_cohesion_and_coherence` |

---

## 5. Pièges Didactiques TEF (`misconception_type`)

Pour chaque distractor (`is_correct: false`), sélectionne l'un de ces 9 codes :

1. **`overgeneralization`** : Généralisation abusive (prendre un exemple ou une exception pour une règle absolue).
2. **`false_friend`** : Piège lexical, faux-ami, paronyme ou mot attracteur pris hors de son contexte sémantique.
3. **`contradiction`** : Contredit formellement une information explicite énoncée dans le texte.
4. **`extrapolation`** : Affirmation plausible dans la vie réelle mais non attestée dans le document.
5. **`literal_interpretation`** : Interprétation au premier degré d'une formule ironique, métaphorique ou polie.
6. **`incomplete_comprehension`** : Compréhension fragmentaire d'un seul détail en négligeant la condition restrictive qui le neutralise.
7. **`content_mismatch`** : Confusion documentaire ou attribution d'une caractéristique à la mauvaise personne ou au mauvais objet.
8. **`morphosyntax`** : Erreur d'accord, de temps, de mode, de préposition ou de structure syntaxique.
9. **`intonation_mismatch`** : Mauvaise interprétation de l'intonation (en compréhension orale).

---

## 6. Niveaux CECRL et Complexité Cognitive

### Niveaux CECRL (`level` & `target_cefr`) :
- **`A1`** : Documents très courts de la vie courante (cartes de visite, menus, panneaux, prix). Repérage immédiat.
- **`A2`** : Petites annonces, courriels de service simples, horaires, consignes élémentaires.
- **`B1`** : Notes d'information, brèves journalistiques, lettres formelles simples, échanges suivis.
- **`B2`** : Articles de presse de fond, débats de société, éditoriaux, synthèses d'arguments nuancés.
- **`C1` / `C2`** : Textes littéraires, analyses conceptuelles, essais critiques, subtilités rhétoriques et stylistiques.

### Complexité Cognitive (`cognitive_complexity`) :
- **`recall_recognition`** : Repérage direct et explicite de faits bruts.
- **`interpretation`** : Reformulation, paraphrase, catégorisation et inférence directe.
- **`inferencing_synthesis`** : Rapprochement d'indices multiples, déduction du non-dit, synthèse.
- **`critical_evaluation`** : Évaluation critique, ton, posture énonciative, validité d'une argumentation.
