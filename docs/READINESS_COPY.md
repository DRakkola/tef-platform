# UX Copy & Terminology Guidelines: TEF Readiness Engine

## 1. Compliance Standard

The TEF Canada preparation platform provides pedagogical estimation and adaptive training.
All product surfaces, marketing pages, student dashboards, and teacher portals must strictly follow these copy standards to ensure educational integrity and avoid misleading claims.

---

## 2. Approved UX Terminology

### French (Primary UI Language)
| Concept | Approved Terminology | Usage Context |
| :--- | :--- | :--- |
| **System Identity** | *Estimation de préparation TEF* | Headers, subheaders, page titles |
| **Current Level** | *Niveau estimé*, *Performance estimée* | Score badges, metrics cards |
| **Deficit to Goal** | *Écart à la cible*, *Points à consolider* | Target gap tables, progress bars |
| **Confidence** | *Indice de confiance* (*Faible*, *Moyenne*, *Élevée*) | Data reliability indicators |
| **Competencies** | *Profil de compétences*, *Compétences cœur* | Reading, Listening, Writing, Speaking breakdown |
| **Limiting Factors** | *Facteurs limitants*, *Compétences bloquantes* | High-priority remedial alerts |
| **Daily Plan** | *Plan quotidien adaptatif*, *Que faire aujourd'hui ?* | Time-budgeted activity recommendations |
| **Readiness Bands** | *Données insuffisantes*, *En développement*, *En progression*, *Proche de la cible*, *Conforme à la cible* | Global readiness status |

### English (Translations & Documentation)
| Approved Terminology | Avoid / Forbidden Replacement |
| :--- | :--- |
| `readiness estimate` | `official score`, `exam result`, `TEF certificate` |
| `estimated performance` | `actual test score`, `certified level` |
| `target gap` | `failure points`, `missing score` |
| `confidence index` | `probability of passing`, `certainty rate` |
| `blocking skills` / `limiting factors` | `fatal errors`, `failed modules` |
| `diagnostic assessment` | `real TEF test`, `official exam session` |

---

## 3. Strictly Forbidden Claims & Prohibited Phrasing

The following terms and patterns are **strictly prohibited** across all codebase strings, documentation, and user interfaces:

1. **Unsupported Certainty & Pass Guarantees**:
   * ❌ *"95% chance of passing the TEF"*
   * ❌ *"Garantie d'obtention du NCLC 7"*
   * ❌ *"Réussite assurée au TEF Canada"*
   * ❌ *"You will pass with this score"*

2. **Official Accreditation Claims**:
   * ❌ *"Calculateur officiel du score TEF"*
   * ❌ *"Certificat TEF officiel"*
   * ❌ *"Partenaire officiel CCI Paris pour la notation"*
   * ❌ *"Attestation de niveau TEF reconnue par IRCC"*

3. **Manufactured Estimates with Insufficient Evidence**:
   * ❌ Displaying a definitive CEFR or NCLC estimate when fewer than 2 core skills have been observed.
   * ❌ Presenting high confidence with uncalibrated single-attempt data.

---

## 4. Mandatory Disclaimers

### Universal Banner Disclaimer
Every view presenting estimated levels, readiness scores, or CEFR/NCLC equivalences must display the following notice:

> **Notice d'estimation pédagogique** :
> *Ce système fournit une estimation mathématique de préparation basée sur vos observations récentes. Il ne constitue pas un certificat officiel du TEF ni une garantie de résultat lors de l'examen officiel administré par la Chambre de Commerce et d'Industrie de Paris (CCI).*

### Shorthand Component Badge / Tooltip
For compact card headers and badges where the full notice cannot fit:
> *Estimation indicative interne (hors valeur certificative officielle).*
