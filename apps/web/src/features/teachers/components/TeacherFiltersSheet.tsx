import { X, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface TeacherFiltersSheetProps {
  isOpen: boolean
  onClose: () => void
  specialization: string
  onSpecializationChange: (val: string) => void
  level: string
  onLevelChange: (val: string) => void
  priceRange: string
  onPriceRangeChange: (val: string) => void
  availability: "all" | "today" | "this_week"
  onAvailabilityChange: (val: "all" | "today" | "this_week") => void
  onReset: () => void
}

export function TeacherFiltersSheet({
  isOpen,
  onClose,
  specialization,
  onSpecializationChange,
  level,
  onLevelChange,
  priceRange,
  onPriceRangeChange,
  availability,
  onAvailabilityChange,
  onReset,
}: TeacherFiltersSheetProps) {
  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Filtres de recherche"
      className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-sm bg-card border-l border-border h-full flex flex-col p-6 space-y-6 shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <h3 className="font-bold text-base text-foreground">Filtres de recherche</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les filtres"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Filter Groups */}
        <div className="space-y-6 flex-1 text-xs">
          {/* Spécialité */}
          <div className="space-y-2">
            <label className="font-semibold text-foreground uppercase tracking-wider text-[11px] block">
              Spécialité & Service
            </label>
            <div className="space-y-1">
              {[
                { value: "all", label: "Toutes les spécialités" },
                { value: "Expression orale", label: "Expression orale" },
                { value: "Expression écrite", label: "Expression écrite" },
                { value: "Méthodologie TEF", label: "Méthodologie TEF" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSpecializationChange(opt.value)}
                  className={`w-full p-2.5 rounded-lg text-left cursor-pointer transition-colors flex items-center justify-between ${
                    specialization === opt.value
                      ? "bg-primary/10 text-primary font-semibold border border-primary/30"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <span>{opt.label}</span>
                  {specialization === opt.value && <span className="size-1.5 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          </div>

          {/* Niveau CEFR */}
          <div className="space-y-2">
            <label className="font-semibold text-foreground uppercase tracking-wider text-[11px] block">
              Niveau préparé
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { value: "all", label: "Tous" },
                { value: "B1", label: "B1" },
                { value: "B2", label: "B2" },
                { value: "C1", label: "C1" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onLevelChange(opt.value)}
                  className={`p-2 rounded-lg text-center cursor-pointer transition-colors font-mono ${
                    level === opt.value
                      ? "bg-primary text-primary-foreground font-bold"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tarif horaire */}
          <div className="space-y-2">
            <label className="font-semibold text-foreground uppercase tracking-wider text-[11px] block">
              Fourchette de tarif
            </label>
            <div className="space-y-1">
              {[
                { value: "all", label: "Tous les tarifs" },
                { value: "under_50", label: "Moins de 50 € / heure" },
                { value: "50_70", label: "Entre 50 € et 70 € / heure" },
                { value: "above_70", label: "Plus de 70 € / heure" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onPriceRangeChange(opt.value)}
                  className={`w-full p-2.5 rounded-lg text-left cursor-pointer transition-colors flex items-center justify-between ${
                    priceRange === opt.value
                      ? "bg-primary/10 text-primary font-semibold border border-primary/30"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <span>{opt.label}</span>
                  {priceRange === opt.value && <span className="size-1.5 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          </div>

          {/* Disponibilité */}
          <div className="space-y-2">
            <label className="font-semibold text-foreground uppercase tracking-wider text-[11px] block">
              Disponibilité
            </label>
            <div className="space-y-1">
              {[
                { value: "all", label: "Toutes dates" },
                { value: "today", label: "Disponible aujourd'hui" },
                { value: "this_week", label: "Disponible cette semaine" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onAvailabilityChange(opt.value as "all" | "today" | "this_week")}
                  className={`w-full p-2.5 rounded-lg text-left cursor-pointer transition-colors flex items-center justify-between ${
                    availability === opt.value
                      ? "bg-primary/10 text-primary font-semibold border border-primary/30"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <span>{opt.label}</span>
                  {availability === opt.value && <span className="size-1.5 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="cursor-pointer gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            <span>Réinitialiser</span>
          </Button>

          <Button
            size="sm"
            onClick={onClose}
            className="cursor-pointer font-semibold text-xs px-6"
          >
            Appliquer
          </Button>
        </div>
      </div>
    </div>
  )
}
