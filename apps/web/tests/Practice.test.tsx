/**
 * Tests for the Student Practice page and pedagogical components.
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { PracticeHeader } from "@/features/practice/PracticeHeader"
import { PracticeRecommendationCard } from "@/features/practice/PracticeRecommendationCard"
import { RecommendedPracticeSection } from "@/features/practice/RecommendedPracticeSection"
import { DailyPracticePlan } from "@/features/practice/DailyPracticePlan"
import { PracticeCategories, CANONICAL_CATEGORIES } from "@/features/practice/PracticeCategories"
import { PracticeCategoryCard } from "@/features/practice/PracticeCategoryCard"
import { PracticeExerciseCard } from "@/features/practice/PracticeExerciseCard"
import { ExplorePracticeSection } from "@/features/practice/ExplorePracticeSection"
import { RecentPractice } from "@/features/practice/RecentPractice"
import { PracticePage } from "@/features/practice/PracticePage"
import type {
  PracticeExerciseItem,
  PracticeRecommendationItem,
  DailyPracticePlanData,
  RecentPracticeAttempt,
  PracticeFiltersState,
} from "@/features/practice/types"

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

describe("Student Practice Experience & Components", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  // 1. Header
  it("renders PracticeHeader with breadcrumb, title, and counts", () => {
    render(
      <MemoryRouter>
        <PracticeHeader
          totalCount={15}
          completedTodayCount={2}
          totalTodayCount={4}
        />
      </MemoryRouter>
    )

    expect(screen.getByText("Accueil")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Pratique" })).toBeInTheDocument()
    expect(screen.getByText(/2\/4/i)).toBeInTheDocument()
    expect(screen.getByText(/terminé aujourd'hui/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Travaillez les compétences qui vous rapprochent de votre objectif/i)
    ).toBeInTheDocument()
  })

  // 2. Primary Recommendation Card
  it("renders primary PracticeRecommendationCard with pedagogical reason and action", () => {
    const mockRec: PracticeRecommendationItem = {
      id: "rec-hero-1",
      entity_type: "exercise",
      entity_id: "ex-10",
      title: "Compréhension Orale — Inférence et ton du locuteur",
      category: "listening",
      level: "B2",
      reason: "Comble un déficit de 18% identifié lors de votre dernier diagnostic.",
      priority: 95,
      estimated_minutes: 15,
    }

    const onStart = vi.fn()

    render(
      <MemoryRouter>
        <PracticeRecommendationCard
          recommendation={mockRec}
          variant="primary"
          onStart={onStart}
        />
      </MemoryRouter>
    )

    expect(screen.getByTestId("primary-recommendation-card")).toBeInTheDocument()
    expect(screen.getByText("Recommandation prioritaire")).toBeInTheDocument()
    expect(screen.getByText("Niveau B2")).toBeInTheDocument()
    expect(screen.getByText("Compréhension orale")).toBeInTheDocument()
    expect(screen.getByText("Compréhension Orale — Inférence et ton du locuteur")).toBeInTheDocument()
    expect(screen.getByText(/Pourquoi cette activité \?/i)).toBeInTheDocument()
    expect(
      screen.getByText("Comble un déficit de 18% identifié lors de votre dernier diagnostic.")
    ).toBeInTheDocument()
    expect(screen.getByText(/~15 min/i)).toBeInTheDocument()

    const startBtn = screen.getByRole("button", { name: /Commencer l'exercice/i })
    fireEvent.click(startBtn)
    expect(onStart).toHaveBeenCalledWith(mockRec)
  })

  // 3. RecommendedPracticeSection: Hero + Secondary
  it("renders RecommendedPracticeSection with hero and secondary cards", () => {
    const recs: PracticeRecommendationItem[] = [
      {
        id: "rec-1",
        entity_type: "exercise",
        entity_id: "ex-1",
        title: "Compréhension Orale Rapide",
        category: "listening",
        level: "B2",
        reason: "Priorité diagnostic.",
        priority: 90,
      },
      {
        id: "rec-2",
        entity_type: "exercise",
        entity_id: "ex-2",
        title: "Pronoms relatifs complexes",
        category: "grammar",
        level: "B2",
        reason: "Renforcement B2.",
        priority: 85,
      },
    ]

    render(
      <MemoryRouter>
        <RecommendedPracticeSection recommendations={recs} />
      </MemoryRouter>
    )

    expect(screen.getByText("Recommandé pour vous")).toBeInTheDocument()
    expect(screen.getByTestId("primary-recommendation-card")).toBeInTheDocument()
    expect(screen.getByTestId("secondary-recommendation-card")).toBeInTheDocument()
    expect(screen.getByText("Compréhension Orale Rapide")).toBeInTheDocument()
    expect(screen.getByText("Pronoms relatifs complexes")).toBeInTheDocument()
  })

  // 4. Insufficient Data State
  it("renders insufficient data prompt when recommendations list is empty", () => {
    const onDiagnostic = vi.fn()
    const onExplore = vi.fn()

    render(
      <MemoryRouter>
        <RecommendedPracticeSection
          recommendations={[]}
          onTakeDiagnostic={onDiagnostic}
          onExploreClick={onExplore}
        />
      </MemoryRouter>
    )

    expect(screen.getByTestId("insufficient-data-card")).toBeInTheDocument()
    expect(screen.getByText(/Personnalisation en cours/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Nous avons besoin de quelques résultats supplémentaires/i)
    ).toBeInTheDocument()

    const diagBtn = screen.getByRole("button", { name: /Passer un diagnostic/i })
    fireEvent.click(diagBtn)
    expect(onDiagnostic).toHaveBeenCalled()

    const exploreBtn = screen.getByRole("button", { name: /Explorer les exercices/i })
    fireEvent.click(exploreBtn)
    expect(onExplore).toHaveBeenCalled()
  })

  // 5. DailyPracticePlan
  it("renders DailyPracticePlan with tasks and completion progress", () => {
    const plan: DailyPracticePlanData = {
      date: "2026-09-19",
      total_tasks: 2,
      completed_tasks: 1,
      completion_percentage: 50,
      estimated_minutes_total: 25,
      tasks: [
        {
          id: "task-1",
          title: "Pronoms relatifs composés B2",
          description: "Accord en genre et nombre",
          task_type: "exercise",
          estimated_minutes: 10,
          priority: "high",
          is_completed: true,
        },
        {
          id: "task-2",
          title: "Audio : Débat travail hybride",
          description: "Détection des nuances orales",
          task_type: "exercise",
          estimated_minutes: 15,
          priority: "high",
          is_completed: false,
        },
      ],
    }

    const onTaskClick = vi.fn()

    render(
      <MemoryRouter>
        <DailyPracticePlan dailyPlan={plan} onTaskClick={onTaskClick} />
      </MemoryRouter>
    )

    expect(screen.getByTestId("daily-practice-plan")).toBeInTheDocument()
    expect(screen.getByText("Votre plan du jour")).toBeInTheDocument()
    expect(screen.getByText(/1 \/ 2 activités terminées/i)).toBeInTheDocument()
    expect(screen.getByText("Pronoms relatifs composés B2")).toBeInTheDocument()
    expect(screen.getByText("Audio : Débat travail hybride")).toBeInTheDocument()

    const reviewBtn = screen.getByRole("button", { name: /Revoir/i })
    fireEvent.click(reviewBtn)
    expect(onTaskClick).toHaveBeenCalledWith(plan.tasks[0])

    const startBtn = screen.getByRole("button", { name: /Faire/i })
    fireEvent.click(startBtn)
    expect(onTaskClick).toHaveBeenCalledWith(plan.tasks[1])
  })

  // 6. PracticeCategories: 7 Canonical Categories
  it("renders all 7 canonical TEF practice categories and handles selection", () => {
    const onSelect = vi.fn()
    render(
      <MemoryRouter>
        <PracticeCategories
          activeCategory="all"
          onSelectCategory={onSelect}
          exerciseCounts={{ reading: 5, listening: 4, grammar: 8 }}
        />
      </MemoryRouter>
    )

    expect(screen.getByTestId("practice-categories-section")).toBeInTheDocument()
    expect(CANONICAL_CATEGORIES).toHaveLength(7)

    for (const cat of CANONICAL_CATEGORIES) {
      expect(screen.getByText(cat.label)).toBeInTheDocument()
    }

    const readingCard = screen.getByTestId("category-card-reading")
    fireEvent.click(readingCard)
    expect(onSelect).toHaveBeenCalledWith("reading")
  })

  // 7. PracticeExerciseCard
  it("renders PracticeExerciseCard with details and triggers start", () => {
    const exercise: PracticeExerciseItem = {
      id: "ex-42",
      title: "Subjonctif passé et antériorité",
      instructions: "Complétez avec le temps approprié.",
      category: "conjugation",
      level: "B2",
      difficulty: 4,
      question_type: "multiple_choice",
      estimated_minutes: 12,
      points: 10,
      is_completed: false,
    }

    const onStart = vi.fn()

    render(
      <MemoryRouter>
        <PracticeExerciseCard exercise={exercise} onStart={onStart} />
      </MemoryRouter>
    )

    expect(screen.getByTestId("exercise-card-ex-42")).toBeInTheDocument()
    expect(screen.getByText("Subjonctif passé et antériorité")).toBeInTheDocument()
    expect(screen.getByText("Niveau B2")).toBeInTheDocument()
    expect(screen.getByText("Conjugaison")).toBeInTheDocument()
    expect(screen.getByText(/12 min/i)).toBeInTheDocument()

    const btn = screen.getByRole("button", { name: /Commencer l'exercice/i })
    fireEvent.click(btn)
    expect(onStart).toHaveBeenCalledWith(exercise)
  })

  it("renders PracticeExerciseCard with completed status when is_completed is true", () => {
    const exercise: PracticeExerciseItem = {
      id: "ex-completed",
      title: "Inférence et implicite dans les éditoriaux",
      category: "reading",
      level: "B2",
      difficulty: 4,
      question_type: "single_choice",
      estimated_minutes: 15,
      is_completed: true,
    }

    render(
      <MemoryRouter>
        <PracticeExerciseCard exercise={exercise} />
      </MemoryRouter>
    )

    expect(screen.getByText("Terminé")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Revoir l'activité/i })).toBeInTheDocument()
  })

  // 8. ExplorePracticeSection Filtering
  it("filters exercises by search query, category, and level in ExplorePracticeSection", () => {
    const exercises: PracticeExerciseItem[] = [
      {
        id: "ex-1",
        title: "Pronoms relatifs composés",
        category: "grammar",
        level: "B2",
        difficulty: 3,
        question_type: "multiple_choice",
      },
      {
        id: "ex-2",
        title: "Compréhension audio débat",
        category: "listening",
        level: "B2",
        difficulty: 4,
        question_type: "single_choice",
      },
      {
        id: "ex-3",
        title: "Vocabulaire formel B1",
        category: "vocabulary",
        level: "B1",
        difficulty: 2,
        question_type: "multiple_choice",
      },
    ]

    const filters: PracticeFiltersState = {
      category: "grammar",
      level: "all",
      difficulty: "all",
      duration: "all",
      search: "",
    }

    const onFiltersChange = vi.fn()
    const onResetFilters = vi.fn()

    const { rerender } = render(
      <MemoryRouter>
        <ExplorePracticeSection
          exercises={exercises}
          filters={filters}
          onFiltersChange={onFiltersChange}
          onResetFilters={onResetFilters}
        />
      </MemoryRouter>
    )

    // With category="grammar", only ex-1 should show
    expect(screen.getByText("Pronoms relatifs composés")).toBeInTheDocument()
    expect(screen.queryByText("Compréhension audio débat")).not.toBeInTheDocument()
    expect(screen.queryByText("Vocabulaire formel B1")).not.toBeInTheDocument()

    // Rerender with search keyword
    rerender(
      <MemoryRouter>
        <ExplorePracticeSection
          exercises={exercises}
          filters={{
            ...filters,
            category: "all",
            search: "débat",
          }}
          onFiltersChange={onFiltersChange}
          onResetFilters={onResetFilters}
        />
      </MemoryRouter>
    )

    expect(screen.queryByText("Pronoms relatifs composés")).not.toBeInTheDocument()
    expect(screen.getByText("Compréhension audio débat")).toBeInTheDocument()
  })

  // 9. RecentPractice Feed
  it("renders RecentPractice feed with attempt history", () => {
    const attempts: RecentPracticeAttempt[] = [
      {
        id: "att-1",
        exercise_id: "ex-1",
        title: "Pronoms relatifs",
        category: "grammar",
        level: "B2",
        is_correct: true,
        points_awarded: 10,
        attempted_at: new Date().toISOString(),
      },
    ]

    render(
      <MemoryRouter>
        <RecentPractice attempts={attempts} />
      </MemoryRouter>
    )

    expect(screen.getByTestId("recent-practice")).toBeInTheDocument()
    expect(screen.getByText("Entraînements récents")).toBeInTheDocument()
    expect(screen.getByText("Pronoms relatifs")).toBeInTheDocument()
    expect(screen.getByText("Réussi")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Voir toute votre progression/i })).toBeInTheDocument()
  })

  // 10. Full PracticePage Integration
  it("renders full populated PracticePage from mock APIs", async () => {
    const mockRecs = [
      {
        id: "rec-api-1",
        entity_type: "exercise",
        entity_id: "ex-api-1",
        title: "Audio : Débat société B2",
        category: "listening",
        level: "B2",
        difficulty: 4,
        reason: "Comble votre déficit d'inférence.",
        priority: 95,
      },
    ]

    const mockDailyPlan = {
      date: "2026-09-19",
      total_tasks: 2,
      completed_tasks: 1,
      completion_percentage: 50,
      estimated_minutes_total: 20,
      tasks: [
        {
          id: "t-1",
          title: "Pronoms relatifs B2",
          description: "Accord",
          task_type: "exercise",
          estimated_minutes: 10,
          priority: "high",
          is_completed: false,
        },
      ],
    }

    const mockExercises = [
      {
        id: "ex-api-1",
        title: "Audio : Débat société B2",
        category: "listening",
        level: "B2",
        difficulty: 4,
        question_type: "single_choice",
        estimated_minutes: 15,
        points: 15,
      },
      {
        id: "ex-api-2",
        title: "Grammaire : Pronoms B2",
        category: "grammar",
        level: "B2",
        difficulty: 3,
        question_type: "multiple_choice",
        estimated_minutes: 10,
        points: 10,
      },
    ]

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes("/api/v1/students/me/recommendations")) {
        return {
          ok: true,
          json: async () => mockRecs,
        } as Response
      }
      if (url.includes("/api/v1/students/me/daily-plan")) {
        return {
          ok: true,
          json: async () => mockDailyPlan,
        } as Response
      }
      if (url.includes("/api/v1/exercises")) {
        return {
          ok: true,
          json: async () => mockExercises,
        } as Response
      }
      if (url.includes("/api/v1/students/me/activity")) {
        return {
          ok: true,
          json: async () => [],
        } as Response
      }
      return { ok: false, status: 404 } as Response
    })

    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/practice"]}>
          <PracticePage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Wait for content to settle
    await waitFor(() => {
      expect(screen.getByText("Recommandé pour vous")).toBeInTheDocument()
    })
    expect(screen.getAllByText("Audio : Débat société B2").length).toBeGreaterThan(0)
    expect(screen.getByText("Comble votre déficit d'inférence.")).toBeInTheDocument()

    // Check Daily Plan
    expect(screen.getByText("Votre plan du jour")).toBeInTheDocument()

    // Check Categories
    expect(screen.getByText("Catégories de pratique")).toBeInTheDocument()

    // Check Explore Section
    expect(screen.getByText("Explorer les exercices")).toBeInTheDocument()
  })

  // 11. Auth Expiration Resilience
  it("renders friendly session expired error on HTTP 401 without leaking machine code", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return {
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ error: { message: "AUTH_REQUIRED" } }),
      } as Response
    })

    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/practice"]}>
          <PracticePage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("Session expirée")).toBeInTheDocument()
    })

    expect(
      screen.getByText(/Votre session a expiré. Veuillez vous reconnecter/i)
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Se reconnecter/i })).toBeInTheDocument()
    expect(screen.queryByText("AUTH_REQUIRED")).not.toBeInTheDocument()
    expect(screen.queryByText("401")).not.toBeInTheDocument()
  })
})
