import React from "react";
import { ArrowRightLeft } from "lucide-react";
import type { CompareResponse } from "../types";
import { Button } from "@/components/ui/button";

interface RunComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  comparison: CompareResponse | null;
}

export const RunComparisonModal: React.FC<RunComparisonModalProps> = ({
  isOpen,
  onClose,
  comparison,
}) => {
  if (!isOpen || !comparison) return null;

  const { run_a, run_b, score_difference, latency_difference_ms, token_difference } = comparison;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-card text-card-foreground rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ArrowRightLeft className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Rapport Comparatif Différentiel A / B</h3>
              <p className="text-xs text-muted-foreground">
                Analyse comparative de performance, dérive de notation et consommation de jetons.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground font-bold p-1">
            ✕
          </button>
        </div>

        {/* Delta Badges Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 bg-muted/40 rounded-xl border border-border">
            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Écart de Score</span>
            <div className="text-base font-bold font-mono mt-0.5">
              {score_difference !== null ? (
                <span className={score_difference >= 0 ? "text-emerald-600" : "text-amber-600"}>
                  {score_difference > 0 ? `+${score_difference}` : score_difference} pts
                </span>
              ) : (
                <span className="text-muted-foreground">N/A</span>
              )}
            </div>
          </div>

          <div className="p-3.5 bg-muted/40 rounded-xl border border-border">
            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Écart de Latence</span>
            <div className="text-base font-bold font-mono mt-0.5">
              <span className={latency_difference_ms <= 0 ? "text-emerald-600" : "text-amber-600"}>
                {latency_difference_ms > 0 ? `+${latency_difference_ms}` : latency_difference_ms} ms
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-muted/40 rounded-xl border border-border">
            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Écart de Tokens</span>
            <div className="text-base font-bold font-mono mt-0.5">
              <span className={token_difference <= 0 ? "text-emerald-600" : "text-amber-600"}>
                {token_difference > 0 ? `+${token_difference}` : token_difference} tokens
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-muted/40 rounded-xl border border-border">
            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Différence de Coût</span>
            <div className="text-base font-bold font-mono mt-0.5 text-foreground">
              ${(run_b.estimated_cost_usd - run_a.estimated_cost_usd).toFixed(5)}
            </div>
          </div>
        </div>

        {/* Side-by-Side Outputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Run A Card */}
          <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary uppercase">Version A (Base)</span>
              <span className="text-[10px] text-muted-foreground font-mono">{run_a.model.replace("models/", "")}</span>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              Latence: {run_a.latency_ms} ms • Tokens: {run_a.total_tokens} • Coût: ${run_a.estimated_cost_usd.toFixed(5)}
            </div>
            <div className="p-3 bg-card border border-border/80 rounded-lg text-xs font-mono max-h-48 overflow-y-auto leading-relaxed text-foreground">
              {run_a.raw_output}
            </div>
          </div>

          {/* Run B Card */}
          <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Version B (Variante)</span>
              <span className="text-[10px] text-muted-foreground font-mono">{run_b.model.replace("models/", "")}</span>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              Latence: {run_b.latency_ms} ms • Tokens: {run_b.total_tokens} • Coût: ${run_b.estimated_cost_usd.toFixed(5)}
            </div>
            <div className="p-3 bg-card border border-border/80 rounded-lg text-xs font-mono max-h-48 overflow-y-auto leading-relaxed text-foreground">
              {run_b.raw_output}
            </div>
          </div>
        </div>

        {/* Qualitative Diff Summaries */}
        <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2 text-xs">
          <div className="font-semibold text-foreground">Synthèse Différentielle :</div>
          <div className="text-muted-foreground leading-relaxed">{comparison.prompt_diff_summary}</div>
          <div className="font-medium text-primary leading-relaxed">{comparison.evaluation_diff_summary}</div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onClose} size="sm" className="text-xs rounded-xl">
            Fermer le Rapport
          </Button>
        </div>
      </div>
    </div>
  );
};
