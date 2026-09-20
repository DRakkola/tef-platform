import React from "react"
import { useNavigate } from "react-router-dom"
import { History, ArrowRight, Award, Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AssessmentHistoryItem } from "./types"

export interface AssessmentHistoryPreviewProps {
  lastAttempt?: AssessmentHistoryItem | null
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return "—"
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date)
  } catch {
    return dateString
  }
}

export const AssessmentHistoryPreview: React.FC<AssessmentHistoryPreviewProps> = ({
  lastAttempt,
}) => {
  const navigate = useNavigate()

  if (!lastAttempt) return null

  return (
    <Card
      data-testid="assessment-history-preview"
      className="border-border/80 bg-muted/20 shadow-2xs"
    >
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Votre dernière tentative
            </h4>
          </div>
          <Badge
            variant="outline"
            size="sm"
            className="text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          >
            Terminée
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="size-3.5" />
              <span>{formatDate(lastAttempt.submitted_at || lastAttempt.started_at)}</span>
            </div>

            {lastAttempt.score_percentage !== undefined && lastAttempt.score_percentage !== null && (
              <div>
                <span className="text-muted-foreground">Score : </span>
                <span className="font-mono font-bold text-foreground">
                  {lastAttempt.score_percentage}%
                </span>
              </div>
            )}

            {lastAttempt.estimated_level && (
              <div className="flex items-center gap-1">
                <Award className="size-3 text-primary" />
                <span className="font-mono font-semibold text-primary">
                  {lastAttempt.estimated_level}
                </span>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/attempts/${lastAttempt.id}/results`)}
            className="h-8 text-xs font-medium text-primary hover:text-primary/80 gap-1 px-2.5"
          >
            <span>Voir le résultat</span>
            <ArrowRight className="size-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
