/**
 * ReadinessHero component: Answers "Where am I?" and "What is my current situation?".
 * Displays student goal, current CEFR level, target level, countdown, and readiness progress.
 */

import React from "react"
import { Link } from "react-router-dom"
import { Target, Clock, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { EngagementStatus } from "./types"

export interface ReadinessHeroProps {
  studentName?: string
  targetExam: string
  targetLevel: string
  targetCefrLevel?: string
  targetNclcLevel?: string
  currentCefrLevel?: string | null
  currentNclcLevel?: string | null
  overallReadiness: number | null
  daysRemaining?: number | null
  engagementStatus?: EngagementStatus
  totalAssessmentsTaken: number
}

export const ReadinessHero: React.FC<ReadinessHeroProps> = ({
  studentName,
  targetExam,
  targetLevel,
  targetCefrLevel,
  targetNclcLevel,
  currentCefrLevel,
  currentNclcLevel,
  overallReadiness,
  daysRemaining,
  engagementStatus,
  totalAssessmentsTaken,
}) => {
  const currentLevel = currentCefrLevel || (totalAssessmentsTaken > 0 ? "B1" : "Non évalué")
  const target = targetCefrLevel || targetLevel || "B2"
  const targetNclc = targetNclcLevel ? ` (NCLC ${targetNclcLevel})` : ""
  const isCalibrated = totalAssessmentsTaken > 0 && overallReadiness !== null

  // Determine readiness status badge color & label
  const getReadinessLabel = (score: number | null) => {
    if (score === null || !isCalibrated) return { label: "Étalonnage initial", variant: "warning" as const }
    if (score >= 85) return { label: "Objectif atteint", variant: "success" as const }
    if (score >= 70) return { label: "En bonne voie", variant: "info" as const }
    return { label: "Renforcement requis", variant: "warning" as const }
  }

  const readinessMeta = getReadinessLabel(overallReadiness)

  return (
    <section
      aria-label="État de préparation et objectif"
      className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-2xs"
    >
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
        {/* Left: Context, Greeting, Level Relationship & Status */}
        <div className="space-y-5 max-w-2xl flex-1">
          {/* Context Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs uppercase tracking-wider">
              {targetExam || "TEF Canada"}
            </Badge>

            <Badge variant="secondary" className="font-mono text-xs font-medium">
              Cible {target}{targetNclc}
            </Badge>

            {engagementStatus && (
              <Badge
                variant={
                  engagementStatus.status === "dormant"
                    ? "destructive"
                    : engagementStatus.status === "at_risk"
                    ? "warning"
                    : engagementStatus.status === "needs_reengagement"
                    ? "warning"
                    : engagementStatus.status === "new"
                    ? "info"
                    : "success"
                }
                size="sm"
              >
                {engagementStatus.label_fr}
              </Badge>
            )}

            {daysRemaining !== null && daysRemaining !== undefined && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium font-mono tabular-nums bg-muted/40 px-2.5 py-0.5 rounded-md border border-border/40">
                <Clock className="size-3 text-muted-foreground" aria-hidden="true" />
                J-{daysRemaining}
              </span>
            )}
          </div>

          {/* Heading */}
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-balance font-display">
              Bonjour{studentName ? `, ${studentName}` : ""}.
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {isCalibrated ? (
                <>
                  Votre niveau actuel est estimé à{" "}
                  <span className="font-semibold text-foreground">{currentLevel}</span>
                  {currentNclcLevel ? ` (NCLC ${currentNclcLevel})` : ""}. Votre cible requise est le niveau{" "}
                  <span className="font-semibold text-foreground">
                    {target}
                    {targetNclc}
                  </span>
                  .
                </>
              ) : (
                <>
                  Votre profil linguistique est en cours d'étalonnage. Complétez votre première évaluation pour
                  mesurer précisément votre écart par rapport au niveau{" "}
                  <span className="font-semibold text-foreground">
                    {target}
                    {targetNclc}
                  </span>
                  .
                </>
              )}
            </p>
          </div>

          {/* Visual Target Level Relationship Widget */}
          <div className="inline-flex items-center gap-4 sm:gap-6 p-3.5 sm:p-4 rounded-xl border border-border/70 bg-muted/20 select-none">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Niveau estimé
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-foreground">
                  {currentLevel}
                </span>
                {currentNclcLevel && (
                  <span className="text-xs text-muted-foreground font-mono">
                    (NCLC {currentNclcLevel})
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center px-1 text-primary">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">
                Écart
              </span>
              <div className="flex items-center gap-1 font-bold text-xs">
                <span className="h-px w-4 sm:w-6 bg-border" />
                <ArrowRight className="size-3.5 text-primary shrink-0" aria-hidden="true" />
                <span className="h-px w-4 sm:w-6 bg-border" />
              </div>
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Objectif
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-foreground">
                  {target}
                </span>
                {targetNclcLevel && (
                  <span className="text-xs text-muted-foreground font-mono">
                    (NCLC {targetNclcLevel})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Readiness Summary Card */}
        <div className="lg:w-80 shrink-0 p-5 sm:p-6 rounded-2xl border border-border/80 bg-card shadow-xs border-t-4 border-t-primary space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Target className="size-3.5 text-primary" aria-hidden="true" />
              Admissibilité Cible
            </span>
            <Badge variant={readinessMeta.variant} size="sm">
              {readinessMeta.label}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold font-mono tabular-nums text-foreground">
                {overallReadiness !== null && overallReadiness !== undefined
                  ? `${overallReadiness.toFixed(1)}%`
                  : "Étalonnage…"}
              </span>
              <span className="text-xs font-medium text-muted-foreground font-mono">
                Seuil cible : 100%
              </span>
            </div>
            <Progress
              value={overallReadiness || (totalAssessmentsTaken > 0 ? 30 : 10)}
              aria-label="Pourcentage d'admissibilité globale"
              className="h-2"
            />
          </div>

          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Épreuves complétées</span>
            <span className="font-semibold text-foreground font-mono tabular-nums">
              {totalAssessmentsTaken}
            </span>
          </div>

          <Link
            to="/readiness"
            className="group flex items-center justify-between pt-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>Consulter le rapport d'admissibilité</span>
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
