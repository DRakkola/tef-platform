import React from "react";
import { GitBranch, Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaxonomyVersion } from "../types";

interface SkillsHeaderProps {
  totalCount: number;
  activeVersion?: TaxonomyVersion | null;
  onNewSkill: () => void;
}

export const SkillsHeader: React.FC<SkillsHeaderProps> = ({
  totalCount,
  activeVersion,
  onNewSkill,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/70 pb-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Référentiel des compétences
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                {totalCount}
              </span>
              {activeVersion && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
                  <Tag className="size-3" />
                  {activeVersion.version}
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Taxonomie multidimensionnelle V2 : séparation des compétences cognitives (raisonnement) et linguistiques (langue).
            </p>
          </div>
        </div>
      </div>

      <Button
        onClick={onNewSkill}
        size="sm"
        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
      >
        <Plus className="h-4 w-4" /> Nouvelle compétence
      </Button>
    </div>
  );
};
