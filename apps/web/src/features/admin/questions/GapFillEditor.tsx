import React, { useState } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ListOrdered,
  Type,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionOption } from "../types";
import { renderHighlightedGapText } from "./components/StimulusRenderer";

export interface GapChoiceOption {
  content: string;
  is_correct: boolean;
  order_index?: number;
  misconception_type?: string;
  distractor_rationale?: string;
  explanation?: string;
}

export interface GapItem {
  gap_id: string;
  cue_text?: string;
  mode?: "choices" | "text";
  options: GapChoiceOption[];
  expected_answers?: string[];
  case_sensitive?: boolean;
}

interface GapFillEditorProps {
  metadata: Record<string, any>;
  options?: QuestionOption[];
  stimulusText?: string;
  onChange: (metadata: Record<string, any>, synthesizedOptions?: QuestionOption[]) => void;
  disabled?: boolean;
}

const COMMON_MISCONCEPTIONS = [
  { value: "overgeneralization", label: "Sur-généralisation / Conclusion trop large" },
  { value: "false_friend", label: "Piège lexical ou phonétique / Faux-ami" },
  { value: "contradiction", label: "Contradiction directe / Contresens" },
  { value: "extrapolation", label: "Extrapolation / Information non mentionnée" },
  { value: "literal_interpretation", label: "Interprétation trop littérale" },
  { value: "incomplete_comprehension", label: "Compréhension partielle d'un détail" },
  { value: "content_mismatch", label: "Non-concordance documentaire / Mauvais champ" },
  { value: "morphosyntax", label: "Erreur morphosyntaxique ou accord agrammatical" },
  { value: "collocations", label: "Incompatibilité de collocation ou registre" },
];

const DEFAULT_OPTIONS = (): GapChoiceOption[] => [
  { content: "", is_correct: true, order_index: 0 },
  { content: "", is_correct: false, order_index: 1, misconception_type: "contradiction", distractor_rationale: "" },
  { content: "", is_correct: false, order_index: 2, misconception_type: "false_friend", distractor_rationale: "" },
  { content: "", is_correct: false, order_index: 3, misconception_type: "morphosyntax", distractor_rationale: "" },
];

export function synthesizeGapOptions(gaps: GapItem[]): QuestionOption[] {
  const result: QuestionOption[] = [];
  let order = 0;
  for (const gap of gaps) {
    if (gap.mode === "choices" && Array.isArray(gap.options)) {
      for (const opt of gap.options) {
        result.push({
          content: `[${gap.gap_id}] ${opt.content}`,
          is_correct: !!opt.is_correct,
          order_index: order++,
          explanation: opt.explanation || undefined,
          distractor_rationale: opt.distractor_rationale || undefined,
          misconception_type: opt.misconception_type || undefined,
        });
      }
    }
  }
  return result;
}

