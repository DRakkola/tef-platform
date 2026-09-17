/**
 * Skill metric card showing current estimated score, previous measurement,
 * delta change, confidence level, and calibration states.
 */

import React from "react";
import { TrendingUp, TrendingDown, Minus, ShieldAlert, Sparkles } from "lucide-react";
import type { SkillSummaryMetric } from "./types";

interface SkillMetricCardProps {
  metric: SkillSummaryMetric;
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
    attempts_count,
  } = metric;

  const getConfidenceBadgeColor = (label: string) => {
    switch (label) {
      case "High":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Moderate":
        return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      case "Low":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Calibration":
      default:
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    }
  };

  return (
    <div
      data-testid={`skill-card-${metric.skill_id}`}
      className="flex flex-col justify-between rounded-xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md transition-all hover:border-white/20 hover:shadow-lg"
    >
      <div>
        {/* Category & Confidence Pills */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-slate-400">
            {category}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getConfidenceBadgeColor(
              confidence_label
            )}`}
          >
            {insufficient_data && <Sparkles className="size-3 animate-pulse" />}
            {confidence_label} ({Math.round(confidence * 100)}%)
          </span>
        </div>

        {/* Skill Name */}
        <h3 className="mt-3 font-medium text-slate-100 line-clamp-1" title={skill_name}>
          {skill_name}
        </h3>

        {/* Score Display */}
        <div className="mt-4 flex items-baseline gap-2">
          {insufficient_data ? (
            <div className="flex flex-col">
              <span className="text-2xl font-bold tracking-tight text-purple-300">
                {current_score}%
              </span>
              <span className="mt-0.5 text-xs text-purple-400/80 flex items-center gap-1">
                <ShieldAlert className="size-3 inline" /> En cours d'étalonnage
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight text-white">
                {current_score}%
              </span>
              <span className="text-xs text-slate-400">score estimé</span>
            </div>
          )}
        </div>
      </div>

      {/* Delta & Baseline Footer */}
      <div className="mt-5 border-t border-white/5 pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Évolution :</span>
          {change !== null ? (
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                change > 0
                  ? "text-emerald-400"
                  : change < 0
                  ? "text-rose-400"
                  : "text-slate-400"
              }`}
            >
              {change > 0 ? (
                <TrendingUp className="size-3.5" />
              ) : change < 0 ? (
                <TrendingDown className="size-3.5" />
              ) : (
                <Minus className="size-3.5" />
              )}
              {change > 0 ? `+${change}%` : `${change}%`}
            </span>
          ) : (
            <span className="text-slate-400 italic">Mesure initiale</span>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            {previous_score !== null
              ? `Précédent : ${previous_score}%`
              : "Aucune mesure antérieure"}
          </span>
          <span>{attempts_count} évaluation{attempts_count > 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
};
