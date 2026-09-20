
export function SpeakingSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-pulse" aria-busy="true">
      {/* Prompt Card Skeleton */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 bg-muted rounded-md" />
          <div className="h-4 w-16 bg-muted rounded-md" />
        </div>
        <div className="h-6 w-3/4 bg-muted rounded-md" />
        <div className="h-20 w-full bg-muted/40 rounded-xl" />
      </div>

      {/* Participant Card Skeleton */}
      <div className="rounded-2xl border border-border/60 bg-card p-8 flex flex-col items-center space-y-4 max-w-sm mx-auto">
        <div className="size-20 rounded-full bg-muted" />
        <div className="h-4 w-40 bg-muted rounded-md" />
        <div className="h-3 w-28 bg-muted rounded-md" />
        <div className="h-6 w-24 bg-muted rounded-full" />
      </div>

      {/* Controls Skeleton */}
      <div className="flex items-center justify-center gap-3 pt-4">
        <div className="h-12 w-32 bg-muted rounded-xl" />
        <div className="h-12 w-32 bg-muted rounded-xl" />
        <div className="h-12 w-24 bg-muted rounded-xl" />
      </div>
    </div>
  )
}
