/**
 * WritingResultPage Component.
 * The student-facing Writing Result & Correction Experience (/writing/:attemptId/result).
 * Turns submitted writing into an actionable, structured, and pedagogical learning experience.
 */

import React, { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StudentLayout } from "@/features/dashboard/StudentLayout"
import { PageShell } from "@/components/layout/PageShell"
import { useWritingResult } from "./useWritingResult"
import { WritingResultHeader } from "./components/WritingResultHeader"
import { WritingResultSummary } from "./components/WritingResultSummary"
import { CorrectionPendingState } from "./components/CorrectionPendingState"
import { WritingStrengthsImprovements } from "./components/WritingStrengthsImprovements"
import { WritingEvaluatorFeedback } from "./components/WritingEvaluatorFeedback"
import { WritingResponseViewer } from "./components/WritingResponseViewer"
import { WritingAnnotatedCorrections } from "./components/WritingAnnotatedCorrections"
import { WritingRecommendationsList } from "./components/WritingRecommendationsList"
import { WritingResultSkeleton } from "./components/WritingResultSkeleton"
import type { WritingRecommendation } from "./types"

export const WritingResultPage: React.FC = () => {
  const { id: attemptId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    result,
    recommendations,
    isLoading,
    isRefreshing,
    error,
    isPending,
    refetch,
  } = useWritingResult(attemptId)

  const [activeTab, setActiveTab] = useState<"overview" | "corrections" | "response" | "recommendations">("overview")

  // 1. Loading State
  if (isLoading) {
    return (
      <StudentLayout>
        <PageShell>
          <WritingResultSkeleton />
        </PageShell>
      </StudentLayout>
    )
  }

  // 2. Error State (Not Found or Unauthorized)
  if (error || !result) {
    return (
      <StudentLayout>
        <PageShell>
          <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
            <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive border border-destructive/20 mb-4">
              <AlertTriangle className="size-7" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              {error || "Résultat introuvable"}
            </h1>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Impossible d'accéder aux résultats de cette rédaction. Veuillez vérifier que vous disposez des droits d'accès ou sélectionner une copie depuis votre atelier d'écriture.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate("/writing")}
                className="cursor-pointer gap-2"
              >
                <ArrowLeft className="size-4" />
                <span>Retour aux rédactions</span>
              </Button>
              <Button
                onClick={() => navigate("/practice?category=writing")}
                className="cursor-pointer"
              >
                Nouvel essai
              </Button>
            </div>
          </div>
        </PageShell>
      </StudentLayout>
    )
  }

  const { task, content, word_count, submitted_at, status, correction } = result

  // 3. Pending Correction State (Waiting for AI or Teacher Review)
  if (isPending || !correction) {
    return (
      <StudentLayout>
        <PageShell>
          <div className="space-y-6">
            <WritingResultHeader
              taskTitle={task.title}
              taskType={task.task_type}
              status={status}
              provider={correction?.provider}
              submittedAt={submitted_at}
              onBack={() => navigate("/writing")}
              onPracticeClick={() => navigate("/practice?category=writing")}
            />

            <CorrectionPendingState
              taskTitle={task.title}
              taskPrompt={task.prompt}
              content={content}
              wordCount={word_count}
              submittedAt={submitted_at}
              status={status}
              isTeacherReview={correction?.provider === "teacher" || status === "assigned" || status === "in_review"}
              isRefreshing={isRefreshing}
              onRefresh={refetch}
            />
          </div>
        </PageShell>
      </StudentLayout>
    )
  }

  // 4. Completed & Corrected Result State
  const handleRecommendationAction = (rec: WritingRecommendation) => {
    if (rec.action_url) {
      navigate(rec.action_url)
    } else {
      navigate("/practice")
    }
  }

  return (
    <StudentLayout>
      <PageShell>
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
          {/* Header */}
          <WritingResultHeader
            taskTitle={task.title}
            taskType={task.task_type}
            status={status}
            provider={correction.provider}
            submittedAt={submitted_at}
            onBack={() => navigate("/writing")}
            onPracticeClick={() => navigate("/practice?category=writing")}
          />

          {/* Top Result Summary */}
          <WritingResultSummary
            estimatedLevel={correction.estimated_level}
            score={correction.score}
            wordCount={word_count}
            minWords={task.min_words}
            maxWords={task.max_words}
            criteria={{
              taskCompletion: correction.task_completion,
              coherence: correction.coherence,
              vocabulary: correction.vocabulary,
              grammar: correction.grammar,
              syntax: correction.syntax,
              spelling: correction.spelling,
              register: correction.register,
            }}
            disclaimer={correction.disclaimer}
          />

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border ${
                activeTab === "overview"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
              }`}
            >
              Vue d'ensemble
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("corrections")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border ${
                activeTab === "corrections"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
              }`}
            >
              Corrections détaillées ({correction.items?.length || 0})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("response")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border ${
                activeTab === "response"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
              }`}
            >
              Votre copie
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("recommendations")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border ${
                activeTab === "recommendations"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
              }`}
            >
              Recommandations ({recommendations.length})
            </button>
          </div>

          {/* Tab 1: Overview */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Strengths and Improvements */}
              <WritingStrengthsImprovements
                strengths={correction.strengths || []}
                weaknesses={correction.weaknesses || []}
              />

              {/* Evaluator Commentary */}
              <WritingEvaluatorFeedback
                provider={correction.provider}
                comments={correction.comments}
                correctedByUserId={correction.corrected_by_user_id}
                createdAt={correction.created_at}
              />

              {/* Quick Recommendations Preview */}
              {recommendations.length > 0 && (
                <WritingRecommendationsList
                  recommendations={recommendations.slice(0, 2)}
                  onActionClick={handleRecommendationAction}
                />
              )}
            </div>
          )}

          {/* Tab 2: Detailed Annotated Corrections */}
          {activeTab === "corrections" && (
            <WritingAnnotatedCorrections
              items={correction.items || []}
              onSelectSkill={(skillId) => navigate(`/practice?skill=${skillId}`)}
            />
          )}

          {/* Tab 3: Student Response (Read-Only) */}
          {activeTab === "response" && (
            <WritingResponseViewer
              content={content}
              wordCount={word_count}
              taskPrompt={task.prompt}
              stimulusText={task.stimulus_text}
            />
          )}

          {/* Tab 4: Full Recommendations */}
          {activeTab === "recommendations" && (
            <WritingRecommendationsList
              recommendations={recommendations}
              onActionClick={handleRecommendationAction}
            />
          )}
        </div>
      </PageShell>
    </StudentLayout>
  )
}
export default WritingResultPage
