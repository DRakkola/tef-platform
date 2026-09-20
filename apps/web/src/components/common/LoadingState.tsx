import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse" aria-label="Chargement du tableau de bord">
      {/* Top Hero Skeleton */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-8 w-64 rounded-md" />
            <Skeleton className="h-4 w-48 rounded-md" />
          </div>
          <Skeleton className="h-10 w-40 rounded-xl" />
        </div>
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-7 w-28 rounded-md" />
            <Skeleton className="h-3 w-36 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-48 rounded-md" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-36 rounded-md" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function TeacherCardSkeleton() {
  return (
    <Card className="p-5 space-y-4 border border-border/60">
      <div className="flex items-start gap-4">
        <Skeleton className="size-14 rounded-xl shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="h-4 w-48 rounded-md" />
          <Skeleton className="h-3 w-24 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-md" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-6 w-24 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
    </Card>
  )
}

export function ExerciseCardSkeleton() {
  return (
    <Card className="p-5 space-y-3 border border-border/60">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-4 w-12 rounded-md" />
      </div>
      <Skeleton className="h-5 w-3/4 rounded-md" />
      <Skeleton className="h-4 w-1/2 rounded-md" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-3 w-16 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-xl" />
      </div>
    </Card>
  )
}

export function AssessmentCardSkeleton() {
  return (
    <Card className="p-6 space-y-4 border border-border/60">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
      <Skeleton className="h-6 w-3/4 rounded-md" />
      <Skeleton className="h-4 w-full rounded-md" />
      <div className="grid grid-cols-3 gap-2 pt-2">
        <Skeleton className="h-8 rounded-md" />
        <Skeleton className="h-8 rounded-md" />
        <Skeleton className="h-8 rounded-md" />
      </div>
    </Card>
  )
}
