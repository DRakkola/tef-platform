import React from "react";
import { Brain, Languages, Layers, Network, Award } from "lucide-react";
import type { TaxonomyMetricsSummary } from "../types";

interface SkillsMetricsProps {
  metrics: TaxonomyMetricsSummary | null;
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

  const reasoningCount = metrics.dimensions_breakdown?.reasoning || 0;
  const languageCount = metrics.dimensions_breakdown?.language || 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {/* Total Competencies */}
      <div className="bg-card border border-border/80 rounded-xl p-3 flex items-center gap-3 shadow-2xs">
        <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Layers className="size-4.5" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold tracking-tight text-foreground font-mono">
            {metrics.total_competencies}
          </div>
          <div className="text-[11px] text-muted-foreground font-medium truncate">
            {metrics.total_skills} racines · {metrics.total_subskills} sous-comp.
          </div>
        </div>
      </div>

      {/* Reasoning (Cognitive) */}
      <div className="bg-card border border-border/80 rounded-xl p-3 flex items-center gap-3 shadow-2xs">
        <div className="size-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
          <Brain className="size-4.5" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold tracking-tight text-foreground font-mono">
            {reasoningCount}
          </div>
          <div className="text-[11px] text-muted-foreground font-medium truncate">
            Raisonnement cognitif
          </div>
        </div>
      </div>

      {/* Language (Linguistic) */}
      <div className="bg-card border border-border/80 rounded-xl p-3 flex items-center gap-3 shadow-2xs">
        <div className="size-9 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
          <Languages className="size-4.5" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold tracking-tight text-foreground font-mono">
            {languageCount}
          </div>
          <div className="text-[11px] text-muted-foreground font-medium truncate">
            Maîtrise linguistique
          </div>
        </div>
      </div>

      {/* Relations & Graph */}
      <div className="bg-card border border-border/80 rounded-xl p-3 flex items-center gap-3 shadow-2xs">
        <div className="size-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <Network className="size-4.5" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold tracking-tight text-foreground font-mono">
            {metrics.total_relations}
          </div>
          <div className="text-[11px] text-muted-foreground font-medium truncate">
            Prérequis & Dépendances
          </div>
        </div>
      </div>

      {/* CEFR Descriptors */}
      <div className="bg-card border border-border/80 rounded-xl p-3 flex items-center gap-3 shadow-2xs col-span-2 lg:col-span-1">
        <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <Award className="size-4.5" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold tracking-tight text-foreground font-mono">
            {metrics.total_descriptors}
          </div>
          <div className="text-[11px] text-muted-foreground font-medium truncate">
            Descripteurs CECRL
          </div>
        </div>
      </div>
    </div>
  );
};
