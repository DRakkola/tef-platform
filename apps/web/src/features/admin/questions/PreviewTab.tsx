import React, { useState, useMemo } from "react";
import { UserCheck, ShieldAlert, CheckCircle2, Headphones, Check } from "lucide-react";
import type { QuestionItem } from "../types";
import { StimulusRenderer } from "./components/StimulusRenderer";

interface PreviewTabProps {
  question: Partial<QuestionItem>;
}

export const PreviewTab: React.FC<PreviewTabProps> = ({ question }) => {
  const [previewMode, setPreviewMode] = useState<"student" | "admin">("student");
  const [selectedStudentOptions, setSelectedStudentOptions] = useState<Record<number, boolean>>({});

  const handleStudentSelect = (index: number) => {
    if (question.question_type === "multiple_choice") {
      setSelectedStudentOptions((prev) => ({ ...prev, [index]: !prev[index] }));
    } else {
      setSelectedStudentOptions({ [index]: true });
    }
  };

  const stimulusContent = question.stimulus?.content || question.stimulus_text;

  // Auto-detect referenced document key from prompt or options (e.g. "Document B")
  const activeDocumentKey = useMemo(() => {
    const textToScan = `${question.prompt || ""} ${question.options?.map((o) => o.content).join(" ") || ""}`;
    const match = textToScan.match(/Document\s+([A-D])/i);
    return match ? `doc_${match[1].toLowerCase()}` : null;
  }, [question.prompt, question.options]);

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Mode de prévisualisation :</span>
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
            <button
              type="button"
              onClick={() => setPreviewMode("student")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                previewMode === "student"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Aperçu Candidat (Étanche)
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("admin")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                previewMode === "admin"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Aperçu Révision Enseignant
            </button>
          </div>
        </div>

        <span className="text-2xs text-muted-foreground hidden sm:inline">
          {previewMode === "student"
            ? "🔒 Vue strictement étanche : zéro indice, zéro métadonnée diagnostique"
            : "🔍 Vue didactique complète : réponses correctes et analyse des distracteurs"}
        </span>
      </div>

      {previewMode === "student" ? (
        /* ========================================================================= */
        /* SAFE STUDENT VIEW (STRICT LEAKAGE PREVENTION BOUNDARY)                     */
        /* ========================================================================= */
        <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-6 max-w-3xl mx-auto">
          {/* Audio Player if Listening */}
          {(question.audio_url || question.media_url) && (
            <div className="p-3.5 rounded-xl border border-border bg-muted/30 flex items-center gap-3">
              <Headphones className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1">
                <audio
                  controls
                  src={question.audio_url || question.media_url || ""}
                  className="w-full h-8"
                >
                  Votre navigateur ne supporte pas l'élément audio.
                </audio>
              </div>
            </div>
          )}

          {/* Stimulus Passage if Present */}
          {stimulusContent && (
            <StimulusRenderer
              title={question.stimulus?.title || "Document support"}
              content={stimulusContent}
              modality={question.task_type?.modality || ((question.audio_url || question.media_url) ? "listening" : "reading")}
              textFormat={question.stimulus?.text_format || undefined}
              sourceCitation={question.stimulus?.source_attribution}
              cefrLevel={question.stimulus?.cefr_level || question.target_cefr || question.level}
              wordCount={question.stimulus?.word_count}
              viewMode="full"
              activeDocumentKey={activeDocumentKey}
              enableExpandModal={true}
            />
          )}

          {/* Prompt */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground leading-snug">
              {question.prompt || "Énoncé de la question..."}
            </h3>
            {question.question_type === "multiple_choice" && (
              <p className="text-2xs text-muted-foreground italic">
                (Plusieurs réponses possibles)
              </p>
            )}
          </div>

          {/* Student Response Options */}
          {question.options && question.options.length > 0 ? (
            <div className="space-y-2.5">
              {question.options.map((opt, idx) => {
                const isSelected = !!selectedStudentOptions[idx];
                const isSingle = question.question_type === "single_choice";
                return (
                  <div
                    key={idx}
                    onClick={() => handleStudentSelect(idx)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center gap-3 select-none ${
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40"
                        : "border-border bg-background hover:border-border/80 text-foreground"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 shrink-0 flex items-center justify-center border transition ${
                        isSingle ? "rounded-full" : "rounded"
                      } ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-background"
                      }`}
                    >
                      {isSelected && (
                        isSingle ? (
                          <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                        ) : (
                          <Check className="h-3 w-3 stroke-[3]" />
                        )
                      )}
                    </div>
                    <span className="font-mono text-2xs text-muted-foreground font-bold">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    <span className="flex-1 font-medium">{opt.content}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-muted/40 border border-border text-center text-xs text-muted-foreground">
              [Champ de saisie interactif candidat pour le format {question.question_type || "générique"}]
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* ADMIN REVIEW VIEW (DIAGNOSTIC & SCORING BREAKDOWN)                         */
        /* ========================================================================= */
        <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-6 max-w-4xl mx-auto">
          {/* Metadata Badges Header */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <span className="px-2 py-0.5 rounded text-2xs font-bold font-mono bg-primary/10 text-primary border border-primary/20">
              v{question.version || 1}
            </span>
            <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-muted text-foreground">
              {question.target_cefr || question.level || "B1"}
            </span>
            <span className="px-2 py-0.5 rounded text-2xs bg-muted text-muted-foreground">
              Diff: {question.item_difficulty ?? question.difficulty ?? 3}/5
            </span>
            {question.cognitive_complexity && (
              <span className="px-2 py-0.5 rounded text-2xs bg-muted text-muted-foreground capitalize">
                Bloom: {question.cognitive_complexity}
              </span>
            )}
            <span className="px-2 py-0.5 rounded text-2xs bg-muted text-muted-foreground">
              {question.points ?? 1} pt{((question.points ?? 1) > 1) ? "s" : ""}
            </span>
            {question.task_type && (
              <span className="px-2 py-0.5 rounded text-2xs bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium">
                {question.task_type.name}
              </span>
            )}
          </div>

          {/* Admin Stimulus Support Preview */}
          {stimulusContent && (
            <div className="space-y-1.5">
              <span className="text-2xs font-bold text-muted-foreground uppercase">
                Document support associé
              </span>
              <StimulusRenderer
                title={question.stimulus?.title || "Document support"}
                content={stimulusContent}
                modality={question.task_type?.modality || ((question.audio_url || question.media_url) ? "listening" : "reading")}
                textFormat={question.stimulus?.text_format || undefined}
                sourceCitation={question.stimulus?.source_attribution}
                cefrLevel={question.stimulus?.cefr_level || question.target_cefr || question.level}
                wordCount={question.stimulus?.word_count}
                viewMode="compact"
                activeDocumentKey={activeDocumentKey}
                enableExpandModal={true}
              />
            </div>
          )}

          {/* Prompt */}
          <div className="space-y-1">
            <span className="text-2xs font-bold text-muted-foreground uppercase">
              Énoncé didactique
            </span>
            <h3 className="text-sm font-semibold text-foreground">
              {question.prompt || "Énoncé de la question"}
            </h3>
          </div>

          {/* Diagnostic Options Breakdown */}
          {question.options && question.options.length > 0 && (
            <div className="space-y-3">
              <span className="text-2xs font-bold text-muted-foreground uppercase">
                Grille des réponses et analyse des distracteurs
              </span>
              <div className="space-y-2">
                {question.options.map((opt, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                      opt.is_correct
                        ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200"
                        : "border-border bg-background text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-2">
                        <span className="font-mono font-bold">
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        {opt.content}
                      </span>
                      {opt.is_correct ? (
                        <span className="text-2xs px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> RÉPONSE CORRECTE
                        </span>
                      ) : (
                        opt.misconception_type && (
                          <span className="text-2xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono">
                            Piège : {opt.misconception_type}
                          </span>
                        )
                      )}
                    </div>

                    {!opt.is_correct && opt.distractor_rationale && (
                      <p className="text-2xs text-muted-foreground italic pl-5">
                        Raison du distracteur : {opt.distractor_rationale}
                      </p>
                    )}

                    {opt.explanation && (
                      <p className="text-2xs text-muted-foreground pl-5">
                        Explication : {opt.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills Breakdown */}
          {question.skill_tags && question.skill_tags.length > 0 && (
            <div className="pt-2 border-t border-border space-y-2">
              <span className="text-2xs font-bold text-muted-foreground uppercase">
                Compétences cibles mobilisées
              </span>
              <div className="flex flex-wrap gap-2">
                {question.skill_tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md border border-border bg-muted/40 text-2xs flex items-center gap-1.5"
                  >
                    <span className="font-mono font-bold text-primary">
                      {tag.skill_code || tag.skill_id.slice(0, 8)}
                    </span>
                    <span>{tag.skill_name || "Compétence"}</span>
                    <span className="font-mono text-muted-foreground">
                      (poids: {tag.weight}, {tag.role})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
