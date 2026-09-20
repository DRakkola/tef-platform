import React from "react"
import type { BookingTab, ServiceFilter, StatusFilter } from "../hooks/useMyBookings"

export interface BookingTabsProps {
  activeTab: BookingTab
  onTabChange: (tab: BookingTab) => void
  upcomingCount: number
  pastCount: number
  totalCount: number
  serviceFilter: ServiceFilter
  onServiceFilterChange: (filter: ServiceFilter) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (filter: StatusFilter) => void
}

export const BookingTabs: React.FC<BookingTabsProps> = ({
  activeTab,
  onTabChange,
  upcomingCount,
  pastCount,
  totalCount,
  serviceFilter,
  onServiceFilterChange,
  statusFilter,
  onStatusFilterChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Catégories de réservations"
        className="inline-flex items-center gap-1 rounded-xl border border-border/70 bg-muted/30 p-1 self-start sm:self-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "upcoming"}
          onClick={() => onTabChange("upcoming")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "upcoming"
              ? "bg-card text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>À venir</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "upcoming" ? "bg-primary/15 text-primary font-bold" : "bg-muted text-muted-foreground"
            }`}
          >
            {upcomingCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "past"}
          onClick={() => onTabChange("past")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "past"
              ? "bg-card text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Passées</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "past" ? "bg-primary/15 text-primary font-bold" : "bg-muted text-muted-foreground"
            }`}
          >
            {pastCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "all"}
          onClick={() => onTabChange("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "all"
              ? "bg-card text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Toutes</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "all" ? "bg-primary/15 text-primary font-bold" : "bg-muted text-muted-foreground"
            }`}
          >
            {totalCount}
          </span>
        </button>
      </div>

      {/* Filter Selects */}
      <div className="flex items-center gap-2">
        {/* Service Filter */}
        <select
          value={serviceFilter}
          onChange={(e) => onServiceFilterChange(e.target.value as ServiceFilter)}
          aria-label="Filtrer par service"
          className="h-8 rounded-lg border border-input bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 cursor-pointer"
        >
          <option value="all">Tous les services</option>
          <option value="speaking">Expression orale</option>
          <option value="writing">Expression écrite</option>
          <option value="other">Méthodologie & Autres</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
          aria-label="Filtrer par statut"
          className="h-8 rounded-lg border border-input bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 cursor-pointer"
        >
          <option value="all">Tous les statuts</option>
          <option value="confirmed">Confirmée</option>
          <option value="requested">En attente</option>
          <option value="completed">Terminée</option>
          <option value="cancelled">Annulée</option>
        </select>
      </div>
    </div>
  )
}
