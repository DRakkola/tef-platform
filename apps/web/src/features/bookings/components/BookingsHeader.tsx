import React from "react"
import { Link } from "react-router-dom"
import { Calendar, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export const BookingsHeader: React.FC = () => {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <Calendar className="size-6 text-primary" aria-hidden="true" />
          <span>Mes réservations</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Gérez vos sessions passées et à venir avec vos professeurs particuliers.
        </p>
      </div>

      <div className="shrink-0">
        <Button asChild size="default" className="cursor-pointer shadow-xs gap-2 font-medium">
          <Link to="/teachers">
            <Plus className="size-4" aria-hidden="true" />
            <span>Trouver un professeur</span>
          </Link>
        </Button>
      </div>
    </header>
  )
}
