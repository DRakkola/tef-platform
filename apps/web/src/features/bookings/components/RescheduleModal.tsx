import React from "react"
import { useNavigate } from "react-router-dom"
import { RotateCcw, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import type { TeacherBookingResponse } from "../types"

export interface RescheduleModalProps {
  booking: TeacherBookingResponse | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  booking,
  isOpen,
  onOpenChange,
}) => {
  const navigate = useNavigate()
  if (!booking) return null

  const handleProceedToReschedule = () => {
    onOpenChange(false)
    // Navigate to the booking flow for this teacher with reschedule parameter
    navigate(`/teachers/${booking.teacher_id}/book?rescheduleFrom=${booking.id}`)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <RotateCcw className="size-5 shrink-0" aria-hidden="true" />
            <DialogTitle className="text-lg font-bold">
              Reprogrammer votre session
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
            Vous allez choisir un nouveau créneau horaire avec <strong>{booking.teacher_display_name || "votre professeur"}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {/* Current Booking Box */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 space-y-1.5">
            <span className="text-muted-foreground block">Session actuelle :</span>
            <div className="flex items-center justify-between font-semibold text-foreground">
              <span>{booking.teacher_display_name}</span>
              <span className="font-mono">{new Date(booking.start_time).toLocaleDateString("fr-FR")}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1">
            <p className="font-semibold text-primary">Comment fonctionne la reprogrammation ?</p>
            <p className="text-muted-foreground leading-relaxed">
              Vous accédez au planning de votre enseignant pour sélectionner une nouvelle date. Votre créneau actuel restera garanti jusqu'à la confirmation de votre nouvel horaire.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto cursor-pointer text-xs"
          >
            Annuler
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleProceedToReschedule}
            className="w-full sm:w-auto cursor-pointer text-xs gap-1.5 font-semibold shadow-xs"
          >
            <span>Choisir un nouvel horaire</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
