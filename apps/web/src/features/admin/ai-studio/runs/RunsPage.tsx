import React, { useState, useEffect } from "react";
import {
  ArrowRightLeft,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { AIStudioLayout } from "../layout/AIStudioLayout";
import { useAIStudio, AIStudioProvider } from "../context/AIStudioContext";
import { RunComparisonModal } from "./RunComparisonModal";
import type { AISandboxRun, CompareResponse } from "../types";
import { Button } from "@/components/ui/button";

const RunsPageContent: React.FC = () => {
  const { getAuthHeaders } = useAIStudio();

  const [runs, setRuns] = useState<AISandboxRun[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(25);
  const [featureTypeFilter, setFeatureTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);

  // A/B Selection State
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<CompareResponse | null>(null);
  const [comparing, setComparing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const typeQuery = featureTypeFilter !== "all" ? `&feature_type=${featureTypeFilter}` : "";
      const res = await fetch(
        `/api/v1/admin/ai-sandbox/runs?page=${page}&page_size=${pageSize}${typeQuery}`,
        {
          headers: getAuthHeaders(false),
          credentials: "include",
        }
      );
      if (res.ok) {
        const data = await res.json();
        setRuns(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load runs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [page, featureTypeFilter]);

  const toggleSelectRun = (id: string) => {
    if (selectedRunIds.includes(id)) {
      setSelectedRunIds(selectedRunIds.filter((r) => r !== id));
    } else {
      if (selectedRunIds.length >= 2) {
        // Keep the second one and add the new one
        setSelectedRunIds([selectedRunIds[1], id]);
      } else {
        setSelectedRunIds([...selectedRunIds, id]);
      }
    }
  };

  const handleRunComparison = async () => {
    if (selectedRunIds.length !== 2) return;
    setComparing(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/admin/ai-sandbox/compare", {
        method: "POST",
        headers: getAuthHeaders(true),
        credentials: "include",
        body: JSON.stringify({
          run_id_a: selectedRunIds[0],
          run_id_b: selectedRunIds[1],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Échec de la comparaison A/B");
      }

      const data = await res.json();
      setComparisonResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de la comparaison.");
    } finally {
      setComparing(false);
    }
  };

  return (
    <AIStudioLayout
      title="Runs & Benchmarks — Historique & Comparateur"
      description="Journal d'audit de toutes les exécutions d'évaluation, métriques de latence/coût et analyse comparative A/B."
    >
      {errorMsg && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="font-bold text-sm px-2">✕</button>
        </div>
      )}

      {/* Contextual A/B Comparison Bar */}
      <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-foreground block">
            Comparateur A / B Diff ({selectedRunIds.length}/2 sélectionnés)
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedRunIds.length === 0 && "Cochez deux exécutions dans le tableau pour analyser leurs écarts."}
            {selectedRunIds.length === 1 && "1 exécution sélectionnée. Cochez une seconde exécution pour comparer."}
            {selectedRunIds.length === 2 && "2 exécutions prêtes pour la comparaison différentielle."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedRunIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRunIds([])}
              className="text-xs text-muted-foreground"
            >
              Effacer sélection
            </Button>
          )}

          <Button
            onClick={handleRunComparison}
            disabled={selectedRunIds.length !== 2 || comparing}
            data-testid="compare-runs-btn"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl shadow-xs"
          >
            {comparing ? (
              <>
                <RefreshCw className="size-3.5 mr-1.5 animate-spin" />
                Comparaison en cours...
              </>
            ) : (
              <>
                <ArrowRightLeft className="size-3.5 mr-1.5" />
                Comparer A vs B
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl text-xs">
          {["all", "writing", "speaking", "raw"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setFeatureTypeFilter(t);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all uppercase text-[11px] ${
                featureTypeFilter === t
                  ? "bg-card text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "Toutes" : t}
            </button>
          ))}
        </div>

        <div className="text-xs text-muted-foreground font-mono">
          Total : <strong className="text-foreground">{total}</strong> exécutions
        </div>
      </div>

      {/* Historical Runs Table */}
      <div className="bg-card rounded-2xl border border-border shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            Chargement des exécutions...
          </div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            Aucun résultat trouvé pour ce filtre.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase text-[10px]">
                  <th className="p-3.5 w-12 text-center">A/B</th>
                  <th className="p-3.5">Fonctionnalité</th>
                  <th className="p-3.5">Modèle</th>
                  <th className="p-3.5">Score / Résultat</th>
                  <th className="p-3.5">Latence</th>
                  <th className="p-3.5">Tokens</th>
                  <th className="p-3.5">Coût Est.</th>
                  <th className="p-3.5">Mode</th>
                  <th className="p-3.5">Date & Heure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {runs.map((r) => {
                  const isSelected = selectedRunIds.includes(r.id);
                  return (
                    <tr
                      key={r.id}
                      className={isSelected ? "bg-primary/10" : "hover:bg-muted/30 transition-colors"}
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRun(r.id)}
                          className="rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="p-3.5 font-bold uppercase text-foreground">{r.feature_type}</td>
                      <td className="p-3.5 font-mono text-muted-foreground">
                        {r.model.replace("models/", "")}
                      </td>
                      <td className="p-3.5">
                        {r.parsed_result && (r.parsed_result.tef_points || r.parsed_result.score) ? (
                          <span className="font-bold text-foreground">
                            {r.parsed_result.tef_points ? `${r.parsed_result.tef_points} pts` : `${r.parsed_result.score}%`}
                            {r.parsed_result.cefr_level ? ` (${r.parsed_result.cefr_level})` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground truncate max-w-xs block font-mono text-[11px]">
                            {r.raw_output ? r.raw_output.slice(0, 40) + "..." : "Complétion"}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-muted-foreground">{r.latency_ms} ms</td>
                      <td className="p-3.5 font-mono text-muted-foreground">{r.total_tokens}</td>
                      <td className="p-3.5 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        ${r.estimated_cost_usd?.toFixed(5) || "0.00000"}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            r.is_simulation
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                          }`}
                        >
                          {r.is_simulation ? "Simulé" : "Live"}
                        </span>
                      </td>
                      <td className="p-3.5 text-muted-foreground font-mono">
                        {new Date(r.created_at).toLocaleDateString()}{" "}
                        {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Comparison Modal */}
      <RunComparisonModal
        isOpen={Boolean(comparisonResult)}
        onClose={() => setComparisonResult(null)}
        comparison={comparisonResult}
      />
    </AIStudioLayout>
  );
};

export const RunsPage: React.FC = () => (
  <AIStudioProvider>
    <RunsPageContent />
  </AIStudioProvider>
);
