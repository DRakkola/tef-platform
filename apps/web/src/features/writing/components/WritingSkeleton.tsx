/**
 * WritingSkeleton Component.
 * Loading skeleton matching the two-pane layout of the Student Writing Workspace.
 */

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"

export const WritingSkeleton: React.FC = () => {
  return (
    <div
      aria-label="Chargement de l'espace de rédaction"
      className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
    >
      {/* Left Pane: Instructions Skeleton */}
      <div className="lg:col-span-5 flex flex-col rounded-2xl border border-border/80 bg-card p-5 sm:p-6 space-y-5 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>

        {/* Target Constraints Skeleton */}
        <Skeleton className="h-10 w-full rounded-xl" />

        {/* Stimulus / Prompt Skeleton */}
        <div className="space-y-3 flex-1">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-4 w-24 rounded-md mt-4" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>

        {/* Criteria Skeleton */}
        <div className="space-y-2 pt-3 border-t border-border/60">
          <Skeleton className="h-4 w-44 rounded-md" />
          <Skeleton className="h-3 w-5/6 rounded-md" />
          <Skeleton className="h-3 w-4/6 rounded-md" />
          <Skeleton className="h-3 w-3/4 rounded-md" />
        </div>
      </div>

      {/* Right Pane: Editor Skeleton */}
      <div className="lg:col-span-7 flex flex-col rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
        {/* Editor Subheader Skeleton */}
        <div className="p-4 border-b border-border/60 bg-muted/20 flex items-center justify-between">
          <Skeleton className="h-5 w-32 rounded-md" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-5 w-28 rounded-md" />
          </div>
        </div>

        {/* Editor Textarea Skeleton */}
        <div className="flex-1 p-6 flex flex-col min-h-[460px] space-y-3">
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-5/6 rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
          <Skeleton className="h-4 w-4/5 rounded-md" />
        </div>

        {/* Editor Footer Skeleton */}
        <div className="p-3.5 border-t border-border/60 bg-muted/20 flex items-center justify-between">
          <Skeleton className="h-4 w-48 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>
      </div>
    </div>
  )
}
