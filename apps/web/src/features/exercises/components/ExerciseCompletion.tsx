/**
 * ExerciseCompletion Component.
 * The completion screen summarizing practice drill performance,
 * skills practiced, diagnostic guidance, and the next recommended activity.
 */

import React from "react"
import { ArrowRight, RotateCcw, Sparkles, Compass, Clock, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { NextRecommendedActivity } from "../types"

export interface ExerciseCompletionProps {
  score: number
  totalPoints: number
  accuracy: number
  timeSpentSeconds?: number
  skills?: string[]
  category?: string
  isCorrect?: boolean
  recommendation?: NextRecommendedActivity | null
  onStartRecommendation?: (rec: NextRecommendedActivity) => void
  onRestart: () => void
  onReturnToPractice: () => void
  className?: string
}

export const ExerciseCompletion: React.FC<ExerciseCompletionProps> = ({
  score,
  totalPoints,
  accuracy,
  timeSpentSeconds = 60,
  skills = [],
  category,
  isCorrect = true,
  recommendation,
  onStartRecommendation,
  onRestart,
  onReturnToPractice,
  className,
}) => {
  const roundedAccuracy = Math.round(accuracy)
  const durationMinutes = Math.max(1, Math.round(timeSpentSeconds / 60))

  return (
    <div className={cn("space-y-6", className)}>
      {/* 1. Main Completion Card */}
      <Card className="border-border/80 bg-card shadow-xs overflow-hidden">
        <CardHeader className="text-center pb-2 pt-8 sm:pt-10 space-y-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mx-auto shadow-2xs">
            {isCorrect ? (
              <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Sparkles className="size-7 text-primary" />
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Terminé !
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
              {isCorrect
                ? "Excellent travail, vos compétences ont été mises à jour."
                : "Exercice terminé. La répétition régulière est la clé de la progression."}
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Performance Metrics Grid */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {/* Score */}
            <div className="rounded-2xl border border-border/80 bg-muted/30 p-3.5 sm:p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Score
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono text-foreground mt-1">
                {score} <span className="text-xs text-muted-foreground font-normal">/ {totalPoints}</span>
              </div>
            </div>

            {/* Accuracy */}
            <div className="rounded-2xl border border-border/80 bg-muted/30 p-3.5 sm:p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Précision
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono text-foreground mt-1">
                {roundedAccuracy}%
              </div>
            </div>

            {/* Time */}
            <div className="rounded-2xl border border-border/80 bg-muted/30 p-3.5 sm:p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Temps
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono text-foreground mt-1">
                {durationMinutes} min
              </div>
            </div>
          </div>

          {/* Skills Practiced */}
          {(skills.length > 0 || category) && (
            <div className="space-y-2 pt-2 border-t border-border/60">
              <span className="text-xs font-semibold text-muted-foreground block">
                Compétences travaillées :
              </span>
              <div className="flex flex-wrap gap-2">
                {category && (
                  <Badge variant="outline" className="capitalize text-xs">
                    {category}
                  </Badge>
                )}
                {skills.map((skill, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs font-medium">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Recommended Next Activity Handoff */}
      {recommendation ? (
        <Card className="border-primary/30 bg-primary/5 shadow-xs overflow-hidden">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
              <Compass className="size-4" />
              <span>Prochaine activité recommandée</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" size="sm" className="capitalize text-[11px] bg-background">
                    {recommendation.category}
                  </Badge>
                  <Badge variant="secondary" size="sm" className="font-bold text-[11px]">
                    {recommendation.level}
                  </Badge>
                  {recommendation.duration_minutes && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="size-3" />
                      <span>{recommendation.duration_minutes} min</span>
                    </span>
                  )}
                </div>
                <h4 className="text-base font-bold text-foreground">
                  {recommendation.title}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {recommendation.reason}
                </p>
              </div>

              <Button
                onClick={() => onStartRecommendation?.(recommendation)}
                size="sm"
                className="shrink-0 cursor-pointer rounded-xl font-semibold gap-1.5 shadow-xs"
              >
                <span>Commencer</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-xs text-muted-foreground text-center italic">
          Votre prochaine recommandation sera calculée lors de votre prochaine session.
        </p>
      )}

      {/* 3. Bottom Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <Button
          variant="outline"
          size="lg"
          onClick={onRestart}
          className="w-full sm:flex-1 cursor-pointer rounded-xl font-semibold gap-2 border-border/80 hover:bg-muted"
        >
          <RotateCcw className="size-4" />
          <span>Recommencer cet exercice</span>
        </Button>

        <Button
          size="lg"
          onClick={onReturnToPractice}
          className="w-full sm:flex-1 cursor-pointer rounded-xl font-semibold gap-2 shadow-xs"
        >
          <span>Retour au catalogue de pratique</span>
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
