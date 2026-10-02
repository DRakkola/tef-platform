import React from "react";
import {
  Edit2,
  FolderPlus,
  Trash2,
  Archive,
  ArchiveRestore,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SkillOverview } from "./SkillOverview";
import { SkillSubskills } from "./SkillSubskills";
import { SkillLinkedContent } from "./SkillLinkedContent";
import { SkillActivity } from "./SkillActivity";
import type { SkillItem, SubSkill } from "../types";

interface SkillDetailProps {
  skill: SkillItem | null;
  onEditSkill: (skill: SkillItem) => void;
  onDeleteSkill: (skill: SkillItem) => void;
  onToggleStatus: (skill: SkillItem) => void;
  onAddSubskill: (parentSkill: SkillItem) => void;
  onEditSubskill: (sub: SubSkill) => void;
  onDeleteSubskill: (sub: SubSkill) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const SkillDetail: React.FC<SkillDetailProps> = ({
  skill,
  onEditSkill,
  onDeleteSkill,
  onToggleStatus,
  onAddSubskill,
  onEditSubskill,
  onDeleteSubskill,
  activeTab,
  onTabChange,
}) => {
  const [internalTab, setInternalTab] = React.useState(activeTab || "overview");

  React.useEffect(() => {
    if (activeTab) {
      setInternalTab(activeTab);
    }
  }, [activeTab]);

  const handleTabChange = (tab: string) => {
    setInternalTab(tab);
    onTabChange(tab);
  };
  if (!skill) {
    return (
      <div className="h-full min-h-[420px] flex flex-col items-center justify-center p-8 text-center bg-card border border-border/80 rounded-2xl shadow-2xs space-y-3">
        <div className="size-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center">
          <GitBranch className="size-6 text-muted-foreground/60" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-foreground">Sélectionnez une compétence</h2>
          <p className="text-xs text-muted-foreground max-w-sm">
            Choisissez une compétence dans la liste à gauche pour inspecter ses sous-compétences, ses dépendances et ses contenus associés.
          </p>
        </div>
      </div>
    );
  }

  const subskillsCount = skill.subskills?.length || 0;

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-6">
      {/* Skill Identity Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {skill.name}
            </h2>
            <span
              className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${
                skill.is_active
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              {skill.is_active ? "Active" : "Archivée"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-medium">
              {skill.code}
            </span>
            <span className="text-xs font-semibold uppercase px-2.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              {skill.category}
            </span>
            <span className="text-muted-foreground font-mono text-xs">
              {subskillsCount} sous-compétence{subskillsCount > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddSubskill(skill)}
            className="text-xs gap-1 cursor-pointer"
          >
            <FolderPlus className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Ajouter sous-compétence</span>
            <span className="sm:hidden">Sous-comp.</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onEditSkill(skill)}
            className="text-xs gap-1 cursor-pointer"
          >
            <Edit2 className="size-3.5 text-muted-foreground" /> Modifier
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggleStatus(skill)}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            title={skill.is_active ? "Archiver la compétence" : "Réactiver la compétence"}
          >
            {skill.is_active ? (
              <>
                <Archive className="size-3.5 mr-1" /> Archiver
              </>
            ) : (
              <>
                <ArchiveRestore className="size-3.5 mr-1" /> Réactiver
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDeleteSkill(skill)}
            className="text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
            title="Supprimer la compétence"
          >
            <Trash2 className="size-3.5 mr-1" /> Supprimer
          </Button>
        </div>
      </div>

      {/* Tabs Workspace */}
      <Tabs value={internalTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-muted/60 p-1 rounded-xl h-9.5">
          <TabsTrigger
            value="overview"
            onClick={() => handleTabChange("overview")}
            className="text-xs"
          >
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger
            value="subskills"
            onClick={() => handleTabChange("subskills")}
            className="text-xs"
          >
            Sous-compétences ({subskillsCount})
          </TabsTrigger>
          <TabsTrigger
            value="linked"
            onClick={() => handleTabChange("linked")}
            className="text-xs"
          >
            Contenus associés
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            onClick={() => handleTabChange("activity")}
            className="text-xs"
          >
            Activité & Audit
          </TabsTrigger>
        </TabsList>

        <div className="pt-4">
          <TabsContent value="overview">
            <SkillOverview skill={skill} />
          </TabsContent>

          <TabsContent value="subskills">
            <SkillSubskills
              subskills={skill.subskills || []}
              onAddSubskill={() => onAddSubskill(skill)}
              onEditSubskill={onEditSubskill}
              onDeleteSubskill={onDeleteSubskill}
            />
          </TabsContent>

          <TabsContent value="linked">
            <SkillLinkedContent skill={skill} />
          </TabsContent>

          <TabsContent value="activity">
            <SkillActivity skill={skill} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
