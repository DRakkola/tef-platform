import React from "react"
import { Link } from "react-router-dom"
import { ChevronRight, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface PracticeHeaderProps {
  totalCount?: number
  completedTodayCount?: number
  totalTodayCount?: number
}

export const PracticeHeader: React.FC<PracticeHeaderProps> = ({
  totalCount,
  completedTodayCount,
  totalTodayCount,
}) => {
  return (
    <div className="space-y-3 pb-6 border-b border-border/60">
      {/* Breadcrumb Trail */}
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link
          to="/dashboard"
          className="hover:text-foreground transition-colors"
        >
          Accueil
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
        <span className="font-medium text-foreground">Pratique</span>
      </nav>

      {/* Main Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Pratique
            </h1>
            {totalTodayCount !== undefined && totalTodayCount > 0 ? (
              <Badge variant="secondary" className="gap-1.5 font-medium">
                <Sparkles className="size-3 text-primary" />
                <span className="font-mono tabular-nums">
                  {completedTodayCount ?? 0}/{totalTodayCount}
                </span>{" "}
                terminé aujourd'hui
              </Badge>
            ) : totalCount !== undefined && totalCount > 0 ? (
              <Badge variant="outline" className="font-mono tabular-nums text-xs">
                {totalCount} activité{totalCount > 1 ? "s" : ""}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Espace d'entraînement & Pratique ciblée — Travaillez les compétences qui vous rapprochent de votre objectif.
          </p>
        </div>
      </div>
    </div>
  )
}
