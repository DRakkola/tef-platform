/**
 * WritingExitDialog Component.
 * Modal confirming candidate intent to leave an active writing session.
 * Clarifies that the server timer continues running even after exit.
 */

import React from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

export interface WritingExitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmExit: () => void
}

export const WritingExitDialog: React.FC<WritingExitDialogProps> = ({
  open,
  onOpenChange,
  onConfirmExit,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <DialogTitle>Quitter l'épreuve d'écriture ?</DialogTitle>
              <DialogDescription className="mt-1">
                Le chronomètre de l'examen reste actif.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs text-muted-foreground leading-relaxed">
          <p>
            Votre texte actuel a été sauvegardé comme brouillon. Cependant, conformément aux conditions réelles du TEF,{" "}
            <strong className="text-foreground font-semibold">le compte à rebours continue de s'écouler</strong> tant que le temps imparti n'est pas expiré.
          </p>
          <p>
            Vous pourrez reprendre votre épreuve depuis votre espace d'entraînement avant la fin du temps imparti.
          </p>
        </div>

        <DialogFooter className="pt-3 gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Poursuivre la rédaction
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onOpenChange(false)
              onConfirmExit()
            }}
            className="cursor-pointer font-medium"
          >
            Quitter maintenant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
