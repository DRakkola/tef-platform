import React, { useRef } from "react"
import { AnswerOption } from "./AnswerOption"
import type { QuestionOptionStudent } from "../types"

export interface AnswerGroupProps {
  questionId: string
  prompt: string
  options: QuestionOptionStudent[]
  selectedOptionId?: string | null
  onSelect: (optionId: string) => void
  disabled?: boolean
  className?: string
}

export const AnswerGroup: React.FC<AnswerGroupProps> = ({
  questionId,
  prompt,
  options,
  selectedOptionId,
  onSelect,
  disabled = false,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Keyboard navigation for radio group
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || options.length === 0) return

    const currentIndex = options.findIndex((o) => o.id === selectedOptionId)

    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault()
      const nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0
      onSelect(options[nextIndex].id)
      const nextBtn = containerRef.current?.querySelector<HTMLButtonElement>(
        `#option-${options[nextIndex].id}`
      )
      nextBtn?.focus()
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault()
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1
      onSelect(options[prevIndex].id)
      const prevBtn = containerRef.current?.querySelector<HTMLButtonElement>(
        `#option-${options[prevIndex].id}`
      )
      prevBtn?.focus()
    }
  }

  return (
    <div
      id={`question-options-${questionId}`}
      ref={containerRef}
      role="radiogroup"
      aria-label={prompt}
      onKeyDown={handleKeyDown}
      className={className || "space-y-3"}
    >
      {options.map((option, idx) => {
        const letter = String.fromCharCode(65 + idx)
        const isSelected = selectedOptionId === option.id

        return (
          <AnswerOption
            key={option.id}
            id={option.id}
            label={letter}
            content={option.content}
            isSelected={isSelected}
            onSelect={() => onSelect(option.id)}
            disabled={disabled}
            type="radio"
          />
        )
      })}
    </div>
  )
}
