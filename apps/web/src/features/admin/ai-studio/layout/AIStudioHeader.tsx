import React from "react";
import { Link } from "react-router-dom";
import { Sliders } from "lucide-react";
import { EnvironmentBadge } from "../shared/EnvironmentBadge";

interface AIStudioHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export const AIStudioHeader: React.FC<AIStudioHeaderProps> = ({
  title,
  description,
  actions,
}) => {
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-xs px-6 py-4 sticky top-0 z-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
            <EnvironmentBadge />
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {actions}
          <Link
            to="/admin/ai-studio/administration"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs"
            title="Gérer les clés d'API et le mode d'environnement"
          >
            <Sliders className="size-3.5 text-primary" />
            <span>Paramètres Studio</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
