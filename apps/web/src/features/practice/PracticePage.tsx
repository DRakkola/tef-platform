import React, { useState, useMemo, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { PageShell } from "@/components/layout/PageShell"
import { StudentLayout } from "@/features/dashboard/StudentLayout"
import { ErrorState } from "@/components/common/ErrorState"
import { PracticeHeader } from "./PracticeHeader"
import { RecommendedPracticeSection } from "./RecommendedPracticeSection"
import { DailyPracticePlan } from "./DailyPracticePlan"
import { PracticeCategories } from "./PracticeCategories"
import { ExplorePracticeSection } from "./ExplorePracticeSection"
import { RecentPractice } from "./RecentPractice"
import { PracticeSkeleton } from "./PracticeSkeleton"
import { usePractice, AuthRequiredError } from "./usePractice"
import type { PracticeFiltersState } from "./types"

export const PracticePage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState<PracticeFiltersState>({
    category: searchParams.get("category") || "all",
    level: searchParams.get("level") || "all",
    difficulty: searchParams.get("difficulty") || "all",
    duration: searchParams.get("duration") || "all",
    search: searchParams.get("q") || "",
  })

  // Sync URL params when filters state changes
  const handleFiltersChange = (newFilters: PracticeFiltersState) => {
    setFilters(newFilters)
    const params: Record<string, string> = {}
    if (newFilters.category !== "all") params.category = newFilters.category
    if (newFilters.level !== "all") params.level = newFilters.level
    if (newFilters.search.trim() !== "") params.q = newFilters.search.trim()
    setSearchParams(params, { replace: true })
  }

  // Update local filters if user navigates back/forward
  useEffect(() => {
    const urlCategory = searchParams.get("category") || "all"
    const urlLevel = searchParams.get("level") || "all"
    const urlSearch = searchParams.get("q") || ""
    setFilters((prev) => {
      if (
        prev.category === urlCategory &&
        prev.level === urlLevel &&
        prev.search === urlSearch
      ) {
        return prev
      }
      return {
        ...prev,
        category: urlCategory,
        level: urlLevel,
        search: urlSearch,
      }
    })
  }, [searchParams])

  const handleResetFilters = () => {
    const resetState: PracticeFiltersState = {
      category: "all",
      level: "all",
      difficulty: "all",
      duration: "all",
      search: "",
    }
    setFilters(resetState)
    setSearchParams({}, { replace: true })
  }

  const {
    recommendations,
    dailyPlan,
    exercises,
    recentAttempts,
    isLoading,
    error,
  } = usePractice()

  // Compute live count of exercises per category
  const exerciseCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    exercises.forEach((ex) => {
      const cat = ex.category.toLowerCase()
      counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  }, [exercises])

  // Handle Auth error gracefully without leaking raw status codes
  const isAuthError =
    error instanceof AuthRequiredError ||
    (error && error.message && error.message.includes("AUTH_REQUIRED"))

  if (isAuthError) {
    return (
      <StudentLayout>
        <PageShell maxWidth="default">
          <ErrorState
            title="Session expirée"
            description="Votre session a expiré. Veuillez vous reconnecter pour accéder à vos recommandations et exercices d'entraînement."
            actionLabel="Se reconnecter"
            onAction={() => navigate("/login")}
          />
        </PageShell>
      </StudentLayout>
    )
  }

  if (isLoading) {
    return (
      <StudentLayout>
        <PageShell maxWidth="default">
          <PracticeSkeleton />
        </PageShell>
      </StudentLayout>
    )
  }

  return (
    <StudentLayout>
      <PageShell maxWidth="default" className="space-y-8">
        {/* Page Header */}
        <PracticeHeader
          totalCount={exercises.length}
          completedTodayCount={dailyPlan?.completed_tasks}
          totalTodayCount={dailyPlan?.total_tasks}
        />

        {/* 1. Recommended Practice Section (Hero & Secondary Cards) */}
        <RecommendedPracticeSection
              recommendations={recommendations}
              onTakeDiagnostic={() => navigate("/assessment")}
              onExploreClick={() => {
                const el = document.getElementById("explore-catalog")
                if (el) {
                  el.scrollIntoView({ behavior: "smooth" })
                }
              }}
              onStartAction={(rec) =>
                navigate(`/exercises/${rec.entity_id || rec.id}`)
              }
            />

            {/* 2. Today's Practice Plan Checklist */}
            <DailyPracticePlan
              dailyPlan={dailyPlan}
              onTaskClick={(task) => {
                if (task.target_entity_id) {
                  navigate(`/exercises/${task.target_entity_id}`)
                }
              }}
            />

            {/* 3. Practice Categories Accelerators (7 Canonical Modalities) */}
            <PracticeCategories
              activeCategory={filters.category}
              exerciseCounts={exerciseCounts}
              onSelectCategory={(categoryId) => {
                handleFiltersChange({
                  ...filters,
                  category: categoryId,
                })
              }}
            />

            {/* 4. Explore All Exercises (Search, Filters, Grid) */}
            <ExplorePracticeSection
              exercises={exercises}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onResetFilters={handleResetFilters}
              onStartExercise={(exercise) =>
                navigate(`/exercises/${exercise.id}`)
              }
            />

            {/* 5. Recent Practice Activity Feed */}
            <RecentPractice attempts={recentAttempts} />
      </PageShell>
    </StudentLayout>
  )
}
export default PracticePage
