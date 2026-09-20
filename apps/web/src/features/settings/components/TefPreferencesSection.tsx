import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Target, TrendingUp, CheckCircle2, AlertCircle, Calendar, Clock, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useUpdateTefPreferencesMutation } from "../useSettings";
import { telemetry } from "@/features/analytics/telemetry";
import type { OnboardingStateApi } from "../api";

interface TefPreferencesSectionProps {
  onboarding?: OnboardingStateApi;
  estimatedLevel?: string;
}

const EXAM_OPTIONS = [
  { value: "TEF Canada", label: "TEF Canada (Immigration / Citoyenneté)" },
  { value: "TEF Québec (TEFAQ)", label: "TEF Québec — TEFAQ" },
  { value: "TEF IRN", label: "TEF IRN (Intégration, Résidence, Nationalité)" },
  { value: "TEF Études", label: "TEF Études (Enseignement supérieur)" },
];

const LEVEL_OPTIONS = [
  { value: "B1", label: "B1 — Intermédiaire (NCLC 5-6)" },
  { value: "B2", label: "B2 — Intermédiaire avancé (NCLC 7)" },
  { value: "C1", label: "C1 — Autonome (NCLC 8-9)" },
  { value: "C2", label: "C2 — Maîtrise (NCLC 10)" },
];

const DAILY_TIME_OPTIONS = [
  { value: 15, label: "15 minutes par jour (Rythme léger)" },
  { value: 30, label: "30 minutes par jour (Recommandé)" },
  { value: 45, label: "45 minutes par jour (Intensif)" },
  { value: 60, label: "60 minutes par jour (Accéléré)" },
];

const SKILL_OPTIONS = [
  { id: "comprehension_ecrite", label: "Compréhension écrite (CE)" },
  { id: "comprehension_orale", label: "Compréhension orale (CO)" },
  { id: "expression_ecrite", label: "Expression écrite (EE)" },
  { id: "expression_orale", label: "Expression orale (EO)" },
];

