import React, { useState } from "react";
import {
  Headphones,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Volume2,
} from "lucide-react";
import { AIStudioLayout } from "../layout/AIStudioLayout";
import { useAIStudio, AIStudioProvider } from "../context/AIStudioContext";
import { TelemetryCollapsible } from "../shared/TelemetryCollapsible";
import { ModelSelector } from "../shared/ModelSelector";
import type { SpeakingEvaluationResult, AISandboxRun } from "../types";
import { Button } from "@/components/ui/button";

const AssessmentSpeakingPageContent: React.FC = () => {
  const { benchmarks, isSimulation, apiKeyOverride, getAuthHeaders } = useAIStudio();

  const [section, setSection] = useState<string>("section_a");
  const [topic, setTopic] = useState<string>("Atelier de cuisine du monde");
  const [transcript, setTranscript] = useState<string>(
    `EXAMINATEUR: Bonjour, bienvenue ! Je vous écoute pour vos questions concernant l'annonce de notre atelier de cuisine.
CANDIDAT: Bonjour monsieur. Tout d'abord, pourriez-vous me préciser les jours et horaires auxquels se déroulent ces ateliers ?
EXAMINATEUR: Bien sûr. Nous proposons des sessions le samedi matin de 10h à 12h30 et le mercredi soir de 18h30 à 21h.
CANDIDAT: D'accord, très bien. Et est-ce que les ingrédients ainsi que les tabliers sont fournis par l'école ou devons-nous apporter notre propre matériel ?
EXAMINATEUR: Tout est intégralement fourni sur place, des ingrédients frais jusqu'aux ustensiles professionnels.
CANDIDAT: Parfait. Enfin, proposez-vous un tarif préférentiel pour les étudiants ou en cas d'inscription à un cycle de plusieurs séances ?
EXAMINATEUR: Tout à fait, nous accordons 15% de réduction pour les étudiants et un forfait de 5 séances à tarif réduit.`
  );
  const [model, setModel] = useState<string>("models/gemini-3.5-flash");

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [result, setResult] = useState<SpeakingEvaluationResult | null>(null);
  const [run, setRun] = useState<AISandboxRun | null>(null);

  const speakingBenchmarks = benchmarks.filter((b) => b.feature_type === "speaking");

  const handleLoadBenchmark = (b: any) => {
    setSection(b.section);
    setTopic(b.task_prompt);
    setTranscript(
      b.sample_content.includes("EXAMINATEUR:")
        ? b.sample_content
        : `EXAMINATEUR: Bonjour, je vous écoute.\nCANDIDAT: ${b.sample_content}\nEXAMINATEUR: Oui, tout à fait.`
    );
    setResult(null);
    setRun(null);
    setSuccessMsg(`Étalon oral « ${b.title} » chargé.`);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleEvaluateSpeaking = async () => {
    if (!transcript.trim()) {
      setErrorMsg("Veuillez renseigner la transcription de l'échange oral.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/admin/ai-sandbox/run/speaking/evaluate", {
        method: "POST",
        headers: getAuthHeaders(true),
        credentials: "include",
        body: JSON.stringify({
          section,
          topic,
          transcription: transcript,
          model,
          force_simulation: isSimulation,
          api_key_override: apiKeyOverride || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Échec de l'évaluation de l'échange oral.");
      }

      const data = await res.json();
      setResult(data.result);
      setRun(data.run);
      setSuccessMsg("Évaluation de l'épreuve orale calculée avec succès !");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'évaluation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AIStudioLayout
      title="Évaluation Orale — Grille & Barème TEF"
      description="Validation pédagogique des transcriptions orales (Section A Renseignements et Section B Argumentation) sur les 4 critères officiels CCI."
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

      {/* Top Benchmark Selector */}
      {speakingBenchmarks.length > 0 && (
        <div className="bg-card p-4 rounded-2xl border border-border shadow-2xs flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Étalons oraux préchargés :</span>
          <div className="flex gap-2">
            {speakingBenchmarks.map((b) => (
              <Button
                key={b.id}
                variant="outline"
                size="sm"
                onClick={() => handleLoadBenchmark(b)}
                className="text-xs rounded-xl"
              >
                {b.title}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Input transcript */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Headphones className="size-4 text-primary" />
              Scénario d'Épreuve & Transcription
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">Section Orale</label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-xl p-2.5 text-foreground font-medium focus:ring-1 focus:ring-primary"
                >
                  <option value="section_a">Section A — Prise d'informations (Vouvoiement)</option>
                  <option value="section_b">Section B — Convaincre un ami (Tutoiement)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">Sujet / Contexte</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-xl p-2.5 text-foreground font-medium focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Transcription de l'Échange (Candidat & Examinateur)
              </label>
              <textarea
                rows={12}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="w-full text-xs font-mono bg-background border border-border rounded-xl p-3.5 text-foreground leading-relaxed focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="EXAMINATEUR: ...&#10;CANDIDAT: ..."
              />
            </div>

            <div className="pt-2 border-t border-border">
              <ModelSelector value={model} onChange={setModel} allowedTypes="text" />
            </div>

            <Button
              onClick={handleEvaluateSpeaking}
              disabled={loading || !transcript.trim()}
              data-testid="run-speaking-evaluation-btn"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs py-3 rounded-xl shadow-xs"
            >
              {loading ? (
                <>
                  <span className="animate-spin mr-2">⚙️</span>
                  Calcul de la grille d'évaluation en cours...
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  Évaluer la Transcription Orale
                </>
              )}
            </Button>
          </div>

          {run && <TelemetryCollapsible run={run} />}
        </div>

        {/* Right: Scorecard */}
        <div className="lg:col-span-6 space-y-4">
          {result ? (
            <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-5 animate-in fade-in">
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    Score Officiel TEF Oral
                  </span>
                  <div className="text-3xl font-extrabold text-foreground mt-0.5">
                    {result.tef_points}{" "}
                    <span className="text-sm font-normal text-muted-foreground">/ 698 pts</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block bg-primary text-primary-foreground font-bold px-3 py-1 rounded-xl text-sm shadow-xs">
                    Niveau {result.cefr_level}
                  </span>
                  <div className="text-xs text-muted-foreground mt-1">Score normalisé : {result.score}%</div>
                </div>
              </div>

              {/* 4 Criteria Breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-muted/30 border border-border rounded-xl">
                  <span className="text-muted-foreground block text-[11px]">Aisance & Débit</span>
                  <span className="text-base font-bold text-foreground mt-0.5 block font-mono">
                    {result.pronunciation_fluency} / 25
                  </span>
                </div>
                <div className="p-3 bg-muted/30 border border-border rounded-xl">
                  <span className="text-muted-foreground block text-[11px]">Lexique & Nuances</span>
                  <span className="text-base font-bold text-foreground mt-0.5 block font-mono">
                    {result.lexical_resource} / 25
                  </span>
                </div>
                <div className="p-3 bg-muted/30 border border-border rounded-xl">
                  <span className="text-muted-foreground block text-[11px]">Grammaire & Syntaxe</span>
                  <span className="text-base font-bold text-foreground mt-0.5 block font-mono">
                    {result.grammatical_accuracy} / 25
                  </span>
                </div>
                <div className="p-3 bg-muted/30 border border-border rounded-xl">
                  <span className="text-muted-foreground block text-[11px]">Interaction & Cohérence</span>
                  <span className="text-base font-bold text-foreground mt-0.5 block font-mono">
                    {result.interaction_coherence} / 25
                  </span>
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {result.strengths && result.strengths.length > 0 && (
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-1">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300 block">
                      Points Forts
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-muted-foreground text-[11px]">
                      {result.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.weaknesses && result.weaknesses.length > 0 && (
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1">
                    <span className="font-bold text-amber-700 dark:text-amber-300 block">
                      Axes d'Amélioration
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-muted-foreground text-[11px]">
                      {result.weaknesses.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Examiner Feedback */}
              {result.examiner_feedback && (
                <div className="p-3.5 bg-muted/30 border border-border rounded-xl text-xs space-y-1">
                  <span className="font-bold text-foreground block">Appréciation de l'Examinateur</span>
                  <p className="text-muted-foreground italic leading-relaxed">
                    "{result.examiner_feedback}"
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card p-12 rounded-2xl border border-dashed border-border text-center space-y-3 shadow-2xs">
              <div className="size-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                <Volume2 className="size-6 text-muted-foreground/60" />
              </div>
              <h4 className="font-bold text-sm text-foreground">En attente d'évaluation</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Renseignez la transcription d'un entretien oral ou chargez un étalon officiel, puis lancez
                l'évaluation pour mesurer les scores CEFR.
              </p>
            </div>
          )}
        </div>
      </div>
    </AIStudioLayout>
  );
};

export const AssessmentSpeakingPage: React.FC = () => (
  <AIStudioProvider>
    <AssessmentSpeakingPageContent />
  </AIStudioProvider>
);
