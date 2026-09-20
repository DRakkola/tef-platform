import React from "react"
import { Link } from "react-router-dom"
import { Calendar, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { BookingTab } from "../hooks/useMyBookings"

export interface BookingEmptyStateProps {
  tab: BookingTab
}

export const BookingEmptyState: React.FC<BookingEmptyStateProps> = ({ tab }) => {
  if (tab === "past") {
    return (
      <div className="p-8 sm:p-12 rounded-2xl border border-dashed border-border/80 bg-muted/10 text-center space-y-3">
        <div className="size-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
          <Calendar className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-semibold text-foreground">
            Aucune session passée enregistrée
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Vos sessions de coaching et corrections réalisées avec nos enseignants apparaîtront ici.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 sm:p-12 rounded-2xl border border-dashed border-border/80 bg-muted/10 text-center space-y-4">
      <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
        <Calendar className="size-6" aria-hidden="true" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-sm sm:text-base font-semibold text-foreground">
          Aucune session à venir
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Explorez notre annuaire d'enseignants certifiés pour réserver un entraînement d'expression orale ou un atelier de correction écrite.
        </p>
      </div>

      <Button asChild size="default" className="cursor-pointer shadow-xs gap-2 font-medium">
        <Link to="/teachers">
          <Plus className="size-4" aria-hidden="true" />
          <span>Trouver un professeur</span>
        </Link>
      </Button>
    </div>
  )
}
