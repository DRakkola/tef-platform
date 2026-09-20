/**
 * Maintenance Page / State.
 * Used when the platform is temporarily unavailable or undergoing scheduled upgrades.
 */

import React from "react";
import { Link } from "react-router-dom";
import { Wrench, RefreshCw, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const MaintenancePage: React.FC = () => {
  return (
    <div
      role="alert"
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background text-foreground"
    >
      <div className="w-16 h-16 mb-4 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
        <Wrench className="w-8 h-8" aria-hidden="true" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight mb-2">Plateforme en maintenance</h1>
      <p className="text-muted-foreground max-w-md mb-6 leading-relaxed">
        Nous effectuons actuellement une mise à niveau technique planifiée de la plateforme TEF.
        Tous les services seront rétablis dans quelques instants.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => window.location.reload()}
          variant="default"
          className="gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser la page
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/help">
            <HelpCircle className="w-4 h-4" />
            Consulter l'aide
          </Link>
        </Button>
      </div>
    </div>
  );
};
