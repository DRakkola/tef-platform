import React from "react";
import { LifeBuoy, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { telemetry } from "@/features/analytics/telemetry";

export const BillingSupportBlock: React.FC = () => {
  const handleContactSupport = () => {
    telemetry.track("support_from_billing_clicked");
    window.location.href = "mailto:support@tef-prep.ca?subject=Assistance%20Facturation%20TEF";
  };

  return (
    <Card className="border border-border/80 shadow-xs bg-muted/30">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-background border border-border/80 text-primary shrink-0">
              <LifeBuoy className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Besoin d'aide ?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Notre équipe est disponible pour répondre à vos questions sur vos factures, abonnements ou crédits.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleContactSupport}
            className="shrink-0 w-full sm:w-auto text-xs"
          >
            <span>Contacter le support</span>
            <ArrowRight className="size-3.5 ml-1.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
