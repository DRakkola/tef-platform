/**
 * Empty state component for new students with no assessment history.
 */

import React from "react";
import { Compass, BookOpen, Target, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardEmptyStateProps {
  studentName: string;
  targetExam: string;
  targetLevel: string;
  onStartDiagnostic?: () => void;
}

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({
  studentName,
  targetExam,
  targetLevel,
  onStartDiagnostic,
}) => {
  return (
    <div
      data-testid="dashboard-empty-state"
      className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-900/60 p-10 text-center backdrop-blur-md max-w-2xl mx-auto my-12"
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 ring-8 ring-indigo-500/5 mb-6">
        <Compass className="size-8" />
      </div>

      <h2 className="text-2xl font-bold text-white">
        Bienvenue, {studentName} !
      </h2>
      <p className="mt-2 text-sm text-slate-300 max-w-md">
        Votre plan de préparation pour le <span className="font-semibold text-white">{targetExam}</span> visant le niveau{" "}
        <span className="inline-block rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-300">
          {targetLevel}
        </span>{" "}
        est initialisé.
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full text-left">
        <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
          <div className="flex items-center gap-2 text-indigo-400 font-medium text-sm">
            <Target className="size-4" /> Étalonnage initial
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Passez votre premier test diagnostic pour calculer la précision de vos compétences.
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
          <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm">
            <Sparkles className="size-4" /> Recommandations
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Le moteur pédagogique déterminera automatiquement vos points faibles prioritaires.
          </p>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <Button
          onClick={onStartDiagnostic}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-2.5 rounded-lg flex items-center gap-2 shadow-lg shadow-indigo-600/20"
        >
          <BookOpen className="size-4" /> Démarrer un test diagnostique
        </Button>
      </div>
    </div>
  );
};
