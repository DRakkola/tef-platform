import React from "react";
import { Link } from "react-router-dom";
import { FileQuestion, Dumbbell, FileCheck2, PenTool, Mic, ArrowUpRight } from "lucide-react";
import type { TaxonomySkillDetail } from "../types";

interface SkillLinkedContentProps {
  skill: TaxonomySkillDetail;
}

export const SkillLinkedContent: React.FC<SkillLinkedContentProps> = ({ skill }) => {
  const usage = skill.usage_counts || {
    questions: 0,
    exercises: 0,
    assessments: 0,
    writing_evaluations: 0,
    speaking_evaluations: 0,
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Contenus Associés & Banques d'Évaluation
        </h3>
        <p className="text-xs text-muted-foreground">
          Indexation pédagogique active de cette compétence à travers les différents modules d'entraînement et d'examen.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Link to Questions Bank */}
        <Link
          to={`/admin/questions?skill_id=${skill.id}`}
          className="group p-4 rounded-xl border border-border/80 bg-card hover:border-primary/50 shadow-2xs transition flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileQuestion className="size-4.5" />
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-foreground">
              {usage.questions}
            </div>
            <div className="text-xs font-semibold text-foreground mt-0.5">
              Questions d'examen
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Banque officielle d'items TEF étiquetés
            </div>
          </div>
        </Link>

        {/* Link to Exercises */}
        <Link
          to={`/admin/exercises?skill_id=${skill.id}`}
          className="group p-4 rounded-xl border border-border/80 bg-card hover:border-primary/50 shadow-2xs transition flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Dumbbell className="size-4.5" />
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-foreground">
              {usage.exercises}
            </div>
            <div className="text-xs font-semibold text-foreground mt-0.5">
              Exercices drill
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Activités et drills d'entraînement ciblé
            </div>
          </div>
        </Link>

        {/* Link to Assessments */}
        <Link
          to="/admin/assessments"
          className="group p-4 rounded-xl border border-border/80 bg-card hover:border-primary/50 shadow-2xs transition flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <FileCheck2 className="size-4.5" />
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-foreground">
              {usage.assessments}
            </div>
            <div className="text-xs font-semibold text-foreground mt-0.5">
              Simulations TEF
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Épreuves complètes intégrant cette compétence
            </div>
          </div>
        </Link>

        {/* Writing Usage */}
        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <PenTool className="size-4.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-foreground">
              {usage.writing_evaluations}
            </div>
            <div className="text-xs font-semibold text-foreground mt-0.5">
              Corrections d'Expression Écrite
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Critères analytiques et grilles d'évaluation IA & tuteur
            </div>
          </div>
        </div>

        {/* Speaking Usage */}
        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Mic className="size-4.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-foreground">
              {usage.speaking_evaluations}
            </div>
            <div className="text-xs font-semibold text-foreground mt-0.5">
              Évaluations d'Expression Orale
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Sessions en direct ou simulation IA TEF
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
