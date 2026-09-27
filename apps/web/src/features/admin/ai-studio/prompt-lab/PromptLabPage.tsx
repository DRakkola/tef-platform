import React, { useState } from "react";
import {
  Terminal,
  Play,
  RotateCcw,
  Sliders,
  BookmarkPlus,
  Clock,
  Layers,
  Coins,
  CheckCircle2,
  AlertCircle,
  Code,
} from "lucide-react";
import { AIStudioLayout } from "../layout/AIStudioLayout";
import { useAIStudio, AIStudioProvider } from "../context/AIStudioContext";
import { ModelSelector } from "../shared/ModelSelector";
import type { AIPromptTemplate, AISandboxRun } from "../types";
import { Button } from "@/components/ui/button";

const PromptLabPageContent: React.FC = () => {
  const { templates, isSimulation, apiKeyOverride, getAuthHeaders } = useAIStudio();

  // Prompt Lab state
  const [systemPrompt, setSystemPrompt] = useState<string>(
    "Tu es un évaluateur linguistique TEF certifié expert auprès de la Chambre de Commerce et d'Industrie."
  );
  const [userPrompt, setUserPrompt] = useState<string>(
    "Donne 3 conseils clés et précis pour réussir la Section B (Expression Orale) du TEF."
  );
  const [model, setModel] = useState<string>("models/gemini-3.5-flash");
  const [temperature, setTemperature] = useState<number>(0.7);

  // Execution state
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [run, setRun] = useState<AISandboxRun | null>(null);

  const handleSelectTemplate = (t: AIPromptTemplate) => {
    setSystemPrompt(t.system_prompt);
    if (t.user_prompt_template) {
      setUserPrompt(t.user_prompt_template);
    }
    setModel(t.default_model);
    setTemperature(t.default_temperature);
    setSuccessMsg(`Modèle « ${t.name} » chargé dans le prompt editor.`);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleRunRawPrompt = async () => {
    if (!userPrompt.trim()) {
      setErrorMsg("Veuillez renseigner un User Prompt à exécuter.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/admin/ai-sandbox/run/raw", {
        method: "POST",
        headers: getAuthHeaders(true),
        credentials: "include",
        body: JSON.stringify({
          system_prompt: systemPrompt,
          user_prompt: userPrompt,
          model,
          temperature,
          force_simulation: isSimulation,
          api_key_override: apiKeyOverride || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Échec de l'exécution du prompt brut.");
      }

      const data = await res.json();
      setOutput(data.output.output_text);
      setRun(data.run);
      setSuccessMsg("Inférence terminée !");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'exécution.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AIStudioLayout
      title="Prompt Lab — Laboratoire & Inférence Brute"
      description="Espace d'ingénierie prompt-to-prompt pour prototyper, calibrer les hyperparamètres et inspecter les réponses brutes des modèles."
    >
      {errorMsg && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="font-bold text-sm px-2">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold text-sm px-2">✕</button>
        </div>
      )}

      {/* 3-Column Dense IDE-like Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Column 1: Presets & Templates Drawer (3 cols) */}
        <div className="lg:col-span-3 bg-card p-4 rounded-2xl border border-border shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <BookmarkPlus className="size-3.5 text-primary" />
              Templates & Presets
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">{templates.length}</span>
          </div>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {templates.length === 0 ? (
              <div className="text-xs text-muted-foreground p-3 text-center">Aucun template</div>
            ) : (
              templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-muted transition-colors text-xs space-y-1 border border-transparent hover:border-border"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground truncate max-w-[140px] block">
                      {tpl.name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full uppercase font-mono bg-muted text-muted-foreground">
                      {tpl.feature_type}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    {tpl.description || tpl.system_prompt}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Prompt Editors (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-2">
                <Code className="size-4 text-primary" />
                Éditeur de Prompts
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSystemPrompt("");
                  setUserPrompt("");
                  setOutput(null);
                }}
                className="text-xs text-muted-foreground h-7"
              >
                <RotateCcw className="size-3 mr-1" />
                Effacer
              </Button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">System Instruction</label>
              <textarea
                rows={4}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full text-xs font-mono bg-background border border-border rounded-xl p-3 text-foreground leading-relaxed focus:ring-1 focus:ring-primary"
                placeholder="Rôle ou consignes d'encadrement pour le modèle..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">User Prompt</label>
              <textarea
                rows={7}
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                className="w-full text-xs font-mono bg-background border border-border rounded-xl p-3 text-foreground leading-relaxed focus:ring-1 focus:ring-primary"
                placeholder="Requête utilisateur ou texte d'évaluation..."
              />
            </div>

            <Button
              onClick={handleRunRawPrompt}
              disabled={loading || !userPrompt.trim()}
              data-testid="run-raw-prompt-btn"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs py-2.5 rounded-xl shadow-xs"
            >
              {loading ? (
                <>
                  <span className="animate-spin mr-2">⚙️</span>
                  Inférence du modèle en cours...
                </>
              ) : (
                <>
                  <Play className="size-4 mr-2" />
                  Exécuter l'Inférence (Run)
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Column 3: Configuration & Hyperparameters (3 cols) */}
        <div className="lg:col-span-3 bg-card p-5 rounded-2xl border border-border shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2.5">
            <Sliders className="size-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Paramètres Moteur</span>
          </div>

          <ModelSelector value={model} onChange={setModel} allowedTypes="all" />

          <div className="space-y-1.5">
            <div className="flex justify-between font-mono text-xs">
              <span className="font-semibold text-foreground">Température</span>
              <span className="font-bold text-primary">{temperature}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.5"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>0.0 Précis</span>
              <span>1.5 Créatif</span>
            </div>
          </div>

          <div className="p-3 bg-muted/30 border border-border rounded-xl text-xs space-y-1">
            <span className="font-bold text-foreground block text-[11px]">Usage recommandé</span>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Pour des corrections d'épreuves (Writing/Speaking), maintenez une température basse (0.2–0.4)
              afin de garantir des notations déterministes.
            </p>
          </div>
        </div>
      </div>

      {/* Output & Telemetry Viewer */}
      <div className="bg-zinc-950 dark:bg-black text-zinc-100 rounded-2xl border border-border shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-semibold text-zinc-300">
            <Terminal className="size-4 text-emerald-400" />
            <span>Sortie d'Inférence Brute</span>
          </div>

          {run && (
            <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
              <span className="flex items-center gap-1">
                <Clock className="size-3" /> {run.latency_ms} ms
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Layers className="size-3" /> {run.total_tokens} jetons
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <Coins className="size-3" /> ${run.estimated_cost_usd.toFixed(5)}
              </span>
            </div>
          )}
        </div>

        <div className="p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap min-h-[180px] max-h-[450px] overflow-y-auto text-emerald-300 selection:bg-emerald-800 selection:text-white">
          {output ? (
            output
          ) : (
            <span className="text-zinc-600 italic">
              En attente d'exécution... Configurez les prompts ci-dessus et cliquez sur « Exécuter l'Inférence ».
            </span>
          )}
        </div>
      </div>
    </AIStudioLayout>
  );
};

export const PromptLabPage: React.FC = () => (
  <AIStudioProvider>
    <PromptLabPageContent />
  </AIStudioProvider>
);
