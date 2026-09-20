import { ArrowUpDown } from "lucide-react"
import type { TeacherSortOption } from "../types"

export interface TeacherSortProps {
  value: TeacherSortOption
  onChange: (sort: TeacherSortOption) => void
  className?: string
}

export function TeacherSort({ value, onChange, className }: TeacherSortProps) {
  return (
    <div className={`flex items-center gap-2 text-xs shrink-0 ${className || ""}`}>
      <span className="text-muted-foreground hidden sm:inline flex items-center gap-1">
        <ArrowUpDown className="size-3 text-muted-foreground" />
        Trier par :
      </span>
      <select
        aria-label="Trier les professeurs"
        value={value}
        onChange={(e) => onChange(e.target.value as TeacherSortOption)}
        className="h-9 px-2.5 text-xs bg-card border border-border/80 rounded-lg text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer transition-colors shadow-2xs"
      >
        <option value="recommended">Recommandés</option>
        <option value="price_asc">Tarif croissant</option>
        <option value="price_desc">Tarif décroissant</option>
        <option value="earliest_availability">Plus tôt disponible</option>
      </select>
    </div>
  )
}
