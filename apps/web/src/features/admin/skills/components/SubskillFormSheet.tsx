import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { subskillFormSchema, type SubskillFormValues } from "../schemas";
import type { SkillItem, SubSkill } from "../types";

interface SubskillFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentSkill: SkillItem | null;
  subskillToEdit: SubSkill | null;
  onSubmit: (values: SubskillFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export const SubskillFormSheet: React.FC<SubskillFormSheetProps> = ({
  open,
  onOpenChange,
  parentSkill,
  subskillToEdit,
  onSubmit,
  isSubmitting,
}) => {
  const isEditing = !!subskillToEdit;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SubskillFormValues>({
    resolver: zodResolver(subskillFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (subskillToEdit) {
      reset({
        code: subskillToEdit.code,
        name: subskillToEdit.name,
        description: subskillToEdit.description || "",
      });
    } else {
      reset({
        code: "",
        name: "",
        description: "",
      });
    }
  }, [subskillToEdit, reset, open]);

  const handleFormSubmit = async (data: SubskillFormValues) => {
    await onSubmit(data);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col justify-between overflow-y-auto">
        <div className="space-y-6">
          <SheetHeader>
            <SheetTitle>
              {isEditing ? "Modifier la sous-compétence" : "Ajouter une sous-compétence"}
            </SheetTitle>
            <SheetDescription>
              {isEditing
                ? `Modification de l'unité pédagogique rattachée à ${parentSkill?.name || "la compétence"}.`
                : `Définissez une sous-compétence pour affiner l'évaluation sous ${parentSkill?.name || "la compétence"}.`}
            </SheetDescription>
          </SheetHeader>

          {/* Parent Skill Context Pill */}
          {parentSkill && (
            <div className="p-3 bg-muted/40 rounded-xl border border-border/70 text-xs space-y-1">
              <span className="text-muted-foreground font-medium block">Compétence parente :</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{parentSkill.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">({parentSkill.code})</span>
              </div>
            </div>
          )}

          <form id="subskill-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 text-xs sm:text-sm">
            {/* Subskill Code */}
            <div className="space-y-1.5">
              <label htmlFor="sub-code" className="block font-semibold text-foreground">
                Code sous-compétence (Unique) <span className="text-destructive">*</span>
              </label>
              <input
                id="sub-code"
                type="text"
                disabled={isEditing}
                placeholder="ex. reading_implicit_tone, grammar_subjunctive"
                {...register("code")}
                className={`w-full px-3 py-2 rounded-lg border font-mono text-xs text-foreground bg-background transition ${
                  isEditing
                    ? "opacity-60 cursor-not-allowed bg-muted"
                    : "focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                } ${errors.code ? "border-destructive ring-1 ring-destructive/40" : "border-border"}`}
              />
              {isEditing && (
                <p className="text-[11px] text-muted-foreground">
                  Le code unique ne peut pas être modifié après création.
                </p>
              )}
              {errors.code && (
                <p className="text-xs text-destructive font-medium">{errors.code.message}</p>
              )}
            </div>

            {/* Subskill Name */}
            <div className="space-y-1.5">
              <label htmlFor="sub-name" className="block font-semibold text-foreground">
                Intitulé de la sous-compétence <span className="text-destructive">*</span>
              </label>
              <input
                id="sub-name"
                type="text"
                placeholder="ex. Repérer le ton ironique de l'auteur"
                {...register("name")}
                className={`w-full px-3 py-2 rounded-lg border text-xs sm:text-sm text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition ${
                  errors.name ? "border-destructive ring-1 ring-destructive/40" : "border-border"
                }`}
              />
              {errors.name && (
                <p className="text-xs text-destructive font-medium">{errors.name.message}</p>
              )}
            </div>

            {/* Subskill Description */}
            <div className="space-y-1.5">
              <label htmlFor="sub-desc" className="block font-semibold text-foreground">
                Description pédagogique & Indicateur
              </label>
              <textarea
                id="sub-desc"
                rows={3}
                placeholder="Critère diagnostique précis associé à cette micro-compétence..."
                {...register("description")}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
              />
              {errors.description && (
                <p className="text-xs text-destructive font-medium">
                  {errors.description.message}
                </p>
              )}
            </div>
          </form>
        </div>

        <SheetFooter className="pt-6 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="cursor-pointer"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            form="subskill-form"
            size="sm"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold cursor-pointer"
          >
            {isSubmitting ? "Enregistrement..." : isEditing ? "Sauvegarder" : "Ajouter la sous-compétence"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
