import React from "react"
import { Link } from "react-router-dom"
import { ChevronRight, Award } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface AssessmentLibraryHeaderProps {
  totalCount?: number
  totalAssessments?: number
}

export const AssessmentLibraryHeader: React.FC<AssessmentLibraryHeaderProps> = ({
  totalCount,
  totalAssessments,
}) => {
  const count = totalAssessments ?? totalCount
  return (
    <div className="space-y-3 pb-6 border-b border-border/60">
      {/* Breadcrumb Trail */}
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground transition-colors">
          Accueil
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
        <span className="font-medium text-foreground">Simulations TEF</span>
      </nav>

      {/* Main Title & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Simulations TEF
            </h1>
            {count !== undefined && count > 0 && (
              <Badge variant="outline" className="font-mono tabular-nums text-xs gap-1">
                <Award className="size-3 text-primary" />
                <span>{count} simulation{count > 1 ? "s" : ""}</span>
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Évaluez votre niveau dans les conditions d'une épreuve chronométrée.
          </p>
        </div>
      </div>
    </div>
  )
}
