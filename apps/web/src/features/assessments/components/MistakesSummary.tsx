/**
 * MistakesSummary Component.
 * Presents an educational summary of mistakes grouped by competency
 * before expanding into detailed question reviews.
 */

import React, { useMemo } from "react"
import { AlertCircle, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { MistakeItem } from "../types"

export interface MistakesSummaryProps {
  mistakes: MistakeItem[]
  isReviewOpen: boolean
  onToggleReview: () => void
  className?: string
}

export const MistakesSummary: React.FC<MistakesSummaryProps> = ({
  mistakes = [],
  isReviewOpen,
  onToggleReview,
  className,
}) => {
  // Aggregate mistakes by skill_name
  const mistakesBySkill = useMemo(() => {
    const map: Record<string, number> = {}
    mistakes.forEach((m) => {
      const skill = m.skill_name || "Général"
      map[skill] = (map[skill] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [mistakes])

  if (mistakes.length === 0) {
    return (
      <Card className={cn("border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-2", className)}>
        <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
        <h3 className="text-sm font-bold text-foreground">Félicitations, aucune erreur !</h3>
        <p className="text-xs text-muted-foreground">
          Vous avez répondu correctement à l'intégralité des questions de cette épreuve.
        </p>
      </Card>
    )
  }

  return (
    <Card className={cn("border-border/80 bg-card shadow-xs", className)}>
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-destructive" />
            <CardTitle className="text-sm font-bold text-foreground">
              Synthèse des erreurs
            </CardTitle>
            <Badge variant="destructive" size="sm" className="font-mono text-[10px] ml-1">
              {mistakes.length} question{mistakes.length > 1 ? "s" : ""}
            </Badge>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleReview}
            className="cursor-pointer text-xs font-semibold gap-1.5 h-8 self-start sm:self-auto"
          >
            <span>Erreurs à revoir</span>
            {isReviewOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Vos erreurs se concentrent principalement sur les compétences suivantes :
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {mistakesBySkill.map(([skill, count]) => (
            <div
              key={skill}
              className="rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 flex items-center justify-between text-xs"
            >
              <span className="font-medium text-foreground truncate pr-2">{skill}</span>
              <Badge variant="secondary" size="sm" className="font-mono text-[10px] shrink-0">
                {count} erreur{count > 1 ? "s" : ""}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
