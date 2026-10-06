/**
 * Application route configurations.
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "./HomePage";
import { LoginPage } from "@/features/auth";
import { NotFoundPage } from "@/components/NotFoundPage";
import { StudentDashboardPage } from "@/features/dashboard";
import { ReadinessPage } from "@/features/readiness";
import { ProgressPage } from "@/features/progress";
import { RecommendationsPage } from "@/features/recommendations";
import { PracticePage } from "@/features/practice";
import {
  AssessmentsListPage as StudentAssessmentsPage,
  AssessmentDetailPage,
  AssessmentTakingPage,
  AssessmentResultsPage,
  AssessmentRunnerPage,
} from "@/features/assessments";
import { ExercisePracticePage, ExercisesCatalogPage } from "@/features/exercises";
import {
  TeachersDirectoryPage,
  TeacherDetailPage,
} from "@/features/teachers";
import {
  TeacherDashboardPage,
  TeacherAvailabilityPage,
} from "@/features/teacher-dashboard";
import { TeacherBookingsPage } from "@/features/teacher-bookings";
import {
  TeacherCorrectionsPage,
  TeacherCorrectionWorkspacePage,
} from "@/features/teacher-corrections";
import { BookingPage, MyBookingsPage } from "@/features/bookings";
import {
  WritingEditorPage,
  WritingSubmissionsPage,
  WritingResultPage,
} from "@/features/writing";
import { SpeakingSessionPage } from "@/features/speaking";
import {
  AdminDashboardPage,
  SkillsManagerPage,
  AssessmentsListPage as AdminAssessmentsPage,
  AssessmentEditorPage,
  QuestionsListPage,
  QuestionWorkspacePage,
  AIGenerationPage,
  ExercisesListPage,
  WritingTasksListPage,
  MediaManagerPage,
  ReviewsManagerPage,
  AuditLogsPage,
} from "@/features/admin";
import {
  PracticeHubPage,
  PracticeQueuePage,
  PracticeRequestPage,
  PracticeSessionPage,
  PracticeResultPage,
} from "@/features/practice-pool";
import {
  PricingPage,
  CheckoutPage,
  BillingHubPage,
  SubscriptionManagePage,
  OrderHistoryPage,
  UsageLedgerPage,
  TeacherEarningsPage,
  AdminBillingPage,
} from "@/features/billing";
import { OnboardingPage } from "@/features/onboarding/OnboardingPage";
import { AdminAnalyticsPage } from "@/features/admin/analytics/AdminAnalyticsPage";
import { AdminHealthPage } from "@/features/admin/health/AdminHealthPage";
import { AdminExperimentsPage } from "@/features/admin/experiments/AdminExperimentsPage";
import { AdminSupportPage } from "@/features/admin/support/AdminSupportPage";
import { AdminBetaControlPage } from "@/features/admin/beta/AdminBetaControlPage";
import {
  OverviewPage as AIStudioOverviewPage,
  AssessmentWritingPage,
  AssessmentSpeakingPage,
  ExaminerStudioPage,
  PromptLabPage,
  RunsPage as AIStudioRunsPage,
  TemplatesPage as AIStudioTemplatesPage,
  AIStudioAdminPage,
} from "@/features/admin/ai-studio";
import { ScenariosPage } from "@/features/admin/ai-studio/scenarios/ScenariosPage";
import { MicroFeedbackWidget } from "@/features/feedback/MicroFeedbackWidget";
import { NotificationsPage } from "@/features/notifications";
import { SettingsPage } from "@/features/settings";
import { HelpPage, ArticleDetailPage } from "@/features/help";
import { DesignSystemPage } from "@/features/admin/design-system/DesignSystemPage";
import {
  OfflineBanner,
  SessionExpiredDialog,
  ForbiddenPage,
  MaintenancePage,
} from "@/components/feedback";

export const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <SessionExpiredDialog />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LoginPage initialTab="register" />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/dashboard" element={<StudentDashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/help/:slug" element={<ArticleDetailPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/readiness" element={<ReadinessPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/assessments" element={<StudentAssessmentsPage />} />
        <Route path="/assessments/:id" element={<AssessmentDetailPage />} />
        <Route path="/assessments/:id/runner" element={<AssessmentRunnerPage />} />
        <Route path="/attempts/:id" element={<AssessmentTakingPage />} />
        <Route path="/attempts/:id/results" element={<AssessmentResultsPage />} />
        <Route path="/exercises" element={<ExercisesCatalogPage />} />
        <Route path="/exercises/:id" element={<ExercisePracticePage />} />

        {/* Practice Experience */}
        <Route path="/practice" element={<PracticePage />} />

        {/* Teachers Directory & Booking */}
        <Route path="/teachers" element={<TeachersDirectoryPage />} />
        <Route path="/teachers/:id" element={<TeacherDetailPage />} />
        <Route path="/teachers/:teacherId/book" element={<BookingPage />} />
        <Route path="/teachers/:id/book" element={<BookingPage />} />
        <Route path="/booking/:teacherId" element={<BookingPage />} />
        <Route path="/booking" element={<Navigate to="/teachers" replace />} />
        <Route path="/bookings/new" element={<Navigate to="/teachers" replace />} />
        <Route path="/bookings" element={<MyBookingsPage />} />
        <Route path="/my-bookings" element={<MyBookingsPage />} />

        {/* Writing Workshop & Submissions */}
        <Route path="/writing" element={<WritingSubmissionsPage />} />
        <Route path="/writing/tasks/:id" element={<WritingEditorPage />} />
        <Route path="/writing/:id/result" element={<WritingResultPage />} />
        <Route path="/writing/attempts/:id/result" element={<WritingResultPage />} />

        {/* Speaking Lab */}
        <Route path="/speaking" element={<SpeakingSessionPage />} />
        <Route path="/speaking/sessions/:sessionId" element={<SpeakingSessionPage />} />
        <Route path="/speaking/:id" element={<SpeakingSessionPage />} />

        {/* Practice Pool Routes */}
        <Route path="/practice-pool" element={<PracticeHubPage />} />
        <Route path="/practice-pool/queue" element={<PracticeQueuePage />} />
        <Route path="/practice-pool/request/:id" element={<PracticeRequestPage />} />
        <Route path="/practice-pool/session/:id" element={<PracticeSessionPage />} />
        <Route path="/practice-pool/session/:id/result" element={<PracticeResultPage />} />
        {/* Backward-compat aliases for practice pool paths */}
        <Route path="/practice/queue" element={<Navigate to="/practice-pool/queue" replace />} />
        <Route path="/practice/request/:id" element={<PracticeRequestPage />} />
        <Route path="/practice/session/:id" element={<PracticeSessionPage />} />
        <Route path="/practice/session/:id/result" element={<PracticeResultPage />} />

        {/* Billing & Monetization Routes */}
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/billing" element={<BillingHubPage />} />
        <Route path="/billing/subscription" element={<SubscriptionManagePage />} />
        <Route path="/billing/orders" element={<OrderHistoryPage />} />
        <Route path="/billing/usage" element={<UsageLedgerPage />} />
        {/* Teacher Portal Routes */}
        <Route path="/teacher" element={<TeacherDashboardPage />} />
        <Route path="/teacher/dashboard" element={<Navigate to="/teacher" replace />} />
        <Route path="/teacher/bookings" element={<TeacherBookingsPage />} />
        <Route path="/teacher/availability" element={<TeacherAvailabilityPage />} />
        <Route path="/teacher/earnings" element={<TeacherEarningsPage />} />
        <Route path="/teacher/corrections" element={<TeacherCorrectionsPage />} />
        <Route path="/teacher/corrections/:id" element={<TeacherCorrectionWorkspacePage />} />

        {/* Content Studio Admin Routes */}
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/beta" element={<AdminBetaControlPage />} />
        <Route path="/admin/ai-sandbox" element={<Navigate to="/admin/ai-studio" replace />} />

        {/* TEF AI Studio Routes */}
        <Route path="/admin/ai-studio" element={<AIStudioOverviewPage />} />
        <Route path="/admin/ai-studio/assessment/writing" element={<AssessmentWritingPage />} />
        <Route path="/admin/ai-studio/assessment/speaking" element={<AssessmentSpeakingPage />} />
        <Route path="/admin/ai-studio/examiner" element={<ExaminerStudioPage />} />
        <Route path="/admin/ai-studio/scenarios" element={<ScenariosPage />} />
        <Route path="/admin/ai-studio/prompt-lab" element={<PromptLabPage />} />
        <Route path="/admin/ai-studio/runs" element={<AIStudioRunsPage />} />
        <Route path="/admin/ai-studio/templates" element={<AIStudioTemplatesPage />} />
        <Route path="/admin/ai-studio/administration" element={<AIStudioAdminPage />} />
        <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
        <Route path="/admin/health" element={<AdminHealthPage />} />
        <Route path="/admin/experiments" element={<AdminExperimentsPage />} />
        <Route path="/admin/support" element={<AdminSupportPage />} />
        <Route path="/admin/billing" element={<AdminBillingPage />} />
        <Route path="/admin/skills" element={<SkillsManagerPage />} />
        <Route path="/admin/assessments" element={<AdminAssessmentsPage />} />
        <Route path="/admin/assessments/:id" element={<AssessmentEditorPage />} />
        <Route path="/admin/questions" element={<QuestionsListPage />} />
        <Route path="/admin/questions/generate" element={<AIGenerationPage />} />
        <Route path="/admin/questions/new" element={<QuestionWorkspacePage mode="create" />} />
        <Route path="/admin/questions/:id" element={<QuestionWorkspacePage mode="edit" />} />
        <Route path="/admin/exercises" element={<ExercisesListPage />} />
        <Route path="/admin/writing-tasks" element={<WritingTasksListPage />} />
        <Route path="/admin/media" element={<MediaManagerPage />} />
        <Route path="/admin/reviews" element={<ReviewsManagerPage />} />
        <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
        <Route path="/admin/design-system" element={<DesignSystemPage />} />

        {/* Global UX & Error Routes */}
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <MicroFeedbackWidget />
    </BrowserRouter>
  );
};
