import { Calendar, Clock, AlertCircle } from "lucide-react"
import { useTeacherAvailabilityPreview } from "../hooks/useTeacherAvailabilityPreview"

export interface TeacherAvailabilityPreviewProps {
  teacherId: string
  className?: string
}

export function TeacherAvailabilityPreview({
  teacherId,
  className,
}: TeacherAvailabilityPreviewProps) {
  const { formattedNextSlot, hasSlots, isLoading } = useTeacherAvailabilityPreview(teacherId)

  if (isLoading) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse ${className || ""}`}>
        <Clock className="size-3.5 text-muted-foreground/60 shrink-0" />
        <span className="h-3 w-28 bg-muted/60 rounded-sm" />
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-label={`Disponibilité : ${formattedNextSlot}`}
      className={`flex items-center gap-1.5 text-xs ${className || ""}`}
    >
      {hasSlots ? (
        <>
          <Calendar className="size-3.5 text-emerald-500 shrink-0" />
          <span className="text-muted-foreground">
            Prochain créneau :{" "}
            <strong className="font-semibold text-foreground">{formattedNextSlot}</strong>
          </span>
        </>
      ) : (
        <>
          <AlertCircle className="size-3.5 text-muted-foreground/60 shrink-0" />
          <span className="text-muted-foreground italic">
            Aucune disponibilité cette semaine
          </span>
        </>
      )}
    </div>
  )
}
