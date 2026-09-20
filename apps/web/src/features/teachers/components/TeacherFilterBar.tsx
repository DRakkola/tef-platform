import { SlidersHorizontal, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export interface TeacherFilterBarProps {
  specialization: string
  onSpecializationChange: (val: string) => void
  level: string
  onLevelChange: (val: string) => void
  priceRange: string
  onPriceRangeChange: (val: string) => void
  availability: "all" | "today" | "this_week"
  onAvailabilityChange: (val: "all" | "today" | "this_week") => void
  activeFiltersCount: number
  onReset: () => void
  onOpenMobileFilters: () => void
}

const SPECIALTY_OPTIONS = [
  { value: "all", label: "Toutes spécialités" },
  { value: "Expression orale", label: "Expression orale" },
  { value: "Expression écrite", label: "Expression écrite" },
  { value: "Méthodologie TEF", label: "Méthodologie TEF" },
]

const LEVEL_OPTIONS = [
  { value: "all", label: "Tous niveaux" },
  { value: "B1", label: "B1" },
  { value: "B2", label: "B2" },
  { value: "C1", label: "C1" },
]

const PRICE_OPTIONS = [
  { value: "all", label: "Tous tarifs" },
  { value: "under_50", label: "< 50 CAD" },
  { value: "50_70", label: "50 - 70 CAD" },
  { value: "above_70", label: "> 70 CAD" },
]

const AVAILABILITY_OPTIONS = [
  { value: "all", label: "Toutes dates" },
  { value: "today", label: "Aujourd'hui" },
  { value: "this_week", label: "Cette semaine" },
]

export function TeacherFilterBar({
  specialization,
  onSpecializationChange,
  level,
  onLevelChange,
  priceRange,
  onPriceRangeChange,
  availability,
  onAvailabilityChange,
  activeFiltersCount,
  onReset,
  onOpenMobileFilters,
}: TeacherFilterBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 p-2 rounded-2xl bg-muted/30 border border-border/60">
      {/* Desktop Filters */}
      <div className="hidden lg:flex items-center flex-wrap gap-2 text-xs">
        {/* Specialization Segmented Pills */}
        <div className="flex items-center p-1 rounded-xl bg-background border border-border/60 shadow-2xs">
          {SPECIALTY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSpecializationChange(opt.value)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer text-xs ${
                specialization === opt.value
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Level Pills */}
        <div className="flex items-center p-1 rounded-xl bg-background border border-border/60 shadow-2xs">
          {LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onLevelChange(opt.value)}
              className={`px-2.5 py-1.5 rounded-lg font-mono transition-colors cursor-pointer text-xs ${
                level === opt.value
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Price Dropdown */}
        <div className="flex items-center p-1 rounded-xl bg-background border border-border/60 shadow-2xs">
          {PRICE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onPriceRangeChange(opt.value)}
              className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs ${
                priceRange === opt.value
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Availability Filter */}
        <div className="flex items-center p-1 rounded-xl bg-background border border-border/60 shadow-2xs">
          {AVAILABILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onAvailabilityChange(opt.value as "all" | "today" | "this_week")}
              className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs ${
                availability === opt.value
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Reset Filter Action (if active) */}
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <RotateCcw className="size-3" />
            <span>Réinitialiser</span>
          </Button>
        )}
      </div>

      {/* Mobile Filter Button */}
      <div className="flex lg:hidden items-center justify-between w-full">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenMobileFilters}
          className="gap-2 text-xs font-medium cursor-pointer"
        >
          <SlidersHorizontal className="size-3.5" />
          <span>Filtres</span>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>

        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Effacer tout
          </Button>
        )}
      </div>
    </div>
  )
}
