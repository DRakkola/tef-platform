import React, { useState } from "react"
import { Search, SlidersHorizontal, X, RotateCcw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import { CANONICAL_CATEGORIES } from "./PracticeCategories"
import type { PracticeFiltersState } from "./types"

const CEFR_LEVELS = ["all", "A2", "B1", "B2", "C1"]

export interface PracticeFiltersProps {
  filters: PracticeFiltersState
  onChange: (filters: PracticeFiltersState) => void
  onReset: () => void
  totalMatches: number
}

export const PracticeFilters: React.FC<PracticeFiltersProps> = ({
  filters,
  onChange,
  onReset,
  totalMatches,
}) => {
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)

  const activeFiltersCount =
    (filters.category !== "all" ? 1 : 0) +
    (filters.level !== "all" ? 1 : 0) +
    (filters.search.trim() !== "" ? 1 : 0)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, search: e.target.value })
  }

  const handleCategorySelect = (catId: string) => {
    onChange({ ...filters, category: catId })
  }

  const handleLevelSelect = (lvl: string) => {
    onChange({ ...filters, level: lvl })
  }

  const clearSearch = () => {
    onChange({ ...filters, search: "" })
  }

  return (
    <div className="space-y-3.5" data-testid="practice-filters">
      {/* Search Bar & Mobile Trigger Row */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={filters.search}
            onChange={handleSearchChange}
            placeholder="Rechercher par sujet, règle grammaticale, ou mot-clé..."
            className="pl-9 pr-8 h-10 text-sm bg-card"
          />
          {filters.search && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Effacer la recherche"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Mobile Filter Sheet Trigger */}
        <div className="sm:hidden">
          <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="default"
                className="h-10 px-3.5 gap-2 cursor-pointer relative"
                aria-label="Ouvrir les filtres"
              >
                <SlidersHorizontal className="size-4" />
                <span>Filtres</span>
                {activeFiltersCount > 0 && (
                  <span className="size-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl p-6 space-y-6">
              <SheetHeader className="p-0 text-left">
                <SheetTitle className="text-base font-bold">Filtres de pratique</SheetTitle>
                <SheetDescription className="text-xs">
                  Ajustez les modalités et niveaux pour cibler vos exercices.
                </SheetDescription>
              </SheetHeader>

              {/* Mobile Level Options */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Niveau CECRL
                </label>
                <div className="flex flex-wrap gap-2">
                  {CEFR_LEVELS.map((lvl) => {
                    const isSelected = filters.level === lvl
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => handleLevelSelect(lvl)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                            : "bg-muted/50 text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {lvl === "all" ? "Tous les niveaux" : lvl}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Mobile Category Options */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Compétence
                </label>
                <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => handleCategorySelect("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                      filters.category === "all"
                        ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                        : "bg-muted/50 text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    Toutes les compétences
                  </button>
                  {CANONICAL_CATEGORIES.map((cat) => {
                    const isSelected = filters.category === cat.id
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleCategorySelect(cat.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                            : "bg-muted/50 text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {cat.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <SheetFooter className="p-0 pt-4 border-t border-border/60 flex flex-row items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onReset()
                    setIsMobileSheetOpen(false)
                  }}
                  className="cursor-pointer text-xs"
                >
                  <RotateCcw className="size-3.5 mr-1" />
                  <span>Réinitialiser</span>
                </Button>

                <SheetClose asChild>
                  <Button size="sm" className="cursor-pointer font-semibold text-xs px-5">
                    Voir les {totalMatches} résultats
                  </Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Inline Controls */}
      <div className="hidden sm:flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
          <button
            type="button"
            onClick={() => handleCategorySelect("all")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border whitespace-nowrap ${
              filters.category === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/40"
            }`}
          >
            Tout
          </button>
          {CANONICAL_CATEGORIES.map((cat) => {
            const isSelected = filters.category === cat.id
            const Icon = cat.icon
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategorySelect(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border whitespace-nowrap ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Icon className="size-3" />
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Level Pills & Reset Row */}
        <div className="flex items-center gap-3 shrink-0 ml-auto">
          <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/60">
            {CEFR_LEVELS.map((lvl) => {
              const isSelected = filters.level === lvl
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => handleLevelSelect(lvl)}
                  className={`px-2.5 py-0.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {lvl === "all" ? "Tous" : lvl}
                </button>
              )
            })}
          </div>

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
            >
              <RotateCcw className="size-3" />
              <span>Réinitialiser</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
