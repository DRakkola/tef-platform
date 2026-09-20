/**
 * StudentDashboardPage component: Orchestrates the dedicated student dashboard.
 * Implements the 6-question information hierarchy in a clean 2-column responsive layout.
 */

import React from "react"
import { GraduationCap } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { ErrorState } from "@/components/common/ErrorState"
import { PageShell } from "@/components/layout/PageShell"
import { StudentLayout } from "./StudentLayout"
import { useStudentDashboard } from "./useDashboard"
import { ReadinessHero } from "./ReadinessHero"
import { NextActionCard } from "./NextActionCard"
import { DailyPlanCard } from "./DailyPlanCard"
import { PrioritySkills } from "./PrioritySkills"
import { ProgressOverview } from "./ProgressOverview"
import { RecentActivity } from "./RecentActivity"
import { DashboardSkeleton } from "./DashboardSkeleton"

export const StudentDashboardPage: React.FC = () => {
  const {
    dashboard,
    progress,
    isLoading,
    isProgressLoading,
    error,
    progressError,
    refetch,
    refetchProgress,
  } = useStudentDashboard()

  // 1. Loading state (mirrors 2-column layout to prevent layout shift)
  if (isLoading) {
    return (
      <StudentLayout>
        <PageShell maxWidth="default">
          <DashboardSkeleton />
        </PageShell>
      </StudentLayout>
    )
  }

  // 2. Auth & Critical Error State (Intercept machine codes, display friendly French messages)
  if (error || !dashboard) {
    const isAuth =
      error instanceof Error &&
      (error.message === "AUTH_REQUIRED" ||
        error.message.includes("401") ||
        error.name === "AuthRequiredError" ||
        error.message.toLowerCase().includes("session"))

    return (
      <StudentLayout>
        <PageShell maxWidth="default">
          <ErrorState
            title={isAuth ? "Session expirée" : "Impossible de charger le tableau de bord"}
            description={
              isAuth
                ? "Votre session a expiré ou une authentification est requise pour accéder à cet espace. Veuillez vous reconnecter pour continuer."
                : error instanceof Error
                ? error.message
                : "Une erreur est survenue lors de la récupération de vos données de préparation."
            }
            actionLabel={isAuth ? "Se connecter" : "Réessayer"}
            onRetry={isAuth ? undefined : () => refetch()}
            onAction={isAuth ? () => (window.location.href = "/") : undefined}
            isAuthError={isAuth}
          />
        </PageShell>
      </StudentLayout>
    )
  }

  // 3. Derived student context
  const isNewStudent =
    (dashboard.total_assessments_taken || 0) === 0 &&
    (!dashboard.recommended_exercises || dashboard.recommended_exercises.length === 0)

  const nextAction =
    dashboard.recommended_exercises?.[0] ||
    dashboard.daily_plan?.tasks?.[0] ||
    dashboard.daily_plan?.items?.[0] ||
    null

  // Use progress timeline if available, otherwise fallback to dashboard progress history
  const progressTimeline =
    progress?.timeline && progress.timeline.length > 0
      ? progress.timeline
      : dashboard.progress_history || []

  return (
    <StudentLayout>
      <PageShell maxWidth="default">
        <div className="space-y-8">
          {/* Question 1 & 2: Where am I? & What is my current situation? */}
          <ReadinessHero
            studentName={dashboard.student_name}
            targetExam={dashboard.target_exam || "TEF Canada"}
            targetLevel={dashboard.target_level || "B2"}
            targetCefrLevel={dashboard.target_cefr_level}
            targetNclcLevel={dashboard.target_nclc_level}
            currentCefrLevel={dashboard.current_cefr_level}
            currentNclcLevel={dashboard.current_nclc_level}
            overallReadiness={dashboard.overall_readiness}
            daysRemaining={dashboard.days_remaining}
            engagementStatus={dashboard.engagement_status}
            totalAssessmentsTaken={dashboard.total_assessments_taken || 0}
          />

          {/* Question 3: What should I do next? (Prominent primary action) */}
          <div data-testid="recommended-exercises-section">
            <NextActionCard
              recommendation={nextAction}
              isNewStudent={isNewStudent}
            />
          </div>

          {/* 2-Column Responsive Workspace with mobile-first ordering */}
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 items-start">
            {/* Main Column (8 cols desktop / order-2 mobile): Trajectory & Long-term Growth */}
            <div className="max-lg:contents lg:col-span-8 lg:space-y-8">
              {/* Question 5: Am I improving? */}
              <div className="order-3 lg:order-1 w-full">
                <ProgressOverview
                  timeline={progressTimeline}
                  isLoading={isProgressLoading}
                  error={progressError instanceof Error ? progressError : null}
                  onRetry={refetchProgress}
                />
              </div>
            </div>

            {/* Secondary Column (4 cols desktop / order-1 mobile): Daily Plan, Skills & Activity */}
            <div className="max-lg:contents lg:col-span-4 lg:space-y-8">
              {/* Daily learning loop: Today's tasks (Priority on mobile) */}
              <div className="order-1 lg:order-1 w-full">
                <DailyPlanCard dailyPlan={dashboard.daily_plan} />
              </div>

              {/* Question 4: What are my weaknesses? */}
              <div className="order-2 lg:order-2 w-full">
                <PrioritySkills skills={dashboard.weakest_skills} />
              </div>

              {/* Optional: Upcoming Teacher Bookings */}
              {dashboard.upcoming_bookings && dashboard.upcoming_bookings.length > 0 && (
                <div className="order-4 lg:order-3 w-full">
                  <Card className="shadow-2xs border-border/70 bg-card">
                    <CardHeader className="pb-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="icon-box icon-box-sm icon-box-accent">
                          <GraduationCap className="size-4" aria-hidden="true" />
                        </div>
                        <CardTitle className="text-sm font-semibold text-foreground font-display">
                          Session de coaching réservée
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2.5 pt-0">
                      {dashboard.upcoming_bookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-2 text-xs"
                        >
                          <p className="font-semibold text-foreground text-sm">{booking.teacher_name}</p>
                          <p className="text-muted-foreground font-mono tabular-nums">
                            {new Date(booking.start_time).toLocaleDateString("fr-FR", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {booking.meeting_link && (
                            <a
                              href={booking.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary font-semibold hover:underline pt-1"
                            >
                              Accéder au salon virtuel →
                            </a>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Question 6: What did I just do? */}
              <div className="order-5 lg:order-4 w-full">
                <RecentActivity
                  assessments={dashboard.recent_assessments}
                  writings={dashboard.recent_writing_corrections}
                  speakingSessions={dashboard.recent_speaking_sessions}
                />
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    </StudentLayout>
  )
}
