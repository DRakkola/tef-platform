# Dictionnaire des Métriques & Définitions Produit (TEF Canada)

Ce document établit la terminologie officielle, les formules mathématiques et les critères d'attribution pour tous les indicateurs clés de performance (KPI) de la plateforme.

---

## 1. L'Entonnoir de Conversion Étudiant (11 Étapes)

L'entonnoir retrace le parcours complet de l'apprenant, depuis sa première visite jusqu'à la monétisation et la fidélisation pérenne :

| Étape | Clé d'Événement | Description / Condition d'Exécution |
| :--- | :--- | :--- |
| **1. Visiteur** | `page_view` (path = `/`) | Visite de la page d'accueil ou de la landing page (session anonyme ou authentifiée). |
| **2. Inscription** | `auth_registered` | Création d'un compte utilisateur (`User` avec rôle `student`). |
| **3. Onboarding Terminé** | `onboarding_completed` | Validation des 4 étapes du questionnaire initial (objectifs NCLC, date cible, auto-évaluation). |
| **4. Diagnostic Démarré** | `assessment_started` (is_diagnostic = true) | Lancement de la première session d'évaluation diagnostique adaptative. |
| **5. Diagnostic Terminé** | `assessment_completed` | Remise et notation complète du test diagnostique avec génération du profil de compétences. |
| **6. Recommandations Vues** | `recommendations_viewed` | Consultation du plan d'entraînement individualisé généré par le moteur d'apprentissage. |
| **7. Premier Exercice Réalisé** | `exercise_completed` (count = 1) | **Jalon d'Activation Produit** : première session d'entraînement autonome validée. |
| **8. Rétention D1+ Active** | `retention_d1_active` | Retour sur la plateforme et complétion d'au moins une activité pédagogique 24h à 7j après l'inscription. |
| **9. Paywall Consulté** | `billing_paywall_viewed` | Affichage de la grille tarifaire (packs de crédits ou abonnements mensuels). |
| **10. Checkout Initié** | `checkout_started` | Ouverture du formulaire de paiement sécurisé pour un pack ou un abonnement. |
| **11. Achat Finalisé** | `order_completed` / `subscription_created` | Transaction bancaire confirmée et droits crédités sur le compte étudiant. |

### Taux de Conversion d'Étape à Étape
$$\text{Conversion}_{i \to i+1} = \frac{\text{Utilisateurs Uniques ayant atteint l'étape } i+1}{\text{Utilisateurs Uniques ayant atteint l'étape } i} \times 100$$

---

## 2. Métriques d'Activation et de Rétention

### Utilisateur Actif (AU - Active User)
Un utilisateur est considéré comme **actif** sur une période donnée $T$ s'il a réalisé au moins **une action d'apprentissage qualifiée** :
- Complétion d'un exercice ou d'une section d'examen (`assessment_completed`, `exercise_completed`)
- Soumission d'une rédaction écrite pour correction (`writing_submitted`)
- Enregistrement d'un entraînement oral (`speaking_attempt_recorded`)
- Session de simulation peer-to-peer en Practice Pool (`practice_pool_joined`)

*Note : La simple connexion ou la consultation passive du tableau de bord ne qualifie pas un utilisateur comme actif pédagogique.*

