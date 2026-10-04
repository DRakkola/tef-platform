import React from "react";
import { GitBranch, ShieldCheck, Cpu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionItem, QuestionProvenance } from "../types";

interface ProvenanceTabProps {
  question: Partial<QuestionItem>;
  onChange: (patch: Partial<QuestionItem>) => void;
  disabled?: boolean;
}

export const ProvenanceTab: React.FC<ProvenanceTabProps> = ({
  question,
  onChange,
  disabled = false,
}) => {
  const prov: QuestionProvenance = question.provenance || {
    author_type: "human",
    human_verified: true,
  };

  const updateProv = (patch: Partial<QuestionProvenance>) => {
    onChange({
      provenance: {
        ...prov,
        ...patch,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-border bg-card space-y-4">
        <div className="flex items-center gap-2 text-foreground font-semibold text-xs border-b border-border pb-2">
          <GitBranch className="h-4 w-4 text-primary" />
          Origine, Traçabilité & Droits de propriété
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold">Origine de conception *</Label>
            <select
              value={prov.author_type}
              onChange={(e) => updateProv({ author_type: e.target.value as any })}
              disabled={disabled}
              className="w-full mt-1 rounded-md border border-border bg-background p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
            >
              <option value="human">Auteur humain (Concepteur pédagogique / Enseignant)</option>
              <option value="ai">Génération assistée par IA (TEF AI Studio)</option>
              <option value="imported">Importation externe / Annales partenaires</option>
            </select>
          </div>

          <div>
            <Label className="text-xs font-semibold">Référence source / Attribution</Label>
            <Input
              value={prov.source_reference || ""}
              onChange={(e) => updateProv({ source_reference: e.target.value })}
              placeholder="ex. Annales TEF Canada 2024 - Dossier #12"
              disabled={disabled}
              className="h-8 text-xs mt-1"
            />
          </div>
        </div>

        {/* AI Specific Details */}
        {prov.author_type === "ai" && (
          <div className="p-3.5 rounded-lg border border-purple-500/20 bg-purple-500/5 space-y-3">
            <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold text-xs">
              <Cpu className="h-4 w-4" /> Métadonnées de génération IA
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-2xs font-medium">Modèle de fondation</Label>
                <Input
                  value={prov.generation_model || ""}
                  onChange={(e) => updateProv({ generation_model: e.target.value })}
                  placeholder="ex. gemini-1.5-pro / gpt-4o"
                  disabled={disabled}
                  className="h-7 text-xs mt-0.5"
                />
              </div>
              <div>
                <Label className="text-2xs font-medium">Version du template de prompt</Label>
                <Input
                  value={prov.prompt_template_version || ""}
                  onChange={(e) => updateProv({ prompt_template_version: e.target.value })}
                  placeholder="ex. v2.1-mcq-distractor-gen"
                  disabled={disabled}
                  className="h-7 text-xs mt-0.5"
                />
              </div>
            </div>
          </div>
        )}

        {/* Human Verification */}
        <div className="p-3.5 rounded-lg border border-border bg-muted/30 space-y-3">
          <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Validation humaine & Relecture didactique
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="human-verified-chk"
              checked={prov.human_verified}
              onChange={(e) => updateProv({ human_verified: e.target.checked })}
              disabled={disabled}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <label
              htmlFor="human-verified-chk"
              className="text-xs text-foreground font-medium cursor-pointer"
            >
              Item vérifié et validé par un réviseur didactique humain qualifié
            </label>
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label className="text-xs font-semibold">Notes internes de révision éditoriale</Label>
          <Textarea
            rows={3}
            value={prov.notes || ""}
            onChange={(e) => updateProv({ notes: e.target.value })}
            placeholder="Remarques confidentielles pour l'équipe pédagogique (ex. surveiller le taux de réussite de l'option C lors des premiers passages)..."
            disabled={disabled}
            className="text-xs mt-1"
          />
        </div>
      </div>
    </div>
  );
};
