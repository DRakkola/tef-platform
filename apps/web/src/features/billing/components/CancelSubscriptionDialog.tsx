import React from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatBillingDate } from "./CurrentPlanHero";
import type { Subscription } from "../types";

interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription?: Subscription;
  onConfirmCancel: () => Promise<void>;
  isPending: boolean;
}

export const CancelSubscriptionDialog: React.FC<CancelSubscriptionDialogProps> = ({
  open,
  onOpenChange,
  subscription,
  onConfirmCancel,
  isPending,
}) => {
  const endDate = formatBillingDate(subscription?.current_period_end);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive pb-1">
            <AlertTriangle className="size-5" />
            <DialogTitle className="text-base font-semibold">
              Résilier votre abonnement
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Êtes-vous certain de vouloir mettre fin au renouvellement automatique de votre formule ?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs text-muted-foreground">
          <div className="p-3.5 rounded-lg bg-muted/60 border border-border/80 space-y-1.5">
            <p className="font-semibold text-foreground">
              Ce qui va se passer :
            </p>
            <ul className="list-disc pl-4 space-y-1 leading-relaxed">
              <li>
                Votre accès reste <strong className="text-foreground">100% actif jusqu'au {endDate}</strong>.
              </li>
              <li>
                Aucun prélèvement supplémentaire ne sera effectué après cette date.
              </li>
              <li>
                Vos simulations complétées, vos notes et vos crédits achetés restent conservés sur votre compte.
              </li>
              <li>
                Vous pouvez réactiver votre abonnement à tout moment avant ou après l'échéance.
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Conserver mon abonnement
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirmCancel}
            disabled={isPending}
          >
            {isPending ? "Résiliation en cours..." : "Confirmer la résiliation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
