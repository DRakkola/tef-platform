/**
 * TeacherCorrectionWorkspacePage — /teacher/corrections/:id
 *
 * Full two-panel correction workspace.
 * Left panel: student essay + task context.
 * Right panel: score, error annotations, feedback.
 * Toolbar: back, identity, status, submit CTA.
 *
 * Authorization: teacher or admin only. Backend enforces ownership.
 */

import React, { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate, useBlocker } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { ForbiddenPage } from "@/components/feedback"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertCircle,
  RefreshCw,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import { useAuth } from "@/features/auth"
import { useTeacherCorrectionWorkspace } from "./hooks/useTeacherCorrectionWorkspace"
import {
  WorkspaceToolbar,
  StudentResponsePanel,
  CorrectionPanel,
  UnsavedChangesDialog,
  SubmitConfirmDialog,
} from "./components"

// ---------------------------------------------------------------------------
// Workspace skeleton
// ---------------------------------------------------------------------------

const WorkspaceSkeleton: React.FC = () => (
  <div className="flex flex-col min-h-screen">
    <div className="h-[57px] border-b border-border/70 flex items-center gap-4 px-4">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-4 w-px" />
      <Skeleton className="h-4 w-48" />
      <div className="ml-auto flex gap-3">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-8 w-36 rounded-md" />
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 p-6 flex-1">
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export const TeacherCorrectionWorkspacePage: React.FC = () => {
  const { id: submissionId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isLoading: isAuthLoading } = useAuth()

  const {
    submission,
    isLoading,
    isError,
    error,
    refetch,
    form,
    updateField,
    addErrorItem,
    updateErrorItem,
    removeErrorItem,
    isDirty,
    isValid,
    validationErrors,
    claimAndStart,
    isClaimPending,
    submitCorrection,
    isSubmitPending,
    isSubmitSuccess,
    submitError,
  } = useTeacherCorrectionWorkspace(submissionId ?? "")

  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isUnsavedDialogOpen, setIsUnsavedDialogOpen] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  // -------------------------------------------------------------------------
  // Auto claim + start review on mount (if unassigned or assigned-not-reviewing)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (
      submission &&
      ["submitted", "queued", "assigned"].includes(submission.status) &&
      !isClaimPending
    ) {
      claimAndStart().catch(() => {
        // Claim may fail if already claimed by another teacher; workspace still shows content
      })
    }
    // Only run on first load of submission
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission?.id])

  // -------------------------------------------------------------------------
  // Unsaved changes blocker (React Router v6+)
  // -------------------------------------------------------------------------
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        isDirty &&
        !isSubmitSuccess &&
        currentLocation.pathname !== nextLocation.pathname,
      [isDirty, isSubmitSuccess]
    )
  )

  useEffect(() => {
    if (blocker.state === "blocked") {
      setIsUnsavedDialogOpen(true)
      setPendingNavigation(() => () => blocker.proceed())
    }
  }, [blocker.state])

  // Browser beforeunload
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty && !isSubmitSuccess) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty, isSubmitSuccess])

  // -------------------------------------------------------------------------
  // Auth / role check
  // -------------------------------------------------------------------------
  if (!isAuthLoading && user && user.role !== "teacher" && user.role !== "admin") {
    return <ForbiddenPage />
  }

  const errorMsg = (error as Error)?.message ?? ""
  if (
    isError &&
    (errorMsg.includes("403") || errorMsg.includes("FORBIDDEN") || errorMsg.includes("not authorized"))
  ) {
    return <ForbiddenPage />
  }

  // -------------------------------------------------------------------------
  // Submit flow
  // -------------------------------------------------------------------------
  const handleSubmitClick = () => {
    if (!isValid) return
    setIsConfirmOpen(true)
  }

  const handleConfirmSubmit = async () => {
    setIsConfirmOpen(false)
    try {
      await submitCorrection()
      setShowSuccess(true)
      setTimeout(() => navigate("/teacher/corrections"), 2000)
    } catch {
      // submitError state is set by hook
    }
  }

  // -------------------------------------------------------------------------
  // Missing submissionId
  // -------------------------------------------------------------------------
  if (!submissionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <p className="text-sm text-muted-foreground">Identifiant de correction manquant.</p>
        <Button variant="outline" onClick={() => navigate("/teacher/corrections")}>
          Retour aux corrections
        </Button>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------
  if (isLoading || isAuthLoading) {
    return <WorkspaceSkeleton />
  }

  // -------------------------------------------------------------------------
  // Error
  // -------------------------------------------------------------------------
  if (isError) {
    return (
      <AppShell headerTitle="Correction" studentName={user?.first_name ?? "Professeur"}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center px-4">
          <AlertCircle className="h-8 w-8 text-destructive/60" />
          <p className="text-sm font-medium text-foreground">
            Impossible de charger cette correction.
          </p>
          <p className="text-xs text-muted-foreground max-w-sm">
            {errorMsg || "La soumission est introuvable ou vous n'y avez pas accès."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Réessayer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/teacher/corrections")}>
              Retour aux corrections
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!submission) return null

  const isReadonly = ["corrected", "returned"].includes(submission.status)

  // -------------------------------------------------------------------------
  // Workspace layout
  // -------------------------------------------------------------------------
  return (
    <>
      {/* Full-height layout with sticky toolbar — no AppShell chrome needed */}
      <div className="flex flex-col min-h-screen bg-background">
        {/* Sticky toolbar */}
        <WorkspaceToolbar
          submission={submission}
          isDirty={isDirty}
          isValid={isValid}
          isSubmitPending={isSubmitPending}
          isSubmitSuccess={isSubmitSuccess}
          onSubmitClick={handleSubmitClick}
        />

        {/* Success banner */}
        {showSuccess && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              La correction a été envoyée. Redirection en cours…
            </p>
          </div>
        )}

        {/* Submit error banner */}
        {submitError && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-destructive/10 border-b border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{submitError}</p>
          </div>
        )}

        {/* Claim pending banner */}
        {isClaimPending && (
          <div className="flex items-center gap-2 px-4 py-2 bg-muted border-b border-border/50">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Attribution en cours…</p>
          </div>
        )}

        {/* Readonly banner */}
        {isReadonly && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b border-border/50">
            <p className="text-xs text-muted-foreground">
              Cette correction a déjà été soumise à l'élève et ne peut plus être modifiée.
            </p>
          </div>
        )}

        {/* Main two-panel layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-0">
          {/* Left: Student response */}
          <div className="border-r border-border/50 overflow-y-auto p-5 lg:p-6">
            <StudentResponsePanel submission={submission} />
          </div>

          {/* Right: Correction panel */}
          <div className="overflow-y-auto p-5 lg:p-6">
            <CorrectionPanel
              form={form}
              readonly={isReadonly}
              validationErrors={validationErrors}
              onChange={updateField}
              onAddError={addErrorItem}
              onUpdateError={updateErrorItem}
              onRemoveError={removeErrorItem}
            />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <UnsavedChangesDialog
        open={isUnsavedDialogOpen}
        onStay={() => {
          setIsUnsavedDialogOpen(false)
          if (blocker.state === "blocked") blocker.reset()
          setPendingNavigation(null)
        }}
        onLeave={() => {
          setIsUnsavedDialogOpen(false)
          if (pendingNavigation) {
            pendingNavigation()
            setPendingNavigation(null)
          }
        }}
      />

      <SubmitConfirmDialog
        open={isConfirmOpen}
        isPending={isSubmitPending}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  )
}
