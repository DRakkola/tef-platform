/**
 * Skill metric card showing current estimated score, CEFR level, previous measurement,
 * delta change, trajectory trend, confidence level, and calibration states.
 */

import React from "react"
import { TrendingUp, TrendingDown, Minus, ShieldAlert, Sparkles, Award } from "lucide-react"
import type { SkillSummaryMetric } from "./types"

export interface SkillMetricCardProps {
  metric: SkillSummaryMetric
}

export const SkillMetricCard: React.FC<SkillMetricCardProps> = ({ metric }) => {
  const {
    skill_name,
    category,
    current_score,
    previous_score,
    change,
    confidence,
    confidence_label,
    insufficient_data,
    trend,
    estimated_level,
    attempts_count,
  } = metric

  const getConfidenceBadgeClass = (label: string) => {
    switch (label) {
      case "High":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
      case "Moderate":
      case "Medium":
        return "bg-primary/15 text-primary border-primary/30"
      case "Low":
        return "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/25"
      case "Calibration":
      default:
        return "bg-muted text-muted-foreground border-border/70"
    }
  }

  const getTrendIcon = () => {
    if (trend === "improving" || (change !== null && change > 0)) {
      return <TrendingUp className="size-3.5 text-emerald-500" aria-hidden="true" />
    }
    if (trend === "declining" || (change !== null && change < 0)) {
      return <TrendingDown className="size-3.5 text-rose-500" aria-hidden="true" />
    }
    return <Minus className="size-3.5 text-muted-foreground" aria-hidden="true" />
  }

  return (
    <div
      data-testid={`skill-card-${metric.skill_id}`}
      className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs"
    >
      <div>
        {/* Category & Confidence Pills */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground font-mono">
            {category}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${getConfidenceBadgeClass(
              confidence_label
            )}`}
          >
            {insufficient_data && <Sparkles className="size-3 text-primary animate-pulse" aria-hidden="true" />}
            {confidence_label} ({Math.round(confidence * 100)}%)
          </span>
        </div>

        {/* Skill Name */}
        <h3 className="mt-3 font-semibold text-foreground line-clamp-1 text-sm" title={skill_name}>
          {skill_name}
        </h3>

        {/* Score & Level Display */}
        <div className="mt-4 flex items-baseline justify-between">
          {insufficient_data ? (
            <div className="flex flex-col">
              <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {current_score}%
              </span>
              <span className="mt-0.5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <ShieldAlert className="size-3 inline" aria-hidden="true" /> En cours d'étalonnage
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold font-mono tracking-tight text-foreground">
                {current_score}%
              </span>
              <span className="text-xs text-muted-foreground">score estimé</span>
            </div>
          )}

          {estimated_level && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary font-mono">
              <Award className="size-3" aria-hidden="true" />
              {estimated_level}
            </span>
          )}
        </div>
      </div>

      {/* Delta & Baseline Footer */}
      <div className="mt-5 border-t border-border/60 pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Tendance :</span>
          {change !== null ? (
            <span
              className={`inline-flex items-center gap-1 font-semibold font-mono tabular-nums ${
                change > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : change < 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-muted-foreground"
              }`}
            >
              {getTrendIcon()}
              {change > 0 ? `+${change}%` : `${change}%`}
            </span>
          ) : (
            <span className="text-muted-foreground italic">Mesure initiale</span>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono">
            {previous_score !== null
              ? `Précédent : ${previous_score}%`
              : "Aucune mesure antérieure"}
          </span>
          <span className="font-mono">{attempts_count} évaluation{attempts_count > 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  )
}
