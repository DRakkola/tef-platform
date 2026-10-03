import React from "react";
import {
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaxonomySkillDetail, SkillRelationType } from "../types";

interface SkillMappingProps {
  skill: TaxonomySkillDetail;
  onAddRelation: () => void;
  onDeleteRelation: (relationId: string) => void;
  onNavigateToSkill?: (skillId: string) => void;
}

const getRelationBadge = (type: SkillRelationType) => {
  switch (type) {
    case "prerequisite":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25";
    case "depends_on":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25";
    case "supports":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25";
    case "related":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getRelationLabel = (type: SkillRelationType) => {
  switch (type) {
    case "prerequisite":
      return "Prérequis obligatoire";
    case "depends_on":
      return "Dépendance";
    case "supports":
      return "Soutient";
    case "related":
      return "Compétence liée";
    default:
      return type;
  }
};

export const SkillMapping: React.FC<SkillMappingProps> = ({
  skill,
  onAddRelation,
  onDeleteRelation,
  onNavigateToSkill,
}) => {
  const outgoing = skill.outgoing_relations || [];
  const incoming = skill.incoming_relations || [];

  // Incoming prerequisites: skills required before this skill
  const incomingPrereqs = incoming.filter((r) => r.relation_type === "prerequisite");

  const totalRelations = outgoing.length + incoming.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cartographie & Dépendances Pédagogiques ({totalRelations})
          </h3>
          <p className="text-xs text-muted-foreground">
            Graphe orienté de dépendance, prérequis d'apprentissage et connexions transversales raisonnement/langue.
          </p>
        </div>
        <Button
          onClick={onAddRelation}
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="size-3.5" /> Ajouter une relation
        </Button>
      </div>

      {/* Incoming Prerequisites Section */}
      <div className="bg-card border border-border/80 rounded-xl p-4 space-y-3 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          <ArrowLeft className="size-4 text-amber-500" />
          <span>Prérequis requis en amont ({incomingPrereqs.length})</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Compétences que l'étudiant doit impérativement maîtriser avant d'aborder efficacement celle-ci.
        </p>

        {incomingPrereqs.length === 0 ? (
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-xs text-muted-foreground italic">
            Aucun prérequis amont déclaré. Cette compétence peut être abordée dès le début du parcours.
          </div>
        ) : (
          <div className="space-y-2">
            {incomingPrereqs.map((rel) => (
              <div
                key={rel.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] font-semibold text-foreground">
                    {rel.target_skill_code || "Code inconnu"}
                  </span>
                  <span className="text-muted-foreground truncate">
                    {rel.target_skill_name}
                  </span>
                  <span
                    className={`text-[9px] uppercase px-1.5 py-0.2 rounded border font-semibold ${getRelationBadge(
                      rel.relation_type
                    )}`}
                  >
                    {getRelationLabel(rel.relation_type)}
                  </span>
                </div>
                {onNavigateToSkill && rel.from_skill_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigateToSkill(rel.from_skill_id)}
                    className="h-6 text-[11px] text-primary gap-1 px-2 cursor-pointer"
                  >
                    Voir <ArrowRight className="size-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outgoing Relations Section */}
      <div className="bg-card border border-border/80 rounded-xl p-4 space-y-3 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          <ArrowRight className="size-4 text-primary" />
          <span>Relations & Dépendances sortantes ({outgoing.length})</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Compétences débloquées, soutenues ou transversalement liées à celle-ci.
        </p>

        {outgoing.length === 0 ? (
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-xs text-muted-foreground italic">
            Aucune relation sortante configurée pour le moment.
          </div>
        ) : (
          <div className="space-y-2">
            {outgoing.map((rel) => (
              <div
                key={rel.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span
                    className={`text-[9px] uppercase px-1.5 py-0.2 rounded border font-semibold ${getRelationBadge(
                      rel.relation_type
                    )}`}
                  >
                    {getRelationLabel(rel.relation_type)}
                  </span>
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <span className="font-mono text-[11px] font-semibold text-foreground">
                    {rel.target_skill_code || "Code inconnu"}
                  </span>
                  <span className="text-muted-foreground truncate">
                    {rel.target_skill_name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {onNavigateToSkill && rel.to_skill_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigateToSkill(rel.to_skill_id)}
                      className="h-6 text-[11px] text-primary gap-1 px-2 cursor-pointer"
                    >
                      Inspecter <ArrowRight className="size-3" />
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteRelation(rel.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition cursor-pointer"
                    title="Supprimer cette relation"
                    aria-label="Supprimer la relation"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
