import React, { useMemo } from "react"
import { BookOpen } from "lucide-react"
import { EmptyState } from "@/components/common/EmptyState"
import { AssessmentCard } from "./AssessmentCard"
import { AssessmentFilters } from "./AssessmentFilters"
import type {
  AssessmentListItem,
  AssessmentFiltersState,
  AssessmentHistoryItem,
} from "./types"

export interface AssessmentSectionProps {
  assessments: AssessmentListItem[]
  filters: AssessmentFiltersState
  onFilterChange: (filters: AssessmentFiltersState) => void
  onResetFilters: () => void
  activeAttemptId?: string
  history?: AssessmentHistoryItem[]
  onStartAssessment?: (assessment: AssessmentListItem) => void
}

export const AssessmentSection: React.FC<AssessmentSectionProps> = ({
  assessments,
  filters,
  onFilterChange,
  onResetFilters,
  activeAttemptId,
  history = [],
  onStartAssessment,
}) => {
  // Filter logic across type, level, duration, and search query
  const filteredAssessments = useMemo(() => {
    return assessments.filter((asmt) => {
      // 1. Type filter
      if (filters.type !== "all" && asmt.assessment_type !== filters.type) {
        return false
      }

      // 2. Level filter
      if (filters.level !== "all") {
        const itemLevel = (asmt.level || "").toUpperCase()
        if (!itemLevel.includes(filters.level.toUpperCase())) {
          return false
        }
      }

      // 3. Duration filter
      const durationMins = asmt.estimated_completion_time_minutes || Math.round(asmt.duration_seconds / 60)
      if (filters.duration === "short" && durationMins >= 45) {
        return false
      }
      if (filters.duration === "medium" && (durationMins < 45 || durationMins > 60)) {
        return false
      }
      if (filters.duration === "long" && durationMins <= 60) {
        return false
      }

      // 4. Search query
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase().trim()
        const titleMatch = asmt.title.toLowerCase().includes(q)
        const descMatch = (asmt.description || "").toLowerCase().includes(q)
        if (!titleMatch && !descMatch) {
          return false
        }
      }

      return true
    })
  }, [assessments, filters])

  // Map latest attempt per assessment
  const attemptsByAssessmentId = useMemo(() => {
    const map = new Map<string, AssessmentHistoryItem>()
    for (const item of history) {
      if (!map.has(item.assessment_id)) {
        map.set(item.assessment_id, item)
      }
    }
    return map
  }, [history])

  return (
    <section className="space-y-6" aria-labelledby="simulations-catalog-heading">
      {/* Section Header */}
      <div className="flex flex-col gap-1 sm:gap-1.5">
        <h2
          id="simulations-catalog-heading"
          className="text-xl font-bold tracking-tight text-foreground sm:text-2xl"
        >
          Simulations complètes
        </h2>
        <p className="text-sm text-muted-foreground">
          Épreuves complètes chronométrées pour tester vos compétences en conditions réelles d'examen.
        </p>
      </div>

      {/* Filter Controls */}
      <AssessmentFilters
        filters={filters}
        onChange={onFilterChange}
        onReset={onResetFilters}
        totalMatches={filteredAssessments.length}
      />

      {/* Content: Cards Grid or Empty State */}
      {filteredAssessments.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Aucune simulation trouvée"
          description="Aucune épreuve ne correspond à vos filtres actuels. Essayez d'ajuster ou de réinitialiser vos critères."
          actionLabel="Réinitialiser les filtres"
          onAction={onResetFilters}
        />
      ) : (
        <div
          data-testid="assessments-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
        >
          {filteredAssessments.map((assessment) => {
            const last = attemptsByAssessmentId.get(assessment.id)
            return (
              <AssessmentCard
                key={assessment.id}
                assessment={assessment}
                activeAttemptId={activeAttemptId}
                lastAttempt={
                  last
                    ? {
                        id: last.id,
                        status: last.status,
                        score_percentage: last.score_percentage,
                        submitted_at: last.submitted_at,
                      }
                    : undefined
                }
                onStart={onStartAssessment}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
