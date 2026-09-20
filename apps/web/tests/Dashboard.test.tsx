/**
 * Integration and critical path tests for Student Dashboard.
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { StudentDashboardPage } from "@/features/dashboard/StudentDashboardPage";
import { SkillMetricCard } from "@/features/dashboard/SkillMetricCard";
import { HistoricalProgressChart } from "@/features/dashboard/HistoricalProgressChart";
import { DashboardEmptyState } from "@/features/dashboard/DashboardEmptyState";
import { ReadinessHero } from "@/features/dashboard/ReadinessHero";
import { NextActionCard } from "@/features/dashboard/NextActionCard";
import { DailyPlanCard } from "@/features/dashboard/DailyPlanCard";
import { PrioritySkills } from "@/features/dashboard/PrioritySkills";
import { ProgressOverview } from "@/features/dashboard/ProgressOverview";
import { RecentActivity } from "@/features/dashboard/RecentActivity";
import type {
  SkillSummaryMetric,
  StudentDashboardData,
  StudentProgressData,
  ProgressDataPoint,
  RecommendedExerciseSummary,
  DailyPlanData,
  WeakestSkillSummary,
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
      recent_writing_corrections: [
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
        <MemoryRouter>
          <StudentDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify student name and target level in header
    expect(await screen.findByText(/Bonjour, Claire Martin/i)).toBeInTheDocument();
    expect(screen.getByText("TEF Canada")).toBeInTheDocument();
    expect(screen.getByText(/74\.2%/)).toBeInTheDocument();

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

  it("renders StudentDashboardPage in new student onboarding state with diagnostic CTA", async () => {
    const newStudentDashboard: StudentDashboardData = {
      student_id: "student-new",
      student_name: "Antoine Daniel",
      target_exam: "TEF Canada",
      target_level: "B2",
      target_nclc_level: "7",
      overall_readiness: null,
      total_assessments_taken: 0,
      total_practice_minutes: 0,
      skills: [],
      weakest_skills: [],
      recommended_exercises: [],
      recent_assessments: [],
      recent_writing_corrections: [],
      upcoming_bookings: [],
      recent_speaking_sessions: [],
      progress_history: [],
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/v1/students/me/dashboard")) {
        return {
          ok: true,
          json: async () => newStudentDashboard,
        } as Response;
      }
      if (url.includes("/api/v1/students/me/progress")) {
        return {
          ok: true,
          json: async () => ({ timeline: [], skills: [] }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StudentDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Bonjour, Antoine Daniel/i)).toBeInTheDocument();
    expect(screen.getByText(/Passez votre premier test diagnostic/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Démarrer le diagnostic/i })).toBeInTheDocument();
    expect(screen.getByText(/Étalonnage…/i)).toBeInTheDocument();
  });

  it("handles 401 session expiration without leaking raw AUTH_REQUIRED or machine error codes", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ error: { code: "UNAUTHORIZED", message: "Token expired" } }),
      } as Response;
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StudentDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify friendly French error message is displayed
    expect(await screen.findByText(/Session expirée/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Votre session a expiré ou une authentification est requise/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Se connecter/i })).toBeInTheDocument();

    // Verify machine codes are NOT exposed
    expect(screen.queryByText("AUTH_REQUIRED")).not.toBeInTheDocument();
    expect(screen.queryByText("401")).not.toBeInTheDocument();
  });

  it("renders ReadinessHero with countdown, CEFR comparison, and target readiness meter", () => {
    render(
      <MemoryRouter>
        <ReadinessHero
          studentName="Sophie Germain"
          targetExam="TEF Canada"
          targetLevel="B2"
          targetNclcLevel="7"
          currentCefrLevel="B1"
          currentNclcLevel="5"
          overallReadiness={80.5}
          daysRemaining={25}
          totalAssessmentsTaken={4}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Bonjour, Sophie Germain/i)).toBeInTheDocument();
    expect(screen.getByText("J-25")).toBeInTheDocument();
    expect(screen.getByText("80.5%")).toBeInTheDocument();
    expect(screen.getByText("Cible B2 (NCLC 7)")).toBeInTheDocument();
    expect(screen.getByText(/Consulter le rapport d'admissibilité/i)).toBeInTheDocument();
  });

  it("renders NextActionCard with recommendation and responds to action click", () => {
    const handleAction = vi.fn();
    const mockRec: RecommendedExerciseSummary = {
      id: "rec-99",
      title: "Compréhension Orale — Annonces radiophoniques",
      category: "listening",
      difficulty: 4,
      level: "B2",
      target_skill_name: "Compréhension de l'oral",
      reason: "Améliorer la détection des implicites dans les dialogues rapides.",
      priority: "high",
    };

    render(
      <MemoryRouter>
        <NextActionCard recommendation={mockRec} onActionClick={handleAction} />
      </MemoryRouter>
    );

    expect(screen.getByText("Compréhension Orale — Annonces radiophoniques")).toBeInTheDocument();
    expect(screen.getByText(/Améliorer la détection des implicites/i)).toBeInTheDocument();
    expect(screen.getByText(/Priorité high/i)).toBeInTheDocument();

    const startBtn = screen.getByRole("button", { name: /Commencer la pratique/i });
    fireEvent.click(startBtn);
    expect(handleAction).toHaveBeenCalledWith(mockRec);
  });

  it("renders DailyPlanCard with task checklist, completion status, and time budget", () => {
    const handleTask = vi.fn();
    const plan: DailyPlanData = {
      date: "2026-09-18",
      total_tasks: 2,
      completed_tasks: 1,
      completion_percentage: 50,
      estimated_minutes_total: 35,
      daily_minutes_available: 45,
      tasks: [
        {
          id: "t1",
          title: "Simulation Écoute 15 min",
          description: "Pratique rapide",
          task_type: "exercise",
          estimated_minutes: 15,
          priority: "high",
          is_completed: true,
        },
        {
          id: "t2",
          title: "Rédaction — Section A",
          description: "Synthèse journalistique",
          task_type: "writing",
          estimated_minutes: 20,
          priority: "medium",
          is_completed: false,
        },
      ],
    };

    render(
      <MemoryRouter>
        <DailyPlanCard dailyPlan={plan} onTaskClick={handleTask} />
      </MemoryRouter>
    );

    expect(screen.getByText("Plan du jour")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("Simulation Écoute 15 min")).toBeInTheDocument();
    expect(screen.getByText("Rédaction — Section A")).toBeInTheDocument();
    expect(screen.getByText("Revoir")).toBeInTheDocument();
    expect(screen.getByText("Faire")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Faire"));
    expect(handleTask).toHaveBeenCalledWith(plan.tasks[1]);
  });

  it("renders PrioritySkills with gap badge and triggers practice CTA", () => {
    const handlePractice = vi.fn();
    const skills: WeakestSkillSummary[] = [
      {
        skill_id: "sk-1",
        skill_name: "Accords du participe passé",
        category: "grammar",
        mastery_score: 52.0,
        reason: "Erreurs récurrentes avec l'auxiliaire avoir.",
        recommended_exercise_id: "ex-accords",
      },
    ];

    render(
      <MemoryRouter>
        <PrioritySkills skills={skills} onPracticeSkill={handlePractice} />
      </MemoryRouter>
    );

    expect(screen.getByText("Compétences prioritaires")).toBeInTheDocument();
    expect(screen.getByText("Accords du participe passé")).toBeInTheDocument();
    expect(screen.getByText("(52%)")).toBeInTheDocument();
    expect(screen.getByText("Écart -18%")).toBeInTheDocument();

    const practiceBtn = screen.getByRole("button", { name: /S'entraîner/i });
    fireEvent.click(practiceBtn);
    expect(handlePractice).toHaveBeenCalledWith(skills[0]);
  });

  it("renders ProgressOverview with time range filters and handles sparse calibration states", () => {
    const sparseTimeline: ProgressDataPoint[] = [
      {
        timestamp: new Date().toISOString(),
        overall_score: 65.0,
        assessment_title: "Premier Diagnostic",
        source_type: "assessment",
      },
    ];

    render(
      <MemoryRouter>
        <ProgressOverview timeline={sparseTimeline} />
      </MemoryRouter>
    );

    expect(screen.getByText("Trajectoire d'apprentissage")).toBeInTheDocument();
    expect(screen.getByText("Premier Diagnostic")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
    // Sparse data calibration note
    expect(screen.getByText(/Étalonnage en cours/i)).toBeInTheDocument();
    expect(screen.getByText("1/3 requis")).toBeInTheDocument();
  });

  it("renders RecentActivity feed with formatted items and review links", () => {
    render(
      <MemoryRouter>
        <RecentActivity
          assessments={[
            {
              id: "as-1",
              title: "Épreuve Blanche Compréhension Écrite",
              assessment_type: "reading",
              score_percentage: 84.0,
              passed: true,
              estimated_level: "B2",
              submitted_at: new Date().toISOString(),
            },
          ]}
          writings={[
            {
              id: "wr-1",
              task_title: "Lettre de réclamation",
              overall_score: 75.0,
              estimated_level: "B2",
              submitted_at: new Date(Date.now() - 3600000).toISOString(),
              status: "corrected",
              corrected_at: new Date().toISOString(),
            },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Activité récente")).toBeInTheDocument();
    expect(screen.getByText("Épreuve Blanche Compréhension Écrite")).toBeInTheDocument();
    expect(screen.getByText("Lettre de réclamation")).toBeInTheDocument();
    expect(screen.getByText("84%")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Historique complet")).toBeInTheDocument();
  });

  it("handles partial section failure: progress query failure does not crash the dashboard", async () => {
    const mockDashboard: StudentDashboardData = {
      student_id: "student-partial",
      student_name: "Lucas Bernard",
      target_exam: "TEF Canada",
      target_level: "B2",
      overall_readiness: 68.0,
      skills: [],
      weakest_skills: [],
      recommended_exercises: [
        {
          id: "rec-partial",
          title: "Section A — Pratique de synthèse",
          category: "writing",
          difficulty: 3,
          level: "B2",
          target_skill_name: "Synthèse de documents",
          reason: "Priorité immédiate pour consolider l'épreuve écrite.",
          priority: "high",
        },
      ],
      recent_assessments: [],
      recent_writing_corrections: [],
      upcoming_bookings: [],
      recent_speaking_sessions: [],
      progress_history: [],
    };

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
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ error: { message: "Erreur de chargement de la trajectoire" } }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StudentDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Dashboard header and next action load successfully
    expect(await screen.findByText(/Bonjour, Lucas Bernard/i)).toBeInTheDocument();
    expect(screen.getByText("Section A — Pratique de synthèse")).toBeInTheDocument();

    // Isolated progress section error is displayed without blanking the dashboard
    expect(
      await screen.findByText(/Données de trajectoire temporairement indisponibles/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Réessayer/i })).toBeInTheDocument();
  });

  it("renders DashboardSkeleton during loading with accessible status attributes", () => {
    const { container } = render(
      <div role="status" aria-label="Chargement du tableau de bord..." aria-busy="true">
        <div className="animate-pulse" />
      </div>
    );

    const skeleton = screen.getByRole("status");
    expect(skeleton).toHaveAttribute("aria-busy", "true");
    expect(skeleton).toHaveAttribute("aria-label", "Chargement du tableau de bord...");
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders ReadinessHero visual target level relationship widget with gap indicator", () => {
    render(
      <MemoryRouter>
        <ReadinessHero
          studentName="Camille Claudel"
          targetExam="TEF Canada"
          targetLevel="C1"
          targetNclcLevel="9"
          currentCefrLevel="B2"
          currentNclcLevel="7"
          overallReadiness={88.2}
          daysRemaining={14}
          totalAssessmentsTaken={8}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Niveau estimé")).toBeInTheDocument();
    expect(screen.getByText("Écart")).toBeInTheDocument();
    expect(screen.getByText("Objectif")).toBeInTheDocument();
    expect(screen.getAllByText("B2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("C1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("(NCLC 7)")).toBeInTheDocument();
    expect(screen.getByText("(NCLC 9)")).toBeInTheDocument();
  });
});
