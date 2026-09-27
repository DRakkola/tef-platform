import React, { useState } from "react";
import { ChevronDown, ChevronRight, Cpu, Clock, Coins, Layers } from "lucide-react";
import type { AISandboxRun } from "../types";

interface TelemetryCollapsibleProps {
  run?: AISandboxRun | null;
  metrics?: {
    latency_ms: number;
    total_tokens: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    estimated_cost_usd: number;
    model?: string;
    is_simulation: boolean;
  } | null;
  defaultExpanded?: boolean;
}

export const TelemetryCollapsible: React.FC<TelemetryCollapsibleProps> = ({
  run,
  metrics,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const data = metrics || (run ? {
    latency_ms: run.latency_ms,
    total_tokens: run.total_tokens,
    prompt_tokens: run.prompt_tokens,
    completion_tokens: run.completion_tokens,
    estimated_cost_usd: run.estimated_cost_usd,
    model: run.model,
    is_simulation: run.is_simulation,
  } : null);

  if (!data) return null;

  return (
    <div className="border border-border/80 rounded-xl overflow-hidden bg-card/60 transition-all text-xs">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors text-muted-foreground font-medium"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4" />}
          <Cpu className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground">Détails Techniques & Télémétrie d'Inférence</span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span>{data.latency_ms} ms</span>
          <span>•</span>
          <span>{data.total_tokens} tokens</span>
          <span>•</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            ${data.estimated_cost_usd?.toFixed(5) || "0.00000"}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="p-4 border-t border-border/60 bg-muted/10 grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono animate-in fade-in-50 duration-150">
          <div className="space-y-1">
            <span className="text-muted-foreground flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider">
              <Clock className="h-3 w-3" /> Latence API
            </span>
            <span className="text-foreground text-sm font-bold block">{data.latency_ms} ms</span>
            <span className="text-[10px] text-muted-foreground">Temps aller-retour</span>
          </div>

          <div className="space-y-1">
            <span className="text-muted-foreground flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider">
              <Layers className="h-3 w-3" /> Jetons Consommés
            </span>
            <span className="text-foreground text-sm font-bold block">{data.total_tokens}</span>
            <span className="text-[10px] text-muted-foreground">
              {data.prompt_tokens !== undefined ? `${data.prompt_tokens} in / ${data.completion_tokens || 0} out` : "Total"}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-muted-foreground flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider">
              <Coins className="h-3 w-3" /> Coût Inférence
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold block">
              ${data.estimated_cost_usd?.toFixed(5) || "0.00000"}
            </span>
            <span className="text-[10px] text-muted-foreground">Barème Google Gemini</span>
          </div>

          <div className="space-y-1">
            <span className="text-muted-foreground flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider">
              <Cpu className="h-3 w-3" /> Moteur & Mode
            </span>
            <span className="text-foreground text-xs font-semibold truncate block">
              {data.model?.replace("models/", "") || "gemini"}
            </span>
            <span className="text-[10px]">
              <span
                className={`inline-block px-1.5 py-0.2 rounded font-semibold ${
                  data.is_simulation
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {data.is_simulation ? "Simulé" : "Live API"}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
