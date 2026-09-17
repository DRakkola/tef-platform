import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Send,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuestionOption {
  id: string;
  content: string;
  order_index: number;
}

interface Question {
  id: string;
  section_id: string;
  prompt: string;
  order_index: number;
  level: string;
  points: number;
  media_url?: string | null;
  options: QuestionOption[];
}

interface Section {
  id: string;
  title: string;
  instructions?: string | null;
  order_index: number;
  passage_text?: string | null;
  media_url?: string | null;
  questions: Question[];
}

interface AssessmentDetail {
  id: string;
  title: string;
  description?: string | null;
  assessment_type: string;
  duration_seconds: number;
  sections: Section[];
}

interface AttemptAnswer {
  question_id: string;
  selected_option_id?: string | null;
}

interface AttemptDetail {
  id: string;
  assessment_id: string;
  status: string;
  remaining_seconds: number;
  answers: AttemptAnswer[];
}

interface OptionResult {
  id: string;
  content: string;
  order_index: number;
  is_correct: boolean;
  explanation?: string | null;
}

interface QuestionResult {
  id: string;
  prompt: string;
  order_index: number;
  level: string;
  points: number;
  explanation?: string | null;
  options: OptionResult[];
  user_answer?: {
    selected_option_id?: string | null;
    is_correct?: boolean | null;
    points_awarded: number;
  } | null;
}

interface SectionResult {
  id: string;
  title: string;
  passage_text?: string | null;
  questions: QuestionResult[];
}

interface AttemptResults {
  attempt_id: string;
  status: string;
  score: {
    total_points: number;
    max_points: number;
    percentage: number;
    is_passed: boolean;
    estimated_level: string;
    skill_scores: Record<string, any>;
  };
  sections: SectionResult[];
}

