import React from "react";
import { FolderPlus, Edit2, Trash2, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SubSkill } from "../types";

interface SkillSubskillsProps {
  subskills: SubSkill[];
  onAddSubskill: () => void;
  onEditSubskill: (sub: SubSkill) => void;
  onDeleteSubskill: (sub: SubSkill) => void;
}

export const SkillSubskills: React.FC<SkillSubskillsProps> = ({
  subskills,
  onAddSubskill,
  onEditSubskill,
  onDeleteSubskill,
}) => {
  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sous-compétences & Micro-objectifs ({subskills.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            Unités pédagogiques précises pour le diagnostic micro et le ciblage adaptatif.
          </p>
        </div>
        <Button
          onClick={onAddSubskill}
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 cursor-pointer"
        >
          <FolderPlus className="size-3.5" /> Ajouter une sous-compétence
        </Button>
      </div>

      {/* Subskills Data Table */}
      {subskills.length === 0 ? (
        <div className="text-center py-10 bg-card border border-border/80 rounded-xl space-y-2">
          <FolderTree className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="text-xs sm:text-sm font-medium text-foreground">
            Aucune sous-compétence rattachée
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Définissez des sous-compétences pour permettre l'étiquetage précis des questions et des exercices.
          </p>
          <Button
            onClick={onAddSubskill}
            variant="outline"
            size="sm"
            className="text-xs mt-2"
          >
            <FolderPlus className="size-3.5 mr-1 text-primary" /> Créer la première sous-compétence
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">Nom de la sous-compétence</th>
                  <th className="px-4 py-3">Code unique</th>
                  <th className="px-4 py-3">Description pédagogique</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {subskills.map((sub) => (
                  <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {sub.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                        {sub.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-md truncate">
                      {sub.description || <span className="italic text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEditSubskill(sub)}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition cursor-pointer"
                          title="Modifier la sous-compétence"
                          aria-label={`Modifier ${sub.name}`}
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSubskill(sub)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition cursor-pointer"
                          title="Supprimer la sous-compétence"
                          aria-label={`Supprimer ${sub.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
