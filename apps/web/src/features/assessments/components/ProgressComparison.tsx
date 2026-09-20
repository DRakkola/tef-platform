/**
 * ProgressComparison Component.
 * Displays comparative trajectory between current and previous comparable assessment.
 * Strictly guarded: only renders when assessments are meaningfully comparable.
 */

import React from "react"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ProgressComparisonData } from "../types"

export interface ProgressComparisonProps {
  currentScorePercentage: number
  comparison?: ProgressComparisonData | null
  className?: string
}

export const ProgressComparison: React.FC<ProgressComparisonProps> = ({
  currentScorePercentage,
  comparison,
  className,
}) => {
  if (!comparison || !comparison.isComparable) return null

  const currentScore = Math.round(currentScorePercentage)
  const prevScore = Math.round(comparison.previousAttempt.score_percentage || 0)
  const delta = comparison.scoreDelta

  return (
    <Card className={cn("border-border/80 bg-card shadow-xs", className)}>
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <CardTitle className="text-sm font-bold text-foreground">
              Votre progression
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            size="sm"
            className={cn(
              "font-mono text-xs font-bold gap-1",
              delta > 0
                ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                : delta < 0
                ? "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
                : "text-muted-foreground border-border"
            )}
          >
            {delta > 0 ? (
              <>
                <TrendingUp className="size-3" />
                <span>+{delta} points</span>
              </>
            ) : delta < 0 ? (
              <>
                <TrendingDown className="size-3" />
                <span>{delta} points</span>
              </>
            ) : (
              <>
                <Minus className="size-3" />
                <span>Stable</span>
              </>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          {/* Previous Assessment */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Évaluation précédente
            </span>
            <div className="text-xl font-bold text-muted-foreground font-mono">
              {prevScore}%
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              {comparison.previousAttempt.title}
            </p>
          </div>

          {/* Current Assessment */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-primary block">
              Évaluation actuelle
            </span>
            <div className="text-xl font-bold text-foreground font-mono">
              {currentScore}%
            </div>
            <p className="text-[10px] text-primary font-medium">
              Résultat du jour
            </p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-3">
          Comparaison établie par rapport à votre dernière simulation équivalente.
        </p>
      </CardContent>
    </Card>
  )
}
