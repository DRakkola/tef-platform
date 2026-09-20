import React from "react";
import { Coins, Plus, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatBillingDate } from "./CurrentPlanHero";
import type { CreditBalance, CreditUsageOverview, Product } from "../types";

interface CreditBalanceSectionProps {
  credits?: CreditBalance;
  usage?: CreditUsageOverview;
  creditPackProducts?: Product[];
  onBuyCredits: (priceId: string) => void;
}

export const CreditBalanceSection: React.FC<CreditBalanceSectionProps> = ({
  credits,
  usage,
  creditPackProducts = [],
  onBuyCredits,
}) => {
  const available = credits?.available_balance ?? credits?.balance ?? 0;
  const expiringSoon = credits?.expiring_soon ?? 0;
  const nextExpDate = credits?.next_expiration_date;

  const consumptions = usage?.consumptions || [];
  const grants = usage?.grants || [];

  // Combine and sort recent credit activity
  const recentActivities = [
    ...grants.map((g) => ({
      id: g.id,
      date: g.created_at,
      type: "grant" as const,
      description: g.source ? `Recharge (${g.source})` : g.reason ? `Crédits accordés (${g.reason})` : "Crédits accordés",
      amount: g.amount ?? g.remaining_credits ?? g.initial_credits ?? 0,
    })),
    ...consumptions.map((c) => {
      const feat = c.feature || c.feature_key;
      const amt = c.amount ?? c.credits_consumed ?? 0;
      return {
        id: c.id,
        date: c.created_at,
        type: "consumption" as const,
        description: feat ? `Utilisation (${feat.replace(/_/g, " ")})` : "Consommation de crédit",
        amount: -amt,
      };
    }),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <Card className="border border-border/80 shadow-xs bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Coins className="size-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Mes crédits</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Solde de crédits utilisables pour les corrections de copies et les cours avec tuteurs certifiés.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Balance Stat Card */}
        <div className="p-4 sm:p-6 rounded-xl bg-muted/40 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Crédits disponibles
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold text-foreground">
                {available}
              </span>
              <span className="text-sm text-muted-foreground">
                {available > 1 ? "crédits actifs" : "crédit actif"}
              </span>
            </div>
            {expiringSoon > 0 && nextExpDate && (
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium pt-1">
                {expiringSoon} crédit(s) expirent le {formatBillingDate(nextExpDate)}.
              </p>
            )}
          </div>

          {/* Available Credit Packs for Direct Top-up */}
          {creditPackProducts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {creditPackProducts.map((pack) => {
                const price = pack.prices[0];
                if (!price) return null;
                return (
                  <Button
                    key={pack.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onBuyCredits(price.id)}
                    className="text-xs"
                  >
                    <Plus className="size-3.5 mr-1" />
                    {pack.name} ({price.amount_cents / 100} {price.currency.toUpperCase()})
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Credit Ledger */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Activité récente des crédits
          </h3>

          {recentActivities.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border">
              Aucune transaction de crédit enregistrée.
            </div>
          ) : (
            <div className="divide-y divide-border/60 border border-border/60 rounded-lg overflow-hidden">
              {recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="p-3 sm:px-4 flex items-center justify-between text-xs bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-1.5 rounded-md ${
                        act.type === "grant"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {act.type === "grant" ? (
                        <ArrowDownLeft className="size-3.5" />
                      ) : (
                        <ArrowUpRight className="size-3.5" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{act.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatBillingDate(act.date)}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`font-semibold ${
                      act.type === "grant"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-foreground"
                    }`}
                  >
                    {act.amount > 0 ? `+${act.amount}` : act.amount} {Math.abs(act.amount) > 1 ? "crédits" : "crédit"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
