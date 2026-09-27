import React from "react";
import { Radio, AlertTriangle, Key } from "lucide-react";
import { useAIStudio } from "../context/AIStudioContext";

interface EnvironmentBadgeProps {
  className?: string;
  showByokOnly?: boolean;
}

export const EnvironmentBadge: React.FC<EnvironmentBadgeProps> = ({ className = "" }) => {
  const { isSimulation, apiKeyOverride } = useAIStudio();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Simulation vs Live Indicator */}
      {isSimulation ? (
        <div
          data-testid="env-badge-simulation"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 shadow-2xs"
          title="Mode Simulation Actif: Réponses déterministes et instantanées, aucun appel API externe."
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <AlertTriangle className="h-3 w-3" />
          <span>SIMULATION DÉTERMINISTE</span>
        </div>
      ) : (
        <div
          data-testid="env-badge-live"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shadow-2xs"
          title="Modèle Live Actif: Appels réels vers l'API Google Gemini."
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Radio className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span>MODÈLE LIVE (GEMINI)</span>
        </div>
      )}

      {/* BYOK Override Indicator */}
      {apiKeyOverride ? (
        <div
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
          title="Clé personnelle active (BYOK) - Session mémoire uniquement"
        >
          <Key className="h-3 w-3" />
          <span>BYOK Actif</span>
        </div>
      ) : (
        <div
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border"
          title="Utilisation de la clé d'infrastructure du serveur"
        >
          <span>Clé Plateforme</span>
        </div>
      )}
    </div>
  );
};
