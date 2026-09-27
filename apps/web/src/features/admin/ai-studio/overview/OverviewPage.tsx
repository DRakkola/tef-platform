import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Mic,
  Terminal,
  History,
  ShieldCheck,
  ArrowRight,
  Layers,
  Activity,
} from "lucide-react";
import { AIStudioLayout } from "../layout/AIStudioLayout";
import { useAIStudio, AIStudioProvider } from "../context/AIStudioContext";
import type { AISandboxRun } from "../types";
import { Button } from "@/components/ui/button";

const OverviewPageContent: React.FC = () => {
  const { speakingConfigs, benchmarks, isSimulation, getAuthHeaders } = useAIStudio();
  const [recentRuns, setRecentRuns] = useState<AISandboxRun[]>([]);
  const [totalRunsCount, setTotalRunsCount] = useState<number>(0);
  const [loadingRuns, setLoadingRuns] = useState<boolean>(true);

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const res = await fetch("/api/v1/admin/ai-sandbox/runs?page=1&page_size=6", {
          headers: getAuthHeaders(false),
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setRecentRuns(data.items || []);
          setTotalRunsCount(data.total || 0);
        }
      } catch (err) {
        console.error("Failed to load runs on overview:", err);
      } finally {
        setLoadingRuns(false);
      }
    };
    fetchRuns();
  }, [getAuthHeaders]);

  const configA = speakingConfigs.find((c) => c.section === "section_a");
  const configB = speakingConfigs.find((c) => c.section === "section_b");

  return (
    <AIStudioLayout
      title="Vue d'ensemble — TEF AI Studio"
      description="Supervision opérationnelle, calibration des modèles d'évaluation et statut des examinateurs déployés."
    >
      {/* Simulation Banner Notice (if simulation mode is active) */}
      {isSimulation && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
            <div>
              <span className="font-bold">Mode simulation déterministe actif :</span> Vos tests s'exécuteront
              hors-ligne avec des mocks prédictibles sans consommer de quotas API.
            </div>
          </div>
          <Link
            to="/admin/ai-studio/administration"
            className="font-semibold underline hover:text-amber-900 dark:hover:text-amber-100"
          >
            Configurer l'environnement →
          </Link>
        </div>
      )}

      {/* Primary Quick Access Workflows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/admin/ai-studio/assessment/writing"
          className="group p-5 bg-card border border-border hover:border-primary/50 rounded-2xl shadow-2xs transition-all hover:shadow-xs flex flex-col justify-between space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileText className="size-5" />
            </div>
            <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Tester l'Écrit</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Calibrer la correction des faits divers et lettres d'opinion sur les 4 critères officiels.
            </p>
          </div>
        </Link>

        <Link
          to="/admin/ai-studio/examiner"
          className="group p-5 bg-card border border-border hover:border-primary/50 rounded-2xl shadow-2xs transition-all hover:shadow-xs flex flex-col justify-between space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Mic className="size-5" />
            </div>
            <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Examinateur Vocal Live</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Simuler l'entretien oral Section A & B en temps réel avec Gemini 3.8 Live.
            </p>
          </div>
        </Link>

        <Link
          to="/admin/ai-studio/prompt-lab"
          className="group p-5 bg-card border border-border hover:border-primary/50 rounded-2xl shadow-2xs transition-all hover:shadow-xs flex flex-col justify-between space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Terminal className="size-5" />
            </div>
            <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Prompt Lab</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Expérimenter sur les prompts bruts, la température et analyser les réponses directes.
            </p>
          </div>
        </Link>

        <Link
          to="/admin/ai-studio/runs"
          className="group p-5 bg-card border border-border hover:border-primary/50 rounded-2xl shadow-2xs transition-all hover:shadow-xs flex flex-col justify-between space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <History className="size-5" />
            </div>
            <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Runs & Comparateur</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Consulter l'historique complet et réaliser des diffs A/B précis entre deux itérations.
            </p>
          </div>
        </Link>
      </div>

      {/* Production State Cockpit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Speaking Configuration */}
        <div className="lg:col-span-7 bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h3 className="font-bold text-sm text-foreground">
                  Configuration Examinateur en Production
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Paramètres actuellement actifs lors des examens oraux réels des candidats.
                </p>
              </div>
            </div>
            <Link
              to="/admin/ai-studio/examiner"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Ajuster dans le studio →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Section A Card */}
            <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-foreground">Section A (5 min)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Actif
                </span>
              </div>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Modèle:</span>
                  <span className="font-semibold text-foreground truncate max-w-[150px]">
                    {configA?.model?.replace("models/", "") || "gemini-3.8-live"}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Voix:</span>
                  <span className="font-semibold text-foreground">{configA?.voice_persona || "Aoede"}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Scepticisme:</span>
                  <span className="font-semibold text-foreground">
                    {configA ? Math.round(configA.scepticism_level * 100) : 30}%
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Température:</span>
                  <span className="font-semibold text-foreground">{configA?.temperature ?? 0.7}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-border/80 text-[10px] text-muted-foreground flex items-center justify-between">
                <span>Dernière mise à jour :</span>
                <span>
                  {configA?.updated_at
                    ? new Date(configA.updated_at).toLocaleDateString()
                    : "Par défaut"}
                </span>
              </div>
            </div>

            {/* Section B Card */}
            <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-foreground">Section B (10 min)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Actif
                </span>
              </div>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Modèle:</span>
                  <span className="font-semibold text-foreground truncate max-w-[150px]">
                    {configB?.model?.replace("models/", "") || "gemini-3.8-live"}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Voix:</span>
                  <span className="font-semibold text-foreground">{configB?.voice_persona || "Aoede"}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Scepticisme:</span>
                  <span className="font-semibold text-primary font-bold">
                    {configB ? Math.round(configB.scepticism_level * 100) : 65}%
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Température:</span>
                  <span className="font-semibold text-foreground">{configB?.temperature ?? 0.7}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-border/80 text-[10px] text-muted-foreground flex items-center justify-between">
                <span>Dernière mise à jour :</span>
                <span>
                  {configB?.updated_at
                    ? new Date(configB.updated_at).toLocaleDateString()
                    : "Par défaut"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Benchmarking & Assets Status */}
        <div className="lg:col-span-5 bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-5">
          <div className="border-b border-border pb-4">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              Étalons & Actifs Pédagogiques
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Datasets de calibration officiels TEF préchargés dans le studio.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Copies de Référence Écrites
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Section A (A2) et Section B (B1, B2) étalonnées
                </span>
              </div>
              <span className="text-sm font-bold text-primary font-mono">
                {benchmarks.filter((b) => b.feature_type === "writing").length} étalons
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Scénarios d'Entretien Oral
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Atelier culinaire et voyage à vélo standardisés
                </span>
              </div>
              <span className="text-sm font-bold text-primary font-mono">
                {benchmarks.filter((b) => b.feature_type === "speaking").length} étalons
              </span>
            </div>

            <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl text-xs space-y-1">
              <span className="font-semibold text-primary block">Conseil d'Étalonnage</span>
              <p className="text-muted-foreground leading-relaxed">
                Avant de déployer un nouveau prompt de correction, validez les scores sur l'ensemble
                des étalons pour vérifier l'absence de régression de niveau.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Latest Execution Runs */}
      <div className="bg-card rounded-2xl border border-border shadow-2xs overflow-hidden space-y-0">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Dernières Exécutions de Test ({totalRunsCount} au total)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Traçabilité des évaluations générées dans le Studio IA.
            </p>
          </div>
          <Link to="/admin/ai-studio/runs">
            <Button variant="outline" size="sm" className="text-xs font-medium">
              Voir tout l'historique →
            </Button>
          </Link>
        </div>

        {loadingRuns ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Chargement des exécutions récentes...
          </div>
        ) : recentRuns.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Aucune exécution enregistrée pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase text-[10px]">
                  <th className="p-3.5">Fonctionnalité</th>
                  <th className="p-3.5">Modèle</th>
                  <th className="p-3.5">Résultat / Score</th>
                  <th className="p-3.5">Latence</th>
                  <th className="p-3.5">Tokens</th>
                  <th className="p-3.5">Mode</th>
                  <th className="p-3.5">Heure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {recentRuns.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-semibold uppercase text-foreground">{r.feature_type}</td>
                    <td className="p-3.5 font-mono text-muted-foreground">{r.model.replace("models/", "")}</td>
                    <td className="p-3.5">
                      {r.parsed_result && (r.parsed_result.tef_points || r.parsed_result.score) ? (
                        <span className="font-bold text-foreground">
                          {r.parsed_result.tef_points ? `${r.parsed_result.tef_points} pts` : `${r.parsed_result.score}%`}
                          {r.parsed_result.cefr_level ? ` (${r.parsed_result.cefr_level})` : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Complétion texte</span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-muted-foreground">{r.latency_ms} ms</td>
                    <td className="p-3.5 font-mono text-muted-foreground">{r.total_tokens}</td>
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
                      {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AIStudioLayout>
  );
};

export const OverviewPage: React.FC = () => (
  <AIStudioProvider>
    <OverviewPageContent />
  </AIStudioProvider>
);
