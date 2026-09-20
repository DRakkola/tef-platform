/**
 * ExerciseProgress Component.
 * Simple, non-gamified progress indicator for practice drills.
 */

import React from "react"
import { cn } from "@/lib/utils"

export interface ExerciseProgressProps {
  current?: number
  total?: number
  className?: string
}

export const ExerciseProgress: React.FC<ExerciseProgressProps> = ({
  current = 1,
  total = 1,
  className,
}) => {
  const percent = total > 0 ? Math.round((current / total) * 100) : 100

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
        <span>
          Question <strong className="text-foreground font-mono">{current}</strong> sur{" "}
          <span className="font-mono">{total}</span>
        </span>
        <span className="font-mono font-medium">{percent}%</span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progression : ${percent}%`}
          className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  )
}
