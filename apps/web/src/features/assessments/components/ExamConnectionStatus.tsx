import React from "react"
import { WifiOff, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface ExamConnectionStatusProps {
  isOnline: boolean
  onCheckConnection?: () => void
}

export const ExamConnectionStatus: React.FC<ExamConnectionStatusProps> = ({
  isOnline,
  onCheckConnection,
}) => {
  if (isOnline) return null

  return (
    <div
      role="alert"
      className="w-full bg-amber-500/10 border-b border-amber-500/30 text-foreground px-4 py-2 text-xs flex items-center justify-between gap-3 animate-in fade-in"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <div>
          <span className="font-semibold text-amber-700 dark:text-amber-300">
            Connexion interrompue.
          </span>{" "}
          <span className="text-muted-foreground">
            Vos réponses sont conservées localement et seront resynchronisées dès le rétablissement de la connexion.
          </span>
        </div>
      </div>

      {onCheckConnection && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCheckConnection}
          className="h-7 text-xs px-2.5 shrink-0 border-amber-500/40 hover:bg-amber-500/10 cursor-pointer"
        >
          <RefreshCw className="size-3 mr-1" />
          <span>Vérifier</span>
        </Button>
      )}
    </div>
  )
}
