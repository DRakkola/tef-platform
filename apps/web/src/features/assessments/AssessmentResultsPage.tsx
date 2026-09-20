/**
 * Student Assessment Results Page (/attempts/:id/results).
 * Converts post-assessment evaluation data into an actionable educational roadmap.
 * Adheres to the core flow: RESULT → EXPLANATION → WEAKNESS → ACTION.
 */

import React, { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { LayoutDashboard, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/common/ErrorState"
import { PageShell } from "@/components/layout/PageShell"
import { StudentLayout } from "@/features/dashboard/StudentLayout"
import { useAssessmentResults } from "./useAssessmentResults"
import { AssessmentResultHero } from "./components/AssessmentResultHero"
import { ResultSummary } from "./components/ResultSummary"
import { SectionResults } from "./components/SectionResults"
import { SkillBreakdown } from "./components/SkillBreakdown"
import { StrengthsSection } from "./components/StrengthsSection"
import { WeaknessesSection } from "./components/WeaknessesSection"
import { MistakesSummary } from "./components/MistakesSummary"
import { MistakeReview } from "./components/MistakeReview"
import { NextStepCard } from "./components/NextStepCard"
import { ProgressComparison } from "./components/ProgressComparison"
import { ResultHistory } from "./components/ResultHistory"
import { ReadinessUpdateCard } from "./components/ReadinessUpdateCard"
import { DailyPlanHandoffCard } from "./components/DailyPlanHandoffCard"
import { AssessmentResultsSkeleton } from "./components/AssessmentResultsSkeleton"

export const AssessmentResultsPage: React.FC = () => {
  const { id: attemptId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [isMistakesReviewOpen, setIsMistakesReviewOpen] = useState<boolean>(false)

  const {
    results,
    readiness,
    history,
    dailyPlan,
    comparison,
    isLoading,
    error,
    refetch,
  } = useAssessmentResults(attemptId)

  // 1. Loading State
  if (isLoading) {
    return (
      <StudentLayout>
        <PageShell maxWidth="default">
          <AssessmentResultsSkeleton />
        </PageShell>
      </StudentLayout>
    )
  }

  // 2. Error State (Normalized, no raw codes or stack traces)
  if (error || !results) {
    return (
      <StudentLayout>
        <PageShell maxWidth="default">
          <ErrorState
            title="Résultats non disponibles"
            description={error || "Impossible d'accéder aux résultats de cette évaluation."}
            actionLabel="Retour au tableau de bord"
            onAction={() => navigate("/dashboard")}
            onRetry={refetch}
          />
        </PageShell>
      </StudentLayout>
    )
  }

  const score = results.score
  const primaryRec = results.recommended_exercises?.[0] || null
  const secondaryRecs = results.recommended_exercises?.slice(1) || []

  // Section score summaries for ResultSummary
  const sectionSummaries = results.sections.map((s) => {
    const totalPts = s.questions.reduce((sum, q) => sum + (q.user_answer?.points_awarded || 0), 0)
    const maxPts = s.questions.reduce((sum, q) => sum + q.points, 0)
    return {
      title: s.title,
      percentage: maxPts > 0 ? (totalPts / maxPts) * 100 : 0,
    }
  })

  // Format date of assessment
  const formattedDate = results.submitted_at || results.started_at
    ? new Date(results.submitted_at || results.started_at!).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

  return (
    <StudentLayout>
      <PageShell maxWidth="default">
        {/* Navigation Breadcrumb & Header Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/50">
          <div className="space-y-0.5">
            <nav aria-label="Fil d'Ariane" className="text-xs text-muted-foreground flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="hover:text-foreground cursor-pointer transition-colors"
              >
                Accueil
              </button>
              <span>&gt;</span>
              <button
                type="button"
                onClick={() => navigate("/assessments")}
                className="hover:text-foreground cursor-pointer transition-colors"
              >
                Simulations TEF
              </button>
              <span>&gt;</span>
              <span className="text-foreground font-semibold">Résultats</span>
            </nav>
            <div className="flex items-center gap-2 pt-0.5">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Résultats de l'évaluation
              </h1>
              {formattedDate && (
                <span className="text-xs text-muted-foreground">
                  • Épreuve du {formattedDate}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/assessments")}
              className="cursor-pointer text-xs gap-1.5 h-8"
            >
              <RotateCcw className="size-3.5" />
              <span>Autres simulations</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="cursor-pointer text-xs gap-1.5 h-8 text-muted-foreground hover:text-foreground"
            >
              <LayoutDashboard className="size-3.5" />
              <span>Tableau de bord</span>
            </Button>
          </div>
        </header>

        {/* 1. Primary Result Hero (Score, Level, Confidence, Disclaimer, Target) */}
        <AssessmentResultHero
          scorePercentage={score.percentage}
          totalPoints={score.total_points}
          maxPoints={score.max_points}
          estimatedLevel={score.estimated_level}
          confidenceLabel={readiness?.confidence_label}
          targetLevel={readiness?.target_level}
          targetGapExplanation={
            readiness?.summary_gaps?.[0]?.explanation || "Progression à poursuivre vers votre niveau cible"
          }
          isFirstDiagnostic={history.length <= 1}
          disclaimer={results.disclaimer}
        />

        {/* Main 2-Column Responsive Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Column: Analysis, Sections, Skills, Mistakes, Progress */}
          <div className="lg:col-span-8 space-y-6">
            {/* 2. Result Summary */}
            <ResultSummary
              scorePercentage={score.percentage}
              sectionScores={sectionSummaries}
            />

            {/* 3. Section Results */}
            <SectionResults sections={results.sections} />

            {/* 4. Subskill Breakdown */}
            <SkillBreakdown skillScores={score.skill_scores} />

            {/* 5. Strong Areas */}
            <StrengthsSection strengths={results.strengths} />

            {/* 6. Mistakes Summary & Detailed Review */}
            <div className="space-y-4">
              <MistakesSummary
                mistakes={results.mistakes}
                isReviewOpen={isMistakesReviewOpen}
                onToggleReview={() => setIsMistakesReviewOpen(!isMistakesReviewOpen)}
              />

              {isMistakesReviewOpen && (
                <div className="pt-2 animate-in fade-in-50 duration-200">
                  <MistakeReview mistakes={results.mistakes} />
                </div>
              )}
            </div>

            {/* 7. Progress Comparison (if comparable previous attempt exists) */}
            {comparison && (
              <ProgressComparison
                currentScorePercentage={score.percentage}
                comparison={comparison}
              />
            )}
          </div>

          {/* Secondary Action Column: Next Step, Weaknesses, Readiness, Daily Plan, History */}
          <div className="lg:col-span-4 space-y-6">
            {/* 1. Recommended Next Step (Primary Action Card) */}
            <NextStepCard
              primaryRecommendation={primaryRec}
              secondaryRecommendations={secondaryRecs}
              onStartExercise={(exerciseId) => navigate(`/exercises/${exerciseId}`)}
              onExplorePractice={() => navigate("/practice")}
            />

            {/* 2. Priority Weaknesses */}
            <WeaknessesSection
              weaknesses={results.weaknesses}
              onPracticeClick={() => navigate("/practice")}
            />

            {/* 3. Readiness Profile Update Notification */}
            <ReadinessUpdateCard
              onViewReadiness={() => navigate("/readiness")}
            />

            {/* 4. Daily Plan Handoff */}
            {dailyPlan.length > 0 && (
              <DailyPlanHandoffCard
                tasks={dailyPlan}
                onViewPlan={() => navigate("/practice")}
              />
            )}

            {/* 5. Recent Assessment History */}
            {history.length > 1 && (
              <ResultHistory
                history={history}
                currentAttemptId={results.attempt_id}
                onViewAllHistory={() => navigate("/progress")}
              />
            )}
          </div>
        </div>

        {/* Bottom Return Action */}
        <footer className="pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
          <Button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="w-full sm:w-auto cursor-pointer gap-2 font-semibold text-xs"
          >
            <span>Retourner au tableau de bord de progression</span>
          </Button>

          <Button
            type="button"
            onClick={() => navigate("/assessments")}
            variant="outline"
            className="w-full sm:w-auto cursor-pointer text-xs"
          >
            Passer une autre épreuve TEF
          </Button>
        </footer>
      </PageShell>
    </StudentLayout>
  )
}
