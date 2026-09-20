import React from "react"
import { useNavigate } from "react-router-dom"
import {
  CheckCircle2,
  Calendar,
  Clock,
  Globe,
  GraduationCap,
  Video,
  Download,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type {
  TeacherSummary,
  TeacherServiceItem,
  TimeSlot,
  TeacherBookingResponse,
} from "../types"

export interface BookingSuccessProps {
  teacher?: TeacherSummary
  selectedService: TeacherServiceItem | null
  selectedDate: string
  selectedSlot: TimeSlot | null
  userTimezone: string
  confirmedBooking: TeacherBookingResponse | null
  onDownloadIcs: () => void
}

export const BookingSuccess: React.FC<BookingSuccessProps> = ({
  teacher,
  selectedService,
  selectedDate,
  selectedSlot,
  userTimezone,
  confirmedBooking,
  onDownloadIcs,
}) => {
  const navigate = useNavigate()

  // Format public reference (non-internal UUID)
  const bookingRef = React.useMemo(() => {
    if (!confirmedBooking?.id) return "TEF-BK-" + Math.floor(100000 + Math.random() * 900000)
    const raw = confirmedBooking.id.replace(/-/g, "").toUpperCase()
    return `TEF-BK-${raw.slice(0, 8)}`
  }, [confirmedBooking?.id])

  const formattedDate = React.useMemo(() => {
    try {
      const d = new Date(selectedDate + "T12:00:00Z")
      return d.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    } catch {
      return selectedDate
    }
  }, [selectedDate])

  return (
    <section aria-label="Confirmation de la réservation" className="space-y-6 max-w-2xl mx-auto py-4">
      <div className="text-center space-y-3">
        <div className="flex size-14 mx-auto items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
          <CheckCircle2 className="size-8 stroke-[2.5]" aria-hidden="true" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            Réservation confirmée !
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            Votre cours particulier avec {teacher?.display_name || "votre professeur"} a été validé. Une confirmation a été transmise à votre adresse email.
          </p>
        </div>

        {/* Public Booking Reference */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/60 border border-border text-xs font-mono">
          <span className="text-muted-foreground">Référence :</span>
          <span className="font-bold text-foreground">{bookingRef}</span>
        </div>
      </div>

      {/* Confirmed Details Card */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardContent className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <span className="text-muted-foreground flex items-center gap-2">
              <GraduationCap className="size-4 text-primary" aria-hidden="true" />
              Enseignant
            </span>
            <span className="font-semibold text-foreground">
              {teacher?.display_name}
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <span className="text-muted-foreground">Service</span>
            <span className="font-medium text-foreground">
              {selectedService?.title || "Session TEF"} (60 min)
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <span className="text-muted-foreground flex items-center gap-2">
              <Calendar className="size-4 text-primary" aria-hidden="true" />
              Date
            </span>
            <span className="font-medium text-foreground capitalize">
              {formattedDate}
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <span className="text-muted-foreground flex items-center gap-2">
              <Clock className="size-4 text-primary" aria-hidden="true" />
              Horaire
            </span>
            <span className="font-mono font-bold text-foreground">
              {selectedSlot?.start_time_local} - {selectedSlot?.end_time_local}
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <span className="text-muted-foreground flex items-center gap-2">
              <Globe className="size-4 text-primary" aria-hidden="true" />
              Fuseau horaire
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {userTimezone}
            </span>
          </div>

          {/* Meeting Link Preview */}
          {confirmedBooking?.meeting_link && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-primary flex items-center gap-1.5">
                  <Video className="size-3.5" aria-hidden="true" />
                  Lien de visioconférence
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">Sécurisé</span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                La visioconférence sera accessible 10 minutes avant le début de votre séance.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar Export & Navigation CTAs */}
      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          onClick={onDownloadIcs}
          className="w-full cursor-pointer h-10 gap-2 text-xs sm:text-sm font-medium"
        >
          <Download className="size-4" aria-hidden="true" />
          <span>Ajouter à mon agenda (.ics)</span>
        </Button>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex-1 cursor-pointer h-10 gap-2 font-semibold text-xs sm:text-sm shadow-xs"
          >
            <span>Voir mon tableau de bord</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/teachers")}
            className="flex-1 cursor-pointer h-10 text-xs sm:text-sm font-medium"
          >
            <span>Retour aux professeurs</span>
          </Button>
        </div>
      </div>
    </section>
  )
}
