import React from "react"
import { Link, useNavigate } from "react-router-dom"
import { Clock, ArrowRight, CheckCircle2, RotateCcw } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getCategoryMeta } from "./PracticeRecommendationCard"
import type { RecentPracticeAttempt } from "./types"

export interface RecentPracticeProps {
  attempts: RecentPracticeAttempt[]
  onViewAll?: () => void
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) return "Il y a quelques instants"
    if (diffHours < 24) return `Il y a ${diffHours} heure${diffHours > 1 ? "s" : ""}`
    if (diffDays === 1) return "Hier"
    if (diffDays < 7) return `Il y a ${diffDays} jours`
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
  } catch {
    return "Récemment"
  }
}

export const RecentPractice: React.FC<RecentPracticeProps> = ({
  attempts,
  onViewAll,
}) => {
  const navigate = useNavigate()

  if (attempts.length === 0) {
    return null
  }

  return (
    <Card data-testid="recent-practice" className="border-border/70 bg-card shadow-2xs">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Clock className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Entraînements récents
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Vos derniers exercices complétés et résultats obtenus.
              </p>
            </div>
          </div>

          <Link
            to="/progress"
            onClick={onViewAll}
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
          >
            <span>Voir toute votre progression</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-1">
        <div className="divide-y divide-border/60">
          {attempts.slice(0, 4).map((attempt) => {
            const meta = getCategoryMeta(attempt.category)
            const Icon = meta.icon

            return (
              <div
                key={attempt.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                    <Icon className="size-4" />
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {attempt.title}
                      </span>
                      {attempt.level && (
                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                          {attempt.level}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{meta.label}</span>
                      <span>•</span>
                      <span>{formatRelativeTime(attempt.attempted_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-11 sm:pl-0">
                  {attempt.is_correct ? (
                    <Badge variant="secondary" className="gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 text-xs font-semibold">
                      <CheckCircle2 className="size-3" />
                      <span>Réussi</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-500/30">
                      À consolider
                    </Badge>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/exercises/${attempt.exercise_id}`)}
                    className="cursor-pointer text-xs h-8 text-muted-foreground hover:text-foreground gap-1"
                  >
                    <RotateCcw className="size-3" />
                    <span>Revoir</span>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
