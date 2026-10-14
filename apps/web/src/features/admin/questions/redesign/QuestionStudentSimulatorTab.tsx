import React, { useState, useMemo } from "react";
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Headphones,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuestionItem } from "../../types";
import { renderHighlightedGapText } from "../components/StimulusRenderer";

interface QuestionStudentSimulatorTabProps {
  question: Partial<QuestionItem>;
}

export const QuestionStudentSimulatorTab: React.FC<QuestionStudentSimulatorTabProps> = ({
  question,
}) => {
  const [viewMode, setViewMode] = useState<"candidate" | "correction">("candidate");
  const [selectedOptions, setSelectedOptions] = useState<Record<number, boolean>>({});
  const [selectedGapOptions, setSelectedGapOptions] = useState<Record<string, number>>({});
  const [candidateGapText, setCandidateGapText] = useState("");

  const qType = question.question_type || "single_choice";
  const options = question.options || [];
  const rawStimulus: any = question.stimulus || {};
  const stimulusText = question.stimulus_text || rawStimulus.content_text || rawStimulus.content || "";
  const stimulusTitle = (question as any).stimulus_title || rawStimulus.title;
  const audioUrl = question.media_url || question.audio_url;
  const modalityStr = (question as any).modality || rawStimulus.modality || "Compréhension";

  // Grouped gaps if this is a multi-gap cloze question
  const gapsData = useMemo(() => {
    if (Array.isArray(question.scoring_payload?.gaps) && question.scoring_payload.gaps.length > 0) {
      return question.scoring_payload.gaps;
    }
    if (Array.isArray(question.response_metadata?.gaps) && question.response_metadata.gaps.length > 0) {
      return question.response_metadata.gaps;
    }
    if (question.options && question.options.length > 0) {
      const hasPrefix = question.options.some((o) => /^\[\d+\]\s*/.test(o.content));
      if (hasPrefix) {
        const grouped: Record<string, any[]> = {};
        question.options.forEach((opt) => {
          const match = opt.content.match(/^\[(\d+)\]\s*(.*)/);
          if (match) {
            const gapId = match[1];
            if (!grouped[gapId]) grouped[gapId] = [];
            grouped[gapId].push({
              ...opt,
              content: match[2],
            });
          }
        });
        return Object.entries(grouped).map(([gapId, opts], idx) => ({
          gap_id: gapId,
          order_index: idx,
          options: opts,
        }));
      }
    }
    return null;
  }, [question.scoring_payload, question.response_metadata, question.options]);

  const isGapFill = Boolean(
    question.response_type === "gap_fill" ||
    question.question_type === "gap_fill" ||
    (gapsData && gapsData.length > 0) ||
    question.options?.some((o) => /^\[\d+\]\s*/.test(o.content))
  );

  const handleOptionSelect = (idx: number) => {
    if (viewMode === "correction") return;
    if (qType === "multiple_choice") {
      setSelectedOptions((prev) => ({ ...prev, [idx]: !prev[idx] }));
    } else {
      setSelectedOptions({ [idx]: true });
    }
  };

  const handleResetAttempt = () => {
    setSelectedOptions({});
    setSelectedGapOptions({});
    setCandidateGapText("");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Simulator Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-2xl border border-border bg-card shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Mode de simulation :</span>
          <div className="inline-flex rounded-xl border border-border p-1 bg-muted/30">
            <button
              type="button"
              onClick={() => setViewMode("candidate")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                viewMode === "candidate"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Vue Candidat (Examen réel)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("correction")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                viewMode === "correction"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Vue Correction (Didactique)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetAttempt}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Réinitialiser le test
          </Button>
          <span className="text-2xs font-mono font-bold px-2 py-1 rounded bg-muted text-muted-foreground">
            {question.points || 1} pt{(question.points || 1) > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Main Authentic Exam Container */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Exam Section Header */}
        <div className="p-4 bg-muted/20 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground uppercase tracking-wide text-2xs">
              Épreuve de {modalityStr}
            </span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded bg-muted font-bold text-2xs">
              Niveau {question.target_cefr || question.level || "B1"}
            </span>
          </div>
          <span className="text-2xs font-mono text-muted-foreground">
            Format officiel TEF
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Audio Player */}
          {audioUrl && (
            <div className="p-4 rounded-xl border border-border bg-muted/30 flex items-center gap-3">
              <Headphones className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1">
                <audio controls src={audioUrl} className="w-full h-8">
                  Votre navigateur ne supporte pas l'élément audio.
                </audio>
              </div>
            </div>
          )}

          {/* Stimulus Document */}
          {stimulusText && (
            <div className="p-5 rounded-xl border border-border/80 bg-muted/15 space-y-2.5">
              {stimulusTitle && (
                <h4 className="font-bold text-sm text-foreground border-b border-border/40 pb-1.5">
                  {stimulusTitle}
                </h4>
              )}
              <div className="text-xs leading-relaxed text-foreground whitespace-pre-line font-sans">
                {isGapFill ? renderHighlightedGapText(stimulusText) : stimulusText}
              </div>
            </div>
          )}

          {/* Prompt Stem */}
          <div className="space-y-1">
            <span className="text-2xs font-mono uppercase text-muted-foreground font-semibold">
              Question :
            </span>
            <h3 className="text-base font-bold text-foreground">
              {question.prompt || "Énoncé de la question"}
            </h3>
          </div>

          {/* Multi-gap cloze response section */}
          {isGapFill && gapsData && gapsData.length > 0 && (
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between border-b border-border/70 pb-2">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Options par lacune ({gapsData.length} lacunes à compléter)
                </span>
                {viewMode === "candidate" && (
                  <span className="text-2xs text-muted-foreground font-mono">
                    {Object.keys(selectedGapOptions).length} / {gapsData.length} répondu(s)
                  </span>
                )}
              </div>

              <div className="space-y-5">
                {gapsData.map((gap: any, gapIdx: number) => {
                  const gapKey = String(gap.gap_id || gapIdx + 1);
                  const selectedIdx = selectedGapOptions[gapKey];
                  const optionsList = gap.options || [];

                  return (
                    <div
                      key={gapKey}
                      className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">
                            Lacune ({gapKey})
                          </span>
                          <span className="text-2xs text-muted-foreground font-medium">
                            Sélectionnez la proposition qui convient :
                          </span>
                        </div>
                        {gap.cue_text && (
                          <span className="text-2xs text-muted-foreground italic max-w-sm truncate text-right">
                            {gap.cue_text}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {optionsList.map((opt: any, optIdx: number) => {
                          const isSelected = selectedIdx === optIdx;
                          const letter = String.fromCharCode(65 + optIdx);
                          const isCorrect = opt.is_correct;

                          let cardStyle = "border-border bg-background hover:border-border/80 text-foreground";
                          if (viewMode === "candidate") {
                            if (isSelected) {
                              cardStyle = "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 font-medium shadow-xs";
                            }
                          } else {
                            // Correction view
                            if (isCorrect) {
                              cardStyle = "border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-semibold";
                            } else if (isSelected && !isCorrect) {
                              cardStyle = "border-rose-500 bg-rose-500/10 text-rose-950 dark:text-rose-200";
                            }
                          }

                          return (
                            <div
                              key={optIdx}
                              onClick={() => {
                                if (viewMode === "correction") return;
                                setSelectedGapOptions((prev) => ({
                                  ...prev,
                                  [gapKey]: optIdx,
                                }));
                              }}
                              className={`p-3 rounded-xl border text-xs transition space-y-1.5 ${
                                viewMode === "candidate" ? "cursor-pointer" : ""
                              } ${cardStyle}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  {viewMode === "candidate" ? (
                                    <div
                                      className={`h-4 w-4 shrink-0 rounded-full flex items-center justify-center border transition ${
                                        isSelected
                                          ? "bg-primary border-primary text-primary-foreground"
                                          : "border-muted-foreground/40 bg-background"
                                      }`}
                                    >
                                      {isSelected && (
                                        <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                                      )}
                                    </div>
                                  ) : (
                                    <span className="h-5 w-5 rounded-md bg-muted text-foreground flex items-center justify-center font-bold text-2xs shrink-0 font-mono">
                                      {letter}
                                    </span>
                                  )}
                                  <span className="font-mono text-xs font-bold text-muted-foreground">
                                    {letter}.
                                  </span>
                                  <span className="font-medium">{opt.content}</span>
                                </div>

                                {viewMode === "correction" && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    {isCorrect && (
                                      <span className="flex items-center gap-1 text-2xs font-bold text-emerald-600 dark:text-emerald-400">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Bonne réponse
                                      </span>
                                    )}
                                    {isSelected && !isCorrect && (
                                      <span className="flex items-center gap-1 text-2xs font-bold text-rose-600 dark:text-rose-400">
                                        <XCircle className="h-3.5 w-3.5" /> Votre choix
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {viewMode === "correction" && (
                                <div className="space-y-1 pt-1 border-t border-border/40 text-2xs">
                                  {opt.explanation && (
                                    <p className="text-muted-foreground">
                                      <span className="font-semibold text-foreground">Explication :</span> {opt.explanation}
                                    </p>
                                  )}
                                  {!opt.is_correct && opt.distractor_rationale && (
                                    <p className="text-muted-foreground italic">
                                      <span className="font-semibold not-italic text-foreground">Piège :</span> {opt.distractor_rationale}
                                    </p>
                                  )}
                                  {!opt.is_correct && opt.misconception_type && (
                                    <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono">
                                      {opt.misconception_type}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Response Interaction Area (Single / Multiple Choice) */}
          {!isGapFill && (qType === "single_choice" || qType === "multiple_choice") && (
            <div className="space-y-2.5 pt-2">
              {options.map((opt, idx) => {
                const isSelected = !!selectedOptions[idx];
                const isCorrect = opt.is_correct;

                let rowStyle = "border-border/70 hover:border-border bg-card";
                if (viewMode === "candidate") {
                  if (isSelected) {
                    rowStyle = "border-primary bg-primary/10 font-semibold shadow-xs";
                  }
                } else {
                  // Correction mode
                  if (isCorrect) {
                    rowStyle = "border-emerald-500 bg-emerald-500/15 font-bold text-emerald-950 dark:text-emerald-200";
                  } else if (isSelected && !isCorrect) {
                    rowStyle = "border-rose-500 bg-rose-500/15 text-rose-950 dark:text-rose-200 line-through";
                  }
                }

                return (
                  <div
                    key={idx}
                    onClick={() => handleOptionSelect(idx)}
                    className={`p-3.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition ${rowStyle}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-6 w-6 rounded-lg bg-muted text-foreground flex items-center justify-center font-bold text-xs shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span>{opt.content}</span>
                    </div>

                    {viewMode === "correction" && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCorrect && (
                          <span className="flex items-center gap-1 text-2xs font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Bonne réponse
                          </span>
                        )}
                        {isSelected && !isCorrect && (
                          <span className="flex items-center gap-1 text-2xs font-bold text-rose-600 dark:text-rose-400">
                            <XCircle className="h-3.5 w-3.5" /> Votre choix erroné
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Matching Display in Simulator */}
          {!isGapFill && qType === "matching" && (
            <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-3">
              <span className="text-xs font-semibold text-foreground">
                Paires d'association attendues :
              </span>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                      viewMode === "correction"
                        ? "border-emerald-500/40 bg-emerald-500/10 font-semibold"
                        : "border-border bg-card"
                    }`}
                  >
                    <span>{opt.content}</span>
                    {viewMode === "correction" && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ordering Display in Simulator */}
          {!isGapFill && qType === "ordering" && (
            <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-3">
              <span className="text-xs font-semibold text-foreground">
                Ordre séquentiel chronologique :
              </span>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-xs flex items-center gap-3 ${
                      viewMode === "correction"
                        ? "border-emerald-500/40 bg-emerald-500/10 font-semibold"
                        : "border-border bg-card"
                    }`}
                  >
                    <span className="h-5 w-5 rounded bg-muted text-foreground flex items-center justify-center font-mono font-bold text-2xs shrink-0">
                      {idx + 1}
                    </span>
                    <span>{opt.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gap Fill / Free text single input fallback */}
          {!isGapFill && (qType === "gap_fill" || qType === "short_text" || qType === "text_input") && (
            <div className="space-y-3 pt-2">
              <input
                type="text"
                value={candidateGapText}
                onChange={(e) => setCandidateGapText(e.target.value)}
                placeholder="Tapez votre réponse ici..."
                disabled={viewMode === "correction"}
                className="w-full rounded-xl border border-border bg-background p-3 text-xs font-semibold"
              />
              {viewMode === "correction" && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300">
                  <span className="font-bold">Réponse(s) acceptée(s) : </span>
                  {options.filter((o) => o.is_correct).map((o) => o.content).join(" ou ")}
                </div>
              )}
            </div>
          )}

          {/* Didactic Explanation Box (Only shown in Correction Mode) */}
          {viewMode === "correction" && question.explanation && (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-xs text-primary">
                <HelpCircle className="h-4 w-4" />
                Explication pédagogique & Justification didactique :
              </div>
              <p className="text-xs text-foreground leading-relaxed">
                {question.explanation}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
