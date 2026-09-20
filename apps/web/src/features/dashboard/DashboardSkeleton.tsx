/**
 * Skeleton loading state for student dashboard.
 * Matches the 2-column desktop layout (8 cols / 4 cols) using semantic muted pulse tokens.
 */

import React from "react"

export const DashboardSkeleton: React.FC = () => {
  return (
    <div
      role="status"
      aria-label="Chargement du tableau de bord..."
      aria-busy="true"
      className="space-y-8 animate-pulse"
    >
      {/* 1. Hero Skeleton */}
      <div className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-5 w-24 rounded bg-muted" />
          <div className="h-5 w-20 rounded bg-muted/80" />
          <div className="h-5 w-16 rounded bg-muted/60" />
        </div>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
          <div className="space-y-4 max-w-xl flex-1">
            <div className="h-9 w-64 rounded-xl bg-muted" />
            <div className="h-4 w-full max-w-md rounded bg-muted/70" />
            <div className="h-16 w-80 rounded-xl bg-muted/30 border border-border/40" />
          </div>
          <div className="lg:w-80 h-44 rounded-2xl bg-muted/30 border border-border/60 p-5 space-y-3 shrink-0" />
        </div>
      </div>

      {/* 2. Next Action Skeleton */}
      <div className="h-36 rounded-2xl border border-border/70 bg-card p-6 sm:p-8" />

      {/* 3. Main 2-Column Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): Progress Overview */}
        <div className="lg:col-span-8 space-y-8">
          <div className="h-96 rounded-2xl border border-border/70 bg-card p-6" />
        </div>

        {/* Right Column (4 cols): Daily Plan + Priority Skills + Recent Activity */}
        <div className="lg:col-span-4 space-y-8">
          <div className="h-64 rounded-2xl border border-border/70 bg-card p-6" />
          <div className="h-72 rounded-2xl border border-border/70 bg-card p-6" />
          <div className="h-60 rounded-2xl border border-border/70 bg-card p-6" />
        </div>
      </div>
    </div>
  )
}
