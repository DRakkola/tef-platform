import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ShortTextEditorProps {
  metadata: Record<string, any>;
  onChange: (metadata: Record<string, any>) => void;
  disabled?: boolean;
}

export const ShortTextEditor: React.FC<ShortTextEditorProps> = ({
  metadata,
  onChange,
  disabled = false,
}) => {
  const acceptedAnswers: string[] = metadata.accepted_answers || [""];
  const caseSensitive: boolean = !!metadata.case_sensitive;
  const trimWhitespace: boolean = metadata.trim_whitespace !== false;

  const updateMetadata = (partial: Partial<typeof metadata>) => {
    onChange({
      ...metadata,
      ...partial,
    });
  };

  const handleAddAnswer = () => {
    updateMetadata({
      accepted_answers: [...acceptedAnswers, ""],
    });
  };

  const handleRemoveAnswer = (index: number) => {
    updateMetadata({
      accepted_answers: acceptedAnswers.filter((_, i) => i !== index),
    });
  };

  const handleAnswerChange = (index: number, val: string) => {
    const next = acceptedAnswers.map((ans, i) => (i === index ? val : ans));
    updateMetadata({ accepted_answers: next });
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-semibold text-foreground mb-1">
          Réponses courtes exactes et variantes acceptées
        </h4>
        <p className="text-2xs text-muted-foreground">
          Indiquez la réponse de référence ainsi que toute variante orthographique ou synonyme valide.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Variantes acceptées ({acceptedAnswers.length})
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddAnswer}
            disabled={disabled}
            className="h-6 text-2xs gap-1"
          >
            <Plus className="h-3 w-3" /> Ajouter une variante
          </Button>
        </div>

        {acceptedAnswers.map((ans, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="font-mono text-2xs font-semibold text-muted-foreground w-6">
              #{idx + 1}
            </span>
            <Input
              value={ans}
              onChange={(e) => handleAnswerChange(idx, e.target.value)}
              placeholder={idx === 0 ? "Réponse principale canonique" : "Variante alternative acceptée"}
              disabled={disabled}
              className="h-8 text-xs flex-1"
            />
            <button
              type="button"
              onClick={() => handleRemoveAnswer(idx)}
              disabled={disabled || acceptedAnswers.length <= 1}
              className="p-1 text-rose-500 hover:text-rose-700 disabled:opacity-30"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-6 pt-2 border-t border-border text-xs text-muted-foreground">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => updateMetadata({ case_sensitive: e.target.checked })}
            disabled={disabled}
            className="rounded border-border"
          />
          Sensible à la casse (majuscules / minuscules)
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={trimWhitespace}
            onChange={(e) => updateMetadata({ trim_whitespace: e.target.checked })}
            disabled={disabled}
            className="rounded border-border"
          />
          Ignorer les espaces superflus début/fin
        </label>
      </div>
    </div>
  );
};
