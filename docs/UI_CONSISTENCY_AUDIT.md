# Audit de Cohérence UI / UX — Plateforme TEF

**Date** : Septembre 2026  
**Rôle** : Lead Product Designer & Principal Frontend Engineer  
**Périmètre** : Application frontend (`apps/web`), architecture des tokens de design, layouts applicatifs, parcours d'examen et gestion des erreurs d'authentification.

---

## 1. Synthèse Exécutive

L'audit de cohérence UI/UX a été conduit afin d'éliminer les disparités visuelles, les reliquats de thèmes sombres disparates (`bg-slate-950`), les fuites de codes d'erreur bruts (notamment `AUTH_REQUIRED`), et de standardiser l'ensemble de l'interface autour d'un **système de design unifié** :
1. **Shell applicatif** : Cadre sombre anthracite (`oklch(0.18 0.015 250)` / `--sidebar-background`).
2. **Espace de travail** : Fond neutre lumineux et reposant (`oklch(0.985 0.002 240)` / `--background` / `--workspace`).
3. **Surfaces de contenu** : Cartes blanches pures (`oklch(1 0 0)` / `--card`) rehaussées de bordures subtiles (`--border-subtle`) et d'ombres discrètes (`shadow-xs`).
4. **Accent colorimétrique** : Famille Cobalt/Indigo TEF contrôlée (`oklch(0.46 0.17 260)` / `--primary`), exclusion stricte de tout violet/pourpre fantôme.
5. **Expériences d'examen focalisées** : Coquilles dédiées sans distraction (`FocusedExamShell`, `FocusedWritingShell`, `FocusedSpeakingShell`) pour les épreuves chronométrées.

---

## 2. Tableau d'Audit Détaillé

