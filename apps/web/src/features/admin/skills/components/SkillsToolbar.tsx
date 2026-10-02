import React from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SkillsToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  categoryFilter: string;
  onCategoryChange: (val: string) => void;
  statusFilter: string;
  onStatusChange: (val: string) => void;
  hasSubskillsFilter: string;
  onHasSubskillsChange: (val: string) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

export const SkillsToolbar: React.FC<SkillsToolbarProps> = ({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  hasSubskillsFilter,
  onHasSubskillsChange,
  onResetFilters,
  hasActiveFilters,
}) => {
  return (
    <div className="bg-card border border-border/80 rounded-xl p-3 shadow-2xs space-y-2.5">
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher par nom ou code (ex. reading, grammaire)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              aria-label="Effacer la recherche"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Domain Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            aria-label="Filtrer par domaine"
          >
            <option value="all">Tous les domaines</option>
            <option value="reading">Compréhension écrite (Reading)</option>
            <option value="listening">Compréhension orale (Listening)</option>
            <option value="writing">Expression écrite (Writing)</option>
            <option value="speaking">Expression orale (Speaking)</option>
            <option value="grammar">Grammaire & Syntaxe</option>
            <option value="vocabulary">Vocabulaire & Lexique</option>
            <option value="conjugation">Conjugaison & Modes</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actives uniquement</option>
            <option value="archived">Archivées / Inactives</option>
          </select>

          {/* Subskills Filter */}
          <select
            value={hasSubskillsFilter}
            onChange={(e) => onHasSubskillsChange(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer hidden sm:block"
            aria-label="Filtrer par présence de sous-compétences"
          >
            <option value="all">Toutes sous-compétences</option>
            <option value="yes">Avec sous-compétences</option>
            <option value="no">Sans sous-compétences (0)</option>
          </select>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2.5"
            >
              <X className="size-3.5" /> Réinitialiser
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
