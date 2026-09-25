import React from "react"
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Filter,
  RotateCcw,
  Globe,
  Search,
  LayoutGrid,
  List,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import type {
  CalendarViewMode,
  BookingStatusFilter,
  TimeRangeFilter,
} from "../types"
import { formatFullDateInTz } from "../hooks/useTeacherBookings"

interface BookingsToolbarProps {
  viewMode: CalendarViewMode
  onViewModeChange: (mode: CalendarViewMode) => void
  selectedDate: Date
  timezone: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  statusFilter: BookingStatusFilter
  onStatusFilterChange: (status: BookingStatusFilter) => void
  timeRangeFilter: TimeRangeFilter
  onTimeRangeFilterChange: (range: TimeRangeFilter) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  hasActiveFilters: boolean
  onResetFilters: () => void
}

export const BookingsToolbar: React.FC<BookingsToolbarProps> = ({
  viewMode,
  onViewModeChange,
  selectedDate,
  timezone,
  onPrev,
  onNext,
  onToday,
  statusFilter,
  onStatusFilterChange,
  timeRangeFilter,
  onTimeRangeFilterChange,
  searchQuery,
  onSearchQueryChange,
  hasActiveFilters,
  onResetFilters,
}) => {
  // Compute localized date label depending on viewMode
  const dateLabel = React.useMemo(() => {
    if (viewMode === "day") {
      return formatFullDateInTz(selectedDate, timezone)
    }
    if (viewMode === "week") {
      const curr = new Date(selectedDate)
      const day = curr.getDay()
      const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(curr.setDate(diffToMonday))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)

      try {
        const startStr = new Intl.DateTimeFormat("fr-FR", {
          timeZone: timezone,
          day: "numeric",
          month: "short",
        }).format(monday)
        const endStr = new Intl.DateTimeFormat("fr-FR", {
          timeZone: timezone,
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(sunday)
        return `Semaine du ${startStr} au ${endStr}`
      } catch {
        return `Semaine du ${monday.toLocaleDateString("fr-FR")}`
      }
    }
    return "Toutes les réservations"
  }, [selectedDate, viewMode, timezone])

  return (
    <div className="space-y-3.5 bg-card p-4 rounded-xl border border-border/70 shadow-xs">
      {/* Upper row: Navigation & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Date Navigation */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg border border-border/70 p-0.5 bg-muted/20">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-foreground"
              onClick={onPrev}
              title="Période précédente"
              aria-label="Période précédente"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold"
              onClick={onToday}
            >
              Aujourd'hui
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-foreground"
              onClick={onNext}
              title="Période suivante"
              aria-label="Période suivante"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground capitalize">
              {dateLabel}
            </span>
            <Badge
              variant="outline"
              className="hidden md:inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground border-border/60 bg-muted/10 py-0.5 px-2"
            >
              <Globe className="size-3 text-muted-foreground/70" />
              <span>{timezone}</span>
            </Badge>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 self-start sm:self-auto rounded-lg border border-border/70 p-0.5 bg-muted/20">
          <Button
            variant={viewMode === "day" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-3 text-xs gap-1.5 font-medium"
            onClick={() => onViewModeChange("day")}
          >
            <Clock className="size-3.5" />
            <span>Jour</span>
          </Button>
          <Button
            variant={viewMode === "week" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-3 text-xs gap-1.5 font-medium"
            onClick={() => onViewModeChange("week")}
          >
            <LayoutGrid className="size-3.5" />
            <span>Semaine</span>
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-3 text-xs gap-1.5 font-medium"
            onClick={() => onViewModeChange("list")}
          >
            <List className="size-3.5" />
            <span>Liste</span>
          </Button>
        </div>
      </div>

      {/* Lower row: Filters, Search, Reset */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-border/40">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="size-3.5 text-muted-foreground" />
            <select
              aria-label="Filtrer par statut"
              value={statusFilter}
              onChange={(e) =>
                onStatusFilterChange(e.target.value as BookingStatusFilter)
              }
              className="h-8 rounded-lg border border-border/70 bg-background px-2.5 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary shadow-2xs"
            >
              <option value="all">Tous les statuts</option>
              <option value="confirmed">Confirmées</option>
              <option value="requested">En attente (à valider)</option>
              <option value="completed">Terminées</option>
              <option value="cancelled">Annulées</option>
              <option value="no_show">Absence (No-show)</option>
            </select>
          </div>

          {/* Time Range Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarIcon className="size-3.5 text-muted-foreground" />
            <select
              aria-label="Filtrer par période"
              value={timeRangeFilter}
              onChange={(e) =>
                onTimeRangeFilterChange(e.target.value as TimeRangeFilter)
              }
              className="h-8 rounded-lg border border-border/70 bg-background px-2.5 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary shadow-2xs"
            >
              <option value="all">Toutes les périodes</option>
              <option value="today">Aujourd'hui</option>
              <option value="upcoming">À venir</option>
              <option value="past">Passées</option>
            </select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <RotateCcw className="size-3" />
              <span>Réinitialiser les filtres</span>
            </Button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Rechercher un élève..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="h-8 pl-8 pr-3 text-xs"
          />
        </div>
      </div>
    </div>
  )
}
