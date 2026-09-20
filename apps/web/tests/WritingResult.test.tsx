/**
 * Tests for the Student Writing Result / Correction Experience (/writing/:attemptId/result).
 * Covers:
 * - WritingResultSkeleton loading state
 * - WritingResultHeader top navigation and statuses
 * - WritingResultSummary score, CEFR level, word count, criteria, disclaimer
 * - CorrectionPendingState pending/waiting state for AI and Teacher
 * - WritingStrengthsImprovements validated strengths and improvements
 * - WritingEvaluatorFeedback teacher vs AI provenance and commentary
 * - WritingResponseViewer immutable student copy viewer
 * - WritingAnnotatedCorrections before/after diffs, category filters, explanations
 * - WritingRecommendationsList personalized next practice recommendations
 * - WritingResultPage end-to-end integration (loading, error, pending, completed with tabs)
 */

import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import {
  WritingResultHeader,
  WritingResultSummary,
  CorrectionPendingState,
  WritingStrengthsImprovements,
  WritingEvaluatorFeedback,
  WritingResponseViewer,
  WritingAnnotatedCorrections,
  WritingRecommendationsList,
  WritingResultSkeleton,
  WritingResultPage,
} from "@/features/writing"
import type {
  WritingResultDetail,
  CorrectionItem,
  WritingRecommendation,
} from "@/features/writing"

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

