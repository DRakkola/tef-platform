import React from "react"
import { Clock, Globe } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatCurrentTeacherDate } from "../hooks/useTeacherDashboard"

interface TeacherHeaderProps {
  displayName?: string
  timezone: string
}

export const TeacherHeader: React.FC<TeacherHeaderProps> = ({ displayName, timezone }) => {
  const cleanName = displayName ? displayName.replace(/^(prof\.|dr\.|m\.|mme\.)\s+/i, "") : ""
  const firstName = cleanName ? cleanName.split(" ")[0] : "Professeur"
  const formattedDate = formatCurrentTeacherDate(timezone)

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-border/60">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Bonjour, {firstName}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Voici votre activité d'aujourd'hui.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 bg-muted/50 border border-border/60 px-3 py-1.5 rounded-full font-medium text-foreground capitalize">
          <Clock className="size-3.5 text-primary" />
          <span>Aujourd'hui, {formattedDate}</span>
        </div>

        <Badge variant="outline" className="text-xs font-mono gap-1 text-muted-foreground">
          <Globe className="size-3 text-muted-foreground" />
          <span>{timezone}</span>
        </Badge>
      </div>
    </div>
  )
}
