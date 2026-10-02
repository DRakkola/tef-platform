import { z } from "zod";

export const skillFormSchema = z.object({
  code: z
    .string()
    .min(2, "Le code doit contenir au moins 2 caractères.")
    .max(100, "Le code ne peut pas dépasser 100 caractères.")
    .regex(
      /^[a-z0-9_-]+$/,
      "Le code doit être en minuscules avec des chiffres, tirets ou tirets bas uniquement."
    ),
  name: z
    .string()
    .min(2, "Le nom doit comporter au moins 2 caractères.")
    .max(255, "Le nom ne peut pas dépasser 255 caractères."),
  category: z.enum([
    "reading",
    "listening",
    "writing",
    "speaking",
    "vocabulary",
    "grammar",
    "conjugation",
  ]),
  description: z.string().max(1000, "La description ne peut pas dépasser 1000 caractères.").optional(),
  is_active: z.boolean(),
});

export type SkillFormValues = z.infer<typeof skillFormSchema>;

export const subskillFormSchema = z.object({
  code: z
    .string()
    .min(2, "Le code doit contenir au moins 2 caractères.")
    .max(100, "Le code ne peut pas dépasser 100 caractères.")
    .regex(
      /^[a-z0-9_-]+$/,
      "Le code doit être en minuscules avec des chiffres, tirets ou tirets bas uniquement."
    ),
  name: z
    .string()
    .min(2, "Le nom doit comporter au moins 2 caractères.")
    .max(255, "Le nom ne peut pas dépasser 255 caractères."),
  description: z.string().max(1000, "La description ne peut pas dépasser 1000 caractères.").optional(),
});

export type SubskillFormValues = z.infer<typeof subskillFormSchema>;
