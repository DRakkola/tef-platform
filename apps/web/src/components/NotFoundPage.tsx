/**
 * 404 Not Found Page.
 * Displays a clean, localized page when a route does not exist.
 */

import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileQuestion, Home, HelpCircle } from "lucide-react";

export const NotFoundPage: React.FC = () => {
  return (
    <div
      role="alert"
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background text-foreground"
    >
      <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        <FileQuestion className="w-8 h-8" aria-hidden="true" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">404</h1>
      <h2 className="text-xl font-semibold mb-2">Page introuvable</h2>
      <p className="text-muted-foreground max-w-sm mb-6 leading-relaxed">
        La page que vous recherchez n'existe pas, a été supprimée ou a été déplacée vers une nouvelle adresse.
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
