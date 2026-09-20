import React, { useMemo } from "react"
import { Compass, Dumbbell, AlertCircle, RefreshCw } from "lucide-react"
import { EmptyState } from "@/components/common/EmptyState"
import { Button } from "@/components/ui/button"
import { PracticeFilters } from "./PracticeFilters"
import { PracticeExerciseCard } from "./PracticeExerciseCard"
import type { PracticeExerciseItem, PracticeFiltersState } from "./types"

export interface ExplorePracticeSectionProps {
  exercises: PracticeExerciseItem[]
  filters: PracticeFiltersState
  onFiltersChange: (filters: PracticeFiltersState) => void
  onResetFilters: () => void
  isLoading?: boolean
  error?: Error | null
  onRetry?: () => void
  onStartExercise?: (exercise: PracticeExerciseItem) => void
}

export const ExplorePracticeSection: React.FC<ExplorePracticeSectionProps> = ({
  exercises,
  filters,
  onFiltersChange,
  onResetFilters,
  isLoading = false,
  error = null,
  onRetry,
  onStartExercise,
}) => {
  // Client-side filtering across category, level, and search keywords
  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      const matchesCategory =
        filters.category === "all" ||
        ex.category.toLowerCase() === filters.category.toLowerCase()

      const matchesLevel =
        filters.level === "all" ||
        ex.level.toUpperCase() === filters.level.toUpperCase()

      const query = filters.search.trim().toLowerCase()
      const matchesQuery =
        query === "" ||
        ex.title.toLowerCase().includes(query) ||
        ex.category.toLowerCase().includes(query) ||
        (ex.instructions && ex.instructions.toLowerCase().includes(query)) ||
        (ex.prompt && ex.prompt.toLowerCase().includes(query))

      return matchesCategory && matchesLevel && matchesQuery
    })
  }, [exercises, filters])

  return (
    <section id="explore-catalog" className="space-y-5 pt-2" data-testid="explore-practice-section">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
              <Compass className="size-3.5" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              Explorer les exercices
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Parcourez notre catalogue d'exercices ciblés par modalité et niveau pour vous entraîner à votre rythme.
          </p>
        </div>

        <div className="text-xs font-mono tabular-nums text-muted-foreground">
          {filteredExercises.length} exercice{filteredExercises.length > 1 ? "s" : ""} disponible{filteredExercises.length > 1 ? "s" : ""}
        </div>
      </div>

      {/* Filters (Desktop pills + Mobile Sheet) */}
      <PracticeFilters
        filters={filters}
        onChange={onFiltersChange}
        onReset={onResetFilters}
        totalMatches={filteredExercises.length}
      />

      {/* Error state isolation */}
      {error && !isLoading ? (
        <div className="p-6 rounded-xl border border-destructive/30 bg-destructive/5 text-center space-y-3">
          <AlertCircle className="size-6 text-destructive mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              Impossible de charger le catalogue
            </h3>
            <p className="text-xs text-muted-foreground">
              Une difficulté est survenue lors de la récupération des exercices.
            </p>
          </div>
          {onRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="cursor-pointer text-xs gap-1.5"
            >
              <RefreshCw className="size-3" />
              <span>Réessayer</span>
            </Button>
          )}
        </div>
      ) : isLoading ? (
        /* Skeletons */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-48 rounded-xl bg-card border border-border/60 animate-pulse p-5 space-y-3"
            >
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-5 w-3/4 bg-muted rounded" />
              <div className="h-10 w-full bg-muted/60 rounded" />
              <div className="h-8 w-full bg-muted rounded mt-4" />
            </div>
          ))}
        </div>
      ) : filteredExercises.length === 0 ? (
        /* Empty State */
        <EmptyState
          icon={Dumbbell}
          title="Aucun exercice trouvé"
          description="Aucune activité ne correspond à vos critères actuels. Essayez de réinitialiser vos filtres ou de modifier votre mot-clé de recherche."
          actionLabel="Afficher tous les exercices"
          onAction={onResetFilters}
        />
      ) : (
        /* Exercise Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExercises.map((exercise) => (
            <PracticeExerciseCard
              key={exercise.id}
              exercise={exercise}
              onStart={onStartExercise}
            />
          ))}
        </div>
      )}
    </section>
  )
}
