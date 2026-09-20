/**
 * SectionResults Component.
 * Displays comparative performance per assessment section with scores,
 * points awarded, and relative mastery indicators.
 */

import React from "react"
import { Layers } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { SectionResult } from "../types"

export interface SectionResultsProps {
  sections: SectionResult[]
  className?: string
}

export const SectionResults: React.FC<SectionResultsProps> = ({ sections, className }) => {
  if (!sections || sections.length === 0) return null

  return (
    <Card className={cn("border-border/80 bg-card shadow-xs", className)}>
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            <CardTitle className="text-sm font-bold text-foreground">
              Résultats par section d'épreuve
            </CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            {sections.length} section{sections.length > 1 ? "s" : ""} évaluée{sections.length > 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sections.map((section, sIdx) => {
            const totalSectionQuestions = section.questions.length
            const correctCount = section.questions.filter((q) => q.user_answer?.is_correct).length
            const totalPoints = section.questions.reduce((sum, q) => sum + (q.user_answer?.points_awarded || 0), 0)
            const maxPoints = section.questions.reduce((sum, q) => sum + q.points, 0)
            const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0

            const getStatusBadge = () => {
              if (percentage >= 75) {
                return (
                  <Badge variant="outline" size="sm" className="text-[10px] border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10">
                    Maîtrisé
                  </Badge>
                )
              }
              if (percentage >= 50) {
                return (
                  <Badge variant="outline" size="sm" className="text-[10px] border-primary/30 text-primary bg-primary/10">
                    En consolidation
                  </Badge>
                )
              }
              return (
                <Badge variant="outline" size="sm" className="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/10">
                  À renforcer
                </Badge>
              )
            }

            return (
              <div
                key={section.id || sIdx}
                className="rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground block">
                      Section {sIdx + 1}
                    </span>
                    <h4 className="text-sm font-bold text-foreground truncate mt-0.5">
                      {section.title}
                    </h4>
                  </div>
                  {getStatusBadge()}
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-2xl font-black text-foreground font-mono">
                    {percentage}%
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {correctCount}/{totalSectionQuestions} correctes ({totalPoints}/{maxPoints} pts)
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    role="progressbar"
                    aria-valuenow={percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Score ${section.title} : ${percentage}%`}
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      percentage >= 75
                        ? "bg-emerald-500"
                        : percentage >= 50
                        ? "bg-primary"
                        : "bg-amber-500"
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
