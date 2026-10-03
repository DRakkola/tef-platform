import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cefrDescriptorFormSchema, type CefrDescriptorFormValues } from "../schemas";
import type { TaxonomySkillDetail, SkillLevelDescriptor, CEFRBand } from "../types";

interface CefrDescriptorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: TaxonomySkillDetail | null;
  level: CEFRBand | null;
  descriptorToEdit: SkillLevelDescriptor | null;
  onSubmit: (values: CefrDescriptorFormValues) => Promise<void>;
  isSubmitting: boolean;
}

const CEFR_BANDS: CEFRBand[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const CefrDescriptorDialog: React.FC<CefrDescriptorDialogProps> = ({
  open,
  onOpenChange,
  skill,
  level,
  descriptorToEdit,
  onSubmit,
  isSubmitting,
}) => {
  const isEditing = !!descriptorToEdit;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CefrDescriptorFormValues>({
    resolver: zodResolver(cefrDescriptorFormSchema),
    defaultValues: {
      level: level || "B1",
      descriptor: "",
      evidence_guidance: "",
    },
  });

  useEffect(() => {
    if (descriptorToEdit) {
      reset({
        level: descriptorToEdit.level,
        descriptor: descriptorToEdit.descriptor,
        evidence_guidance: descriptorToEdit.evidence_guidance || "",
      });
    } else {
      reset({
        level: level || "B1",
        descriptor: "",
        evidence_guidance: "",
      });
    }
  }, [descriptorToEdit, level, reset, open]);

  const handleFormSubmit = async (data: CefrDescriptorFormValues) => {
    await onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Modifier le descripteur CECRL (${level})` : `Définir le descripteur CECRL (${level || "Palier"})`}
          </DialogTitle>
          <DialogDescription>
            Étalonnage de la compétence{" "}
            <span className="font-semibold text-foreground">{skill?.name}</span> selon le Cadre européen commun de référence.
          </DialogDescription>
        </DialogHeader>

        <form id="cefr-descriptor-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 text-xs sm:text-sm">
          {/* Level Select */}
          <div className="space-y-1.5">
            <label htmlFor="cefr-level" className="block font-semibold text-foreground">
              Palier CECRL <span className="text-destructive">*</span>
            </label>
            <select
              id="cefr-level"
              {...register("level")}
              disabled={!!level}
              className={`w-full px-3 py-2 rounded-lg border text-xs text-foreground bg-background transition ${
                level ? "opacity-75 cursor-not-allowed bg-muted" : "cursor-pointer"
              }`}
            >
              {CEFR_BANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            {errors.level && (
              <p className="text-[11px] text-destructive">{errors.level.message}</p>
            )}
          </div>

          {/* Can-do Statement */}
          <div className="space-y-1.5">
            <label htmlFor="cefr-descriptor" className="block font-semibold text-foreground">
              Énoncé de compétence (« Can-do ») <span className="text-destructive">*</span>
            </label>
            <textarea
              id="cefr-descriptor"
              rows={3}
              placeholder="ex. Peut repérer des informations factuelles dans un document administratif simple..."
              {...register("descriptor")}
              className={`w-full px-3 py-2 rounded-lg border text-xs text-foreground bg-background transition ${
                errors.descriptor
                  ? "border-destructive focus:ring-destructive"
                  : "border-border focus:ring-primary"
              }`}
            />
            {errors.descriptor && (
              <p className="text-[11px] text-destructive">{errors.descriptor.message}</p>
            )}
          </div>

          {/* Evidence Guidance */}
          <div className="space-y-1.5">
            <label htmlFor="cefr-evidence" className="block font-semibold text-foreground">
              Critères de preuve & observable
            </label>
            <textarea
              id="cefr-evidence"
              rows={3}
              placeholder="ex. Identifier 4 éléments sur 5 sans ambiguïté dans un temps contraint..."
              {...register("evidence_guidance")}
              className="w-full px-3 py-2 rounded-lg border border-border text-xs text-foreground bg-background focus:ring-1 focus:ring-primary transition"
            />
            <p className="text-[11px] text-muted-foreground">
              Guide d'interprétation pour le moteur de diagnostic et les corrections d'expression.
            </p>
          </div>
        </form>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="cursor-pointer"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            form="cefr-descriptor-form"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold cursor-pointer"
          >
            {isSubmitting ? "Enregistrement..." : "Enregistrer le descripteur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
