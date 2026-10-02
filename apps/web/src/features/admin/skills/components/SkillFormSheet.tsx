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
import type { SkillItem } from "../types";

interface SkillFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillToEdit: SkillItem | null;
  onSubmit: (values: SkillFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export const SkillFormSheet: React.FC<SkillFormSheetProps> = ({
  open,
  onOpenChange,
  skillToEdit,
  onSubmit,
  isSubmitting,
}) => {
  const isEditing = !!skillToEdit;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SkillFormValues>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: {
      code: "",
      name: "",
      category: "reading",
      description: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (skillToEdit) {
      reset({
        code: skillToEdit.code,
        name: skillToEdit.name,
        category: (skillToEdit.category as any) || "reading",
        description: skillToEdit.description || "",
        is_active: skillToEdit.is_active ?? true,
      });
    } else {
      reset({
        code: "",
        name: "",
        category: "reading",
        description: "",
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
                ? "Mettez à jour les informations pédagogiques et le périmètre de cette compétence."
                : "Définissez une nouvelle compétence racine dans la taxonomie d'évaluation TEF."}
            </SheetDescription>
          </SheetHeader>

          <form id="skill-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 text-xs sm:text-sm">
            {/* Code Field */}
            <div className="space-y-1.5">
              <label htmlFor="skill-code" className="block font-semibold text-foreground">
                Code machine unique <span className="text-destructive">*</span>
              </label>
              <input
                id="skill-code"
                type="text"
                disabled={isEditing}
                placeholder="ex. reading_comprehension, grammar_syntax"
                {...register("code")}
                className={`w-full px-3 py-2 rounded-lg border font-mono text-xs text-foreground bg-background transition ${
                  isEditing
                    ? "opacity-60 cursor-not-allowed bg-muted"
                    : "focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                } ${errors.code ? "border-destructive ring-1 ring-destructive/40" : "border-border"}`}
              />
              {isEditing && (
                <p className="text-[11px] text-muted-foreground">
                  Le code unique est verrouillé en édition pour garantir l'intégrité des référencements externes.
                </p>
              )}
              {errors.code && (
                <p className="text-xs text-destructive font-medium">{errors.code.message}</p>
              )}
            </div>

            {/* Name Field */}
            <div className="space-y-1.5">
              <label htmlFor="skill-name" className="block font-semibold text-foreground">
                Intitulé de la compétence <span className="text-destructive">*</span>
              </label>
              <input
                id="skill-name"
                type="text"
                placeholder="ex. Compréhension Écrite, Grammaire & Syntaxe"
                {...register("name")}
                className={`w-full px-3 py-2 rounded-lg border text-xs sm:text-sm text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition ${
                  errors.name ? "border-destructive ring-1 ring-destructive/40" : "border-border"
                }`}
              />
              {errors.name && (
                <p className="text-xs text-destructive font-medium">{errors.name.message}</p>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="space-y-1.5">
              <label htmlFor="skill-category" className="block font-semibold text-foreground">
                Domaine d'épreuve TEF <span className="text-destructive">*</span>
              </label>
              <select
                id="skill-category"
                {...register("category")}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition cursor-pointer"
              >
                <option value="reading">Compréhension Écrite (Reading)</option>
                <option value="listening">Compréhension Orale (Listening)</option>
                <option value="writing">Expression Écrite (Writing)</option>
                <option value="speaking">Expression Orale (Speaking)</option>
                <option value="grammar">Grammaire & Syntaxe (Grammar)</option>
                <option value="vocabulary">Vocabulaire & Lexique (Vocabulary)</option>
                <option value="conjugation">Conjugaison & Modes (Conjugation)</option>
              </select>
              {errors.category && (
                <p className="text-xs text-destructive font-medium">{errors.category.message}</p>
              )}
            </div>

            {/* Description Field */}
            <div className="space-y-1.5">
              <label htmlFor="skill-desc" className="block font-semibold text-foreground">
                Description & Objectifs pédagogiques
              </label>
              <textarea
                id="skill-desc"
                rows={4}
                placeholder="Décrivez les objectifs linguistiques, les critères attendus et le périmètre d'évaluation..."
                {...register("description")}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
              />
              {errors.description && (
                <p className="text-xs text-destructive font-medium">
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* Active Toggle */}
            <div className="pt-2 flex items-center gap-2.5">
              <input
                id="skill-active"
                type="checkbox"
                {...register("is_active")}
                className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
              />
              <label htmlFor="skill-active" className="text-xs text-foreground font-medium cursor-pointer">
                Compétence active dans le catalogue
              </label>
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
            form="skill-form"
            size="sm"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold cursor-pointer"
          >
            {isSubmitting ? "Enregistrement..." : isEditing ? "Sauvegarder" : "Créer la compétence"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