export const TefPreferencesSection: React.FC<TefPreferencesSectionProps> = ({
  onboarding,
  estimatedLevel = "B1",
}) => {
  const updateTef = useUpdateTefPreferencesMutation();

  const initialExam = onboarding?.target_exam || "TEF Canada";
  const initialLevel = onboarding?.target_level || "B2";
  const initialDate = onboarding?.target_date || "";
  const initialDailyMinutes = onboarding?.daily_minutes_available || 30;
  const initialFocusAreas: string[] = onboarding?.learning_preferences?.focus_areas || [
    "comprehension_ecrite",
    "expression_ecrite",
  ];

  const [targetExam, setTargetExam] = useState(initialExam);
  const [targetLevel, setTargetLevel] = useState(initialLevel);
  const [targetDate, setTargetDate] = useState(initialDate);
  const [dailyMinutes, setDailyMinutes] = useState(initialDailyMinutes);
  const [focusAreas, setFocusAreas] = useState<string[]>(initialFocusAreas);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (onboarding) {
      if (onboarding.target_exam) setTargetExam(onboarding.target_exam);
      if (onboarding.target_level) setTargetLevel(onboarding.target_level);
      if (onboarding.target_date) setTargetDate(onboarding.target_date);
      if (onboarding.daily_minutes_available) setDailyMinutes(onboarding.daily_minutes_available);
      if (onboarding.learning_preferences?.focus_areas) {
        setFocusAreas(onboarding.learning_preferences.focus_areas);
      }
    }
  }, [onboarding]);

  const isDirty =
    targetExam !== initialExam ||
    targetLevel !== initialLevel ||
    targetDate !== initialDate ||
    dailyMinutes !== initialDailyMinutes ||
    JSON.stringify(focusAreas.sort()) !== JSON.stringify([...initialFocusAreas].sort());

  const handleToggleSkill = (skillId: string) => {
    setFocusAreas((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
    );
  };

  const handleReset = () => {
    setTargetExam(initialExam);
    setTargetLevel(initialLevel);
    setTargetDate(initialDate);
    setDailyMinutes(initialDailyMinutes);
    setFocusAreas(initialFocusAreas);
    setErrorMessage(null);
    setIsSuccess(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSuccess(false);

    if (focusAreas.length === 0) {
      setErrorMessage("Veuillez sélectionner au moins une compétence prioritaire.");
      return;
    }

    try {
      await updateTef.mutateAsync({
        targetExam,
        targetLevel,
        targetDate: targetDate || undefined,
        dailyMinutes,
        focusAreas,
      });
      setIsSuccess(true);
      telemetry.track("learning_preferences_updated", {
        targetExam,
        targetLevel,
        dailyMinutes,
        focusAreasCount: focusAreas.length,
      });
      setTimeout(() => setIsSuccess(false), 4000);
    } catch (err: any) {
      const message =
        err?.message ||
        "Impossible d'enregistrer vos préférences d'examen. Réessayez plus tard.";
      setErrorMessage(message);
    }
  };

  return (
    <Card className="border border-border/80 shadow-xs bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Target className="size-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Préparation TEF</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Définissez vos objectifs d'examen, vos compétences clés et votre rythme de travail.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={handleSave}>
        <CardContent className="space-y-6">
          {/* Read-Only System-Derived Learning Data Banner */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-background border border-border/80 text-primary">
                <TrendingUp className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Niveau actuel estimé
                  </span>
                  <Badge variant="secondary" className="font-bold text-xs">
                    {estimatedLevel}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Déterminé automatiquement à partir de vos évaluations et simulations.
                </p>
              </div>
            </div>
            <Link
              to="/progress"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline self-start sm:self-center"
            >
              <span>Voir ma progression</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Exam */}
            <div className="space-y-2">
              <label
                htmlFor="tef-target-exam"
                className="block text-xs font-semibold uppercase tracking-wider text-foreground"
              >
                Examen cible
              </label>
              <select
                id="tef-target-exam"
                value={targetExam}
                onChange={(e) => setTargetExam(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                {EXAM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Level */}
            <div className="space-y-2">
              <label
                htmlFor="tef-target-level"
                className="block text-xs font-semibold uppercase tracking-wider text-foreground"
              >
                Niveau cible visé
              </label>
              <select
                id="tef-target-level"
                value={targetLevel}
                onChange={(e) => setTargetLevel(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                {LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Exam Date */}
            <div className="space-y-2">
              <label
                htmlFor="tef-target-date"
                className="block text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5"
              >
                <Calendar className="size-3.5" />
                Date prévue du test
              </label>
              <Input
                id="tef-target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="h-10"
              />
              <p className="text-[11px] text-muted-foreground">
                Optionnel. Permet d'adapter l'urgence de votre plan d'étude quotidien.
              </p>
            </div>

            {/* Daily Minutes */}
            <div className="space-y-2">
              <label
                htmlFor="tef-daily-time"
                className="block text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5"
              >
                <Clock className="size-3.5" />
                Temps d'étude quotidien
              </label>
              <select
                id="tef-daily-time"
                value={dailyMinutes}
                onChange={(e) => setDailyMinutes(Number(e.target.value))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                {DAILY_TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Priority Focus Areas */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
              Compétences prioritaires
            </label>
            <p className="text-xs text-muted-foreground">
              Les exercices recommandés dans votre tableau de bord cibleront en priorité ces épreuves.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SKILL_OPTIONS.map((skill) => {
                const checked = focusAreas.includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => handleToggleSkill(skill.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left text-sm transition-colors ${
                      checked
                        ? "border-primary bg-primary/5 text-foreground font-medium shadow-2xs"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    <span>{skill.label}</span>
                    <div
                      className={`size-4 rounded-sm border flex items-center justify-center transition-colors ${
                        checked
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-background"
                      }`}
                    >
                      {checked && <CheckCircle2 className="size-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm border border-emerald-500/20">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Vos préférences de préparation ont été enregistrées avec succès.</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60 pt-4">
          <span className="text-xs text-muted-foreground order-2 sm:order-1">
            {isDirty ? "Modifications non enregistrées" : "Préférences enregistrées"}
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!isDirty || updateTef.isPending}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!isDirty || updateTef.isPending}
              className="w-full sm:w-auto"
            >
              {updateTef.isPending ? "Enregistrement..." : "Enregistrer les préférences"}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
};
