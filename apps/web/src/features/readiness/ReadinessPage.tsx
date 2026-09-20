/**
 * Readiness & Adaptive Learning Engine Cockpit.
 * Provides transparent, production-grade estimation metrics,
 * strictly respecting compliance, terminology, and time budgets.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldAlert,
  Gauge,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Layers,
  HelpCircle,
  ArrowRight,
  Zap,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudentLayout } from "@/features/dashboard/StudentLayout";
import { PageShell } from "@/components/layout/PageShell";
import {
  useReadinessProfile,
  useBlockingSkills,
  useReadinessTrends,
  useRecentEvidence,
  useDailyPlan,
  useReassessmentStatus,
  useRecalculateReadiness,
  useUpdateDailyBudget,
} from "./useReadiness";
import type { ReadinessBand, ConfidenceLabel } from "./types";

const BAND_CONFIG: Record<
  ReadinessBand,
  { label: string; color: string; bg: string; border: string; desc: string }
> = {
  insufficient_data: {
    label: "Données insuffisantes",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    desc: "Observations insuffisantes pour produire une estimation fiable (moins de 2 compétences évaluées).",
  },
  developing: {
    label: "En développement",
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    desc: "Les compétences requièrent un renforcement structuré sur les compétences fondamentales.",
  },
  progressing: {
    label: "En progression",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    desc: "Trajectoire ascendante continue; plusieurs compétences approchent le seuil cible.",
  },
  near_target: {
    label: "Proche de la cible",
    color: "text-primary dark:text-indigo-400",
    bg: "bg-primary/10",
    border: "border-primary/30",
    desc: "Performance globale proche du niveau visé; prioriser la résorption des facteurs limitants.",
  },
  target_consistent: {
    label: "Conforme à la cible",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    desc: "Performances observées régulières et conformes au niveau visé sur toutes les épreuves cœur.",
  },
};

const CONFIDENCE_BADGES: Record<ConfidenceLabel, { label: string; color: string }> = {
  Faible: { label: "Confiance Faible", color: "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20" },
  Moyenne: { label: "Confiance Moyenne", color: "text-sky-700 dark:text-sky-400 bg-sky-500/10 border-sky-500/20" },
  Élevée: { label: "Confiance Élevée", color: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  assessment: "Épreuve diagnostique / Examen blanc",
  teacher_evaluation: "Correction enseignant certifié",
  ai_evaluation: "Évaluation automatisée",
  exercise: "Exercice thématique",
  practice: "Session d'entraînement",
};

export const ReadinessPage: React.FC = () => {
  const { data: profile, isLoading: isProfileLoading, refetch: refetchProfile } = useReadinessProfile();
  const { data: blockersData } = useBlockingSkills();
  const { data: trendsData } = useReadinessTrends();
  const { data: evidenceData } = useRecentEvidence(15);
  const { data: dailyPlan, refetch: refetchPlan } = useDailyPlan();
  const { data: reassessment } = useReassessmentStatus();

  const recalculateMutation = useRecalculateReadiness();
  const updateBudgetMutation = useUpdateDailyBudget();

  const [showMethodology, setShowMethodology] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);

  const handleBudgetChange = async (minutes: number) => {
    setSelectedBudget(minutes);
    await updateBudgetMutation.mutateAsync(minutes);
    refetchPlan();
  };

  const handleRecalculate = async () => {
    await recalculateMutation.mutateAsync();
    refetchProfile();
    refetchPlan();
  };

  if (isProfileLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="size-8 text-indigo-400 animate-spin" />
        <p className="text-sm text-slate-400">Chargement de votre profil de préparation...</p>
      </div>
    );
  }

  const band = profile?.readiness_band || "insufficient_data";
  const bandConfig = BAND_CONFIG[band];
  const confBadge = profile?.confidence_label ? CONFIDENCE_BADGES[profile.confidence_label] : null;

  return (
    <StudentLayout>
      <PageShell maxWidth="default" className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Gauge className="size-6 text-primary" />
              <span>Indicateur de Préparation & Diagnostic NCLC</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Estimation probabiliste de maîtrise linguistique calibrée sur vos observations récentes.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={recalculateMutation.isPending}
            className="text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`size-3.5 ${recalculateMutation.isPending ? "animate-spin" : ""}`} />
            <span>{recalculateMutation.isPending ? "Calcul en cours..." : "Recalculer"}</span>
          </Button>
        </div>

        {/* 1. Official Compliance Banner */}
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 flex items-start gap-3">
          <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200/90 leading-relaxed space-y-1">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Estimation pédagogique interne — TEF Canada
            </p>
            <p>
              {profile?.disclaimer ||
                "Ce système fournit une estimation mathématique de préparation basée sur vos observations récentes. Il ne constitue pas un certificat officiel du TEF ni une garantie de résultat."}
            </p>
          </div>
        </div>

        {/* 2. Cockpit Header: Readiness Band & Overall Score Estimate */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Main Estimate Card */}
          <div className="lg:col-span-2 rounded-2xl border border-border/70 bg-card p-6 shadow-2xs flex flex-col justify-between space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    Estimation de Préparation
                  </h1>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-muted border border-border/60 text-muted-foreground">
                    {profile?.calculation_version || "v1.0.0"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cible visée : <span className="font-semibold text-foreground">{profile?.target_exam || "TEF Canada"}</span> — Niveau {profile?.target_level || "B2"} (seuil: {profile?.target_score || 70}%)
                </p>
              </div>

              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${bandConfig.bg} ${bandConfig.border} ${bandConfig.color}`}
              >
                <span className="size-2 rounded-full bg-current animate-pulse" />
                {bandConfig.label}
              </div>
            </div>

            {/* Central Metric Display */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-border/60">
              <div className="p-3 rounded-xl bg-surface-muted border border-border/50">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Score Estimé</span>
                <div className="text-2xl font-bold text-foreground mt-1 font-mono tabular-nums">
                  {profile?.overall_score_estimate !== null && profile?.overall_score_estimate !== undefined
                    ? `${profile.overall_score_estimate}%`
                    : "—"}
                </div>
                <span className="text-[10px] text-muted-foreground">Pondéré dans le temps</span>
              </div>

              <div className="p-3 rounded-xl bg-surface-muted border border-border/50">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Indice de Confiance</span>
                <div className="text-2xl font-bold text-primary mt-1 font-mono tabular-nums">
                  {profile ? `${Math.round(profile.confidence_overall * 100)}%` : "—"}
                </div>
                {confBadge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border inline-block mt-1 font-medium ${confBadge.color}`}>
                    {confBadge.label}
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-surface-muted border border-border/50">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Équivalence CECRL</span>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {profile?.estimated_cefr || "En attente"}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  NCLC : {profile?.estimated_nclc ? `Niveau ${profile.estimated_nclc}` : "—"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-surface-muted border border-border/50">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Échéance Examen</span>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono tabular-nums">
                  {profile?.days_until_exam !== null && profile?.days_until_exam !== undefined
                    ? `J-${profile.days_until_exam}`
                    : "Non fixée"}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {profile?.days_until_exam !== null && profile?.days_until_exam !== undefined
                    ? `${profile.days_until_exam} jours restants`
                    : "À planifier"}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed italic border-t border-border/60 pt-3">
              {bandConfig.desc}
            </p>
          </div>

          {/* Right Col: Trajectory & Velocity */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
                Trajectoire & Vitesse
              </h2>
              <span className="text-[10px] text-muted-foreground">Multi-fenêtres</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                <span className="text-muted-foreground">Évolution 7 jours</span>
                <span
                  className={`font-mono font-medium tabular-nums ${
                    (trendsData?.trend_7d ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  }`}
                >
                  {trendsData?.trend_7d !== null && trendsData?.trend_7d !== undefined
                    ? `${trendsData.trend_7d >= 0 ? "+" : ""}${trendsData.trend_7d}%`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                <span className="text-muted-foreground">Évolution 30 jours</span>
                <span
                  className={`font-mono font-medium tabular-nums ${
                    (trendsData?.trend_30d ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  }`}
                >
                  {trendsData?.trend_30d !== null && trendsData?.trend_30d !== undefined
                    ? `${trendsData.trend_30d >= 0 ? "+" : ""}${trendsData.trend_30d}%`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                <span className="text-muted-foreground">Évolution globale</span>
                <span
                  className={`font-mono font-medium tabular-nums ${
                    (trendsData?.trend_all_time ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  }`}
                >
                  {trendsData?.trend_all_time !== null && trendsData?.trend_all_time !== undefined
                    ? `${trendsData.trend_all_time >= 0 ? "+" : ""}${trendsData.trend_all_time}%`
                    : "—"}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-muted border border-border/50 text-xs space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Vélocité observée</span>
              <p className="font-semibold text-foreground">
                {trendsData?.sufficient_data_for_velocity
                  ? trendsData.level_change_estimate || "Stable"
                  : "Données insuffisantes (min. 14 jours)"}
              </p>
              {trendsData?.score_change_per_week !== null && trendsData?.score_change_per_week !== undefined && (
                <p className="text-[11px] text-muted-foreground tabular-nums font-mono">
                  Rythme : {trendsData.score_change_per_week > 0 ? "+" : ""}
                  {trendsData.score_change_per_week} pts / semaine
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 3. Personalized Daily Study Plan (Adaptive, Strictly Budgeted) */}
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Plan Quotidien Adaptatif (V2)</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium">
                  Budget : {dailyPlan?.daily_minutes_budget || 30} min
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {dailyPlan?.summary || "Activités ciblées pour résorber vos facteurs limitants selon votre temps disponible."}
              </p>
            </div>

            {/* Daily Time Budget Selector */}
            <div className="flex items-center gap-1.5 bg-surface-muted p-1.5 rounded-xl border border-border/60">
              <Clock className="size-3.5 text-muted-foreground ml-1.5" />
              <span className="text-xs text-muted-foreground mr-1">Budget :</span>
              {[15, 30, 45, 60].map((mins) => {
                const isActive = (selectedBudget ?? dailyPlan?.daily_minutes_budget) === mins;
                return (
                  <button
                    key={mins}
                    onClick={() => handleBudgetChange(mins)}
                    disabled={updateBudgetMutation.isPending}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {mins} min
                  </button>
                );
              })}
            </div>
          </div>

          {/* Plan Items Grid */}
          {dailyPlan?.items && dailyPlan.items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dailyPlan.items.map((item) => {
                const diffBadgeColor =
                  item.difficulty_profile === "too_easy"
                    ? "text-muted-foreground bg-muted"
                    : item.difficulty_profile === "challenging"
                    ? "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/20"
                    : "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20";

                const typeBadge =
                  item.item_type === "review"
                    ? { label: "Révision Espacée", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" }
                    : item.item_type === "diagnostic"
                    ? { label: "Épreuve Diagnostique", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20" }
                    : item.item_type === "refresh"
                    ? { label: "Rafraîchissement", color: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20" }
                    : { label: "Entraînement Cœur", color: "bg-primary/10 text-primary border-primary/20" };

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border/60 bg-surface p-4 flex flex-col justify-between space-y-4 hover:border-primary/50 transition-all shadow-2xs group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-medium ${typeBadge.color}`}>
                          {typeBadge.label}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground font-mono text-[11px]">
                          <Clock className="size-3" />
                          ~{item.estimated_minutes} min
                        </span>
                      </div>

                      <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-medium ${diffBadgeColor}`}>
                        Niveau {item.difficulty_profile === "appropriate" ? "adapté" : item.difficulty_profile}
                      </span>

                      <Link
                        to={item.action_url || "/exercises"}
                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium group-hover:translate-x-0.5 transition-transform"
                      >
                        Commencer <ChevronRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl bg-surface-muted border border-border/50 space-y-3">
              <CheckCircle2 className="size-8 text-emerald-500 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Aucune activité requise pour le moment. Votre profil est à jour.
              </p>
            </div>
          )}
        </div>

        {/* 4. Core Skills Breakdown & Target Gap Table */}
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Layers className="size-5 text-primary" />
                Profil des Compétences & Écarts à la Cible
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Évaluation pondérée par la récence et le type de source pour chaque compétence de l'épreuve.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {profile?.skills.length || 0} compétences suivies
            </span>
          </div>

          {/* Skills Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {profile?.skills && profile.skills.length > 0 ? (
              profile.skills.map((skill) => {
                const isBlocking = skill.is_blocking;
                const gap = skill.target_gap;
                const gapColor = gap > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400";
                const gapSign = gap > 0 ? `-${gap}%` : `+${Math.abs(gap)}%`;

                return (
                  <div
                    key={skill.skill_id}
                    className={`rounded-xl border p-4 flex flex-col justify-between space-y-4 shadow-2xs ${
                      isBlocking
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-border/60 bg-surface"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground truncate max-w-[150px]">
                          {skill.skill_name}
                        </span>
                        {isBlocking && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                            Bloquant
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between pt-1">
                        <div>
                          <span className="text-2xl font-bold text-foreground font-mono tabular-nums">{skill.current_score}%</span>
                          <span className="text-[11px] text-muted-foreground ml-1">/ {skill.target_score}%</span>
                        </div>
                        <span className={`text-xs font-mono font-bold tabular-nums ${gapColor}`}>
                          {gapSign}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            skill.current_score >= skill.target_score
                              ? "bg-emerald-500"
                              : isBlocking
                              ? "bg-destructive"
                              : "bg-primary"
                          }`}
                          style={{ width: `${Math.min(100, (skill.current_score / skill.target_score) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Confiance: {Math.round(skill.confidence * 100)}%</span>
                      <span>{skill.data_points_count} obs.</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground text-xs">
                Aucune compétence évaluée pour l'instant. Commencez une épreuve diagnostique.
              </div>
            )}
          </div>
        </div>

        {/* 5. Blocking Skills (Facteurs Limitants) Alert Box */}
        {blockersData?.blocking_skills && blockersData.blocking_skills.length > 0 && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              <h2 className="text-base font-bold">
                Facteurs Limitants Détectés ({blockersData.blocking_skills.length})
              </h2>
            </div>
            <p className="text-xs text-destructive/90 leading-relaxed">
              Ces compétences présentent un écart supérieur à 10 points par rapport au seuil visé avec un niveau de confiance confirmé. Elles constituent la priorité pédagogique immédiate.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {blockersData.blocking_skills.map((b) => (
                <div
                  key={b.skill_id}
                  className="p-4 rounded-xl bg-card border border-destructive/20 space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-sm">{b.skill_name}</span>
                    <span className="text-xs font-mono font-bold text-destructive tabular-nums">Déficit: -{b.deficit}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{b.impact_explanation}</p>
                  <p className="text-xs text-primary font-medium">Action : {b.recommended_remedy}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Reassessment Engine & Recalibration Trigger */}
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RotateCcw className="size-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">Diagnostic & Réévaluation</h2>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              {reassessment?.is_reassessment_recommended
                ? "Une réévaluation est recommandée pour consolider l'estimation de votre niveau et actualiser votre plan d'entraînement."
                : reassessment?.cooldown_active
                ? `Période de stabilisation active (${reassessment.days_until_next_eligible} jours restants avant la prochaine épreuve complète recommandée).`
                : "Vos indicateurs de préparation sont stables. Continuez vos exercices quotidiens."}
            </p>
            {reassessment?.reasons && reassessment.reasons.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                {reassessment.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="shrink-0">
            <Link
              to={
                reassessment?.recommended_assessment_id
                  ? `/assessments/${reassessment.recommended_assessment_id}`
                  : "/assessments"
              }
            >
              <Button className="text-xs px-4 py-2 flex items-center gap-2 cursor-pointer">
                Passer une épreuve diagnostique <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* 7. Recent Immutable Evidence Stream */}
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Zap className="size-4 text-primary" />
                Flux d'Observations Récentes (Preuves Immuables)
              </h2>
              <p className="text-xs text-muted-foreground">
                Journal d'audit horodaté alimentant le calcul de préparation en temps réel.
              </p>
            </div>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              Total : {evidenceData?.total_count || 0} observations
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <th className="py-2.5 px-3 font-semibold">Date (UTC)</th>
                  <th className="py-2.5 px-3 font-semibold">Compétence</th>
                  <th className="py-2.5 px-3 font-semibold">Source</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Score</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Poids Source</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Confiance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {evidenceData?.evidence && evidenceData.evidence.length > 0 ? (
                  evidenceData.evidence.map((ev) => (
                    <tr key={ev.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 px-3 text-muted-foreground font-mono tabular-nums">
                        {new Date(ev.observed_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground">{ev.skill_name || "—"}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-surface-muted text-foreground border border-border/60 font-medium">
                          {SOURCE_TYPE_LABELS[ev.source_type] || ev.source_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground tabular-nums">
                        {ev.normalized_score}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground tabular-nums">{ev.weight}x</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground tabular-nums">
                        {Math.round(ev.confidence * 100)}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-muted-foreground">
                      Aucune preuve d'évaluation enregistrée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 8. Methodology & Mathematical Explainability Accordion */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-2xs">
          <button
            onClick={() => setShowMethodology(!showMethodology)}
            className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 font-medium">
              <HelpCircle className="size-4 text-primary" />
              Transparence méthodologique : Comment cette estimation est-elle calculée ?
            </span>
            <span className="text-[11px] font-mono">{showMethodology ? "Masquer" : "Afficher"}</span>
          </button>

          {showMethodology && (
            <div className="mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground space-y-3 leading-relaxed">
              <p>
                Le moteur de préparation repose sur un algorithme déterministe mathématique sans recours aux modèles de langage pour le calcul des scores :
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2">
                <li>
                  <strong className="text-foreground">Pondération par source :</strong> Les évaluations d'enseignants certifiés (0.95) et épreuves diagnostiques (1.00) bénéficient d'un poids de confiance supérieur aux exercices d'entraînement libre (0.60).
                </li>
                <li>
                  <strong className="text-foreground">Décroissance temporelle exponentielle :</strong> Les observations plus anciennes perdent progressivement de leur influence avec une demi-vie de 45 jours (\(\lambda = \ln(2)/45\)).
                </li>
                <li>
                  <strong className="text-foreground">Indice de confiance découplé :</strong> La confiance dépend du nombre d'observations, de la diversité des épreuves et de la cohérence des résultats — et non du score lui-même.
                </li>
                <li>
                  <strong className="text-foreground">Respect strict du budget temps :</strong> Le plan quotidien s'adapte strictement au créneau disponible configuré par l'étudiant (15 à 60 minutes).
                </li>
              </ul>
            </div>
          )}
        </div>
      </PageShell>
    </StudentLayout>
  );
};
