/**
 * TeacherDashboardPage: Primary operational home page for teachers (/teacher).
 * Displays today's schedule, pending corrections queue, upcoming sessions,
 * availability status, earnings summary, and quick operational actions.
 */

import React from "react"
import { AppShell } from "@/components/layout/AppShell"
import { PageShell } from "@/components/layout/PageShell"
import { ForbiddenPage } from "@/components/feedback"
import { useAuth } from "@/features/auth"
import { useTeacherDashboard } from "./hooks/useTeacherDashboard"
import {
  TeacherHeader,
  TeacherSummaryCards,
  TodayScheduleSection,
  UpcomingScheduleSection,
  CorrectionsQueueSection,
  SpeakingSessionsSection,
  AvailabilityAlert,
  EarningsSummarySection,
  RecentStudentActivity,
  QuickActionsGroup,
  TeacherDashboardSkeleton,
  TeacherEmptyOnboarding,
} from "./components"

export const TeacherDashboardPage: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth()
  const {
    profile,
    teacherTimezone,
    availabilityRules,
    hasAvailability,
    todaySessions,
    upcomingSessions,
    pendingCorrections,
    speakingSessions,
    earningsSummary,
    recentActivity,
    todaySessionsCount,
    pendingCorrectionsCount,
    newBookingsCount,
    isNewTeacher,

    isProfileLoading,
    isProfileError,
    profileError,

    isAvailabilityLoading,
    isBookingsLoading,
    isBookingsError,
    bookingsError,
    refetchBookings,

    isCorrectionsLoading,
    isCorrectionsError,
    correctionsError,
    refetchCorrections,

    isSpeakingLoading,
    isEarningsLoading,
    isEarningsError,
    earningsError,
    refetchEarnings,
  } = useTeacherDashboard()

  // 1. Auth & Role Verification (students cannot access teacher dashboard)
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

  // 3. Loading Skeleton (prevents layout shift)
  if (isAuthLoading || (isProfileLoading && !profile)) {
    return (
      <AppShell headerTitle="Tableau de bord enseignant">
        <PageShell maxWidth="default">
          <TeacherDashboardSkeleton />
        </PageShell>
      </AppShell>
    )
  }

  return (
    <AppShell
      headerTitle="Tableau de bord enseignant"
      headerActions={<QuickActionsGroup />}
      studentName={profile?.display_name || user?.first_name || "Professeur"}
      studentEmail={user?.email}
    >
      <PageShell maxWidth="default">
        <div className="space-y-6">
          {/* 1. Page Header with teacher greeting & configured timezone */}
          <TeacherHeader
            displayName={profile?.display_name || user?.first_name || undefined}
            timezone={teacherTimezone}
          />

          {/* 2. Top-level actionable KPI Summary Cards */}
          <TeacherSummaryCards
            todaySessionsCount={todaySessionsCount}
            pendingCorrectionsCount={pendingCorrectionsCount}
            newBookingsCount={newBookingsCount}
            earningsSummary={earningsSummary}
            isLoading={isBookingsLoading || isCorrectionsLoading}
          />

          {/* 3. Availability Alert / Status */}
          <AvailabilityAlert
            hasAvailability={hasAvailability}
            rulesCount={availabilityRules.length}
            isLoading={isAvailabilityLoading}
          />

          {/* 4. New Teacher Onboarding State if zero activity */}
          {isNewTeacher ? (
            <TeacherEmptyOnboarding hasAvailability={hasAvailability} />
          ) : (
            /* 5. 2-Column Responsive Operational Layout */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Columns: Schedule, Corrections, Speaking */}
              <div className="lg:col-span-2 space-y-6">
                {/* Today's Schedule */}
                <TodayScheduleSection
                  sessions={todaySessions}
                  timezone={teacherTimezone}
                  isLoading={isBookingsLoading}
                  isError={isBookingsError}
                  error={bookingsError as Error | null}
                  onRetry={refetchBookings}
                />

                {/* Upcoming Schedule */}
                <UpcomingScheduleSection
                  sessions={upcomingSessions}
                  timezone={teacherTimezone}
                  isLoading={isBookingsLoading}
                />

                {/* Corrections Queue */}
                <CorrectionsQueueSection
                  corrections={pendingCorrections}
                  isLoading={isCorrectionsLoading}
                  isError={isCorrectionsError}
                  error={correctionsError as Error | null}
                  onRetry={refetchCorrections}
                />

                {/* Speaking Sessions */}
                <SpeakingSessionsSection
                  sessions={speakingSessions}
                  isLoading={isSpeakingLoading}
                />
              </div>

              {/* Right 1 Column: Earnings & Recent Activity */}
              <div className="space-y-6">
                {/* Earnings Summary */}
                <EarningsSummarySection
                  summary={earningsSummary}
                  isLoading={isEarningsLoading}
                  isError={isEarningsError}
                  error={earningsError as Error | null}
                  onRetry={refetchEarnings}
                />

                {/* Recent Student Activity */}
                <RecentStudentActivity activities={recentActivity} />
              </div>
            </div>
          )}
        </div>
      </PageShell>
    </AppShell>
  )
}
