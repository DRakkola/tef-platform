/**
 * Integration and critical path tests for Student Dashboard.
 */

import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StudentDashboardPage } from "@/features/dashboard/StudentDashboardPage";
import { SkillMetricCard } from "@/features/dashboard/SkillMetricCard";
import { HistoricalProgressChart } from "@/features/dashboard/HistoricalProgressChart";
import { DashboardEmptyState } from "@/features/dashboard/DashboardEmptyState";
import type {
  SkillSummaryMetric,
  StudentDashboardData,
  StudentProgressData,
  ProgressDataPoint,
} from "@/features/dashboard/types";

// Helper to create a test QueryClient
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

describe("Student Dashboard & Learning Loop", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders DashboardEmptyState correctly with onboarding CTA", () => {
    const handleStart = vi.fn();
    render(
      <DashboardEmptyState
        studentName="Marie Curie"
        targetExam="TEF Canada"
        targetLevel="B2"
        onStartDiagnostic={handleStart}
      />
    );

    expect(screen.getByText(/Bienvenue, Marie Curie !/i)).toBeInTheDocument();
    expect(screen.getByText("TEF Canada")).toBeInTheDocument();
    expect(screen.getByText("B2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Démarrer un test diagnostique/i })
    ).toBeInTheDocument();
  });

  it("renders SkillMetricCard with delta change, previous score, and confidence pill", () => {
    const metric: SkillSummaryMetric = {
      skill_id: "skill-1",
      skill_name: "Subjonctif et connecteurs",
      category: "grammar",
      current_score: 68.5,
      previous_score: 62.0,
      change: 6.5,
      confidence: 0.82,
      confidence_label: "High",
      insufficient_data: false,
      attempts_count: 5,
      last_assessed_at: "2026-09-15T14:30:00Z",
    };

    render(<SkillMetricCard metric={metric} />);

    expect(screen.getByText("Subjonctif et connecteurs")).toBeInTheDocument();
    expect(screen.getByText("68.5%")).toBeInTheDocument();
    expect(screen.getByText("+6.5%")).toBeInTheDocument();
    expect(screen.getByText(/High \(82%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Précédent : 62%/i)).toBeInTheDocument();
    expect(screen.getByText(/5 évaluations/i)).toBeInTheDocument();
  });

  it("renders SkillMetricCard in calibration state when there is insufficient data", () => {
    const calibratingMetric: SkillSummaryMetric = {
      skill_id: "skill-2",
      skill_name: "Compréhension orale rapide",
      category: "listening",
      current_score: 75.0,
      previous_score: null,
      change: null,
      confidence: 0.15,
      confidence_label: "Calibration",
      insufficient_data: true,
      attempts_count: 1,
      last_assessed_at: "2026-09-16T10:00:00Z",
    };

    render(<SkillMetricCard metric={calibratingMetric} />);

    expect(screen.getByText("Compréhension orale rapide")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText(/En cours d'étalonnage/i)).toBeInTheDocument();
    expect(screen.getByText(/Calibration \(15%\)/i)).toBeInTheDocument();
    expect(screen.getByText("Mesure initiale")).toBeInTheDocument();
  });

  it("renders HistoricalProgressChart timeline without overwriting previous points", () => {
    const timeline: ProgressDataPoint[] = [
      {
        timestamp: "2026-09-10T10:00:00Z",
        overall_score: 60.0,
        assessment_title: "Test Diagnostic Compréhension",
        source_type: "assessment",
      },
      {
        timestamp: "2026-09-14T15:30:00Z",
        overall_score: 72.5,
        assessment_title: "Section B — Fait Divers",
        source_type: "writing",
      },
    ];

    render(<HistoricalProgressChart timeline={timeline} />);

    expect(screen.getByText("Trajectoire d'apprentissage")).toBeInTheDocument();
    expect(screen.getByText("Test Diagnostic Compréhension")).toBeInTheDocument();
    expect(screen.getByText("Section B — Fait Divers")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("72.5%")).toBeInTheDocument();
    expect(screen.getByText("2 mesures")).toBeInTheDocument();
  });

  it("renders full populated StudentDashboardPage from API responses", async () => {
    const mockDashboard: StudentDashboardData = {
      student_id: "student-123",
      student_name: "Claire Martin",
      target_exam: "TEF Canada",
      target_level: "B2",
      overall_readiness: 74.2,
      skills: [
        {
          skill_id: "s1",
          skill_name: "Pronoms relatifs composés",
          category: "grammar",
          current_score: 55.0,
          previous_score: 50.0,
          change: 5.0,
          confidence: 0.85,
          confidence_label: "High",
          insufficient_data: false,
          attempts_count: 6,
          last_assessed_at: "2026-09-15T12:00:00Z",
        },
      ],
      weakest_skills: [
        {
          skill_id: "s1",
          skill_name: "Pronoms relatifs composés",
          category: "grammar",
          mastery_score: 55.0,
          attempts_count: 6,
        },
      ],
      recommended_exercises: [
        {
          id: "ex-1",
          title: "Exercice ciblé — Lequel, auquel, duquel",
          category: "grammar",
          difficulty: 3,
          level: "B2",
          target_skill_name: "Pronoms relatifs composés",
          reason: "Erreurs fréquentes détectées sur l'accord en genre et nombre.",
          priority: "critical",
        },
      ],
      recent_assessments: [
        {
          id: "a-1",
          title: "Compréhension Écrite — Blanc 1",
          assessment_type: "reading",
          score_percentage: 82.0,
          passed: true,
          estimated_level: "B2",
          submitted_at: "2026-09-14T11:00:00Z",
        },
      ],
      recent_writings: [
        {
          id: "w-1",
          task_title: "Section B — Lettre au rédacteur",
          overall_score: 76.5,
          estimated_level: "B2",
          submitted_at: "2026-09-13T16:00:00Z",
          status: "corrected",
          corrected_at: "2026-09-13T18:00:00Z",
        },
      ],
      upcoming_bookings: [
        {
          id: "b-1",
          teacher_name: "Professeur Jean Dupont",
          start_time: "2026-09-20T14:00:00Z",
          end_time: "2026-09-20T14:50:00Z",
          status: "confirmed",
          meeting_link: "https://meet.jit.si/tef-prep-b1",
        },
      ],
      recent_speaking_sessions: [],
    };

    const mockProgress: StudentProgressData = {
      timeline: [
        {
          timestamp: "2026-09-14T11:00:00Z",
          overall_score: 82.0,
          assessment_title: "Compréhension Écrite — Blanc 1",
          source_type: "assessment",
        },
      ],
      skills: mockDashboard.skills,
    };

    // Mock global fetch
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/v1/students/me/dashboard")) {
        return {
          ok: true,
          json: async () => mockDashboard,
        } as Response;
      }
      if (url.includes("/api/v1/students/me/progress")) {
        return {
          ok: true,
          json: async () => mockProgress,
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <StudentDashboardPage />
      </QueryClientProvider>
    );

    // Verify student name and target level in header
    expect(await screen.findByText(/Bonjour, Claire Martin/i)).toBeInTheDocument();
    expect(screen.getByText("TEF Canada")).toBeInTheDocument();
    expect(screen.getByText("74.2%")).toBeInTheDocument();

    // Verify weakest skills alert
    expect(screen.getByTestId("weakest-skills-banner")).toBeInTheDocument();
    expect(screen.getByText("(55%)")).toBeInTheDocument();

    // Verify recommended exercise
    expect(screen.getByTestId("recommended-exercises-section")).toBeInTheDocument();
    expect(
      screen.getByText("Exercice ciblé — Lequel, auquel, duquel")
    ).toBeInTheDocument();
    expect(screen.getByText(/Priorité critical/i)).toBeInTheDocument();

    // Verify teacher booking
    expect(screen.getByText(/Professeur Jean Dupont/i)).toBeInTheDocument();
  });
});
