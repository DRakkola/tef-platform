/**
 * TeacherBookingsPage: Dedicated teacher scheduling & bookings workspace (/teacher/bookings).
 * Displays today's sessions, week view, list view, summary metrics, and allows
 * teachers to join, confirm, reschedule, and cancel sessions.
 */

import React from "react"
import { AppShell } from "@/components/layout/AppShell"
import { PageShell } from "@/components/layout/PageShell"
import { ForbiddenPage } from "@/components/feedback"
import { useAuth } from "@/features/auth"
import { useTeacherBookings } from "./hooks/useTeacherBookings"
import {
  TeacherBookingsHeader,
  BookingsSummaryCards,
  BookingsToolbar,
  BookingsDayView,
  BookingsWeekView,
  BookingsListView,
  BookingDetailModal,
  CancelBookingDialog,
  RescheduleBookingModal,
  BookingsSkeleton,
} from "./components"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

export const TeacherBookingsPage: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth()
  const {
    profile,
    teacherTimezone,
    isProfileLoading,
    isProfileError,
    profileError,

    filteredBookings,
    dayViewBookings,
    weekDays,
    summaryMetrics,

    isBookingsLoading,
    isBookingsError,
    bookingsError,
    refetchBookings,

    viewMode,
    setViewMode,
    selectedDate,
    statusFilter,
    setStatusFilter,
    timeRangeFilter,
    setTimeRangeFilter,
    searchQuery,
    setSearchQuery,
    hasActiveFilters,

    goToToday,
    goToPrev,
    goToNext,
    resetFilters,

    selectedBooking,
    setSelectedBooking,
    bookingToAction,
    isCancelDialogOpen,
    setIsCancelDialogOpen,
    isRescheduleModalOpen,
    setIsRescheduleModalOpen,
    actionError,
    openCancelDialog,
    openRescheduleModal,

    confirmMutation,
    cancelMutation,
    rescheduleMutation,
    completeMutation,
    noShowMutation,
  } = useTeacherBookings()

  // 1. Auth & Role Verification (students cannot access teacher bookings)
  if (!isAuthLoading && user && user.role !== "teacher" && user.role !== "admin") {
    return <ForbiddenPage />
  }

  // 2. Profile Authorization Error (Backend returned 403)
  if (isProfileError) {
    const isForbidden =
      profileError instanceof Error &&
      (profileError.message.includes("403") ||
        profileError.message.includes("FORBIDDEN") ||
        profileError.message.includes("not authorized"))

    if (isForbidden) {
      return <ForbiddenPage />
    }
  }

  return (
    <AppShell
      headerTitle="Mes réservations"
      studentName={profile?.display_name || user?.first_name || "Professeur"}
    >
      <PageShell maxWidth="wide">
        <div className="space-y-6">
          {/* Header */}
          <TeacherBookingsHeader />

          {/* Loading Skeleton */}
          {isBookingsLoading || isProfileLoading ? (
            <BookingsSkeleton />
          ) : isBookingsError ? (
            /* Error State with Retry */
            <div
              className="p-8 text-center space-y-3 rounded-2xl border border-destructive/20 bg-destructive/5"
              role="alert"
            >
              <AlertTriangle className="size-10 text-destructive mx-auto" />
              <h3 className="text-base font-semibold text-foreground">
                Impossible de charger vos réservations
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {bookingsError?.message ||
                  "Une erreur est survenue lors de la récupération de vos séances. Veuillez réessayer."}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetchBookings()}
                className="text-xs gap-1.5"
              >
                <RefreshCw className="size-3.5" />
                <span>Réessayer</span>
              </Button>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <BookingsSummaryCards
                metrics={summaryMetrics}
                isLoading={isBookingsLoading}
              />

              {/* Toolbar */}
              <BookingsToolbar
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                selectedDate={selectedDate}
                timezone={teacherTimezone}
                onPrev={goToPrev}
                onNext={goToNext}
                onToday={goToToday}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                timeRangeFilter={timeRangeFilter}
                onTimeRangeFilterChange={setTimeRangeFilter}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                hasActiveFilters={hasActiveFilters}
                onResetFilters={resetFilters}
              />

              {/* Active View */}
              {viewMode === "day" && (
                <BookingsDayView
                  bookings={dayViewBookings}
                  timezone={teacherTimezone}
                  onSelectBooking={(b) => setSelectedBooking(b)}
                  onConfirm={(id) => confirmMutation.mutate(id)}
                  onCancel={(b) => openCancelDialog(b)}
                  onReschedule={(b) => openRescheduleModal(b)}
                  isConfirming={confirmMutation.isPending}
                />
              )}

              {viewMode === "week" && (
                <BookingsWeekView
                  weekDays={weekDays}
                  timezone={teacherTimezone}
                  onSelectBooking={(b) => setSelectedBooking(b)}
                />
              )}

              {viewMode === "list" && (
                <BookingsListView
                  bookings={filteredBookings}
                  timezone={teacherTimezone}
                  onSelectBooking={(b) => setSelectedBooking(b)}
                  onConfirm={(id) => confirmMutation.mutate(id)}
                  onCancel={(b) => openCancelDialog(b)}
                  onReschedule={(b) => openRescheduleModal(b)}
                  isConfirming={confirmMutation.isPending}
                  hasActiveFilters={hasActiveFilters}
                  onResetFilters={resetFilters}
                />
              )}
            </>
          )}

          {/* Booking Detail Modal */}
          <BookingDetailModal
            booking={selectedBooking}
            timezone={teacherTimezone}
            isOpen={!!selectedBooking}
            onClose={() => setSelectedBooking(null)}
            onConfirm={(id) => confirmMutation.mutate(id)}
            onCancel={(b) => openCancelDialog(b)}
            onReschedule={(b) => openRescheduleModal(b)}
            onComplete={(id) => completeMutation.mutate(id)}
            onNoShow={(id) => noShowMutation.mutate(id)}
            isConfirming={confirmMutation.isPending}
            isCompleting={completeMutation.isPending}
            isMarkingNoShow={noShowMutation.isPending}
          />

          {/* Cancel Booking Dialog */}
          <CancelBookingDialog
            booking={bookingToAction}
            timezone={teacherTimezone}
            isOpen={isCancelDialogOpen}
            onClose={() => setIsCancelDialogOpen(false)}
            onConfirmCancel={(id, reason) =>
              cancelMutation.mutate({ id, reason })
            }
            isLoading={cancelMutation.isPending}
            error={actionError}
          />

          {/* Reschedule Booking Modal */}
          <RescheduleBookingModal
            booking={bookingToAction}
            timezone={teacherTimezone}
            isOpen={isRescheduleModalOpen}
            onClose={() => setIsRescheduleModalOpen(false)}
            onConfirmReschedule={(id, payload) =>
              rescheduleMutation.mutate({ id, payload })
            }
            isLoading={rescheduleMutation.isPending}
            error={actionError}
          />
        </div>
      </PageShell>
    </AppShell>
  )
}
