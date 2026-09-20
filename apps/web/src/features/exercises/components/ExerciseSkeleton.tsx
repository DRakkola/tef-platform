/**
 * ExerciseSkeleton Component.
 * Stable, accessible skeleton loader for the practice exercise experience.
 */

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const ExerciseSkeleton: React.FC = () => {
  return (
    <div
      role="status"
      aria-label="Chargement de l'exercice en cours"
      className="space-y-6 animate-pulse"
    >
      {/* Progress skeleton */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-4 w-12 rounded-md" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* Main Question Card Skeleton */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Metadata pill skeleton */}
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-md" />
            <Skeleton className="h-6 w-12 rounded-md" />
          </div>

          {/* Prompt skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-6 w-3/4 rounded-md" />
            <Skeleton className="h-6 w-1/2 rounded-md" />
          </div>

          {/* Options skeleton */}
          <div className="space-y-3 pt-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>

          {/* Action button skeleton */}
          <Skeleton className="h-12 w-full rounded-xl" />
        </CardContent>
      </Card>
    </div>
  )
}
