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
import { childSkillFormSchema, type ChildSkillFormValues } from "../schemas";
import type { TaxonomySkillDetail, TaxonomySkillSummary } from "../types";

interface SubskillFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentSkill: TaxonomySkillDetail | null;
  subskillToEdit: TaxonomySkillSummary | null;
  onSubmit: (values: ChildSkillFormValues) => Promise<void>;
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
  } = useForm<ChildSkillFormValues>({
    resolver: zodResolver(childSkillFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      category: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (subskillToEdit) {
      reset({
        code: subskillToEdit.code,
        name: subskillToEdit.name,
        description: "",
        category: subskillToEdit.category || "",
        is_active: subskillToEdit.is_active ?? true,
      });
    } else if (parentSkill) {
      // Suggest a prefixed machine code
      const suggestedCode = `${parentSkill.code}.`;
      reset({
        code: suggestedCode,
        name: "",
        description: "",
        category: parentSkill.category || "",
        is_active: true,
      });
    }
  }, [subskillToEdit, parentSkill, reset, open]);

  const handleFormSubmit = async (data: ChildSkillFormValues) => {
    await onSubmit(data);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col justify-between overflow-y-auto">
        <div className="space-y-6">
          <SheetHeader>
            <SheetTitle>
              {isEditing ? "Modifier la sous-compétence" : "Nouvelle sous-compétence"}
            </SheetTitle>
            <SheetDescription>
              {isEditing ? (
                "Modifiez les caractéristiques de cette micro-compétence."
              ) : (
                <span>
                  Ajout d'une sous-compétence rattachée à{" "}
                  <strong className="text-foreground font-semibold">
                    {parentSkill?.name}
                  </strong>{" "}
                  ({parentSkill?.code}).
                </span>
              )}
            </SheetDescription>
          </SheetHeader>

          <form id="subskill-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 text-xs sm:text-sm">
            {/* Code Field */}
            <div className="space-y-1.5">
              <label htmlFor="subskill-code" className="block font-semibold text-foreground">
                Code machine unique <span className="text-destructive">*</span>
              </label>
              <input
                id="subskill-code"
                type="text"
                disabled={isEditing}
                placeholder="ex. reading.detail_factuel"
                {...register("code")}
                className={`w-full px-3 py-2 rounded-lg border font-mono text-xs text-foreground bg-background transition ${
                  errors.code
                    ? "border-destructive focus:ring-destructive"
                    : "border-border focus:ring-primary"
                } ${isEditing ? "opacity-60 cursor-not-allowed bg-muted" : ""}`}
              />
              {errors.code && (
                <p className="text-[11px] text-destructive">{errors.code.message}</p>
              )}
            </div>

            {/* Name Field */}
            <div className="space-y-1.5">
              <label htmlFor="subskill-name" className="block font-semibold text-foreground">
                Nom d'affichage <span className="text-destructive">*</span>
              </label>
              <input
                id="subskill-name"
                type="text"
                placeholder="ex. Repérer une date, un lieu ou un chiffre explicite"
                {...register("name")}
                className={`w-full px-3 py-2 rounded-lg border text-xs sm:text-sm text-foreground bg-background transition ${
                  errors.name
                    ? "border-destructive focus:ring-destructive"
                    : "border-border focus:ring-primary"
                }`}
              />
              {errors.name && (
                <p className="text-[11px] text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Description Field */}
            <div className="space-y-1.5">
              <label htmlFor="subskill-description" className="block font-semibold text-foreground">
                Description pédagogique
              </label>
              <textarea
                id="subskill-description"
                rows={3}
                placeholder="Détaillez la règle linguistique ou cognitive sous-jacente..."
                {...register("description")}
                className={`w-full px-3 py-2 rounded-lg border text-xs sm:text-sm text-foreground bg-background transition ${
                  errors.description
                    ? "border-destructive focus:ring-destructive"
                    : "border-border focus:ring-primary"
                }`}
              />
              {errors.description && (
                <p className="text-[11px] text-destructive">{errors.description.message}</p>
              )}
            </div>

            {/* Active Status Checkbox */}
            <div className="flex items-center gap-2 pt-2">
              <input
                id="subskill-active"
                type="checkbox"
                {...register("is_active")}
                className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
              />
              <label htmlFor="subskill-active" className="text-xs font-medium text-foreground cursor-pointer">
                Sous-compétence active
              </label>
            </div>
          </form>
        </div>

        <SheetFooter className="border-t border-border pt-4 mt-6 gap-2">
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
            form="subskill-form"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold cursor-pointer"
          >
            {isSubmitting
              ? "Enregistrement..."
              : isEditing
              ? "Enregistrer"
              : "Créer la sous-compétence"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
