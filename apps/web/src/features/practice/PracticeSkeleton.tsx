import React from "react"
import { Card } from "@/components/ui/card"

export const PracticeSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 animate-pulse" data-testid="practice-skeleton">
      {/* Header Skeleton */}
      <div className="space-y-3 pb-6 border-b border-border/60">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-8 w-44 bg-muted rounded-lg" />
            <div className="h-4 w-80 bg-muted/70 rounded" />
          </div>
          <div className="h-6 w-24 bg-muted/60 rounded-full" />
        </div>
      </div>

      {/* Hero Recommendation Skeleton */}
      <div className="space-y-4">
        <div className="h-5 w-48 bg-muted rounded" />
        <Card className="border-border/60 bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <div className="h-5 w-40 bg-muted rounded-full" />
              <div className="h-5 w-20 bg-muted/70 rounded" />
            </div>
            <div className="h-4 w-28 bg-muted rounded" />
          </div>
          <div className="h-6 w-3/4 bg-muted rounded" />
          <div className="h-16 w-full bg-muted/40 rounded-xl" />
          <div className="flex items-center justify-between pt-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-9 w-40 bg-muted rounded-lg" />
          </div>
        </Card>
      </div>

      {/* Daily Plan Skeleton */}
      <Card className="border-border/60 bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-36 bg-muted rounded" />
          <div className="h-5 w-24 bg-muted rounded-full" />
        </div>
        <div className="h-2 w-full bg-muted rounded-full" />
        <div className="space-y-3 pt-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="size-4 rounded-full bg-muted" />
                <div className="space-y-1">
                  <div className="h-4 w-48 bg-muted rounded" />
                  <div className="h-3 w-32 bg-muted/60 rounded" />
                </div>
              </div>
              <div className="h-7 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      </Card>

      {/* Categories Skeleton */}
      <div className="space-y-3">
        <div className="h-5 w-44 bg-muted rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <div key={n} className="h-28 rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <div className="size-8 rounded-lg bg-muted" />
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-full bg-muted/60 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Exercise Grid Skeleton */}
      <div className="space-y-4 pt-4 border-t border-border/60">
        <div className="h-5 w-48 bg-muted rounded" />
        <div className="h-10 w-full bg-muted/40 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-48 rounded-xl border border-border/60 bg-card p-5 space-y-3">
              <div className="flex justify-between">
                <div className="h-4 w-16 bg-muted rounded" />
                <div className="h-4 w-24 bg-muted rounded" />
              </div>
              <div className="h-5 w-3/4 bg-muted rounded" />
              <div className="h-8 w-full bg-muted/50 rounded" />
              <div className="h-8 w-full bg-muted rounded mt-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
