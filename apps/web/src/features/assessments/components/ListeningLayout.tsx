import React, { useMemo } from "react"
import { ListeningQuestionContext } from "./ListeningQuestionContext"
import { ListeningPlayer } from "./ListeningPlayer"
import { QuestionPanel } from "./QuestionPanel"
import { ExamNavigation } from "./ExamNavigation"
import { QuestionNavigator } from "./QuestionNavigator"
import type { ActiveQuestionItem, AudioPlaybackRules } from "../types"

export interface ListeningLayoutProps {
  currentQuestionItem: ActiveQuestionItem
  activeQuestionIndex: number
  totalQuestions: number
  allQuestions: ActiveQuestionItem[]
  answersMap: Record<string, any>
  flaggedQuestions: Set<string>
  isExamExpired?: boolean
  isExamSubmitted?: boolean
  playbackRules?: AudioPlaybackRules
  onSelectOption: (questionId: string, optionId: string) => void
  onSelectQuestion: (index: number) => void
  onPrevious: () => void
  onNext: () => void
  onSubmit: () => void
  onToggleFlag: (questionId: string) => void
  isFirstQuestion: boolean
  isLastQuestion: boolean
  isPaletteOpen: boolean
  onClosePalette: () => void
  disabled?: boolean
}

export const ListeningLayout: React.FC<ListeningLayoutProps> = ({
  currentQuestionItem,
  activeQuestionIndex,
  totalQuestions,
  allQuestions,
  answersMap,
  flaggedQuestions,
  isExamExpired = false,
  isExamSubmitted = false,
  playbackRules,
  onSelectOption,
  onSelectQuestion,
  onPrevious,
  onNext,
  onSubmit,
  onToggleFlag,
  isFirstQuestion,
  isLastQuestion,
  isPaletteOpen,
  onClosePalette,
  disabled = false,
}) => {
  const currentQuestion = currentQuestionItem.question
  const selectedAnswer = answersMap[currentQuestion.id] || null
  const isFlagged = flaggedQuestions.has(currentQuestion.id)

  // Compute shared audio range if multiple questions reference this media
  const sharedQuestionRange = useMemo(() => {
    if (!currentQuestionItem.mediaUrl) return null
    const shared = allQuestions.filter(
      (q) => q.mediaUrl && q.mediaUrl === currentQuestionItem.mediaUrl
    )
    if (shared.length <= 1) return null

    const first = shared[0].globalIndex + 1
    const last = shared[shared.length - 1].globalIndex + 1
    return `Enregistrement commun • Questions ${first} à ${last}`
  }, [allQuestions, currentQuestionItem.mediaUrl])

  return (
    <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left/Center Main Column: Audio Context + Audio Player + Question + Navigation */}
      <main id="exam-main-content" className="lg:col-span-8 xl:col-span-9 space-y-6 min-w-0">
        {/* 1. Listening Context & Header */}
        <ListeningQuestionContext
          sectionTitle={currentQuestionItem.sectionTitle}
          instructions={
            currentQuestionItem.instructions ||
            "Écoutez attentivement l'enregistrement puis choisissez l'unique réponse correcte."
          }
          questionNumber={activeQuestionIndex + 1}
          totalQuestions={totalQuestions}
          sharedQuestionRange={sharedQuestionRange}
          replayAllowed={playbackRules?.allow_replay ?? false}
          maxPlays={playbackRules?.max_replays ?? 1}
        />

        {/* 2. Prominent Listening Audio Player */}
        <ListeningPlayer
          mediaUrl={currentQuestionItem.mediaUrl}
          title={currentQuestionItem.sectionTitle || "Document sonore d'évaluation"}
          playbackRules={playbackRules}
          isExamExpired={isExamExpired}
          isExamSubmitted={isExamSubmitted}
        />

        {/* 3. Question & Answers Panel */}
        <QuestionPanel
          question={currentQuestion}
          questionNumber={activeQuestionIndex + 1}
          totalQuestions={totalQuestions}
          selectedAnswer={selectedAnswer}
          onSelectAnswer={(val) => onSelectOption(currentQuestion.id, val)}
          isFlagged={isFlagged}
          onToggleFlag={() => onToggleFlag(currentQuestion.id)}
          disabled={disabled}
        />

        {/* 4. Bottom Navigation Controls */}
        <ExamNavigation
          isFirstQuestion={isFirstQuestion}
          isLastQuestion={isLastQuestion}
          onPrevious={onPrevious}
          onNext={onNext}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      </main>

      {/* Right Column: Desktop Sticky Question Navigator */}
      <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-20">
        <QuestionNavigator
          allQuestions={allQuestions}
          activeQuestionIndex={activeQuestionIndex}
          answersMap={answersMap}
          flaggedQuestions={flaggedQuestions}
          onSelectQuestion={onSelectQuestion}
          mode="inline"
        />
      </aside>

      {/* Mobile Drawer Question Navigator */}
      <QuestionNavigator
        allQuestions={allQuestions}
        activeQuestionIndex={activeQuestionIndex}
        answersMap={answersMap}
        flaggedQuestions={flaggedQuestions}
        onSelectQuestion={onSelectQuestion}
        isOpen={isPaletteOpen}
        onClose={onClosePalette}
        mode="drawer"
      />
    </div>
  )
}
