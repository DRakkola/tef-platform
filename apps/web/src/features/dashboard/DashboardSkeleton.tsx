/**
 * Skeleton loading state for student dashboard.
 */

import React from "react";

export const DashboardSkeleton: React.FC = () => {
  return (
    <div
      role="status"
      aria-label="Chargement du tableau de bord..."
      aria-busy="true"
      className="space-y-8 animate-pulse p-6 max-w-7xl mx-auto"
    >
      {/* Header skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-6">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-lg bg-slate-800" />
          <div className="h-4 w-40 rounded bg-slate-800/60" />
        </div>
        <div className="h-10 w-32 rounded-lg bg-slate-800" />
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-36 rounded-xl border border-white/5 bg-slate-900/50 p-5 space-y-4"
          >
            <div className="flex justify-between">
              <div className="h-4 w-16 rounded bg-slate-800" />
              <div className="h-4 w-20 rounded bg-slate-800" />
            </div>
            <div className="h-8 w-24 rounded bg-slate-800" />
            <div className="h-4 w-36 rounded bg-slate-800/50" />
          </div>
        ))}
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-64 rounded-xl border border-white/5 bg-slate-900/50 p-6" />
          <div className="h-64 rounded-xl border border-white/5 bg-slate-900/50 p-6" />
        </div>
        <div className="space-y-6">
          <div className="h-72 rounded-xl border border-white/5 bg-slate-900/50 p-6" />
          <div className="h-64 rounded-xl border border-white/5 bg-slate-900/50 p-6" />
        </div>
      </div>
    </div>
  );
};
