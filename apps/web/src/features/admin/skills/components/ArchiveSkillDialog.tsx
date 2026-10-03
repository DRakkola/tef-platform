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
import { Archive, AlertCircle } from "lucide-react";
import type { TaxonomySkillDetail, TaxonomySkillItem } from "../types";

interface ArchiveSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: TaxonomySkillDetail | TaxonomySkillItem | null;
  onConfirmArchive: () => Promise<void>;
  isArchiving: boolean;
}

export const ArchiveSkillDialog: React.FC<ArchiveSkillDialogProps> = ({
  open,
  onOpenChange,
  skill,
  onConfirmArchive,
  isArchiving,
}) => {
  if (!skill) return null;

  const usage = skill.usage_counts || {
    questions: 0,
    exercises: 0,
    assessments: 0,
    student_mastery: 0,
    total_dependencies: 0,
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Archive className="size-5" />
            </div>
            <div>
              <AlertDialogTitle>Archiver la compétence</AlertDialogTitle>
              <div className="text-xs font-mono text-muted-foreground mt-0.5">
                {skill.name} ({skill.code})
              </div>
            </div>
          </div>

          <div className="text-xs pt-2 text-foreground space-y-3 leading-relaxed">
            <p>
              L'archivage d'une compétence est une opération sûre et réversible :
            </p>

            <div className="bg-muted/60 p-3 rounded-xl border border-border/80 space-y-1.5 font-mono text-xs">
              <div>• {usage.questions} question(s) d'examen existante(s)</div>
              <div>• {usage.exercises} exercice(s) drill existant(s)</div>
              <div>• {usage.student_mastery} profil(s) de progression étudiant</div>
              <div>• {usage.total_dependencies} référence(s) totale(s) dans le système</div>
            </div>

            <p className="text-muted-foreground">
              La compétence ne pourra plus être sélectionnée lors de la création ou modification de nouveaux contenus.
              Toutes les évaluations, notes et historiques passés des candidats resteront parfaitement intacts.
            </p>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isArchiving} className="cursor-pointer">
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault();
              await onConfirmArchive();
            }}
            disabled={isArchiving}
            className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
          >
            {isArchiving ? "Archivage en cours..." : "Confirmer l'archivage"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
