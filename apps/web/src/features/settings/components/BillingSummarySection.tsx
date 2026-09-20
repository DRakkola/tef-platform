import React from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Sparkles, Coins, Calendar, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { telemetry } from "@/features/analytics/telemetry";
import type { BillingSummaryData } from "../types";

interface BillingSummarySectionProps {
  billing?: BillingSummaryData;
}

export const BillingSummarySection: React.FC<BillingSummarySectionProps> = ({ billing }) => {
  const navigate = useNavigate();

  const planName =
    billing?.planTier === "pro"
      ? "Candidat Pro"
      : billing?.planTier === "premium"
        ? "Candidat Élite"
        : "Formule Gratuite";

  const isSubscribed = billing?.status === "active";
  const credits = billing?.creditsBalance ?? 0;

  const handleOpenBilling = () => {
    telemetry.track("billing_page_opened", { from: "settings" });
    navigate("/billing");
  };

  return (
    <Card className="border border-border/80 shadow-xs bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <CreditCard className="size-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Facturation</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Aperçu de votre abonnement et de vos crédits d'évaluations et de cours.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Subscription & Credits Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Current Plan */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Formule actuelle
              </span>
              {isSubscribed ? (
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                  Actif
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  Gratuit
                </Badge>
              )}
            </div>

            <div className="text-lg font-bold text-foreground">{planName}</div>

            {billing?.renewalDate && isSubscribed ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                Renouvellement le{" "}
                {new Date(billing.renewalDate).toLocaleDateString("fr-CA", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Accès aux simulations TEF gratuites et exercices de base.
              </p>
            )}
          </div>

          {/* Credits Balance */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Coins className="size-3.5 text-amber-500" />
                Solde de crédits
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {credits} disponibles
              </Badge>
            </div>

            <div className="text-lg font-bold text-foreground">
              {credits} {credits > 1 ? "crédits" : "crédit"}
            </div>

            <p className="text-xs text-muted-foreground">
              Utilisables pour les corrections de rédactions par professeurs et les cours particuliers.
            </p>
          </div>
        </div>

        {/* Informative Notice */}
        <div className="p-4 rounded-xl bg-background border border-border/70 text-xs text-muted-foreground space-y-1">
          <span className="font-semibold text-foreground text-xs block">
            Gestion complète des paiements :
          </span>
          <p>
            Vous pouvez modifier votre formule, consulter vos factures antérieures et recharger votre solde de crédits directement depuis le portail de facturation dédié.
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60 pt-4">
        <span className="text-xs text-muted-foreground">
          Paiements sécurisés via Stripe
        </span>
        <Button
          type="button"
          size="sm"
          onClick={handleOpenBilling}
          className="w-full sm:w-auto"
        >
          <span>Gérer ma facturation</span>
          <ArrowRight className="size-3.5 ml-1.5" />
        </Button>
      </CardFooter>
    </Card>
  );
};
