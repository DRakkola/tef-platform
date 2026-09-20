/**
 * NextStepCard Component.
 * The primary actionable learning driver converting assessment performance
 * into immediate remedial exercises and targeted practice.
 */

import React from "react"
import { Zap, ArrowRight, Clock, BookOpen } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { RecommendedExerciseResult } from "../types"

export interface NextStepCardProps {
  primaryRecommendation?: RecommendedExerciseResult | null
  secondaryRecommendations?: RecommendedExerciseResult[]
  onStartExercise: (exerciseId: string) => void
  onExplorePractice: () => void
  className?: string
}

export const NextStepCard: React.FC<NextStepCardProps> = ({
  primaryRecommendation,
  secondaryRecommendations = [],
  onStartExercise,
  onExplorePractice,
  className,
}) => {
  if (!primaryRecommendation) {
    return (
      <Card className={cn("border-border/80 bg-card shadow-xs", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            <CardTitle className="text-sm font-bold text-foreground">
              Votre prochaine étape
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Poursuivez vos entraînements réguliers pour renforcer votre profil de préparation.
          </p>
          <Button
            type="button"
            onClick={onExplorePractice}
            size="sm"
            className="w-full cursor-pointer font-semibold text-xs gap-1.5 h-9"
          >
            <BookOpen className="size-3.5" />
            <span>Voir les exercices</span>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Primary Recommended Next Step */}
      <Card className="border-primary/40 bg-card shadow-sm ring-1 ring-primary/20 overflow-hidden">
        <div className="bg-primary/10 px-4 py-2 border-b border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-primary text-xs font-bold uppercase tracking-wider">
            <Zap className="size-3.5 fill-current" />
            <span>Votre prochaine étape</span>
          </div>
          <Badge variant="outline" size="sm" className="font-semibold text-[10px] border-primary/30 text-primary">
            Prioritaire
          </Badge>
        </div>

        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" size="sm" className="uppercase font-mono text-[10px]">
                {primaryRecommendation.category}
              </Badge>
              {primaryRecommendation.level && (
                <Badge variant="outline" size="sm" className="font-semibold text-[10px]">
                  Niveau {primaryRecommendation.level}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" />
                <span>15 min</span>
              </span>
            </div>

            <h3 className="text-base font-bold text-foreground leading-snug pt-1">
              {primaryRecommendation.title}
            </h3>

            {primaryRecommendation.target_skill_name && (
              <p className="text-xs text-primary font-medium">
                Compétence cible : {primaryRecommendation.target_skill_name}
              </p>
            )}
          </div>

          {/* Justification: "Pourquoi ?" */}
          {primaryRecommendation.reason && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs space-y-1">
              <span className="font-bold text-foreground block text-[11px]">
                Pourquoi cet exercice ?
              </span>
              <p className="text-muted-foreground leading-relaxed">
                {primaryRecommendation.reason}
              </p>
            </div>
          )}

          {/* Primary Action Button */}
          <Button
            type="button"
            onClick={() => onStartExercise(primaryRecommendation.id)}
            size="lg"
            className="w-full cursor-pointer font-bold text-xs sm:text-sm h-10 gap-2 shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <span>Démarrer l'exercice</span>
            <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Secondary Recommendations (Up to 2 additional) */}
      {secondaryRecommendations.length > 0 && (
        <Card className="border-border/80 bg-card shadow-xs">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Autres recommandations ciblées
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-3">
            {secondaryRecommendations.slice(0, 2).map((secRec) => (
              <div
                key={secRec.id}
                className="rounded-xl border border-border/60 bg-muted/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" size="sm" className="text-[10px] font-mono uppercase">
                      {secRec.category}
                    </Badge>
                    <span className="text-xs font-semibold text-foreground truncate">
                      {secRec.title}
                    </span>
                  </div>
                  {secRec.reason && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {secRec.reason}
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onStartExercise(secRec.id)}
                  className="cursor-pointer text-xs font-semibold gap-1 h-8 shrink-0 self-end sm:self-auto"
                >
                  <span>Commencer</span>
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
