import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Target,
  Clock,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { telemetry } from "@/features/analytics/telemetry";

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Form states
  const [targetExam, setTargetExam] = useState<string>("TEF Canada");
  const [targetLevel, setTargetLevel] = useState<string>("B2");
  const [targetDate, setTargetDate] = useState<string>("");
  const [dailyMinutes, setDailyMinutes] = useState<number>(30);
  const [nativeLanguage, setNativeLanguage] = useState<string>("English");
  const [focusAreas, setFocusAreas] = useState<string[]>([
    "comprehension_ecrite",
    "expression_ecrite",
  ]);

  useEffect(() => {
    // Fetch initial onboarding state from API
    const loadState = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const resp = await fetch("/api/v1/students/me/onboarding", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.onboarding_step) setStep(Math.min(data.onboarding_step, 4));
          if (data.target_exam) setTargetExam(data.target_exam);
          if (data.target_level) setTargetLevel(data.target_level);
          if (data.target_date) setTargetDate(data.target_date);
          if (data.daily_minutes_available) setDailyMinutes(data.daily_minutes_available);
          if (data.learning_preferences?.focus_areas) {
            setFocusAreas(data.learning_preferences.focus_areas);
          }
        }
      } catch (err) {
        console.warn("Could not load onboarding state:", err);
      } finally {
        setLoading(false);
      }
    };

    loadState();
    telemetry.track("onboarding_viewed", { current_step: step });
  }, []);

  const saveProgress = async (nextStep: number) => {
    setSaving(true);
    try {
      const token = localStorage.getItem("auth_token");
      await fetch("/api/v1/students/me/onboarding", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          step: nextStep,
          target_exam: targetExam,
          target_level: targetLevel,
          target_date: targetDate || undefined,
          daily_minutes_available: dailyMinutes,
          native_language: nativeLanguage,
          learning_preferences: { focus_areas: focusAreas },
        }),
      });
      telemetry.track("onboarding_step_saved", { step: nextStep, target_level: targetLevel });
    } catch (err) {
      console.warn("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    const next = step + 1;
    await saveProgress(next);
    setStep(next);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSkip = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      await fetch("/api/v1/students/me/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "skipped" }),
      });
      telemetry.track("onboarding_skipped");
    } catch {
      // fail safe
    }
    navigate("/dashboard");
  };

  const handleComplete = async (startDiagnostic: boolean) => {
    setSaving(true);
    try {
      const token = localStorage.getItem("auth_token");
      await fetch("/api/v1/students/me/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "completed" }),
      });
      telemetry.track("onboarding_completed", { startDiagnostic });
    } catch {
      // fail safe
    } finally {
      setSaving(false);
    }

    if (startDiagnostic) {
      navigate("/assessments");
    } else {
      navigate("/dashboard");
    }
  };

  const toggleFocusArea = (area: string) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground font-sans">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col justify-between p-4 md:p-8">
      {/* Top Header */}
      <header className="max-w-3xl mx-auto w-full flex items-center justify-between pb-6 border-b border-border">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          <span className="font-bold text-xl tracking-tight text-foreground">TEF Platform</span>
          <span className="ml-2 text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full border border-primary/20">
            Étape {step} / 4
          </span>
        </div>

        <button
          type="button"
          onClick={handleSkip}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 cursor-pointer"
        >
          Passer l'onboarding
        </button>
      </header>

      {/* Progress Bar */}
      <div className="max-w-3xl mx-auto w-full pt-4">
        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300 rounded-full"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content Card */}
      <main className="max-w-2xl mx-auto w-full my-8 bg-card border border-border rounded-2xl p-6 md:p-10 shadow-lg text-card-foreground">
        {/* Step 1: Goals */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-primary mb-2">
              <Target className="h-8 w-8" />
              <h1 className="text-2xl font-bold text-foreground">Définissez vos objectifs TEF Canada</h1>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pour calibrer votre plan de travail adaptatif et estimer votre score cible NCLC 7+,
              précisez votre niveau visé et votre échéance.
            </p>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Examen cible
                </label>
                <input
                  type="text"
                  disabled
                  value={targetExam}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 font-medium cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Niveau CECRL visé
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {["A2", "B1", "B2", "C1", "C2"].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setTargetLevel(lvl)}
                      className={`py-3 rounded-xl border text-sm font-bold transition-all ${
                        targetLevel === lvl
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  *Le niveau B2 correspond au minimum NCLC 7 requis pour la plupart des volets d'immigration Canada (Entrée Express).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Date d'examen prévue (optionnel)
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Availability */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-indigo-400 mb-2">
              <Clock className="h-8 w-8" />
              <h1 className="text-2xl font-bold text-white">Votre rythme d'apprentissage quotidien</h1>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              La régularité est la clé de la réussite au TEF. Combien de minutes par jour pouvez-vous consacrer à la préparation ?
            </p>

            <div className="grid grid-cols-2 gap-4 pt-2">
              {[
                { min: 15, label: "15 min / jour", desc: "Rythme léger, maintien des acquis" },
                { min: 30, label: "30 min / jour", desc: "Recommandé : 1 exercice + révision" },
                { min: 45, label: "45 min / jour", desc: "Intensif : pratique + rédaction" },
                { min: 60, label: "60 min / jour", desc: "Accéléré : progression maximale" },
              ].map((item) => (
                <button
                  key={item.min}
                  type="button"
                  onClick={() => setDailyMinutes(item.min)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    dailyMinutes === item.min
                      ? "bg-indigo-950/50 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <div className="font-bold text-base text-white">{item.label}</div>
                  <div className="text-xs text-slate-400 mt-1">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Linguistic Profile */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-indigo-400 mb-2">
              <BookOpen className="h-8 w-8" />
              <h1 className="text-2xl font-bold text-white">Vos compétences prioritaires</h1>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Sélectionnez les épreuves qui nécessitent le plus d'attention dans votre parcours.
            </p>

            <div className="space-y-3 pt-2">
              {[
                { id: "comprehension_ecrite", label: "Compréhension Écrite (CE)", sub: "Lecture, articles, logique" },
                { id: "comprehension_orale", label: "Compréhension Orale (CO)", sub: "Écoute, messages radiophoniques" },
                { id: "expression_ecrite", label: "Expression Écrite (EE)", sub: "Articles et lettres d'opinion" },
                { id: "expression_orale", label: "Expression Orale (EO)", sub: "Section A (formelle) & Section B (persuasion)" },
              ].map((item) => {
                const checked = focusAreas.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleFocusArea(item.id)}
                    className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
                      checked
                        ? "bg-indigo-950/40 border-indigo-500 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-bold text-white">{item.label}</div>
                      <div className="text-xs text-slate-400">{item.sub}</div>
                    </div>
                    <div
                      className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                        checked ? "bg-indigo-600 border-indigo-500" : "border-slate-700"
                      }`}
                    >
                      {checked && <CheckCircle2 className="h-4 w-4 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Langue maternelle
              </label>
              <input
                type="text"
                value={nativeLanguage}
                onChange={(e) => setNativeLanguage(e.target.value)}
                placeholder="ex: Anglais, Arabe, Espagnol..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Step 4: Ready for Launch */}
        {step === 4 && (
          <div className="space-y-6 text-center py-4">
            <div className="mx-auto w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center border border-indigo-500/30">
              <Sparkles className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-white">Votre profil est configuré !</h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Pour calibrer votre modèle de préparation personnalisé, nous vous conseillons de passer le
              test diagnostique initial (40 min). Vous pouvez aussi explorer directement votre tableau de bord.
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-left space-y-2 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Objectif :</span>
                <span className="font-bold text-white">{targetExam} - Niveau {targetLevel}</span>
              </div>
              <div className="flex justify-between">
                <span>Engagement :</span>
                <span className="font-bold text-white">{dailyMinutes} minutes / jour</span>
              </div>
              <div className="flex justify-between">
                <span>Épreuves prioritaires :</span>
                <span className="font-bold text-white">{focusAreas.length} épreuves sélectionnées</span>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <Button
                type="button"
                onClick={() => handleComplete(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-6 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                <span>Lancer le test diagnostique</span>
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleComplete(false)}
                className="w-full border-slate-800 hover:bg-slate-800 text-slate-300 py-6 rounded-xl font-medium text-sm"
              >
                Accéder au tableau de bord
              </Button>
            </div>
          </div>
        )}

        {/* Footer Navigation (Steps 1-3) */}
        {step < 4 && (
          <div className="flex items-center justify-between pt-8 border-t border-slate-800 mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={step === 1 || saving}
              className="border-slate-800 hover:bg-slate-800 text-slate-300 flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Précédent</span>
            </Button>

            <Button
              type="button"
              onClick={handleNext}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 px-6"
            >
              <span>Suivant</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>

      {/* Footer info */}
      <footer className="max-w-3xl mx-auto w-full text-center text-xs text-slate-500">
        Vos données de préparation sont strictement confidentielles et utilisées uniquement pour calibrer votre parcours adaptatif.
      </footer>
    </div>
  );
};
