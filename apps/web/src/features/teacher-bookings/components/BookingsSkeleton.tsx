import React from "react"
import { Card, CardContent } from "@/components/ui/card"

export const BookingsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true">
      {/* Metric cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border/60">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-3.5 w-20 bg-muted rounded-sm" />
                <div className="h-7 w-12 bg-muted rounded-md" />
                <div className="h-3 w-28 bg-muted/60 rounded-sm" />
              </div>
              <div className="size-10 rounded-xl bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar skeleton */}
      <div className="h-24 bg-muted/40 rounded-xl border border-border/60" />

      {/* View content skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-5 rounded-xl border border-border/60 bg-card flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-20 bg-muted rounded-xl" />
              <div className="space-y-2">
                <div className="h-4 w-40 bg-muted rounded-sm" />
                <div className="h-3 w-28 bg-muted/60 rounded-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-20 bg-muted rounded-md" />
              <div className="h-8 w-16 bg-muted rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
