# Architecture Analytique & Télémétrie Produit (TEF Canada)

## 1. Principes Fondamentaux et Invariants

L'infrastructure analytique de la plateforme TEF Canada est conçue selon des principes stricts garantissant la performance, la souveraineté des données, et la conformité réglementaire :

1. **Auto-Hébergement PostgreSQL Exclusif (Zero SaaS Externe)** :
   - Aucun recours à des services d'analytics tiers (Mixpanel, Segment, Amplitude, Datadog RUM, Google Analytics).
   - Toutes les données événementielles sont persistées dans la base de données PostgreSQL de production (`analytics_events`).
   - Élimination des fuites de métadonnées, des coûts de facturation à l'événement et du blocage par les bloqueurs de publicité (AdBlockers).

2. **Politique Zéro PII Stricte (Personally Identifiable Information)** :
   - Interdiction absolue d'enregistrer des contenus textuels libres (ébauches de rédaction écrite, textes transcrits de production orale, données audio brutes, messages de chat).
   - Filtrage strict des clés sensibles : mots de passe, jetons d'authentification (`token`, `access_token`, `refresh_token`), numéros de cartes de crédit ou PAN, CVV, IBAN.
   - Les métadonnées événementielles ne capturent que des identifiants techniques opaques (`UUIDv4`), des métriques ordinales/numériques (scores, durées, compteurs) et des tags taxonomiques (`tef_module`, `cefr_level`).

3. **Isolation et Tolérance aux Pannes (Fail-Safe Isolation)** :
   - L'enregistrement d'événements de télémétrie ne doit **JAMAIS** bloquer, retarder ou faire échouer une transaction utilisateur critique (inscription, soumission d'examen, paiement, réservation de cours).
   - Côté client : l'envoi s'effectue en mode non-bloquant ("fire-and-forget") via `fetch(..., { keepalive: true })` avec capture silencieuse des erreurs réseau.
   - Côté serveur : le service de télémétrie capture et journalise en niveau `warning` sans propager d'exception bloquante lors de la réception d'événements.

---

## 2. Modèle de Données et Schéma Événementiel

### Table `analytics_events`

La table `analytics_events` est le réceptacle append-only de l'ensemble de la télémétrie système :

```sql
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(64) NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(64),
    entity_type VARCHAR(64),
    entity_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    schema_version VARCHAR(16) NOT NULL DEFAULT 'v1.0.0',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexation pour requêtes d'agrégation rapides
CREATE INDEX ix_analytics_events_type_occurred ON analytics_events(event_type, occurred_at DESC);
CREATE INDEX ix_analytics_events_actor_occurred ON analytics_events(actor_id, occurred_at DESC);
CREATE INDEX ix_analytics_events_session_occurred ON analytics_events(session_id, occurred_at DESC);
```

### Versioning des Schémas (`schema_version`)

Chaque événement est étiqueté avec sa version de schéma (ex: `v1.0.0`). Toute modification structurelle des métadonnées (ajout de champs requis, dépréciation de formats) incrémente la version mineure ou majeure. Le service de lecture prend en charge la rétro-compatibilité par fallback sur les valeurs par défaut.

---

## 3. Pipeline de Télémétrie Côté Client (`TelemetryClient`)

Le singleton `telemetry` (`apps/web/src/features/analytics/telemetry.ts`) gère la collecte et l'émission :

```typescript
// Exemple d'utilisation dans les composants React
telemetry.track("onboarding_step_completed", {
  step: 2,
  target_clb_level: 7,
  target_exam_date: "2026-11-15",
  time_spent_seconds: 45
}, "onboarding", user.id);
```

### Propriétés Clés du Client :
- **Génération Déterministe de Session** : maintien d'un `session_id` en `sessionStorage` pour relier les parcours anonymes aux comptes enregistrés post-inscription.
- **Support Déconnecté / Envol (keepalive)** : utilisation du flag `keepalive: true` de l'API standard `fetch`, garantissant l'émission de l'événement même si l'onglet du navigateur est fermé immédiatement après l'action.
- **Sécurisation Automatique** : inclusion optionnelle du token JWT sans blocage en cas d'absence.

---

## 4. Ingestion Serveur et Épuration des Données (`AnalyticsService`)

Le service backend `AnalyticsService` applique un filtre d'épuration systématique (`sanitize_analytics_metadata`) avant toute écriture en base :

```python
SENSITIVE_KEYS = {
    "password", "secret", "token", "access_token", "refresh_token",
    "card_number", "cvv", "credit_card", "pan", "ssn", "authorization",
    "raw_audio", "audio_bytes", "audio_data", "speech_transcript",
    "writing_text", "draft_content"
}
```

Toute clé figurant dans cette liste est remplacée par la chaîne anonymisée `"[REDACTED_PII]"`. De plus, une vérification par expressions régulières détecte et censure les emails et les numéros de cartes de crédit accidentellement introduits dans les valeurs scalaires.

---

## 5. Moteur d'Agrégation et Tableaux de Bord

Les métriques sont calculées dynamiquement via des requêtes SQL optimisées tirant parti des index `(event_type, occurred_at)`.

### Les 9 Domaines d'Agrégation :
1. **Overview KPI** : Utilisateurs inscrits, actifs (7j/30j), taux d'activation, exercices réalisés, chiffre d'affaires et consommation IA.
2. **Funnel d'Adoption (11 Étapes)** : Visiteur $\to$ Inscription $\to$ Onboarding $\to$ Diagnostic $\to$ Premier Exercice $\to$ Rétention D1+ $\to$ Achat.
3. **Cohortes de Rétention** : Matrices hebdomadaires de rétention active (D1, D7, D14, D30).
4. **Apprentissage & Trajectoires** : Temps moyen par module, distributions de scores NCLC/CLB, identification des compétences bloquantes.
5. **Inventaire & Qualité du Contenu** : Distribution des exercices par module TEF et niveau CECR, taux de réussite moyen par question.
6. **Marketplace Enseignants** : Taux d'utilisation des créneaux, taux d'annulation, délai médian de correction des rédactions et oraux.
7. **Consommation & Coûts IA** : Consommation de tokens (prompt vs completion), latence P95 par modèle, coût moyen par étudiant actif.
8. **Finances & Monétisation** : GMV, commissions plateforme, panier moyen, conversions checkout, statut des abonnements.
9. **Practice Pool** : Files d'attente peer-to-peer, durée moyenne des sessions, taux d'abandon pré-match.

---

## 6. Conformité RGPD et Rétention des Données

- **Droit à l'Oubli** : La contrainte `ON DELETE SET NULL` sur `actor_id` garantit qu'en cas de suppression d'un compte utilisateur, les événements historiques sont immédiatement et irréversiblement anonymisés (`actor_id = NULL`), préservant l'intégrité des métriques de cohorte sans conserver de lien d'identification.
- **Durée de Rétention** : Les événements d'activité brute sont conservés 12 mois glissants en production avant archivage ou agrégation mensuelle.
