import React from "react"
import { Link } from "react-router-dom"
import { Calendar, Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export const TeacherBookingsHeader: React.FC = () => {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-border/70">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
            <Calendar className="size-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Mes réservations
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Gérez vos séances, votre planning et vos prochaines disponibilités.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-9 text-xs font-medium shadow-xs"
          asChild
        >
          <Link to="/teacher/availability">
            <Clock className="size-4 text-primary" />
            <span>Configurer mes disponibilités</span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
