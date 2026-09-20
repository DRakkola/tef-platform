import React from "react"
import { useNavigate } from "react-router-dom"
import {
  History,
  Clock,
  ArrowRight,
  Headphones,
  BookOpen,
  Layers,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/EmptyState"
import type { AssessmentHistoryItem, AttemptStatus } from "./types"

export interface AssessmentHistoryProps {
  history: AssessmentHistoryItem[]
  isLoading?: boolean
  onStartFirst?: () => void
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

function getStatusBadge(status: AttemptStatus) {
  switch (status) {
    case "submitted":
      return (
        <Badge variant="outline" size="sm" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-medium">
          Terminé
        </Badge>
      )
    case "started":
      return (
        <Badge variant="outline" size="sm" className="bg-primary/10 text-primary border-primary/25 text-[11px] font-medium animate-pulse">
          En cours
        </Badge>
      )
    case "expired":
      return (
        <Badge variant="outline" size="sm" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[11px] font-medium">
          Expiré
        </Badge>
      )
    case "abandoned":
      return (
        <Badge variant="outline" size="sm" className="text-muted-foreground text-[11px] font-medium">
          Abandonné
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" size="sm" className="text-muted-foreground text-[11px] font-medium">
          {status}
        </Badge>
      )
  }
}

export const AssessmentHistory: React.FC<AssessmentHistoryProps> = ({
  history,
  isLoading = false,
  onStartFirst,
}) => {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <section className="space-y-4" aria-labelledby="history-heading">
        <div className="flex items-center gap-2">
          <History className="size-5 text-muted-foreground" />
          <h2 id="history-heading" className="text-xl font-bold tracking-tight text-foreground">
            Historique des évaluations
          </h2>
        </div>
        <Card className="border-border/60">
          <CardContent className="p-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-4 sm:space-y-6" aria-labelledby="history-heading">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <History className="size-4" />
          </div>
          <div>
            <h2 id="history-heading" className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Historique des évaluations
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Vos résultats passés, scores NCLC et bilans de performance.
            </p>
          </div>
        </div>

        {history.length > 0 && (
          <Badge variant="outline" size="sm" className="text-xs font-mono">
            {history.length} {history.length > 1 ? "tentatives" : "tentative"}
          </Badge>
        )}
      </div>

      {history.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Aucune évaluation passée"
          description="Vous n'avez pas encore passé d'évaluation. Démarrez une simulation pour obtenir votre diagnostic de niveau et votre étalonnage NCLC."
          actionLabel="Commencer une évaluation"
          onAction={onStartFirst}
        />
      ) : (
        <Card className="overflow-hidden border-border/80">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border/60 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th scope="col" className="py-3.5 px-4 font-semibold">Épreuve</th>
                  <th scope="col" className="py-3.5 px-4 font-semibold">Date</th>
                  <th scope="col" className="py-3.5 px-4 font-semibold">Statut</th>
                  <th scope="col" className="py-3.5 px-4 font-semibold">Score</th>
                  <th scope="col" className="py-3.5 px-4 font-semibold">Niveau estimé</th>
                  <th scope="col" className="py-3.5 px-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {history.map((item) => {
                  const isListening = item.assessment_type === "listening"
                  const isReading = item.assessment_type === "reading"
                  const TypeIcon = isListening ? Headphones : isReading ? BookOpen : Layers

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/20 transition-colors group"
                      data-testid={`history-row-${item.id}`}
                    >
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        <div className="flex items-center gap-2.5">
                          <TypeIcon className="size-4 text-muted-foreground shrink-0" />
                          <span className="line-clamp-1">{item.title}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDate(item.submitted_at || item.started_at)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-foreground whitespace-nowrap">
                        {item.score_percentage !== undefined && item.score_percentage !== null ? (
                          <span className="text-primary">{item.score_percentage}%</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.estimated_level ? (
                          <Badge variant="outline" size="sm" className="font-mono text-[11px]">
                            {item.estimated_level}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {item.status === "started" ? (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/attempts/${item.id}`)}
                            className="h-8 text-xs font-semibold gap-1.5"
                          >
                            <span>Reprendre</span>
                            <ArrowRight className="size-3" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/attempts/${item.id}/results`)}
                            className="h-8 text-xs font-medium hover:text-primary gap-1.5"
                          >
                            <span>Voir le résultat</span>
                            <ArrowRight className="size-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Feed View */}
          <div className="md:hidden divide-y divide-border/60">
            {history.map((item) => {
              const isListening = item.assessment_type === "listening"
              const isReading = item.assessment_type === "reading"
              const TypeIcon = isListening ? Headphones : isReading ? BookOpen : Layers

              return (
                <div
                  key={item.id}
                  className="p-4 space-y-3 hover:bg-muted/15 transition-colors"
                  data-testid={`history-mobile-card-${item.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <TypeIcon className="size-3.5" />
                        <span>{formatDate(item.submitted_at || item.started_at)}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                        {item.title}
                      </h4>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-muted-foreground">Score: </span>
                        <span className="font-mono font-semibold text-foreground">
                          {item.score_percentage !== undefined && item.score_percentage !== null
                            ? `${item.score_percentage}%`
                            : "—"}
                        </span>
                      </div>
                      {item.estimated_level && (
                        <div>
                          <span className="text-muted-foreground">Niveau: </span>
                          <span className="font-mono font-semibold text-primary">
                            {item.estimated_level}
                          </span>
                        </div>
                      )}
                    </div>

                    {item.status === "started" ? (
                      <Button
                        size="sm"
                        onClick={() => navigate(`/attempts/${item.id}`)}
                        className="h-7 text-xs font-semibold gap-1"
                      >
                        <span>Reprendre</span>
                        <ArrowRight className="size-3" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/attempts/${item.id}/results`)}
                        className="h-7 text-xs font-medium text-primary hover:text-primary/80 gap-1 px-2"
                      >
                        <span>Résultat</span>
                        <ArrowRight className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </section>
  )
}
