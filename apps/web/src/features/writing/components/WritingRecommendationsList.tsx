/**
 * WritingRecommendationsList Component.
 * Displays actionable practice recommendations connecting writing mistakes
 * to specific curriculum exercises and targeted practice.
 */

import React from "react"
import { Sparkles, ArrowRight, Layers, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { WritingRecommendation } from "../types"

export interface WritingRecommendationsListProps {
  recommendations: WritingRecommendation[]
  onActionClick?: (rec: WritingRecommendation) => void
}

export const WritingRecommendationsList: React.FC<WritingRecommendationsListProps> = ({
  recommendations,
  onActionClick,
}) => {
  if (recommendations.length === 0) return null

  return (
    <section
      aria-label="Recommandations d'entraînement"
      className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-5"
    >
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
            Recommandations d'entraînement personnalisées
          </h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Activités sélectionnées pour combler directement les points d'amélioration identifiés dans votre copie.
        </p>
      </div>

      {/* Recommendations Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className="rounded-xl border border-border/70 bg-muted/20 p-4 flex flex-col justify-between space-y-3 hover:border-border transition-colors"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {rec.category}
                </Badge>
                {rec.level && (
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    Niveau {rec.level}
                  </Badge>
                )}
              </div>

              <h4 className="text-sm font-semibold text-foreground leading-snug">
                {rec.title}
              </h4>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {rec.reason}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <Layers className="size-3 text-primary" />
                <span>{rec.skill_name}</span>
              </span>

              <Button
                size="sm"
                variant="outline"
                onClick={() => onActionClick?.(rec)}
                className="h-8 text-xs gap-1.5 cursor-pointer rounded-xl font-medium"
              >
                <span>{rec.action_label || "S'entraîner"}</span>
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Subtle Learning Loop Footer */}
      <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground font-medium">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
          <span>Boucle d'apprentissage : Soumission → Diagnostic → Recommandations ciblées</span>
        </span>
        <span>Progression continue TEF</span>
      </div>
    </section>
  )
}
