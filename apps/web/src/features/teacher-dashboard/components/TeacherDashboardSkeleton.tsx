import React from "react"
import { Card, CardContent } from "@/components/ui/card"

export const TeacherDashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement du tableau de bord enseignant">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/60 animate-pulse">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-muted rounded-md" />
          <div className="h-4 w-48 bg-muted/60 rounded-sm" />
        </div>
        <div className="h-8 w-48 bg-muted rounded-full" />
      </div>

      {/* Summary KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border/70">
            <CardContent className="p-5">
              <div className="h-3 w-24 bg-muted rounded-sm mb-3" />
              <div className="h-8 w-16 bg-muted rounded-sm mb-2" />
              <div className="h-3 w-32 bg-muted/60 rounded-sm" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Availability Alert Skeleton */}
      <div className="h-16 bg-muted/40 rounded-xl border border-border/60 animate-pulse" />

      {/* 2-Column Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Schedule & Corrections */}
        <div className="lg:col-span-2 space-y-6 animate-pulse">
          <Card className="border-border/70">
            <CardContent className="p-6 space-y-4">
              <div className="h-5 w-40 bg-muted rounded-sm mb-4" />
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-muted/40 rounded-xl border border-border/60" />
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardContent className="p-6 space-y-4">
              <div className="h-5 w-48 bg-muted rounded-sm mb-4" />
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-muted/40 rounded-xl border border-border/60" />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Earnings & Activity */}
        <div className="space-y-6 animate-pulse">
          <Card className="border-border/70">
            <CardContent className="p-6 space-y-3">
              <div className="h-5 w-32 bg-muted rounded-sm mb-4" />
              <div className="grid grid-cols-2 gap-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 bg-muted/40 rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardContent className="p-6 space-y-3">
              <div className="h-5 w-40 bg-muted rounded-sm mb-4" />
              <div className="h-24 bg-muted/40 rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
