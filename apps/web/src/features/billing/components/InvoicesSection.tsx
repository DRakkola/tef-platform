import React from "react";
import { FileText, Download } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatBillingDate } from "./CurrentPlanHero";
import { formatPriceCents } from "./PlanCatalogSection";
import type { Invoice } from "../types";

interface InvoicesSectionProps {
  invoices: Invoice[];
}

export const InvoicesSection: React.FC<InvoicesSectionProps> = ({ invoices }) => {
  return (
    <Card className="border border-border/80 shadow-xs bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <FileText className="size-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">
              Factures & Justificatifs
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Téléchargez vos reçus et factures conformes pour vos démarches administratives.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border">
            Aucun justificatif disponible pour l'instant.
          </div>
        ) : (
          <div className="divide-y divide-border/60 border border-border/60 rounded-lg overflow-hidden">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 sm:px-4 flex items-center justify-between gap-3 text-xs bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                    <FileText className="size-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      Facture #{inv.invoice_number || inv.id.slice(0, 8)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatBillingDate(inv.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-bold text-foreground">
                    {formatPriceCents(inv.amount_cents, inv.currency)}
                  </span>
                  {inv.pdf_url ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-8 text-xs"
                    >
                      <a href={inv.pdf_url} target="_blank" rel="noreferrer">
                        <Download className="size-3 mr-1" />
                        PDF
                      </a>
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground italic">
                      Reçu enregistré
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
