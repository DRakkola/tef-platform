import React from "react"
import { useParams, Navigate } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { PageShell } from "@/components/layout/PageShell"
import { ErrorState } from "@/components/common/ErrorState"
import { useBookingFlow } from "./hooks/useBookingFlow"
import { BookingHeader } from "./components/BookingHeader"
import { BookingProgress } from "./components/BookingProgress"
import { BookingServiceSelection } from "./components/BookingServiceSelection"
import { BookingDateSelector } from "./components/BookingDateSelector"
import { BookingTimeSlots } from "./components/BookingTimeSlots"
import { BookingReview } from "./components/BookingReview"
import { BookingSuccess } from "./components/BookingSuccess"
import { BookingSummarySidebar } from "./components/BookingSummarySidebar"

export const BookingPage: React.FC = () => {
  const { teacherId, id } = useParams<{ teacherId?: string; id?: string }>()
  const effectiveTeacherId = teacherId || id || ""

  const {
    teacher,
    teacherError,
    entitlements,
    services,
    selectedService,
    selectedServiceId,
    setSelectedServiceId,
    selectedDate,
    setSelectedDate,
    selectedSlot,
    setSelectedSlot,
    slots,
    isSlotsLoading,
    refetchSlots,
    sessionNotes,
    setSessionNotes,
    step,
    goToStep,
    userTimezone,
    isSubmitting,
    bookingConflict,
    conflictMessage,
    networkTimeoutWarning,
    confirmedBooking,
    confirmBooking,
    downloadIcsFile,
  } = useBookingFlow(effectiveTeacherId)

  // Redirect if no teacherId provided
  if (!effectiveTeacherId) {
    return <Navigate to="/teachers" replace />
  }

  // Teacher Error State
  if (teacherError && !teacher) {
    return (
      <AppShell headerTitle="Réservation">
        <PageShell maxWidth="default">
          <ErrorState
            title="Enseignant introuvable"
            description="Le profil de l'enseignant demandé n'est pas disponible pour la réservation."
            actionLabel="Retour aux professeurs"
            onAction={() => (window.location.href = "/teachers")}
          />
        </PageShell>
      </AppShell>
    )
  }

  const isSuccess = step === "success"

  return (
    <AppShell
      headerTitle="Réserver une session"
      studentName="Candidat TEF"
      targetExam="TEF Canada"
      targetLevel="B2"
    >
      <PageShell maxWidth="default">
        <div className="space-y-6 pb-12">
          {/* Header */}
          <BookingHeader
            teacher={teacher}
            selectedService={selectedService}
          />

          {/* Stepper (Only when not in success step) */}
          {!isSuccess && (
            <BookingProgress
              currentStep={step}
              onStepClick={goToStep}
              isServiceSelected={Boolean(selectedServiceId)}
              isSlotSelected={Boolean(selectedSlot)}
            />
          )}

          {/* Main Content Area */}
          {isSuccess ? (
            <BookingSuccess
              teacher={teacher}
              selectedService={selectedService}
              selectedDate={selectedDate}
              selectedSlot={selectedSlot}
              userTimezone={userTimezone}
              confirmedBooking={confirmedBooking}
              onDownloadIcs={downloadIcsFile}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Active Step Column (8 cols on desktop) */}
              <div className="lg:col-span-8 space-y-6">
                {step === "service" && (
                  <BookingServiceSelection
                    services={services}
                    selectedServiceId={selectedServiceId}
                    onSelectService={(id) => {
                      setSelectedServiceId(id)
                    }}
                    onContinue={() => goToStep("time")}
                  />
                )}

                {step === "time" && (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <h2 className="text-base sm:text-lg font-bold text-foreground">
                        2. Choisissez votre date et créneau horaire
                      </h2>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Les horaires sont synchronisés avec l'agenda en temps réel de votre enseignant.
                      </p>
                    </div>

                    <BookingDateSelector
                      selectedDate={selectedDate}
                      onSelectDate={setSelectedDate}
                      userTimezone={userTimezone}
                    />

                    <BookingTimeSlots
                      slots={slots}
                      selectedSlot={selectedSlot}
                      onSelectSlot={setSelectedSlot}
                      isLoading={isSlotsLoading}
                      onRefreshSlots={refetchSlots}
                      onContinue={() => goToStep("review")}
                    />
                  </div>
                )}

                {step === "review" && (
                  <BookingReview
                    teacher={teacher}
                    selectedService={selectedService}
                    selectedDate={selectedDate}
                    selectedSlot={selectedSlot}
                    userTimezone={userTimezone}
                    entitlements={entitlements}
                    sessionNotes={sessionNotes}
                    onSessionNotesChange={setSessionNotes}
                    isSubmitting={isSubmitting}
                    bookingConflict={bookingConflict}
                    conflictMessage={conflictMessage}
                    networkTimeoutWarning={networkTimeoutWarning}
                    onBackToSlots={() => goToStep("time")}
                    onConfirmBooking={() => confirmBooking()}
                  />
                )}
              </div>

              {/* Desktop Sticky Summary Sidebar (4 cols on desktop) */}
              <div className="lg:col-span-4">
                <BookingSummarySidebar
                  teacher={teacher}
                  selectedService={selectedService}
                  selectedDate={selectedDate}
                  selectedSlot={selectedSlot}
                  userTimezone={userTimezone}
                />
              </div>
            </div>
          )}
        </div>
      </PageShell>
    </AppShell>
  )
}
