import React from "react";
import { GitBranch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SkillsHeaderProps {
  totalCount: number;
  onNewSkill: () => void;
}

export const SkillsHeader: React.FC<SkillsHeaderProps> = ({ totalCount, onNewSkill }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/70 pb-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Compétences
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                {totalCount}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Référentiel taxonomique des compétences et micro-compétences linguistiques TEF Canada & IRN.
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
