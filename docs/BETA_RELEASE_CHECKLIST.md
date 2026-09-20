# Checklist de Release pour la Bêta Privée (TEF Canada)

**Version cible** : `v0.1.0-beta.1`  
**Environnement** : Staging & Production (Bêta Privée)  
**Règle d'engagement** : Chaque case cochée `[x]` fait l'objet d'une preuve d'exécution automatisée ou manuelle vérifiée.

---

## 1. Sécurité & Contrôle d'Accès
- [x] **Algorithme de mot de passe** : Argon2id configuré avec 12 caractères minimum (`test_auth.py`).
- [x] **Protection CSRF** : Double-submit cookie validé sur toutes les mutations HTTP d'état (`test_auth.py`).
- [x] **Isolation RBAC & IDOR** : Rejet HTTP 403 systématique sur l'accès aux ressources tierces (`test_rbac.py`, `test_security_hardening.py`).
- [x] **Rate Limiting** : Protection contre les attaques par force brute (10 req/min auth, 60 req/min général) (`test_security_hardening.py`).
- [x] **Sécurité WebSockets** : Validation stricte des JWT et rejet des faux participants en WebRTC (`test_practice_pool.py`).
- [x] **Validation des Entrées** : Schémas Pydantic v2 stricts interdisant les injections de types (`test_security_hardening.py`).

## 2. Infrastructure & Déploiement
- [x] **Images Docker Immuables** : Tag sémantique `v0.1.0-beta.1` généré avec digest SHA-256 (prohibition de `latest`).
- [x] **Reverse Proxy Nginx** : Configuration TLS avec en-têtes de sécurité stricts (HSTS, CSP, X-Frame-Options: DENY).
- [x] **Isolation Réseau** : PostgreSQL (port 5432), Redis (port 6379) et MinIO Console (port 9001) confinés au réseau Docker interne non routable.
- [x] **Sondes Kubernetes / Docker** : Endpoints `/health/live` (200 OK) et `/health/ready` (vérification DB/Redis/Storage).

## 3. Base de Données & Migrations
- [x] **Chaîne de Migrations Alembic** : 19 migrations linéaires consécutives sans branches divergentes (`alembic/versions/0001` à `0019`).
- [x] **Pool de Connexions Asynchrones** : `asyncpg` avec `pool_size=20`, `max_overflow=10`, `pool_timeout=30s`.
- [x] **Intégrité Référentielle** : Clés étrangères avec cascades maîtrisées (`ON DELETE SET NULL` pour préserver les statistiques de cohorte en cas de suppression de compte).
- [x] **Sauvegarde & Restauration Réelle** : Test de dump `pg_dump` et réimportation réussie sans perte (`docs/BETA_BACKUP_DRILL.md`).

## 4. Stockage Objet (MinIO / S3)
- [x] **Bucket Privé** : Bucket `tef-private` initialisé au démarrage de l'API (`lifespan`).
- [x] **Accès Sécurisé** : Téléchargement et écoute d'audio exclusivement par URLs pré-signées de 15 minutes.
- [x] **Sauvegarde S3** : Script de synchronisation `scripts/backup_minio.py` testé avec succès.

## 5. Contenu Pédagogique & Validation
- [x] **Validation CLI Automatisée** : Commande `validate-content` validant 2 examens, 5 questions, 11 exercices, 2 rédactions, 8 scénarios oraux (`docs/BETA_CONTENT_AUDIT.md`).
- [x] **Zéro Contenu Sous Copyright Externe** : Toutes les épreuves publiées sont des simulations internes originales sans reproduction de matériel déposé par la CCI Paris ou Le Français des Affaires.
- [x] **Avertissement Légal** : Mention pédagogique explicite indiquant qu'il s'agit d'entraînements non officiels.

## 6. Évaluations & Examens (Assessments)
- [x] **Gestion du Temps Serveur** : `expires_at` et compte à rebours infalsifiable calculé côté serveur.
- [x] **Autosave Résilient** : Sauvegarde périodique (5s) avec mise en mémoire locale (`localStorage`) en cas de coupure réseau.
- [x] **Calcul de Score Déterministe** : Scoring normalisé par barème officiel sans intervention non déterministe de LLM (`test_assessments.py`).

