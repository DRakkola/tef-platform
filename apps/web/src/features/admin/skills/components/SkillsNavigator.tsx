import React, { useState, useMemo } from "react";
import { FolderTree, GitBranch } from "lucide-react";
import { SkillNavigatorItem } from "./SkillNavigatorItem";
import type { TaxonomySkillItem } from "../types";

interface SkillsNavigatorProps {
  skills: TaxonomySkillItem[];
  selectedSkillId: string | null;
  onSelectSkill: (id: string) => void;
  isLoading: boolean;
}

export const SkillsNavigator: React.FC<SkillsNavigatorProps> = ({
  skills,
  selectedSkillId,
  onSelectSkill,
  isLoading,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Group skills into roots and their children
  const { roots, childrenByParent } = useMemo(() => {
    const r: TaxonomySkillItem[] = [];
    const childrenMap = new Map<string, TaxonomySkillItem[]>();

    for (const skill of skills) {
      if (!skill.parent_id) {
        r.push(skill);
      } else {
        const list = childrenMap.get(skill.parent_id) || [];
        list.push(skill);
        childrenMap.set(skill.parent_id, list);
      }
    }

    // If no parent_ids at all (e.g. roots_only query), treat all as roots
    if (r.length === 0 && skills.length > 0) {
      return { roots: skills, childrenByParent: new Map() };
    }

    return { roots: r, childrenByParent: childrenMap };
  }, [skills]);

  const toggleExpand = (skillId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-1" data-testid="skills-navigator-loading">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-muted/40 border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="p-8 text-center bg-card border border-border/80 rounded-xl space-y-2" data-testid="skills-navigator-empty">
        <FolderTree className="size-8 text-muted-foreground/50 mx-auto" />
        <p className="text-xs sm:text-sm font-medium text-foreground">Aucune compétence trouvée</p>
        <p className="text-xs text-muted-foreground">
          Modifiez vos filtres ou créez une nouvelle compétence racine.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 pr-1 max-h-[calc(100vh-280px)] overflow-y-auto" data-testid="skills-navigator-list">
      {roots.map((skill) => {
        const children = childrenByParent.get(skill.id) || [];
        const hasChildren = children.length > 0 || skill.subskill_count > 0;
        const isExpanded = expandedIds.has(skill.id);

        return (
          <div key={skill.id} className="space-y-1">
            <SkillNavigatorItem
              skill={skill}
              isSelected={skill.id === selectedSkillId}
              onSelect={() => onSelectSkill(skill.id)}
              hasChildren={hasChildren}
              isExpanded={isExpanded}
              onToggleExpand={hasChildren ? (e) => toggleExpand(skill.id, e) : undefined}
              level={0}
            />

            {/* Nested Children */}
            {isExpanded && children.length > 0 && (
              <div className="space-y-1 border-l border-border/60 ml-4 pl-1">
                {children.map((child) => (
                  <SkillNavigatorItem
                    key={child.id}
                    skill={child}
                    isSelected={child.id === selectedSkillId}
                    onSelect={() => onSelectSkill(child.id)}
                    hasChildren={false}
                    level={1}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
