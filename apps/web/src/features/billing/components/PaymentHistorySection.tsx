import React from "react";
import { ShoppingBag, CheckCircle2, AlertCircle, Clock, RotateCcw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBillingDate } from "./CurrentPlanHero";
import { formatPriceCents } from "./PlanCatalogSection";
import type { Order } from "../types";

interface PaymentHistorySectionProps {
  orders: Order[];
}

export const PaymentHistorySection: React.FC<PaymentHistorySectionProps> = ({ orders }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
            <CheckCircle2 className="size-3 mr-1" />
            Payé
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
            <Clock className="size-3 mr-1" />
            En attente
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 bg-destructive/10">
            <AlertCircle className="size-3 mr-1" />
            Échec
          </Badge>
        );
      case "refunded":
      case "partially_refunded":
        return (
          <Badge variant="outline" className="text-[10px] text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10">
            <RotateCcw className="size-3 mr-1" />
            Remboursé
          </Badge>
        );
      case "canceled":
      case "cancelled":
        return (
          <Badge variant="secondary" className="text-[10px]">
            Annulé
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[10px]">
            {status}
          </Badge>
        );
    }
  };

  return (
    <Card className="border border-border/80 shadow-xs bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <ShoppingBag className="size-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">
              Historique des paiements
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Relevé de vos commandes, abonnements et recharges de crédits.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {orders.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border">
            Aucun paiement enregistré.
          </div>
        ) : (
          <>
            {/* Desktop Table (≥ 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Montant</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-right">Référence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {orders.map((order) => {
                    const description =
                      order.items?.map((it) => it.product_name).filter(Boolean).join(", ") ||
                      "Abonnement / Crédits TEF";

                    return (
                      <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                          {formatBillingDate(order.created_at)}
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          {description}
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground whitespace-nowrap">
                          {formatPriceCents(order.total_cents, order.currency)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {getStatusBadge(order.status)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[11px] text-muted-foreground">
                          {order.order_number}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (< 768px) */}
            <div className="md:hidden space-y-3">
              {orders.map((order) => {
                const description =
                  order.items?.map((it) => it.product_name).filter(Boolean).join(", ") ||
                  "Abonnement / Crédits TEF";

                return (
                  <div
                    key={order.id}
                    className="p-3.5 rounded-lg border border-border/70 bg-card space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">{description}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/60">
                      <span>{formatBillingDate(order.created_at)}</span>
                      <span className="font-bold text-foreground text-sm">
                        {formatPriceCents(order.total_cents, order.currency)}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground text-right">
                      Réf. {order.order_number}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
