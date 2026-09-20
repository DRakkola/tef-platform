import { useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { PageShell } from "@/components/layout/PageShell"
import { StudentLayout } from "@/features/dashboard/StudentLayout"
import {
  TeacherProfileHeader,
  TeacherServicesSection,
  TeacherTeachingApproach,
  TeacherBookingPanel,
  TeacherBookingModal,
  TeacherMobileStickyCTA,
  TeacherInactiveBanner,
  TeacherSkeleton,
} from "./components"
import { useTeacherProfile, useTeacherBooking } from "./hooks"

export function TeacherDetailPage() {
  const params = useParams<{ id?: string; teacherId?: string }>()
  const teacherId = params.id || params.teacherId
  const navigate = useNavigate()
  const bookingPanelRef = useRef<HTMLDivElement>(null)

  const {
    teacher,
    isLoading,
    isError,
    entitlements,
    refetch,
  } = useTeacherProfile(teacherId)

  const {
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
    userTimezone,
    isBookingModalOpen,
    setIsBookingModalOpen,
    isSubmitting,
    bookingSuccess,
    bookingConflict,
    confirmedBooking,
    confirmBooking,
  } = useTeacherBooking(teacher, entitlements)

  const scrollToBooking = () => {
    if (bookingPanelRef.current) {
      bookingPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const handleBackToTeachers = () => {
    navigate("/teachers")
  }

  const isInactive = teacher?.verification_status !== "approved"

  return (
    <StudentLayout>
      <PageShell>
        {isLoading ? (
          <div className="space-y-6">
            <div className="h-32 rounded-2xl bg-card border border-border/60 animate-pulse" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-6">
                <TeacherSkeleton count={2} />
              </div>
              <div className="lg:col-span-5">
                <div className="h-96 rounded-2xl bg-card border border-border/60 animate-pulse" />
              </div>
            </div>
          </div>
        ) : isError || !teacher ? (
          <div className="p-12 text-center rounded-2xl border border-destructive/20 bg-destructive/5 space-y-4 max-w-lg mx-auto my-12">
            <h3 className="text-base font-bold text-destructive">
              Profil d'enseignant introuvable
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Impossible de charger les informations relatives à cet enseignant. Il est possible que le profil ait été retiré ou modifié.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => refetch()}
                className="text-xs font-semibold underline text-primary cursor-pointer"
              >
                Réessayer
              </button>
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={handleBackToTeachers}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Retour aux professeurs
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 pb-20 lg:pb-8">
            {/* Header */}
            <TeacherProfileHeader
              teacher={teacher}
              entitlements={entitlements}
              onBackClick={handleBackToTeachers}
              onBookClick={scrollToBooking}
            />

            {/* Inactive / Not Approved Banner */}
            {isInactive && (
              <TeacherInactiveBanner onBackToTeachers={handleBackToTeachers} />
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column (7 cols): Bio, Services, Teaching Approach, Qualifications */}
              <div className="lg:col-span-7 space-y-6">
                {/* About / Bio Card */}
                {teacher.bio && (
                  <Card className="rounded-2xl border-border/80">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base sm:text-lg font-bold">
                        À propos de l'enseignant
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-xs sm:text-sm text-muted-foreground leading-relaxed pt-0">
                      <p className="whitespace-pre-line">{teacher.bio}</p>

                      {/* Qualifications & Teaching Levels */}
                      {teacher.teaching_levels && teacher.teaching_levels.length > 0 && (
                        <div className="space-y-2 pt-3 border-t border-border/50">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                            Niveaux préparés
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {teacher.teaching_levels.map((lvl) => (
                              <Badge key={lvl} variant="outline" className="font-mono text-xs">
                                Niveau {lvl}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Services Section */}
                <TeacherServicesSection
                  services={services}
                  selectedServiceId={selectedServiceId}
                  onSelectService={setSelectedServiceId}
                />

                {/* Teaching Approach */}
                <TeacherTeachingApproach />
              </div>

              {/* Right Column (5 cols): Sticky Booking Panel */}
              <div ref={bookingPanelRef} className="lg:col-span-5 lg:sticky lg:top-6 space-y-6">
                <TeacherBookingPanel
                  teacher={teacher}
                  selectedService={selectedService}
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  slots={slots}
                  selectedSlot={selectedSlot}
                  onSelectSlot={setSelectedSlot}
                  isSlotsLoading={isSlotsLoading}
                  sessionNotes={sessionNotes}
                  onSessionNotesChange={setSessionNotes}
                  userTimezone={userTimezone}
                  onContinue={() => setIsBookingModalOpen(true)}
                  isInactive={isInactive}
                />
              </div>
            </div>

            {/* Mobile Sticky Bottom CTA */}
            {!isInactive && (
              <TeacherMobileStickyCTA
                teacher={teacher}
                selectedService={selectedService}
                onBookClick={scrollToBooking}
              />
            )}

            {/* Booking Confirmation Dialog Modal */}
            <TeacherBookingModal
              isOpen={isBookingModalOpen}
              onOpenChange={setIsBookingModalOpen}
              teacher={teacher}
              selectedService={selectedService}
              selectedDate={selectedDate}
              selectedSlot={selectedSlot}
              userTimezone={userTimezone}
              isSubmitting={isSubmitting}
              bookingSuccess={bookingSuccess}
              bookingConflict={bookingConflict}
              confirmedBooking={confirmedBooking}
              onConfirm={() => confirmBooking()}
              onRefreshSlots={() => refetchSlots()}
              onNavigateDashboard={() => {
                setIsBookingModalOpen(false)
                navigate("/dashboard")
              }}
            />
          </div>
        )}
      </PageShell>
    </StudentLayout>
  )
}
