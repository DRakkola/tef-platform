import React from "react";
import {
  Edit2,
  FolderPlus,
  Trash2,
  Archive,
  ArchiveRestore,
  GitBranch,
  Brain,
  Languages,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SkillOverview } from "./SkillOverview";
import { SkillSubskills } from "./SkillSubskills";
import { SkillMapping } from "./SkillMapping";
import { SkillCefrDescriptors } from "./SkillCefrDescriptors";
import { SkillLinkedContent } from "./SkillLinkedContent";
import { SkillActivity } from "./SkillActivity";
import type {
  TaxonomySkillDetail,
  TaxonomySkillSummary,
  SkillLevelDescriptor,
  CEFRBand,
} from "../types";

interface SkillDetailProps {
  skill: TaxonomySkillDetail | null;
  isLoading?: boolean;
  onEditSkill: (skill: TaxonomySkillDetail) => void;
  onArchiveSkill: (skill: TaxonomySkillDetail) => void;
  onRestoreSkill: (skill: TaxonomySkillDetail) => void;
  onDeleteSkill: (skill: TaxonomySkillDetail) => void;
  onAddSubskill: (parentSkill: TaxonomySkillDetail) => void;
  onEditSubskill: (child: TaxonomySkillSummary) => void;
  onToggleChildStatus?: (child: TaxonomySkillSummary) => void;
  onSelectSkill?: (id: string) => void;
  onAddRelation: () => void;
  onDeleteRelation: (relationId: string) => void;
  onEditCefrDescriptor: (level: CEFRBand, current?: SkillLevelDescriptor) => void;
  onDeleteCefrDescriptor: (level: CEFRBand) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const SkillDetail: React.FC<SkillDetailProps> = ({
  skill,
  isLoading = false,
  onEditSkill,
  onArchiveSkill,
  onRestoreSkill,
  onDeleteSkill,
  onAddSubskill,
  onEditSubskill,
  onToggleChildStatus,
  onSelectSkill,
  onAddRelation,
  onDeleteRelation,
  onEditCefrDescriptor,
  onDeleteCefrDescriptor,
  activeTab,
  onTabChange,
}) => {
  const [currentTab, setCurrentTab] = React.useState(activeTab || "overview");

  React.useEffect(() => {
    if (activeTab) {
      setCurrentTab(activeTab);
    }
  }, [activeTab]);

  const handleTabChange = (val: string) => {
    setCurrentTab(val);
    onTabChange(val);
  };
  const [copiedCode, setCopiedCode] = React.useState(false);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-2xs space-y-6 animate-pulse">
        <div className="h-8 bg-muted/60 rounded-lg w-1/3" />
        <div className="h-4 bg-muted/40 rounded w-1/4" />
        <div className="h-48 bg-muted/30 rounded-xl" />
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="h-full min-h-[420px] flex flex-col items-center justify-center p-8 text-center bg-card border border-border/80 rounded-2xl shadow-2xs space-y-3">
        <div className="size-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center">
          <GitBranch className="size-6 text-muted-foreground/60" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-foreground">Sélectionnez une compétence</h2>
          <p className="text-xs text-muted-foreground max-w-sm">
            Choisissez une compétence dans l'arborescence à gauche pour inspecter ses descripteurs CECRL, ses sous-compétences, son graphe de dépendance et son impact.
          </p>
        </div>
      </div>
    );
  }

  const subskillsCount = skill.children?.length || 0;
  const relationsCount = (skill.outgoing_relations?.length || 0) + (skill.incoming_relations?.length || 0);
  const descriptorsCount = skill.level_descriptors?.length || 0;
  const isReasoning = skill.dimension === "reasoning";

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-6">
      {/* Skill Identity Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 border-b border-border/60 pb-5">
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
            <button
              type="button"
              onClick={() => handleCopyCode(skill.code)}
              className="font-mono text-xs px-2.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-medium flex items-center gap-1.5 hover:text-foreground hover:border-primary/40 transition cursor-pointer"
              title="Copier le code machine"
            >
              {skill.code}
              {copiedCode ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
            </button>

            {/* Dimension Badge */}
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded border flex items-center gap-1 ${
                isReasoning
                  ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20"
                  : "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20"
              }`}
            >
              {isReasoning ? (
                <>
                  <Brain className="size-3" /> Raisonnement
                </>
              ) : (
                <>
                  <Languages className="size-3" /> Langue
                </>
              )}
            </span>

            {/* Domain Badge */}
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border">
              {skill.domain}
            </span>

            {/* Subskills Count */}
            <span className="text-muted-foreground font-mono text-xs">
              {subskillsCount} sous-comp.
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
            <span>Ajouter sous-comp.</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onEditSkill(skill)}
            className="text-xs gap-1 cursor-pointer"
          >
            <Edit2 className="size-3.5 text-muted-foreground" /> Modifier
          </Button>

          {skill.is_active ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onArchiveSkill(skill)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              title="Archiver cette compétence"
            >
              <Archive className="size-3.5 mr-1" /> Archiver
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRestoreSkill(skill)}
              className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 cursor-pointer"
              title="Réactiver cette compétence"
            >
              <ArchiveRestore className="size-3.5 mr-1" /> Réactiver
            </Button>
          )}

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
      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-muted/60 p-1 rounded-xl h-auto flex flex-wrap gap-1">
          <TabsTrigger value="overview" className="text-xs">
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="subskills" className="text-xs">
            Sous-compétences ({subskillsCount})
          </TabsTrigger>
          <TabsTrigger value="mapping" className="text-xs">
            Cartographie & Dépendances ({relationsCount})
          </TabsTrigger>
          <TabsTrigger value="cefr" className="text-xs">
            CECRL ({descriptorsCount}/6)
          </TabsTrigger>
          <TabsTrigger value="content" className="text-xs">
            Contenus associés
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs">
            Activité & Traçabilité
          </TabsTrigger>
        </TabsList>

        <div className="pt-4">
          <TabsContent value="overview">
            <SkillOverview skill={skill} onNavigateToSkill={onSelectSkill} />
          </TabsContent>

          <TabsContent value="subskills">
            <SkillSubskills
              skill={skill}
              onAddSubskill={() => onAddSubskill(skill)}
              onEditSubskill={onEditSubskill}
              onToggleChildStatus={onToggleChildStatus}
              onSelectChild={onSelectSkill}
            />
          </TabsContent>

          <TabsContent value="mapping">
            <SkillMapping
              skill={skill}
              onAddRelation={onAddRelation}
              onDeleteRelation={onDeleteRelation}
              onNavigateToSkill={onSelectSkill}
            />
          </TabsContent>

          <TabsContent value="cefr">
            <SkillCefrDescriptors
              skill={skill}
              onEditDescriptor={onEditCefrDescriptor}
              onDeleteDescriptor={onDeleteCefrDescriptor}
            />
          </TabsContent>

          <TabsContent value="content">
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
