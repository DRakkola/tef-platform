import React from "react";
import { ChevronRight } from "lucide-react";
import type { SkillItem } from "../types";

interface SkillNavigatorItemProps {
  skill: SkillItem;
  isSelected: boolean;
  onSelect: () => void;
}

const getCategoryColor = (cat: string) => {
  switch (cat) {
    case "reading":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
    case "listening":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
    case "writing":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
    case "speaking":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
    case "grammar":
      return "bg-primary/10 text-primary border-primary/20";
    case "vocabulary":
      return "bg-teal/10 text-teal-700 dark:text-teal-300 border-teal/20";
    case "conjugation":
      return "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

export const SkillNavigatorItem: React.FC<SkillNavigatorItemProps> = ({
  skill,
  isSelected,
  onSelect,
}) => {
  const subCount = skill.subskills?.length || 0;
  const depsCount = skill.usage_counts?.total_dependencies || 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
        isSelected
          ? "bg-primary/5 border-primary/40 shadow-xs ring-1 ring-primary/20"
          : "bg-card border-border/80 hover:bg-muted/40 hover:border-border"
      }`}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
            {skill.name}
          </span>
          {!skill.is_active && (
            <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
              Archivée
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[130px]">
            {skill.code}
          </span>
          <span
            className={`text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded border ${getCategoryColor(
              skill.category
            )}`}
          >
            {skill.category}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[11px] font-mono font-medium px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border">
            {subCount} sous-comp.
          </span>
          {depsCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {depsCount} refs
            </span>
          )}
        </div>
        <ChevronRight
          className={`size-4 transition-transform ${
            isSelected ? "text-primary translate-x-0.5" : "text-muted-foreground/50"
          }`}
        />
      </div>
    </button>
  );
};
