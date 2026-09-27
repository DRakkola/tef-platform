import React, { useState } from "react";
import { ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SpeakingExaminerConfigItem } from "../types";

interface ProductionConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: string;
  draftConfig: {
    model: string;
    voice_persona: string;
    scepticism_level: number;
    temperature: number;
    top_p: number;
    system_prompt: string;
  };
  activeProdConfig?: SpeakingExaminerConfigItem;
  onDeploy: () => Promise<void>;
}

export const ProductionConfigModal: React.FC<ProductionConfigModalProps> = ({
  isOpen,
  onClose,
  section,
  draftConfig,
  activeProdConfig,
  onDeploy,
}) => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsDeploying(true);
    setErrorMsg(null);
    try {
      await onDeploy();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Échec du déploiement en production.");
    } finally {
      setIsDeploying(false);
    }
  };

  const isModelDiff = activeProdConfig && activeProdConfig.model !== draftConfig.model;
  const isVoiceDiff = activeProdConfig && activeProdConfig.voice_persona !== draftConfig.voice_persona;
  const isScepticismDiff =
    activeProdConfig &&
    Math.round(activeProdConfig.scepticism_level * 100) !== Math.round(draftConfig.scepticism_level * 100);
  const isPromptDiff = activeProdConfig && activeProdConfig.system_prompt.trim() !== draftConfig.system_prompt.trim();

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-card text-card-foreground rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-border">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">
                Déploiement en Production — {section === "section_a" ? "Section A" : "Section B"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Promotion des paramètres testés dans le studio vers les examens officiels.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground font-bold p-1 text-sm"
          >
            ✕
          </button>
        </div>

        {/* Warning Alert */}
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5 leading-relaxed">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div>
            <strong>Attention :</strong> Cette mise à jour s'appliquera immédiatement à tous les candidats
            passant la {section.toUpperCase()}. L'opération sera consignée dans le journal d'audit administratif.
            <div className="mt-1 text-[11px] opacity-90">
              Note : Le rollback automatisé n'est pas supporté par le backend. Pour revenir en arrière, il sera nécessaire de ré-appliquer manuellement l'ancienne configuration.
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs">
            {errorMsg}
          </div>
        )}

        {/* Side-by-Side Configuration Diff */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-foreground">
            Comparatif Différentiel (Production Actuelle ➜ Nouveau Draft) :
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Current Production */}
            <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Production Actuelle
              </span>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div>Modèle : {activeProdConfig?.model?.replace("models/", "") || "Défaut"}</div>
                <div>Voix : {activeProdConfig?.voice_persona || "Aoede"}</div>
                <div>
                  Scepticisme :{" "}
                  {activeProdConfig ? Math.round(activeProdConfig.scepticism_level * 100) : 50}%
                </div>
                <div>T° : {activeProdConfig?.temperature ?? 0.7}</div>
                <div>Top-P : {activeProdConfig?.top_p ?? 0.95}</div>
              </div>
            </div>

            {/* Target Draft */}
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                Nouveau Draft (Studio)
              </span>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className={isModelDiff ? "font-bold text-primary" : ""}>
                  Modèle : {draftConfig.model.replace("models/", "")} {isModelDiff && "★"}
                </div>
                <div className={isVoiceDiff ? "font-bold text-primary" : ""}>
                  Voix : {draftConfig.voice_persona} {isVoiceDiff && "★"}
                </div>
                <div className={isScepticismDiff ? "font-bold text-primary" : ""}>
                  Scepticisme : {Math.round(draftConfig.scepticism_level * 100)}% {isScepticismDiff && "★"}
                </div>
                <div>T° : {draftConfig.temperature}</div>
                <div>Top-P : {draftConfig.top_p}</div>
              </div>
            </div>
          </div>

          {/* System Prompt Diff Preview */}
          <div className="p-3 bg-muted/30 rounded-xl border border-border text-xs space-y-1">
            <span className="font-semibold text-foreground text-[11px] block">
              Consigne Système Déployée {isPromptDiff && <span className="text-primary font-bold">★ (Modifiée)</span>} :
            </span>
            <p className="font-mono text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
              {draftConfig.system_prompt}
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeploying}
            className="text-xs rounded-xl"
          >
            Annuler
          </Button>

          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isDeploying}
            data-testid="confirm-deploy-prod-btn"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs"
          >
            {isDeploying ? (
              <>
                <RefreshCw className="size-3.5 mr-1.5 animate-spin" />
                Déploiement en cours...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5 mr-1.5" />
                Confirmer et Appliquer en Production
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
