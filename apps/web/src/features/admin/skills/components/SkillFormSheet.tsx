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
import { skillFormSchema, type SkillFormValues } from "../schemas";
import type { TaxonomySkillDetail, TaxonomySkillItem } from "../types";

interface SkillFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillToEdit: TaxonomySkillDetail | TaxonomySkillItem | null;
  onSubmit: (values: SkillFormValues) => Promise<void>;
  isSubmitting: boolean;
  availableDomains?: string[];
}

export const SkillFormSheet: React.FC<SkillFormSheetProps> = ({
  open,
  onOpenChange,
  skillToEdit,
  onSubmit,
  isSubmitting,
  availableDomains = [],
}) => {
  const isEditing = !!skillToEdit;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SkillFormValues>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: {
      code: "",
      name: "",
      dimension: "reasoning",
      domain: "reading",
      category: "reading",
      description: "",
      is_active: true,
    },
  });

  const selectedDimension = watch("dimension");

  useEffect(() => {
    if (skillToEdit) {
      reset({
        code: skillToEdit.code,
        name: skillToEdit.name,
        dimension: skillToEdit.dimension || "reasoning",
        domain: skillToEdit.domain || "reading",
        category: skillToEdit.category || skillToEdit.domain || "reading",
        description: skillToEdit.description || "",
        parent_id: skillToEdit.parent_id || null,
        is_active: skillToEdit.is_active ?? true,
      });
    } else {
      reset({
        code: "",
        name: "",
        dimension: "reasoning",
        domain: "reading",
        category: "reading",
        description: "",
        parent_id: null,
        is_active: true,
      });
    }
  }, [skillToEdit, reset, open]);

  const handleFormSubmit = async (data: SkillFormValues) => {
    await onSubmit(data);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col justify-between overflow-y-auto">
        <div className="space-y-6">
          <SheetHeader>
            <SheetTitle>
              {isEditing ? "Modifier la compétence" : "Nouvelle compétence"}
            </SheetTitle>
            <SheetDescription>
              {isEditing
                ? "Mettez à jour les informations pédagogiques et la dimension de cette compétence."
                : "Définissez une nouvelle compétence racine dans la taxonomie d'évaluation TEF."}
            </SheetDescription>
          </SheetHeader>

          <form id="skill-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 text-xs sm:text-sm">
            {/* Dimension Selection */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-foreground">
                Dimension taxonomique <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setValue("dimension", "reasoning")}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    selectedDimension === "reasoning"
                      ? "bg-indigo-500/10 border-indigo-500/40 ring-1 ring-indigo-500/30 text-indigo-700 dark:text-indigo-300"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <div className="font-semibold text-xs">Raisonnement</div>
                  <div className="text-[10px] opacity-80">Opération cognitive</div>
                </button>

                <button
                  type="button"
                  onClick={() => setValue("dimension", "language")}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    selectedDimension === "language"
                      ? "bg-teal-500/10 border-teal-500/40 ring-1 ring-teal-500/30 text-teal-700 dark:text-teal-300"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <div className="font-semibold text-xs">Langue</div>
                  <div className="text-[10px] opacity-80">Outil linguistique</div>
                </button>
              </div>
              {errors.dimension && (
                <p className="text-[11px] text-destructive">{errors.dimension.message}</p>
              )}
            </div>

            {/* Code Field */}
            <div className="space-y-1.5">
              <label htmlFor="skill-code" className="block font-semibold text-foreground">
                Code machine unique <span className="text-destructive">*</span>
              </label>
              <input
                id="skill-code"
                type="text"
                disabled={isEditing}
                placeholder="ex. reasoning.inference.implicit, gram_pronoms_relatifs"
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
              <p className="text-[11px] text-muted-foreground">
                Identifiant sémantique immuable utilisé dans le moteur de scoring et les tags d'items.
              </p>
            </div>

            {/* Name Field */}
            <div className="space-y-1.5">
              <label htmlFor="skill-name" className="block font-semibold text-foreground">
                Nom d'affichage (Français) <span className="text-destructive">*</span>
              </label>
              <input
                id="skill-name"
                type="text"
                placeholder="ex. Repérer des informations factuelles précises"
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

            {/* Domain & Category Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="skill-domain" className="block font-semibold text-foreground">
                  Domaine / Famille <span className="text-destructive">*</span>
                </label>
                <input
                  id="skill-domain"
                  type="text"
                  placeholder="ex. syntax, reading, vocabulary"
                  {...register("domain")}
                  className={`w-full px-3 py-2 rounded-lg border text-xs text-foreground bg-background transition ${
                    errors.domain
                      ? "border-destructive focus:ring-destructive"
                      : "border-border focus:ring-primary"
                  }`}
                />
                {errors.domain && (
                  <p className="text-[11px] text-destructive">{errors.domain.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="skill-category" className="block font-semibold text-foreground">
                  Modalité d'examen
                </label>
                <select
                  id="skill-category"
                  {...register("category")}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground transition cursor-pointer"
                >
                  <option value="reading">Compréhension écrite</option>
                  <option value="listening">Compréhension orale</option>
                  <option value="writing">Expression écrite</option>
                  <option value="speaking">Expression orale</option>
                  <option value="transversal">Transversal / Tous</option>
                </select>
              </div>
            </div>

            {/* Description Field */}
            <div className="space-y-1.5">
              <label htmlFor="skill-description" className="block font-semibold text-foreground">
                Description pédagogique
              </label>
              <textarea
                id="skill-description"
                rows={4}
                placeholder="Précisez le périmètre attendu, les types d'erreurs fréquentes associées et les consignes d'évaluation..."
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
                id="skill-active"
                type="checkbox"
                {...register("is_active")}
                className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
              />
              <label htmlFor="skill-active" className="text-xs font-medium text-foreground cursor-pointer">
                Compétence active (disponible pour l'étiquetage de nouvelles questions et exercices)
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
            form="skill-form"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold cursor-pointer"
          >
            {isSubmitting
              ? "Enregistrement..."
              : isEditing
              ? "Enregistrer les modifications"
              : "Créer la compétence"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
