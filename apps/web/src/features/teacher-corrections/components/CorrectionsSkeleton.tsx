/**
 * CorrectionsSkeleton: Loading skeleton for the corrections queue.
 */

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"

export const CorrectionsSkeleton: React.FC = () => {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border border-border/60 bg-card p-4"
        >
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
          <Skeleton className="h-3 w-24 flex-shrink-0" />
          <Skeleton className="h-8 w-28 rounded-md flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}
