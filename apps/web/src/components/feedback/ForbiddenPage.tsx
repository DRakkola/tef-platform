/**
 * 403 Forbidden Page.
 * Displays a clean, localized access restriction page.
 */

import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Home, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ForbiddenPage: React.FC = () => {
  return (
    <div
      role="alert"
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background text-foreground"
    >
      <div className="w-16 h-16 mb-4 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
        <ShieldAlert className="w-8 h-8" aria-hidden="true" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">403</h1>
      <h2 className="text-xl font-semibold mb-2">Accès restreint</h2>
      <p className="text-muted-foreground max-w-sm mb-6 leading-relaxed">
        Vous n'avez pas les autorisations requises pour accéder à cette page ou à cette ressource.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="default" className="gap-2">
          <Link to="/dashboard">
            <Home className="w-4 h-4" />
            Retour au tableau de bord
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/help">
            <HelpCircle className="w-4 h-4" />
            Centre d'aide
          </Link>
        </Button>
      </div>
    </div>
  );
};
