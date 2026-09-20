import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card"

export interface TeacherSkeletonProps {
  count?: number
}

export function TeacherSkeleton({ count = 6 }: TeacherSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Chargement des enseignants"
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card
          key={i}
          className="flex flex-col justify-between border-border/60 bg-card rounded-2xl overflow-hidden"
        >
          <CardHeader className="space-y-3 pb-3">
            <div className="flex items-start gap-3">
              <div className="size-12 rounded-full bg-muted/60 shrink-0" />
              <div className="space-y-2 flex-1 pt-1">
                <div className="h-4 w-3/4 bg-muted/60 rounded" />
                <div className="h-3 w-1/2 bg-muted/40 rounded" />
              </div>
            </div>
            <div className="space-y-1.5 pt-2">
              <div className="h-3 w-full bg-muted/40 rounded" />
              <div className="h-3 w-5/6 bg-muted/40 rounded" />
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            <div className="flex gap-1.5">
              <div className="h-5 w-20 bg-muted/50 rounded-full" />
              <div className="h-5 w-24 bg-muted/50 rounded-full" />
              <div className="h-5 w-16 bg-muted/50 rounded-full" />
            </div>

            <div className="h-14 rounded-xl bg-muted/30 border border-border/40 p-2.5" />

            <div className="flex items-center justify-between pt-1">
              <div className="space-y-1">
                <div className="h-2.5 w-16 bg-muted/40 rounded" />
                <div className="h-4 w-24 bg-muted/60 rounded" />
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-2 border-t border-border/60">
            <div className="h-9 w-full bg-muted/60 rounded-lg" />
          </CardFooter>
        </Card>
      ))}
      <span className="sr-only">Chargement de la liste des professeurs certifiés...</span>
    </div>
  )
}
