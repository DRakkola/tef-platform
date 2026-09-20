/**
 * Student Active Assessment Taking Page (/attempts/:id).
 * Distraction-free, reading-optimized environment for candidates taking high-stakes evaluations.
 * Features server-synchronized timer, debounced autosave, accessible radio groups, and safe submission.
 */

import React, { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Award, Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorState } from "@/components/common/ErrorState"
import { useActiveAttempt } from "./useActiveAttempt"
import { ExamHeader } from "./components/ExamHeader"
import { ExamConnectionStatus } from "./components/ExamConnectionStatus"
import { ReadingLayout } from "./components/ReadingLayout"
import { ListeningLayout } from "./components/ListeningLayout"
import { SubmitAssessmentDialog } from "./components/SubmitAssessmentDialog"

export const AssessmentTakingPage: React.FC = () => {
  const { id: attemptId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false)
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false)

  const {
    attempt,
    assessment,
    allQuestions,
    activeQuestionIndex,
    currentQuestionItem,
    answersMap,
    flaggedQuestions,
    remainingSeconds,
    timerSeverity,
    saveStatus,
    isOnline,
    isSubmitting,
    isLoading,
    isExpired,
    isAlreadySubmitted,
    error,
    answeredCount,
    totalQuestions,
    isFirstQuestion,
    isLastQuestion,
    selectOption,
    goToQuestion,
    nextQuestion,
    prevQuestion,
    toggleFlag,
    submitAttempt,
  } = useActiveAttempt(attemptId)

  // Browser beforeunload protection during active exam
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isAlreadySubmitted && !isExpired && remainingSeconds !== null && remainingSeconds > 0) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isAlreadySubmitted, isExpired, remainingSeconds])

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">
            Restauration de la session d'examen...
          </p>
        </div>
      </div>
    )
  }

  // 2. Already Submitted Attempt State
  if (isAlreadySubmitted) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-border/80 bg-card shadow-lg text-center p-6 space-y-4">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Award className="size-6" />
          </div>
          <CardHeader className="p-0 space-y-1">
            <CardTitle className="text-lg font-bold text-foreground">
              Cette évaluation est terminée
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Vos réponses ont déjà été transmises et enregistrées sur le serveur.
            </p>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <Button
              onClick={() => navigate(`/attempts/${attemptId}/results`)}
              className="w-full cursor-pointer font-semibold text-xs gap-1.5 h-10 shadow-xs"
            >
              <span>Voir le résultat</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 3. Expired Attempt State
  if (isExpired) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-border/80 bg-card shadow-lg text-center p-6 space-y-4">
          <div className="size-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <Clock className="size-6" />
          </div>
          <CardHeader className="p-0 space-y-1">
            <CardTitle className="text-lg font-bold text-foreground">
              Temps écoulé
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Le temps imparti pour cette évaluation est terminé. Votre session a été finalisée.
            </p>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <Button
              onClick={() => navigate(`/attempts/${attemptId}/results`)}
              className="w-full cursor-pointer font-semibold text-xs gap-1.5 h-10 shadow-xs"
            >
              <span>Voir le résultat</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 4. Error / Missing Session State
  if (error || !assessment || !attempt || !currentQuestionItem) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <ErrorState
          title="Session introuvable"
          description={error || "Impossible d'accéder aux questions de cette épreuve."}
          actionLabel="Retour au tableau de bord"
          onAction={() => navigate("/dashboard")}
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  // 5. Final Submit Confirmation Action
  const handleConfirmSubmit = async () => {
    const success = await submitAttempt()
    if (success) {
      navigate(`/attempts/${attemptId}/results`, { replace: true })
    }
  }

  // Determine if this question/assessment requires the Listening layout
  const isListening =
    assessment.assessment_type === "listening" ||
    Boolean(currentQuestionItem.mediaUrl && !currentQuestionItem.passageText)

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none antialiased">
      {/* Offline Alert Banner */}
      <ExamConnectionStatus isOnline={isOnline} />

      {/* Distraction-Free Header */}
      <ExamHeader
        title={assessment.title}
        sectionTitle={currentQuestionItem.sectionTitle}
        questionNumber={activeQuestionIndex + 1}
        totalQuestions={totalQuestions}
        answeredCount={answeredCount}
        remainingSeconds={remainingSeconds}
        timerSeverity={timerSeverity}
        saveStatus={saveStatus}
        isOnline={isOnline}
        onExitClick={() => {
          if (window.confirm("Votre évaluation est en cours. Êtes-vous sûr de vouloir quitter ?")) {
            navigate("/dashboard")
          }
        }}
        onSubmitClick={() => setShowSubmitModal(true)}
        isSubmitting={isSubmitting}
        onToggleDrawer={() => setIsPaletteOpen(!isPaletteOpen)}
        drawerOpen={isPaletteOpen}
      />

      {/* Main Workspace (Reading Passage / Listening Audio + Question + Bottom Navigation + Sticky Navigator) */}
      <div className="flex-1 flex overflow-y-auto">
        {isListening ? (
          <ListeningLayout
            currentQuestionItem={currentQuestionItem}
            activeQuestionIndex={activeQuestionIndex}
            totalQuestions={totalQuestions}
            allQuestions={allQuestions}
            answersMap={answersMap}
            flaggedQuestions={flaggedQuestions}
            isExamExpired={isExpired}
            isExamSubmitted={isAlreadySubmitted}
            onSelectOption={selectOption}
            onSelectQuestion={goToQuestion}
            onPrevious={prevQuestion}
            onNext={nextQuestion}
            onSubmit={() => setShowSubmitModal(true)}
            onToggleFlag={toggleFlag}
            isFirstQuestion={isFirstQuestion}
            isLastQuestion={isLastQuestion}
            isPaletteOpen={isPaletteOpen}
            onClosePalette={() => setIsPaletteOpen(false)}
            disabled={isSubmitting}
          />
        ) : (
          <ReadingLayout
            currentQuestionItem={currentQuestionItem}
            activeQuestionIndex={activeQuestionIndex}
            totalQuestions={totalQuestions}
            allQuestions={allQuestions}
            answersMap={answersMap}
            flaggedQuestions={flaggedQuestions}
            onSelectOption={selectOption}
            onSelectQuestion={goToQuestion}
            onPrevious={prevQuestion}
            onNext={nextQuestion}
            onSubmit={() => setShowSubmitModal(true)}
            onToggleFlag={toggleFlag}
            isFirstQuestion={isFirstQuestion}
            isLastQuestion={isLastQuestion}
            isPaletteOpen={isPaletteOpen}
            onClosePalette={() => setIsPaletteOpen(false)}
            disabled={isSubmitting}
          />
        )}
      </div>

      {/* Submission Confirmation Modal */}
      <SubmitAssessmentDialog
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleConfirmSubmit}
        isSubmitting={isSubmitting}
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
      />
    </div>
  )
}
