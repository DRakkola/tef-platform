import { CheckCircle2, Sparkles, AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import type { TeacherSummary, TimeSlot, TeacherServiceItem, TeacherBookingResponse } from "../types"

export interface TeacherBookingModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  teacher: TeacherSummary
  selectedService?: TeacherServiceItem
  selectedDate: string
  selectedSlot: TimeSlot | null
  userTimezone: string
  isSubmitting: boolean
  bookingSuccess: boolean
  bookingConflict: boolean
  confirmedBooking: TeacherBookingResponse | null
  onConfirm: () => void
  onRefreshSlots: () => void
  onNavigateDashboard: () => void
}

export function TeacherBookingModal({
  isOpen,
  onOpenChange,
  teacher,
  selectedService,
  selectedDate,
  selectedSlot,
  userTimezone,
  isSubmitting,
  bookingSuccess,
  bookingConflict,
  onConfirm,
  onRefreshSlots,
  onNavigateDashboard,
}: TeacherBookingModalProps) {
  const isCovered = selectedService?.isCoveredByPlan

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {bookingSuccess ? "Réservation confirmée !" : "Confirmer votre session"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {bookingSuccess
              ? "Votre cours particulier a été validé et enregistré dans votre agenda."
              : "Vérifiez les détails de votre réservation avant confirmation."}
          </DialogDescription>
        </DialogHeader>

        {bookingSuccess ? (
          <div className="space-y-4 py-3 text-center">
            <div className="flex size-14 mx-auto items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-2xs">
              <CheckCircle2 className="size-8" />
            </div>

            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p className="font-bold text-sm text-foreground">
                Cours avec {teacher.display_name}
              </p>
              <p>
                Service : <strong className="text-foreground">{selectedService?.title || "Session TEF"}</strong>
              </p>
              <p className="font-mono">
                Date : {selectedDate} à {selectedSlot?.start_time_local} (votre heure locale)
              </p>
              <p className="text-[11px] pt-1 text-muted-foreground/90">
                Un lien de visioconférence sécurisé et un rappel vous ont été adressés.
              </p>
            </div>

            <Button
              onClick={onNavigateDashboard}
              className="w-full cursor-pointer mt-4 font-semibold text-xs sm:text-sm h-10"
            >
              Retour au tableau de bord
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2 text-xs">
            {/* Stale Slot Conflict Warning */}
            {bookingConflict && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 space-y-2 text-destructive"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Ce créneau n'est plus disponible</span>
                </div>
                <p className="text-[11px] text-destructive/90 leading-relaxed">
                  Un autre candidat vient de réserver cette plage horaire. Veuillez choisir un autre créneau.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onRefreshSlots()
                    onOpenChange(false)
                  }}
                  className="w-full gap-1.5 text-xs h-8 cursor-pointer mt-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <RefreshCw className="size-3" />
                  <span>Choisir un autre créneau</span>
                </Button>
              </div>
            )}

            {/* Booking Details Summary */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 space-y-2.5">
              <div className="flex items-center justify-between font-semibold text-foreground">
                <span className="text-muted-foreground font-normal">Enseignant :</span>
                <span>{teacher.display_name}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Service :</span>
                <span className="font-medium text-foreground">
                  {selectedService?.title || "Session TEF"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Date & Heure :</span>
                <span className="font-mono text-foreground font-semibold">
                  {selectedDate} · {selectedSlot?.start_time_local} - {selectedSlot?.end_time_local}
                </span>
              </div>

              <div className="flex items-center justify-between text-muted-foreground">
                <span>Fuseau horaire :</span>
                <span>{userTimezone}</span>
              </div>

              <div className="flex items-center justify-between text-muted-foreground">
                <span>Durée :</span>
                <span>60 minutes</span>
              </div>

              <div className="pt-2.5 border-t border-border/70 flex items-center justify-between font-bold text-sm text-foreground">
                <span>Total à régler :</span>
                {isCovered ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    <Sparkles className="size-3 text-primary" />
                    <span>Inclus dans votre forfait</span>
                  </span>
                ) : (
                  <span className="text-primary font-mono">
                    {((selectedService?.priceCents || teacher.hourly_price) / 100).toFixed(2)} CAD
                  </span>
                )}
              </div>
            </div>

            {/* Private Beta Sandbox Notice */}
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground">
              <Sparkles className="size-3.5 text-primary shrink-0 mt-0.5" />
              <span>
                En bêta privée : Mode bac à sable de paiement. Aucun débit bancaire réel ne sera prélevé.
              </span>
            </div>

            <DialogFooter className="pt-3 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="text-xs h-9 cursor-pointer"
              >
                Modifier
              </Button>

              <Button
                onClick={onConfirm}
                disabled={isSubmitting || bookingConflict}
                className="cursor-pointer font-semibold text-xs h-9 px-5 shadow-xs"
              >
                {isSubmitting ? "Confirmation..." : "Valider la réservation"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
