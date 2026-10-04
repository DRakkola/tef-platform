import React from "react";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface MatchingPair {
  left_id: string;
  left_text: string;
  right_id: string;
  right_text: string;
}

interface MatchingEditorProps {
  metadata: Record<string, any>;
  onChange: (metadata: Record<string, any>) => void;
  disabled?: boolean;
}

export const MatchingEditor: React.FC<MatchingEditorProps> = ({
  metadata,
  onChange,
  disabled = false,
}) => {
  const pairs: MatchingPair[] = metadata.pairs || [
    { left_id: "L1", left_text: "Énoncé A", right_id: "R1", right_text: "Correspondance 1" },
    { left_id: "L2", left_text: "Énoncé B", right_id: "R2", right_text: "Correspondance 2" },
  ];

  const updatePairs = (nextPairs: MatchingPair[]) => {
    onChange({
      ...metadata,
      pairs: nextPairs,
    });
  };

  const handleAddPair = () => {
    const idx = pairs.length + 1;
    updatePairs([
      ...pairs,
      {
        left_id: `L${idx}`,
        left_text: `Élément ${idx}`,
        right_id: `R${idx}`,
        right_text: `Correspondance ${idx}`,
      },
    ]);
  };

  const handleRemovePair = (index: number) => {
    updatePairs(pairs.filter((_, i) => i !== index));
  };

  const handlePairChange = (index: number, field: keyof MatchingPair, val: string) => {
    const updated = pairs.map((p, i) => (i === index ? { ...p, [field]: val } : p));
    updatePairs(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-foreground">
            Paires d'appariement ({pairs.length})
          </h4>
          <p className="text-2xs text-muted-foreground">
            Définissez les éléments sources (gauche) et leurs correspondances correctes (droite).
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddPair}
          disabled={disabled}
          className="h-7 text-xs gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter une paire
        </Button>
      </div>

      <div className="space-y-2">
        {pairs.map((pair, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card text-xs"
          >
            <div className="flex-1 flex items-center gap-2">
              <span className="font-mono text-2xs text-muted-foreground w-6">
                #{idx + 1}
              </span>
              <Input
                value={pair.left_text}
                onChange={(e) => handlePairChange(idx, "left_text", e.target.value)}
                placeholder="Élément gauche (ex. Titre / Idée)"
                disabled={disabled}
                className="h-8 text-xs flex-1"
              />
            </div>

            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

            <div className="flex-1">
              <Input
                value={pair.right_text}
                onChange={(e) => handlePairChange(idx, "right_text", e.target.value)}
                placeholder="Élément droit (ex. Paragraphe / Résumé)"
                disabled={disabled}
                className="h-8 text-xs flex-1"
              />
            </div>

            <button
              type="button"
              onClick={() => handleRemovePair(idx)}
              disabled={disabled || pairs.length <= 2}
              className="p-1 text-rose-500 hover:text-rose-700 disabled:opacity-30"
              title="Supprimer la paire"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
