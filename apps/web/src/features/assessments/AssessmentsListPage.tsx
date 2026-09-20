import React, { useState, useContext, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { QueryClient, QueryClientProvider, QueryClientContext } from "@tanstack/react-query"
import { PageShell } from "@/components/layout/PageShell"
import { StudentLayout } from "@/features/dashboard/StudentLayout"
import { ErrorState } from "@/components/common/ErrorState"
import { AssessmentLibraryHeader } from "./AssessmentLibraryHeader"
import { ActiveAttemptCard } from "./ActiveAttemptCard"
import { RecommendedAssessmentCard } from "./RecommendedAssessmentCard"
import { AssessmentSkillSection } from "./AssessmentSkillSection"
import { AssessmentSection } from "./AssessmentSection"
import { AssessmentHistory } from "./AssessmentHistory"
import { AssessmentLibrarySkeleton } from "./AssessmentLibrarySkeleton"
import { useAssessmentLibrary, AuthRequiredError } from "./useAssessmentLibrary"
import type { AssessmentFiltersState } from "./types"

const AssessmentsListPageInner: React.FC = () => {
  const navigate = useNavigate()

  const [filters, setFilters] = useState<AssessmentFiltersState>({
    type: "all",
    level: "all",
    duration: "all",
    search: "",
  })

  const {
    assessments,
    recommendation,
    activeAttempt,
    history,
    isLoading,
    isHistoryLoading,
    isRecommendationLoading,
    isError,
    error,
    refetch,
  } = useAssessmentLibrary()

  const resetFilters = () => {
    setFilters({
      type: "all",
      level: "all",
      duration: "all",
      search: "",
    })
  }

  // Handle Authentication Session Expiration
  if (error instanceof AuthRequiredError || (error as any)?.message === "AUTH_REQUIRED") {
    return (
      <StudentLayout>
        <PageShell maxWidth="default">
          <ErrorState
            title="Session expirée"
            description="Votre session a expiré ou une authentification est requise pour accéder aux simulations d'examen."
            actionLabel="Se reconnecter"
            onAction={() => {
              try {
                localStorage.removeItem("auth_token")
              } catch {
                // Ignore sandbox error
              }
              navigate("/login")
            }}
          />
        </PageShell>
      </StudentLayout>
    )
  }

  return (
    <StudentLayout>
      <PageShell maxWidth="default">
        {isLoading ? (
          <div data-testid="assessments-loading-container">
            <p className="sr-only">Chargement des épreuves disponibles...</p>
            <AssessmentLibrarySkeleton />
          </div>
        ) : isError && assessments.length === 0 ? (
          <ErrorState
            title="Impossible de charger les épreuves"
            description={(error as any)?.message || "Une erreur est survenue lors du chargement des simulations disponibles."}
            actionLabel="Réessayer"
            onRetry={refetch}
          />
        ) : (
          <div className="space-y-10 sm:space-y-12">
            {/* 1. Page Header */}
            <AssessmentLibraryHeader totalAssessments={assessments.length} />

            {/* 2. Active in-progress timed attempt banner */}
            {activeAttempt && (
              <ActiveAttemptCard attempt={activeAttempt} />
            )}

            {/* 3. Personalized Recommended Assessment Hero Card */}
            <RecommendedAssessmentCard
              recommendation={recommendation}
              isLoading={isRecommendationLoading}
            />

            {/* 4. Assessment by Skill Modality */}
            <AssessmentSkillSection
              assessments={assessments}
              onSelectSkill={(skill) => {
                setFilters((prev) => ({ ...prev, type: skill }))
                const element = document.getElementById("simulations-catalog-heading")
                if (element) {
                  element.scrollIntoView({ behavior: "smooth" })
                }
              }}
            />

            {/* 5. Complete Simulations Catalog Grid + Interactive Filters */}
            <AssessmentSection
              assessments={assessments}
              filters={filters}
              onFilterChange={setFilters}
              onResetFilters={resetFilters}
              activeAttemptId={activeAttempt?.id}
              history={history}
            />

            {/* 6. Assessment History Table / Card Feed */}
            <AssessmentHistory
              history={history}
              isLoading={isHistoryLoading}
              onStartFirst={() => {
                if (recommendation) {
                  navigate(`/assessments/${recommendation.assessment_id}`)
                } else if (assessments.length > 0) {
                  navigate(`/assessments/${assessments[0].id}`)
                }
              }}
            />
          </div>
        )}
      </PageShell>
    </StudentLayout>
  )
}

export const AssessmentsListPage: React.FC = () => {
  const existingClient = useContext(QueryClientContext)

  const fallbackClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 60 * 1000,
          },
        },
      }),
    []
  )

  if (!existingClient) {
    return (
      <QueryClientProvider client={fallbackClient}>
        <AssessmentsListPageInner />
      </QueryClientProvider>
    )
  }

  return <AssessmentsListPageInner />
}
