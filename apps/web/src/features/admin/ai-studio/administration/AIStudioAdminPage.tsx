import React, { useState } from "react";
import {
  Key,
  Radio,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import { AIStudioLayout } from "../layout/AIStudioLayout";
import { useAIStudio, AIStudioProvider } from "../context/AIStudioContext";
import { Button } from "@/components/ui/button";

const AIStudioAdminPageContent: React.FC = () => {
  const {
    isSimulation,
    setIsSimulation,
    apiKeyOverride,
    setApiKeyOverride,
  } = useAIStudio();

  const [inputKey, setInputKey] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleApplyKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;
    setApiKeyOverride(inputKey.trim());
    setInputKey("");
    setSuccessMsg("Clé d'API temporaire appliquée pour cette session de navigation.");
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleClearKey = () => {
    setApiKeyOverride("");
    setInputKey("");
    setSuccessMsg("Clé temporaire effacée. Le studio utilise à nouveau la clé plateforme.");
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  return (
    <AIStudioLayout
      title="Administration & Clés — Gouvernance IA"
      description="Gestion des environnements de test, injection de clés temporaires (BYOK) et audit des configurations déployées."
    >
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold text-sm px-2">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Environment & Simulation Control */}
        <div className="lg:col-span-6 bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <Radio className="size-5 text-primary" />
            <div>
              <h3 className="font-bold text-sm text-foreground">Environnement & Mode d'Exécution</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bascule entre les modèles Google Gemini en direct et la simulation hors-ligne.
              </p>
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border space-y-3 transition-colors ${
              isSimulation
                ? "bg-amber-500/10 border-amber-500/25 text-amber-900 dark:text-amber-200"
                : "bg-emerald-500/10 border-emerald-500/25 text-emerald-900 dark:text-emerald-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isSimulation ? "bg-amber-400" : "bg-emerald-400"
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      isSimulation ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  />
                </span>
                <span className="font-bold text-xs uppercase tracking-wider">
                  {isSimulation ? "Mode Simulation Déterministe Actif" : "Modèle Live Connecté"}
                </span>
              </div>

              <Button
                size="sm"
                variant={isSimulation ? "default" : "outline"}
                onClick={() => setIsSimulation(!isSimulation)}
                data-testid="toggle-simulation-btn"
                className="text-xs font-semibold rounded-xl"
              >
                {isSimulation ? "Désactiver la Simulation" : "Activer la Simulation"}
              </Button>
            </div>

            <p className="text-xs leading-relaxed opacity-90">
              {isSimulation
                ? "Toutes les requêtes de correction et de dialogue oral utilisent des mocks pré-enregistrés rapides sans coût d'API. Recommandé pour tester les interfaces sans quota."
                : "Les requêtes sollicitent directement les API de production Google Gemini (Flash, Pro et Live). Les coûts réels en tokens et latence s'appliquent."}
            </p>
          </div>

          <div className="p-3.5 bg-muted/30 border border-border rounded-xl text-xs space-y-1">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Info className="size-3.5 text-primary" />
              Visibilité Permanente
            </span>
            <p className="text-muted-foreground leading-relaxed">
              L'indicateur d'environnement situé dans l'en-tête du studio affiche en continu le statut
              (Live ou Simulé) pour garantir qu'aucune décision de calibration ne soit prise par erreur sur des données simulées.
            </p>
          </div>
        </div>

        {/* BYOK (Bring Your Own Key) Configuration */}
        <div className="lg:col-span-6 bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <Key className="size-5 text-primary" />
            <div>
              <h3 className="font-bold text-sm text-foreground">Clé d'API Personnelle (BYOK)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Utilisez votre propre clé Google AI Studio pour préserver les quotas de l'organisation.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Statut de la clé active :</span>
              {apiKeyOverride ? (
                <span className="font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                  Clé personnelle active (BYOK)
                </span>
              ) : (
                <span className="font-semibold text-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                  Clé infrastructure serveur (Défaut)
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Pour des raisons de sécurité, les clés BYOK sont conservées <strong>uniquement en mémoire volatile</strong> pour la durée de votre session de navigateur. Elles ne sont jamais écrites dans la base de données PostgreSQL.
            </p>
          </div>

          {apiKeyOverride ? (
            <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-foreground font-semibold">
                  Clé configurée : AIzaSy••••••••••••••••••••
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearKey}
                  className="text-xs rounded-xl"
                >
                  Révoquer la clé
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleApplyKey} className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Nouvelle Clé Google Gemini
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full text-xs font-mono bg-background border border-border rounded-xl p-2.5 pr-10 text-foreground focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={!inputKey.trim()}
                className="w-full text-xs rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                Appliquer la clé pour cette session
              </Button>
            </form>
          )}
        </div>
      </div>
    </AIStudioLayout>
  );
};

export const AIStudioAdminPage: React.FC = () => (
  <AIStudioProvider>
    <AIStudioAdminPageContent />
  </AIStudioProvider>
);
