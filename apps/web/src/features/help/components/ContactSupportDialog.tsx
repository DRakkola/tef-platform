import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Send, RotateCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitSupportTicket } from "../useHelp";
import type { SupportTicketPriority } from "../types";

interface ContactSupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: string;
  defaultSubject?: string;
}

const CATEGORY_OPTIONS = [
  { value: "general", label: "Question générale" },
  { value: "billing", label: "Facturation & Abonnements" },
  { value: "assessments", label: "Évaluations & Examens blancs" },
  { value: "writing", label: "Atelier de rédaction" },
  { value: "speaking", label: "Expression orale" },
  { value: "practice_pool", label: "Practice Pool" },
  { value: "technical", label: "Incident technique" },
];

export const ContactSupportDialog: React.FC<ContactSupportDialogProps> = ({
  open,
  onOpenChange,
  defaultCategory = "general",
  defaultSubject = "",
}) => {
  const [category, setCategory] = useState<string>(defaultCategory);
  const [subject, setSubject] = useState<string>(defaultSubject);
  const [description, setDescription] = useState<string>("");
  const [priority, setPriority] = useState<SupportTicketPriority>("medium");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  const submitMutation = useSubmitSupportTicket();

  useEffect(() => {
    if (open) {
      setCategory(defaultCategory || "general");
      setSubject(defaultSubject || "");
      setDescription("");
      setPriority("medium");
      setErrors({});
      setSubmittedTicketId(null);
    }
  }, [open, defaultCategory, defaultSubject]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!subject.trim() || subject.trim().length < 3) {
      newErrors.subject = "Le sujet doit comporter au moins 3 caractères.";
    }
    if (!description.trim() || description.trim().length < 10) {
      newErrors.description = "Veuillez détailler votre message (au moins 10 caractères).";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const res = await submitMutation.mutateAsync({
        category,
        subject: subject.trim(),
        description: description.trim(),
        priority,
        context: {
          url: window.location.href,
          userAgent: navigator.userAgent,
        },
      });
      setSubmittedTicketId(res.id);
    } catch {
      // Error handled by mutation state
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {submittedTicketId ? (
          <div className="py-6 text-center space-y-4">
            <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="size-7" />
            </div>
            <div className="space-y-1.5">
              <DialogTitle className="text-xl font-bold text-foreground">
                Votre demande a bien été envoyée
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Notre équipe pédagogique et technique a bien reçu votre message. Vous recevrez une réponse par e-mail dans les plus brefs délais.
              </DialogDescription>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border/80 inline-block text-xs font-mono text-muted-foreground">
              Référence : <span className="font-semibold text-foreground">{submittedTicketId}</span>
            </div>
            <div className="pt-2">
              <Button type="button" onClick={handleClose} className="w-full sm:w-auto">
                Fermer
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">
                Contacter le support
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Décrivez votre situation pour que notre équipe puisse vous aider efficacement.
              </DialogDescription>
            </DialogHeader>

            {submitMutation.isError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>
                  Votre demande n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.
                </span>
              </div>
            )}

            <div className="space-y-3">
              {/* Category */}
              <div className="space-y-1">
                <label
                  htmlFor="support-category"
                  className="text-xs font-semibold text-foreground block"
                >
                  Catégorie
                </label>
                <select
                  id="support-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <label
                  htmlFor="support-subject"
                  className="text-xs font-semibold text-foreground block"
                >
                  Sujet de la demande <span className="text-destructive">*</span>
                </label>
                <Input
                  id="support-subject"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    if (errors.subject) setErrors((prev) => ({ ...prev, subject: "" }));
                  }}
                  placeholder="Ex : Question sur l'épreuve de rédaction, bug d'affichage..."
                  className="h-9 text-xs"
                  aria-invalid={Boolean(errors.subject)}
                  aria-describedby={errors.subject ? "subject-error" : undefined}
                />
                {errors.subject && (
                  <p id="subject-error" className="text-[11px] text-destructive font-medium">
                    {errors.subject}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label
                  htmlFor="support-description"
                  className="text-xs font-semibold text-foreground block"
                >
                  Description détaillée <span className="text-destructive">*</span>
                </label>
                <Textarea
                  id="support-description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (errors.description) setErrors((prev) => ({ ...prev, description: "" }));
                  }}
                  placeholder="Expliquez ce qui s'est passé, les étapes pour reproduire ou votre question précise..."
                  rows={4}
                  className="text-xs resize-none"
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={errors.description ? "description-error" : undefined}
                />
                {errors.description && (
                  <p id="description-error" className="text-[11px] text-destructive font-medium">
                    {errors.description}
                  </p>
                )}
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <label
                  htmlFor="support-priority"
                  className="text-xs font-semibold text-foreground block"
                >
                  Niveau d'urgence
                </label>
                <select
                  id="support-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="low">Faible — Renseignement général</option>
                  <option value="medium">Normale — Question sur un cours ou une épreuve</option>
                  <option value="high">Élevée — Examen ou session bloquée</option>
                  <option value="urgent">Urgente — Problème critique avant date officielle</option>
                </select>
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={submitMutation.isPending}
                className="text-xs"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={submitMutation.isPending}
                className="text-xs"
              >
                {submitMutation.isPending ? (
                  <>
                    <RotateCw className="size-3.5 mr-1.5 animate-spin" />
                    <span>Envoi...</span>
                  </>
                ) : (
                  <>
                    <Send className="size-3.5 mr-1.5" />
                    <span>Envoyer ma demande</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
