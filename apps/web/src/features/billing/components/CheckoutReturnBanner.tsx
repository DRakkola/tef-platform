import React from "react";
import { CheckCircle2, Clock, AlertCircle, X } from "lucide-react";

export type CheckoutReturnStatus = "success" | "pending" | "failed" | "cancelled" | null;

interface CheckoutReturnBannerProps {
  status: CheckoutReturnStatus;
  onDismiss: () => void;
}

export const CheckoutReturnBanner: React.FC<CheckoutReturnBannerProps> = ({
  status,
  onDismiss,
}) => {
  if (!status) return null;

  if (status === "success") {
    return (
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-start justify-between gap-3 text-sm">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">
              Paiement confirmé avec succès !
            </p>
            <p className="text-xs text-muted-foreground">
              Votre formule et vos crédits ont été activés. Vos fonctionnalités sont immédiatement disponibles.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground p-1"
          aria-label="Fermer la notification"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-start justify-between gap-3 text-sm">
        <div className="flex items-start gap-3">
          <Clock className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">
              Paiement en cours de confirmation...
            </p>
            <p className="text-xs text-muted-foreground">
              Nous attendons la confirmation de votre banque. Vos droits d'accès seront activés automatiquement d'ici quelques instants.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground p-1"
          aria-label="Fermer la notification"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  if (status === "failed" || status === "cancelled") {
    return (
      <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start justify-between gap-3 text-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">
              {status === "cancelled" ? "Paiement interrompu" : "Échec de finalisation du paiement"}
            </p>
            <p className="text-xs text-muted-foreground">
              {status === "cancelled"
                ? "Vous avez interrompu la session de paiement. Aucun prélèvement n'a été effectué."
                : "La transaction n'a pas pu être validée par votre établissement bancaire. Aucun montant n'a été débité."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground p-1"
          aria-label="Fermer la notification"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return null;
};
