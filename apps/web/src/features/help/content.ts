/**
 * Authoritative Help & FAQ Knowledge Base for the TEF Preparation Platform.
 * All answers reflect exact platform capabilities, business rules, and security policies.
 */

import type { HelpCategory, HelpArticle, FaqItem } from "./types";

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "account-security",
    title: "Compte et sécurité",
    description: "Gestion du mot de passe, fuseau horaire et paramètres d'accès.",
    icon: "Shield",
    articleCount: 1,
  },
  {
    id: "tef-prep",
    title: "Préparation TEF & Diagnostic",
    description: "Comprendre le score NCLC/CECR, le diagnostic de readiness et les objectifs.",
    icon: "GraduationCap",
    articleCount: 1,
  },
  {
    id: "assessments",
    title: "Évaluations & Examens blancs",
    description: "Déroulement des simulations officielles, chronomètre et notation.",
    icon: "FileText",
    articleCount: 2,
  },
  {
    id: "writing",
    title: "Atelier de rédaction",
    description: "Épreuves écrites, corrections IA et relecture par nos professeurs certifiés.",
    icon: "PenTool",
    articleCount: 1,
  },
  {
    id: "speaking",
    title: "Expression orale",
    description: "Évaluations de prononciation, fluidité et critères de performance.",
    icon: "Mic",
    articleCount: 1,
  },
  {
    id: "practice-pool",
    title: "Practice Pool oral",
    description: "Sessions d'entraînement 1-à-1 audio, règles de jumelage et anonymat.",
    icon: "Headphones",
    articleCount: 1,
  },
  {
    id: "teachers",
    title: "Professeurs et réservations",
    description: "Réservation de créneaux, déroulement des cours et gestion des annulations.",
    icon: "Users",
    articleCount: 2,
  },
  {
    id: "billing",
    title: "Abonnement et paiements",
    description: "Formules, packs de crédits, facturation et politique de résiliation.",
    icon: "CreditCard",
    articleCount: 2,
  },
  {
    id: "privacy",
    title: "Données et confidentialité",
    description: "Protection de vos données, export RGPD/LPRPDE et suppression de compte.",
    icon: "Lock",
    articleCount: 1,
  },
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "evaluation-deroulement",
    title: "Comment fonctionne une simulation d'examen TEF ?",
    categoryId: "assessments",
    excerpt: "Découvrez le déroulement d'une épreuve blanche, la gestion du compte à rebours officiel et la soumission automatique des réponses.",
    lastUpdated: "2026-09-15T10:00:00Z",
    tags: ["évaluation", "simulation", "chronomètre", "examen blanc", "compréhension"],
    relatedSlugs: ["score-nclc-readiness", "session-interrompue-resolution"],
    content: `
### Présentation des simulations TEF

Les simulations TEF reproduisent fidèlement les conditions réelles des épreuves officielles de la Chambre de Commerce et d'Industrie de Paris (CCI Paris Île-de-France) pour le TEF Canada et le TEFAQ.

#### 1. Structure de l'examen
- **Compréhension écrite (CE)** : 40 à 50 questions réparties sur des textes variés (annonces, articles, courriers formels).
- **Compréhension orale (CO)** : 40 à 60 questions basées sur des documents sonores authentiques (messages répondeur, interviews, débats).
- **Expression écrite (EE)** : 2 sections (fait divers et argumentation/prise de position).
- **Expression orale (EO)** : 2 sections (demande d'informations et argumentation persuasive).

#### 2. Chronomètre et synchronisation serveur
Le décompte du temps est synchronisé en continu avec nos serveurs. Même en cas de rafraîchissement de la page ou de micro-coupure réseau :
- Le chronomètre officiel ne s'interrompt pas.
- Vos réponses sélectionnées sont automatiquement enregistrées toutes les quelques secondes.
- À l'expiration du temps imparti, l'épreuve est clôturée et vos réponses enregistrées sont automatiquement soumises pour correction.

#### 3. Résultats et barème
Dès la soumission, vos scores bruts sont convertis selon le barème officiel du TEF (score sur 699 points) et traduits en niveaux du Cadre Européen Commun de Référence (CECR de A1 à C2) et Niveaux de Compétence Linguistique Canadiens (NCLC 1 à 10).
    `.trim(),
  },
  {
    slug: "score-nclc-readiness",
    title: "Comment sont calculés mon score NCLC et mes recommandations ?",
    categoryId: "tef-prep",
    excerpt: "Comprendre le modèle d'évaluation de niveau NCLC/CECR, le diagnostic d'admissibilité et l'attribution des exercices personnalisés.",
    lastUpdated: "2026-09-14T08:30:00Z",
    tags: ["nclc", "cecr", "readiness", "score", "recommandations", "canada"],
    relatedSlugs: ["evaluation-deroulement", "practice-pool-fonctionnement"],
    content: `
### Le système de calcul NCLC et d'admissibilité

Le NCLC (Niveaux de Compétence Linguistique Canadiens) est l'échelle officielle d'évaluation utilisée par Immigration, Réfugiés et Citoyenneté Canada (IRCC) pour les programmes tels qu'Entrée Express.

#### 1. Équivalences des niveaux
- **NCLC 7** (Seuil critique B2) : Score requis pour maximiser les points au profil Entrée Express.
- **NCLC 8-9** (Niveaux C1) : Maîtrise avancée et fluide de la langue française dans tous les contextes professionnels.

#### 2. Moteur de préparation adaptatif (Readiness Engine)
Notre plateforme analyse l'historique complet de vos entraînements :
- **Précision par compétence** : Compréhension écrite, orale, structure grammaticale et vocabulaire.
- **Régularité et volume** : Fréquence de travail et temps passé sur chaque type de tâche.
- **Indice de préparation global (0 à 100 %)** : Cet indicateur estime la probabilité d'obtenir votre niveau cible le jour de l'examen officiel.

#### 3. Recommandations automatiques
Si vos résultats révèlent une faiblesse sur un type spécifique d'exercice (par exemple les connecteurs logiques en section B d'expression écrite), notre algorithme priorise automatiquement ces exercices dans votre tableau de bord.
    `.trim(),
  },
  {
    slug: "reservation-professeur",
    title: "Comment réserver et préparer un cours particulier ?",
    categoryId: "teachers",
    excerpt: "Guide pas à pas pour choisir un professeur certifié, bloquer un créneau horaire et préparer votre séance de tutorat.",
    lastUpdated: "2026-09-12T14:00:00Z",
    tags: ["professeur", "réservation", "créneau", "tuteur", "cours"],
    relatedSlugs: ["annulation-remboursement-cours", "achat-utilisation-credits"],
    content: `
### Réservation d'un professeur certifié

Notre réseau rassemble des professeurs francophones certifiés, spécialisés dans la méthodologie et les critères de notation du TEF Canada.

#### 1. Choix du service et du créneau
1. Accédez à l'annuaire des professeurs depuis l'onglet **Professeurs**.
2. Consultez la fiche du tuteur : bio, accent, certifications, tarif horaire et avis d'étudiants.
3. Choisissez le format souhaité : cours individuel de 60 minutes, simulation d'expression orale ou relecture de copie d'expression écrite.
4. Sélectionnez le créneau horaire sur le calendrier en fonction de votre fuseau horaire local.

#### 2. Blocage temporaire et confirmation
Dès que vous sélectionnez un créneau disponible, il est temporairement verrouillé pendant 15 minutes pour vous permettre de finaliser le règlement ou d'utiliser vos crédits sans risque de double réservation.
Une fois le paiement ou le crédit validé, la réservation passe à l'état **Confirmée** et apparaît immédiatement dans **Mes réservations**.

#### 3. Déroulement de la séance
Un lien direct vers la salle de visioconférence est accessible sur la page de votre réservation 15 minutes avant le début de la séance.
    `.trim(),
  },
  {
    slug: "practice-pool-fonctionnement",
    title: "Comment rejoindre et utiliser le Practice Pool oral ?",
    categoryId: "practice-pool",
    excerpt: "Tout savoir sur les séances audio anonymes en binôme entre candidats du même niveau pour pratiquer l'expression orale.",
    lastUpdated: "2026-09-10T11:00:00Z",
    tags: ["practice pool", "oral", "audio", "binôme", "anonymat", "speaking"],
    relatedSlugs: ["score-nclc-readiness", "session-interrompue-resolution"],
    content: `
### Le Practice Pool : Pratique orale entre pairs

Le Practice Pool permet aux candidats au TEF de s'entraîner ensemble à l'expression orale dans des conditions bienveillantes, sans caméra et dans un respect total de la vie privée.

#### 1. Principes fondamentaux
- **Audio uniquement** : Aucune caméra n'est requise ni activée.
- **Anonymat complet** : Vous apparaissez sous un pseudonyme aléatoire d'animal francophone (ex. "Renard véloce"). Aucune coordonnée personnelle n'est partagée.
- **Compatibilité de niveau** : Le système de jumelage associe uniquement des candidats de niveaux compatibles (ex. B1 avec B1/B2) selon leurs résultats enregistrés.

#### 2. Déroulement d'une session de 15 minutes
1. Rejoignez la file d'attente sur **/practice-pool**.
2. Dès qu'un binôme est trouvé, un sujet officiel de simulation (Section A ou B du TEF) vous est proposé.
3. Vous disposez de 15 minutes pour échanger en français sur le sujet avec votre partenaire.
4. À l'issue des 15 minutes, la session se clôture automatiquement et vous pouvez évaluer la fluidité de l'échange.

#### 3. Modération et sécurité
En cas de comportement inapproprié, un bouton **Signaler et bloquer** est accessible à tout moment dans la session. Le signalement est immédiatement transmis à notre équipe de modération.
    `.trim(),
  },
  {
    slug: "gestion-abonnement-resiliation",
    title: "Comment modifier ou résilier mon abonnement ?",
    categoryId: "billing",
    excerpt: "Gérer votre formule, changer d'intervalle de facturation ou résilier sans frais depuis votre espace facturation.",
    lastUpdated: "2026-09-11T16:00:00Z",
    tags: ["abonnement", "résiliation", "facturation", "pro", "paiement"],
    relatedSlugs: ["achat-utilisation-credits", "annulation-remboursement-cours"],
    content: `
### Gestion de votre abonnement

Vous gardez le contrôle total de votre abonnement récurrent depuis la page **Abonnement & Facturation** (/billing).

#### 1. Changer de formule ou d'intervalle
Vous pouvez basculer d'une formule mensuelle à une formule annuelle (bénéficiant d'une remise) directement en cliquant sur **Choisir cette formule** dans le catalogue des offres.

#### 2. Résiliation en un clic
- Vous pouvez résilier votre abonnement à tout moment, sans préavis ni pénalité.
- Rendez-vous sur **/billing**, puis cliquez sur **Résilier l'abonnement** sur votre formule active.
- Confirmez votre choix dans la fenêtre explicative.

#### 3. Que se passe-t-il après la résiliation ?
- **Accès garanti jusqu'à l'échéance** : Vous conservez l'accès intégral à toutes vos fonctionnalités premium jusqu'au dernier jour de la période déjà payée.
- **Aucun renouvellement futur** : Aucun prélèvement automatique supplémentaire ne sera effectué.
- **Conservation des crédits** : Vos crédits actifs restent disponibles sur votre compte.
- **Reprise possible** : Avant la date d'échéance, vous pouvez annuler la résiliation en un clic via le bouton **Reprendre l'abonnement**.
    `.trim(),
  },
  {
    slug: "achat-utilisation-credits",
    title: "Comment fonctionnent les crédits et les packs ?",
    categoryId: "billing",
    excerpt: "Règles d'utilisation des crédits pour les corrections de rédactions et les leçons de tutorat individuel.",
    lastUpdated: "2026-09-08T09:00:00Z",
    tags: ["crédits", "packs", "solde", "recharge", "achat"],
    relatedSlugs: ["gestion-abonnement-resiliation", "reservation-professeur"],
    content: `
### Le système de crédits de la plateforme

Les crédits constituent la monnaie d'échange flexible pour accéder aux services à la carte ne nécessitant pas d'engagement récurrent.

#### 1. À quoi servent les crédits ?
- **Correction humaine de rédaction** : 1 crédit par copie révisée en détail avec commentaires d'un correcteur certifié.
- **Cours particulier de tutorat** : Nombre de crédits défini selon le tarif du professeur sélectionné.
- **Recharges d'évaluations spécifiques**.

#### 2. Durée de validité
- Les crédits achetés via nos **Packs de crédits** (ex. Pack 5 crédits) **n'expirent jamais**.
- Seuls certains crédits promotionnels ou offerts lors d'événements spécifiques peuvent comporter une date de fin de validité (affichée clairement sur votre page de facturation).

#### 3. Suivi de consommation
L'historique complet de vos crédits (recharges et utilisations) est consultable à tout moment dans la section **Activité récente des crédits** sur la page **/billing**.
    `.trim(),
  },
  {
    slug: "annulation-remboursement-cours",
    title: "Politique d'annulation et de remboursement des cours",
    categoryId: "teachers",
    excerpt: "Règles de reprogrammation, délais d'annulation de 24 heures et réattribution des crédits en cas d'imprévu.",
    lastUpdated: "2026-09-05T12:00:00Z",
    tags: ["annulation", "remboursement", "politique", "24h", "professeur"],
    relatedSlugs: ["reservation-professeur", "gestion-abonnement-resiliation"],
    content: `
### Politique d'annulation des sessions avec professeur

Afin de respecter le temps de travail de nos professeurs certifiés, des règles claires encadrent les annulations et modifications de planning.

#### 1. Annulation plus de 24 heures avant le cours
- Si vous annulez ou reprogrammez votre séance au moins **24 heures avant l'heure prévue**, l'annulation est sans frais.
- Vos crédits ou le montant débité sont automatiquement recrédités sur votre solde de crédits ou compte d'origine.

#### 2. Annulation moins de 24 heures avant le cours
- En cas d'annulation moins de 24 heures avant le créneau fixé, la séance est considérée comme due et le professeur est rémunéré pour son créneau bloqué.
- Aucun remboursement ni recrédit automatique n'est possible, sauf cas de force majeure avéré (justificatif médical à adresser au support).

#### 3. Absence du professeur
Si le professeur ne se présente pas sur la visioconférence dans les 10 minutes suivant l'horaire convenu :
- Vous pouvez signaler l'absence directement depuis la page de votre réservation.
- La session sera intégralement recréditée sur votre compte et notre équipe pédagogique prendra contact avec le professeur.
    `.trim(),
  },
  {
    slug: "export-suppression-donnees",
    title: "Comment exporter ou supprimer mes données personnelles ?",
    categoryId: "privacy",
    excerpt: "Conformité RGPD et LPRPDE : téléchargez une copie de vos données d'apprentissage ou demandez la suppression définitive de votre compte.",
    lastUpdated: "2026-09-02T15:00:00Z",
    tags: ["données", "confidentialité", "rgpd", "lprpde", "export", "suppression"],
    relatedSlugs: ["gestion-abonnement-resiliation"],
    content: `
### Vos droits sur vos données personnelles

La confidentialité de vos informations est notre priorité absolue. Nous respectons scrupuleusement le Règlement Général sur la Protection des Données (RGPD) européen et la Loi sur la Protection des Renseignements Personnels et les Documents Électroniques (LPRPDE) canadienne.

#### 1. Exporter vos données (Portabilité)
Vous pouvez télécharger à tout moment une copie complète et structurée de vos données :
1. Rendez-vous dans **Paramètres** (/settings).
2. Ouvrez la section **Confidentialité**.
3. Cliquez sur **Exporter mes données**.
4. Un fichier JSON contenant votre historique d'évaluations, vos scores NCLC, vos rédactions et vos préférences est généré et téléchargé automatiquement.

#### 2. Suppression définitive du compte (Droit à l'oubli)
1. Toujours dans la section **Confidentialité**, accédez à la zone **Zone de danger**.
2. Cliquez sur **Supprimer définitivement mon compte**.
3. Saisissez votre mot de passe pour confirmer votre identité.
4. Vos données personnelles, historiques de tentatives, enregistrements audio et comptes de messagerie sont définitivement effacés de nos bases actives.
    `.trim(),
  },
  {
    slug: "session-interrompue-resolution",
    title: "Que faire en cas de déconnexion ou problème technique ?",
    categoryId: "assessments",
    excerpt: "Procédure de récupération en cas de coupure de connexion internet, bug d'affichage ou incident survenu pendant un test.",
    lastUpdated: "2026-09-01T10:00:00Z",
    tags: ["problème technique", "déconnexion", "reprise", "session", "bug"],
    relatedSlugs: ["evaluation-deroulement", "practice-pool-fonctionnement"],
    content: `
### Résolution des incidents techniques

Une panne de réseau ou un souci de navigateur ne doit pas gâcher votre préparation. Voici les étapes à suivre selon la situation :

#### 1. Déconnexion pendant un examen blanc
- **Reconnexion immédiate** : Rafraîchissez la page ou reconnectez-vous depuis votre tableau de bord. Cliquez sur **Reprendre la simulation**.
- **Sauvegarde automatique** : Nos serveurs conservent l'intégralité de vos réponses sauvegardées jusqu'à la seconde précédant l'interruption.
- **Temps restant** : Le chronomètre serveur continuant de tourner pendant une épreuve chronométrée, reconnectez-vous dès que possible pour ne pas perdre de temps.

#### 2. Problème de microphone en expression orale ou Practice Pool
- Vérifiez que votre navigateur autorise l'accès au microphone pour notre domaine.
- Sur Chrome/Edge : cliquez sur l'icône de cadenas à gauche de la barre d'adresse pour vérifier les permissions audio.
- Utilisez de préférence un casque audio filaire pour éviter les échos et larsens.

#### 3. Contacter le support technique
Si un problème technique a irrémédiablement compromis une tentative d'examen ou un créneau réservé, ouvrez une demande via le bouton **Contacter le support** ci-dessous en précisant l'heure et l'épreuve concernée. Notre équipe d'assistance examinera les journaux techniques pour réinitialiser votre tentative.
    `.trim(),
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "faq-eval-deroulement",
    question: "Comment se déroule une simulation d'évaluation TEF ?",
    answer: "Chaque simulation reproduit fidèlement le format officiel (Compréhension écrite, Compréhension orale, Expression écrite et orale). Le chronomètre est synchronisé avec le serveur et vos réponses sont enregistrées automatiquement. À la fin du temps imparti, la copie est validée automatiquement.",
    categoryId: "assessments",
    articleSlug: "evaluation-deroulement",
  },
  {
    id: "faq-score-calcul",
    question: "Comment mon niveau NCLC et mes recommandations sont-ils calculés ?",
    answer: "Vos scores bruts sont convertis selon le barème officiel du TEF (score sur 699) et traduits en niveaux NCLC (1 à 10) et CECR (A1 à C2). Notre moteur d'analyse identifie vos points de blocage et adapte automatiquement les exercices recommandés sur votre tableau de bord.",
    categoryId: "tef-prep",
    articleSlug: "score-nclc-readiness",
  },
  {
    id: "faq-professeur-reserver",
    question: "Comment réserver une séance avec un professeur certifié ?",
    answer: "Sélectionnez le professeur de votre choix dans l'annuaire, choisissez le type de séance (cours, simulation orale ou correction écrite) et bloquez un créneau horaire sur le calendrier. Le créneau est verrouillé 15 minutes pendant la finalisation du règlement.",
    categoryId: "teachers",
    articleSlug: "reservation-professeur",
  },
  {
    id: "faq-practice-pool-join",
    question: "Comment fonctionne le Practice Pool oral ?",
    answer: "Le Practice Pool vous jumelle automatiquement avec un autre candidat de niveau compatible pour une session audio de 15 minutes sur un sujet officiel de TEF. La séance est 100 % audio, sous pseudonyme, garantissant un anonymat et une bienveillance totale.",
    categoryId: "practice-pool",
    articleSlug: "practice-pool-fonctionnement",
  },
  {
    id: "faq-abonnement-resilier",
    question: "Puis-je résilier mon abonnement à tout moment ?",
    answer: "Oui, la résiliation s'effectue en un clic depuis votre espace /billing. Vous conservez l'intégralité de vos accès premium jusqu'à la fin de la période de facturation en cours, sans aucuns frais supplémentaires.",
    categoryId: "billing",
    articleSlug: "gestion-abonnement-resiliation",
  },
  {
    id: "faq-credits-expiration",
    question: "Les crédits ont-ils une date d'expiration ?",
    answer: "Les crédits acquis via nos packs de recharge n'expirent jamais. Seuls certains crédits promotionnels temporaires peuvent comporter une date limite, clairement indiquée sur votre compte.",
    categoryId: "billing",
    articleSlug: "achat-utilisation-credits",
  },
  {
    id: "faq-annulation-cours",
    question: "Quelle est la politique d'annulation pour les cours particuliers ?",
    answer: "Toute annulation effectuée plus de 24 heures avant le début de la séance donne lieu à la réattribution intégrale de vos crédits. En deçà de 24 heures, la séance est due au professeur pour compenser son créneau réservé.",
    categoryId: "teachers",
    articleSlug: "annulation-remboursement-cours",
  },
  {
    id: "faq-donnees-export",
    question: "Comment demander une copie ou la suppression de mes données ?",
    answer: "Conformément au RGPD et à la LPRPDE, vous pouvez télécharger une archive complète de vos données (historique, scores, productions écrites) ou supprimer définitivement votre compte depuis Paramètres > Confidentialité.",
    categoryId: "privacy",
    articleSlug: "export-suppression-donnees",
  },
  {
    id: "faq-session-interrompue",
    question: "Que faire si ma session d'examen ou de pratique est interrompue ?",
    answer: "En cas de coupure de connexion, reconnectez-vous immédiatement à votre compte et cliquez sur 'Reprendre la simulation'. Vos réponses précédentes sont conservées. Si un incident technique persiste, contactez notre support technique pour réinitialiser votre tentative.",
    categoryId: "assessments",
    articleSlug: "session-interrompue-resolution",
  },
];
