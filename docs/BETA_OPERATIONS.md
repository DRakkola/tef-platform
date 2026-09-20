# Guide des Opérations Bêta & Maintien en Conditions Opérationnelles (TEF Canada)

Ce document formalise les processus opérationnels, la surveillance de l'infrastructure, le système de gestion des tickets de support et les routines automatisées pour la phase de Bêta active.

---

## 1. Sondes de Santé Opérationnelle (`/admin/health`)

Le service `HealthProbeService` effectue des tests de vivacité et de performance sur les 8 sous-systèmes critiques de la plateforme :

| Sous-système | Mécanisme de Test | Latence Cible (SLO) | Dégradation / Alerte |
| :--- | :--- | :--- | :--- |
| **API Core** | Résolution interne du framework et versioning | $< 10\text{ ms}$ | Non-réponse HTTP 5xx |
| **PostgreSQL** | Exécution d'un `SELECT 1` sur le pool de connexions asynchrones | $< 5\text{ ms}$ | Saturation du pool $> 80\%$ ou latence $> 50\text{ ms}$ |
| **Redis Cache** | Commande `PING/PONG` asynchrone | $< 2\text{ ms}$ | Échec de connexion ou timeout |
| **Stockage MinIO / S3** | Vérification de la disponibilité du bucket audio `tef-audio` | $< 50\text{ ms}$ | Erreur d'authentification ou quota dépassé |
| **Workers Celery** | Envoi d'un broadcast `ping` via le broker Redis | $< 100\text{ ms}$ | Aucun worker actif sur les files prioritaires |
| **Fournisseur IA** | Test de vivacité et validation des quotas d'inférence LLM | $< 300\text{ ms}$ | Débit limité (Rate Limit 429) ou erreur 503 |
| **Passerelle de Paiement**| Validation du statut du processeur Stripe / Mock de facturation | $< 200\text{ ms}$ | Déconnexion du webhook |
| **Practice Pool WebSockets** | Contrôle du gestionnaire de présence temps-réel | $< 15\text{ ms}$ | Rupture du canal de signalement peer-to-peer |

### Règles de Synthèse :
- **HEALTHY** : 8/8 sous-systèmes répondent dans leurs tolérances nominales.
- **DEGRADED** : Au moins un sous-système non-critique (ex: Practice Pool WebSockets) signale une latence élevée.
- **UNHEALTHY** : Échec d'un composant fondamental (PostgreSQL ou API Core).

---

## 2. Système de Feedback Utilisateur & Triage Support

La plateforme intègre deux points d'interaction client natifs :
1. **Micro-Feedback Flottant** (`MicroFeedbackWidget`) : accessible en permanence en bas à droite de l'écran pour les étudiants.
2. **Gestionnaire de Billets Admin** (`AdminSupportPage`) : espace de modération et de résolution réservé aux administrateurs.

### Taxonomie des Retours Utilisateurs (`FeedbackCategory`) :
- `BUG` : Problème technique, affichage erroné, blocage audio.
- `FEATURE_REQUEST` : Demande d'évolution ergonomique ou fonctionnelle.
- `CONTENT_QUALITY` : Remarque sur la pertinence d'une question ou la justesse d'une correction.
- `UX_IMPROVEMENT` : Suggestion d'amélioration du parcours d'apprentissage.
- `OTHER` : Commentaires divers.

### Niveaux de Priorité & Matrice de Triage :
- **URGENT** (SLO réponse : $< 2\text{h}$) : Blocage complet d'un examen, échec de facturation avec compte débité, indisponibilité de l'audio lors d'un test noté.
- **HIGH** (SLO réponse : $< 8\text{h}$) : Anomalie sur le calcul d'un score NCLC, rejet intempestif d'un créneau tuteur.
- **NORMAL** (SLO réponse : $< 24\text{h}$) : Question pédagogique générale, demande de renseignement sur les formats d'examen.
- **LOW** (SLO réponse : $< 48\text{h}$) : Suggestion cosmétique, retour d'appréciation générale.

---

## 3. Tâches d'Arrière-Plan Automatisées (Celery)

Deux tâches périodiques assurent le suivi opérationnel sans intervention humaine manuelle :

### 1. Rapport Quotidien de Bêta (`generate_daily_beta_report_task`)
- **Fréquence** : Quotidienne à 00:00 UTC.
- **Contenu du Rapport** :
  - Nombre d'utilisateurs actifs journaliers (DAU).
  - Volume d'évaluations et d'exercices validés sur 24h.
  - Coût total d'inférence IA généré par les corrections automatiques.
  - Nombre de nouveaux tickets de support ouverts et résolus.
- **Sortie** : Publication dans le canal de notification interne et persistance d'un résumé opérationnel.

### 2. Détection d'Anomalies Opérationnelles (`detect_operational_anomalies_task`)
- **Fréquence** : Toutes les 15 minutes.
- **Critères de Déclenchement d'Alerte** :
  - Augmentation du taux d'événements d'erreur de plus de $3\times$ par rapport à la moyenne mobile.
  - Défaillance répétée de l'un des 8 probes de santé (`UNHEALTHY`).
  - Présence de tickets de support de priorité `URGENT` sans prise en charge depuis plus de 60 minutes.
