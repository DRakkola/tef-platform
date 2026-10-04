import React, { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, ChevronDown, ChevronRight, ShieldAlert, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionOption, QuestionResponseType } from "../types";

interface OptionEditorProps {
  options: QuestionOption[];
  onChange: (options: QuestionOption[]) => void;
  responseType: QuestionResponseType;
  disabled?: boolean;
}

const COMMON_MISCONCEPTIONS = [
  { value: "lexical_distractor", label: "Piège lexical (mot clé présent sans rapport sémantique)" },
  { value: "over_generalization", label: "Sur-généralisation (conclusion trop large ou absolue)" },
  { value: "unwarranted_inference", label: "Inférence non fondée / extrapolation excessive" },
  { value: "partial_truth", label: "Vérité partielle (omission d'une condition essentielle)" },
  { value: "contrary_meaning", label: "Sens opposé / contresens direct" },
  { value: "register_confusion", label: "Confusion de registre de langue ou tonalité" },
  { value: "chronological_confusion", label: "Confusion chronologique ou causale" },
];

export const OptionEditor: React.FC<OptionEditorProps> = ({
  options,
  onChange,
  responseType,
  disabled = false,
}) => {
  const [expandedDiagnostics, setExpandedDiagnostics] = useState<Record<number, boolean>>({});
  const isSingle = responseType === "single_choice";

  const handleAddOption = () => {
    const nextOrder = options.length;
    onChange([
      ...options,
      {
        content: `Option ${String.fromCharCode(65 + nextOrder)}`,
        order_index: nextOrder,
        is_correct: options.length === 0,
        explanation: "",
        misconception_type: "",
        distractor_rationale: "",
      },
    ]);
  };

  const handleRemoveOption = (index: number) => {
    const updated = options.filter((_, idx) => idx !== index).map((opt, idx) => ({
      ...opt,
      order_index: idx,
    }));
    onChange(updated);
  };

  const handleToggleCorrect = (index: number) => {
    if (disabled) return;
    if (isSingle) {
      const updated = options.map((opt, idx) => ({
        ...opt,
        is_correct: idx === index,
      }));
      onChange(updated);
    } else {
      const updated = options.map((opt, idx) =>
        idx === index ? { ...opt, is_correct: !opt.is_correct } : opt
      );
      onChange(updated);
    }
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= options.length) return;
    const next = [...options];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next.map((opt, idx) => ({ ...opt, order_index: idx })));
  };

  const handleFieldChange = (index: number, field: keyof QuestionOption, value: any) => {
    const updated = options.map((opt, idx) =>
      idx === index ? { ...opt, [field]: value } : opt
    );
    onChange(updated);
  };

  const toggleDiagnostic = (index: number) => {
    setExpandedDiagnostics((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
            Options de réponse ({options.length})
            <span className="text-2xs font-normal text-muted-foreground">
              {isSingle ? "Choix unique — une seule réponse correcte" : "Choix multiple — plusieurs réponses correctes possibles"}
            </span>
          </h4>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddOption}
          disabled={disabled}
          className="h-7 text-xs gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter une option
        </Button>
      </div>

      {options.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-border rounded-lg text-xs text-muted-foreground">
          Aucune option configurée. Cliquez sur "Ajouter une option" ci-dessus.
        </div>
      ) : (
        <div className="space-y-3">
          {options.map((opt, idx) => {
            const isDiagOpen = !!expandedDiagnostics[idx];
            return (
              <div
                key={idx}
                className={`p-3 rounded-lg border transition space-y-2 text-xs ${
                  opt.is_correct
                    ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/15"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Correct Toggle Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleCorrect(idx)}
                    disabled={disabled}
                    className={`mt-1 shrink-0 h-5 w-5 rounded flex items-center justify-center border transition ${
                      isSingle ? "rounded-full" : "rounded-md"
                    } ${
                      opt.is_correct
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                        : "border-border bg-background hover:border-emerald-500/50"
                    }`}
                    title={opt.is_correct ? "Marquée correcte" : "Cliquer pour marquer correcte"}
                  >
                    {opt.is_correct && <Check className="h-3 w-3 stroke-[3]" />}
                  </button>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-muted-foreground text-xs">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <Input
                        value={opt.content}
                        onChange={(e) => handleFieldChange(idx, "content", e.target.value)}
                        placeholder={`Texte de l'option ${String.fromCharCode(65 + idx)}`}
                        disabled={disabled}
                        className="h-8 text-xs font-medium"
                      />
                    </div>

                    {/* Diagnostic toggle trigger */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => toggleDiagnostic(idx)}
                        className="text-2xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition"
                      >
                        {isDiagOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {opt.is_correct ? "Explication de la réponse correcte" : "Diagnostic du piège / distracteur"}
                        {(opt.misconception_type || opt.distractor_rationale || opt.explanation) && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </button>
                    </div>

                    {/* Collapsible Diagnostic & Distractor Details */}
                    {isDiagOpen && (
                      <div className="mt-2 p-2.5 rounded-md border border-border/80 bg-muted/40 space-y-2 text-2xs">
                        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          <span>Métadonnées diagnostiques pédagogiques (strictement invisibles aux candidats)</span>
                        </div>

                        {!opt.is_correct && (
                          <div>
                            <label className="block text-muted-foreground font-medium mb-1">
                              Type de piège cognitif / conception erronée
                            </label>
                            <select
                              value={opt.misconception_type || ""}
                              onChange={(e) => handleFieldChange(idx, "misconception_type", e.target.value)}
                              disabled={disabled}
                              className="w-full rounded border border-border bg-background p-1 text-2xs text-foreground"
                            >
                              <option value="">-- Aucun piège spécifié --</option>
                              {COMMON_MISCONCEPTIONS.map((m) => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {!opt.is_correct && (
                          <div>
                            <label className="block text-muted-foreground font-medium mb-1">
                              Raison d'invalidité du distracteur (pourquoi c'est faux)
                            </label>
                            <Input
                              value={opt.distractor_rationale || ""}
                              onChange={(e) => handleFieldChange(idx, "distractor_rationale", e.target.value)}
                              placeholder="ex. Le texte mentionne une baisse de prix, pas une hausse..."
                              disabled={disabled}
                              className="h-7 text-2xs"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-muted-foreground font-medium mb-1">
                            Explication didactique complémentaire
                          </label>
                          <Textarea
                            rows={2}
                            value={opt.explanation || ""}
                            onChange={(e) => handleFieldChange(idx, "explanation", e.target.value)}
                            placeholder="Analyse détaillée de l'option..."
                            disabled={disabled}
                            className="text-2xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions: Reorder and Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(idx, "up")}
                      disabled={disabled || idx === 0}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      title="Monter"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(idx, "down")}
                      disabled={disabled || idx === options.length - 1}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      title="Descendre"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      disabled={disabled || options.length <= 2}
                      className="p-1 text-rose-500 hover:text-rose-700 disabled:opacity-30"
                      title="Supprimer l'option"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
