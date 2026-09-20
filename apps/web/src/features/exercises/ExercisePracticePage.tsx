/**
 * ExercisePracticePage Component.
 * The top-level orchestrator for the Student Exercise Player experience at /exercises/:id.
 * Composes FocusedPracticeShell with ExerciseProgress, ExerciseQuestion,
 * ExerciseAnswerGroup, ExerciseFeedback, ExerciseExplanation, and ExerciseCompletion.
 */

import React, { useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { AlertTriangle, WifiOff, RotateCcw, ArrowLeft, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FocusedPracticeShell } from "@/components/layout/FocusedPracticeShell"
import { ExerciseProgress } from "./components/ExerciseProgress"
import { ExerciseQuestion } from "./components/ExerciseQuestion"
import { ExerciseAnswerGroup } from "./components/ExerciseAnswerGroup"
import { ExerciseFeedback } from "./components/ExerciseFeedback"
import { ExerciseExplanation } from "./components/ExerciseExplanation"
import { ExerciseNavigation } from "./components/ExerciseNavigation"
import { ExerciseCompletion } from "./components/ExerciseCompletion"
import { ExerciseSkeleton } from "./components/ExerciseSkeleton"
import { useExercisePlayer } from "./useExercisePlayer"
import { telemetry } from "@/features/analytics/telemetry"

export const ExercisePracticePage: React.FC = () => {
  const { id: exerciseId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    exercise,
    state,
    selectedOptionIndex,
    selectedOptionIndices,
    textResponse,
    result,
    pastAttempts,
    recommendation,
    timeSpentSeconds,
    error,
    networkError,
    isAnswered,
    selectOption,
    toggleOption,
    setTextResponse,
    submitAnswer,
    retrySubmission,
    retryQuestion,
    completeExercise,
    restartExercise,
    refetch,
  } = useExercisePlayer(exerciseId)

  // Redirect writing/speaking exercises to dedicated feature routes
  useEffect(() => {
    if (!exercise) return
    const cat = (exercise.category || "").toLowerCase()
    if (cat.includes("writing") || cat.includes("écrite") && exercise.question_type === "free_text") {
      navigate(`/writing/tasks/${exercise.id}`, { replace: true })
    } else if (cat.includes("speaking") || cat.includes("orale") && exercise.question_type === "audio_response") {
      navigate(`/speaking`, { replace: true })
    }
  }, [exercise, navigate])

  // 1. Loading State (Stable skeleton)
  if (state === "loading") {
    return (
      <FocusedPracticeShell
        title="Chargement de l'exercice..."
        onExitClick={() => navigate("/practice")}
      >
        <ExerciseSkeleton />
      </FocusedPracticeShell>
    )
  }

  // 2. Error / Unavailable State
  if (state === "error" || !exercise) {
    const isNotFound = error?.toLowerCase().includes("disponible")
    return (
      <FocusedPracticeShell
        title="Exercice"
        onExitClick={() => navigate("/practice")}
      >
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-2xl border border-destructive/20 bg-destructive/10 p-6 sm:p-8 text-center space-y-4 max-w-md mx-auto my-8 shadow-xs"
        >
          <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive mx-auto">
            <AlertTriangle className="size-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              {isNotFound ? "Cet exercice n'est plus disponible." : "Impossible de charger cet exercice."}
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isNotFound
                ? "La ressource d'entraînement demandée a été retirée ou n'est plus publiée."
                : (error || "Une erreur est survenue lors du chargement de la ressource d'entraînement.")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            {!isNotFound && (
              <Button
                variant="outline"
                size="sm"
                onClick={refetch}
                className="w-full sm:w-auto cursor-pointer rounded-xl font-semibold gap-1.5 border-border/80"
              >
                <RotateCcw className="size-3.5" />
                <span>Réessayer</span>
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => navigate("/practice")}
              className="w-full sm:w-auto cursor-pointer rounded-xl font-semibold gap-1.5"
            >
              <ArrowLeft className="size-3.5" />
              <span>Retour à la pratique</span>
            </Button>
          </div>
        </div>
      </FocusedPracticeShell>
    )
  }

  // 3. Completed State
  if (state === "completed") {
    const scoreAwarded = result?.points_awarded ?? (result?.is_correct ? exercise.points : 0)
    const totalPoints = exercise.points
    const accuracy = totalPoints > 0 ? (scoreAwarded / totalPoints) * 100 : result?.is_correct ? 100 : 0

    return (
      <FocusedPracticeShell
        title={exercise.title}
        category={exercise.category}
        level={exercise.level}
        estimatedDurationMinutes={exercise.estimated_duration_minutes || (exercise.difficulty ? exercise.difficulty * 3 : 5)}
        onExitClick={() => navigate("/practice")}
      >
        <ExerciseCompletion
          score={scoreAwarded}
          totalPoints={totalPoints}
          accuracy={accuracy}
          timeSpentSeconds={timeSpentSeconds}
          skills={exercise.skills}
          category={exercise.category}
          isCorrect={result?.is_correct ?? false}
          recommendation={recommendation}
          onStartRecommendation={(rec) => {
            telemetry.track("exercise_recommendation_clicked", {
              source_exercise_id: exercise.id,
              target_entity_id: rec.entity_id,
            })
            navigate(`/exercises/${rec.entity_id}`)
          }}
          onRestart={restartExercise}
          onReturnToPractice={() => navigate("/practice")}
        />
      </FocusedPracticeShell>
    )
  }

  // 4. Active Practice State (Ready / Submitting / Feedback / Network Error)
  const isFeedback = state === "feedback"
  const hasPastAttempt = pastAttempts.length > 0 && !result && state === "ready"
  const lastAttempt = pastAttempts[0]

  return (
    <FocusedPracticeShell
      title={exercise.title}
      category={exercise.category}
      level={exercise.level}
      estimatedDurationMinutes={exercise.estimated_duration_minutes || (exercise.difficulty ? exercise.difficulty * 3 : 5)}
      questionNumber={1}
      totalQuestions={1}
      onExitClick={() => navigate("/practice")}
    >
      <div className="space-y-6">
        {/* Progress indicator */}
        <ExerciseProgress current={1} total={1} />

        {/* Previous Attempt Banner (if returning student) */}
        {hasPastAttempt && lastAttempt && (
          <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 sm:p-4 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <History className="size-4 text-primary shrink-0" />
              <span>
                Dernière tentative :{" "}
                <strong className="text-foreground">
                  {lastAttempt.is_correct ? "Réussi" : "À consolider"}
                </strong>{" "}
                ({lastAttempt.points_awarded} pts)
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={restartExercise}
              className="text-xs h-7 px-2.5 cursor-pointer text-primary hover:text-primary"
            >
              Recommencer
            </Button>
          </div>
        )}

        {/* Network Error Banner with Retry */}
        {state === "network_error" && networkError && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-destructive shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <WifiOff className="size-4 shrink-0" />
              <span className="font-semibold">
                Votre réponse n'a pas pu être enregistrée. Votre réponse locale est conservée.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={retrySubmission}
              className="shrink-0 cursor-pointer rounded-lg font-semibold gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              <RotateCcw className="size-3.5" />
              <span>Réessayer</span>
            </Button>
          </div>
        )}

        {/* Central Question & Answer Card */}
        <ExerciseQuestion
          prompt={exercise.prompt}
          instructions={exercise.instructions}
          category={exercise.category}
          passageText={exercise.passage_text}
          mediaUrl={exercise.media_url}
          allowReplay={exercise.allow_replay ?? true}
          maxReplays={exercise.max_replays ?? 3}
        >
          <ExerciseAnswerGroup
            questionType={exercise.question_type}
            options={exercise.options}
            selectedOptionIndex={selectedOptionIndex}
            selectedOptionIndices={selectedOptionIndices}
            textResponse={textResponse}
            onSelectOption={selectOption}
            onToggleOption={toggleOption}
            onChangeText={setTextResponse}
            onSubmit={submitAnswer}
            disabled={state === "submitting" || isFeedback}
            result={result}
          />
        </ExerciseQuestion>

        {/* Immediate Feedback (when checked) */}
        {isFeedback && result && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <ExerciseFeedback result={result} showCorrectAnswer={true} />
            <ExerciseExplanation
              explanation={result.explanation}
              skills={exercise.skills}
              category={exercise.category}
            />
          </div>
        )}

        {/* Navigation Action Buttons */}
        <ExerciseNavigation
          state={state}
          isAnswered={isAnswered}
          isCorrect={result?.is_correct}
          onSubmit={submitAnswer}
          onRetry={retryQuestion}
          onContinue={completeExercise}
          allowRetry={!result?.is_correct}
          isSubmitting={state === "submitting"}
        />
      </div>
    </FocusedPracticeShell>
  )
}
