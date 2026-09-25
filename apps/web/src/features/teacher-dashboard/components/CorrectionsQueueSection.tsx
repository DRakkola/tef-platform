import React from "react"
import { Link } from "react-router-dom"
import { PenTool, CheckCircle2, ArrowRight, RefreshCw, AlertTriangle } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TeacherWritingQueueItem } from "../types"

interface CorrectionsQueueSectionProps {
  corrections: TeacherWritingQueueItem[]
  isLoading: boolean
  isError: boolean
  error?: Error | null
  onRetry: () => void
}

function formatRelativeTime(isoDate: string): string {
  try {
    const diffMs = Date.now() - new Date(isoDate).getTime()
    const diffMinutes = Math.max(1, Math.floor(diffMs / (60 * 1000)))
    if (diffMinutes < 60) return `Soumise il y a ${diffMinutes} min`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `Soumise il y a ${diffHours} h`
    const diffDays = Math.floor(diffHours / 24)
    return `Soumise il y a ${diffDays} j`
  } catch {
    return "Soumise récemment"
  }
}

export const CorrectionsQueueSection: React.FC<CorrectionsQueueSectionProps> = ({
  corrections,
  isLoading,
  isError,
  error,
  onRetry,
}) => {
  return (
    <Card id="corrections-queue" className="border-border/70 shadow-xs">
      <CardHeader className="p-5 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <PenTool className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Corrections à traiter
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Copies d'expression écrite assignées ou en file d'attente
            </p>
          </div>
        </div>
        <Link to="/writing">
          <Button variant="ghost" size="sm" className="text-xs gap-1 h-8">
            <span>Atelier d'écriture</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-5">
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/30">
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-muted rounded-sm" />
                  <div className="h-3 w-56 bg-muted/60 rounded-sm" />
                </div>
                <div className="h-8 w-20 bg-muted rounded-md" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-6 text-center space-y-3 rounded-xl border border-destructive/20 bg-destructive/5" role="alert">
            <AlertTriangle className="size-8 text-destructive mx-auto" />
            <h4 className="text-sm font-semibold text-foreground">
              Impossible de charger les corrections
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {error?.message || "Une erreur est survenue lors du chargement des copies à corriger."}
            </p>
            <Button size="sm" variant="outline" onClick={onRetry} className="text-xs gap-1.5">
              <RefreshCw className="size-3.5" />
              Réessayer
            </Button>
          </div>
        ) : corrections.length === 0 ? (
          <div className="p-8 text-center space-y-2.5 rounded-xl border border-dashed border-border/70 bg-muted/10">
            <CheckCircle2 className="size-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium text-foreground">
              Vous n'avez aucune correction en attente.
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Toutes les rédactions soumises par les étudiants ont été évaluées.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {corrections.map((item) => {
              const relativeTime = formatRelativeTime(item.submitted_at)

              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-colors gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {item.task_title}
                      </span>
                      <Badge
                        variant={item.status === "ASSIGNED" ? "default" : "secondary"}
                        className="text-[10px] uppercase font-semibold"
                      >
                        {item.status === "ASSIGNED" ? "Assignée" : "En attente"}
                      </Badge>
                      {item.priority === "urgent" && (
                        <Badge variant="destructive" className="text-[10px] uppercase font-semibold">
                          Prioritaire
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{relativeTime}</span>
                      <span>•</span>
                      <span>{item.student_identifier}</span>
                      <span>•</span>
                      <span>{item.word_count} mots</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="text-xs h-8 gap-1.5 self-end sm:self-center"
                    asChild
                  >
                    <Link to={`/writing/attempts/${item.attempt_id}/result`}>
                      <PenTool className="size-3.5" />
                      Corriger
                    </Link>
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
