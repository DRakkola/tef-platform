import React from "react"
import { ReadingPassage } from "./ReadingPassage"
import { QuestionPanel } from "./QuestionPanel"
import { ExamNavigation } from "./ExamNavigation"
import { QuestionNavigator } from "./QuestionNavigator"
import type { ActiveQuestionItem } from "../types"

export interface ReadingLayoutProps {
  currentQuestionItem: ActiveQuestionItem
  activeQuestionIndex: number
  totalQuestions: number
  allQuestions: ActiveQuestionItem[]
  answersMap: Record<string, any>
  flaggedQuestions: Set<string>
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

export const ReadingLayout: React.FC<ReadingLayoutProps> = ({
  currentQuestionItem,
  activeQuestionIndex,
  totalQuestions,
  allQuestions,
  answersMap,
  flaggedQuestions,
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

  return (
    <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left/Center Column: Reading Passage + Question Panel + Bottom Navigation */}
      <main id="exam-main-content" className="lg:col-span-8 xl:col-span-9 space-y-6 min-w-0">
        {/* 1. Reading Passage or Audio Document */}
        <ReadingPassage
          passageText={currentQuestionItem.passageText}
          sectionTitle={currentQuestionItem.sectionTitle}
          mediaUrl={currentQuestionItem.mediaUrl}
        />

        {/* 2. Question Panel */}
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

        {/* 3. Bottom Navigation Controls */}
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
