import React from "react";
import { Clock, ShieldCheck, History, ArrowRight, Tag, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import type { TaxonomySkillDetail } from "../types";

interface SkillActivityProps {
  skill: TaxonomySkillDetail;
}

export const SkillActivity: React.FC<SkillActivityProps> = ({ skill }) => {
  const formatDate = (iso?: string) => {
    if (!iso) return "Date inconnue";
    return new Date(iso).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalDeps = skill.usage_counts?.total_dependencies || 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Historique & Traçabilité Réglementaire
        </h3>
        <p className="text-xs text-muted-foreground">
          Journal d'audit, cycle de vie et état d'intégrité de la compétence dans le référentiel TEF.
        </p>
      </div>

      <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 space-y-4 shadow-2xs">
        <div className="space-y-3 divide-y divide-border/60">
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5 text-xs text-foreground">
              <Clock className="size-4 text-muted-foreground" />
              <span>Dernière révision</span>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {formatDate(skill.updated_at)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-2.5 text-xs text-foreground">
              <ShieldCheck className="size-4 text-primary" />
              <span>Création initiale</span>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {formatDate(skill.created_at)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-2.5 text-xs text-foreground">
              <History className="size-4 text-teal-600 dark:text-teal-400" />
              <span>Statut d'activation dans le catalogue</span>
            </div>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                skill.is_active
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {skill.is_active ? "Active" : "Archivée"}
            </span>
          </div>

          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-2.5 text-xs text-foreground">
              <Tag className="size-4 text-indigo-500" />
              <span>Version de taxonomie rattachée</span>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {skill.taxonomy_version_id || "Version courante"}
            </span>
          </div>

          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-2.5 text-xs text-foreground">
              <Lock className="size-4 text-amber-500" />
              <span>Protection contre la suppression</span>
            </div>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                totalDeps > 0
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {totalDeps > 0 ? `Verrouillée (${totalDeps} refs)` : "Libre (0 ref)"}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Toutes les mutations de la taxonomie sont tracées de manière immuable.
          </span>
          <Link
            to="/admin/audit-logs"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            Consulter les logs d'audit <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
