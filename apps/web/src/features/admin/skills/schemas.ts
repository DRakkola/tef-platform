import { z } from "zod";

export const skillFormSchema = z.object({
  code: z
    .string()
    .min(2, "Le code doit contenir au moins 2 caractères.")
    .max(100, "Le code ne peut pas dépasser 100 caractères.")
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Le code doit contenir des caractères alphanumériques, tirets, tirets bas ou points uniquement."
    ),
  name: z
    .string()
    .min(2, "Le nom doit comporter au moins 2 caractères.")
    .max(255, "Le nom ne peut pas dépasser 255 caractères."),
  dimension: z.enum(["reasoning", "language"], {
    error: "Veuillez sélectionner une dimension (raisonnement ou langue).",
  }),
  domain: z
    .string()
    .min(2, "Le domaine doit contenir au moins 2 caractères.")
    .max(50, "Le domaine ne peut pas dépasser 50 caractères."),
  category: z.string().optional().nullable(),
  description: z.string().max(1000, "La description ne peut pas dépasser 1000 caractères.").optional().nullable(),
  parent_id: z.string().uuid("Identifiant parent invalide").optional().nullable(),
  is_active: z.boolean().default(true),
});

export type SkillFormValues = z.infer<typeof skillFormSchema>;

export const childSkillFormSchema = z.object({
  code: z
    .string()
    .min(2, "Le code doit contenir au moins 2 caractères.")
    .max(100, "Le code ne peut pas dépasser 100 caractères.")
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Le code doit contenir des caractères alphanumériques, tirets, tirets bas ou points uniquement."
    ),
  name: z
    .string()
    .min(2, "Le nom doit comporter au moins 2 caractères.")
    .max(255, "Le nom ne peut pas dépasser 255 caractères."),
  description: z.string().max(1000, "La description ne peut pas dépasser 1000 caractères.").optional().nullable(),
  category: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

export type ChildSkillFormValues = z.infer<typeof childSkillFormSchema>;
export type SubskillFormValues = ChildSkillFormValues;

export const cefrDescriptorFormSchema = z.object({
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  descriptor: z
    .string()
    .min(3, "Le descripteur can-do doit comporter au moins 3 caractères.")
    .max(2000, "Le descripteur ne peut pas dépasser 2000 caractères."),
  evidence_guidance: z
    .string()
    .max(2000, "Les critères de preuve ne peuvent pas dépasser 2000 caractères.")
    .optional()
    .nullable(),
});

export type CefrDescriptorFormValues = z.infer<typeof cefrDescriptorFormSchema>;

export const skillRelationFormSchema = z.object({
  to_skill_id: z.string().min(1, "Veuillez sélectionner une compétence cible."),
  relation_type: z.enum(["prerequisite", "depends_on", "supports", "related"], {
    error: "Veuillez sélectionner un type de relation valide.",
  }),
});

export type SkillRelationFormValues = z.infer<typeof skillRelationFormSchema>;
