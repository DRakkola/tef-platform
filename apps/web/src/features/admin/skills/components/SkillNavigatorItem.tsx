import React from "react";
import { ChevronRight, ChevronDown, Brain, Languages } from "lucide-react";
import type { TaxonomySkillItem } from "../types";

interface SkillNavigatorItemProps {
  skill: TaxonomySkillItem;
  isSelected: boolean;
  onSelect: () => void;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (e: React.MouseEvent) => void;
  level?: number;
}

export const SkillNavigatorItem: React.FC<SkillNavigatorItemProps> = ({
  skill,
  isSelected,
  onSelect,
  hasChildren = false,
  isExpanded = false,
  onToggleExpand,
  level = 0,
}) => {
  const subCount = skill.subskill_count || 0;
  const depsCount = skill.usage_counts?.total_dependencies || 0;
  const isReasoning = skill.dimension === "reasoning";

  return (
    <div
      className="flex items-center gap-1 group"
      style={{ paddingLeft: `${level * 14}px` }}
    >
      {/* Expand/Collapse Toggle Button */}
      {hasChildren && onToggleExpand ? (
        <button
          type="button"
          onClick={onToggleExpand}
          className="size-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded hover:bg-muted/60 transition shrink-0 cursor-pointer"
          aria-label={isExpanded ? "Réduire" : "Développer"}
        >
          {isExpanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
        </button>
      ) : level > 0 ? (
        <div className="size-6 shrink-0 flex items-center justify-center">
          <div className="size-1.5 rounded-full bg-border" />
        </div>
      ) : null}

      {/* Main Item Button */}
      <button
        type="button"
        onClick={onSelect}
        className={`flex-1 min-w-0 text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
          isSelected
            ? "bg-primary/5 border-primary/40 shadow-xs ring-1 ring-primary/20"
            : "bg-card border-border/80 hover:bg-muted/40 hover:border-border"
        }`}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-xs text-foreground truncate">
              {skill.name}
            </span>
            {!skill.is_active && (
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                Archivée
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
              {skill.code}
            </span>
            <span
              className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border flex items-center gap-0.5 ${
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
            {skill.domain && (
              <span className="text-[9px] text-muted-foreground px-1 py-0.2 rounded bg-muted/40 border border-border/50">
                {skill.domain}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex flex-col items-end gap-0.5">
            {subCount > 0 && (
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground border border-border">
                {subCount} sous-comp.
              </span>
            )}
            {depsCount > 0 && (
              <span className="text-[9px] text-muted-foreground font-mono">
                {depsCount} refs
              </span>
            )}
          </div>
          <ChevronRight
            className={`size-3.5 transition-transform ${
              isSelected ? "text-primary translate-x-0.5" : "text-muted-foreground/40 group-hover:text-muted-foreground"
            }`}
          />
        </div>
      </button>
    </div>
  );
};
