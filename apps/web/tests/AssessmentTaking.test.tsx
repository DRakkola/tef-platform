/**
 * Comprehensive Unit and Integration Tests for the Student Active Reading Assessment Experience (/attempts/:id).
 * Tests ExamTimer, ExamProgress, SaveStatus, ReadingPassage, AnswerOption, AnswerGroup,
 * QuestionRenderer, QuestionNavigator, SubmitAssessmentDialog, and AssessmentTakingPage.
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { ExamTimer, formatTime } from "@/features/assessments/components/ExamTimer"
import { ExamProgress } from "@/features/assessments/components/ExamProgress"
import { SaveStatus } from "@/features/assessments/components/SaveStatus"
import { ExamConnectionStatus } from "@/features/assessments/components/ExamConnectionStatus"
import { ReadingPassage } from "@/features/assessments/components/ReadingPassage"
import { AnswerOption } from "@/features/assessments/components/AnswerOption"
import { AnswerGroup } from "@/features/assessments/components/AnswerGroup"
import { QuestionRenderer } from "@/features/assessments/components/QuestionRenderer"
import { QuestionNavigator } from "@/features/assessments/components/QuestionNavigator"
import { SubmitAssessmentDialog } from "@/features/assessments/components/SubmitAssessmentDialog"
import { AssessmentTakingPage } from "@/features/assessments/AssessmentTakingPage"
import type { QuestionStudent, ActiveQuestionItem } from "@/features/assessments/types"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("Student Active Reading Assessment Experience (/attempts/:id)", () => {
  // 1. ExamTimer Formatting & Thresholds
  it("1. ExamTimer: formats time accurately across hours, minutes, seconds and handles expiration", () => {
    expect(formatTime(3600)).toBe("01:00:00")
    expect(formatTime(4472)).toBe("01:14:32")
    expect(formatTime(2400)).toBe("40:00")
    expect(formatTime(59)).toBe("00:59")
    expect(formatTime(0)).toBe("00:00")

    const { rerender } = render(<ExamTimer remainingSeconds={2400} severity="normal" />)
    expect(screen.getByText("40:00")).toBeInTheDocument()

    // Warning state (< 5 min)
    rerender(<ExamTimer remainingSeconds={280} severity="warning" />)
    expect(screen.getByText("04:40")).toBeInTheDocument()

    // Critical state (< 60s)
    rerender(<ExamTimer remainingSeconds={45} severity="critical" />)
    expect(screen.getByText("00:45")).toBeInTheDocument()

    // Expired state
    rerender(<ExamTimer remainingSeconds={0} severity="expired" />)
    expect(screen.getByText("Temps écoulé")).toBeInTheDocument()
  })

  // 2. ExamProgress
  it("2. ExamProgress: displays question index, answered count, and accessible progress bar", () => {
    render(<ExamProgress questionNumber={12} totalQuestions={40} answeredCount={10} />)

    expect(screen.getByText("Question 12 / 40")).toBeInTheDocument()
    expect(screen.getByText("10 répondues")).toBeInTheDocument()
    const progressbar = screen.getByRole("progressbar")
    expect(progressbar).toHaveAttribute("aria-valuenow", "25")
  })

  // 3. SaveStatus
  it("3. SaveStatus: indicates saved, saving, offline, and error synchronization states", () => {
    const { rerender } = render(<SaveStatus status="saved" isOnline={true} />)
    expect(screen.getByText("Réponses sécurisées")).toBeInTheDocument()

    rerender(<SaveStatus status="saving" isOnline={true} />)
    expect(screen.getByText("Enregistrement...")).toBeInTheDocument()

    rerender(<SaveStatus status="offline" isOnline={false} />)
    expect(screen.getByText("Stockage local actif")).toBeInTheDocument()

    const onRetry = vi.fn()
    rerender(<SaveStatus status="error" isOnline={true} onRetry={onRetry} />)
    expect(screen.getByText("Erreur de sauvegarde")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Réessayer"))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  // 4. ExamConnectionStatus
  it("4. ExamConnectionStatus: renders alert banner when offline and hides when online", () => {
    const onCheck = vi.fn()
    const { rerender } = render(
      <ExamConnectionStatus isOnline={false} onCheckConnection={onCheck} />
    )

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText(/Connexion interrompue/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Vérifier/i }))
    expect(onCheck).toHaveBeenCalledTimes(1)

    rerender(<ExamConnectionStatus isOnline={true} onCheckConnection={onCheck} />)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  // 5. ReadingPassage
  it("5. ReadingPassage: formats reading text with paragraphs and displays metadata", () => {
    const passage = "Premier paragraphe explicatif.\n\nDeuxième paragraphe argumentatif avec détails."
    render(
      <ReadingPassage
        passageText={passage}
        sectionTitle="Section A - Documents courts"
        instructions="Lisez attentivement le texte."
      />
    )

    expect(screen.getByText("Document de lecture associé")).toBeInTheDocument()
    expect(screen.getByText("Section A - Documents courts")).toBeInTheDocument()
    expect(screen.getByText("Lisez attentivement le texte.")).toBeInTheDocument()
    expect(screen.getByText("Premier paragraphe explicatif.")).toBeInTheDocument()
    expect(screen.getByText("Deuxième paragraphe argumentatif avec détails.")).toBeInTheDocument()
  })

  // 6. AnswerOption & AnswerGroup
  it("6. AnswerOption & AnswerGroup: provides accessible radio selection and keyboard navigation", () => {
    const options = [
      { id: "opt-1", content: "Première proposition", order_index: 1 },
      { id: "opt-2", content: "Deuxième proposition", order_index: 2 },
      { id: "opt-3", content: "Troisième proposition", order_index: 3 },
    ]
    const onSelect = vi.fn()

    render(
      <AnswerGroup
        questionId="q-test"
        prompt="Quelle est la proposition exacte ?"
        options={options}
        selectedOptionId="opt-2"
        onSelect={onSelect}
      />
    )

    const opt1 = screen.getByRole("radio", { name: /Première proposition/i })
    const opt2 = screen.getByRole("radio", { name: /Deuxième proposition/i })

    expect(opt1).toHaveAttribute("aria-checked", "false")
    expect(opt2).toHaveAttribute("aria-checked", "true")

    fireEvent.click(opt1)
    expect(onSelect).toHaveBeenCalledWith("opt-1")

    // Keyboard navigation
    const radiogroup = screen.getByRole("radiogroup")
    fireEvent.keyDown(radiogroup, { key: "ArrowDown" })
    expect(onSelect).toHaveBeenCalledWith("opt-3")
  })

  // 7. QuestionRenderer
  it("7. QuestionRenderer: renders single_choice, multiple_choice, text_input, and fallback", () => {
    const questionSingle: QuestionStudent = {
      id: "q-single",
      section_id: "sec-1",
      prompt: "Choix unique",
      question_type: "single_choice",
      order_index: 1,
      level: "B2",
      difficulty: 2,
      points: 1,
      options: [{ id: "opt-a", content: "Option A", order_index: 1 }],
    }
    const onChange = vi.fn()

    const { rerender } = render(
      <QuestionRenderer question={questionSingle} value="opt-a" onChange={onChange} />
    )
    expect(screen.getByRole("radio", { name: /Option A/i })).toBeInTheDocument()

    // Multiple choice
    const questionMulti: QuestionStudent = {
      ...questionSingle,
      id: "q-multi",
      prompt: "Choix multiple",
      question_type: "multiple_choice",
      options: [{ id: "opt-m1", content: "Option Multiple 1", order_index: 1 }],
    }
    rerender(<QuestionRenderer question={questionMulti} value={["opt-m1"]} onChange={onChange} />)
    expect(screen.getByRole("checkbox", { name: /Option Multiple 1/i })).toBeInTheDocument()

    // Text input
    const questionText: QuestionStudent = {
      ...questionSingle,
      id: "q-text",
      prompt: "Saisie de texte",
      question_type: "text_input",
      options: [],
    }
    rerender(<QuestionRenderer question={questionText} value="Réponse rédigée" onChange={onChange} />)
    expect(screen.getByPlaceholderText(/Saisissez votre réponse ici/i)).toBeInTheDocument()
    expect(screen.getByText("15 caractères")).toBeInTheDocument()

    // Unsupported type
    const questionUnknown: QuestionStudent = {
      ...questionSingle,
      id: "q-unknown",
      question_type: "unsupported_type",
      options: [],
    }
    rerender(<QuestionRenderer question={questionUnknown} value={null} onChange={onChange} />)
    expect(screen.getByText("Type de question non pris en charge")).toBeInTheDocument()
  })

  // 8. QuestionNavigator
  it("8. QuestionNavigator: shows answered, unanswered, flagged and active states with accessible navigation", () => {
    const questions: ActiveQuestionItem[] = [
      {
        question: {
          id: "q-1",
          section_id: "sec-1",
          prompt: "Question 1",
          question_type: "single_choice",
          order_index: 1,
          level: "B2",
          difficulty: 2,
          points: 1,
          options: [],
        },
        sectionIndex: 0,
        sectionTitle: "Section 1",
        globalIndex: 0,
      },
      {
        question: {
          id: "q-2",
          section_id: "sec-1",
          prompt: "Question 2",
          question_type: "single_choice",
          order_index: 2,
          level: "B2",
          difficulty: 2,
          points: 1,
          options: [],
        },
        sectionIndex: 0,
        sectionTitle: "Section 1",
        globalIndex: 1,
      },
    ]

    const onSelect = vi.fn()
    const flagged = new Set(["q-2"])

    render(
      <QuestionNavigator
        allQuestions={questions}
        activeQuestionIndex={0}
        answersMap={{ "q-1": "opt-x" }}
        flaggedQuestions={flagged}
        onSelectQuestion={onSelect}
      />
    )

    expect(screen.getByText("1 / 2 (50%)")).toBeInTheDocument()
    const btn1 = screen.getByRole("button", { name: /Question 1, répondue, active/i })
    const btn2 = screen.getByRole("button", { name: /Question 2, non répondue, marquée pour relecture/i })

    expect(btn1).toBeInTheDocument()
    expect(btn2).toBeInTheDocument()

    fireEvent.click(btn2)
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  // 9. SubmitAssessmentDialog
  it("9. SubmitAssessmentDialog: details answered vs unanswered counts and executes confirmation", () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()

    render(
      <SubmitAssessmentDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        isSubmitting={false}
        answeredCount={28}
        totalQuestions={40}
      />
    )

    expect(screen.getByText("Confirmer la soumission finale ?")).toBeInTheDocument()
    expect(screen.getByText("12 questions sans réponse.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Reprendre l'épreuve" }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole("button", { name: "Confirmer et soumettre" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  // 10. AssessmentTakingPage: Full orchestration and navigation
  it("10. AssessmentTakingPage: orchestrates full reading session, flagging, and navigation", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input)
      if (url === "/api/v1/attempts/att-taking-1/state") {
        return {
          ok: true,
          json: async () => ({
            attempt_id: "att-taking-1",
            assessment_id: "asmt-taking-1",
            user_id: "usr-1",
            student_id: "usr-1",
            status: "started",
            server_time: new Date().toISOString(),
            remaining_seconds: 3600,
            is_expired: false,
            answered_count: 0,
            total_questions: 2,
            answers: {},
          }),
        } as Response
      }

      if (url === "/api/v1/attempts/att-taking-1") {
        return {
          ok: true,
          json: async () => ({
            id: "att-taking-1",
            assessment_id: "asmt-taking-1",
            status: "started",
            remaining_seconds: 3600,
            answers: [],
          }),
        } as Response
      }

      if (url === "/api/v1/assessments/asmt-taking-1") {
        return {
          ok: true,
          json: async () => ({
            id: "asmt-taking-1",
            title: "Simulation TEF Compréhension Écrite B2",
            assessment_type: "reading",
            duration_seconds: 3600,
            estimated_completion_time_minutes: 60,
            level: "B2",
            navigation_policy: "free",
            sections: [
              {
                id: "sec-1",
                assessment_id: "asmt-taking-1",
                title: "Section A",
                passage_text: "Document à lire pour la question 1.",
                order_index: 1,
                questions: [
                  {
                    id: "q-1",
                    section_id: "sec-1",
                    prompt: "Quel est l'objectif du document ?",
                    question_type: "single_choice",
                    order_index: 1,
                    level: "B2",
                    difficulty: 2,
                    points: 1,
                    options: [
                      { id: "opt-1", content: "Informer le lecteur", order_index: 1 },
                      { id: "opt-2", content: "Divertir", order_index: 2 },
                    ],
                  },
                  {
                    id: "q-2",
                    section_id: "sec-1",
                    prompt: "Deuxième question de la section ?",
                    question_type: "single_choice",
                    order_index: 2,
                    level: "B2",
                    difficulty: 3,
                    points: 1,
                    options: [{ id: "opt-3", content: "Option 3", order_index: 1 }],
                  },
                ],
              },
            ],
          }),
        } as Response
      }

      if (url.includes("/api/v1/attempts/att-taking-1/answers/") && init?.method === "PUT") {
        return {
          ok: true,
          json: async () => ({
            id: "ans-1",
            question_id: "q-1",
            selected_option_id: "opt-1",
          }),
        } as Response
      }

      return { ok: false } as Response
    })

    render(
      <MemoryRouter initialEntries={["/attempts/att-taking-1"]}>
        <Routes>
          <Route path="/attempts/:id" element={<AssessmentTakingPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Simulation TEF Compréhension Écrite B2")).toBeInTheDocument()
      expect(screen.getByText("Document à lire pour la question 1.")).toBeInTheDocument()
      expect(screen.getByText("Quel est l'objectif du document ?")).toBeInTheDocument()
    })

    // Select option
    const option = screen.getByText("Informer le lecteur")
    fireEvent.click(option)

    // Flag question
    const flagBtn = screen.getByRole("button", { name: "Marquer pour relecture" })
    fireEvent.click(flagBtn)
    expect(screen.getByRole("button", { name: "Question marquée pour relecture" })).toBeInTheDocument()

    // Next question
    const nextBtn = screen.getByRole("button", { name: "Question suivante" })
    fireEvent.click(nextBtn)

    await waitFor(() => {
      expect(screen.getByText("Deuxième question de la section ?")).toBeInTheDocument()
    })

    // Previous question
    const prevBtn = screen.getByRole("button", { name: "Question précédente" })
    fireEvent.click(prevBtn)

    await waitFor(() => {
      expect(screen.getByText("Quel est l'objectif du document ?")).toBeInTheDocument()
    })
  })

  // 11. Already submitted attempt handling
  it("11. AssessmentTakingPage: handles already submitted attempt gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes("/state")) {
        return {
          ok: true,
          json: async () => ({
            attempt_id: "att-done",
            status: "submitted",
          }),
        } as Response
      }
      return { ok: false } as Response
    })

    render(
      <MemoryRouter initialEntries={["/attempts/att-done"]}>
        <Routes>
          <Route path="/attempts/:id" element={<AssessmentTakingPage />} />
          <Route path="/attempts/:id/results" element={<div>Results View</div>} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Cette évaluation est terminée")).toBeInTheDocument()
    })

    const viewResultsBtn = screen.getByRole("button", { name: "Voir le résultat" })
    fireEvent.click(viewResultsBtn)

    await waitFor(() => {
      expect(screen.getByText("Results View")).toBeInTheDocument()
    })
  })

  // 12. Expired attempt handling
  it("12. AssessmentTakingPage: handles expired attempt gracefully with results CTA", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes("/state")) {
        return {
          ok: true,
          json: async () => ({
            attempt_id: "att-expired",
            status: "expired",
            is_expired: true,
          }),
        } as Response
      }
      return { ok: false } as Response
    })

    render(
      <MemoryRouter initialEntries={["/attempts/att-expired"]}>
        <Routes>
          <Route path="/attempts/:id" element={<AssessmentTakingPage />} />
          <Route path="/attempts/:id/results" element={<div>Results View</div>} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Temps écoulé")).toBeInTheDocument()
    })

    const viewResultsBtn = screen.getByRole("button", { name: "Voir le résultat" })
    fireEvent.click(viewResultsBtn)

    await waitFor(() => {
      expect(screen.getByText("Results View")).toBeInTheDocument()
    })
  })
})
