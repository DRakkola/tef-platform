import React from "react";
import { Link } from "react-router-dom";
import { FileQuestion, Dumbbell, FileCheck2, ArrowUpRight } from "lucide-react";
import type { SkillItem } from "../types";

interface SkillLinkedContentProps {
  skill: SkillItem;
}

export const SkillLinkedContent: React.FC<SkillLinkedContentProps> = ({ skill }) => {
  const usage = skill.usage_counts || {
    questions: 0,
    exercises: 0,
    assessments: 0,
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Contenus Associés & Banques d'Évaluation
        </h3>
        <p className="text-xs text-muted-foreground">
          Navigation rapide vers les ressources pédagogiques indexées sur cette compétence.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              Banque de questions
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Consulter les questions étiquetées
            </div>
          </div>
        </Link>

        {/* Link to Exercises */}
        <Link
          to={`/admin/exercises?category=${skill.category}`}
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
              Explorer les exercices du domaine {skill.category}
            </div>
          </div>
        </Link>

        {/* Link to Assessments */}
        <Link
          to="/admin/assessments"
          className="group p-4 rounded-xl border border-border/80 bg-card hover:border-primary/50 shadow-2xs transition flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-teal/10 text-teal-600 dark:text-teal-400">
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
              Épreuves contenant cette compétence
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};
