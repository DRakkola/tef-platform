import React from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, GraduationCap, ShieldCheck } from "lucide-react"
import type { TeacherSummary, TeacherServiceItem } from "../types"

export interface BookingHeaderProps {
  teacher?: TeacherSummary
  selectedService?: TeacherServiceItem | null
}

export const BookingHeader: React.FC<BookingHeaderProps> = ({
  teacher,
  selectedService,
}) => {
  return (
    <header className="space-y-4 pb-4 border-b border-border/70">
      {/* Back link to teacher profile */}
      <div>
        <Link
          to={teacher ? `/teachers/${teacher.id}` : "/teachers"}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
          <span>Retour au profil enseignant</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Réserver une session
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <GraduationCap className="size-3.5 text-primary" aria-hidden="true" />
              {teacher?.display_name || "Enseignant certifié"}
            </span>
            {teacher?.verification_status === "approved" && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="size-3" aria-hidden="true" />
                Accrédité CCI
              </span>
            )}
            {selectedService && (
              <>
                <span className="text-border">·</span>
                <span className="font-semibold text-primary">
                  {selectedService.title}
                </span>
                <span className="text-muted-foreground">({selectedService.durationMinutes} min)</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