### Taux d'Activation Étudiant (Activation Rate)
$$\text{Taux d'Activation} = \frac{\text{Étudiants ayant complété le premier exercice ou diagnostic sous 7 jours}}{\text{Total des nouveaux étudiants inscrits sur la période}} \times 100$$

### Analyse par Cohortes de Rétention (D1, D7, D14, D30)
Pour une cohorte d'utilisateurs inscrits au cours de la semaine $W_0$ :
- **Rétention D1** : $\%$ d'utilisateurs actifs à $J+1$ (fenêtre $[24\text{h}, 48\text{h}]$).
- **Rétention D7** : $\%$ d'utilisateurs actifs au cours des jours $[7, 13]$.
- **Rétention D14** : $\%$ d'utilisateurs actifs au cours des jours $[14, 20]$.
- **Rétention D30** : $\%$ d'utilisateurs actifs au cours des jours $[30, 36]$.

---

## 3. Métriques Pédagogiques & Progression

### Distribution des Scores NCLC (Niveaux de Compétence Linguistique Canadiens)
- Évaluation standardisée sur l'échelle officielle CLB / NCLC (Niveau 1 à 12).
- Cible TEF Canada requise pour la résidence permanente (Entrée Express) : **NCLC 7** (niveau B2 avancé) dans les 4 épreuves :
  - Compréhension Écrite (CE) : score $\ge 463$
  - Compréhension Orale (CO) : score $\ge 458$
  - Expression Écrite (EE) : score $\ge 371$
  - Expression Orale (EO) : score $\ge 371$

### Compétence Bloquante (Blocking Skill)
Une compétence est qualifiée de **bloquante** pour un étudiant ou une cohorte lorsque :
1. Le score estimé est strictement inférieur au seuil cible (ex: NCLC 7).
2. Le taux d'échec sur les exercices ciblés dépasse 45% sur plus de 3 tentatives successives.
3. Le ratio de temps passé par rapport au temps de référence dépasse $1.5\times$.

---

## 4. Métriques Financières & Marketplace Enseignants

### Volume d'Affaires Brut (GMV - Gross Merchandise Value)
Somme totale facturée aux étudiants en euros (€) :
$$\text{GMV} = \sum \text{Montant TTC des commandes finalisées (crédits + abonnements + réservations)}$$

### Commission Plateforme & Revenu Net
- **Taux de Commission Enseignant** : 15% à 20% prélevé sur les réservations de cours particuliers et les corrections certifiées.
- **Revenu Plateforme** : 100% des abonnements SaaS + 100% des packs de crédits IA + Commission sur la marketplace tuteurs.

### Performance Tuteurs
- **Taux d'Utilisation des Créneaux** : $\frac{\text{Créneaux Réservés}}{\text{Créneaux Disponibles Publiés}} \times 100$
- **Délai de Correction (Turnaround Time - TAT)** : Médiane en heures entre la soumission d'un devoir étudiant et la remise du feedback noté par le tuteur. Objectif opérationnel : $< 24\text{h}$.
- **Taux de Non-Présentation (No-Show Rate)** : Pourcentage de sessions réservées où soit l'enseignant, soit l'étudiant ne se présente pas.

---

## 5. Métriques IA et Consommation Énergétique / Coût

Pour chaque appel aux LLM (évaluation de rédaction, simulation de jury oral, génération d'exercices adaptatifs) :

### Formule de Coût Unitaire Estimé
$$\text{Coût} = \frac{\text{Prompt Tokens} \times \text{Prix Entrée}}{1\,000\,000} + \frac{\text{Completion Tokens} \times \text{Prix Sortie}}{1\,000\,000}$$

Barème de référence (USD converti en EUR à parité) :
- Modèle Standard (ex: GPT-4o-mini / Gemini Flash) : \$0.15 / 1M input, \$0.60 / 1M output
- Modèle Avancé (ex: GPT-4o / Claude 3.5 Sonnet) : \$3.00 / 1M input, \$15.00 / 1M output

### Coût IA Moyen par Étudiant Actif (AI Cost per Active User)
$$\text{Coût IA / Étudiant} = \frac{\sum \text{Coûts IA réels sur la période}}{\text{Nombre d'Étudiants Actifs sur la période}}$$

---

## 6. Règle de Robustesse Statistique : "Données Insuffisantes"

> [!IMPORTANT]
> **Règle d'Or Opérationnelle** :
> Tout indicateur calculé sur une taille d'échantillon $N < 30$ individus (ou moins de 100 événements pour un test A/B) doit obligatoirement afficher la mention **« Données insuffisantes pour établir une significativité statistique »**.
> Aucune décision de coupure, de pivot produit ou d'ajustement tarifaire ne peut être validée sur des échantillons sous ce seuil critique.
