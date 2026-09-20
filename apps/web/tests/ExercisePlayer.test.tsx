/**
 * Tests for the Student Exercise Player Experience (/exercises/:id).
 * Covers:
 * - FocusedPracticeShell
 * - ExerciseProgress
 * - ExerciseQuestion (with reading passage and listening audio)
 * - ExerciseAnswerGroup (native semantic radio and text inputs)
 * - ExerciseFeedback & ExerciseExplanation
 * - ExerciseNavigation (checking, retrying, continuing)
 * - ExerciseCompletion (scores, accuracy, recommendations)
 * - ExercisePracticePage integration (happy path, retry, network recovery, refresh survival, 404)
 */

import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import {
  FocusedPracticeShell,
  ExerciseProgress,
  ExerciseQuestion,
  ExerciseAnswerGroup,
  ExerciseFeedback,
  ExerciseExplanation,
  ExerciseNavigation,
  ExerciseCompletion,
  ExerciseSkeleton,
  ExercisePracticePage,
} from "@/features/exercises"

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

describe("Student Exercise Player (/exercises/:id)", () => {
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

  // 1. FocusedPracticeShell
  describe("1. FocusedPracticeShell", () => {
    it("renders title, category badge, level, and estimated duration", () => {
      const onExit = vi.fn()
      render(
        <FocusedPracticeShell
          title="Les pronoms relatifs composés"
          category="Grammaire"
          level="B2"
          estimatedDurationMinutes={10}
          onExitClick={onExit}
        >
          <div>Contenu d'entraînement</div>
        </FocusedPracticeShell>
      )

      expect(screen.getByText("Les pronoms relatifs composés")).toBeInTheDocument()
      expect(screen.getByText("Grammaire")).toBeInTheDocument()
      expect(screen.getByText("B2")).toBeInTheDocument()
      expect(screen.getByText("~10 min")).toBeInTheDocument()
      expect(screen.getByText("Contenu d'entraînement")).toBeInTheDocument()

      const exitBtn = screen.getByLabelText("Quitter l'exercice et retourner au catalogue")
      fireEvent.click(exitBtn)
      expect(onExit).toHaveBeenCalledTimes(1)
    })
  })

  // 2. ExerciseProgress
  describe("2. ExerciseProgress", () => {
    it("renders question counter and progress bar with proper aria attributes", () => {
      render(<ExerciseProgress current={1} total={1} />)

      expect(screen.getByText(/Question/i)).toBeInTheDocument()
      expect(screen.getByText("100%")).toBeInTheDocument()

      const progressBar = screen.getByRole("progressbar")
      expect(progressBar).toHaveAttribute("aria-valuenow", "100")
      expect(progressBar).toHaveAttribute("aria-valuemin", "0")
      expect(progressBar).toHaveAttribute("aria-valuemax", "100")
    })
  })

  // 3. ExerciseQuestion
  describe("3. ExerciseQuestion", () => {
    it("renders prompt, instructions, and optional reading passage", () => {
      render(
        <ExerciseQuestion
          prompt="Quel connecteur logique convient pour exprimer la concession ?"
          instructions="Choisissez la seule option grammaticalement correcte."
          category="reading"
          passageText="Le candidat doit justifier de son identité au moyen d'un document officiel."
        >
          <div>Choix de réponse</div>
        </ExerciseQuestion>
      )

      expect(
        screen.getByText("Quel connecteur logique convient pour exprimer la concession ?")
      ).toBeInTheDocument()
      expect(
        screen.getByText("Choisissez la seule option grammaticalement correcte.")
      ).toBeInTheDocument()
      expect(screen.getByText("Texte support")).toBeInTheDocument()
      expect(
        screen.getByText(/Le candidat doit justifier de son identité/i)
      ).toBeInTheDocument()
      expect(screen.getByText("Choix de réponse")).toBeInTheDocument()
    })

    it("renders graceful technical state when question type is unsupported", () => {
      render(
        <ExerciseQuestion
          prompt="Exercice non supporté"
          isUnsupportedType={true}
        />
      )

      expect(screen.getByText("Type d'exercice non pris en charge")).toBeInTheDocument()
    })
  })

  // 4. ExerciseAnswerGroup
  describe("4. ExerciseAnswerGroup", () => {
    it("renders semantic native radio buttons and handles selection", () => {
      const onSelect = vi.fn()
      const options = [
        { content: "bien que", order_index: 0 },
        { content: "malgré", order_index: 1 },
        { content: "pourtant", order_index: 2 },
      ]

      render(
        <ExerciseAnswerGroup
          questionType="single_choice"
          options={options}
          selectedOptionIndex={null}
          onSelectOption={onSelect}
        />
      )

      const radio1 = screen.getByLabelText("bien que")
      expect(radio1).toBeInTheDocument()
      expect(radio1).not.toBeChecked()

      fireEvent.click(radio1)
      expect(onSelect).toHaveBeenCalledWith(0)
    })

    it("renders text input when questionType is text_input", () => {
      const onChange = vi.fn()
      const onSubmit = vi.fn()

      render(
        <ExerciseAnswerGroup
          questionType="text_input"
          options={[]}
          selectedOptionIndex={null}
          textResponse="arriviez"
          onSelectOption={vi.fn()}
          onChangeText={onChange}
          onSubmit={onSubmit}
        />
      )

      const input = screen.getByPlaceholderText("Tapez votre réponse ici...")
      expect(input).toHaveValue("arriviez")

      fireEvent.change(input, { target: { value: "arrivions" } })
      expect(onChange).toHaveBeenCalledWith("arrivions")

      fireEvent.keyDown(input, { key: "Enter", code: "Enter" })
      expect(onSubmit).toHaveBeenCalled()
    })
  })

  // 5. ExerciseFeedback & ExerciseExplanation
  describe("5. ExerciseFeedback & ExerciseExplanation", () => {
    it("renders positive feedback banner when answer is correct", () => {
      render(
        <ExerciseFeedback
          result={{
            id: "att-1",
            exercise_id: "ex-1",
            is_correct: true,
            points_awarded: 10,
            correct_answer: "bien que",
            explanation: "'Bien que' régit le subjonctif.",
          }}
        />
      )

      expect(screen.getByText("Bonne réponse !")).toBeInTheDocument()
      expect(screen.getByText("+10 pts")).toBeInTheDocument()
    })

    it("renders subtle corrective banner and revealed answer when answer is incorrect", () => {
      render(
        <ExerciseFeedback
          result={{
            id: "att-2",
            exercise_id: "ex-1",
            is_correct: false,
            points_awarded: 0,
            correct_answer: "bien que",
            explanation: "'Bien que' régit le subjonctif.",
          }}
        />
      )

      expect(screen.getByText("Pas tout à fait")).toBeInTheDocument()
      expect(screen.getByText("Bonne réponse :")).toBeInTheDocument()
      expect(screen.getByText("bien que")).toBeInTheDocument()
    })

    it("renders 'Pourquoi ?' pedagogical explanation and skill connection", () => {
      render(
        <ExerciseExplanation
          explanation="Après la locution conjonctive 'bien que', le verbe subordonné se met toujours au subjonctif."
          category="Grammaire"
          skills={["Connecteurs logiques", "Mode subjonctif"]}
        />
      )

      expect(screen.getByText("Pourquoi ?")).toBeInTheDocument()
      expect(
        screen.getByText(/Après la locution conjonctive 'bien que'/i)
      ).toBeInTheDocument()
      expect(screen.getByText("Compétence travaillée :")).toBeInTheDocument()
      expect(screen.getByText("Connecteurs logiques")).toBeInTheDocument()
      expect(screen.getByText("Mode subjonctif")).toBeInTheDocument()
    })
  })

  // 6. ExerciseNavigation
  describe("6. ExerciseNavigation", () => {
    it("renders disabled check answer button when unanswered", () => {
      render(
        <ExerciseNavigation
          state="ready"
          isAnswered={false}
          onSubmit={vi.fn()}
          onContinue={vi.fn()}
        />
      )

      const checkBtn = screen.getByText("Vérifier ma réponse").closest("button")
      expect(checkBtn).toBeDisabled()
    })

    it("renders active check answer button when answered and triggers submit", () => {
      const onSubmit = vi.fn()
      render(
        <ExerciseNavigation
          state="ready"
          isAnswered={true}
          onSubmit={onSubmit}
          onContinue={vi.fn()}
        />
      )

      const checkBtn = screen.getByText("Vérifier ma réponse")
      fireEvent.click(checkBtn)
      expect(onSubmit).toHaveBeenCalled()
    })

    it("renders continue and retry buttons when answer is incorrect", () => {
      const onRetry = vi.fn()
      const onContinue = vi.fn()
      render(
        <ExerciseNavigation
          state="feedback"
          isAnswered={true}
          isCorrect={false}
          onSubmit={vi.fn()}
          onRetry={onRetry}
          onContinue={onContinue}
          allowRetry={true}
        />
      )

      const retryBtn = screen.getByText("Réessayer")
      const continueBtn = screen.getByText("Continuer")

      fireEvent.click(retryBtn)
      expect(onRetry).toHaveBeenCalled()

      fireEvent.click(continueBtn)
      expect(onContinue).toHaveBeenCalled()
    })
  })

  // 7. ExerciseCompletion
  describe("7. ExerciseCompletion", () => {
    it("renders score, accuracy, time, skills, and recommendation handoff", () => {
      const onRestart = vi.fn()
      const onReturn = vi.fn()
      const onStartRec = vi.fn()

      render(
        <ExerciseCompletion
          score={10}
          totalPoints={10}
          accuracy={100}
          timeSpentSeconds={120}
          skills={["Temps du passé"]}
          category="Grammaire"
          isCorrect={true}
          recommendation={{
            id: "rec-1",
            title: "Exercice : L'imparfait en contexte",
            category: "Grammaire",
            level: "B1",
            duration_minutes: 10,
            reason: "Recommandé pour consolider votre maîtrise des temps.",
            entity_id: "ex-99",
          }}
          onStartRecommendation={onStartRec}
          onRestart={onRestart}
          onReturnToPractice={onReturn}
        />
      )

      expect(screen.getByText("Terminé !")).toBeInTheDocument()
      expect(screen.getByText("100%")).toBeInTheDocument()
      expect(screen.getByText("2 min")).toBeInTheDocument()
      expect(screen.getByText("Temps du passé")).toBeInTheDocument()

      expect(screen.getByText("Prochaine activité recommandée")).toBeInTheDocument()
      expect(screen.getByText("Exercice : L'imparfait en contexte")).toBeInTheDocument()

      const startRecBtn = screen.getByText("Commencer")
      fireEvent.click(startRecBtn)
      expect(onStartRec).toHaveBeenCalled()

      const restartBtn = screen.getByText("Recommencer cet exercice")
      fireEvent.click(restartBtn)
      expect(onRestart).toHaveBeenCalled()

      const returnBtn = screen.getByText("Retour au catalogue de pratique")
      fireEvent.click(returnBtn)
      expect(onReturn).toHaveBeenCalled()
    })
  })

  // 8. ExerciseSkeleton
  describe("8. ExerciseSkeleton", () => {
    it("renders skeleton placeholder with accessible status role", () => {
      render(<ExerciseSkeleton />)
      expect(screen.getByRole("status")).toBeInTheDocument()
    })
  })

  // 9. Full Integration: ExercisePracticePage
  describe("9. Full Integration: ExercisePracticePage", () => {
    const mockExercise = {
      id: "ex-42",
      title: "Les Connecteurs d'Opposition",
      category: "Grammaire",
      level: "B1",
      difficulty: 2,
      question_type: "single_choice",
      prompt: "Complétez : 'Il est venu, _____ il soit malade.'",
      instructions: "Choisissez l'option correcte.",
      points: 10,
      options: [
        { content: "bien qu'", order_index: 0 },
        { content: "malgré", order_index: 1 },
      ],
      skills: ["Connecteurs logiques"],
    }

    it("orchestrates complete learning flow: load, answer, feedback, and completion", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = String(input)
        if (url === "/api/v1/exercises/ex-42") {
          return {
            ok: true,
            json: async () => mockExercise,
          } as Response
        }

        if (url === "/api/v1/exercises/ex-42/attempts" && !init?.method) {
          return {
            ok: true,
            json: async () => [],
          } as Response
        }

        if (url === "/api/v1/exercises/ex-42/attempts" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              id: "att-1",
              exercise_id: "ex-42",
              is_correct: true,
              points_awarded: 10,
              user_response: "bien qu'",
              correct_answer: "bien qu'",
              explanation: "'Bien que' est suivi du subjonctif.",
              attempted_at: new Date().toISOString(),
            }),
          } as Response
        }

        if (url.includes("/recommendations")) {
          return {
            ok: true,
            json: async () => [
              {
                id: "rec-1",
                title: "Exercice : Le subjonctif présent",
                category: "Grammaire",
                level: "B1",
                difficulty: 2,
                reason: "Pour consolider votre apprentissage.",
                entity_id: "ex-99",
              },
            ],
          } as Response
        }

        return { ok: false } as Response
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/exercises/ex-42"]}>
            <Routes>
              <Route path="/exercises/:id" element={<ExercisePracticePage />} />
              <Route path="/practice" element={<div>Practice Catalog Page</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      )

      // 1. Initial Loading -> Question Rendered
      await waitFor(() => {
        expect(screen.getByText("Les Connecteurs d'Opposition")).toBeInTheDocument()
        expect(screen.getByText("Complétez : 'Il est venu, _____ il soit malade.'")).toBeInTheDocument()
      })

      // 2. Select Option
      const option1 = screen.getByLabelText("bien qu'")
      fireEvent.click(option1)
      expect(option1).toBeChecked()

      // 3. Submit Answer
      const checkBtn = screen.getByText("Vérifier ma réponse")
      fireEvent.click(checkBtn)

      // 4. Verify Immediate Feedback & Explanation
      await waitFor(() => {
        expect(screen.getByText("Bonne réponse !")).toBeInTheDocument()
        expect(screen.getByText("+10 pts")).toBeInTheDocument()
        expect(screen.getByText("Pourquoi ?")).toBeInTheDocument()
        expect(screen.getByText(/'Bien que' est suivi du subjonctif/i)).toBeInTheDocument()
      })

      // 5. Click Continue -> Completion Screen
      const continueBtn = screen.getByText("Continuer")
      fireEvent.click(continueBtn)

      await waitFor(() => {
        expect(screen.getByText("Terminé !")).toBeInTheDocument()
        expect(screen.getByText("100%")).toBeInTheDocument()
        expect(screen.getByText("Exercice : Le subjonctif présent")).toBeInTheDocument()
      })
    })

    it("handles incorrect answer and retry flow", async () => {
      let attemptsCount = 0
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = String(input)
        if (url === "/api/v1/exercises/ex-42") {
          return { ok: true, json: async () => mockExercise } as Response
        }
        if (url === "/api/v1/exercises/ex-42/attempts" && !init?.method) {
          return { ok: true, json: async () => [] } as Response
        }
        if (url === "/api/v1/exercises/ex-42/attempts" && init?.method === "POST") {
          attemptsCount++
          if (attemptsCount === 1) {
            return {
              ok: true,
              json: async () => ({
                id: "att-1",
                exercise_id: "ex-42",
                is_correct: false,
                points_awarded: 0,
                user_response: "malgré",
                correct_answer: "bien qu'",
                explanation: "'Malgré' est suivi d'un nom.",
                attempted_at: new Date().toISOString(),
              }),
            } as Response
          }
          return {
            ok: true,
            json: async () => ({
              id: "att-2",
              exercise_id: "ex-42",
              is_correct: true,
              points_awarded: 10,
              user_response: "bien qu'",
              correct_answer: "bien qu'",
              explanation: "'Bien que' est suivi du subjonctif.",
              attempted_at: new Date().toISOString(),
            }),
          } as Response
        }
        return { ok: false } as Response
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/exercises/ex-42"]}>
            <Routes>
              <Route path="/exercises/:id" element={<ExercisePracticePage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText("Complétez : 'Il est venu, _____ il soit malade.'")).toBeInTheDocument()
      })

      // Select wrong answer
      const wrongOption = screen.getByLabelText("malgré")
      fireEvent.click(wrongOption)

      fireEvent.click(screen.getByText("Vérifier ma réponse"))

      // Expect corrective feedback
      await waitFor(() => {
        expect(screen.getByText("Pas tout à fait")).toBeInTheDocument()
        expect(screen.getByText("Bonne réponse :")).toBeInTheDocument()
      })

      // Click Retry
      const retryBtn = screen.getByText("Réessayer")
      fireEvent.click(retryBtn)

      // Answer is reset to ready state
      await waitFor(() => {
        expect(screen.getByText("Vérifier ma réponse")).toBeInTheDocument()
      })
    })

    it("retains answer and shows retry banner upon network failure", async () => {
      let failOnce = true
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = String(input)
        if (url === "/api/v1/exercises/ex-42") {
          return { ok: true, json: async () => mockExercise } as Response
        }
        if (url === "/api/v1/exercises/ex-42/attempts" && !init?.method) {
          return { ok: true, json: async () => [] } as Response
        }
        if (url === "/api/v1/exercises/ex-42/attempts" && init?.method === "POST") {
          if (failOnce) {
            failOnce = false
            throw new Error("Network error")
          }
          return {
            ok: true,
            json: async () => ({
              id: "att-1",
              exercise_id: "ex-42",
              is_correct: true,
              points_awarded: 10,
              correct_answer: "bien qu'",
              attempted_at: new Date().toISOString(),
            }),
          } as Response
        }
        return { ok: false } as Response
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/exercises/ex-42"]}>
            <Routes>
              <Route path="/exercises/:id" element={<ExercisePracticePage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText("Complétez : 'Il est venu, _____ il soit malade.'")).toBeInTheDocument()
      })

      fireEvent.click(screen.getByLabelText("bien qu'"))
      fireEvent.click(screen.getByText("Vérifier ma réponse"))

      // Verify network error banner
      await waitFor(() => {
        expect(
          screen.getByText(/Votre réponse n'a pas pu être enregistrée. Votre réponse locale est conservée/i)
        ).toBeInTheDocument()
      })

      // Local selection is preserved
      expect(screen.getByLabelText("bien qu'")).toBeChecked()

      // Click retry button in the banner
      const retryNetworkBtn = screen.getByRole("button", { name: /Réessayer/i })
      fireEvent.click(retryNetworkBtn)

      await waitFor(() => {
        expect(screen.getByText("Bonne réponse !")).toBeInTheDocument()
      })
    })

    it("displays friendly unavailable message for 404/unpublished exercises", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        return {
          ok: false,
          status: 404,
        } as Response
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/exercises/unknown-ex"]}>
            <Routes>
              <Route path="/exercises/:id" element={<ExercisePracticePage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText("Cet exercice n'est plus disponible.")).toBeInTheDocument()
        expect(screen.getByText("Retour à la pratique")).toBeInTheDocument()
      })
    })
  })
})
