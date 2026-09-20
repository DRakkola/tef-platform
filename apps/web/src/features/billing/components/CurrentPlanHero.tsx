import React from "react";
import { CreditCard, Sparkles, Calendar, ArrowRight, RotateCw } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Subscription, CreditBalance } from "../types";

interface CurrentPlanHeroProps {
  subscription?: Subscription;
  credits?: CreditBalance;
  onOpenCancelDialog: () => void;
  onResumeSubscription: () => void;
  isResuming?: boolean;
  onScrollToPlans: () => void;
}

export function formatBillingDate(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    return new Intl.DateTimeFormat("fr-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export const CurrentPlanHero: React.FC<CurrentPlanHeroProps> = ({
  subscription,
  credits,
  onOpenCancelDialog,
  onResumeSubscription,
  isResuming = false,
  onScrollToPlans,
}) => {
  const isSubActive = subscription?.status === "active";
  const isCancelling = Boolean(subscription?.cancel_at_period_end);

  const planName =
    subscription?.plan_tier === "pro"
      ? "Candidat Pro"
      : subscription?.plan_tier === "premium"
        ? "Candidat Élite"
        : subscription?.plan_tier === "starter"
          ? "Candidat Starter"
          : "Formule Découverte (Gratuit)";

  const availableCredits = credits?.available_balance ?? credits?.balance ?? 0;

  return (
    <Card className="border border-border/80 shadow-xs bg-card overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <CreditCard className="size-4 text-primary" />
          <span>Votre formule actuelle</span>
        </div>

        {isSubActive && !isCancelling && (
          <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
            Actif
          </Badge>
        )}
        {isSubActive && isCancelling && (
          <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
            Fin de période
          </Badge>
        )}
        {!isSubActive && (
          <Badge variant="secondary" className="text-xs font-medium">
            Gratuit
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Plan Info */}
          <div className="space-y-3 max-w-2xl">


            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {planName}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isCancelling ? (
                  <span className="text-amber-700 dark:text-amber-400 font-medium">
                    Accès maintenu jusqu'au {formatBillingDate(subscription?.current_period_end)}. Votre abonnement ne sera pas renouvelé.
                  </span>
                ) : isSubActive && subscription?.current_period_end ? (
                  <span>
                    Prochaine échéance de renouvellement le {formatBillingDate(subscription.current_period_end)}.
                  </span>
                ) : (
                  <span>
                    Accès aux simulations gratuites et aux exercices de base sans engagement récurrent.
                  </span>
                )}
              </p>
            </div>

            {/* Quick Stats Line */}
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                <span>Solde : <strong className="text-foreground">{availableCredits}</strong> crédits disponibles</span>
              </div>
              {subscription?.current_period_end && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5" />
                  <span>Période en cours</span>
                </div>
              )}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2.5 shrink-0">
            {isCancelling ? (
              <Button
                type="button"
                size="sm"
                onClick={onResumeSubscription}
                disabled={isResuming}
                className="w-full sm:w-auto"
              >
                <RotateCw className={`size-3.5 mr-2 ${isResuming ? "animate-spin" : ""}`} />
                {isResuming ? "Reprise en cours..." : "Reprendre l'abonnement"}
              </Button>
            ) : isSubActive ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={onScrollToPlans}
                  className="w-full sm:w-auto"
                >
                  <span>Modifier mon abonnement</span>
                  <ArrowRight className="size-3.5 ml-1.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onOpenCancelDialog}
                  className="text-xs text-muted-foreground hover:text-destructive w-full sm:w-auto"
                >
                  Résilier l'abonnement
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={onScrollToPlans}
                className="w-full sm:w-auto"
              >
                <span>Choisir un abonnement</span>
                <ArrowRight className="size-3.5 ml-1.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
