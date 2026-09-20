import React, { useState } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Product, ProductPrice, Subscription } from "../types";

interface PlanCatalogSectionProps {
  products: Product[];
  currentSubscription?: Subscription;
  onSelectPrice: (priceId: string) => void;
}

export function formatPriceCents(cents: number, currency = "CAD"): string {
  try {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} $`;
  }
}

export const PlanCatalogSection: React.FC<PlanCatalogSectionProps> = ({
  products,
  currentSubscription,
  onSelectPrice,
}) => {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");

  const subscriptionProducts = products.filter((p) => p.product_type === "subscription");

  const getPriceForInterval = (product: Product): ProductPrice | undefined => {
    return (
      product.prices.find((pr) => pr.billing_interval === billingInterval) ||
      product.prices[0]
    );
  };

  const isCurrentPlan = (product: Product): boolean => {
    if (!currentSubscription || currentSubscription.status !== "active") return false;
    return (
      currentSubscription.plan_tier?.toLowerCase() === product.sku?.toLowerCase() ||
      currentSubscription.plan_tier?.toLowerCase() === product.name?.toLowerCase()
    );
  };

  return (
    <div id="plans-catalog-section" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Choisir une offre
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Abonnements adaptés à votre calendrier et vos objectifs de préparation.
          </p>
        </div>

        {/* Billing Interval Toggle */}
        <div className="inline-flex items-center p-1 rounded-lg bg-muted border border-border/80 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setBillingInterval("monthly")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              billingInterval === "monthly"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Facturation mensuelle
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval("annual")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              billingInterval === "annual"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Facturation annuelle
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {subscriptionProducts.map((product) => {
          const price = getPriceForInterval(product);
          const isCurrent = isCurrentPlan(product);

          return (
            <Card
              key={product.id}
              className={`flex flex-col justify-between border shadow-xs transition-shadow ${
                isCurrent
                  ? "border-primary/40 bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/20"
                  : "border-border/80 bg-card hover:shadow-md"
              }`}
            >
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-base text-foreground">
                    {product.name}
                  </span>
                  {isCurrent && (
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/10">
                      Actuel
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs text-muted-foreground min-h-[32px]">
                  {product.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Price Display */}
                <div>
                  {price ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-foreground">
                        {formatPriceCents(price.amount_cents, price.currency)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        / {billingInterval === "monthly" ? "mois" : "an"}
                      </span>
                    </div>
                  ) : (
                    <div className="text-lg font-bold text-foreground">Tarif sur demande</div>
                  )}
                </div>

                {/* Features List */}
                <div className="space-y-2.5 text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider text-foreground text-[11px] block">
                    Inclus dans cette formule :
                  </span>
                  {product.entitlements && product.entitlements.length > 0 ? (
                    product.entitlements.map((ent) => (
                      <div key={ent.id} className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="text-foreground">
                          {ent.feature_key.replace(/_/g, " ")}
                        </span>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                        <span>Simulations complètes TEF illimitées</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                        <span>Practice Pool oral illimité</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                        <span>Corrections IA d'épreuves de rédaction</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>

              <CardFooter className="pt-2 border-t border-border/60">
                {isCurrent ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled
                    className="w-full cursor-default opacity-80"
                  >
                    Votre abonnement actuel
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => price && onSelectPrice(price.id)}
                    disabled={!price}
                    className="w-full"
                  >
                    <span>Choisir cette formule</span>
                    <ArrowRight className="size-3.5 ml-1.5" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
