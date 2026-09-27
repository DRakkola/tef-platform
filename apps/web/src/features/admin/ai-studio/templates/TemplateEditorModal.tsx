import React, { useState, useEffect } from "react";
import { BookmarkPlus, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "../shared/ModelSelector";
import type { AIPromptTemplate } from "../types";

interface TemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateToEdit?: AIPromptTemplate | null;
  onSave: (payload: {
    name: string;
    description: string;
    feature_type: "writing" | "speaking" | "raw";
    system_prompt: string;
    default_model: string;
    default_temperature: number;
  }) => Promise<void>;
}

export const TemplateEditorModal: React.FC<TemplateEditorModalProps> = ({
  isOpen,
  onClose,
  templateToEdit,
  onSave,
}) => {
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [featureType, setFeatureType] = useState<"writing" | "speaking" | "raw">("writing");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [defaultModel, setDefaultModel] = useState<string>("models/gemini-3.5-flash");
  const [defaultTemperature, setDefaultTemperature] = useState<number>(0.3);

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (templateToEdit) {
      setName(templateToEdit.name);
      setDescription(templateToEdit.description || "");
      setFeatureType(templateToEdit.feature_type);
      setSystemPrompt(templateToEdit.system_prompt);
      setDefaultModel(templateToEdit.default_model);
      setDefaultTemperature(templateToEdit.default_temperature);
    } else {
      setName("");
      setDescription("");
      setFeatureType("writing");
      setSystemPrompt("");
      setDefaultModel("models/gemini-3.5-flash");
      setDefaultTemperature(0.3);
    }
  }, [templateToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !systemPrompt.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await onSave({
        name,
        description,
        feature_type: featureType,
        system_prompt: systemPrompt,
        default_model: defaultModel,
        default_temperature: defaultTemperature,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Échec de l'enregistrement du template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-card text-card-foreground rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-border">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <BookmarkPlus className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">
                {templateToEdit ? "Modifier le Modèle de Prompt" : "Créer un Modèle de Prompt"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Modèle réutilisable dans l'atelier écrit, l'examinateur oral ou le Prompt Lab.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground font-bold p-1">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">Nom du modèle</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Correcteur TEF B2 Rigoureux"
                className="w-full text-xs bg-background border border-border rounded-xl p-2.5 text-foreground focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">Usage / Fonctionnalité</label>
              <select
                value={featureType}
                onChange={(e) => setFeatureType(e.target.value as any)}
                className="w-full text-xs bg-background border border-border rounded-xl p-2.5 text-foreground font-medium focus:ring-1 focus:ring-primary"
              >
                <option value="writing">Écrit (Writing Assessment)</option>
                <option value="speaking">Oral (Speaking Examiner)</option>
                <option value="raw">Brut (Prompt Lab)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">Description (Optionnelle)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Critères spécifiques ou hypothèses de test..."
              className="w-full text-xs bg-background border border-border rounded-xl p-2.5 text-foreground focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">System Prompt</label>
            <textarea
              rows={6}
              required
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Instructions directes pour le LLM..."
              className="w-full text-xs font-mono bg-background border border-border rounded-xl p-3 text-foreground leading-relaxed focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
            <ModelSelector value={defaultModel} onChange={setDefaultModel} allowedTypes="all" />

            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="font-semibold text-foreground">Température</span>
                <span className="font-bold text-primary">{defaultTemperature}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.2"
                step="0.05"
                value={defaultTemperature}
                onChange={(e) => setDefaultTemperature(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs rounded-xl">
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={saving || !name.trim() || !systemPrompt.trim()}
              className="text-xs rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {saving ? (
                <>
                  <RefreshCw className="size-3.5 mr-1.5 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 mr-1.5" />
                  Enregistrer le Modèle
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
