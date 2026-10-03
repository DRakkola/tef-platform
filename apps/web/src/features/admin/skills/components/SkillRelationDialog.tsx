import React from "react";
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
import { skillRelationFormSchema, type SkillRelationFormValues } from "../schemas";
import type { TaxonomySkillDetail, TaxonomySkillItem, SkillRelationType } from "../types";

interface SkillRelationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSkill: TaxonomySkillDetail | null;
  availableSkills: TaxonomySkillItem[];
  onSubmit: (values: SkillRelationFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export const SkillRelationDialog: React.FC<SkillRelationDialogProps> = ({
  open,
  onOpenChange,
  currentSkill,
  availableSkills,
  onSubmit,
  isSubmitting,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SkillRelationFormValues>({
    resolver: zodResolver(skillRelationFormSchema),
    defaultValues: {
      to_skill_id: "",
      relation_type: "prerequisite",
    },
  });

  React.useEffect(() => {
    reset({
      to_skill_id: "",
      relation_type: "prerequisite",
    });
  }, [open, reset]);

  // Exclude current skill from target options
  const targetOptions = availableSkills.filter((s) => s.id !== currentSkill?.id);

  const handleFormSubmit = async (data: SkillRelationFormValues) => {
    await onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une relation de dépendance</DialogTitle>
          <DialogDescription>
            Liez <span className="font-semibold text-foreground">{currentSkill?.name}</span> à une autre compétence du catalogue.
          </DialogDescription>
        </DialogHeader>

        <form id="relation-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 text-xs sm:text-sm">
          {/* Target Skill Selection */}
          <div className="space-y-1.5">
            <label htmlFor="target-skill" className="block font-semibold text-foreground">
              Compétence cible <span className="text-destructive">*</span>
            </label>
            <select
              id="target-skill"
              {...register("to_skill_id")}
              className={`w-full px-3 py-2 rounded-lg border text-xs text-foreground bg-background transition cursor-pointer ${
                errors.to_skill_id
                  ? "border-destructive focus:ring-destructive"
                  : "border-border focus:ring-primary"
              }`}
            >
              <option value="">Sélectionnez une compétence...</option>
              {targetOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) — {s.dimension}
                </option>
              ))}
            </select>
            {errors.to_skill_id && (
              <p className="text-[11px] text-destructive">{errors.to_skill_id.message}</p>
            )}
          </div>

          {/* Relation Type Selection */}
          <div className="space-y-1.5">
            <label htmlFor="relation-type" className="block font-semibold text-foreground">
              Type de relation <span className="text-destructive">*</span>
            </label>
            <select
              id="relation-type"
              {...register("relation_type")}
              className="w-full px-3 py-2 rounded-lg border border-border text-xs text-foreground bg-background transition cursor-pointer"
            >
              <option value="prerequisite">Prérequis (Doit être maîtrisé avant)</option>
              <option value="depends_on">Dépendance directe (S'appuie sur)</option>
              <option value="supports">Soutient (Renforce l'apprentissage)</option>
              <option value="related">Compétence liée (Connexion transversale)</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              Le moteur d'ordonnancement vérifie l'absence de cycles cycliques lors de l'enregistrement.
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
            form="relation-form"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold cursor-pointer"
          >
            {isSubmitting ? "Création..." : "Ajouter la relation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
