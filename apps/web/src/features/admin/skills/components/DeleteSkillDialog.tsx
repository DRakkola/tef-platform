import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldAlert, Archive } from "lucide-react";
import type { SkillItem } from "../types";

interface DeleteSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: SkillItem | null;
  onConfirmDelete: () => Promise<void>;
  onArchiveInstead: () => Promise<void>;
  isDeleting: boolean;
}

export const DeleteSkillDialog: React.FC<DeleteSkillDialogProps> = ({
  open,
  onOpenChange,
  skill,
  onConfirmDelete,
  onArchiveInstead,
  isDeleting,
}) => {
  if (!skill) return null;

  const usage = skill.usage_counts || {
    questions: 0,
    exercises: 0,
    assessments: 0,
    student_mastery: 0,
    total_dependencies: 0,
  };

  const isBlocked = usage.total_dependencies > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                isBlocked
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {isBlocked ? <ShieldAlert className="size-5" /> : <AlertTriangle className="size-5" />}
            </div>
            <div>
              <AlertDialogTitle>
                {isBlocked ? "Suppression bloquée" : "Supprimer la compétence"}
              </AlertDialogTitle>
              <div className="text-xs font-mono text-muted-foreground mt-0.5">
                {skill.name} ({skill.code})
              </div>
            </div>
          </div>

          <AlertDialogDescription className="text-xs pt-2 text-foreground space-y-3 leading-relaxed">
            {isBlocked ? (
              <>
                <p>
                  Cette compétence ne peut pas être supprimée car elle est activement liée à des données de production :
                </p>
                <div className="bg-muted/60 p-3 rounded-xl border border-border/80 space-y-1.5 font-mono text-xs">
                  {usage.questions > 0 && <div>• {usage.questions} question(s) d'examen</div>}
                  {usage.exercises > 0 && <div>• {usage.exercises} exercice(s) drill</div>}
                  {usage.assessments > 0 && <div>• {usage.assessments} simulation(s) TEF</div>}
                  {usage.student_mastery > 0 && <div>• {usage.student_mastery} profil(s) de progression étudiant</div>}
                </div>
                <p className="text-muted-foreground">
                  Une suppression supprimerait en cascade ou invaliderait l'historique d'apprentissage des candidats. Nous vous recommandons d'archiver la compétence afin de la masquer sans corrompre les données.
                </p>
              </>
            ) : (
              <p>
                Êtes-vous sûr de vouloir supprimer définitivement la compétence{" "}
                <span className="font-semibold text-foreground">"{skill.name}"</span> ?{" "}
                Ses {skill.subskills?.length || 0} sous-compétence(s) seront également supprimées. Cette action est irréversible.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isDeleting} className="cursor-pointer">
            Fermer
          </AlertDialogCancel>

          {isBlocked ? (
            <Button
              type="button"
              onClick={onArchiveInstead}
              disabled={isDeleting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1 cursor-pointer"
            >
              <Archive className="size-3.5" /> Archiver la compétence
            </Button>
          ) : (
            <AlertDialogAction
              onClick={onConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs cursor-pointer"
            >
              {isDeleting ? "Suppression..." : "Supprimer définitivement"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
