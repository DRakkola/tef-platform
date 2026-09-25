/**
 * SubmitConfirmDialog: Confirmation before sending a correction to the student.
 */

import React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"

interface Props {
  open: boolean
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const SubmitConfirmDialog: React.FC<Props> = ({
  open,
  isPending,
  onConfirm,
  onCancel,
}) => {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Soumettre la correction ?</AlertDialogTitle>
          <AlertDialogDescription>
            La correction sera envoyée à l'élève et ne pourra plus être modifiée.
            L'élève recevra une notification et pourra consulter votre évaluation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isPending}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi en cours…
              </>
            ) : (
              "Oui, envoyer la correction"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
