import React from "react"
import { Calendar, Clock, Globe, GraduationCap, Sparkles, ShieldAlert } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import type {
  TeacherSummary,
  TeacherServiceItem,
  TimeSlot,
} from "../types"

export interface BookingSummarySidebarProps {
  teacher?: TeacherSummary
  selectedService: TeacherServiceItem | null
  selectedDate: string
  selectedSlot: TimeSlot | null
  userTimezone: string
}

export const BookingSummarySidebar: React.FC<BookingSummarySidebarProps> = ({
  teacher,
  selectedService,
  selectedDate,
  selectedSlot,
  userTimezone,
}) => {
  const isCovered = selectedService?.isCoveredByPlan

  const formattedDate = React.useMemo(() => {
    if (!selectedDate) return "Date non sélectionnée"
    try {
      const d = new Date(selectedDate + "T12:00:00Z")
      return d.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    } catch {
      return selectedDate
    }
  }, [selectedDate])

  const formatPrice = (cents: number) => {
    return `${(cents / 100).toFixed(2)} CAD`
  }

  return (
    <aside aria-label="Récapitulatif de votre session" className="hidden lg:block space-y-4">
      <Card className="border-border/80 bg-card shadow-xs sticky top-6">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-sm font-bold text-foreground">
            Récapitulatif de la session
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3.5 pt-4 text-xs">
          {/* Teacher Summary */}
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
              <GraduationCap className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">
                {teacher?.display_name || "Enseignant TEF"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {teacher?.headline || "Préparation certifiée TEF Canada"}
              </p>
            </div>
          </div>

          {/* Selected Service */}
          <div className="pt-2 border-t border-border/50 space-y-1">
            <span className="text-[11px] text-muted-foreground">Service choisi :</span>
            <div className="flex items-center justify-between font-medium text-foreground">
              <span className="truncate">{selectedService?.title || "Session TEF"}</span>
              <span className="text-muted-foreground font-mono shrink-0">
                {selectedService?.durationMinutes || 60} min
              </span>
            </div>
          </div>

          {/* Date & Time */}
          <div className="pt-2 border-t border-border/50 space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="size-3 text-primary" aria-hidden="true" />
                Date :
              </span>
              <span className="font-medium text-foreground capitalize">
                {formattedDate}
              </span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="size-3 text-primary" aria-hidden="true" />
                Horaire :
              </span>
              <span className="font-mono font-bold text-foreground">
                {selectedSlot ? `${selectedSlot.start_time_local} - ${selectedSlot.end_time_local}` : "À choisir"}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Globe className="size-3" aria-hidden="true" />
                Fuseau :
              </span>
              <span className="font-mono text-[10px] truncate max-w-[120px] text-right">
                {userTimezone}
              </span>
            </div>
          </div>

          {/* Price / Entitlement */}
          <div className="pt-3 border-t border-border/60 flex items-center justify-between font-bold text-xs sm:text-sm">
            <span>Règlement :</span>
            {isCovered ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                <Sparkles className="size-3 text-primary" aria-hidden="true" />
                <span>Inclus</span>
              </span>
            ) : (
              <span className="text-primary font-mono">
                {formatPrice(selectedService?.priceCents || teacher?.hourly_price || 4500)}
              </span>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-0 border-t border-border/40 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5 pt-2">
            <ShieldAlert className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>Annulation sans frais jusqu'à 24h avant.</span>
          </div>
        </CardFooter>
      </Card>
    </aside>
  )
}
