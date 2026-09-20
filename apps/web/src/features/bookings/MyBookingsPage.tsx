import React from "react"
import { AppShell } from "@/components/layout/AppShell"
import { PageShell } from "@/components/layout/PageShell"
import { ErrorState } from "@/components/common/ErrorState"
import { useMyBookings } from "./hooks/useMyBookings"
import { BookingsHeader } from "./components/BookingsHeader"
import { BookingTabs } from "./components/BookingTabs"
import { BookingCard } from "./components/BookingCard"
import { BookingEmptyState } from "./components/BookingEmptyState"
import { BookingDetailModal } from "./components/BookingDetailModal"
import { CancelBookingModal } from "./components/CancelBookingModal"
import { RescheduleModal } from "./components/RescheduleModal"
import type { TeacherBookingResponse } from "./types"

export const MyBookingsPage: React.FC = () => {
  const {
    tab,
    setTab,
    serviceFilter,
    setServiceFilter,
    statusFilter,
    setStatusFilter,
    bookings,
    upcomingBookings,
    pastBookings,
    groupedUpcomingBookings,
    isLoading,
    error,
    refetch,
    userTimezone,
    selectedBookingForDetail,
    setSelectedBookingForDetail,
    bookingToCancel,
    setBookingToCancel,
    cancelReason,
    setCancelReason,
    bookingToReschedule,
    setBookingToReschedule,
    handleOpenCancel,
    handleConfirmCancel,
    isCancelling,
    getJoinStatus,
  } = useMyBookings()

  const handleOpenDetail = (booking: TeacherBookingResponse) => {
    setSelectedBookingForDetail(booking)
  }

  const handleOpenReschedule = (booking: TeacherBookingResponse) => {
    setBookingToReschedule(booking)
  }

  return (
    <AppShell
      headerTitle="Mes réservations"
      studentName="Candidat TEF"
      targetExam="TEF Canada"
      targetLevel="B2"
    >
      <PageShell maxWidth="default">
        <div className="space-y-6 pb-12">
          {/* Header */}
          <BookingsHeader />

          {/* Filter Tabs & Selects */}
          <BookingTabs
            activeTab={tab}
            onTabChange={setTab}
            upcomingCount={upcomingBookings.length}
            pastCount={pastBookings.length}
            totalCount={upcomingBookings.length + pastBookings.length}
            serviceFilter={serviceFilter}
            onServiceFilterChange={setServiceFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />

          {/* Loading Skeleton */}
          {isLoading ? (
            <div className="space-y-3 pt-2 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-28 rounded-2xl bg-muted/40 border border-border/60"
                />
              ))}
            </div>
          ) : error ? (
            /* Error State */
            <ErrorState
              title="Impossible de charger vos réservations"
              description="Une erreur est survenue lors de la synchronisation de vos séances de coaching."
              actionLabel="Réessayer"
              onRetry={() => refetch()}
            />
          ) : bookings.length === 0 ? (
            /* Empty State */
            <BookingEmptyState tab={tab} />
          ) : tab === "upcoming" && groupedUpcomingBookings.length > 0 ? (
            /* Grouped Upcoming Bookings */
            <div className="space-y-6 pt-1">
              {groupedUpcomingBookings.map((group) => (
                <section
                  key={group.dateLabel}
                  aria-labelledby={`date-group-${group.dateStr}`}
                  className="space-y-3"
                >
                  <h3
                    id={`date-group-${group.dateStr}`}
                    className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 pl-1"
                  >
                    <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                    <span>{group.dateLabel}</span>
                  </h3>

                  <div className="space-y-3">
                    {group.bookings.map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        userTimezone={userTimezone}
                        onViewDetails={handleOpenDetail}
                        onReschedule={handleOpenReschedule}
                        onCancel={handleOpenCancel}
                        getJoinStatus={getJoinStatus}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            /* Standard Flat List (Past or All) */
            <div className="space-y-3 pt-1">
              {bookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  userTimezone={userTimezone}
                  onViewDetails={handleOpenDetail}
                  onReschedule={handleOpenReschedule}
                  onCancel={handleOpenCancel}
                  getJoinStatus={getJoinStatus}
                />
              ))}
            </div>
          )}

          {/* Booking Detail Modal */}
          <BookingDetailModal
            booking={selectedBookingForDetail}
            userTimezone={userTimezone}
            isOpen={Boolean(selectedBookingForDetail)}
            onOpenChange={(open) => !open && setSelectedBookingForDetail(null)}
            onReschedule={handleOpenReschedule}
            onCancel={handleOpenCancel}
            canJoin={selectedBookingForDetail ? getJoinStatus(selectedBookingForDetail).canJoin : false}
          />

          {/* Cancel Booking Modal */}
          <CancelBookingModal
            booking={bookingToCancel}
            isOpen={Boolean(bookingToCancel)}
            onOpenChange={(open) => !open && setBookingToCancel(null)}
            reason={cancelReason}
            onReasonChange={setCancelReason}
            isCancelling={isCancelling}
            onConfirmCancel={handleConfirmCancel}
          />

          {/* Reschedule Modal */}
          <RescheduleModal
            booking={bookingToReschedule}
            isOpen={Boolean(bookingToReschedule)}
            onOpenChange={(open) => !open && setBookingToReschedule(null)}
          />
        </div>
      </PageShell>
    </AppShell>
  )
}
