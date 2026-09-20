/**
 * ProgressOverview component: Answers "Am I improving?".
 * Displays historical learning trajectory with time-range filters (7j, 30j, 90j, Tout)
 * and discrete calibration milestones without deceptive interpolations for sparse data.
 */

import React, { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  TrendingUp,
  BookOpen,
  PenLine,
  Mic,
  Award,
  Calendar,
  AlertTriangle,
  RotateCcw,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { ProgressDataPoint } from "./types"

export type TimeRange = "7d" | "30d" | "90d" | "all"

export interface ProgressOverviewProps {
  timeline?: ProgressDataPoint[]
  isLoading?: boolean
  error?: Error | null
  onRetry?: () => void
}

export const ProgressOverview: React.FC<ProgressOverviewProps> = ({
  timeline = [],
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const navigate = useNavigate()
  const [range, setRange] = useState<TimeRange>("all")

  // Filter timeline according to selected range
  const filteredTimeline = useMemo(() => {
    if (!timeline || timeline.length === 0) return []
    if (range === "all") return timeline

    const now = new Date().getTime()
    const daysMap: Record<TimeRange, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
      "all": Infinity,
    }
    const maxAgeMs = daysMap[range] * 24 * 60 * 60 * 1000

    return timeline.filter((point) => {
      const pointTime = new Date(point.timestamp).getTime()
      return !isNaN(pointTime) && now - pointTime <= maxAgeMs
    })
  }, [timeline, range])

  const getSourceMeta = (source: string) => {
    switch (source) {
      case "assessment":
        return {
          icon: <BookOpen className="size-3.5 text-primary" aria-hidden="true" />,
          label: "Simulation",
        }
      case "writing":
        return {
          icon: <PenLine className="size-3.5 text-amber-500" aria-hidden="true" />,
          label: "Écriture",
        }
      case "speaking":
        return {
          icon: <Mic className="size-3.5 text-emerald-500" aria-hidden="true" />,
          label: "Oral",
        }
      default:
        return {
          icon: <Award className="size-3.5 text-sky-500" aria-hidden="true" />,
          label: "Exercice",
        }
    }
  }

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString("fr-FR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return isoString
    }
  }

  // 1. Error state (isolated to this component)
  if (error) {
    return (
      <Card className="shadow-2xs border-border/70 bg-card">
        <CardContent className="p-6 text-center space-y-3">
          <AlertTriangle className="size-8 text-amber-500 mx-auto" aria-hidden="true" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              Données de trajectoire temporairement indisponibles
            </h3>
            <p className="text-xs text-muted-foreground">
              {error.message || "Une erreur est survenue lors de la synchronisation de votre historique."}
            </p>
          </div>
          {onRetry && (
            <Button
              size="xs"
              variant="outline"
              onClick={onRetry}
              className="gap-1.5 cursor-pointer text-xs"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              <span>Réessayer</span>
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-2xs border-border/70 bg-card">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="icon-box icon-box-sm icon-box-accent">
              <TrendingUp className="size-4" aria-hidden="true" />
            </div>
            <CardTitle className="text-base font-semibold text-foreground font-display">
              Trajectoire d'apprentissage
            </CardTitle>
            {timeline.length > 0 && (
              <span className="text-xs font-mono text-muted-foreground">
                ({timeline.length} mesure{timeline.length > 1 ? "s" : ""})
              </span>
            )}
          </div>
          <CardDescription className="text-xs">
            Évolution chronologique de vos scores et validations d'épreuves.
          </CardDescription>
        </div>

        {/* Time-range filter pills */}
        {timeline.length > 0 && (
          <div
            role="group"
            aria-label="Filtre temporel de progression"
            className="flex items-center gap-1 rounded-xl border border-border/70 bg-muted/40 p-1 self-start sm:self-auto select-none"
          >
            {(["7d", "30d", "90d", "all"] as TimeRange[]).map((r) => {
              const labels: Record<TimeRange, string> = {
                "7d": "7j",
                "30d": "30j",
                "90d": "90j",
                "all": "Tout",
              }
              const isActive = range === r
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-card text-foreground shadow-2xs font-semibold border border-border/60"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {labels[r]}
                </button>
              )
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Loading state */}
        {isLoading ? (
          <div className="space-y-2 py-4 animate-pulse">
            <div className="h-14 rounded-lg bg-muted/40" />
            <div className="h-14 rounded-lg bg-muted/30" />
          </div>
        ) : timeline.length === 0 ? (
          /* Empty state for brand new student */
          <div className="p-6 rounded-xl border border-dashed border-border/70 text-center space-y-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mx-auto">
              <Award className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Aucun historique de progression enregistré
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Complétez votre premier test blanc ou exercice noté pour voir votre courbe d'apprentissage se dessiner.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => navigate("/assessments")}
              className="text-xs cursor-pointer gap-1.5"
            >
              <span>Passer une évaluation</span>
            </Button>
          </div>
        ) : filteredTimeline.length === 0 ? (
          /* Empty for the selected filter */
          <div className="p-6 rounded-xl border border-border/50 text-center text-xs text-muted-foreground">
            Aucune évaluation enregistrée pour la période sélectionnée ({range === "7d" ? "7 derniers jours" : range === "30d" ? "30 derniers jours" : "90 derniers jours"}).
          </div>
        ) : (
          /* Populated timeline */
          <div className="space-y-3">
            {/* If sparse data (1-2 points), show transparent calibration indicator */}
            {timeline.length <= 2 && (
              <div className="p-2.5 rounded-lg border border-border/50 bg-muted/20 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Étalonnage en cours : points de mesure individuels (pas d'interpolation artificielle).</span>
                <span className="font-mono text-xs font-semibold">{timeline.length}/3 requis</span>
              </div>
            )}

            <div className="space-y-2">
              {filteredTimeline.map((point, idx) => {
                const meta = getSourceMeta(point.source_type)
                const isPassing = point.overall_score >= 70
                return (
                  <div
                    key={`${point.timestamp}-${idx}`}
                    className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-3.5 hover:bg-muted/30 transition-colors gap-4"
                  >
                    {/* Source Icon & Title */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-muted shrink-0">
                        {meta.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                          {point.assessment_title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="size-3" aria-hidden="true" />
                            {formatDate(point.timestamp)}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{meta.label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Score badge & mini bar */}
                    <div className="text-right shrink-0">
                      <span
                        className={`text-base font-bold font-mono tabular-nums ${
                          isPassing ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {point.overall_score}%
                      </span>
                      <div className="w-16 sm:w-20 bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isPassing ? "bg-emerald-600" : "bg-amber-600"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, point.overall_score))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
