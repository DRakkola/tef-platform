import React from "react";
import { Search, X, Brain, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SkillsToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  dimensionFilter: string;
  onDimensionChange: (val: string) => void;
  modalityFilter: string;
  onModalityChange: (val: string) => void;
  domainFilter: string;
  onDomainChange: (val: string) => void;
  statusFilter: string;
  onStatusChange: (val: string) => void;
  availableDomains?: string[];
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

export const SkillsToolbar: React.FC<SkillsToolbarProps> = ({
  searchQuery,
  onSearchChange,
  dimensionFilter,
  onDimensionChange,
  modalityFilter,
  onModalityChange,
  domainFilter,
  onDomainChange,
  statusFilter,
  onStatusChange,
  availableDomains = [],
  onResetFilters,
  hasActiveFilters,
}) => {
  return (
    <div className="bg-card border border-border/80 rounded-xl p-3 shadow-2xs space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Rechercher par nom ou code (ex. inference, pronoms)..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-border bg-background text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-0.5 rounded cursor-pointer"
            aria-label="Effacer la recherche"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Dimension Quick Segmented Filter */}
      <div className="flex items-center rounded-lg bg-muted/60 p-0.5 border border-border/60 text-xs">
        <button
          type="button"
          onClick={() => onDimensionChange("all")}
          className={`flex-1 py-1 text-center font-medium rounded-md transition cursor-pointer ${
            dimensionFilter === "all"
              ? "bg-background text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Toutes
        </button>
        <button
          type="button"
          onClick={() => onDimensionChange("reasoning")}
          className={`flex-1 py-1 flex items-center justify-center gap-1 font-medium rounded-md transition cursor-pointer ${
            dimensionFilter === "reasoning"
              ? "bg-background text-indigo-600 dark:text-indigo-400 shadow-2xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Brain className="size-3" /> Raisonnement
        </button>
        <button
          type="button"
          onClick={() => onDimensionChange("language")}
          className={`flex-1 py-1 flex items-center justify-center gap-1 font-medium rounded-md transition cursor-pointer ${
            dimensionFilter === "language"
              ? "bg-background text-teal-600 dark:text-teal-400 shadow-2xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Languages className="size-3" /> Langue
        </button>
      </div>

      {/* Secondary Filter Dropdowns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {/* Modality Filter */}
        <select
          value={modalityFilter}
          onChange={(e) => onModalityChange(e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer truncate"
          aria-label="Filtrer par modalité d'épreuve"
        >
          <option value="all">Toutes épreuves</option>
          <option value="reading">Compréhension écrite</option>
          <option value="listening">Compréhension orale</option>
          <option value="writing">Expression écrite</option>
          <option value="speaking">Expression orale</option>
        </select>

        {/* Domain Filter */}
        <select
          value={domainFilter}
          onChange={(e) => onDomainChange(e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer truncate"
          aria-label="Filtrer par domaine ou famille"
        >
          <option value="all">Tous domaines</option>
          {availableDomains.map((dom) => (
            <option key={dom} value={dom}>
              {dom}
            </option>
          ))}
          {/* Default standard domains if availableDomains is empty */}
          {availableDomains.length === 0 && (
            <>
              <option value="reading">reading</option>
              <option value="listening">listening</option>
              <option value="writing">writing</option>
              <option value="speaking">speaking</option>
              <option value="grammar">grammar</option>
              <option value="vocabulary">vocabulary</option>
              <option value="syntax">syntax</option>
              <option value="inference">inference</option>
            </>
          )}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer truncate col-span-2 sm:col-span-1"
          aria-label="Filtrer par statut"
        >
          <option value="all">Tous statuts</option>
          <option value="active">Actives uniquement</option>
          <option value="archived">Archivées uniquement</option>
        </select>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="flex justify-end pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-7 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2"
          >
            <X className="size-3" /> Réinitialiser les filtres
          </Button>
        </div>
      )}
    </div>
  );
};