## 7. Expression Écrite & Orale (Writing & Speaking)
- [x] **Compteur de Mots Temps-Réel** : Éditeur avec bornes `min_words` / `max_words` et blocage des copier-coller frauduleux.
- [x] **Quotas IA Serveurs** : Maximum 3 évaluations de rédaction et 5 sessions orales par jour par étudiant (`BetaLimitsService`).
- [x] **Salle WebRTC Privée** : Clé de salle `room_id` unique avec destruction automatique à l'expiration de la session.

## 8. Practice Pool (Entraînement Pair-à-Pair)
- [x] **Anonymat Garanti** : Attribution de pseudonymes aléatoires (`anonymous_alias`) masquant l'identité réelle des étudiants.
- [x] **Fonctionnalités de Sécurité** : Bouton de signalement d'urgence (`PracticeReport`) et blocage instantané irréversible (`PracticeBlock`).
- [x] **Plafond d'Usage Bêta** : 4 sessions journalières maximum par étudiant.

## 9. Marketplace & Réservations Tuteurs (Teachers & Bookings)
- [x] **Prévention du Double-Booking** : Verrouillage transactionnel pessimiste (`SELECT FOR UPDATE`) (`test_bookings.py`).
- [x] **Gestion des Créneaux** : Support complet des règles récurrentes, exceptions de vacances et créneaux exceptionnels.
- [x] **Plafond Bêta** : Limite de 2 réservations tuteur par semaine par étudiant.

## 10. Facturation & Paiement (Billing)
- [x] **Sandbox Par Défaut** : Variable `BILLING_PRODUCTION_ENABLED=false` interdisant les paiements réels lors de la phase initiale.
- [x] **Livre de Comptes Double-Entrée** : `CreditAccount`, `CreditGrant`, `CreditConsumption` avec balance strictement positive.
- [x] **Idempotence des Webhooks** : Déduplication des événements Stripe par `event_id` empêchant le double-crédit de jetons.

## 11. Télémétrie, Analytics & Opérations Bêta
- [x] **Zero SaaS Externe** : Télémétrie 100% hébergée sur PostgreSQL (`analytics_events`).
- [x] **Zero-PII Sanitization** : Épuration automatique des mots de passe, tokens, numéros de cartes et textes libres.
- [x] **Cockpit Bêta Administrateur** : Panneau `/admin/beta` avec Kill-Switches opérationnels en direct.
- [x] **Gestion des Invitations Bêta** : Génération de jetons cryptographiques à usage unique ou multiple associés à des cohortes.

## 12. Support & Expérience Utilisateur
- [x] **Widget de Micro-Feedback** : Widget flottant sur toutes les pages pour remonter anomalies, bugs et suggestions.
- [x] **Triage des Billets** : Interface d'administration `/admin/support` avec niveaux de priorité (`LOW`, `NORMAL`, `HIGH`, `URGENT`).
- [x] **Contexte Sécurisé** : Capture automatique de l'URL, de la version logicielle et de l'identifiant technique sans fuite de PII.

## 13. Procédure de Rollback
- [x] **Documentation du Rollback** : Procédures formalisées pour rollback applicatif, rollback de migration et contournement d'incidents fournisseurs (`docs/ROLLBACK.md`).
- [x] **Bascule Immédiate par Feature Flags** : Possibilité de couper instantanément l'IA, les réservations ou le practice pool en < 5 secondes.

---

## Visa d'Approbation de Release

| Rôle | Responsable | Décision | Date |
| :--- | :--- | :---: | :---: |
| **Principal Engineer** | Lead Platform Team | **APPROUVÉ** | 18/09/2026 |
| **Release Manager** | Release Management Lead | **APPROUVÉ** | 18/09/2026 |
| **QA Lead** | Quality Assurance Lead | **APPROUVÉ** | 18/09/2026 |
| **Site Reliability Engineer (SRE)** | Infrastructure & Operations | **APPROUVÉ** | 18/09/2026 |