describe("Student Writing Result & Correction Experience (/writing/:id/result)", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    sessionStorage.clear()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  // 1. WritingResultSkeleton
  describe("1. WritingResultSkeleton", () => {
    it("renders loading skeletons for header, summary, feedback, and response", () => {
      render(<WritingResultSkeleton />)
      expect(
        screen.getByLabelText("Chargement des résultats de l'épreuve écrite")
      ).toBeInTheDocument()
    })
  })

  // 2. WritingResultHeader
  describe("2. WritingResultHeader", () => {
    it("renders header with task title, section badge, corrected status, and handles actions", () => {
      const onBack = vi.fn()
      const onPractice = vi.fn()

      render(
        <WritingResultHeader
          taskTitle="Interdiction automobile au centre-ville"
          taskType="section_b"
          status="corrected"
          provider="ai"
          submittedAt="2026-09-19T14:30:00.000Z"
          onBack={onBack}
          onPracticeClick={onPractice}
        />
      )

      expect(screen.getByText("Interdiction automobile au centre-ville")).toBeInTheDocument()
      expect(screen.getByText("Section B (Lettre d'opinion)")).toBeInTheDocument()
      expect(screen.getByText("Correction disponible")).toBeInTheDocument()
      expect(screen.getByText("Évaluation IA")).toBeInTheDocument()

      const backBtn = screen.getByRole("button", { name: /Retour à l'Atelier d'écriture/i })
      fireEvent.click(backBtn)
      expect(onBack).toHaveBeenCalledTimes(1)

      const practiceBtn = screen.getByRole("button", { name: /S'entraîner/i })
      fireEvent.click(practiceBtn)
      expect(onPractice).toHaveBeenCalledTimes(1)
    })

    it("renders teacher pending status when awaiting teacher review", () => {
      render(
        <WritingResultHeader
          taskTitle="Lettre formelle"
          taskType="section_b"
          status="assigned"
          provider="teacher"
          onBack={vi.fn()}
        />
      )

      expect(
        screen.getByText("En attente de correction par un professeur")
      ).toBeInTheDocument()
      expect(screen.getByText("Professeur certifié")).toBeInTheDocument()
    })
  })

  // 3. WritingResultSummary
  describe("3. WritingResultSummary", () => {
    it("renders estimated CEFR level, practice score, word count compliance, and criteria", () => {
      render(
        <WritingResultSummary
          estimatedLevel="B2"
          score={78.0}
          wordCount={228}
          minWords={200}
          maxWords={250}
          criteria={{
            taskCompletion: 85,
            coherence: 80,
            vocabulary: 75,
            grammar: 72,
            syntax: 75,
            spelling: 85,
          }}
          disclaimer="Score d'entraînement indicatif — Non officiel TEF."
        />
      )

      expect(screen.getByText("B2")).toBeInTheDocument()
      expect(screen.getByText("78")).toBeInTheDocument()
      expect(screen.getByText("228")).toBeInTheDocument()
      expect(screen.getByText("Conforme (200–250)")).toBeInTheDocument()
      expect(screen.getAllByText("85%").length).toBeGreaterThan(0)
      expect(screen.getByText("Score d'entraînement indicatif — Non officiel TEF.")).toBeInTheDocument()
    })

    it("renders warning badge when word count is below minimum", () => {
      render(
        <WritingResultSummary
          estimatedLevel="B1"
          score={55.0}
          wordCount={160}
          minWords={200}
          maxWords={250}
        />
      )

      expect(screen.getByText("Inférieur au minimum (200)")).toBeInTheDocument()
    })
  })

  // 4. CorrectionPendingState
  describe("4. CorrectionPendingState", () => {
    it("renders pending state for AI correction with submitted copy and refresh button", () => {
      const onRefresh = vi.fn()

      render(
        <CorrectionPendingState
          taskTitle="Sujet de test"
          taskPrompt="Consigne du sujet de test..."
          content="Voici mon texte rédigé..."
          wordCount={120}
          status="submitted"
          isTeacherReview={false}
          isRefreshing={false}
          onRefresh={onRefresh}
        />
      )

      expect(screen.getByText("Correction en cours")).toBeInTheDocument()
      expect(screen.getByText(/Votre devoir a bien été enregistré/i)).toBeInTheDocument()
      expect(screen.getByText("Voici mon texte rédigé...")).toBeInTheDocument()

      const refreshBtn = screen.getByRole("button", { name: /Actualiser l'état/i })
      fireEvent.click(refreshBtn)
      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it("renders pending state for teacher review with appropriate explanation", () => {
      render(
        <CorrectionPendingState
          taskTitle="Sujet de test"
          taskPrompt="Consigne..."
          content="Texte en attente..."
          wordCount={120}
          status="in_review"
          isTeacherReview={true}
          isRefreshing={false}
          onRefresh={vi.fn()}
        />
      )

      expect(
        screen.getByText("En attente de correction par un professeur")
      ).toBeInTheDocument()
      expect(screen.getByText(/Un enseignant certifié examine attentivement/i)).toBeInTheDocument()
    })
  })

  // 5. WritingStrengthsImprovements
  describe("5. WritingStrengthsImprovements", () => {
    it("renders strengths and improvements lists", () => {
      render(
        <WritingStrengthsImprovements
          strengths={["Respect strict de la longueur", "Formule d'interpellation adaptée"]}
          weaknesses={["Diversifier le lexique", "Attention aux accords"]}
        />
      )

      expect(screen.getByText("Ce que vous avez bien fait")).toBeInTheDocument()
      expect(screen.getByText("Respect strict de la longueur")).toBeInTheDocument()
      expect(screen.getByText("Formule d'interpellation adaptée")).toBeInTheDocument()

      expect(screen.getByText("Axes d'amélioration prioritaires")).toBeInTheDocument()
      expect(screen.getByText("Diversifier le lexique")).toBeInTheDocument()
      expect(screen.getByText("Attention aux accords")).toBeInTheDocument()
    })
  })

  // 6. WritingEvaluatorFeedback
  describe("6. WritingEvaluatorFeedback", () => {
    it("renders teacher feedback with provenance", () => {
      render(
        <WritingEvaluatorFeedback
          provider="teacher"
          comments="Très bon devoir, les arguments sont solides et bien formulés."
        />
      )

      expect(screen.getByText("Commentaire du professeur référent")).toBeInTheDocument()
      expect(
        screen.getByText("Très bon devoir, les arguments sont solides et bien formulés.")
      ).toBeInTheDocument()
    })

    it("renders AI evaluation summary with disclaimer", () => {
      render(
        <WritingEvaluatorFeedback
          provider="ai"
          comments="Synthèse automatisée : bon niveau global."
        />
      )

      expect(screen.getByText("Synthèse de l'évaluation IA")).toBeInTheDocument()
      expect(
        screen.getByText(/Cette synthèse a été générée par un modèle d'évaluation automatisé/i)
      ).toBeInTheDocument()
      expect(screen.getByText("Synthèse automatisée : bon niveau global.")).toBeInTheDocument()
    })
  })

  // 7. WritingResponseViewer
  describe("7. WritingResponseViewer", () => {
    it("renders candidate submitted copy read-only and allows copying", () => {
      render(
        <WritingResponseViewer
          content="Monsieur le Maire,\nJe vous écris pour protester..."
          wordCount={8}
          taskPrompt="Sujet officiel sur l'urbanisme"
          stimulusText="Extrait du journal municipal"
        />
      )

      expect(screen.getByText("Votre copie soumise")).toBeInTheDocument()
      expect(screen.getByText(/8 mots/)).toBeInTheDocument()
      expect(screen.getByText(/Monsieur le Maire/)).toBeInTheDocument()

      // Toggle prompt accordion
      const promptBtn = screen.getByRole("button", { name: /Revoir le sujet/i })
      fireEvent.click(promptBtn)
      expect(screen.getByText("Sujet officiel sur l'urbanisme")).toBeInTheDocument()
      expect(screen.getByText("Extrait du journal municipal")).toBeInTheDocument()
    })
  })

  // 8. WritingAnnotatedCorrections
  describe("8. WritingAnnotatedCorrections", () => {
    const mockItems: CorrectionItem[] = [
      {
        id: "item-1",
        correction_id: "corr-1",
        original_text: "je achète",
        corrected_text: "j'achète",
        category: "grammar",
        explanation: "L'élision est obligatoire devant une voyelle.",
        skill_id: "sk-grammar-elision",
        created_at: new Date().toISOString(),
      },
      {
        id: "item-2",
        correction_id: "corr-1",
        original_text: "très bien",
        corrected_text: "remarquable",
        category: "vocabulary",
        explanation: "Privilégiez un lexique plus soutenu pour le niveau B2.",
        skill_id: "sk-vocab-formal",
        created_at: new Date().toISOString(),
      },
    ]

    it("renders correction cards and filters by category", () => {
      const onSelectSkill = vi.fn()

      render(
        <WritingAnnotatedCorrections
          items={mockItems}
          onSelectSkill={onSelectSkill}
        />
      )

      expect(screen.getByText("je achète")).toBeInTheDocument()
      expect(screen.getByText("j'achète")).toBeInTheDocument()
      expect(screen.getByText("L'élision est obligatoire devant une voyelle.")).toBeInTheDocument()

      // Filter by category
      const vocabFilterBtn = screen.getByRole("button", { name: /Vocabulaire/i })
      fireEvent.click(vocabFilterBtn)

      // Only vocabulary item should be visible
      expect(screen.queryByText("je achète")).not.toBeInTheDocument()
      expect(screen.getByText("remarquable")).toBeInTheDocument()

      // Click skill action
      const skillBtn = screen.getByRole("button", { name: /S'entraîner sur cette règle/i })
      fireEvent.click(skillBtn)
      expect(onSelectSkill).toHaveBeenCalledWith("sk-vocab-formal")
    })

    it("renders empty state when items list is empty", () => {
      render(<WritingAnnotatedCorrections items={[]} />)
      expect(screen.getByText("Aucune faute ponctuelle relevée")).toBeInTheDocument()
    })
  })

  // 9. WritingRecommendationsList
  describe("9. WritingRecommendationsList", () => {
    const mockRecs: WritingRecommendation[] = [
      {
        id: "rec-1",
        skill_name: "Connecteurs logiques",
        category: "Grammaire",
        level: "B2",
        title: "Exercices sur les connecteurs de concession",
        reason: "Renforcez la nuance argumentative.",
        action_url: "/practice?category=grammar",
        action_label: "S'entraîner",
      },
    ]

    it("renders recommendations with practice CTA", () => {
      const onAction = vi.fn()

      render(
        <WritingRecommendationsList
          recommendations={mockRecs}
          onActionClick={onAction}
        />
      )

      expect(
        screen.getByText("Recommandations d'entraînement personnalisées")
      ).toBeInTheDocument()
      expect(screen.getByText("Exercices sur les connecteurs de concession")).toBeInTheDocument()
      expect(screen.getByText("Renforcez la nuance argumentative.")).toBeInTheDocument()

      const ctaBtn = screen.getByRole("button", { name: /S'entraîner/i })
      fireEvent.click(ctaBtn)
      expect(onAction).toHaveBeenCalledWith(mockRecs[0])
    })
  })

  // 10. WritingResultPage Integration
  describe("10. WritingResultPage Integration", () => {
    const mockCompletedResult: WritingResultDetail = {
      attempt_id: "att-comp-1",
      submission_id: "sub-comp-1",
      status: "returned",
      word_count: 228,
      submitted_at: new Date().toISOString(),
      task: {
        id: "task-1",
        title: "Pétition contre le bruit nocturne",
        task_type: "section_b",
        prompt: "Vous écrivez pour protester contre les nuisances sonores.",
        stimulus_text: null,
        min_words: 200,
        max_words: 250,
        duration_minutes: 60,
        target_level: "B2",
      },
      content: "Monsieur le Maire,\nJe me permets de vous écrire...",
      correction: {
        id: "corr-1",
        submission_id: "sub-comp-1",
        provider: "ai",
        status: "returned",
        score: 82.0,
        estimated_level: "B2",
        task_completion: 90.0,
        coherence: 85.0,
        vocabulary: 80.0,
        grammar: 80.0,
        syntax: 80.0,
        spelling: 85.0,
        register: 80.0,
        strengths: ["Bonne tenue du registre formel"],
        weaknesses: ["Attention aux connecteurs"],
        comments: "Très bonne copie d'ensemble.",
        corrected_content: null,
        recommendations: ["Travaillez les connecteurs."],
        items: [
          {
            id: "it-1",
            correction_id: "corr-1",
            original_text: "je vous écris",
            corrected_text: "je me permets de vous écrire",
            category: "register",
            explanation: "Formulation plus élégante.",
            created_at: new Date().toISOString(),
          },
        ],
        skills: [],
        is_simulated: true,
        disclaimer: "Score d'entraînement indicatif — Non officiel TEF.",
        created_at: new Date().toISOString(),
      },
      is_simulated: true,
      disclaimer: "Score d'entraînement indicatif — Non officiel TEF.",
    }

    it("displays error state when attempt is not found", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: any) => {
        const urlStr = String(url)
        if (urlStr.includes("/analytics/events")) {
          return { ok: true, json: async () => ({}) }
        }
        if (urlStr.includes("/notifications")) {
          return { ok: true, json: async () => ({ items: [] }) }
        }
        return {
          ok: false,
          status: 404,
          json: async () => ({ detail: "Not found" }),
        }
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/writing/invalid-att/result"]}>
            <Routes>
              <Route path="/writing/:id/result" element={<WritingResultPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText(/introuvable/i)).toBeInTheDocument()
      })
      expect(screen.getByText("Retour aux rédactions")).toBeInTheDocument()
    })

    it("loads completed result, renders summary, and switches tabs", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: any) => {
        const urlStr = String(url)
        if (urlStr.includes("/analytics/events")) {
          return { ok: true, json: async () => ({}) }
        }
        if (urlStr.includes("/notifications")) {
          return { ok: true, json: async () => ({ items: [] }) }
        }
        if (urlStr.includes("/recommendations")) {
          return {
            ok: true,
            json: async () => [
              {
                id: "rec-1",
                skill_name: "Connecteurs de concession",
                category: "Grammaire",
                level: "B2",
                title: "Exercices ciblés",
                reason: "Progressez sur vos points faibles.",
              },
            ],
          }
        }
        if (urlStr.includes("/writing/attempts/att-comp-1/result")) {
          return {
            ok: true,
            status: 200,
            json: async () => mockCompletedResult,
          }
        }
        return { ok: true, json: async () => ({ items: [] }) }
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/writing/att-comp-1/result"]}>
            <Routes>
              <Route path="/writing/:id/result" element={<WritingResultPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      )

      // Verify header and summary loaded
      await waitFor(() => {
        expect(screen.getByText("Pétition contre le bruit nocturne")).toBeInTheDocument()
      })
      expect(screen.getByText("Section B (Lettre d'opinion)")).toBeInTheDocument()
      expect(screen.getByText("Correction disponible")).toBeInTheDocument()
      expect(screen.getAllByText(/B2/).length).toBeGreaterThan(0)
      expect(screen.getByText(/82/)).toBeInTheDocument()
      expect(screen.getByText("Très bonne copie d'ensemble.")).toBeInTheDocument()

      // Switch to "Corrections détaillées" tab
      const correctionsTab = screen.getByRole("button", { name: /Corrections détaillées/i })
      fireEvent.click(correctionsTab)

      await waitFor(() => {
        expect(screen.getByText("je vous écris")).toBeInTheDocument()
        expect(screen.getByText("je me permets de vous écrire")).toBeInTheDocument()
      })

      // Switch to "Votre copie" tab
      const responseTab = screen.getByRole("button", { name: /Votre copie/i })
      fireEvent.click(responseTab)

      await waitFor(() => {
        expect(screen.getByText("Votre copie soumise")).toBeInTheDocument()
        expect(screen.getByText(/Monsieur le Maire/)).toBeInTheDocument()
      })

      // Switch to "Recommandations" tab
      const recsTab = screen.getByRole("button", { name: /Recommandations/i })
      fireEvent.click(recsTab)

      await waitFor(() => {
        expect(screen.getByText("Exercices ciblés")).toBeInTheDocument()
      })
    })

    it("displays pending state when correction is not yet ready", async () => {
      const mockPendingResult: WritingResultDetail = {
        attempt_id: "att-pend-1",
        submission_id: "sub-pend-1",
        status: "in_review",
        word_count: 215,
        submitted_at: new Date().toISOString(),
        task: {
          id: "task-2",
          title: "Sujet en cours de relecture",
          task_type: "section_b",
          prompt: "Consigne du sujet...",
          stimulus_text: null,
          min_words: 200,
          max_words: 250,
          duration_minutes: 60,
          target_level: "B2",
        },
        content: "Texte en cours de relecture par le professeur...",
        correction: null,
        is_simulated: true,
        disclaimer: "Score d'entraînement indicatif — Non officiel TEF.",
      }

      globalThis.fetch = vi.fn().mockImplementation(async (url: any) => {
        const urlStr = String(url)
        if (urlStr.includes("/analytics/events")) {
          return { ok: true, json: async () => ({}) }
        }
        if (urlStr.includes("/writing/attempts/att-pend-1/result")) {
          return {
            ok: true,
            status: 200,
            json: async () => mockPendingResult,
          }
        }
        return { ok: true, json: async () => ({}) }
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/writing/att-pend-1/result"]}>
            <Routes>
              <Route path="/writing/:id/result" element={<WritingResultPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(
          screen.getByText("En attente de correction par un professeur")
        ).toBeInTheDocument()
      })
      expect(
        screen.getByText("Texte en cours de relecture par le professeur...")
      ).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Actualiser l'état/i })).toBeInTheDocument()
    })
  })
})
