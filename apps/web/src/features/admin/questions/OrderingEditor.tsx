import React from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface OrderingItem {
  id: string;
  content: string;
  target_position: number;
}

interface OrderingEditorProps {
  metadata: Record<string, any>;
  onChange: (metadata: Record<string, any>) => void;
  disabled?: boolean;
}

export const OrderingEditor: React.FC<OrderingEditorProps> = ({
  metadata,
  onChange,
  disabled = false,
}) => {
  const items: OrderingItem[] = metadata.items || [
    { id: "O1", content: "Première étape du processus", target_position: 1 },
    { id: "O2", content: "Deuxième étape du processus", target_position: 2 },
    { id: "O3", content: "Troisième étape du processus", target_position: 3 },
  ];

  const updateItems = (nextItems: OrderingItem[]) => {
    onChange({
      ...metadata,
      items: nextItems,
    });
  };

  const handleAddItem = () => {
    const idx = items.length + 1;
    updateItems([
      ...items,
      { id: `O${idx}`, content: `Élément ${idx}`, target_position: idx },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    const next = items
      .filter((_, i) => i !== index)
      .map((item, idx) => ({ ...item, target_position: idx + 1 }));
    updateItems(next);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    updateItems(next.map((item, idx) => ({ ...item, target_position: idx + 1 })));
  };

  const handleContentChange = (index: number, val: string) => {
    const next = items.map((item, i) => (i === index ? { ...item, content: val } : item));
    updateItems(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-foreground">
            Séquence ordonnée ({items.length} éléments)
          </h4>
          <p className="text-2xs text-muted-foreground">
            L'ordre affiché ci-dessous correspond à l'ordre chronologique ou logique exact attendu.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddItem}
          disabled={disabled}
          className="h-7 text-xs gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter un élément
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card text-xs"
          >
            <span className="font-mono font-bold text-xs bg-muted text-foreground px-2 py-1 rounded w-8 text-center">
              {idx + 1}
            </span>

            <Input
              value={item.content}
              onChange={(e) => handleContentChange(idx, e.target.value)}
              placeholder={`Contenu de l'élément étape ${idx + 1}`}
              disabled={disabled}
              className="h-8 text-xs flex-1"
            />

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
                disabled={disabled || idx === items.length - 1}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Descendre"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleRemoveItem(idx)}
                disabled={disabled || items.length <= 2}
                className="p-1 text-rose-500 hover:text-rose-700 disabled:opacity-30"
                title="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
