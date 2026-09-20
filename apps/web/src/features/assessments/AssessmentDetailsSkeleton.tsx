import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardHeader, CardContent } from "@/components/ui/card"

export const AssessmentDetailsSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 animate-pulse" data-testid="assessment-details-skeleton">
      {/* 1. Header Skeleton */}
      <div className="space-y-3 pb-6 border-b border-border/60">
        <Skeleton className="h-4 w-48" />
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
      </div>

      {/* 2. Metadata Summary Bar */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-7 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 3. Two-column layout on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-3.5 rounded-xl border border-border/40 space-y-2">
                    <Skeleton className="size-8 rounded-lg" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sections */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-44" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="p-4 rounded-xl border border-border/40 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Rules */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-56" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3.5 rounded-xl border border-border/40 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Sticky CTA Column */}
        <div className="space-y-6">
          <Card className="border-border/60">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-3 w-4/5 mx-auto" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