export const GapFillEditor: React.FC<GapFillEditorProps> = ({
  metadata,
  options,
  stimulusText,
  onChange,
  disabled = false,
}) => {
  const [expandedDiagnostics, setExpandedDiagnostics] = useState<Record<string, boolean>>({});

  // Initialize gaps from metadata.gaps, or options, or legacy metadata.blanks
  const gaps: GapItem[] = React.useMemo(() => {
    if (Array.isArray(metadata.gaps) && metadata.gaps.length > 0) {
      return metadata.gaps.map((g: any, idx: number) => ({
        gap_id: String(g.gap_id || g.id || idx + 1),
        cue_text: g.cue_text || "",
        mode: g.options && g.options.length > 0 ? "choices" : (g.mode || "choices"),
        options: (g.options && g.options.length > 0)
          ? g.options
          : DEFAULT_OPTIONS(),
        expected_answers: g.expected_answers || [],
        case_sensitive: !!g.case_sensitive,
      }));
    }

    if (Array.isArray(options) && options.length > 0) {
      const hasPrefix = options.some((o) => /^\[\d+\]\s*/.test(o.content));
      if (hasPrefix) {
        const grouped: Record<string, GapItem> = {};
        options.forEach((opt, idx) => {
          const match = opt.content.match(/^\[(\d+)\]\s*(.*)/);
          const gapId = match ? match[1] : "1";
          const content = match ? match[2] : opt.content;
          if (!grouped[gapId]) {
            grouped[gapId] = {
              gap_id: gapId,
              cue_text: "",
              mode: "choices",
              options: [],
              expected_answers: [],
              case_sensitive: false,
            };
          }
          grouped[gapId].options.push({
            content,
            is_correct: !!opt.is_correct,
            order_index: opt.order_index ?? idx,
            explanation: opt.explanation || undefined,
            distractor_rationale: opt.distractor_rationale || undefined,
            misconception_type: opt.misconception_type || undefined,
          });
        });
        return Object.values(grouped);
      }
    }

    if (Array.isArray(metadata.blanks) && metadata.blanks.length > 0) {
      return metadata.blanks.map((b: any, idx: number) => ({
        gap_id: String(b.id || idx + 1),
        cue_text: "",
        mode: "text" as const,
        options: DEFAULT_OPTIONS(),
        expected_answers: b.expected_answers || [""],
        case_sensitive: !!b.case_sensitive,
      }));
    }

    // Default: 2 gaps in choice mode
    return [
      {
        gap_id: "1",
        cue_text: "Connecteur logique",
        mode: "choices",
        options: [
          { content: "Cependant", is_correct: true, order_index: 0, explanation: "Exprime la restriction." },
          { content: "De plus", is_correct: false, order_index: 1, misconception_type: "contradiction", distractor_rationale: "Exprime une addition au lieu d'une opposition." },
          { content: "En fait", is_correct: false, order_index: 2, misconception_type: "false_friend", distractor_rationale: "Sens inadapté." },
          { content: "Puisque", is_correct: false, order_index: 3, misconception_type: "morphosyntax", distractor_rationale: "Exige une proposition subordonnée." },
        ],
        expected_answers: [],
        case_sensitive: false,
      },
      {
        gap_id: "2",
        cue_text: "Précision lexicale",
        mode: "choices",
        options: [
          { content: "stabiliser", is_correct: true, order_index: 0, explanation: "Collocation adéquate." },
          { content: "aggraver", is_correct: false, order_index: 1, misconception_type: "contradiction", distractor_rationale: "Contredit la visée positive." },
          { content: "ignorer", is_correct: false, order_index: 2, misconception_type: "literal_interpretation", distractor_rationale: "Incompatible avec le contexte." },
          { content: "provoquer", is_correct: false, order_index: 3, misconception_type: "false_friend", distractor_rationale: "Sens fautif." },
        ],
        expected_answers: [],
        case_sensitive: false,
      },
    ];
  }, [metadata.gaps, metadata.blanks, options]);

  const templateText: string =
    stimulusText ||
    metadata.template_text ||
    "Le projet avance bien. [1], certains retards subsistent. Nous espérons [2] la situation rapidement.";

  const updateMetadata = (updatedGaps: GapItem[], updatedText?: string) => {
    // Generate backwards-compatible blanks representation
    const blanks = updatedGaps.map((g) => ({
      id: g.gap_id,
      expected_answers:
        g.mode === "choices"
          ? g.options.filter((o) => o.is_correct).map((o) => o.content)
          : (g.expected_answers || []),
      case_sensitive: g.case_sensitive,
    }));

    const nextMeta = {
      ...metadata,
      template_text: updatedText !== undefined ? updatedText : templateText,
      gaps: updatedGaps,
      blanks,
    };

    const synthesized = synthesizeGapOptions(updatedGaps);
    onChange(nextMeta, synthesized);
  };

  const handleAddGap = () => {
    const nextId = String(gaps.length + 1);
    const newGap: GapItem = {
      gap_id: nextId,
      cue_text: "",
      mode: "choices",
      options: DEFAULT_OPTIONS(),
      expected_answers: [],
      case_sensitive: false,
    };
    updateMetadata([...gaps, newGap]);
  };

  const handleRemoveGap = (index: number) => {
    if (gaps.length <= 1) return;
    const next = gaps.filter((_, i) => i !== index);
    updateMetadata(next);
  };

  const handleToggleMode = (index: number) => {
    const next = gaps.map((g, i) => {
      if (i !== index) return g;
      const newMode = g.mode === "choices" ? "text" : "choices";
      return { ...g, mode: newMode as "choices" | "text" };
    });
    updateMetadata(next);
  };

  const handleSelectCorrectOption = (gapIdx: number, optIdx: number) => {
    if (disabled) return;
    const next = gaps.map((g, i) => {
      if (i !== gapIdx) return g;
      const newOpts = g.options.map((opt, j) => ({
        ...opt,
        is_correct: j === optIdx,
      }));
      return { ...g, options: newOpts };
    });
    updateMetadata(next);
  };

  const handleOptionChange = (gapIdx: number, optIdx: number, field: keyof GapChoiceOption, value: any) => {
    const next = gaps.map((g, i) => {
      if (i !== gapIdx) return g;
      const newOpts = g.options.map((opt, j) => {
        if (j !== optIdx) return opt;
        return { ...opt, [field]: value };
      });
      return { ...g, options: newOpts };
    });
    updateMetadata(next);
  };

  const handleAddOptionToGap = (gapIdx: number) => {
    if (disabled) return;
    const next = gaps.map((g, i) => {
      if (i !== gapIdx) return g;
      const nextIdx = g.options.length;
      const newOpt: GapChoiceOption = {
        content: "",
        is_correct: false,
        order_index: nextIdx,
      };
      return { ...g, options: [...g.options, newOpt] };
    });
    updateMetadata(next);
  };

  const handleRemoveOptionFromGap = (gapIdx: number, optIdx: number) => {
    if (disabled) return;
    const next = gaps.map((g, i) => {
      if (i !== gapIdx) return g;
      if (g.options.length <= 2) return g;
      const filtered = g.options.filter((_, j) => j !== optIdx);
      const hasCorrect = filtered.some((o) => o.is_correct);
      if (!hasCorrect && filtered.length > 0) {
        filtered[0].is_correct = true;
      }
      return { ...g, options: filtered };
    });
    updateMetadata(next);
  };

  const handleTextAnswersChange = (gapIdx: number, rawVal: string) => {
    const answers = rawVal.split(",").map((s) => s.trim()).filter(Boolean);
    const next = gaps.map((g, i) => (i === gapIdx ? { ...g, expected_answers: answers } : g));
    updateMetadata(next);
  };

  const toggleDiagnostic = (gapId: string, optIdx: number) => {
    const key = `${gapId}_${optIdx}`;
    setExpandedDiagnostics((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-5">
      {stimulusText ? (
        <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Passage de référence (issu du stimulus associé)
            </h4>
            <span className="text-2xs text-muted-foreground font-mono">
              Synchronisé avec le document support
            </span>
          </div>
          <div className="text-xs text-foreground/90 leading-relaxed font-serif bg-card p-3 rounded-lg border border-border shadow-2xs whitespace-pre-wrap">
            {renderHighlightedGapText(stimulusText)}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-semibold text-foreground">
              Texte à trous / Modèle de passage
            </h4>
            <span className="text-2xs text-muted-foreground">
              Marqueurs reconnus : <code>[1]</code>, <code>[2]</code> ou <code>__________ (1)</code>
            </span>
          </div>
          <Textarea
            rows={3}
            value={templateText}
            onChange={(e) => updateMetadata(gaps, e.target.value)}
            placeholder="ex. Paul s'est rendu au [1] pour y rencontrer [2]."
            disabled={disabled}
            className="text-xs font-mono"
          />
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
              Configuration des lacunes ({gaps.length})
              <span className="text-2xs font-normal text-muted-foreground">
                Question indivisible — notation proportionnelle
              </span>
            </h4>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddGap}
            disabled={disabled}
            className="h-7 text-xs gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter un trou
          </Button>
        </div>

        {gaps.map((gap, gapIdx) => {
          const isChoices = gap.mode !== "text";

          return (
            <div
              key={gap.gap_id || gapIdx}
              className="p-3.5 rounded-xl border border-border bg-card space-y-3 shadow-xs"
            >
              {/* Gap Card Header */}
              <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-2.5">
                <div className="flex items-center gap-2 flex-1">
                  <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                    Trou [{gap.gap_id}]
                  </span>
                  <Input
                    value={gap.cue_text || ""}
                    onChange={(e) => {
                      const next = gaps.map((g, i) => (i === gapIdx ? { ...g, cue_text: e.target.value } : g));
                      updateMetadata(next);
                    }}
                    placeholder="Description / Type linguistique (ex: Connecteur d'opposition)"
                    disabled={disabled}
                    className="h-7 text-xs flex-1 max-w-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleMode(gapIdx)}
                    disabled={disabled}
                    className="h-7 text-2xs gap-1 text-muted-foreground hover:text-foreground"
                    title="Basculer entre QCM 4 options et saisie libre"
                  >
                    {isChoices ? (
                      <>
                        <ListOrdered className="h-3 w-3 text-primary" /> Mode 4 Choix (TEF)
                      </>
                    ) : (
                      <>
                        <Type className="h-3 w-3 text-indigo-500" /> Mode Saisie libre
                      </>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => handleRemoveGap(gapIdx)}
                    disabled={disabled || gaps.length <= 1}
                    className="p-1.5 text-rose-500 hover:text-rose-700 disabled:opacity-20 transition"
                    title="Supprimer ce trou"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Gap Content: Choice Mode (TEF Standard) */}
              {isChoices ? (
                <div className="space-y-2 pt-1">
                  <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Options de réponse (Sélectionnez la bonne réponse)
                  </span>

                  <div className="space-y-2">
                    {gap.options.map((opt, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      const diagKey = `${gap.gap_id}_${optIdx}`;
                      const isExpanded = !!expandedDiagnostics[diagKey];

                      return (
                        <div
                          key={optIdx}
                          className={`p-2.5 rounded-lg border transition ${
                            opt.is_correct
                              ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                              : "border-border bg-background"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {/* Correct Radio */}
                            <label className="cursor-pointer flex items-center">
                              <input
                                type="radio"
                                name={`correct_gap_${gap.gap_id}`}
                                checked={opt.is_correct}
                                onChange={() => handleSelectCorrectOption(gapIdx, optIdx)}
                                disabled={disabled}
                                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-border"
                              />
                            </label>

                            {/* Letter Label */}
                            <span className="font-mono text-xs font-bold text-muted-foreground w-4 text-center">
                              {letter}.
                            </span>

                            {/* Option Text Input */}
                            <Input
                              value={opt.content}
                              onChange={(e) => handleOptionChange(gapIdx, optIdx, "content", e.target.value)}
                              placeholder={`Proposition ${letter}...`}
                              disabled={disabled}
                              className="h-8 text-xs flex-1"
                            />

                            {/* Expand Diagnostics Button for Distractor */}
                            {!opt.is_correct && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleDiagnostic(gap.gap_id, optIdx)}
                                className={`h-8 px-2 text-2xs gap-1 ${
                                  opt.misconception_type
                                    ? "text-amber-700 dark:text-amber-400 bg-amber-500/10"
                                    : "text-muted-foreground"
                                }`}
                                title="Analyse didactique du piège"
                              >
                                <ShieldAlert className="h-3 w-3" />
                                {opt.misconception_type ? "Piège qualifié" : "Piège ?"}
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              </Button>
                            )}

                            {/* Remove Option Button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveOptionFromGap(gapIdx, optIdx)}
                              disabled={disabled || gap.options.length <= 2}
                              className="p-1 text-muted-foreground hover:text-rose-500 disabled:opacity-20 transition"
                              title="Supprimer cette proposition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Collapsible Distractor Diagnostics */}
                          {!opt.is_correct && isExpanded && (
                            <div className="mt-2.5 pt-2.5 border-t border-border/60 pl-8 space-y-2 bg-muted/20 p-2 rounded-md">
                              <div>
                                <label className="text-2xs font-semibold text-muted-foreground mb-1 block">
                                  Catégorie du piège cognitif / didactique
                                </label>
                                <select
                                  value={opt.misconception_type || ""}
                                  onChange={(e) => handleOptionChange(gapIdx, optIdx, "misconception_type", e.target.value)}
                                  disabled={disabled}
                                  className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs"
                                >
                                  <option value="">-- Sélectionner un piège canonique TEF --</option>
                                  {COMMON_MISCONCEPTIONS.map((m) => (
                                    <option key={m.value} value={m.value}>
                                      {m.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-2xs font-semibold text-muted-foreground mb-1 block">
                                  Justification spécifique du distracteur
                                </label>
                                <Input
                                  value={opt.distractor_rationale || ""}
                                  onChange={(e) => handleOptionChange(gapIdx, optIdx, "distractor_rationale", e.target.value)}
                                  placeholder="Expliquez précisément en quoi cette option induit le candidat en erreur..."
                                  disabled={disabled}
                                  className="h-7 text-xs"
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
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAddOptionToGap(gapIdx)}
                    disabled={disabled}
                    className="h-7 text-2xs gap-1 text-muted-foreground hover:text-foreground mt-1"
                  >
                    <Plus className="h-3 w-3" /> Ajouter une proposition
                  </Button>
                </div>
              ) : (
                /* Gap Content: Free Text Input Mode */
                <div className="space-y-2 pt-1">
                  <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Réponses acceptées (séparées par une virgule)
                  </span>
                  <div className="flex items-center gap-3">
                    <Input
                      value={(gap.expected_answers || []).join(", ")}
                      onChange={(e) => handleTextAnswersChange(gapIdx, e.target.value)}
                      placeholder="ex. rapidement, vite, sans tarder"
                      disabled={disabled}
                      className="h-8 text-xs flex-1"
                    />
                    <label className="flex items-center gap-1.5 text-2xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!gap.case_sensitive}
                        onChange={(e) => {
                          const next = gaps.map((g, i) => (i === gapIdx ? { ...g, case_sensitive: e.target.checked } : g));
                          updateMetadata(next);
                        }}
                        disabled={disabled}
                        className="rounded border-border"
                      />
                      Casse exacte
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
