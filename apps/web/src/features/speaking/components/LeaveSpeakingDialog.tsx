import { AlertTriangle, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

export interface LeaveSpeakingDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirmLeave: () => void
  isTeacherSession?: boolean
}

export function LeaveSpeakingDialog({
  isOpen,
  onClose,
  onConfirmLeave,
  isTeacherSession = false,
}: LeaveSpeakingDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-2">
          <div className="size-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="size-5" />
          </div>
          <DialogTitle className="text-base sm:text-lg">
            Quitter la session d'expression orale ?
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {isTeacherSession ? (
              <>
                Votre professeur est actuellement connecté. Si vous quittez la séance maintenant,
                le temps officiel de la réservation continuera de s'écouler sur le serveur.
              </>
            ) : (
              <>
                Le chronomètre officiel de votre épreuve est géré par le serveur. Si vous quittez
                maintenant, votre session pourra être marquée comme incomplète ou expirée.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto cursor-pointer"
          >
            Poursuivre la session
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirmLeave}
            className="w-full sm:w-auto cursor-pointer gap-1.5"
          >
            <LogOut className="size-4" />
            <span>Quitter la session</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
