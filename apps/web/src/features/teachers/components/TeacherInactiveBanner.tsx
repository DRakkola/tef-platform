import { AlertCircle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface TeacherInactiveBannerProps {
  onBackToTeachers: () => void
}

export function TeacherInactiveBanner({ onBackToTeachers }: TeacherInactiveBannerProps) {
  return (
    <div
      role="alert"
      className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-900 dark:text-amber-200 my-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-xs">
          <strong className="text-sm font-semibold block">
            Cet enseignant n'accepte pas de réservations actuellement
          </strong>
          <p className="text-muted-foreground">
            Ce profil est temporairement indisponible pour de nouvelles sessions. Vous pouvez consulter les autres formateurs certifiés.
          </p>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onBackToTeachers}
        className="cursor-pointer gap-1.5 text-xs font-semibold shrink-0 border-amber-500/30 hover:bg-amber-500/10"
      >
        <ArrowLeft className="size-3.5" />
        <span>Retour aux professeurs</span>
      </Button>
    </div>
  )
}
