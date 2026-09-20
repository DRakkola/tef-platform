# Checklist de Contrôle Qualité UI / UX — Plateforme TEF

**Date** : Septembre 2026  
**Rôle** : Lead Product Designer & Principal Frontend Engineer  
**Objectif** : Guide de validation exhaustif des exigences d'interface, d'ergonomie, de cohérence de design et d'accessibilité (WCAG 2.1 AA) pour la plateforme de préparation TEF Canada.

---

## 1. Cadre Général & Système de Design

- [x] **Shell Applicatif Sombre** :
  - Le panneau latéral (`AppSidebar`) utilise la nuance sombre anthracite (`oklch(0.18 0.015 250)` / `--sidebar-background`).
  - La bordure de délimitation du menu latéral (`--sidebar-border`) s'affiche distinctement à 1px sans créer de contraste agressif.
  - Les éléments actifs du menu latéral (`--sidebar-active`) sont rehaussés avec `--sidebar-active-foreground`.
- [x] **Espace de Travail Neutre (Light Neutral Workspace)** :
  - L'espace central sous l'en-tête utilise le fond clair neutre (`oklch(0.985 0.002 240)` / `--background` / `--workspace`).
  - Aucun fond disparate type `bg-slate-950` ou `bg-gray-900` ne subsiste sur les pages du parcours candidat.
- [x] **Surfaces & Cartes Élevées (Elevated White Cards)** :
  - Toutes les fiches d'information et conteneurs utilisent `--card` (`oklch(1 0 0)` / blanc pur).
  - Présence de la bordure subtile (`border border-border/80`) et d'un ombrage discret (`shadow-xs`).
  - Survol interactif avec micro-élévation contrôlée (`hover:border-primary/40 hover:shadow-sm`).
- [x] **Accent Colorimétrique Strict (Cobalt / Indigo TEF)** :
  - L'accentuation principale est assurée par `--primary` (`oklch(0.46 0.17 260)`).
  - Aucune présence de nuances violettes/pourpres legacy (`#c084fc`, `rgba(170, 59, 255)`).
  - Statuts sémantiques distincts : succès (`--success` / vert émeraude), avertissement (`--warning` / ambre chaleureux), destruction/erreur (`--destructive` / rouge corail).
- [x] **Typographie & Échelle Hiérarchique** :
  - Police officielle `Geist Variable` appliquée globalement via `@fontsource-variable/geist`.
  - Hiérarchie claire : `h1` (titre de page 24-30px font-extrabold/bold), `h2` (titre de section 18-20px font-bold), `h3`/`CardTitle` (titre de carte 14-16px font-semibold).
  - Chiffres tubulaires (`font-mono`) pour tous les chronomètres, scores et pourcentages.

---

## 2. Navigation & Architecture du Shell

- [x] **Panneau Latéral (`AppSidebar`)** :
  - En-tête avec identité visuelle "Portail TEF" et objectif d'examen ("Cible : B2 / NCLC 7").
  - 5 piliers cardinaux présents : `Tableau de bord`, `Pratique`, `Progression`, `Professeurs`, `Practice Pool`.
  - Section secondaire : `Simulations TEF`, `Atelier d'écriture`.
  - Bas de menu : profil candidat ("Claire Martin"), lien de déconnexion et d'assistance.
  - Comportement pliable fluide (`SidebarTrigger`) sans saut d'affichage.
- [x] **Barre d'En-tête (`AppHeader`)** :
  - Hauteur normalisée de 56px (`h-14`) avec flou d'arrière-plan (`backdrop-blur-xs`).
  - Fil d'Ariane SPA utilisant `Link` de `react-router-dom` (aucun rechargement plein écran HTML).
  - Centre de notifications (`NotificationCenter`) avec badge de notifications non lues.
- [x] **Lien d'Accès Rapide (Skip Navigation)** :
  - Lien accessible au clavier "Aller au contenu principal" ciblant `#main-content`.

---

## 3. Gestion Centralisée des Erreurs & Authentification

- [x] **Protection Contre les Fuites de Codes Techniques** :
  - Aucune chaîne machine type `"AUTH_REQUIRED"` ou `"HTTP_ERROR"` ne s'affiche à l'utilisateur.
- [x] **Composant `ErrorState`** :
  - Détection automatique des erreurs 401 et tokens d'expiration.
  - Message rédigé en français soigné : *"Votre session a expiré ou une authentification est requise pour accéder à cet espace. Veuillez vous reconnecter pour continuer."*
  - Bouton d'action contextuel "Se connecter" ou "Réessayer".
  - Pictogramme approprié (cadenas pour authentification, alerte pour erreur technique).

---

## 4. Parcours d'Évaluation & Simulations TEF

- [x] **Catalogue des Épreuves (`AssessmentsListPage`)** :
  - Enveloppé dans `StudentLayout` + `PageShell`.
  - Cartes claires avec badges d'épreuve (`Compréhension Écrite` / `Compréhension Orale`), niveau CECR (`B1-C1`), et durée en minutes.
  - Bouton d'action "Consulter et démarrer" menant vers `/assessments/:id`.
  - Gestion des états de chargement (spinner), vide (`EmptyState`) et erreur (`ErrorState`).
