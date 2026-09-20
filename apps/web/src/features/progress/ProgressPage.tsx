/**
 * Dedicated Student Progress & Skill Trajectories Page:
 * - Time range filtering (7d, 30d, 90d, all)
 * - Historical assessment & activity timeline
 * - Current estimated CEFR & NCLC levels with simulation disclaimer
 * - Detailed skill mastery trajectories with calibration warnings
 */

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  Calendar,
  Info,
  ShieldAlert,
} from "lucide-react";
import { StudentLayout } from "@/features/dashboard/StudentLayout";
import { PageShell } from "@/components/layout/PageShell";

interface ProgressPoint {
  timestamp: string;
  overall_score: number;
  assessment_title: string;
  source_type: string;
  category?: string;
}

interface SkillMetric {
  skill_id: string;
  skill_name: string;
  category: string;
  current_score: number;
  previous_score: number | null;
  change: number | null;
  confidence: number;
  confidence_label: string;
  insufficient_data: boolean;
  trend: string;
  estimated_level?: string | null;
  attempts_count: number;
}

interface ProgressResponse {
  timeline: ProgressPoint[];
  skills: SkillMetric[];
  overall_score?: number | null;
  estimated_cefr_level?: string | null;
  estimated_nclc_level?: string | null;
  disclaimer?: string;
}

export const ProgressPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("all");
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = async (range: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/students/me/progress?range=${range}`, {
        headers,
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Impossible de charger les données d'évolution.");
      }

      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Erreur de chargement.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress(timeRange);
  }, [timeRange]);

  return (
    <StudentLayout>
      <PageShell maxWidth="default" className="space-y-8">
        {/* Header card */}
        <header className="rounded-2xl border border-border/70 bg-card p-6 shadow-2xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                <TrendingUp className="size-7 text-primary shrink-0" />
                Trajectoire & Progression TEF
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Historique immuable de vos performances linguistiques mesurées au fil du temps.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-surface-muted border border-border/60 rounded-lg p-1 text-xs">
                {(["7d", "30d", "90d", "all"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer font-medium ${
                      timeRange === r
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r === "7d" ? "7j" : r === "30d" ? "30j" : r === "90d" ? "90j" : "Tout"}
                  </button>
                ))}
              </div>

              {data?.overall_score !== null && data?.overall_score !== undefined && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5">
                  <Award className="size-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Niveau actuel estimé
                    </div>
                    <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {data?.estimated_cefr_level || "B1"}{" "}
                      {data?.estimated_nclc_level ? `(${data.estimated_nclc_level})` : ""}{" "}
                      — {data.overall_score}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Simulation Disclaimer */}
          <div className="rounded-xl border border-border/60 bg-surface-muted p-3.5 flex items-start gap-3">
            <Info className="size-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {data?.disclaimer ||
                "Ce niveau est une estimation indicative basée sur notre modèle d'apprentissage interne et ne constitue pas un résultat officiel TEF délivré par la CCI Paris Île-de-France."}
            </p>
          </div>
        </header>

        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Chargement des données d'évolution...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive border border-destructive/20 bg-destructive/5 rounded-xl text-sm">
            {error}
          </div>
        ) : (
          <>
            {/* Timeline visualization */}
            <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-2xs space-y-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                Courbe d'évolution chronologique
              </h2>

              {data?.timeline && data.timeline.length > 0 ? (
                <div className="space-y-4">
                  <div className="h-60 flex items-end gap-2 sm:gap-4 pt-8 pb-4 border-b border-border/60 px-2 overflow-x-auto">
                    {data.timeline.map((point, idx) => (
                      <div
                        key={idx}
                        className="flex-1 min-w-[52px] max-w-[80px] flex flex-col items-center gap-2 group cursor-pointer"
                        title={`${point.assessment_title || "Évaluation"} — ${point.overall_score}%`}
                      >
                        <div className="text-[10px] font-semibold text-primary font-mono tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                          {point.overall_score}%
                        </div>
                        <div
                          className="w-full bg-primary/85 hover:bg-primary rounded-t-md transition-all"
                          style={{ height: `${Math.max(12, point.overall_score * 1.8)}px` }}
                        />
                        <div className="text-[10px] text-muted-foreground truncate w-full text-center">
                          {new Date(point.timestamp).toLocaleDateString("fr-FR", {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Aucune mesure enregistrée sur cette période.
                </div>
              )}
            </section>

            {/* Skill Trajectory Table */}
            <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-2xs space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Trajectoires par compétence</h2>
                <p className="text-xs text-muted-foreground">
                  Analyse comparative entre votre dernière mesure et votre score historique.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/60 text-muted-foreground uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Compétence</th>
                      <th className="py-3 px-4 font-semibold">Catégorie</th>
                      <th className="py-3 px-4 font-semibold">Score actuel</th>
                      <th className="py-3 px-4 font-semibold">Précédent</th>
                      <th className="py-3 px-4 font-semibold">Évolution</th>
                      <th className="py-3 px-4 font-semibold">Tendance</th>
                      <th className="py-3 px-4 font-semibold">Confiance</th>
                      <th className="py-3 px-4 font-semibold">Niveau CEFR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {data?.skills && data.skills.length > 0 ? (
                      data.skills.map((skill) => (
                        <tr key={skill.skill_id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-foreground">{skill.skill_name}</td>
                          <td className="py-3 px-4 uppercase text-muted-foreground text-[10px]">
                            {skill.category}
                          </td>
                          <td className="py-3 px-4 font-bold text-foreground text-sm font-mono tabular-nums">
                            {skill.current_score}%
                          </td>
                          <td className="py-3 px-4 text-muted-foreground font-mono tabular-nums">
                            {skill.previous_score !== null ? `${skill.previous_score}%` : "—"}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums">
                            {skill.change !== null ? (
                              <span
                                className={`font-semibold ${
                                  skill.change > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : skill.change < 0
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {skill.change > 0 ? `+${skill.change}%` : `${skill.change}%`}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">Initiale</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                skill.trend === "improving"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : skill.trend === "declining"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {skill.trend === "improving" ? (
                                <>
                                  <TrendingUp className="size-3" /> En progrès
                                </>
                              ) : skill.trend === "declining" ? (
                                <>
                                  <TrendingDown className="size-3" /> En baisse
                                </>
                              ) : skill.insufficient_data ? (
                                <>
                                  <ShieldAlert className="size-3 text-amber-500" /> Étalonnage
                                </>
                              ) : (
                                <>
                                  <Minus className="size-3" /> Stable
                                </>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                skill.confidence_label === "High"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                  : skill.confidence_label === "Medium" || skill.confidence_label === "Moderate"
                                  ? "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20"
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                              }`}
                            >
                              {skill.confidence_label}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-primary">
                            {skill.estimated_level || "—"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-foreground">
                          Aucune compétence évaluée pour le moment.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </PageShell>
    </StudentLayout>
  );
};
