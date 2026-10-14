# Prompt d'Extraction & Transformation : Documents Bruts en JSON TEF

Ce guide fournit le **prompt officiel d'extraction et de conversion** pour transformer n'importe quel document brut ou texte désorganisé contenant des questions TEF (extraits de manuels, scans OCR, épreuves blanches, annonces, articles de presse) en un fichier **JSON standardisé prêt à être importé** directement sur la plateforme (`/admin/questions` -> *Importer en lot* -> *Coller du code JSON*).

---

## 1. Le Prompt d'Extraction (Prêt à Copier-Coller)

> **Mode d'emploi** :
> 1. Copiez l'intégralité du bloc ci-dessous.
> 2. Collez-le dans **Google Gemini** ([gemini.google.com](https://gemini.google.com) ou [aistudio.google.com](https://aistudio.google.com)), **Claude** ou **ChatGPT**.
> 3. Remplacez la section `[COLLEZ VOTRE DOCUMENT BRUT ICI]` par votre texte d'examen.
> 4. Copiez le bloc JSON généré et collez-le directement dans l'outil d'import de la plateforme TEF.

````markdown
Tu es un expert psychométricien, linguiste certifié et concepteur officiel d'épreuves pour le TEF (Test d'Évaluation de Français - CCI Paris / TEF Canada / TEF IRN).

### Mission
Analyse le document brut fourni ci-dessous, découpe et structure rigoureusement chaque document support et chaque question associée, puis convertis l'ensemble en un tableau JSON strict prêt à l'import selon le schéma officiel de la plateforme TEF.

---

### Règles d'Analyse et d'Extraction

#### 1. Séparation Document Support (Stimulus) vs Question
- Pour chaque groupe de questions, identifie le texte source (carte de visite, petite annonce, courriel, article de presse, fait divers, dialogue, notice administrative).
- Stocke le texte intégral et propre du document dans `stimulus_text` (préserve les sauts de ligne réels et la mise en page).
- Donne un titre clair, concis et contextuel dans `stimulus_title` (ex: *"Carte de visite professionnelle — Mathieu Leroux"*, *"Petite annonce — Vente de réfrigérateur d'occasion"*).
- Détermine le `task_type_code` adéquat :
  - `daily_document` : cartes de visite, petites annonces, menus, horaires, courriels courts, affiches.
  - `press_article` : articles de journaux, éditoriaux, analyses de société.
  - `administrative_document` : règlements, démarches officielles, avis municipaux, formulaires.
  - `fait_divers` : récits d'événements insolites ou inattendus au passé.
  - `radio_broadcast` : chroniques radio, extraits audio retranscrits.
  - `short_announcement` : annonces sonores de gare, messages téléphoniques.

#### 2. Énoncé de la Question (`prompt`)
- Extrais l'énoncé exact posé au candidat.
- Supprime les numérotations superflues en tête d'énoncé (retire `1.`, `2.`, `Question 3 :`, etc.).
- Si l'énoncé est une phrase à compléter (ex: *"Ce document est"*, *"Le produit vendu dans cette annonce"*), conserve-la telle quelle.

#### 3. Options de Réponse & Résolution de la Bonne Réponse
- Découpe chaque option (retire les préfixes `A`, `B`, `C`, `D`, `1`, `2`, `3`, `4`).
- Assigne l'indice séquentiel `order_index` (`0` pour A, `1` pour B, `2` pour C, `3` pour D).
- **Résolution Didactique de la Bonne Réponse** :
  - Si le document source contient déjà la clé de réponse (ex: *"Corrigé : 1. B, 2. C"*), respecte-la impérativement.
  - Si aucun corrigé n'est fourni, **résous la question toi-même avec une certitude absolue** basée sur l'analyse logique et lexicale du document.
  - Marque exactement une option avec `"is_correct": true`, et les autres avec `"is_correct": false`.
- **Didactique & Pièges TEF (`misconception_type` et `distractor_rationale`)** :
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

#### 4. Cas Spécifique MAJEUR : Textes à Trous Multiples (Cloze / Multi-Gaps)
- **RÈGLE CRITIQUE D'INDIVISIBILITÉ :**
  Dans le TEF, un texte à trous peut comporter plusieurs lacunes numérotées (ex: `[1]`, `[2]`, `[3]`, `[4]` ou `(1)`, `(2)`...), et pour CHAQUE trou, 4 options (A, B, C, D) sont proposées.
  **CE DOCUMENT, L'ENSEMBLE DE SES TROUS ET TOUTES LEURS OPTIONS DOIVENT ÊTRE TRAITÉS COMME UNE SEULE ET UNIQUE QUESTION DANS `items`. NE JAMAIS DIVISER OU SCINDER LES TROUS EN QUESTIONS SÉPARÉES.**
- **Format Technique du Texte à Trous :**
  - `question_type`: `"gap_fill"`
  - `response_type`: `"gap_fill"`
  - `task_type_code`: `"text_gap"`
  - `stimulus_text`: Le texte continu intégrant les marqueurs de lacunes numérotés sous forme `[1]`, `[2]`, `[3]`, etc.
  - `prompt`: La consigne globale (ex: *"Complétez le texte en sélectionnant la bonne option pour chaque trou numéroté."*).
  - `gaps`: Le tableau exhaustif de chaque trou :
    ```json
    "gaps": [
      {
        "gap_id": "1",
        "order_index": 0,
        "cue_text": "Connecteur logique de restriction",
        "options": [
          { "content": "Néanmoins", "is_correct": true, "order_index": 0, "explanation": "Marque une restriction conforme au contexte." },
          { "content": "En conséquence", "is_correct": false, "order_index": 1, "misconception_type": "contradiction", "distractor_rationale": "Exprime une conséquence au lieu d'une opposition." },
          { "content": "De surcroît", "is_correct": false, "order_index": 2, "misconception_type": "false_friend", "distractor_rationale": "Exprime une addition." },
          { "content": "C'est pourquoi", "is_correct": false, "order_index": 3, "misconception_type": "contradiction", "distractor_rationale": "Introduit une conséquence non souhaitée." }
        ]
      }
    ]
    ```

#### 5. Calibrage Psychométrique & Taxonomie Canonique (OBLIGATOIRE)
- `modality` : `"reading"` (compréhension écrite), `"listening"` (compréhension orale), `"lexique_structure"`, `"writing"`, ou `"speaking"`.
- `level` & `target_cefr` :
  - `A1` : Documents très courts de repérage simple (cartes de visite, prix, panneaux, dates, contacts).
  - `A2` : Petites annonces simples, courriels de la vie quotidienne, horaires, instructions directes.
  - `B1` : Documents informatifs plus longs, notes de service, brèves de presse, courriers d'usagers.
  - `B2` : Articles d'analyse, argumentations, débats d'opinion, faits de société nuancés.
  - `C1`/`C2` : Textes littéraires, critiques complexes, subtilités rhétoriques ou ironiques.
- `difficulty` : Entier de `1` (très direct / explicite) à `5` (hautement inférentiel).
- `cognitive_complexity` :
  - `recall_recognition` (repérage de faits bruts explicites)
  - `interpretation` (reformulation, paraphrase, catégorisation)
  - `inferencing_synthesis` (déduction implicite, confrontation de passages)
  - `critical_evaluation` (analyse de ton, intention de communication, critique)

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
Renvoie **UNIQUEMENT** un bloc de code JSON valide au format suivant, sans aucune introduction, sans texte d'accompagnement :

```json
{
  "items": [
    {
      "stimulus_title": "string",
      "stimulus_text": "string (texte complet en Markdown, avec [1], [2] si texte à trous)",
      "prompt": "string (énoncé ou consigne générale)",
      "task_type_code": "string (ex: daily_document, press_article, text_gap)",
      "modality": "reading|listening|lexique_structure",
      "level": "A1|A2|B1|B2|C1|C2",
      "target_cefr": "A1|A2|B1|B2|C1|C2",
      "difficulty": 1,
      "cognitive_complexity": "recall_recognition|interpretation|inferencing_synthesis|critical_evaluation",
      "question_type": "single_choice|gap_fill|multiple_choice",
      "response_type": "single_choice|gap_fill|multiple_choice",
      "points": 1,
      "penalty_points": 0,
      "explanation": "string (justification didactique globale)",

      // CAS A : Pour une question standard (QCM / Choix unique) -> Renseigner 'options' et OMETTRE 'gaps'
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

      // CAS B : Pour un texte à trous multiples ('text_gap' / 'gap_fill') -> Renseigner 'gaps' et OMETTRE 'options' au niveau racine
      "gaps": [
        {
          "gap_id": "1",
          "order_index": 0,
          "cue_text": "description facultative du blanc",
          "options": [
            {
              "content": "option correcte",
              "is_correct": true,
              "order_index": 0,
              "explanation": "justification"
            },
            {
              "content": "option fausse 1",
              "is_correct": false,
              "order_index": 1,
              "misconception_type": "contradiction",
              "distractor_rationale": "explication du piège"
            },
            {
              "content": "option fausse 2",
              "is_correct": false,
              "order_index": 2,
              "misconception_type": "false_friend",
              "distractor_rationale": "explication du piège"
            },
            {
              "content": "option fausse 3",
              "is_correct": false,
              "order_index": 3,
              "misconception_type": "morphosyntax",
              "distractor_rationale": "explication du piège"
            }
          ]
        }
      ],
      "skill_codes": ["code_competence_1", "code_competence_2"]
    }
  ]
}
```
*(Remarque capitale : Pour les questions standard à choix unique ou multiple, renseignez `options` et omettez `gaps`. Pour les textes à trous multiples (`text_gap` / `gap_fill`), renseignez uniquement `gaps` (chaque trou contenant ses 4 propositions avec `is_correct`), et **ne mettez pas de champ `options` au niveau racine de la question** : la plateforme analyse directement chaque lacune à l'import).*

---

### Document Brut à Traiter :
[COLLEZ VOTRE DOCUMENT BRUT ICI]
````

---

## 2. Démonstration Concrète (Exemple Avant / Après)

### Entrée Brute Fournie

```text
MATHIEU LEROUX RESPONSABLE COMMERCIAL Agence publicité et marketing Noiret
Tél : 01 23 32 23 32 Email : mathieu.leroux@anoiret.fr Site :[agence-noiret.com](https://agence-noiret.com/)
1. Ce document est
A un carton d'invitation.
B une carte de visite.
C un faire-part.
D une publicité.
Réfrigérateur comme neuf 100€
Frigo de seconde main, 1m88 (hauteur), 60 cm (largeur), 67 cm (profondeur).
Acheté il y a un an, très peu utilisé.
Encore sous garantie pendant 1 an.
À récupérer à Ville-Marie, à Montréal.
Contact pour photos ou informations supplémentaires par e-mail ou par téléphone.
2. Le produit vendu dans cette annonce
A peut être expédié.
B est très ancien.
C est d'occasion.
D est un téléphone.
```

---

### Sortie JSON Générée (Prête à Importer)

```json
{
  "items": [
    {
      "stimulus_title": "Carte de visite professionnelle — Mathieu Leroux",
      "stimulus_text": "MATHIEU LEROUX\nRESPONSABLE COMMERCIAL\nAgence publicité et marketing Noiret\nTél : 01 23 32 23 32\nEmail : mathieu.leroux@anoiret.fr\nSite : agence-noiret.com",
      "prompt": "Ce document est",
      "task_type_code": "daily_document",
      "modality": "reading",
      "level": "A1",
      "target_cefr": "A1",
      "difficulty": 1,
      "cognitive_complexity": "recall_recognition",
      "question_type": "single_choice",
      "response_type": "single_choice",
      "points": 1,
      "penalty_points": 0,
      "explanation": "Le document présente l'identité d'un professionnel (Mathieu Leroux), sa fonction (Responsable commercial), le nom de son agence (Noiret) ainsi que l'ensemble de ses coordonnées directes (téléphone, courriel, site internet). Il s'agit des éléments constitutifs caractéristiques d'une carte de visite professionnelle.",
      "options": [
        {
          "content": "un carton d'invitation.",
          "is_correct": false,
          "order_index": 0,
          "misconception_type": "content_mismatch",
          "distractor_rationale": "Le document ne contient aucune mention d'événement, de date, d'horaire ni de formule de bienvenue propre à une invitation."
        },
        {
          "content": "une carte de visite.",
          "is_correct": true,
          "order_index": 1,
          "explanation": "Support professionnel personnel comportant le nom, le titre et les coordonnées directes de contact."
        },
        {
          "content": "un faire-part.",
          "is_correct": false,
          "order_index": 2,
          "misconception_type": "content_mismatch",
          "distractor_rationale": "Un faire-part sert à annoncer un événement d'état civil (naissance, mariage, décès), absent ici."
        },
        {
          "content": "une publicité.",
          "is_correct": false,
          "order_index": 3,
          "misconception_type": "overgeneralization",
          "distractor_rationale": "Piège par association sur le mot 'publicité' figurant dans le nom de l'agence, alors que l'objet physique est une carte nominative."
        }
      ],
      "skill_codes": ["understand_context", "locate_information"]
    },
    {
      "stimulus_title": "Petite annonce — Vente de réfrigérateur d'occasion",
      "stimulus_text": "Réfrigérateur comme neuf 100€\nFrigo de seconde main, 1m88 (hauteur), 60 cm (largeur), 67 cm (profondeur).\nAcheté il y a un an, très peu utilisé.\nEncore sous garantie pendant 1 an.\nÀ récupérer à Ville-Marie, à Montréal.\nContact pour photos ou informations supplémentaires par e-mail ou par téléphone.",
      "prompt": "Le produit vendu dans cette annonce",
      "task_type_code": "daily_document",
      "modality": "reading",
      "level": "A2",
      "target_cefr": "A2",
      "difficulty": 2,
      "cognitive_complexity": "interpretation",
      "question_type": "single_choice",
      "response_type": "single_choice",
      "points": 1,
      "penalty_points": 0,
      "explanation": "Le texte indique expressément qu'il s'agit d'un « Frigo de seconde main », ce qui constitue une paraphrase synonymique directe de « produit d'occasion ».",
      "options": [
        {
          "content": "peut être expédié.",
          "is_correct": false,
          "order_index": 0,
          "misconception_type": "contradiction",
          "distractor_rationale": "Contredit formellement la consigne « À récupérer à Ville-Marie, à Montréal », qui impose un enlèvement sur place."
        },
        {
          "content": "est très ancien.",
          "is_correct": false,
          "order_index": 1,
          "misconception_type": "contradiction",
          "distractor_rationale": "Contredit le texte qui précise que l'appareil a été « Acheté il y a un an » et est décrit « comme neuf »."
        },
        {
          "content": "est d'occasion.",
          "is_correct": true,
          "order_index": 2,
          "explanation": "« De seconde main » est synonyme exact de « d'occasion »."
        },
        {
          "content": "est un téléphone.",
          "is_correct": false,
          "order_index": 3,
          "misconception_type": "false_friend",
          "distractor_rationale": "Piège par attraction lexicale sur la mention du moyen de contact « par téléphone », alors que l'objet en vente est un frigo."
        }
      ],
      "skill_codes": ["identify_specific_detail", "paraphrase_and_synonym_recognition"]
    }
  ]
}
```

---

### Exemple 2 : Texte à Trous Multiples (Multi-Gap Cloze) — Traité comme Question Unique Indivisible

#### Entrée Brute Fournie

```text
La transition vers les mobilités douces s'accélère dans les grandes métropoles. [1], de nombreux usagers privilégient désormais le vélo pour leurs trajets domicile-travail. Cette évolution a été [2] par la multiplication des pistes cyclables sécurisées. Cependant, certains commerçants redoutent que la piétonnisation du centre-ville ne vienne [3] leur chiffre d'affaires. La municipalité a donc mis en place des mesures d'accompagnement afin de [4] leurs inquiétudes.

Trou [1] :
A En effet
B Néanmoins
C Par conséquent
D Bien que

Trou [2] :
A retardée
B facilitée
C contestée
D négligée

Trou [3] :
A affecter
B stimuler
C maintenir
D ignorer

Trou [4] :
A accentuer
B dissiper
C prolonger
D aggraver

Corrigé : 1. A, 2. B, 3. A, 4. B
```

---

#### Sortie JSON Générée (Prête à Importer)

> **Règle capitale** : Tout le texte et les 4 trous forment **UN SEUL OBJET** dans `items`. Ils ne sont **JAMAIS** divisés en 4 questions distinctes.

```json
{
  "items": [
    {
      "stimulus_title": "Mobilités douces en milieu urbain — Texte à trous",
      "stimulus_text": "La transition vers les mobilités douces s'accélère dans les grandes métropoles. [1], de nombreux usagers privilégient désormais le vélo pour leurs trajets domicile-travail. Cette évolution a été [2] par la multiplication des pistes cyclables sécurisées. Cependant, certains commerçants redoutent que la piétonnisation du centre-ville ne vienne [3] leur chiffre d'affaires. La municipalité a donc mis en place des mesures d'accompagnement afin de [4] leurs inquiétudes.",
      "prompt": "Complétez le texte ci-dessus en choisissant la réponse appropriée pour chaque trou numéroté.",
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
      "explanation": "Ce texte à trous évalue la cohésion textuelle et la précision lexicale : [1] 'En effet' illustre l'accélération annoncée ; [2] 'facilitée' est le seul participe passé cohérent avec l'aménagement favorable ; [3] 'affecter' exprime la crainte d'un impact négatif ; [4] 'dissiper' forme la collocation adéquate avec 'inquiétudes'.",
      "gaps": [
        {
          "gap_id": "1",
          "order_index": 0,
          "cue_text": "Connecteur logique d'illustration / confirmation",
          "options": [
            {
              "content": "En effet",
              "is_correct": true,
              "order_index": 0,
              "explanation": "Introduit la preuve factuelle de l'accélération mentionnée dans la première phrase."
            },
            {
              "content": "Néanmoins",
              "is_correct": false,
              "order_index": 1,
              "misconception_type": "contradiction",
              "distractor_rationale": "Exprime une opposition illogique avec l'idée d'accélération."
            },
            {
              "content": "Par conséquent",
              "is_correct": false,
              "order_index": 2,
              "misconception_type": "false_friend",
              "distractor_rationale": "Marque une déduction plutôt qu'une illustration explicative."
            },
            {
              "content": "Bien que",
              "is_correct": false,
              "order_index": 3,
              "misconception_type": "morphosyntax",
              "distractor_rationale": "Conjonction de subordination exigeant le subjonctif et non une virgule en tête de proposition indépendante."
            }
          ]
        },
        {
          "gap_id": "2",
          "order_index": 1,
          "cue_text": "Participe passé / cause favorable",
          "options": [
            {
              "content": "retardée",
              "is_correct": false,
              "order_index": 0,
              "misconception_type": "contradiction",
              "distractor_rationale": "Contredit le rôle incitatif des pistes cyclables."
            },
            {
              "content": "facilitée",
              "is_correct": true,
              "order_index": 1,
              "explanation": "Indique logiquement l'impact positif de l'aménagement des pistes cyclables."
            },
            {
              "content": "contestée",
              "is_correct": false,
              "order_index": 2,
              "misconception_type": "literal_interpretation",
              "distractor_rationale": "Incohérent avec l'esprit d'accompagnement de la mesure."
            },
            {
              "content": "négligée",
              "is_correct": false,
              "order_index": 3,
              "misconception_type": "contradiction",
              "distractor_rationale": "Sens opposé à la dynamique d'essor décrite."
            }
          ]
        },
        {
          "gap_id": "3",
          "order_index": 2,
          "cue_text": "Verbe infinitif de risque",
          "options": [
            {
              "content": "affecter",
              "is_correct": true,
              "order_index": 0,
              "explanation": "Exprime la crainte d'un impact négatif sur l'activité commerciale."
            },
            {
              "content": "stimuler",
              "is_correct": false,
              "order_index": 1,
              "misconception_type": "contradiction",
              "distractor_rationale": "Un commerçant ne 'redoute' pas une stimulation de son chiffre d'affaires."
            },
            {
              "content": "maintenir",
              "is_correct": false,
              "order_index": 2,
              "misconception_type": "false_friend",
              "distractor_rationale": "Sens neutre incompatible avec le verbe 'redouter'."
            },
            {
              "content": "ignorer",
              "is_correct": false,
              "order_index": 3,
              "misconception_type": "literal_interpretation",
              "distractor_rationale": "Incompatible sémantiquement avec 'chiffre d'affaires'."
            }
          ]
        },
        {
          "gap_id": "4",
          "order_index": 3,
          "cue_text": "Collocation verbale avec 'inquiétudes'",
          "options": [
            {
              "content": "accentuer",
              "is_correct": false,
              "order_index": 0,
              "misconception_type": "contradiction",
              "distractor_rationale": "Des mesures d'accompagnement visent à apaiser, non à accentuer l'angoisse."
            },
            {
              "content": "dissiper",
              "is_correct": true,
              "order_index": 1,
              "explanation": "'Dissiper les inquiétudes' est la collocation consacrée pour apaiser des craintes."
            },
            {
              "content": "prolonger",
              "is_correct": false,
              "order_index": 2,
              "misconception_type": "contradiction",
              "distractor_rationale": "Contraire à l'objectif des mesures d'accompagnement municipal."
            },
            {
              "content": "aggraver",
              "is_correct": false,
              "order_index": 3,
              "misconception_type": "contradiction",
              "distractor_rationale": "Opposé au rôle bienveillant de la collectivité."
            }
          ]
        }
      ],
      "skill_codes": ["discourse_connectors", "vocabulary_in_context"]
    }
  ]
}
```

---

## 3. Comment Importer ce Résultat sur la Plateforme TEF

1. **Copiez** le bloc JSON obtenu ci-dessus.
2. Rendez-vous sur la plateforme dans **Admin -> Banque de Questions** (`/admin/questions`).
3. Cliquez sur le bouton **« Importer en lot »** en haut à droite.
4. Cliquez sur l'onglet **« Coller du code JSON »**.
5. Collez votre code JSON dans la zone de texte.
6. Cliquez sur **« Analyser le JSON »** :
   - Le système valide instantanément la conformité de chaque question.
   - Les documents supports (`Stimulus`), énoncés, options et compétences sont immédiatement reconnus.
7. Cliquez sur **« Confirmer l'import »** : les questions et leurs documents sont créés et indexés en base de données avec statut de conformité immédiat !
