/**
 * Historical progress chart component showing chronological measurement points
 * without overwriting previous assessment logs.
 */

import React from "react"
import { Calendar, Award, BookOpen, Mic, PenLine } from "lucide-react"
import type { ProgressDataPoint } from "./types"

export interface HistoricalProgressChartProps {
  timeline: ProgressDataPoint[]
}

export const HistoricalProgressChart: React.FC<HistoricalProgressChartProps> = ({
  timeline,
}) => {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center text-muted-foreground shadow-2xs">
        <Award className="size-10 text-muted-foreground/60 mb-2" aria-hidden="true" />
        <p className="font-semibold text-foreground">Aucun historique de progression</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Complétez des tests blancs, rédactions ou sessions orales pour voir votre courbe d'apprentissage se dessiner.
        </p>
      </div>
    )
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "assessment":
        return <BookOpen className="size-3.5 text-primary" aria-hidden="true" />
      case "writing":
        return <PenLine className="size-3.5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
      case "speaking":
        return <Mic className="size-3.5 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
      default:
        return <Award className="size-3.5 text-sky-700 dark:text-sky-300" aria-hidden="true" />
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

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-2xs">
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="font-semibold text-foreground">Trajectoire d'apprentissage</h3>
          <p className="text-xs text-muted-foreground">
            Historique chronologique immuable des évaluations passées
          </p>
        </div>
        <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-mono text-muted-foreground">
          {timeline.length} mesure{timeline.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Visual Timeline Bar & Steps */}
      <div className="space-y-2.5 mt-4">
        {timeline.map((point, idx) => (
          <div
            key={`${point.timestamp}-${idx}`}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/15 p-3.5 transition-colors hover:bg-muted/30 gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted shrink-0">
                {getSourceIcon(point.source_type)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {point.assessment_title}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-mono">
                    <Calendar className="size-3" aria-hidden="true" /> {formatDate(point.timestamp)}
                  </span>
                  <span>•</span>
                  <span className="capitalize">{point.source_type}</span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span
                className={`text-base font-bold font-mono tabular-nums ${
                  point.overall_score >= 75
                    ? "text-emerald-700 dark:text-emerald-300"
                    : point.overall_score >= 60
                    ? "text-primary"
                    : "text-amber-800 dark:text-amber-300"
                }`}
              >
                {point.overall_score}%
              </span>
              <div className="w-20 bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    point.overall_score >= 75
                      ? "bg-emerald-500"
                      : point.overall_score >= 60
                      ? "bg-primary"
                      : "bg-amber-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, point.overall_score))}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
