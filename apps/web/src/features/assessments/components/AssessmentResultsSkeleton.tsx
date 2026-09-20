/**
 * AssessmentResultsSkeleton Component.
 * Accessible, modular skeleton loading screen for the Results page.
 * Avoids disruptive fullscreen spinners by rendering component placeholders.
 */

import React from "react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const AssessmentResultsSkeleton: React.FC = () => {
  return (
    <div
      role="status"
      aria-label="Chargement de vos résultats d'évaluation"
      className="space-y-6 animate-pulse"
    >
      {/* Header bar skeleton */}
      <div className="flex items-center justify-between pb-2">
        <Skeleton className="h-7 w-32 rounded-lg" />
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>

      {/* Disclaimer banner skeleton */}
      <Skeleton className="h-16 w-full rounded-2xl" />

      {/* Hero card skeleton */}
      <Card className="border-border/80 bg-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-8 w-64 rounded-lg" />
            <Skeleton className="h-4 w-96 rounded" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-20 w-24 rounded-2xl" />
            <Skeleton className="h-20 w-24 rounded-2xl" />
          </div>
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
      </Card>

      {/* 2-column grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Summary */}
          <Skeleton className="h-24 w-full rounded-2xl" />

          {/* Section results */}
          <Card className="border-border/80 bg-card p-5 space-y-4">
            <Skeleton className="h-5 w-48 rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </div>
          </Card>

          {/* Skill breakdown */}
          <Card className="border-border/80 bg-card p-5 space-y-4">
            <Skeleton className="h-5 w-52 rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          </Card>

          {/* Strengths */}
          <Card className="border-border/80 bg-card p-5 space-y-3">
            <Skeleton className="h-5 w-36 rounded" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </Card>
        </div>

        {/* Secondary Column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Next Step */}
          <Skeleton className="h-56 w-full rounded-2xl" />

          {/* Weaknesses */}
          <Skeleton className="h-48 w-full rounded-2xl" />

          {/* History */}
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
