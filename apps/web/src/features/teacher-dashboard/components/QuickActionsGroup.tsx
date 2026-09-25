import React from "react"
import { Link } from "react-router-dom"
import { Clock, Calendar, PenTool, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"

export const QuickActionsGroup: React.FC = () => {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Button
        variant="outline"
        size="sm"
        className="text-xs h-8 gap-1.5 border-border/80 text-foreground hover:bg-muted"
        asChild
      >
        <Link to="/teacher/availability">
          <Clock className="size-3.5 text-primary" />
          <span>Gérer mes disponibilités</span>
        </Link>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="text-xs h-8 gap-1.5 border-border/80 text-foreground hover:bg-muted"
        asChild
      >
        <Link to="/bookings">
          <Calendar className="size-3.5 text-blue-500" />
          <span>Voir mes réservations</span>
        </Link>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="text-xs h-8 gap-1.5 border-border/80 text-foreground hover:bg-muted"
        asChild
      >
        <Link to="/writing">
          <PenTool className="size-3.5 text-amber-500" />
          <span>Voir mes corrections</span>
        </Link>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="text-xs h-8 gap-1.5 border-border/80 text-foreground hover:bg-muted"
        asChild
      >
        <Link to="/teacher/earnings">
          <CreditCard className="size-3.5 text-emerald-500" />
          <span>Voir mes revenus</span>
        </Link>
      </Button>
    </div>
  )
}
