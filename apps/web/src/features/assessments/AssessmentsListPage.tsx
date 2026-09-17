import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Headphones,
  Clock,
  Layers,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AssessmentItem {
  id: string;
  title: string;
  description?: string | null;
  assessment_type: string;
  duration_seconds: number;
  section_count: number;
  question_count: number;
  total_points: number;
}

export const AssessmentsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const authHeaders = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  useEffect(() => {
    async function fetchAssessments() {
      setIsLoading(true);
      setError(null);
      try {
        const resp = await fetch("/api/v1/assessments?page_size=50", {
          credentials: "include",
          headers: authHeaders,
        });
        if (!resp.ok) {
          throw new Error("Impossible de charger les épreuves disponibles.");
        }
        const data = await resp.json();
        setAssessments(data.items || []);
      } catch (err: any) {
        setError(err.message || "Erreur de chargement.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchAssessments();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div>
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-4"
          >
            <ChevronLeft className="size-4" />
            <span>Retour au tableau de bord</span>
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
                <Sparkles className="size-3.5" />
                Simulations Officielles TEF
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                Catalogue des Épreuves de Simulation
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Passez un test complet ou un diagnostic modulaire chronométré pour calibrer votre niveau.
              </p>
            </div>
          </div>
        </div>

        {/* Content State */}
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Chargement des épreuves disponibles...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-center max-w-md mx-auto space-y-3">
            <AlertTriangle className="size-8 text-rose-400 mx-auto" />
            <p className="text-sm text-rose-200">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              Réessayer
            </Button>
          </div>
        ) : assessments.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-12 text-center max-w-md mx-auto space-y-3">
            <BookOpen className="size-10 text-slate-500 mx-auto" />
            <h3 className="font-semibold text-white">Aucune épreuve publiée</h3>
            <p className="text-xs text-slate-400">
              De nouveaux tests de simulation seront bientôt disponibles.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assessments.map((asmt) => {
              const isListening = asmt.assessment_type === "listening";
              const durationMins = Math.round(asmt.duration_seconds / 60);

              return (
                <div
                  key={asmt.id}
                  className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-6 flex flex-col justify-between hover:border-indigo-500/40 transition-all group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase tracking-wider">
                        {isListening ? (
                          <Headphones className="size-3" />
                        ) : (
                          <BookOpen className="size-3" />
                        )}
                        {asmt.assessment_type}
                      </span>

                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="size-3.5" />
                        <span>{durationMins} min</span>
                      </div>
                    </div>

                    <h2 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {asmt.title}
                    </h2>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {asmt.description || "Épreuve officielle sous contraintes temporelles strictes."}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1">
                        <Layers className="size-3.5 text-slate-500" />
                        <span>{asmt.section_count} sections</span>
                      </div>
                      <div>
                        <span>{asmt.question_count} questions</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <Button
                      onClick={() => navigate(`/assessments/${asmt.id}`)}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-2 rounded-lg flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-indigo-600/20 transition-all"
                    >
                      <span>Commencer le test</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
