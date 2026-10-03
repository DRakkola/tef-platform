import React from "react";
import { FolderPlus, Edit2, Archive, ArchiveRestore, FolderTree, ArrowRight, Brain, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaxonomySkillDetail, TaxonomySkillSummary } from "../types";

interface SkillSubskillsProps {
  skill: TaxonomySkillDetail;
  onAddSubskill: () => void;
  onEditSubskill: (child: TaxonomySkillSummary) => void;
  onToggleChildStatus?: (child: TaxonomySkillSummary) => void;
  onSelectChild?: (childId: string) => void;
}

export const SkillSubskills: React.FC<SkillSubskillsProps> = ({
  skill,
  onAddSubskill,
  onEditSubskill,
  onToggleChildStatus,
  onSelectChild,
}) => {
  const children = skill.children || [];

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sous-compétences & Micro-objectifs ({children.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            Unités de compétence descendantes pour l'évaluation diagnostique précise et les recommandations.
          </p>
        </div>
        <Button
          onClick={onAddSubskill}
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <FolderPlus className="size-3.5" /> Ajouter une sous-compétence
        </Button>
      </div>

      {/* Subskills Data Table */}
      {children.length === 0 ? (
        <div className="text-center py-10 bg-card border border-border/80 rounded-xl space-y-2">
          <FolderTree className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="text-xs sm:text-sm font-medium text-foreground">
            Aucune sous-compétence rattachée
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Définissez des sous-compétences pour subdiviser cette compétence en micro-tâches évaluables.
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
                  <th className="px-4 py-3">Dimension</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {children.map((child) => {
                  const isReasoning = child.dimension === "reasoning";

                  return (
                    <tr key={child.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{child.name}</span>
                          {onSelectChild && (
                            <button
                              type="button"
                              onClick={() => onSelectChild(child.id)}
                              className="text-muted-foreground hover:text-primary transition p-0.5"
                              title="Inspecter cette sous-compétence"
                            >
                              <ArrowRight className="size-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          {child.code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                            isReasoning
                              ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20"
                              : "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20"
                          }`}
                        >
                          {isReasoning ? (
                            <>
                              <Brain className="size-2.5" /> Raisonnement
                            </>
                          ) : (
                            <>
                              <Languages className="size-2.5" /> Langue
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                            child.is_active
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {child.is_active ? "Active" : "Archivée"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onEditSubskill(child)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition cursor-pointer"
                            title="Modifier la sous-compétence"
                            aria-label={`Modifier ${child.name}`}
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          {onToggleChildStatus && (
                            <button
                              type="button"
                              onClick={() => onToggleChildStatus(child)}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition cursor-pointer"
                              title={child.is_active ? "Archiver" : "Réactiver"}
                              aria-label={child.is_active ? `Archiver ${child.name}` : `Réactiver ${child.name}`}
                            >
                              {child.is_active ? (
                                <Archive className="size-3.5" />
                              ) : (
                                <ArchiveRestore className="size-3.5 text-emerald-600" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
