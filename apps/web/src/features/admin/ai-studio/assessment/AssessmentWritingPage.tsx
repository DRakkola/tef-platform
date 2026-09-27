import React, { useState } from "react";
import {
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Download,
} from "lucide-react";
import { AIStudioLayout } from "../layout/AIStudioLayout";
import { useAIStudio, AIStudioProvider } from "../context/AIStudioContext";
import { TelemetryCollapsible } from "../shared/TelemetryCollapsible";
import { ModelSelector } from "../shared/ModelSelector";
import type { BenchmarkSample, WritingTestResult, AISandboxRun } from "../types";
import { Button } from "@/components/ui/button";

const AssessmentWritingPageContent: React.FC = () => {
  const { benchmarks, templates, isSimulation, apiKeyOverride, getAuthHeaders } = useAIStudio();

  // Task Configuration State
  const [section, setSection] = useState<string>("section_b");
  const [targetLevel, setTargetLevel] = useState<string>("B2");
  const [taskPrompt, setTaskPrompt] = useState<string>(
    "Vous avez lu dans un journal que la mairie envisage d'interdire totalement les voitures dans le centre-ville. Écrivez une lettre au courrier des lecteurs pour exprimer votre point de vue argumenté sur ce projet (environ 200 mots)."
  );
  const [candidateDraft, setCandidateDraft] = useState<string>(
    "Monsieur le Rédacteur en chef,\n\nJe me permets de vous écrire suite à la parution de votre article concernant l'éventuelle fermeture du centre-ville aux automobiles. En tant que résident et cycliste régulier, je soutiens vivement cette initiative qui me semble indispensable pour notre cadre de vie.\n\nTout d'abord, cette décision permettra de réduire de manière significative la pollution atmosphérique ainsi que les nuisances sonores. Ensuite, la pacification des rues stimulera le commerce local car les piétons fréquentent davantage les boutiques de proximité.\n\nNéanmoins, la municipalité se doit de renforcer impérativement les réseaux de transports en commun en périphérie pour ne pas pénaliser les habitants des zones rurales.\n\nCordialement."
  );
  const [model, setModel] = useState<string>("models/gemini-3.5-flash");
  const temperature = 0.3;
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Benchmark / Import State
  const [activeBenchmark, setActiveBenchmark] = useState<BenchmarkSample | null>(null);
  const [submissionIdToImport, setSubmissionIdToImport] = useState<string>("");
  const [importLoading, setImportLoading] = useState<boolean>(false);

  // Execution & Results State
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [result, setResult] = useState<WritingTestResult | null>(null);
  const [run, setRun] = useState<AISandboxRun | null>(null);

  // Word count helper
  const wordCount = candidateDraft.trim() ? candidateDraft.trim().split(/\s+/).length : 0;
  const targetWords = section === "section_a" ? 80 : 200;

  // Load benchmark copy
  const handleLoadBenchmark = (b: BenchmarkSample) => {
    setActiveBenchmark(b);
    setSection(b.section);
    setTargetLevel(b.cefr_level);
    setTaskPrompt(b.task_prompt);
    setCandidateDraft(b.sample_content);
    setResult(null);
    setRun(null);
    setSuccessMsg(`Étalon « ${b.title} » chargé avec succès.`);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // Import real student submission
  const handleImportSubmission = async () => {
    if (!submissionIdToImport.trim()) return;
    setImportLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/ai-sandbox/import-submission/${submissionIdToImport.trim()}`, {
        headers: getAuthHeaders(false),
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Copie étudiante introuvable avec cet identifiant.");
      }
      const data = await res.json();
      setSection(data.section || "section_b");
      setTaskPrompt(data.prompt_stimulus || "");
      setCandidateDraft(data.candidate_text || "");
      setActiveBenchmark(null);
      setSuccessMsg("Copie étudiante importée dans l'atelier !");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'import.");
    } finally {
      setImportLoading(false);
    }
  };

  // Run writing evaluation
  const handleRunEvaluation = async () => {
    if (!candidateDraft.trim()) {
      setErrorMsg("Veuillez renseigner le texte de la copie à évaluer.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/admin/ai-sandbox/run/writing", {
        method: "POST",
        headers: getAuthHeaders(true),
        credentials: "include",
        body: JSON.stringify({
          section,
          target_level: targetLevel,
          task_prompt: taskPrompt,
          candidate_draft: candidateDraft,
          model,
          temperature,
          template_id: selectedTemplateId || null,
          force_simulation: isSimulation,
          api_key_override: apiKeyOverride || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Échec de l'évaluation écrite.");
      }

      const data = await res.json();
      setResult(data.result);
      setRun(data.run);
      setSuccessMsg("Évaluation officielle TEF calculée avec succès !");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur d'inférence lors de la correction.");
    } finally {
      setLoading(false);
    }
  };

  const writingBenchmarks = benchmarks.filter((b) => b.feature_type === "writing");
  const writingTemplates = templates.filter((t) => t.feature_type === "writing");

  return (
    <AIStudioLayout
      title="Atelier Écrit — Calibration & Grille TEF"
      description="Évaluation pédagogique des productions écrites (Section A Fait divers et Section B Lettre d'opinion) selon les 4 critères officiels."
    >
      {/* Alert Notices */}
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

      {/* Top Benchmark & Import Bar */}
      <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Étalons Pédagogiques TEF Préchargés
          </span>
          <div className="flex flex-wrap gap-2 mt-2">
            {writingBenchmarks.map((b) => (
              <Button
                key={b.id}
                variant={activeBenchmark?.id === b.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleLoadBenchmark(b)}
                className="text-xs rounded-xl"
              >
                {b.cefr_level} — {b.section.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        {/* Import student submission */}
        <div className="flex items-center gap-2 border-t lg:border-t-0 lg:border-l border-border pt-3 lg:pt-0 lg:pl-4">
          <input
            type="text"
            placeholder="ID de copie réelle (UUID)..."
            value={submissionIdToImport}
            onChange={(e) => setSubmissionIdToImport(e.target.value)}
            className="text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground font-mono focus:ring-1 focus:ring-primary w-48 sm:w-60"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportSubmission}
            disabled={importLoading || !submissionIdToImport.trim()}
            className="text-xs rounded-xl"
          >
            <Download className="size-3.5 mr-1" />
            Importer
          </Button>
        </div>
      </div>

      {/* Main Workspace: 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Task & Candidate Input */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Configuration de l'Épreuve & Consigne
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">Section TEF</label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-xl p-2.5 text-foreground font-medium focus:ring-1 focus:ring-primary"
                >
                  <option value="section_a">Section A — Fait divers (80 mots)</option>
                  <option value="section_b">Section B — Lettre d'opinion (200 mots)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">Niveau Cible</label>
                <select
                  value={targetLevel}
                  onChange={(e) => setTargetLevel(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-xl p-2.5 text-foreground font-medium focus:ring-1 focus:ring-primary"
                >
                  <option value="A2">A2 (Élémentaire)</option>
                  <option value="B1">B1 (Intermédiaire)</option>
                  <option value="B2">B2 (Avancé)</option>
                  <option value="C1">C1 (Autonome)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">Consigne de l'épreuve</label>
              <textarea
                rows={3}
                value={taskPrompt}
                onChange={(e) => setTaskPrompt(e.target.value)}
                className="w-full text-xs bg-background border border-border rounded-xl p-3 text-foreground leading-relaxed focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Candidate Draft Editor */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-foreground">Production du Candidat</label>
                <div className="text-[11px] font-mono">
                  <span
                    className={
                      Math.abs(wordCount - targetWords) > targetWords * 0.25
                        ? "text-amber-600 font-bold"
                        : "text-muted-foreground"
                    }
                  >
                    {wordCount} mots
                  </span>{" "}
                  <span className="text-muted-foreground">/ cible ~{targetWords} mots</span>
                </div>
              </div>
              <textarea
                rows={10}
                value={candidateDraft}
                onChange={(e) => setCandidateDraft(e.target.value)}
                className="w-full text-xs font-sans bg-background border border-border rounded-xl p-3.5 text-foreground leading-relaxed focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Rédigez ou collez ici la copie du candidat..."
              />
            </div>

            {/* Model & Template Controls */}
            <div className="pt-2 border-t border-border grid grid-cols-2 gap-3">
              <ModelSelector value={model} onChange={setModel} allowedTypes="text" />
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">Template de Prompt</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-xl p-2.5 text-foreground font-medium focus:ring-1 focus:ring-primary"
                >
                  <option value="">Prompt officiel standard (Défaut)</option>
                  {writingTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-2">
              <Button
                onClick={handleRunEvaluation}
                disabled={loading || !candidateDraft.trim()}
                data-testid="run-writing-evaluation-btn"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs py-3 rounded-xl shadow-xs"
              >
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">⚙️</span>
                    Analyse & Correction TEF en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    Lancer l'Évaluation Écrite
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Collapsible Telemetry */}
          {run && <TelemetryCollapsible run={run} />}
        </div>

        {/* Right Column: Official Evaluation & Criteria Breakdown */}
        <div className="lg:col-span-6 space-y-4">
          {result ? (
            <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-5 animate-in fade-in">
              {/* Overall Score & CEFR Pill */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    Score Officiel TEF Écrit
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

              {/* Benchmark Expected Score Comparison */}
              {activeBenchmark && (
                <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Fourchette attendue pour l'étalon :</span>
                  <span className="font-semibold text-foreground font-mono">
                    {activeBenchmark.expected_score_range}
                  </span>
                </div>
              )}

              {/* 4 Official Criteria (0-25 each) */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-foreground block">
                  Décomposition sur les 4 Critères Officiels
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-muted/30 border border-border rounded-xl">
                    <span className="text-muted-foreground block text-[11px]">Adéquation à la Consigne</span>
                    <span className="text-base font-bold text-foreground mt-0.5 block font-mono">
                      {result.criteria.task_completion} / 25
                    </span>
                  </div>
                  <div className="p-3 bg-muted/30 border border-border rounded-xl">
                    <span className="text-muted-foreground block text-[11px]">Cohérence & Organisation</span>
                    <span className="text-base font-bold text-foreground mt-0.5 block font-mono">
                      {result.criteria.coherence_cohesion} / 25
                    </span>
                  </div>
                  <div className="p-3 bg-muted/30 border border-border rounded-xl">
                    <span className="text-muted-foreground block text-[11px]">Étendue du Vocabulaire</span>
                    <span className="text-base font-bold text-foreground mt-0.5 block font-mono">
                      {result.criteria.vocabulary_range_accuracy} / 25
                    </span>
                  </div>
                  <div className="p-3 bg-muted/30 border border-border rounded-xl">
                    <span className="text-muted-foreground block text-[11px]">Correction Grammaticale</span>
                    <span className="text-base font-bold text-foreground mt-0.5 block font-mono">
                      {result.criteria.grammatical_range_accuracy} / 25
                    </span>
                  </div>
                </div>
              </div>

              {/* Detected Errors & Suggested Corrections */}
              {result.errors && result.errors.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-foreground block">
                    Erreurs Linguistiques Identifiées ({result.errors.length})
                  </span>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {result.errors.map((err, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-destructive/5 border border-destructive/15 rounded-xl text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-destructive line-through font-mono">
                            "{err.error_text}"
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-destructive/10 text-destructive">
                            {err.error_type}
                          </span>
                        </div>
                        <div className="text-emerald-700 dark:text-emerald-400 font-semibold font-mono">
                          ➜ Suggestion : {err.suggestion}
                        </div>
                        <div className="text-muted-foreground text-[11px] leading-relaxed">
                          {err.explanation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {result.strengths && result.strengths.length > 0 && (
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-1.5">
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
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1.5">
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

              {/* Qualitative Overall Feedback */}
              {result.overall_feedback && (
                <div className="p-3.5 bg-muted/30 border border-border rounded-xl text-xs space-y-1">
                  <span className="font-bold text-foreground block">Appréciation Globale de l'Examinateur</span>
                  <p className="text-muted-foreground italic leading-relaxed">
                    "{result.overall_feedback}"
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card p-12 rounded-2xl border border-dashed border-border text-center space-y-3 shadow-2xs">
              <div className="size-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                <Sparkles className="size-6 text-muted-foreground/60" />
              </div>
              <h4 className="font-bold text-sm text-foreground">En attente d'évaluation</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Sélectionnez un étalon TEF ou saisissez une production écrite à gauche, puis cliquez
                sur « Lancer l'Évaluation Écrite » pour générer la grille complète.
              </p>
            </div>
          )}
        </div>
      </div>
    </AIStudioLayout>
  );
};

export const AssessmentWritingPage: React.FC = () => (
  <AIStudioProvider>
    <AssessmentWritingPageContent />
  </AIStudioProvider>
);
