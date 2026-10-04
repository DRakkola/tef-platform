import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface BlankItem {
  id: string;
  expected_answers: string[];
  case_sensitive?: boolean;
}

interface GapFillEditorProps {
  metadata: Record<string, any>;
  onChange: (metadata: Record<string, any>) => void;
  disabled?: boolean;
}

export const GapFillEditor: React.FC<GapFillEditorProps> = ({
  metadata,
  onChange,
  disabled = false,
}) => {
  const blanks: BlankItem[] = metadata.blanks || [
    { id: "1", expected_answers: ["rapidement"], case_sensitive: false },
  ];
  const templateText: string = metadata.template_text || "Les transports en commun permettent de se déplacer [blank:1] en ville.";

  const updateMetadata = (partial: Partial<typeof metadata>) => {
    onChange({
      ...metadata,
      ...partial,
    });
  };

  const handleAddBlank = () => {
    const nextId = String(blanks.length + 1);
    updateMetadata({
      blanks: [...blanks, { id: nextId, expected_answers: [""], case_sensitive: false }],
    });
  };

  const handleRemoveBlank = (index: number) => {
    updateMetadata({
      blanks: blanks.filter((_, i) => i !== index),
    });
  };

  const handleAnswersChange = (index: number, rawVal: string) => {
    const answers = rawVal.split(",").map((s) => s.trim()).filter(Boolean);
    const next = blanks.map((b, i) => (i === index ? { ...b, expected_answers: answers } : b));
    updateMetadata({ blanks: next });
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-semibold text-foreground mb-1">
          Texte à trous (avec balises [blank:N])
        </h4>
        <p className="text-2xs text-muted-foreground mb-2">
          Insérez des repères de blanc dans le texte comme <code>[blank:1]</code>, <code>[blank:2]</code>.
        </p>
        <Textarea
          rows={3}
          value={templateText}
          onChange={(e) => updateMetadata({ template_text: e.target.value })}
          placeholder="ex. Paul est allé au [blank:1] pour acheter des [blank:2]."
          disabled={disabled}
          className="text-xs font-mono"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Réponses attendues par trou ({blanks.length})
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddBlank}
            disabled={disabled}
            className="h-6 text-2xs gap-1"
          >
            <Plus className="h-3 w-3" /> Ajouter un trou
          </Button>
        </div>

        {blanks.map((b, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card text-xs"
          >
            <span className="font-mono text-2xs font-bold text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
              [blank:{b.id}]
            </span>
            <Input
              value={b.expected_answers.join(", ")}
              onChange={(e) => handleAnswersChange(idx, e.target.value)}
              placeholder="Réponses acceptées (séparées par une virgule)"
              disabled={disabled}
              className="h-7 text-xs flex-1"
            />
            <label className="flex items-center gap-1 text-2xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!b.case_sensitive}
                onChange={(e) => {
                  const next = blanks.map((item, i) =>
                    i === idx ? { ...item, case_sensitive: e.target.checked } : item
                  );
                  updateMetadata({ blanks: next });
                }}
                disabled={disabled}
                className="rounded border-border"
              />
              Casse exacte
            </label>
            <button
              type="button"
              onClick={() => handleRemoveBlank(idx)}
              disabled={disabled || blanks.length <= 1}
              className="p-1 text-rose-500 hover:text-rose-700 disabled:opacity-30"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
