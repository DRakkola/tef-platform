/**
 * WritingResultSkeleton Component.
 * Loading skeleton matching the Writing Result & Correction page layout.
 */

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"

export const WritingResultSkeleton: React.FC = () => {
  return (
    <div
      aria-label="Chargement des résultats de l'épreuve écrite"
      className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6"
    >
      {/* Top Header Skeleton */}
      <div className="space-y-2 pb-4 border-b border-border/60">
        <Skeleton className="h-4 w-36 rounded-md" />
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-7 w-80 rounded-md" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-28 rounded-md" />
            <Skeleton className="h-7 w-24 rounded-md" />
          </div>
        </div>
      </div>

      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>

      {/* Strengths & Improvements Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>

      {/* Evaluator Comments Skeleton */}
      <Skeleton className="h-36 rounded-2xl" />

      {/* Response Skeleton */}
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}
