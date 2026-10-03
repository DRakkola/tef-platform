import React from "react";
import {
  Brain,
  Languages,
  FileQuestion,
  Dumbbell,
  GraduationCap,
  AlertCircle,
  FileCheck2,
  GitFork,
  ArrowRight,
  ShieldCheck,
  Activity,
  PenTool,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaxonomySkillDetail } from "../types";

interface SkillOverviewProps {
  skill: TaxonomySkillDetail;
  onNavigateToSkill?: (id: string) => void;
}

export const SkillOverview: React.FC<SkillOverviewProps> = ({ skill, onNavigateToSkill }) => {
  const usage = skill.usage_counts || {
    questions: 0,
    exercises: 0,
    assessments: 0,
    student_mastery: 0,
    skill_assessments: 0,
    skill_evidence: 0,
    writing_evaluations: 0,
    speaking_evaluations: 0,
    total_dependencies: 0,
  };

  const isReasoning = skill.dimension === "reasoning";

  return (
    <div className="space-y-6">
      {/* Educational Scope & Description */}
      <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Périmètre Pédagogique & Objectifs
          </h3>
          <span className="text-[11px] font-mono text-muted-foreground">
            ID: {skill.id}
          </span>
        </div>
        {skill.description ? (
          <p className="text-xs sm:text-sm text-foreground leading-relaxed">
            {skill.description}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Aucune description pédagogique n'est encore renseignée pour cette compétence.
          </p>
        )}
      </div>

      {/* Dimension & Canonical Architecture Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Dimension Card */}
        <div className="bg-card border border-border/80 rounded-xl p-4 space-y-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg ${
                isReasoning
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  : "bg-teal-500/10 text-teal-600 dark:text-teal-400"
              }`}
            >
              {isReasoning ? <Brain className="size-4.5" /> : <Languages className="size-4.5" />}
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">
                Dimension : {isReasoning ? "Raisonnement Cognitif" : "Maîtrise Linguistique"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {isReasoning
                  ? "Opération mentale requise pour résoudre la tâche (inférence, idée directrice, position auteur...)"
                  : "Connaissance ou traitement linguistique requis (syntaxe, connecteurs, lexique...)"}
              </div>
            </div>
          </div>
        </div>

        {/* Parent / Container Hierarchy Card */}
        <div className="bg-card border border-border/80 rounded-xl p-4 space-y-2 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <GitFork className="size-4.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">
                {skill.parent ? "Sous-compétence rattachée" : "Compétence Racine / Conteneur"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {skill.parent ? (
                  <span>
                    Parent :{" "}
                    <strong className="text-foreground">{skill.parent.name}</strong> ({skill.parent.code})
                  </span>
                ) : (
                  <span>
                    Contient {skill.children?.length || 0} sous-compétence(s) directe(s) dans le graphe.
                  </span>
                )}
              </div>
            </div>
          </div>

          {skill.parent && onNavigateToSkill && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateToSkill(skill.parent!.id)}
              className="text-xs h-7 self-start gap-1 mt-1 cursor-pointer"
            >
              Voir le parent <ArrowRight className="size-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Dependency & Relational Impact Matrix */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Impact Réel & Dépendances Plateforme
          </h3>
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
            Total : {usage.total_dependencies} références
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Questions */}
          <div className="bg-card border border-border/80 rounded-xl p-3.5 space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Questions</span>
              <FileQuestion className="size-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {usage.questions}
            </div>
            <div className="text-[11px] text-muted-foreground">banque d'items</div>
          </div>

          {/* Exercises */}
          <div className="bg-card border border-border/80 rounded-xl p-3.5 space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Exercices</span>
              <Dumbbell className="size-4 text-primary" />
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {usage.exercises}
            </div>
            <div className="text-[11px] text-muted-foreground">drills ciblés</div>
          </div>

          {/* Assessments */}
          <div className="bg-card border border-border/80 rounded-xl p-3.5 space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Épreuves</span>
              <FileCheck2 className="size-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {usage.assessments}
            </div>
            <div className="text-[11px] text-muted-foreground">simulations TEF</div>
          </div>

          {/* Student Mastery */}
          <div className="bg-card border border-border/80 rounded-xl p-3.5 space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Étudiants</span>
              <GraduationCap className="size-4 text-purple-500" />
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {usage.student_mastery}
            </div>
            <div className="text-[11px] text-muted-foreground">profils de maîtrise</div>
          </div>
        </div>

        {/* Secondary Evidence & Evaluation Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <Activity className="size-3" /> Évaluations épreuve
            </div>
            <div className="font-mono font-semibold text-foreground text-sm mt-0.5">
              {usage.skill_assessments}
            </div>
          </div>
          <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <ShieldCheck className="size-3" /> Preuves observées
            </div>
            <div className="font-mono font-semibold text-foreground text-sm mt-0.5">
              {usage.skill_evidence}
            </div>
          </div>
          <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <PenTool className="size-3" /> Corrections Écrites
            </div>
            <div className="font-mono font-semibold text-foreground text-sm mt-0.5">
              {usage.writing_evaluations}
            </div>
          </div>
          <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <Mic className="size-3" /> Évaluations Orales
            </div>
            <div className="font-mono font-semibold text-foreground text-sm mt-0.5">
              {usage.speaking_evaluations}
            </div>
          </div>
        </div>
      </div>

      {/* Safety Notice if dependencies exist */}
      {usage.total_dependencies > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
          <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold">Compétence protégée contre la suppression :</span>{" "}
            Cette compétence est activement référencée par {usage.total_dependencies} enregistrements.
            La suppression directe est verrouillée pour préserver la cohérence des notes des candidats.
            Vous pouvez archiver cette compétence si elle ne doit plus être proposée sur les nouveaux contenus.
          </div>
        </div>
      )}
    </div>
  );
};
