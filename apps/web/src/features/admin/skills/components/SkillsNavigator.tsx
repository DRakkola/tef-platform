import React from "react";
import { FolderTree } from "lucide-react";
import { SkillNavigatorItem } from "./SkillNavigatorItem";
import type { SkillItem } from "../types";

interface SkillsNavigatorProps {
  skills: SkillItem[];
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
  if (isLoading) {
    return (
      <div className="space-y-2 p-1">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-muted/40 border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="p-8 text-center bg-card border border-border/80 rounded-xl space-y-2">
        <FolderTree className="size-8 text-muted-foreground/50 mx-auto" />
        <p className="text-xs sm:text-sm font-medium text-foreground">Aucune compétence trouvée</p>
        <p className="text-xs text-muted-foreground">
          Modifiez vos filtres ou créez une nouvelle compétence.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 pr-1">
      {skills.map((skill) => (
        <SkillNavigatorItem
          key={skill.id}
          skill={skill}
          isSelected={skill.id === selectedSkillId}
          onSelect={() => onSelectSkill(skill.id)}
        />
      ))}
    </div>
  );
};
