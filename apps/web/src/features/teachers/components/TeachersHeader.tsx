import { Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export interface TeachersHeaderProps {
  totalCount: number
  onMyBookingsClick?: () => void
}

export function TeachersHeader({ totalCount, onMyBookingsClick }: TeachersHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Trouver un professeur
          </h1>
          <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
            {totalCount} certifié{totalCount > 1 ? "s" : ""}
          </Badge>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Choisissez un professeur pour la correction d'écrits ou la pratique orale.
        </p>
      </div>

      {onMyBookingsClick && (
        <Button
          variant="outline"
          size="sm"
          onClick={onMyBookingsClick}
          className="cursor-pointer gap-2 text-xs font-semibold self-start sm:self-auto shrink-0"
        >
          <Calendar className="size-3.5 text-primary" />
          <span>Mes réservations</span>
        </Button>
      )}
    </div>
  )
}
