/**
 * AssessmentResultHero Component.
 * The primary visual section presenting the overall score, estimated CEFR level,
 * confidence rating, and target objective comparison using calibrated, non-certifying terminology.
 */

import React from "react"
import { ShieldAlert, Target, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface AssessmentResultHeroProps {
  scorePercentage: number
  totalPoints: number
  maxPoints: number
  estimatedLevel?: string | null
  confidenceLabel?: string | null
  targetLevel?: string | null
  targetGapExplanation?: string | null
  isFirstDiagnostic?: boolean
  disclaimer: string
  className?: string
}

export const AssessmentResultHero: React.FC<AssessmentResultHeroProps> = ({
  scorePercentage,
  totalPoints,
  maxPoints,
  estimatedLevel,
  confidenceLabel,
  targetLevel,
  targetGapExplanation,
  isFirstDiagnostic = false,
  disclaimer,
  className,
}) => {
  const roundedPercentage = Math.round(scorePercentage)

  // Calibrated confidence label text & style
  const getConfidenceBadge = () => {
    const norm = (confidenceLabel || "").toLowerCase()
    if (norm.includes("élev") || norm.includes("high")) {
      return (
        <Badge variant="outline" size="sm" className="gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10">
          <CheckCircle2 className="size-3" />
          <span>Indice de confiance : Élevé</span>
        </Badge>
      )
    }
    if (norm.includes("modér") || norm.includes("medium")) {
      return (
        <Badge variant="outline" size="sm" className="gap-1 border-primary/30 text-primary bg-primary/10">
          <HelpCircle className="size-3" />
          <span>Indice de confiance : Modéré</span>
        </Badge>
      )
    }
    if (norm.includes("faible") || norm.includes("low") || isFirstDiagnostic) {
      return (
        <Badge variant="outline" size="sm" className="gap-1 border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/10">
          <AlertCircle className="size-3" />
          <span>Estimation préliminaire</span>
        </Badge>
      )
    }
    return (
      <Badge variant="outline" size="sm" className="gap-1 text-muted-foreground border-border/80">
        <span>Estimation formative</span>
      </Badge>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* 1. Official Non-Certifying Disclaimer Banner */}
      <div
        role="note"
        aria-label="Notice d'évaluation indicative"
        className="rounded-2xl border border-warning/30 bg-warning/10 p-4 sm:p-5 flex items-start gap-3.5 text-foreground shadow-xs"
      >
        <ShieldAlert className="size-5 text-warning shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed space-y-1">
          <span className="font-bold text-foreground uppercase tracking-wider text-[11px] block">
            Notice d'évaluation indicative
          </span>
          <p className="text-muted-foreground leading-relaxed">{disclaimer}</p>
        </div>
      </div>

      {/* 2. Primary Hero Card */}
      <Card className="border-border/80 bg-card shadow-xs overflow-hidden">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Session terminée et évaluée</span>
                </Badge>
                {getConfidenceBadge()}
                {isFirstDiagnostic && (
                  <Badge
                    variant="outline"
                    size="sm"
                    className="gap-1 border-primary/30 text-primary bg-primary/10"
                  >
                    <span>Votre première estimation de niveau</span>
                  </Badge>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight pt-1">
                Rapport d'évaluation de l'épreuve
              </h2>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {isFirstDiagnostic
                  ? "Cette estimation constitue votre point de départ pour orienter vos priorités de travail."
                  : "Analyse détaillée de votre performance et orientation vers vos prochaines étapes."}
              </p>
            </div>

            {/* Score & CEFR Level Cards */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              {/* Overall Score */}
              <div className="text-center px-5 py-3.5 rounded-2xl border border-border/80 bg-muted/30 shadow-2xs min-w-[95px]">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block">
                  Score global
                </span>
                <div className="text-2xl sm:text-3xl font-black text-foreground mt-0.5 font-mono">
                  {roundedPercentage}%
                </div>
              </div>

              {/* Estimated CEFR Level */}
              <div className="text-center px-5 py-3.5 rounded-2xl border border-border/80 bg-muted/30 shadow-2xs min-w-[95px]">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block">
                  Niveau estimé
                </span>
                <div className="text-2xl sm:text-3xl font-black text-primary mt-0.5">
                  {estimatedLevel || "B1"}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Simple Restrained Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground font-medium">
              <span>
                Points obtenus : <strong className="text-foreground font-mono">{totalPoints}</strong> sur{" "}
                <span className="font-mono">{maxPoints}</span>
              </span>
              <span className="font-semibold text-foreground font-mono">{roundedPercentage}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                role="progressbar"
                aria-valuenow={roundedPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Score global : ${roundedPercentage}%`}
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  roundedPercentage >= 75
                    ? "bg-emerald-500"
                    : roundedPercentage >= 50
                    ? "bg-primary"
                    : "bg-amber-500"
                )}
                style={{ width: `${Math.min(100, Math.max(0, roundedPercentage))}%` }}
              />
            </div>
          </div>

          {/* Target Context Section (when student has configured a target level) */}
          {targetLevel && (
            <div className="mt-4 pt-4 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 -mx-6 -mb-6 px-6 py-3.5">
              <div className="flex items-center gap-2.5 text-xs">
                <Target className="size-4 text-primary shrink-0" />
                <span className="text-muted-foreground">
                  Votre objectif :{" "}
                  <strong className="text-foreground font-bold">{targetLevel}</strong>
                  {estimatedLevel && (
                    <>
                      {" "}• Niveau estimé actuel :{" "}
                      <strong className="text-foreground font-bold">{estimatedLevel}</strong>
                    </>
                  )}
                </span>
              </div>

              <span className="text-xs font-medium text-primary">
                {targetGapExplanation || "Progression à poursuivre"}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