export const AssessmentRunnerPage: React.FC = () => {
  const { id: assessmentId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [results, setResults] = useState<AttemptResults | null>(null);
  const [answersMap, setAnswersMap] = useState<Record<string, string>>({});

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const authHeaders = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // 1. Fetch assessment definition
  useEffect(() => {
    if (!assessmentId) return;

    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const resp = await fetch(`/api/v1/assessments/${assessmentId}`, { credentials: "include", headers: authHeaders });
        if (!resp.ok) {
          throw new Error("Impossible de charger les détails de l'épreuve.");
        }
        const data: AssessmentDetail = await resp.json();
        setAssessment(data);
      } catch (err: any) {
        setError(err.message || "Erreur de chargement.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [assessmentId]);

  // 2. Start attempt
  const handleStartAttempt = async () => {
    if (!assessmentId) return;
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/v1/assessments/${assessmentId}/attempts`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => null);
        throw new Error(errData?.error?.message || "Impossible de démarrer la tentative.");
      }
      const data: AttemptDetail = await resp.json();
      setAttempt(data);
      setRemainingSeconds(data.remaining_seconds);

      // Preload any existing answers
      const map: Record<string, string> = {};
      data.answers.forEach((ans) => {
        if (ans.selected_option_id) {
          map[ans.question_id] = ans.selected_option_id;
        }
      });
      setAnswersMap(map);
    } catch (err: any) {
      setError(err.message || "Erreur de démarrage.");
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Countdown timer synced with server expiration
  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds <= 0 || results) return;

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [remainingSeconds, results]);

  // 4. Select and auto-save answer
  const handleSelectOption = async (questionId: string, optionId: string) => {
    if (!attempt || results) return;

    setAnswersMap((prev) => ({ ...prev, [questionId]: optionId }));
    setSavingQuestionId(questionId);

    try {
      await fetch(`/api/v1/attempts/${attempt.id}/answers`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
        body: JSON.stringify({
          question_id: questionId,
          selected_option_id: optionId,
        }),
      });
    } catch (err) {
      console.error("Erreur lors de l'enregistrement de la réponse", err);
    } finally {
      setSavingQuestionId(null);
    }
  };

  // 5. Submit attempt
  const handleSubmit = async () => {
    if (!attempt || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const resp = await fetch(`/api/v1/attempts/${attempt.id}/submit`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => null);
        throw new Error(errData?.error?.message || "Échec de la soumission.");
      }
      const data: AttemptResults = await resp.json();
      setResults(data);
    } catch (err: any) {
      alert(err.message || "Erreur lors de la notation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = () => {
    handleSubmit();
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Chargement de la session d'épreuve...</p>
        </div>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center space-y-4">
          <AlertTriangle className="size-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Impossible d'accéder à l'épreuve</h2>
          <p className="text-sm text-slate-300">{error || "Épreuve introuvable."}</p>
          <Button onClick={() => navigate("/dashboard")} variant="outline" className="text-slate-200">
            Retour au Tableau de Bord
          </Button>
        </div>
      </div>
    );
  }

  // View 1: Not started yet
  if (!attempt && !results) {
    const totalQuestions = assessment.sections.reduce((sum, s) => sum + s.questions.length, 0);

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6">
        <div className="max-w-2xl w-full rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
              Simulation TEF - {assessment.assessment_type}
            </span>
            <span className="text-xs text-slate-400">
              Durée : {Math.round(assessment.duration_seconds / 60)} minutes
            </span>
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight">{assessment.title}</h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            {assessment.description || "Épreuve officielle de simulation sous conditions chronométrées strictes."}
          </p>

          <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/10">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium">Nombre de sections</span>
              <p className="text-xl font-bold text-white">{assessment.sections.length}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium">Total questions</span>
              <p className="text-xl font-bold text-white">{totalQuestions}</p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 flex gap-3 items-start">
            <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <span className="font-semibold text-amber-300">Règles de l'examen :</span> Le chronomètre fait autorité côté serveur. Dès que vous lancez l'épreuve, le temps s'écoule de façon irréversible. Vos réponses sont sauvegardées automatiquement au fur et à mesure.
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <Button
              onClick={() => navigate("/dashboard")}
              variant="outline"
              className="border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800"
            >
              Annuler
            </Button>
            <Button
              onClick={handleStartAttempt}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
            >
              <span>Démarrer l'épreuve maintenant</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // View 2: Results View
  if (results) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header Score Banner */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-8 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                  Épreuve terminée et corrigée
                </span>
                <h1 className="text-3xl font-extrabold text-white tracking-tight mt-2">{assessment.title}</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Les résultats ont été intégrés à votre profil de compétences.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-center px-5 py-3 rounded-xl border border-white/10 bg-slate-950/60">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Niveau CLB</span>
                  <div className="text-2xl font-black text-indigo-400">{results.score.estimated_level}</div>
                </div>

                <div className="text-center px-5 py-3 rounded-xl border border-white/10 bg-slate-950/60">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Résultat</span>
                  <div className="text-2xl font-black text-white">{Math.round(results.score.percentage)}%</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => navigate("/dashboard")}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 flex items-center gap-2"
              >
                <span>Accéder aux recommandations personnalisées</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Detailed Question Review */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Correction détaillée par section</h2>

            {results.sections.map((section, sIdx) => (
              <div key={section.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-6 space-y-6">
                <h3 className="text-lg font-semibold text-indigo-300">
                  Section {sIdx + 1} : {section.title}
                </h3>
                {section.passage_text && (
                  <div className="rounded-lg border border-white/5 bg-slate-950/60 p-4 text-xs text-slate-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {section.passage_text}
                  </div>
                )}

                <div className="space-y-4">
                  {section.questions.map((q, qIdx) => {
                    const isCorrect = q.user_answer?.is_correct;
                    return (
                      <div
                        key={q.id}
                        className={`rounded-lg border p-4 transition-colors ${
                          isCorrect
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : "border-rose-500/20 bg-rose-500/5"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-semibold text-sm text-white">
                            Q{qIdx + 1}. {q.prompt}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-semibold shrink-0">
                            {isCorrect ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="size-4" /> Correct (+{q.points} pts)
                              </span>
                            ) : (
                              <span className="text-rose-400 flex items-center gap-1">
                                <XCircle className="size-4" /> Incorrect (0/{q.points} pts)
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Options */}
                        <div className="mt-3 space-y-2">
                          {q.options.map((opt) => {
                            const isUserSelected = q.user_answer?.selected_option_id === opt.id;
                            const isRight = opt.is_correct;

                            let optStyle = "border-slate-800 bg-slate-950/40 text-slate-300";
                            if (isRight) {
                              optStyle = "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-medium";
                            } else if (isUserSelected && !isRight) {
                              optStyle = "border-rose-500/40 bg-rose-500/10 text-rose-300";
                            }

                            return (
                              <div
                                key={opt.id}
                                className={`text-xs px-3 py-2 rounded-lg border flex items-center justify-between ${optStyle}`}
                              >
                                <span>{opt.content}</span>
                                <div className="flex items-center gap-2">
                                  {isUserSelected && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                      Votre choix
                                    </span>
                                  )}
                                  {isRight && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                                      Bonne réponse
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation */}
                        {q.explanation && (
                          <div className="mt-3 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-white/5 flex gap-2 items-start">
                            <HelpCircle className="size-4 text-indigo-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-slate-300">Explication : </span>
                              {q.explanation}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // View 3: Active Taking Session
  const activeSection = assessment.sections[currentSectionIndex] || assessment.sections[0];
  const totalQuestions = assessment.sections.reduce((sum, s) => sum + s.questions.length, 0);
  const answeredCount = Object.keys(answersMap).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Fixed Authoritative Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white line-clamp-1">{assessment.title}</h1>
            <p className="text-xs text-slate-400">
              Section {currentSectionIndex + 1}/{assessment.sections.length} : {activeSection.title}
            </p>
          </div>

          <div className="flex items-center gap-6">
            {/* Server Authoritative Countdown */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-sm font-bold ${
              (remainingSeconds || 0) < 300
                ? "border-rose-500/30 bg-rose-500/10 text-rose-400 animate-pulse"
                : "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
            }`}>
              <Clock className="size-4" />
              <span>{remainingSeconds !== null ? formatTimer(remainingSeconds) : "--:--"}</span>
            </div>

            {/* Answered progress */}
            <div className="hidden sm:block text-xs text-slate-400">
              <span className="font-semibold text-white">{answeredCount}</span> / {totalQuestions} répondues
            </div>

            {/* Submit Exam Button */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
            >
              <Send className="size-3.5" />
              <span>{isSubmitting ? "Validation..." : "Terminer et soumettre"}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Taking Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
        {/* Section Passage (if present, e.g. Reading Comprehension) */}
        {activeSection.passage_text && (
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-6 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Texte support</span>
            <div className="text-sm text-slate-200 leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap pr-2">
              {activeSection.passage_text}
            </div>
          </div>
        )}

        {/* Audio Player (if present, e.g. Listening Comprehension) */}
        {activeSection.media_url && (
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 flex items-center gap-4">
            <span className="text-xs font-semibold text-slate-400 shrink-0">Document sonore :</span>
            <audio controls className="w-full h-8" src={activeSection.media_url}>
              Votre navigateur ne prend pas en charge la lecture audio.
            </audio>
          </div>
        )}

        {/* Section Questions */}
        <div className="space-y-6">
          {activeSection.questions.map((question) => {
            const isSaved = answersMap[question.id] !== undefined;
            const isSaving = savingQuestionId === question.id;

            return (
              <div
                key={question.id}
                className="rounded-xl border border-white/10 bg-slate-900/40 p-6 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-white leading-snug">
                    <span className="text-indigo-400 mr-2">Question {question.order_index} :</span>
                    {question.prompt}
                  </h3>
                  <div className="text-xs shrink-0 flex items-center gap-1.5">
                    {isSaving ? (
                      <span className="text-amber-400">Sauvegarde...</span>
                    ) : isSaved ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" /> Enregistré
                      </span>
                    ) : (
                      <span className="text-slate-500">Non répondue</span>
                    )}
                  </div>
                </div>

                {/* Single Choice Options */}
                <div className="space-y-2.5">
                  {question.options.map((option) => {
                    const isSelected = answersMap[question.id] === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleSelectOption(question.id, option.id)}
                        className={`w-full text-left p-3.5 rounded-lg border transition-all flex items-center gap-3 ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-500/10 text-white shadow-sm"
                            : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60"
                        }`}
                      >
                        <div
                          className={`size-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-500 text-white"
                              : "border-slate-600"
                          }`}
                        >
                          {isSelected && <div className="size-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm">{option.content}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Section Paging */}
        <div className="flex justify-between items-center pt-6 border-t border-white/10">
          <Button
            onClick={() => setCurrentSectionIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentSectionIndex === 0}
            variant="outline"
            className="text-xs border-slate-700 text-slate-300 flex items-center gap-1.5"
          >
            <ArrowLeft className="size-3.5" />
            <span>Section précédente</span>
          </Button>

          <span className="text-xs text-slate-400">
            Section {currentSectionIndex + 1} sur {assessment.sections.length}
          </span>

          <Button
            onClick={() =>
              setCurrentSectionIndex((prev) => Math.min(assessment.sections.length - 1, prev + 1))
            }
            disabled={currentSectionIndex === assessment.sections.length - 1}
            variant="outline"
            className="text-xs border-slate-700 text-slate-300 flex items-center gap-1.5"
          >
            <span>Section suivante</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </main>
    </div>
  );
};