| Fichier / Composant | Problème Constaté | Sévérité | Recommandation & Solution Token / Composant |
| :--- | :--- | :--- | :--- |
| `apps/web/src/index.css` | Reliquats de variables de template avec teintes violettes (`#c084fc`, `rgba(170, 59, 255)`) dans la media query dark legacy. Absence d'alias explicites `--workspace` et `--workspace-foreground`. | **Haute** | Purger le bloc `@media (prefers-color-scheme: dark)` legacy. Aligner les tokens sur le standard TEF Cobalt et déclarer `--workspace` et `--color-workspace`. |
| `apps/web/src/components/common/ErrorState.tsx` | Le composant affiche directement la chaîne `description` passée en prop sans intercepter les erreurs d'authentification machine comme `"AUTH_REQUIRED"`. | **Haute** | Détecter automatiquement `"AUTH_REQUIRED"` et les statuts 401 pour afficher un message utilisateur bienveillant en français avec bouton d'action de reconnexion. |
| `apps/web/src/core/api.ts` | Pas de traduction conviviale ni de déclenchement centralisé sur réponse HTTP 401 non autorisée. | **Moyenne** | Standardiser le code d'erreur et le message par défaut de `ApiError` sur 401 pour éviter toute remontée de messages techniques. |
| `apps/web/src/features/dashboard/useDashboard.ts` | Lignes 28 et 64 lèvent brutalement `new Error("AUTH_REQUIRED")` sans message explicatif pour le candidat. | **Haute** | Remplacer par un message explicatif clair ou intercepter dans `ErrorState` pour afficher l'état de session expirée. |
| `apps/web/src/components/layout/AppHeader.tsx` | `BreadcrumbLink` utilise `href="/dashboard"`, provoquant un rechargement complet de la page HTML au lieu d'une navigation SPA fluide. | **Moyenne** | Utiliser `asChild` avec `<Link to="/dashboard">` issu de `react-router-dom`. |
| `apps/web/src/features/assessments/AssessmentsListPage.tsx` | Page entièrement construite en fond sombre `bg-slate-950 text-slate-100` avec bordures et spinners non tokenisés, déconnectée du shell étudiant. | **Critique** | Intégrer dans `StudentLayout` + `PageShell`, convertir les conteneurs en `Card` avec tokens `--card`, `--background`, `--primary`. |
| `apps/web/src/features/assessments/AssessmentDetailPage.tsx` | Page isolée sur `bg-slate-950`, modale de démarrage et badges codés en dur avec teintes slate sombres. | **Critique** | Aligner avec `StudentLayout` + `PageShell`, adopter les composants partagés `Card`, `Badge` et boutons standardisés. |
| `apps/web/src/features/assessments/AssessmentTakingPage.tsx` | Écran d'examen critique utilisant des classes utilitaires sombres ad hoc (`bg-slate-950`), sans shell standardisé réutilisable. | **Haute** | Standardiser avec `FocusedExamShell`, préserver le chronomètre serveur, la synchronisation hors ligne et la palette de questions. |
| `apps/web/src/features/assessments/AssessmentRunnerPage.tsx` | Utilisation de classes de fond sombre `bg-slate-950 text-slate-100`. | **Moyenne** | Aligner sur le design system avec surfaces claires de travail et barre de navigation épurée. |
| `apps/web/src/features/assessments/AssessmentResultsPage.tsx` | Restitution des résultats sur fond sombre `bg-slate-950`, jauge et liste de fautes en contraste sombre. | **Haute** | Convertir en `StudentLayout` + `PageShell` avec cartes blanches, jauges de score circulaires nettes et accordéons de correction clairs. |
| `apps/web/src/features/teachers/TeachersDirectoryPage.tsx` | Barre de filtres (spécialité, niveau) codée manuellement en boutons ad hoc ; risque de répétition sur d'autres catalogues. | **Moyenne** | Créer et utiliser le composant partagé `FilterBar.tsx`. Optimiser la grille responsive pour les écrans larges (`xl:grid-cols-3`). |
| `apps/web/src/features/writing/WritingSubmissionsPage.tsx` | Absence de `PageShell` dans `StudentLayout`, créant un espacement marginal légèrement différent des autres pages piliers. | **Faible** | Envelopper dans `<PageShell maxWidth="default">` pour harmoniser les gouttières et largeurs maximales. |
| `apps/web/src/features/writing/WritingEditorPage.tsx` | Bonne structure générale mais utilise un header ad-hoc plutôt qu'une coquille dédiée et réutilisable. | **Moyenne** | Structurer via `FocusedWritingShell` pour garantir la cohérence avec les autres modes d'examen. |
| `apps/web/src/features/speaking/SpeakingSessionPage.tsx` | Structure en 4 étapes bien pensée, mais nécessitant une coquille focalisée (`FocusedSpeakingShell`) pour le mode d'enregistrement actif. | **Moyenne** | Fournir `FocusedSpeakingShell` pour isoler les contrôles de micro et de chronométrage sans distraction. |

---

## 3. Plan d'Action & Priorités de Remédiation

1. **Tokens de base** : Nettoyage immédiat de `apps/web/src/index.css` (suppression de tout violet résiduel, fixation des tokens `--workspace`, `--surface`, `--card`).
2. **Gestion d'erreur unifiée** : Sécurisation de `ErrorState.tsx`, `api.ts` et `useDashboard.ts` contre toute fuite machine.
3. **Composants d'orchestration partagés** :
   - `FilterBar.tsx` (barre de filtrage segmentée réutilisable).
   - `FocusedExamShell.tsx` (shell d'examen sans distraction avec chronomètre et statut réseau).
   - `FocusedWritingShell.tsx` (shell de rédaction avec double volet et compteur de mots).
   - `FocusedSpeakingShell.tsx` (shell d'expression orale avec étapes et état micro).
4. **Refactorisation visuelle des épreuves** :
   - Migration de `AssessmentsListPage.tsx`, `AssessmentDetailPage.tsx`, `AssessmentTakingPage.tsx`, et `AssessmentResultsPage.tsx`.
5. **Homogénéisation des catalogues et ateliers** :
   - Intégration de `FilterBar` dans `TeachersDirectoryPage.tsx`.
   - Ajout de `PageShell` dans `WritingSubmissionsPage.tsx`.
   - Correction du lien SPA dans `AppHeader.tsx`.
6. **Contrôle Qualité & Documentation** :
   - Rédaction du guide de vérification `docs/UI_QA_CHECKLIST.md`.
   - Exécution intégrale des tests et validateurs de données.
