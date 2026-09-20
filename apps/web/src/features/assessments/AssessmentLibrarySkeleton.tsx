import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card"

export const AssessmentLibrarySkeleton: React.FC = () => {
  return (
    <div className="space-y-8 animate-pulse" data-testid="assessment-library-skeleton">
      {/* 1. Header Skeleton */}
      <div className="space-y-3 pb-2 border-b border-border/40">
        <Skeleton className="h-4 w-36" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-7 w-36 shrink-0" />
        </div>
      </div>

      {/* 2. Highlight/Recommended Card Skeleton */}
      <Card className="border-border/60">
        <CardContent className="p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-44 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-28 hidden sm:block" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>

          <div className="p-4 rounded-xl border border-border/40 bg-muted/20 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-5/6" />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-10 w-full sm:w-52 rounded-lg" />
          </div>
        </CardContent>
      </Card>

      {/* 3. Skills Section Skeleton */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <Card key={i} className="border-border/60">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="size-10 rounded-xl" />
                  <Skeleton className="h-5 w-32 rounded-full" />
                </div>
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-3.5 w-full" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </CardContent>
              <CardFooter className="pt-2 border-t border-border/30">
                <Skeleton className="h-9 w-full rounded-md" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {/* 4. Filter Bar & Grid Skeleton */}
      <div className="space-y-6">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        {/* Filter controls */}
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        </div>

        {/* 3-card catalog grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/60">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-36 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-3/4" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
              <CardFooter className="pt-2 border-t border-border/40">
                <Skeleton className="h-9 w-full rounded-md" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
