import React from "react";
import { Layers, FolderTree, Compass, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { SkillMetricsSummary } from "../types";

interface SkillsMetricsProps {
  metrics: SkillMetricsSummary | null;
  isLoading: boolean;
}

export const SkillsMetrics: React.FC<SkillsMetricsProps> = ({ metrics, isLoading }) => {
  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-muted/50 border border-border" />
        ))}
      </div>
    );
  }

  const hasWarnings = metrics.taxonomy_warnings_count > 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Total Skills */}
      <div className="bg-card border border-border/80 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
        <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Layers className="size-4.5" />
        </div>
        <div>
          <div className="text-xl font-bold tracking-tight text-foreground font-mono">
            {metrics.total_skills}
          </div>
          <div className="text-xs text-muted-foreground font-medium">Compétences racines</div>
        </div>
      </div>

      {/* Total Subskills */}
      <div className="bg-card border border-border/80 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
        <div className="size-9 rounded-lg bg-teal/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
          <FolderTree className="size-4.5" />
        </div>
        <div>
          <div className="text-xl font-bold tracking-tight text-foreground font-mono">
            {metrics.total_subskills}
          </div>
          <div className="text-xs text-muted-foreground font-medium">Sous-compétences</div>
        </div>
      </div>

      {/* Domains */}
      <div className="bg-card border border-border/80 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
        <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <Compass className="size-4.5" />
        </div>
        <div>
          <div className="text-xl font-bold tracking-tight text-foreground font-mono">
            {metrics.domains_count} / 7
          </div>
          <div className="text-xs text-muted-foreground font-medium">Domaines linguistiques</div>
        </div>
      </div>

      {/* Warnings / Health */}
      <div
        className={`border rounded-xl p-3.5 flex items-center gap-3 shadow-2xs ${
          hasWarnings
            ? "bg-amber-500/5 border-amber-500/30 text-amber-800 dark:text-amber-300"
            : "bg-emerald-500/5 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
        }`}
      >
        <div
          className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${
            hasWarnings
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {hasWarnings ? (
            <AlertTriangle className="size-4.5" />
          ) : (
            <CheckCircle2 className="size-4.5" />
          )}
        </div>
        <div>
          <div className="text-xl font-bold tracking-tight font-mono">
            {hasWarnings ? metrics.taxonomy_warnings_count : "100%"}
          </div>
          <div className="text-xs font-medium opacity-90">
            {hasWarnings ? "Avertissements taxonomie" : "Taxonomie conforme"}
          </div>
        </div>
      </div>
    </div>
  );
};
