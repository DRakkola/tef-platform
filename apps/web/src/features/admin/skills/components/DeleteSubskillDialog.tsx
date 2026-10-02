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
import { AlertTriangle } from "lucide-react";
import type { SubSkill } from "../types";

interface DeleteSubskillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subskill: SubSkill | null;
  onConfirmDelete: () => Promise<void>;
  isDeleting: boolean;
}

export const DeleteSubskillDialog: React.FC<DeleteSubskillDialogProps> = ({
  open,
  onOpenChange,
  subskill,
  onConfirmDelete,
  isDeleting,
}) => {
  if (!subskill) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <AlertDialogTitle>Supprimer la sous-compétence</AlertDialogTitle>
              <div className="text-xs font-mono text-muted-foreground mt-0.5">
                {subskill.name} ({subskill.code})
              </div>
            </div>
          </div>

          <AlertDialogDescription className="text-xs pt-2 text-foreground space-y-2 leading-relaxed">
            Êtes-vous sûr de vouloir supprimer la sous-compétence{" "}
            <span className="font-semibold text-foreground">"{subskill.name}"</span> ? Cette
            action supprimera l'étiquette taxonomique.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isDeleting} className="cursor-pointer">
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmDelete}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs cursor-pointer"
          >
            {isDeleting ? "Suppression..." : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
