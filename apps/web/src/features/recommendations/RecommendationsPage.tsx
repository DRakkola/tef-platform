import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudentLayout } from "@/features/dashboard/StudentLayout";
import { PageShell } from "@/components/layout/PageShell";

interface RecommendationItem {
  id: string;
  skill_id: string;
  skill_name: string;
  skill_code: string;
  recommendation_type: string;
  entity_type: string;
  entity_id: string;
  title?: string;
  category?: string;
  level?: string;
  difficulty?: number;
  reason: string;
  priority: number | string;
  priority_label?: string;
  status: "active" | "started" | "completed" | "dismissed" | string;
  generated_at: string;
  expires_at?: string | null;
}

export const RecommendationsPage: React.FC = () => {
  const [recs, setRecs] = useState<RecommendationItem[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/v1/students/me/recommendations", {
        headers,
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Impossible de charger les recommandations.");
      }

      const json = await res.json();
      setRecs(json);
    } catch (err: any) {
      setError(err.message || "Erreur de chargement.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const handleUpdateStatus = async (
    recId: string,
    newStatus: "started" | "completed" | "dismissed"
  ) => {
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "Accept": "application/json",
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/students/me/recommendations/${recId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setRecs((prev) =>
          prev.map((r) => (r.id === recId ? { ...r, status: newStatus } : r))
        );
      }
    } catch {
      // Ignored for now
    }
  };

  const filteredRecs = recs.filter((r) => {
    if (filter === "active") return r.status === "active" || r.status === "started" || r.status === "pending";
    if (filter === "completed") return r.status === "completed";
    return true;
  });

  return (
    <StudentLayout>
      <PageShell maxWidth="default" className="space-y-6">
        {/* Navigation / Filter bar */}
        <nav className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2 text-xs">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Tableau de bord</span>
            </Link>
            <span className="text-muted-foreground/60">/</span>
            <span className="font-semibold text-foreground">Recommandations ciblées</span>
          </div>

          {/* Filter buttons */}
          <div className="flex items-center gap-1 bg-surface-muted border border-border/60 rounded-lg p-1 text-xs">
            <button
              onClick={() => setFilter("active")}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer font-medium ${
                filter === "active"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              En cours / Actives
            </button>
            <button
              onClick={() => setFilter("completed")}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer font-medium ${
                filter === "completed"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Terminées
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer font-medium ${
                filter === "all"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Toutes
            </button>
          </div>
        </nav>

        {/* Hero */}
        <header className="rounded-2xl border border-border/70 bg-card p-6 shadow-2xs space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Sparkles className="size-7 text-primary shrink-0" />
            Hub d'exercices recommandés
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Ces exercices sont sélectionnés automatiquement par notre moteur pédagogique déterministe
            pour combler vos déficits linguistiques et maximiser votre score aux épreuves TEF.
          </p>
        </header>

        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Chargement des recommandations...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive border border-destructive/20 bg-destructive/5 rounded-xl text-sm">
            {error}
          </div>
        ) : filteredRecs.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-border/70 bg-card p-8 shadow-2xs space-y-3">
            <CheckCircle2 className="size-12 text-emerald-500 mx-auto" />
            <h3 className="text-lg font-bold text-foreground">Aucune recommandation active</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Félicitations ! Vous n'avez aucun exercice urgent en attente. Passez une épreuve blanche pour actualiser vos compétences.
            </p>
            <Button
              onClick={() => (window.location.href = "/assessments")}
              className="mt-4 text-xs cursor-pointer"
            >
              Passer une épreuve TEF
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {filteredRecs.map((rec) => {
              const pVal = typeof rec.priority === "number" ? rec.priority : 0;
              const isCritical = rec.priority === "critical" || pVal >= 80;
              const isHigh = rec.priority === "high" || (pVal >= 60 && pVal < 80);

              return (
                <div
                  key={rec.id}
                  className={`flex flex-col justify-between rounded-2xl border p-6 shadow-2xs transition-all ${
                    rec.status === "completed"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border/70 bg-card hover:border-primary/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border ${
                          isCritical
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : isHigh
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                            : "bg-primary/10 text-primary border-primary/20"
                        }`}
                      >
                        Priorité {isCritical ? "Critique" : isHigh ? "Élevée" : "Moyenne"} ({rec.priority})
                      </span>

                      <span className="text-xs font-semibold text-muted-foreground">
                        Niveau {rec.level || "B2"}
                      </span>
                    </div>

                    <h3 className="mt-3 font-bold text-lg text-foreground">
                      {rec.title || `Entraînement en ${rec.skill_name}`}
                    </h3>

                    <p className="mt-2 text-xs text-muted-foreground italic bg-surface-muted p-3 rounded-lg border border-border/50">
                      « {rec.reason} »
                    </p>

                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Compétence : <strong className="text-foreground">{rec.skill_name}</strong>
                      </span>
                      {rec.category && (
                        <span className="uppercase text-[10px] bg-muted px-2 py-0.5 rounded font-medium">
                          {rec.category}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center gap-3">
                    {rec.status !== "completed" ? (
                      <>
                        <Button
                          onClick={() => {
                            handleUpdateStatus(rec.id, "started");
                            window.location.href = `/exercises/${rec.entity_id}`;
                          }}
                          className="w-full sm:flex-1 text-xs justify-between cursor-pointer"
                        >
                          <span>Commencer l'exercice</span>
                          <ArrowRight className="size-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStatus(rec.id, "dismissed")}
                          className="w-full sm:w-auto text-xs cursor-pointer text-muted-foreground hover:text-foreground"
                        >
                          Ignorer
                        </Button>
                      </>
                    ) : (
                      <div className="w-full flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="size-4" /> Exercice validé
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => (window.location.href = `/exercises/${rec.entity_id}`)}
                          className="text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-300 cursor-pointer"
                        >
                          Recommencer
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageShell>
    </StudentLayout>
  );
};