- [x] **Détail & Consignes d'Épreuve (`AssessmentDetailPage`)** :
  - Enveloppé dans `StudentLayout` + `PageShell maxWidth="default"`.
  - Rappel du chronomètre serveur faisant autorité, de la sauvegarde continue et de la clôture automatique.
  - Bouton "Démarrer l'épreuve maintenant" initialisant la tentative côté serveur (`POST /api/v1/assessments/:id/attempts`) et redirigeant vers `/attempts/:id`.
- [x] **Passation d'Épreuve Sans Distraction (`AssessmentTakingPage` & `FocusedExamShell`)** :
  - En-tête focalisé épuré sans navigation perturbatrice : titre d'épreuve, question en cours, état réseau (en ligne, hors ligne, synchronisation).
  - Chronomètre serveur visible en permanence avec pulsation d'alerte sous 60 secondes.
  - Lecteur audio dédié `ListeningPlayer` pour les épreuves de compréhension orale.
  - Autosave debouncé à 250ms sur sélection de réponse (`PUT /api/v1/attempts/:id/answers/:qId`).
  - Tiroir/grille de navigation numérotée dans les questions avec indicateur visuel (répondue, non répondue, active).
  - Modale de confirmation avant clôture finale avec avertissement des questions non répondues.
- [x] **Rapport d'Évaluation (`AssessmentResultsPage`)** :
  - Carte de score héroïque avec pourcentage global, niveau estimé (ex. B2), et décompte des bonnes réponses.
  - Avertissement légal officiel rappelant le caractère indicatif de la simulation.
  - Grille des points forts et axes d'amélioration prioritaires.
  - Exercices ciblés recommandés avec bouton "Démarrer l'exercice".
  - Onglets interactifs : "Synthèse des compétences", "Erreurs à revoir" (avec explication pédagogique détaillée), et "Toutes les questions".

---

## 5. Expression Écrite & Expression Orale

- [x] **Atelier d'Écriture (`WritingSubmissionsPage`)** :
  - Intégration sous `StudentLayout` + `PageShell` pour une largeur et des marges homogènes.
  - Liste des rédactions passées, statuts de relecture (IA / Enseignant), notes et retours de correction.
- [x] **Éditeur d'Écrit (`WritingEditorPage` & `FocusedWritingShell`)** :
  - Coquille d'examen focalisée avec barre d'état (sauvegarde en temps réel, chronomètre calme, bouton "Soumettre").
  - Double volet équilibré : consigne officielle TEF à gauche, éditeur de texte à droite.
  - Compteur de mots dynamique avec retour coloré (sous la limite en ambre, dans la cible 200-250 mots en vert, dépassement en alerte).
- [x] **Laboratoire Oral (`SpeakingSessionPage` & `FocusedSpeakingShell`)** :
  - Enchaînement des 4 étapes clés : Briefing (vérification micro et consigne), Session active chronométrée, Évaluation transitoire, Rapport de performance.
  - Indicateur de statut de connexion audio en direct.

---

## 6. Annuaire des Professeurs & Pratique

- [x] **Annuaire Enseignants (`TeachersDirectoryPage`)** :
  - Barre de filtres unifiée `FilterBar` avec sélecteurs segmentés pour la spécialité et le niveau.
  - Grille responsive optimisée (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`) sans espaces résiduels indésirables sur grands écrans.
  - Fiches professeurs avec tarification horaire en CAD, fuseau horaire, compétences clés et CTA de réservation.
- [x] **Fiche Détail Enseignant (`TeacherDetailPage`)** :
  - Sélection de créneau horaire converti à l'heure locale de l'étudiant.
  - Modale de réservation confirmant les détails de session.

---

## 7. Responsive & Accessibilité (WCAG 2.1 AA)

- [x] **Comportement Multi-Écrans** :
  - **Mobile (< 640px)** : Menus latéraux convertis en tiroir accessible, boutons pleine largeur ou adaptés, taille de police minimale de 12px.
  - **Tablette (640px - 1024px)** : Grilles à 2 colonnes, conservation de la hiérarchie.
  - **Desktop (1024px - 1440px+)** : Largeur maximale contenue (`max-w-7xl`), alignement fluide des deux volets d'édition et d'examen.
- [x] **Accessibilité Clavier & Lecteurs d'Écran** :
  - Anneaux de focus visibles (`focus-visible:ring-2 focus-visible:ring-primary`).
  - Attributs ARIA respectés : `role="radiogroup"`, `role="radio"`, `aria-checked`, `role="timer"`, `aria-live="polite"`, `role="alert"`, `role="dialog"`.
  - Contrastes conformes au ratio minimum 4.5:1 pour le texte normal et 3:1 pour les éléments graphiques et grands textes.
