/**
 * Comprehensive tests for the Student Assessment Details page (/assessments/:id).
 * Verifies Assessment Summary, Overview, Sections, Skills, Rules, History Preview,
 * Active Attempt detection, and Start/Resume flows.
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AssessmentSummary } from "@/features/assessments/AssessmentSummary"
import { AssessmentOverview } from "@/features/assessments/AssessmentOverview"
import { AssessmentSections } from "@/features/assessments/AssessmentSections"
import { AssessmentSkills } from "@/features/assessments/AssessmentSkills"
import { AssessmentRules } from "@/features/assessments/AssessmentRules"
import { AssessmentHistoryPreview } from "@/features/assessments/AssessmentHistoryPreview"
import { AssessmentPrimaryAction } from "@/features/assessments/AssessmentPrimaryAction"
import { AssessmentDetailPage } from "@/features/assessments/AssessmentDetailPage"
import type {
  AssessmentDetail,
  ActiveAttemptSummary,
  AssessmentHistoryItem,
} from "@/features/assessments/types"

const mockDetail: AssessmentDetail = {
  id: "asmt-ce-b2",
  title: "Compréhension Écrite — Session Complète B2",
  description: "40 questions de repérage, analyse textuelle, inférence et logique éditoriale sous chronomètre strict.",
  assessment_type: "reading",
  duration_seconds: 3600,
  estimated_completion_time_minutes: 60,
  level: "B2",
  navigation_policy: "free",
  scoring_policy: "tef_clb",
  pass_percentage: 0.7,
  sections: [
    {
      id: "sec-1",
      assessment_id: "asmt-ce-b2",
      title: "Section A - Textes courts et annonces",
      instructions: "Lisez les documents et répondez aux questions associées.",
      order_index: 1,
      duration_seconds: 1200,
      questions: [
        {
          id: "q-1",
          section_id: "sec-1",
          prompt: "Quel est l'objet de ce message ?",
          question_type: "single_choice",
          order_index: 1,
          level: "B2",
          difficulty: 3,
          points: 1,
          options: [],
        },
        {
          id: "q-2",
          section_id: "sec-1",
          prompt: "Quelle consigne est obligatoire ?",
          question_type: "single_choice",
          order_index: 2,
          level: "B2",
          difficulty: 3,
          points: 1,
          options: [],
        },
      ],
    },
    {
      id: "sec-2",
      assessment_id: "asmt-ce-b2",
      title: "Section B - Articles de presse et argumentation",
      instructions: "Analysez les points de vue des auteurs.",
      order_index: 2,
      duration_seconds: 2400,
      questions: [
        {
          id: "q-3",
          section_id: "sec-2",
          prompt: "Quelle est la thèse soutenue par l'éditorialiste ?",
          question_type: "single_choice",
          order_index: 1,
          level: "B2",
          difficulty: 4,
          points: 2,
          options: [],
        },
      ],
    },
  ],
}

const mockActiveAttempt: ActiveAttemptSummary = {
  id: "att-active-456",
  assessment_id: "asmt-ce-b2",
  title: "Compréhension Écrite — Session Complète B2",
  assessment_type: "reading",
  level: "B2",
  duration_seconds: 3600,
  remaining_seconds: 1920, // 32 min
  started_at: new Date(Date.now() - 1680 * 1000).toISOString(),
  expires_at: new Date(Date.now() + 1920 * 1000).toISOString(),
  total_questions: 3,
  answered_count: 2,
}

const mockLastAttempt: AssessmentHistoryItem = {
  id: "att-past-101",
  assessment_id: "asmt-ce-b2",
  title: "Compréhension Écrite — Session Complète B2",
  assessment_type: "reading",
  level: "B2",
  score_percentage: 68,
  passed: true,
  estimated_level: "B1+",
  status: "submitted",
  started_at: "2026-09-12T10:00:00Z",
  submitted_at: "2026-09-12T10:52:00Z",
  duration_seconds: 3120,
}

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

describe("Student Assessment Details (/assessments/:id)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.setItem("auth_token", "fake-details-token")
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it("1. AssessmentSummary: renders level, duration, total questions, and section count", () => {
    render(
      <AssessmentSummary assessment={mockDetail} totalQuestions={3} />
    )

    expect(screen.getByTestId("assessment-summary-card")).toBeInTheDocument()
    expect(screen.getByText("Niveau visé")).toBeInTheDocument()
    expect(screen.getByText("B2")).toBeInTheDocument()
    expect(screen.getByText("Temps imparti")).toBeInTheDocument()
    expect(screen.getByText("60")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("2. AssessmentOverview: displays 4 expectation pillars", () => {
    render(<AssessmentOverview assessment={mockDetail} />)

    expect(screen.getByText("À quoi vous attendre")).toBeInTheDocument()
    expect(screen.getByText("Épreuve chronométrée")).toBeInTheDocument()
    expect(screen.getByText("Sauvegarde continue")).toBeInTheDocument()
    expect(screen.getByText("Résultats immédiats")).toBeInTheDocument()
    expect(screen.getByText("Progression personnalisée")).toBeInTheDocument()
  })

  it("3. AssessmentSections: displays breakdown of test sections with question counts", () => {
    render(
      <AssessmentSections
        sections={mockDetail.sections}
        assessmentType={mockDetail.assessment_type}
      />
    )

    expect(screen.getByText("Structure de l'épreuve")).toBeInTheDocument()
    expect(screen.getByText("Section A - Textes courts et annonces")).toBeInTheDocument()
    expect(screen.getByText("Section B - Articles de presse et argumentation")).toBeInTheDocument()
    expect(screen.getByText(/2 questions/i)).toBeInTheDocument()
    expect(screen.getByText(/1 question/i)).toBeInTheDocument()
  })

  it("4. AssessmentSkills: displays evaluated competencies for the assessment modality", () => {
    render(<AssessmentSkills assessmentType="reading" />)

    expect(screen.getByText("Compétences évaluées")).toBeInTheDocument()
    expect(screen.getByText("Repérage d'informations factuelles")).toBeInTheDocument()
    expect(screen.getByText("Compréhension globale et logique textuelle")).toBeInTheDocument()
    expect(screen.getByText("Inférence et implicite de l'auteur")).toBeInTheDocument()
  })

  it("5. AssessmentRules: renders strict exam rules including server timer and continuous save", () => {
    render(<AssessmentRules assessment={mockDetail} />)

    expect(screen.getByText("Consignes et modalités d'examen")).toBeInTheDocument()
    expect(screen.getByText(/Chronomètre serveur faisant autorité/)).toBeInTheDocument()
    expect(screen.getByText(/Sauvegarde continue des réponses/)).toBeInTheDocument()
    expect(screen.getByText(/Soumission définitive et clôture/)).toBeInTheDocument()
    expect(screen.getByText(/Navigation libre dans l'épreuve/)).toBeInTheDocument()
  })

  it("6. AssessmentHistoryPreview: displays previous attempt metrics and result CTA", () => {
    render(
      <MemoryRouter>
        <AssessmentHistoryPreview lastAttempt={mockLastAttempt} />
      </MemoryRouter>
    )

    expect(screen.getByTestId("assessment-history-preview")).toBeInTheDocument()
    expect(screen.getByText("Votre dernière tentative")).toBeInTheDocument()
    expect(screen.getByText("68%")).toBeInTheDocument()
    expect(screen.getByText("B1+")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Voir le résultat/i })).toBeInTheDocument()
  })

  it("7. AssessmentPrimaryAction: renders start action for new attempt with submission warning", () => {
    const onStart = vi.fn()

    render(
      <MemoryRouter>
        <AssessmentPrimaryAction
          assessment={mockDetail}
          onStart={onStart}
        />
      </MemoryRouter>
    )

    expect(screen.getByText("Commencer l'évaluation")).toBeInTheDocument()
    expect(screen.getByText(/Une fois l'évaluation soumise, vos réponses ne pourront plus être modifiées/i)).toBeInTheDocument()

    const startBtn = screen.getByRole("button", { name: /Commencer l'évaluation/i })
    fireEvent.click(startBtn)
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it("8. AssessmentPrimaryAction: renders active attempt banner and resume CTA when attempt in progress", () => {
    const onResume = vi.fn()

    render(
      <MemoryRouter>
        <AssessmentPrimaryAction
          assessment={mockDetail}
          activeAttempt={mockActiveAttempt}
          onStart={vi.fn()}
          onResume={onResume}
        />
      </MemoryRouter>
    )

    expect(screen.getByTestId("active-attempt-banner")).toBeInTheDocument()
    expect(screen.getByText(/Session en cours/i)).toBeInTheDocument()
    expect(screen.getByText(/Temps restant : 32 min/i)).toBeInTheDocument()

    const resumeBtn = screen.getByRole("button", { name: /Continuer l'évaluation/i })
    fireEvent.click(resumeBtn)
    expect(onResume).toHaveBeenCalledWith(mockActiveAttempt.id)
  })

  it("9. AssessmentPrimaryAction: renders restart and previous result CTAs when already completed", () => {
    const onStart = vi.fn()

    render(
      <MemoryRouter>
        <AssessmentPrimaryAction
          assessment={mockDetail}
          lastAttempt={mockLastAttempt}
          onStart={onStart}
        />
      </MemoryRouter>
    )

    expect(screen.getByText("Recommencer l'évaluation")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Voir mon dernier résultat/i })).toBeInTheDocument()

    const restartBtn = screen.getByRole("button", { name: /Recommencer l'évaluation/i })
    fireEvent.click(restartBtn)
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it("10. AssessmentDetailPage: orchestrates full view and initiates start attempt flow", async () => {
    let attemptInitiated = false

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input)
      if (url === "/api/v1/assessments/asmt-ce-b2") {
        return {
          ok: true,
          json: async () => mockDetail,
        } as Response
      }
      if (url === "/api/v1/assessments/me/active-attempt") {
        return { ok: true, text: async () => "null" } as Response
      }
      if (url.includes("/api/v1/assessments/me/history")) {
        return { ok: true, json: async () => [] } as Response
      }
      if (url === "/api/v1/assessments/me/recommendation") {
        return { ok: true, json: async () => null } as Response
      }
      if (url === "/api/v1/assessments/asmt-ce-b2/attempts" && init?.method === "POST") {
        attemptInitiated = true
        return {
          ok: true,
          json: async () => ({
            id: "att-created-789",
            assessment_id: "asmt-ce-b2",
            status: "started",
            remaining_seconds: 3600,
            answers: [],
          }),
        } as Response
      }
      return { ok: false } as Response
    })

    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/assessments/asmt-ce-b2"]}>
          <Routes>
            <Route path="/assessments/:id" element={<AssessmentDetailPage />} />
            <Route path="/attempts/:id" element={<div>Taking Screen att-created-789</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("Compréhension Écrite — Session Complète B2")).toBeInTheDocument()
    })

    expect(screen.getByText("Structure de l'épreuve")).toBeInTheDocument()
    expect(screen.getByText("Consignes et modalités d'examen")).toBeInTheDocument()

    const startBtn = screen.getByRole("button", { name: /Commencer l'évaluation/i })
    fireEvent.click(startBtn)

    await waitFor(() => {
      expect(attemptInitiated).toBe(true)
      expect(screen.getByText("Taking Screen att-created-789")).toBeInTheDocument()
    })
  })

  it("11. AssessmentDetailPage: handles not found assessment gracefully with return action", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes("/api/v1/assessments/asmt-missing")) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ detail: "Assessment not found" }),
        } as Response
      }
      return { ok: false } as Response
    })

    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/assessments/asmt-missing"]}>
          <AssessmentDetailPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("Cette évaluation n'est plus disponible")).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: "Retour aux simulations" })).toBeInTheDocument()
  })

  it("12. AssessmentDetailPage: intercepts 401 session expiration with friendly French recovery", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return {
        ok: false,
        status: 401,
        json: async () => ({ detail: "Unauthorized" }),
      } as Response
    })

    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/assessments/asmt-ce-b2"]}>
          <AssessmentDetailPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("Session expirée")).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: "Se reconnecter" })).toBeInTheDocument()
    expect(screen.queryByText("401")).not.toBeInTheDocument()
    expect(screen.queryByText("AUTH_REQUIRED")).not.toBeInTheDocument()
  })
})
