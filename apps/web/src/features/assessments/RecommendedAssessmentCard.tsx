import React from "react"
import { useNavigate } from "react-router-dom"
import {
  Sparkles,
  ArrowRight,
  Clock,
  Layers,
  HelpCircle,
  Compass,
  Headphones,
  BookOpen,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { telemetry } from "@/features/analytics/telemetry"
import type { AssessmentRecommendation } from "./types"

export interface RecommendedAssessmentCardProps {
  recommendation?: AssessmentRecommendation | null
  isLoading?: boolean
  onStart?: (recommendation: AssessmentRecommendation) => void
  onExplore?: () => void
}

export const RecommendedAssessmentCard: React.FC<RecommendedAssessmentCardProps> = ({
  recommendation,
  isLoading = false,
  onStart,
  onExplore,
}) => {
  const navigate = useNavigate()

  const handleStart = () => {
    if (!recommendation) return
    telemetry.track("assessment_started", {
      assessmentId: recommendation.assessment_id,
      title: recommendation.title,
    })
    if (onStart) {
      onStart(recommendation)
    } else {
      navigate(`/assessments/${recommendation.assessment_id}`)
    }
  }

  // Fallback state if no recommendation is available
  if (!recommendation && !isLoading) {
    return (
      <Card
        data-testid="recommended-assessment-fallback"
        className="border-dashed border-border/80 bg-muted/20"
      >
        <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
              <Compass className="size-5" />
            </div>
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  Diagnostic initial recommandé
                </h3>
                <Badge variant="outline" size="sm" className="text-[11px] font-medium">
                  Nouveau candidat
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                Passez un premier test blanc complet pour établir votre profil de compétences TEF et générer un plan de révision sur mesure.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onExplore || (() => {
                const el = document.getElementById("simulations-catalog-heading")
                if (el) el.scrollIntoView({ behavior: "smooth" })
              })}
              className="w-full sm:w-auto cursor-pointer text-xs font-semibold"
            >
              <span>Choisir une simulation</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!recommendation) return null

  const isListening = recommendation.assessment_type === "listening"
  const isReading = recommendation.assessment_type === "reading"
  const TypeIcon = isListening ? Headphones : isReading ? BookOpen : Layers
  const typeLabel = isListening
    ? "Compréhension orale"
    : isReading
    ? "Compréhension écrite"
    : "Simulation complète"

  const durationMins =
    recommendation.estimated_completion_time_minutes ||
    Math.round(recommendation.duration_seconds / 60)

  return (
    <Card
      data-testid="recommended-assessment-card"
      className="relative overflow-hidden border-primary/50 bg-gradient-to-br from-card via-card to-primary/5 shadow-xs"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      <CardContent className="p-5 sm:p-6 space-y-4">
        {/* Header Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="gap-1.5 bg-primary text-primary-foreground text-xs font-bold shadow-2xs">
              <Sparkles className="size-3" />
              <span>Évaluation recommandée</span>
            </Badge>
            <Badge variant="outline" className="font-mono text-xs font-semibold">
              Niveau {recommendation.level}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <TypeIcon className="size-3.5 text-primary" />
            <span>{typeLabel}</span>
          </div>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            {recommendation.title}
          </h2>
        </div>

        {/* Pedagogical Rationale Callout ("Pourquoi maintenant ?") */}
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <HelpCircle className="size-3.5 text-primary" />
            <span>Pourquoi cette évaluation ?</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {recommendation.reason}
          </p>
        </div>

        {/* Bottom Actions & Metadata */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-mono tabular-nums">
              <Clock className="size-3.5" />
              {durationMins} min
            </span>
            {recommendation.question_count > 0 && (
              <>
                <span className="text-muted-foreground/60">•</span>
                <span className="flex items-center gap-1 font-mono tabular-nums">
                  <Layers className="size-3.5" />
                  {recommendation.question_count} questions
                </span>
              </>
            )}
            <span className="text-muted-foreground/60">•</span>
            <span>Épreuve chronométrée</span>
          </div>

          <Button
            onClick={handleStart}
            className="cursor-pointer gap-2 font-semibold shadow-xs"
          >
            <span>Commencer l'évaluation</span>
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
