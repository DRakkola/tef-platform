/**
 * ResultHistory Component.
 * Compact historical list of recent assessment attempts with links to full progress tracking.
 */

import React from "react"
import { History, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AssessmentHistoryItem } from "../types"

export interface ResultHistoryProps {
  history: AssessmentHistoryItem[]
  currentAttemptId?: string
  onViewAllHistory: () => void
  className?: string
}

export const ResultHistory: React.FC<ResultHistoryProps> = ({
  history = [],
  currentAttemptId,
  onViewAllHistory,
  className,
}) => {
  // Filter out current attempt and limit to 3 recent attempts
  const recentAttempts = history
    .filter((h) => h.id !== currentAttemptId && h.status === "submitted")
    .slice(0, 3)

  if (recentAttempts.length === 0) return null

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
    } catch {
      return ""
    }
  }

  return (
    <Card className={cn("border-border/80 bg-card shadow-xs", className)}>
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-bold text-foreground">
              Historique récent
            </CardTitle>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {recentAttempts.length} épreuve{recentAttempts.length > 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-3 space-y-2.5">
        {recentAttempts.map((item) => {
          const score = typeof item.score_percentage === "number" ? Math.round(item.score_percentage) : null

          return (
            <div
              key={item.id}
              className="rounded-xl border border-border/60 bg-muted/20 p-2.5 flex items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <span className="font-semibold text-foreground truncate block">
                  {item.title}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(item.started_at)}
                  {item.estimated_level ? ` • Niveau ${item.estimated_level}` : ""}
                </span>
              </div>

              {score !== null && (
                <Badge variant="outline" size="sm" className="font-mono font-bold text-xs shrink-0">
                  {score}%
                </Badge>
              )}
            </div>
          )
        })}

        <div className="pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onViewAllHistory}
            className="w-full cursor-pointer text-xs font-semibold text-primary gap-1 h-8 justify-center"
          >
            <span>Voir toute ma progression</span>
            <ArrowRight className="size-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
