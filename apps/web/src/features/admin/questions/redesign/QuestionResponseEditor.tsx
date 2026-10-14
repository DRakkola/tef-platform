import React, { useState } from "react";
import {
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { regenerateDraftComponent } from "@/features/admin/api";
import { GapFillEditor } from "../GapFillEditor";
import type { QuestionOption } from "../../types";

export const MISCONCEPTION_TYPES = [
  { value: "overgeneralization", label: "Sur-généralisation / Conclusion hâtive" },
  { value: "false_friend", label: "Faux-ami / Piège lexical ou phonétique" },
  { value: "contradiction", label: "Contradiction directe avec le document" },
  { value: "extrapolation", label: "Extrapolation / Information non mentionnée" },
  { value: "literal_interpretation", label: "Interprétation littérale / Contresens" },
  { value: "incomplete_comprehension", label: "Compréhension incomplète d'un détail" },
  { value: "morphosyntax", label: "Erreur morphosyntaxique / Grammaire" },
  { value: "intonation_mismatch", label: "Intonation discordante (oral)" },
  { value: "content_mismatch", label: "Non-concordance documentaire" },
];

interface QuestionResponseEditorProps {
  questionId?: string;
  questionPrompt?: string;
  stimulusText?: string;
  responseType: string;
  options: QuestionOption[];
  scoringPayload?: Record<string, any> | null;
  onOptionsChange: (options: QuestionOption[]) => void;
  onScoringPayloadChange: (payload: Record<string, any>) => void;
  disabled?: boolean;
}

export const QuestionResponseEditor: React.FC<QuestionResponseEditorProps> = ({
  questionId,
  questionPrompt,
  stimulusText,
  responseType,
  options,
  scoringPayload,
  onOptionsChange,
  onScoringPayloadChange,
  disabled = false,
}) => {
  const [expandedOptionIndex, setExpandedOptionIndex] = useState<number | null>(null);
  const [previousOptions, setPreviousOptions] = useState<QuestionOption[] | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const handleUpdateOptionField = (
    index: number,
    field: keyof QuestionOption,
    value: any
  ) => {
    const updated = options.map((opt, i) =>
      i === index ? { ...opt, [field]: value } : opt
    );
    onOptionsChange(updated);
  };

  const handleGenerateAiDistractors = async () => {
    setIsGeneratingAi(true);
    setAiNotice(null);
    setPreviousOptions([...options]);

    try {
      if (questionId) {
        const regenerated = await regenerateDraftComponent(questionId, {
          component: "distractors",
        });
        if (regenerated.options && regenerated.options.length > 0) {
          onOptionsChange(regenerated.options);
          setAiNotice("Distracteurs et rationales régénérés par l'IA avec succès.");
          return;
        }
      }

      // Client-side heuristic generator fallback (for new or unsaved drafts)
      const correctOpt = options.find((o) => o.is_correct) || options[0];
      const correctContent = correctOpt?.content || "Réponse valide";
      const subjectSnippet = (questionPrompt || stimulusText || correctContent).slice(0, 40);

      const generatedDistractors: QuestionOption[] = [
        {
          content: `Une déduction hâtive relative à ${subjectSnippet}`,
          is_correct: false,
          order_index: 1,
          misconception_type: "overgeneralization",
          distractor_rationale: `Piège basé sur une généralisation abusive en contraste avec : "${correctContent}".`,
          explanation: "Incorrect : le document nuance explicitement cette affirmation.",
        },
        {
          content: `Une interprétation en contradiction directe avec le document`,
          is_correct: false,
          order_index: 2,
          misconception_type: "contradiction",
          distractor_rationale: "Affirme l'exact inverse de l'information donnée dans le document support.",
          explanation: "Incorrect : contredit les faits énoncés.",
        },
        {
          content: `Une information plausible mais non mentionnée`,
          is_correct: false,
          order_index: 3,
          misconception_type: "extrapolation",
          distractor_rationale: "Fait appel aux connaissances générales du candidat sans être attestée dans le texte.",
          explanation: "Incorrect : le texte ne mentionne aucunement cet élément.",
        },
      ];

      const mergedOptions: QuestionOption[] = [
        {
          ...correctOpt,
          order_index: 0,
          is_correct: true,
          explanation: correctOpt?.explanation || "Bonne réponse conforme au document.",
        },
        ...generatedDistractors,
      ];

      onOptionsChange(mergedOptions);
      setAiNotice("Distracteurs didactiques générés. Vous pouvez annuler l'action ci-dessous.");
    } catch (e: any) {
      console.error("AI Distractor generation error:", e);
      setAiNotice(e.message || "Erreur lors de la génération IA.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleUndoAiGeneration = () => {
    if (previousOptions) {
      onOptionsChange(previousOptions);
      setPreviousOptions(null);
      setAiNotice("Modifications IA annulées.");
    }
  };
  // 1. Single / Multiple Choice Handlers
  const handleOptionContentChange = (index: number, content: string) => {
    const updated = options.map((opt, i) => (i === index ? { ...opt, content } : opt));
    onOptionsChange(updated);
  };

  const handleToggleCorrect = (index: number) => {
    if (responseType === "single_choice") {
      const updated = options.map((opt, i) => ({
        ...opt,
        is_correct: i === index,
      }));
      onOptionsChange(updated);
    } else {
      const updated = options.map((opt, i) =>
        i === index ? { ...opt, is_correct: !opt.is_correct } : opt
      );
      onOptionsChange(updated);
    }
  };

  const handleAddOption = () => {
    const nextIdx = options.length;
    onOptionsChange([
      ...options,
      {
        content: `Option ${String.fromCharCode(65 + nextIdx)}`,
        is_correct: options.length === 0,
        order_index: nextIdx,
        explanation: "",
      },
    ]);
  };

  const handleRemoveOption = (index: number) => {
    const filtered = options.filter((_, i) => i !== index);
    const reindexed = filtered.map((opt, i) => ({ ...opt, order_index: i }));
    onOptionsChange(reindexed);
  };

  // 2. Matching Handlers
  const rawPairs = scoringPayload?.pairs || [];
  const matchingPairs: Array<{ left: string; right: string }> = Array.isArray(rawPairs)
    ? rawPairs.map((p: any) => ({
        left: p.left || p.left_text || p.source_id || "",
        right: p.right || p.right_text || p.target_id || "",
      }))
    : Object.entries(rawPairs).map(([k, v]) => ({ left: k, right: String(v) }));

  const updateMatchingPairs = (nextPairs: Array<{ left: string; right: string }>) => {
    const formatted = nextPairs.map((p) => ({
      left: p.left,
      right: p.right,
      source_id: p.left,
      target_id: p.right,
      left_text: p.left,
      right_text: p.right,
    }));
    onScoringPayloadChange({ ...scoringPayload, pairs: formatted });
    // Keep options array in sync for backward compatibility
    onOptionsChange(
      nextPairs.map((p, idx) => ({
        content: `${p.left} -> ${p.right}`,
        is_correct: true,
        order_index: idx,
      }))
    );
  };

  const handleAddPair = () => {
    const idx = matchingPairs.length + 1;
    updateMatchingPairs([
      ...matchingPairs,
      { left: `Élément ${idx}`, right: `Correspondance ${idx}` },
    ]);
  };

  const handleRemovePair = (index: number) => {
    updateMatchingPairs(matchingPairs.filter((_, i) => i !== index));
  };

  const handlePairChange = (index: number, field: "left" | "right", val: string) => {
    const updated = matchingPairs.map((p, i) => (i === index ? { ...p, [field]: val } : p));
    updateMatchingPairs(updated);
  };

  // 3. Ordering Handlers
  const sequence: string[] = scoringPayload?.sequence || options.map((o) => o.content);

  const updateSequence = (nextSeq: string[]) => {
    onScoringPayloadChange({ ...scoringPayload, sequence: nextSeq });
    onOptionsChange(
      nextSeq.map((cnt, i) => ({
        content: cnt,
        is_correct: true,
        order_index: i,
      }))
    );
  };

  const handleAddSequenceItem = () => {
    updateSequence([...sequence, `Étape ${sequence.length + 1}`]);
  };

  const handleRemoveSequenceItem = (index: number) => {
    updateSequence(sequence.filter((_, i) => i !== index));
  };

  const handleSequenceItemChange = (index: number, val: string) => {
    const nextSeq = sequence.map((it, i) => (i === index ? val : it));
    updateSequence(nextSeq);
  };

  // 4. Gap Fill / Short text
  const acceptedAnswers: string[] =
    scoringPayload?.accepted_answers || options.filter((o) => o.is_correct).map((o) => o.content);

  const updateAcceptedAnswers = (answers: string[]) => {
    onScoringPayloadChange({ ...scoringPayload, accepted_answers: answers });
    onOptionsChange(
      answers.map((ans, i) => ({
        content: ans,
        is_correct: true,
        order_index: i,
      }))
    );
  };

  const isGapFill =
    responseType === "gap_fill" ||
    responseType === "cloze" ||
    (Array.isArray(scoringPayload?.gaps) && scoringPayload.gaps.length > 0) ||
    (Array.isArray(options) && options.some((o) => /^\[\d+\]\s*/.test(o.content)));

  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            Configuration des réponses ({isGapFill ? "Texte à trous" : responseType})
          </h3>
          <p className="text-2xs text-muted-foreground">
            {isGapFill
              ? "Configurez les 4 propositions pour chaque lacune et désignez la bonne réponse."
              : responseType === "single_choice"
              ? "Précisez les choix de réponse et cochez l'unique bonne réponse."
              : responseType === "multiple_choice"
              ? "Précisez les choix et cochez toutes les réponses valides."
              : responseType === "matching"
              ? "Définissez les paires exactes à associer par le candidat."
              : responseType === "ordering"
              ? "Définissez la séquence ordonnée exacte attendue."
              : "Précisez la ou les réponses exactes tolérées."}
          </p>
        </div>

        {/* AI Distractor Generator and Undo Bar */}
        {(responseType === "single_choice" || responseType === "multiple_choice") && !isGapFill && (
          <div className="flex items-center gap-2">
            {previousOptions && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUndoAiGeneration}
                className="text-2xs h-8 gap-1.5 font-semibold text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Annuler IA
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateAiDistractors}
              disabled={disabled || isGeneratingAi}
              className="text-2xs h-8 gap-1.5 font-semibold border-primary/40 text-primary hover:bg-primary/5"
            >
              {isGeneratingAi ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Générer distracteurs & rationales par IA
            </Button>
          </div>
        )}
      </div>

      {aiNotice && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary flex items-center justify-between">
          <span>{aiNotice}</span>
          <button onClick={() => setAiNotice(null)} className="text-2xs font-bold hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Choice Options (Single / Multiple) */}
      {(responseType === "single_choice" || responseType === "multiple_choice") && !isGapFill && (
        <div className="space-y-3">
          <div className="space-y-2.5">
            {options.map((opt, idx) => {
              const isExpanded = expandedOptionIndex === idx;
              const hasDidacticInfo = !!(opt.misconception_type || opt.distractor_rationale);
              return (
                <div
                  key={idx}
                  className={`rounded-xl border transition ${
                    opt.is_correct
                      ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/10"
                      : "border-border/60 bg-background"
                  }`}
                >
                  <div className="flex items-center gap-2.5 p-2.5">
                    <button
                      type="button"
                      onClick={() => handleToggleCorrect(idx)}
                      disabled={disabled}
                      className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition font-bold text-xs ${
                        opt.is_correct
                          ? "bg-emerald-500 text-white shadow-xs"
                          : "border border-border text-muted-foreground hover:bg-muted"
                      }`}
                      title={opt.is_correct ? "Réponse correcte" : "Cliquer pour marquer comme correcte"}
                    >
                      {String.fromCharCode(65 + idx)}
                    </button>

                    <Input
                      value={opt.content}
                      onChange={(e) => handleOptionContentChange(idx, e.target.value)}
                      placeholder={`Contenu de l'option ${String.fromCharCode(65 + idx)}`}
                      disabled={disabled}
                      className="text-xs h-9 flex-1"
                    />

                    {/* Didactic Details Toggle Button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedOptionIndex(isExpanded ? null : idx)}
                      className={`h-8 px-2 text-2xs font-semibold gap-1 ${
                        hasDidacticInfo
                          ? "text-primary bg-primary/10 hover:bg-primary/20"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Éditer le type d'erreur, piège didactique et justification"
                    >
                      <span>Didactique</span>
                      {hasDidacticInfo && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveOption(idx)}
                      disabled={disabled || options.length <= 2}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                      title="Retirer cette option"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Expandable Didactic Drawer */}
                  {isExpanded && (
                    <div className="p-3.5 border-t border-border/50 bg-muted/20 space-y-3 rounded-b-xl text-xs">
                      {!opt.is_correct ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-2xs font-semibold text-foreground">
                              Typologie d'erreur didactique (Piège TEF)
                            </Label>
                            <select
                              value={opt.misconception_type || ""}
                              onChange={(e) =>
                                handleUpdateOptionField(
                                  idx,
                                  "misconception_type",
                                  e.target.value || null
                                )
                              }
                              disabled={disabled}
                              className="w-full rounded-md border border-border bg-background p-1.5 text-2xs font-medium text-foreground"
                            >
                              <option value="">-- Sélectionner le type de piège --</option>
                              {MISCONCEPTION_TYPES.map((m) => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-2xs font-semibold text-foreground">
                              Justification du piège (Distractor Rationale)
                            </Label>
                            <Input
                              value={opt.distractor_rationale || ""}
                              onChange={(e) =>
                                handleUpdateOptionField(
                                  idx,
                                  "distractor_rationale",
                                  e.target.value
                                )
                              }
                              placeholder="ex: Le candidat confond la cause et la conséquence..."
                              disabled={disabled}
                              className="text-2xs h-8"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-2xs font-bold text-emerald-600 dark:text-emerald-400">
                            ✓ Option définie comme réponse correcte
                          </span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label className="text-2xs font-semibold text-foreground">
                          Explication spécifique affichée au candidat lors de la correction
                        </Label>
                        <Input
                          value={opt.explanation || ""}
                          onChange={(e) =>
                            handleUpdateOptionField(idx, "explanation", e.target.value)
                          }
                          placeholder="ex: Faux : le paragraphe 2 précise explicitement l'inverse."
                          disabled={disabled}
                          className="text-2xs h-8"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddOption}
            disabled={disabled || options.length >= 6}
            className="text-xs h-8 gap-1.5 font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter une option
          </Button>
        </div>
      )}

      {/* Matching Editor */}
      {responseType === "matching" && (
        <div className="space-y-3">
          <div className="space-y-2.5">
            {matchingPairs.map((pair, idx) => (
              <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/70 bg-background">
                <span className="text-2xs font-mono font-bold text-muted-foreground w-6 text-center">
                  #{idx + 1}
                </span>
                <Input
                  value={pair.left}
                  onChange={(e) => handlePairChange(idx, "left", e.target.value)}
                  placeholder="Élément gauche (ex: Annonce 1)"
                  disabled={disabled}
                  className="text-xs h-8 flex-1"
                />
                <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                <Input
                  value={pair.right}
                  onChange={(e) => handlePairChange(idx, "right", e.target.value)}
                  placeholder="Correspondance droite (ex: Profil A)"
                  disabled={disabled}
                  className="text-xs h-8 flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemovePair(idx)}
                  disabled={disabled || matchingPairs.length <= 2}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddPair}
            disabled={disabled}
            className="text-xs h-8 gap-1.5 font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter une paire d'association
          </Button>
        </div>
      )}

      {/* Ordering Editor */}
      {responseType === "ordering" && (
        <div className="space-y-3">
          <div className="space-y-2.5">
            {sequence.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/70 bg-background">
                <span className="h-6 w-6 rounded-md bg-muted text-foreground flex items-center justify-center text-xs font-mono font-bold shrink-0">
                  {idx + 1}
                </span>
                <Input
                  value={item}
                  onChange={(e) => handleSequenceItemChange(idx, e.target.value)}
                  placeholder={`Étape ou segment chronologique ${idx + 1}`}
                  disabled={disabled}
                  className="text-xs h-8 flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveSequenceItem(idx)}
                  disabled={disabled || sequence.length <= 2}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddSequenceItem}
            disabled={disabled}
            className="text-xs h-8 gap-1.5 font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter un élément à la séquence
          </Button>
        </div>
      )}

      {/* Gap Fill Multi-Option Editor */}
      {isGapFill && (
        <GapFillEditor
          metadata={scoringPayload || {}}
          options={options}
          stimulusText={stimulusText}
          onChange={(newMeta, synthesizedOptions) => {
            onScoringPayloadChange(newMeta);
            if (synthesizedOptions) {
              onOptionsChange(synthesizedOptions);
            }
          }}
          disabled={disabled}
        />
      )}

      {/* Free Text Input (Non-Gap Fill) */}
      {!isGapFill && (responseType === "short_text" || responseType === "text_input") && (
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-foreground">
            Réponses correctes acceptées (mots exacts tolérés)
          </Label>
          <div className="space-y-2">
            {acceptedAnswers.map((ans, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <Input
                  value={ans}
                  onChange={(e) => {
                    const next = [...acceptedAnswers];
                    next[idx] = e.target.value;
                    updateAcceptedAnswers(next);
                  }}
                  placeholder="ex: soit"
                  disabled={disabled}
                  className="text-xs h-8 flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    updateAcceptedAnswers(acceptedAnswers.filter((_, i) => i !== idx));
                  }}
                  disabled={disabled || acceptedAnswers.length <= 1}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateAcceptedAnswers([...acceptedAnswers, ""])}
            disabled={disabled}
            className="text-xs h-8 gap-1.5 font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter une variante acceptée
          </Button>
        </div>
      )}
    </div>
  );
};
