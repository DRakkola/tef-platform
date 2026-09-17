/**
 * Historical progress chart component showing chronological measurement points
 * without overwriting previous assessment logs.
 */

import React from "react";
import { Calendar, Award, BookOpen, Mic, PenLine } from "lucide-react";
import type { ProgressDataPoint } from "./types";

interface HistoricalProgressChartProps {
  timeline: ProgressDataPoint[];
}

export const HistoricalProgressChart: React.FC<HistoricalProgressChartProps> = ({
  timeline,
}) => {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-slate-900/40 p-8 text-center text-slate-400">
        <Award className="size-10 text-slate-600 mb-2" />
        <p className="font-medium text-slate-300">Aucun historique de progression</p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Complétez des tests blancs, rédactions ou sessions orales pour voir votre courbe d'apprentissage se dessiner.
        </p>
      </div>
    );
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "assessment":
        return <BookOpen className="size-3.5 text-blue-400" />;
      case "writing":
        return <PenLine className="size-3.5 text-amber-400" />;
      case "speaking":
        return <Mic className="size-3.5 text-emerald-400" />;
      default:
        return <Award className="size-3.5 text-purple-400" />;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("fr-FR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">Trajectoire d'apprentissage</h3>
          <p className="text-xs text-slate-400">
            Historique chronologique immuable des évaluations passées
          </p>
        </div>
        <span className="rounded-md bg-white/5 px-2.5 py-1 text-xs text-slate-400">
          {timeline.length} mesure{timeline.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Visual Timeline Bar & Steps */}
      <div className="space-y-3 mt-4">
        {timeline.map((point, idx) => (
          <div
            key={`${point.timestamp}-${idx}`}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-950/40 p-3.5 transition-colors hover:bg-slate-950/70"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-white/5">
                {getSourceIcon(point.source_type)}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200 line-clamp-1">
                  {point.assessment_title}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" /> {formatDate(point.timestamp)}
                  </span>
                  <span>•</span>
                  <span className="capitalize">{point.source_type}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span
                className={`text-lg font-bold ${
                  point.overall_score >= 75
                    ? "text-emerald-400"
                    : point.overall_score >= 60
                    ? "text-sky-400"
                    : "text-amber-400"
                }`}
              >
                {point.overall_score}%
              </span>
              <div className="w-20 bg-white/10 rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    point.overall_score >= 75
                      ? "bg-emerald-400"
                      : point.overall_score >= 60
                      ? "bg-sky-400"
                      : "bg-amber-400"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, point.overall_score))}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
