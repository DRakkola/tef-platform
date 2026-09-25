/**
 * TeacherCorrectionsPage — /teacher/corrections
 *
 * Teacher writing correction queue. Shows all submissions assigned to or
 * available for the authenticated teacher, with filter tabs by status.
 *
 * Authorization: teacher or admin only (role check + backend 403 propagation).
 */

import React from "react"
import { AppShell } from "@/components/layout/AppShell"
import { PageShell } from "@/components/layout/PageShell"
import { ForbiddenPage } from "@/components/feedback"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"
import { useAuth } from "@/features/auth"
import { useTeacherCorrections } from "./hooks/useTeacherCorrections"
import {
  TeacherCorrectionsHeader,
  CorrectionsFilterBar,
  CorrectionsTable,
  CorrectionsEmptyState,
  CorrectionsSkeleton,
} from "./components"

export const TeacherCorrectionsPage: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth()

  const {
    submissions,
    allSubmissions,
    counts,
    activeFilter,
    setActiveFilter,
    isLoading,
    isError,
    error,
    refetch,
    claimSubmission,
    isClaimPending,
  } = useTeacherCorrections()

  // -------------------------------------------------------------------------
  // 1. Auth / Role check
  // -------------------------------------------------------------------------
  if (!isAuthLoading && user && user.role !== "teacher" && user.role !== "admin") {
    return <ForbiddenPage />
  }

  // Propagate backend 403
  const errorMsg = (error as Error)?.message ?? ""
  if (
    isError &&
    (errorMsg.includes("403") || errorMsg.includes("FORBIDDEN") || errorMsg.includes("not authorized"))
  ) {
    return <ForbiddenPage />
  }

  // -------------------------------------------------------------------------
  // 2. Render
  // -------------------------------------------------------------------------
  return (
    <AppShell
      headerTitle="Corrections"
      studentName={user?.first_name ?? "Professeur"}
      studentEmail={user?.email}
    >
      <PageShell maxWidth="default">
        <div className="space-y-5">
          {/* Header */}
          <TeacherCorrectionsHeader
            totalCount={allSubmissions.length}
            pendingCount={counts.pending}
          />

          {/* Filter bar */}
          <CorrectionsFilterBar
            activeFilter={activeFilter}
            counts={counts}
            onFilterChange={setActiveFilter}
          />

          {/* Content */}
          {isLoading || isAuthLoading ? (
            <CorrectionsSkeleton />
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <AlertCircle className="h-8 w-8 text-destructive/60" />
              <p className="text-sm font-medium text-foreground">
                Impossible de charger les corrections.
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {errorMsg || "Une erreur est survenue lors du chargement. Veuillez réessayer."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Réessayer
              </Button>
            </div>
          ) : submissions.length === 0 ? (
            <CorrectionsEmptyState
              filter={activeFilter}
              totalCount={allSubmissions.length}
            />
          ) : (
            <CorrectionsTable
              submissions={submissions}
              isClaimPending={isClaimPending}
              onClaim={claimSubmission}
            />
          )}
        </div>
      </PageShell>
    </AppShell>
  )
}
