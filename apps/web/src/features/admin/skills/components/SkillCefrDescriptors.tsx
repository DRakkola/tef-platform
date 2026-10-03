import React from "react";
import { Plus, Edit2, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaxonomySkillDetail, SkillLevelDescriptor, CEFRBand } from "../types";

interface SkillCefrDescriptorsProps {
  skill: TaxonomySkillDetail;
  onEditDescriptor: (level: CEFRBand, current?: SkillLevelDescriptor) => void;
  onDeleteDescriptor: (level: CEFRBand) => void;
}

const CEFR_BANDS: CEFRBand[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const getBandColor = (band: CEFRBand) => {
  switch (band) {
    case "A1":
      return "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25";
    case "A2":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25";
    case "B1":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25";
    case "B2":
      return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25";
    case "C1":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25";
    case "C2":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

export const SkillCefrDescriptors: React.FC<SkillCefrDescriptorsProps> = ({
  skill,
  onEditDescriptor,
  onDeleteDescriptor,
}) => {
  const descriptorsMap = React.useMemo(() => {
    const map = new Map<CEFRBand, SkillLevelDescriptor>();
    for (const desc of skill.level_descriptors || []) {
      map.set(desc.level, desc);
    }
    return map;
  }, [skill.level_descriptors]);

  const definedCount = descriptorsMap.size;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Descripteurs de Compétence CECRL ({definedCount}/6)
          </h3>
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
            {definedCount === 6 ? "Étalonnage complet" : `${6 - definedCount} niveau(x) à étalonner`}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Définitions « Can-do » contextualisées et critères de preuve observables pour chaque palier CECRL (A1 à C2).
        </p>
      </div>

      <div className="space-y-3">
        {CEFR_BANDS.map((band) => {
          const descriptor = descriptorsMap.get(band);
          const isDefined = !!descriptor;

          return (
            <div
              key={band}
              className={`p-4 rounded-xl border transition shadow-2xs ${
                isDefined
                  ? "bg-card border-border/80"
                  : "bg-muted/20 border-dashed border-border/60 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`font-mono font-bold text-xs px-2.5 py-1 rounded-lg border ${getBandColor(
                      band
                    )}`}
                  >
                    {band}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      Palier CECRL {band}
                      {isDefined ? (
                        <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-normal italic">
                          (Non calibré)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant={isDefined ? "ghost" : "outline"}
                    size="sm"
                    onClick={() => onEditDescriptor(band, descriptor)}
                    className="h-7 text-xs gap-1 cursor-pointer"
                  >
                    {isDefined ? (
                      <>
                        <Edit2 className="size-3" /> Modifier
                      </>
                    ) : (
                      <>
                        <Plus className="size-3 text-primary" /> Définir
                      </>
                    )}
                  </Button>

                  {isDefined && (
                    <button
                      type="button"
                      onClick={() => onDeleteDescriptor(band)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition cursor-pointer"
                      title={`Supprimer le descripteur ${band}`}
                      aria-label={`Supprimer le descripteur ${band}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {isDefined && (
                <div className="mt-3 space-y-2 border-t border-border/60 pt-3 text-xs">
                  <div>
                    <div className="font-semibold text-muted-foreground text-[11px] mb-0.5">
                      Énoncé de compétence (« Can-do ») :
                    </div>
                    <p className="text-foreground leading-relaxed">
                      {descriptor.descriptor}
                    </p>
                  </div>

                  {descriptor.evidence_guidance && (
                    <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50 text-[11px]">
                      <span className="font-semibold text-muted-foreground">
                        Critères de preuve & observable :{" "}
                      </span>
                      <span className="text-foreground/90">
                        {descriptor.evidence_guidance}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
