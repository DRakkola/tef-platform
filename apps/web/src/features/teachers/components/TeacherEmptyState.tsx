import { GraduationCap, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface TeacherEmptyStateProps {
  onReset: () => void
  hasActiveFilters?: boolean
}

export function TeacherEmptyState({
  onReset,
  hasActiveFilters = true,
}: TeacherEmptyStateProps) {
  return (
    <div
      role="region"
      aria-label="Aucun enseignant trouvé"
      className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border bg-card/50 max-w-lg mx-auto my-8 space-y-4"
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
        <GraduationCap className="size-7" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">
          Aucun enseignant correspondant
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Essayez d&apos;élargir vos critères de recherche (spécialités, niveaux ou créneaux)
          pour découvrir l&apos;ensemble des formateurs certifiés TEF Canada.
        </p>
      </div>

      {hasActiveFilters && (
        <Button
          onClick={onReset}
          variant="outline"
          size="sm"
          className="cursor-pointer gap-2 text-xs font-semibold mt-2"
        >
          <RotateCcw className="size-3.5" />
          <span>Réinitialiser les filtres</span>
        </Button>
      )}
    </div>
  )
}
