import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  HelpCircle,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExerciseOption {
  content: string;
  order_index: number;
}

interface ExerciseDetail {
  id: string;
  title: string;
  instructions?: string | null;
  category: string;
  level: string;
  difficulty: number;
  prompt: string;
  points: number;
  options: ExerciseOption[];
  skills: string[];
}

interface ExerciseAttemptResult {
  id: string;
  is_correct: boolean;
  points_awarded: number;
  correct_answer?: string | null;
  explanation?: string | null;
}

export const ExercisePracticePage: React.FC = () => {
  const { id: exerciseId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<ExerciseAttemptResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const authHeaders = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  useEffect(() => {
    if (!exerciseId) return;

    async function fetchExercise() {
      setIsLoading(true);
      setError(null);
      try {
        const resp = await fetch(`/api/v1/exercises/${exerciseId}`, {
          credentials: "include",
          headers: authHeaders,
        });
        if (!resp.ok) {
          throw new Error("Impossible de charger l'exercice ciblé.");
        }
        const data: ExerciseDetail = await resp.json();
        setExercise(data);
      } catch (err: any) {
        setError(err.message || "Erreur de chargement.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchExercise();
  }, [exerciseId]);

  const handleSubmit = async () => {
    if (selectedIndex === null || !exerciseId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const resp = await fetch(`/api/v1/exercises/${exerciseId}/attempts`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
        body: JSON.stringify({
          selected_option_index: selectedIndex,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => null);
        throw new Error(errData?.error?.message || "Échec de l'évaluation de l'exercice.");
      }

      const data: ExerciseAttemptResult = await resp.json();
      setResult(data);
    } catch (err: any) {
      alert(err.message || "Erreur lors de la soumission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Chargement de l'exercice...</p>
        </div>
      </div>
    );
  }

  if (error || !exercise) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center space-y-4">
          <AlertTriangle className="size-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Exercice indisponible</h2>
          <p className="text-sm text-slate-300">{error || "Exercice introuvable."}</p>
          <Button onClick={() => navigate("/dashboard")} variant="outline" className="text-slate-200">
            Retour au Tableau de Bord
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full space-y-6">
        {/* Navigation back */}
        <button
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Retour au tableau de bord</span>
        </button>

        {/* Exercise Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-8 shadow-2xl space-y-6">
          {/* Header Metadata */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-300 border border-indigo-500/20 uppercase tracking-wider">
                {exercise.category}
              </span>
              <span className="rounded-md bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 border border-white/10">
                Niveau {exercise.level}
              </span>
            </div>

            <div className="flex items-center gap-1 text-xs text-amber-400 font-medium">
              <Award className="size-4" />
              <span>{exercise.points} points</span>
            </div>
          </div>

          {/* Title & Instructions */}
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">{exercise.title}</h1>
            {exercise.instructions && (
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {exercise.instructions}
              </p>
            )}
          </div>

          {/* Prompt */}
          <div className="rounded-xl border border-white/5 bg-slate-950/60 p-5">
            <p className="text-base text-slate-100 font-medium leading-relaxed">
              {exercise.prompt}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {exercise.options.map((option, idx) => {
              const isSelected = selectedIndex === idx;

              let optStyle = "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60";
              if (result) {
                if (result.is_correct && isSelected) {
                  optStyle = "border-emerald-500/50 bg-emerald-500/15 text-emerald-200 font-medium";
                } else if (!result.is_correct && isSelected) {
                  optStyle = "border-rose-500/50 bg-rose-500/15 text-rose-200";
                } else if (!result.is_correct && result.correct_answer === option.content) {
                  optStyle = "border-emerald-500/50 bg-emerald-500/15 text-emerald-200 font-medium";
                }
              } else if (isSelected) {
                optStyle = "border-indigo-500 bg-indigo-500/15 text-white shadow-sm ring-1 ring-indigo-500/50";
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={result !== null}
                  onClick={() => setSelectedIndex(idx)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${optStyle}`}
                >
                  <span className="text-sm">{option.content}</span>
                  <div
                    className={`size-4 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-500 text-white"
                        : "border-slate-600"
                    }`}
                  >
                    {isSelected && <div className="size-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Result Feedback Banner */}
          {result && (
            <div
              className={`rounded-xl border p-5 space-y-3 ${
                result.is_correct
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {result.is_correct ? (
                  <>
                    <CheckCircle2 className="size-5 text-emerald-400" />
                    <span>Excellente réponse ! (+{result.points_awarded} pts)</span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-5 text-rose-400" />
                    <span>Réponse incorrecte</span>
                  </>
                )}
              </div>

              {result.explanation && (
                <div className="text-xs leading-relaxed text-slate-300 border-t border-white/5 pt-2 flex items-start gap-2">
                  <HelpCircle className="size-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Rappel de la règle : </span>
                    {result.explanation}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex gap-4">
            {!result ? (
              <Button
                onClick={handleSubmit}
                disabled={selectedIndex === null || isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                <span>{isSubmitting ? "Validation..." : "Valider ma réponse"}</span>
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                onClick={() => navigate("/dashboard")}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                <span>Voir mon profil mis à jour sur le tableau de bord</span>
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
