/**
 * SkillBreakdown Component.
 * Displays mastery per linguistic subskill with compact progress indicators
 * and progressive disclosure ([Voir toutes les compétences]).
 */

import React, { useState } from "react"
import { Target, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface SkillBreakdownProps {
  skillScores: Record<string, any>
  initialLimit?: number
  className?: string
}

export const SkillBreakdown: React.FC<SkillBreakdownProps> = ({
  skillScores,
  initialLimit = 4,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false)

  const entries = Object.entries(skillScores || {})
  if (entries.length === 0) return null

  const displayedEntries = isExpanded ? entries : entries.slice(0, initialLimit)
  const hasMore = entries.length > initialLimit

  return (
    <Card className={cn("border-border/80 bg-card shadow-xs", className)}>
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-primary" />
            <CardTitle className="text-sm font-bold text-foreground">
              Performance détaillée par compétence
            </CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            {entries.length} compétence{entries.length > 1 ? "s" : ""} analysée{entries.length > 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {displayedEntries.map(([skillName, scoreVal]: [string, any]) => {
            const pct =
              typeof scoreVal === "number"
                ? Math.round(scoreVal)
                : typeof scoreVal?.percentage === "number"
                ? Math.round(scoreVal.percentage)
                : 0

            const estimatedLevel =
              typeof scoreVal === "object" && scoreVal?.level ? scoreVal.level : null

            return (
              <div
                key={skillName}
                className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground truncate block">
                      {skillName}
                    </span>
                    {estimatedLevel && (
                      <span className="text-[10px] text-muted-foreground">
                        Niveau : {estimatedLevel}
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-foreground font-mono shrink-0 ml-2">
                    {pct}%
                  </span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Compétence ${skillName} : ${pct}%`}
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-primary" : "bg-amber-500"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {hasMore && (
          <div className="pt-2 text-center border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="cursor-pointer text-xs font-semibold text-primary gap-1.5 h-8"
            >
              <span>
                {isExpanded
                  ? "Réduire l'affichage des compétences"
                  : `Voir toutes les compétences (${entries.length})`}
              </span>
              {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
