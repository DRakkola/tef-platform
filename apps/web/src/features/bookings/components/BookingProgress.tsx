import React from "react"
import { Check } from "lucide-react"
import type { BookingStep } from "../types"

export interface BookingProgressProps {
  currentStep: BookingStep
  onStepClick?: (step: BookingStep) => void
  isServiceSelected: boolean
  isSlotSelected: boolean
}

interface StepMeta {
  key: BookingStep
  index: number
  label: string
}

const STEPS: StepMeta[] = [
  { key: "service", index: 1, label: "Service" },
  { key: "time", index: 2, label: "Date & Heure" },
  { key: "review", index: 3, label: "Récapitulatif" },
]

export const BookingProgress: React.FC<BookingProgressProps> = ({
  currentStep,
  onStepClick,
  isServiceSelected,
  isSlotSelected,
}) => {
  const getStepIndex = (s: BookingStep) => {
    switch (s) {
      case "service":
        return 1
      case "time":
        return 2
      case "review":
        return 3
      case "success":
        return 4
    }
  }

  const activeIndex = getStepIndex(currentStep)

  const isStepClickable = (stepKey: BookingStep) => {
    if (currentStep === "success") return false
    if (stepKey === "service") return true
    if (stepKey === "time") return isServiceSelected
    if (stepKey === "review") return isServiceSelected && isSlotSelected
    return false
  }

  return (
    <nav aria-label="Progression de la réservation" className="py-2">
      {/* Desktop Stepper */}
      <ol className="hidden sm:flex items-center justify-between w-full max-w-xl mx-auto gap-4">
        {STEPS.map((step, idx) => {
          const isCompleted = activeIndex > step.index
          const isCurrent = activeIndex === step.index
          const clickable = isStepClickable(step.key)

          return (
            <li key={step.key} className="flex-1 flex items-center">
              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onStepClick?.(step.key)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`flex items-center gap-2.5 text-xs font-semibold transition-colors ${
                    clickable ? "cursor-pointer group" : "cursor-not-allowed opacity-60"
                  }`}
                >
                  <span
                    className={`flex size-6 items-center justify-center rounded-full text-xs font-mono font-bold transition-all ${
                      isCompleted
                        ? "bg-primary text-primary-foreground"
                        : isCurrent
                        ? "border-2 border-primary text-primary bg-primary/10"
                        : "border border-border text-muted-foreground bg-muted/40"
                    }`}
                  >
                    {isCompleted ? <Check className="size-3 stroke-[3]" aria-hidden="true" /> : step.index}
                  </span>
                  <span
                    className={`${
                      isCurrent
                        ? "text-foreground font-bold"
                        : isCompleted
                        ? "text-foreground font-medium group-hover:text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>

                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                      activeIndex > step.index ? "bg-primary" : "bg-border/60"
                    }`}
                    aria-hidden="true"
                  />
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {/* Mobile Compact Progress */}
      <div className="sm:hidden space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">
            Étape {Math.min(activeIndex, 3)} sur 3 :{" "}
            <span className="text-primary">
              {STEPS.find((s) => s.index === Math.min(activeIndex, 3))?.label}
            </span>
          </span>
          <span className="text-muted-foreground font-mono tabular-nums">
            {Math.round((Math.min(activeIndex, 3) / 3) * 100)}%
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300 rounded-full"
            style={{ width: `${(Math.min(activeIndex, 3) / 3) * 100}%` }}
            aria-hidden="true"
          />
        </div>
      </div>
    </nav>
  )
}
