/**
 * Comprehensive tests for the Student Assessment Library experience (/assessments).
 * Verifies Guided First principles: Header, Active Attempt Banner, Recommended Assessment Hero,
 * Modality Skill cards, Filterable Simulations Catalog, and Past Assessment History.
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AssessmentLibraryHeader } from "@/features/assessments/AssessmentLibraryHeader"
import { ActiveAttemptCard } from "@/features/assessments/ActiveAttemptCard"
import { RecommendedAssessmentCard } from "@/features/assessments/RecommendedAssessmentCard"
import { AssessmentSkillSection } from "@/features/assessments/AssessmentSkillSection"
import { AssessmentSection } from "@/features/assessments/AssessmentSection"
import { AssessmentCard } from "@/features/assessments/AssessmentCard"
import { AssessmentHistory } from "@/features/assessments/AssessmentHistory"
import { AssessmentsListPage } from "@/features/assessments/AssessmentsListPage"
import type {
  AssessmentListItem,
  ActiveAttemptSummary,
  AssessmentRecommendation,
  AssessmentHistoryItem,
  AssessmentFiltersState,
} from "@/features/assessments/types"

const mockAssessments: AssessmentListItem[] = [
  {
    id: "asmt-full-1",
    title: "TEF Canada — Épreuve Complète Blanc 1",
    description: "Simulation officielle intégrale en conditions réelles.",
    assessment_type: "mixed",
    duration_seconds: 4500,
    estimated_completion_time_minutes: 75,
    level: "B2",
    navigation_policy: "free",
    scoring_policy: "tef_clb",
    section_count: 2,
    question_count: 60,
    total_points: 60,
    difficulty: 3,
  },
  {
    id: "asmt-ce-1",
    title: "Compréhension Écrite — Session Officielle B2",
    description: "40 questions de lecture et analyse textuelle.",
    assessment_type: "reading",
    duration_seconds: 3600,
    estimated_completion_time_minutes: 60,
    level: "B2",
    navigation_policy: "free",
    scoring_policy: "tef_clb",
    section_count: 1,
    question_count: 40,
    total_points: 40,
    difficulty: 3,
  },
  {
    id: "asmt-co-1",
    title: "Compréhension Orale — Session Rapide A2",
    description: "30 questions audio de base pour débutants.",
    assessment_type: "listening",
    duration_seconds: 1800,
    estimated_completion_time_minutes: 30,
    level: "A2",
    navigation_policy: "linear_locked",
    scoring_policy: "tef_clb",
    section_count: 1,
    question_count: 30,
    total_points: 30,
    difficulty: 1,
  },
]

const mockActiveAttempt: ActiveAttemptSummary = {
  id: "att-active-123",
  assessment_id: "asmt-ce-1",
  title: "Compréhension Écrite — Session Officielle B2",
  assessment_type: "reading",
  level: "B2",
  duration_seconds: 3600,
  remaining_seconds: 2220, // 37 min
  started_at: new Date(Date.now() - 1380 * 1000).toISOString(),
  expires_at: new Date(Date.now() + 2220 * 1000).toISOString(),
  total_questions: 40,
  answered_count: 18,
}

const mockRecommendation: AssessmentRecommendation = {
  assessment_id: "asmt-full-1",
  title: "TEF Canada — Épreuve Complète Blanc 1",
  assessment_type: "mixed",
  level: "B2",
  duration_seconds: 4500,
  estimated_completion_time_minutes: 75,
  question_count: 60,
  section_count: 2,
  reason: "Votre dernière simulation montre une marge de progression en compréhension orale. Ce test blanc complet consolidera vos acquis.",
  recommendation_type: "full_simulation",
}

const mockHistory: AssessmentHistoryItem[] = [
  {
    id: "att-hist-1",
    assessment_id: "asmt-ce-1",
    title: "Compréhension Écrite — Session Officielle B2",
    assessment_type: "reading",
    level: "B2",
    score_percentage: 78,
    passed: true,
    estimated_level: "B2 (NCLC 7)",
    status: "submitted",
    started_at: "2026-09-10T10:00:00Z",
    submitted_at: "2026-09-10T10:55:00Z",
    duration_seconds: 3300,
  },
  {
    id: "att-hist-2",
    assessment_id: "asmt-co-1",
    title: "Compréhension Orale — Session Rapide A2",
    assessment_type: "listening",
    level: "A2",
    score_percentage: null,
    passed: null,
    estimated_level: null,
    status: "expired",
    started_at: "2026-09-08T14:00:00Z",
    submitted_at: null,
    duration_seconds: 1800,
  },
]

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
}

describe("Student Assessment Library (/assessments)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.setItem("auth_token", "fake-test-token")
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it("1. AssessmentLibraryHeader: renders title, breadcrumbs, description, and count badge", () => {
    render(
      <MemoryRouter>
        <AssessmentLibraryHeader totalAssessments={5} />
      </MemoryRouter>
    )

    expect(screen.getByRole("heading", { level: 1, name: "Simulations TEF" })).toBeInTheDocument()
    expect(screen.getByText("Accueil")).toBeInTheDocument()
    expect(screen.getByText(/Évaluez votre niveau dans les conditions d'une épreuve chronométrée/i)).toBeInTheDocument()
    expect(screen.getByText(/5 simulations/i)).toBeInTheDocument()
  })

  it("2. ActiveAttemptCard: displays in-progress attempt with remaining time and progress", () => {
    const onResume = vi.fn()

    render(
      <MemoryRouter>
        <ActiveAttemptCard attempt={mockActiveAttempt} onResume={onResume} />
      </MemoryRouter>
    )

    expect(screen.getByTestId("active-attempt-card")).toBeInTheDocument()
    expect(screen.getByText(/Compréhension Écrite — Session Officielle B2/i)).toBeInTheDocument()
    expect(screen.getByText(/37 min/i)).toBeInTheDocument()
    expect(screen.getByText(/18 \/ 40 questions répondues/i)).toBeInTheDocument()

    const resumeBtn = screen.getByRole("button", { name: /Continuer l'évaluation/i })
    fireEvent.click(resumeBtn)
    expect(onResume).toHaveBeenCalledWith(mockActiveAttempt)
  })

  it("3. RecommendedAssessmentCard: displays personalized hero recommendation with reason and CTA", () => {
    const onStart = vi.fn()

    render(
      <MemoryRouter>
        <RecommendedAssessmentCard recommendation={mockRecommendation} onStart={onStart} />
      </MemoryRouter>
    )

    expect(screen.getByTestId("recommended-assessment-card")).toBeInTheDocument()
    expect(screen.getByText("Évaluation recommandée")).toBeInTheDocument()
    expect(screen.getByText("TEF Canada — Épreuve Complète Blanc 1")).toBeInTheDocument()
    expect(screen.getByText(/Pourquoi cette évaluation \?/i)).toBeInTheDocument()
    expect(screen.getByText(/Votre dernière simulation montre une marge de progression/i)).toBeInTheDocument()
    expect(screen.getByText(/75 min/i)).toBeInTheDocument()
    expect(screen.getByText("60 questions")).toBeInTheDocument()

    const startBtn = screen.getByRole("button", { name: /Commencer l'évaluation/i })
    fireEvent.click(startBtn)
    expect(onStart).toHaveBeenCalledWith(mockRecommendation)
  })

  it("4. RecommendedAssessmentCard: renders diagnostic fallback card for new candidates when null", () => {
    render(
      <MemoryRouter>
        <RecommendedAssessmentCard recommendation={null} />
      </MemoryRouter>
    )

    expect(screen.getByTestId("recommended-assessment-fallback")).toBeInTheDocument()
    expect(screen.getByText("Diagnostic initial recommandé")).toBeInTheDocument()
    expect(screen.getByText("Nouveau candidat")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Choisir une simulation/i })).toBeInTheDocument()
  })

  it("5. AssessmentSkillSection: displays reading and listening cards with available counts and companion links", () => {
    const onSelectSkill = vi.fn()

    render(
      <MemoryRouter>
        <AssessmentSkillSection assessments={mockAssessments} onSelectSkill={onSelectSkill} />
      </MemoryRouter>
    )

    expect(screen.getByText("Évaluer une compétence")).toBeInTheDocument()
    expect(screen.getByText("Compréhension Écrite")).toBeInTheDocument()
    expect(screen.getByText("Compréhension Orale")).toBeInTheDocument()
    expect(screen.getByText("Expression Écrite")).toBeInTheDocument()
    expect(screen.getByText("Expression Orale")).toBeInTheDocument()

    // Test filter trigger
    const filterReadingBtn = screen.getByRole("button", { name: /Voir les évaluations de lecture/i })
    fireEvent.click(filterReadingBtn)
    expect(onSelectSkill).toHaveBeenCalledWith("reading")
  })

  it("6. AssessmentSection: filters assessments by search query", () => {
    const defaultFilters: AssessmentFiltersState = {
      type: "all",
      level: "all",
      duration: "all",
      search: "Écrite",
    }
    const onFilterChange = vi.fn()
    const onResetFilters = vi.fn()

    render(
      <MemoryRouter>
        <AssessmentSection
          assessments={mockAssessments}
          filters={defaultFilters}
          onFilterChange={onFilterChange}
          onResetFilters={onResetFilters}
        />
      </MemoryRouter>
    )

    expect(screen.getByText("Compréhension Écrite — Session Officielle B2")).toBeInTheDocument()
    expect(screen.queryByText("Compréhension Orale — Session Rapide A2")).not.toBeInTheDocument()
  })

  it("7. AssessmentSection: filters assessments by type", () => {
    const typeFilters: AssessmentFiltersState = {
      type: "listening",
      level: "all",
      duration: "all",
      search: "",
    }

    render(
      <MemoryRouter>
        <AssessmentSection
          assessments={mockAssessments}
          filters={typeFilters}
          onFilterChange={vi.fn()}
          onResetFilters={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getByText("Compréhension Orale — Session Rapide A2")).toBeInTheDocument()
    expect(screen.queryByText("Compréhension Écrite — Session Officielle B2")).not.toBeInTheDocument()
    expect(screen.queryByText("TEF Canada — Épreuve Complète Blanc 1")).not.toBeInTheDocument()
  })

  it("8. AssessmentSection: filters assessments by duration category", () => {
    const shortFilters: AssessmentFiltersState = {
      type: "all",
      level: "all",
      duration: "short", // < 45 min
      search: "",
    }

    render(
      <MemoryRouter>
        <AssessmentSection
          assessments={mockAssessments}
          filters={shortFilters}
          onFilterChange={vi.fn()}
          onResetFilters={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getByText("Compréhension Orale — Session Rapide A2")).toBeInTheDocument()
    expect(screen.queryByText("Compréhension Écrite — Session Officielle B2")).not.toBeInTheDocument()
  })

  it("9. AssessmentSection: shows empty state when no simulations match and handles reset", () => {
    const unmatchableFilters: AssessmentFiltersState = {
      type: "all",
      level: "C1",
      duration: "all",
      search: "Inexistant",
    }
    const onResetFilters = vi.fn()

    render(
      <MemoryRouter>
        <AssessmentSection
          assessments={mockAssessments}
          filters={unmatchableFilters}
          onFilterChange={vi.fn()}
          onResetFilters={onResetFilters}
        />
      </MemoryRouter>
    )

    expect(screen.getByText("Aucune simulation trouvée")).toBeInTheDocument()
    const resetBtn = screen.getByRole("button", { name: "Réinitialiser les filtres" })
    fireEvent.click(resetBtn)
    expect(onResetFilters).toHaveBeenCalledTimes(1)
  })

  it("10. AssessmentHistory: renders past attempt rows with scores and estimated level", () => {
    render(
      <MemoryRouter>
        <AssessmentHistory history={mockHistory} />
      </MemoryRouter>
    )

    expect(screen.getByText("Historique des évaluations")).toBeInTheDocument()
    expect(screen.getByTestId("history-row-att-hist-1")).toBeInTheDocument()
    expect(screen.getAllByText("78%")[0]).toBeInTheDocument()
    expect(screen.getAllByText("B2 (NCLC 7)")[0]).toBeInTheDocument()
    expect(screen.getAllByText("Terminé")[0]).toBeInTheDocument()
    expect(screen.getAllByText("Expiré")[0]).toBeInTheDocument()
  })

  it("11. AssessmentHistory: renders polite empty state when student has no history", () => {
    const onStartFirst = vi.fn()

    render(
      <MemoryRouter>
        <AssessmentHistory history={[]} onStartFirst={onStartFirst} />
      </MemoryRouter>
    )

    expect(screen.getByText("Aucune évaluation passée")).toBeInTheDocument()
    const startFirstBtn = screen.getByRole("button", { name: "Commencer une évaluation" })
    fireEvent.click(startFirstBtn)
    expect(onStartFirst).toHaveBeenCalledTimes(1)
  })

  it("12. AssessmentsListPage: gracefully handles session expiration with friendly French recovery", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes("/api/v1/assessments")) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ detail: "Unauthorized" }),
        } as Response
      }
      return { ok: false, status: 500 } as Response
    })

    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/assessments"]}>
          <AssessmentsListPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("Session expirée")).toBeInTheDocument()
    })

    expect(screen.getByText(/Votre session a expiré ou une authentification est requise/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Se reconnecter/i })).toBeInTheDocument()
    // Invariant: Never display machine codes like "401" or "AUTH_REQUIRED" to student
    expect(screen.queryByText("401")).not.toBeInTheDocument()
    expect(screen.queryByText("AUTH_REQUIRED")).not.toBeInTheDocument()
  })
})
