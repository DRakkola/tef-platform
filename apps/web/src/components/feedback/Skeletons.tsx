/**
 * Standardized skeleton loaders for progressive, non-jarring loading states.
 * Replaces disruptive full-screen spinners with contextual layouts.
 */

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface PageSkeletonProps {
  className?: string;
  hasMetrics?: boolean;
}

export const PageSkeleton: React.FC<PageSkeletonProps> = ({
  className,
  hasMetrics = true,
}) => {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Chargement de la page"
      className={cn("space-y-6 sm:space-y-8 animate-pulse", className)}
    >
      {/* Header Skeleton */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-8 w-60 rounded-md" />
            <Skeleton className="h-4 w-44 rounded-md" />
          </div>
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* Metrics Skeleton */}
      {hasMetrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-5 space-y-3 border-border/60">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-7 w-28 rounded-md" />
              <Skeleton className="h-3 w-32 rounded-md" />
            </Card>
          ))}
        </div>
      )}

      {/* Content Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6 space-y-4 border-border/60">
            <Skeleton className="h-5 w-44 rounded-md" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="p-6 space-y-4 border-border/60">
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="h-44 w-full rounded-lg" />
          </Card>
        </div>
      </div>
    </div>
  );
};

export interface SectionSkeletonProps {
  rows?: number;
  className?: string;
}

export const SectionSkeleton: React.FC<SectionSkeletonProps> = ({
  rows = 3,
  className,
}) => {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Chargement de la section"
      className={cn("space-y-4 rounded-xl border border-border/60 bg-card p-6", className)}
    >
      <div className="space-y-2">
        <Skeleton className="h-5 w-48 rounded-md" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>
      <div className="space-y-3 pt-2">
        {[...Array(rows)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
};

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 4,
  className,
}) => {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Chargement du tableau"
      className={cn("rounded-xl border border-border/60 bg-card overflow-hidden", className)}
    >
      {/* Table Header */}
      <div className="border-b border-border/60 bg-muted/30 p-4 flex gap-4">
        {[...Array(columns)].map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 rounded-md" />
        ))}
      </div>
      {/* Table Rows */}
      <div className="divide-y divide-border/60">
        {[...Array(rows)].map((_, r) => (
          <div key={r} className="p-4 flex gap-4 items-center">
            {[...Array(columns)].map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1 rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export interface CardGridSkeletonProps {
  count?: number;
  columns?: number;
  className?: string;
}

export const CardGridSkeleton: React.FC<CardGridSkeletonProps> = ({
  count = 6,
  columns = 3,
  className,
}) => {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Chargement des éléments"
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 gap-4",
        columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
        className
      )}
    >
      {[...Array(count)].map((_, i) => (
        <Card key={i} className="p-5 space-y-4 border-border/60">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-3 w-20 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-4 w-16 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </Card>
      ))}
    </div>
  );
};
