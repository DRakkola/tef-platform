/**
 * Tests for the Student Writing Workspace Experience (/writing/tasks/:id).
 * Covers:
 * - countWords French examination word counter & elision rules
 * - WritingWordCount live badge and compliance statuses
 * - WritingInstructionsPanel official prompt and grading criteria
 * - WritingEditor textarea, tab indentation, anti-copy UX friction, read-only
 * - SubmitWritingDialog confirmation and AI vs Teacher correction selection
 * - WritingExitDialog server-authoritative timer warning
 * - WritingSkeleton two-pane layout loader
 * - WritingEditorPage end-to-end page integration (active exam, autosave, submission, 404)
 */

import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

import {
  countWords,
  getWordCountCategory,
  getWordCountStatusMessage,
  WritingWordCount,
  WritingInstructionsPanel,
  WritingEditor,
  SubmitWritingDialog,
  WritingExitDialog,
  WritingSkeleton,
  WritingEditorPage,
} from "@/features/writing"
import type { WritingTaskDetail, WritingAttempt } from "@/features/writing"

describe("Student Writing Workspace (/writing/tasks/:id)", () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  // 1. Word Counter Utility (French Examination Rules)
  describe("1. countWords & French Examination Rules", () => {
    it("returns 0 for empty or whitespace-only strings", () => {
      expect(countWords("")).toBe(0)
      expect(countWords("   \n\t  ")).toBe(0)
    })

    it("splits French elisions with straight or curly apostrophes", () => {
      // d'accord -> d' + accord = 2
      expect(countWords("d'accord")).toBe(2)
      // l’eau -> l' + eau = 2
      expect(countWords("l’eau")).toBe(2)
      // j'ai -> j' + ai = 2
      expect(countWords("j'ai")).toBe(2)
      // qu'il -> qu' + il = 2
      expect(countWords("qu'il")).toBe(2)
      // aujourd'hui -> aujourd' + hui = 2
      expect(countWords("aujourd'hui")).toBe(2)
    })

    it("treats hyphenated compound words as a single word", () => {
      // socio-économique = 1
      expect(countWords("socio-économique")).toBe(1)
      // peut-être = 1
      expect(countWords("peut-être")).toBe(1)
      // c'est-à-dire -> c' + est-à-dire = 2
      expect(countWords("c'est-à-dire")).toBe(2)
      // va-t-il -> va + t + il = 3 in hyphen sequence regex
      expect(countWords("rendez-vous")).toBe(1)
    })

    it("correctly counts complex French sentences with accents", () => {
      const sentence = "L'élève a déclaré : « J'adore la langue française et son histoire ! »"
      // Tokens: L' (1), élève (1), a (1), déclaré (1), J' (1), adore (1), la (1), langue (1), française (1), et (1), son (1), histoire (1) = 12 words
      expect(countWords(sentence)).toBe(12)
    })

    it("determines word count categories and messages accurately", () => {
      expect(getWordCountCategory(150, 200, 250)).toBe("below_min")
      expect(getWordCountCategory(220, 200, 250)).toBe("in_range")
      expect(getWordCountCategory(280, 200, 250)).toBe("above_max")

      expect(getWordCountStatusMessage(150, 200, 250)).toContain("Encore 50 mots")
      expect(getWordCountStatusMessage(220, 200, 250)).toContain("Longueur conforme")
      expect(getWordCountStatusMessage(280, 200, 250)).toContain("30 mots au-delà")
    })
  })

  // 2. WritingWordCount Component
  describe("2. WritingWordCount", () => {
    it("renders word count and target range with accessible status", () => {
      const { rerender } = render(
        <WritingWordCount wordCount={180} minWords={200} maxWords={250} />
      )

      expect(screen.getByRole("status")).toHaveAttribute(
        "aria-label",
        expect.stringContaining("180 mots")
      )
      expect(screen.getByText("180 / 200-250 mots")).toBeInTheDocument()

      // In range
      rerender(<WritingWordCount wordCount={225} minWords={200} maxWords={250} />)
      expect(screen.getByText("225 / 200-250 mots")).toBeInTheDocument()

      // Above max
      rerender(<WritingWordCount wordCount={270} minWords={200} maxWords={250} />)
      expect(screen.getByText("270 / 200-250 mots")).toBeInTheDocument()
    })
  })

  // 3. WritingInstructionsPanel Component
  describe("3. WritingInstructionsPanel", () => {
    const mockTask: WritingTaskDetail = {
      id: "task-1",
      title: "Lettre d'opinion formelle",
      task_type: "section_b",
      prompt: "Exprimez votre avis sur l'interdiction de la circulation automobile.",
      stimulus_text: "Article extrait du journal Le Monde du 12 mai 2024.",
      min_words: 200,
      max_words: 250,
      duration_minutes: 60,
      target_level: "B2",
    }

    it("renders task prompt, stimulus text, target word count, and official criteria", () => {
      render(<WritingInstructionsPanel task={mockTask} />)

      expect(screen.getByText("Consigne officielle TEF")).toBeInTheDocument()
      expect(screen.getByText("Section B (Lettre d'opinion formelle)")).toBeInTheDocument()
      expect(screen.getByText(/200 à 250 mots/)).toBeInTheDocument()
      expect(screen.getByText("Article extrait du journal Le Monde du 12 mai 2024.")).toBeInTheDocument()
      expect(screen.getByText("Exprimez votre avis sur l'interdiction de la circulation automobile.")).toBeInTheDocument()
      expect(screen.getByText("Critères d'évaluation officiels :")).toBeInTheDocument()
    })

    it("toggles mobile view when toggle button is clicked", () => {
      render(<WritingInstructionsPanel task={mockTask} />)
      const toggleBtn = screen.getByLabelText("Réduire les consignes")
      expect(toggleBtn).toBeInTheDocument()
      fireEvent.click(toggleBtn)
      expect(screen.getByLabelText("Afficher les consignes")).toBeInTheDocument()
    })
  })

  // 4. WritingEditor Component
  describe("4. WritingEditor", () => {
    it("renders textarea and handles input change", () => {
      const onChange = vi.fn()
      render(
        <WritingEditor
          content="Bonjour,"
          onChange={onChange}
          wordCount={1}
          minWords={200}
          maxWords={250}
          saveStatus="saved"
        />
      )

      const textarea = screen.getByLabelText("Rédigez votre réponse écrite")
      expect(textarea).toHaveValue("Bonjour,")

      fireEvent.change(textarea, { target: { value: "Bonjour Monsieur le Maire," } })
      expect(onChange).toHaveBeenCalledWith("Bonjour Monsieur le Maire,")
    })

    it("intercepts paste with UX friction notice when anti-copy is enabled", () => {
      const onChange = vi.fn()
      render(
        <WritingEditor
          content=""
          onChange={onChange}
          wordCount={0}
          minWords={200}
          maxWords={250}
          saveStatus="saved"
          enableAntiCopy={true}
        />
      )

      const textarea = screen.getByLabelText("Rédigez votre réponse écrite")
      fireEvent.paste(textarea, { clipboardData: { getData: () => "Texte copié" } })

      expect(
        screen.getByText(/Le copier-coller est désactivé pendant cette simulation d'épreuve/i)
      ).toBeInTheDocument()
    })

    it("handles tab key by inserting 4 spaces", () => {
      const onChange = vi.fn()
      render(
        <WritingEditor
          content="Début"
          onChange={onChange}
          wordCount={1}
          minWords={200}
          maxWords={250}
          saveStatus="saved"
        />
      )

      const textarea = screen.getByLabelText("Rédigez votre réponse écrite")
      fireEvent.keyDown(textarea, { key: "Tab" })
      expect(onChange).toHaveBeenCalledWith("    Début")
    })

    it("disables editing and shows read-only banner in read-only mode", () => {
      render(
        <WritingEditor
          content="Copie finale soumise."
          onChange={vi.fn()}
          wordCount={3}
          minWords={200}
          maxWords={250}
          saveStatus="saved"
          isReadOnly={true}
        />
      )

      const textarea = screen.getByLabelText("Rédigez votre réponse écrite")
      expect(textarea).toHaveAttribute("readonly")
      expect(
        screen.getByText(/Cette copie est verrouillée en lecture seule/i)
      ).toBeInTheDocument()
    })

    it("displays appropriate save status indicators", () => {
      const { rerender } = render(
        <WritingEditor
          content=""
          onChange={vi.fn()}
          wordCount={0}
          minWords={200}
          maxWords={250}
          saveStatus="saving"
        />
      )
      expect(screen.getByText("Enregistrement...")).toBeInTheDocument()

      rerender(
        <WritingEditor
          content=""
          onChange={vi.fn()}
          wordCount={0}
          minWords={200}
          maxWords={250}
          saveStatus="offline"
        />
      )
      expect(screen.getByText("Hors ligne (brouillon local)")).toBeInTheDocument()

      rerender(
        <WritingEditor
          content=""
          onChange={vi.fn()}
          wordCount={0}
          minWords={200}
          maxWords={250}
          saveStatus="error"
        />
      )
      expect(screen.getByText("Erreur de sauvegarde")).toBeInTheDocument()
    })
  })

  // 5. SubmitWritingDialog Component
  describe("5. SubmitWritingDialog", () => {
    it("renders compliance info, remaining time, and allows choosing correction mode", () => {
      const onSelectCorrection = vi.fn()
      const onSubmit = vi.fn()

      render(
        <SubmitWritingDialog
          open={true}
          onOpenChange={vi.fn()}
          wordCount={215}
          minWords={200}
          maxWords={250}
          remainingSeconds={1800}
          correctionType="ai"
          onSelectCorrectionType={onSelectCorrection}
          onSubmit={onSubmit}
          isSubmitting={false}
        />
      )

      expect(screen.getByText("Confirmer la soumission de votre écrit")).toBeInTheDocument()
      expect(screen.getByText(/215 mots/)).toBeInTheDocument()
      expect(screen.getByText("30:00")).toBeInTheDocument()
      expect(screen.getByText("Évaluation IA")).toBeInTheDocument()
      expect(screen.getByText("Professeur certifié")).toBeInTheDocument()

      // Select teacher correction
      fireEvent.click(screen.getByText("Professeur certifié"))
      expect(onSelectCorrection).toHaveBeenCalledWith("teacher")

      // Submit
      const submitBtn = screen.getByRole("button", { name: "Confirmer et soumettre" })
      fireEvent.click(submitBtn)
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it("renders success state after submission", () => {
      const onViewSubmissions = vi.fn()
      render(
        <SubmitWritingDialog
          open={true}
          onOpenChange={vi.fn()}
          wordCount={215}
          minWords={200}
          maxWords={250}
          remainingSeconds={1800}
          correctionType="ai"
          onSelectCorrectionType={vi.fn()}
          onSubmit={vi.fn()}
          isSubmitting={false}
          submitSuccess={true}
          onViewSubmissions={onViewSubmissions}
        />
      )

      expect(screen.getByText("Essai soumis avec succès !")).toBeInTheDocument()
      expect(screen.getByText(/L'évaluation indicative par IA sera disponible/i)).toBeInTheDocument()

      const viewBtn = screen.getByRole("button", { name: "Voir mes soumissions d'écriture" })
      fireEvent.click(viewBtn)
      expect(onViewSubmissions).toHaveBeenCalledTimes(1)
    })
  })

  // 6. WritingExitDialog Component
  describe("6. WritingExitDialog", () => {
    it("warns candidate about server timer and allows exiting or staying", () => {
      const onConfirmExit = vi.fn()
      const onOpenChange = vi.fn()

      render(
        <WritingExitDialog
          open={true}
          onOpenChange={onOpenChange}
          onConfirmExit={onConfirmExit}
        />
      )

      expect(screen.getByText("Quitter l'épreuve d'écriture ?")).toBeInTheDocument()
      expect(screen.getByText(/le compte à rebours continue de s'écouler/i)).toBeInTheDocument()

      const stayBtn = screen.getByRole("button", { name: "Poursuivre la rédaction" })
      fireEvent.click(stayBtn)
      expect(onOpenChange).toHaveBeenCalledWith(false)

      const exitBtn = screen.getByRole("button", { name: "Quitter maintenant" })
      fireEvent.click(exitBtn)
      expect(onConfirmExit).toHaveBeenCalledTimes(1)
    })
  })

  // 7. WritingSkeleton Component
  describe("7. WritingSkeleton", () => {
    it("renders loading skeletons for both panes", () => {
      render(<WritingSkeleton />)
      expect(screen.getByLabelText("Chargement de l'espace de rédaction")).toBeInTheDocument()
    })
  })

  // 8. WritingEditorPage Integration Flow
  describe("8. WritingEditorPage Integration", () => {
    const mockTask: WritingTaskDetail = {
      id: "task-abc",
      title: "Lettre au maire sur la piétonnisation",
      task_type: "section_b",
      prompt: "Rédigez une lettre de doléance constructive au maire de votre ville.",
      stimulus_text: null,
      min_words: 200,
      max_words: 250,
      duration_minutes: 60,
      target_level: "B2",
    }

    const mockAttempt: WritingAttempt = {
      id: "attempt-xyz",
      task_id: "task-abc",
      status: "draft",
      content: "Monsieur le Maire, Je vous écris concernant...",
      word_count: 7,
      current_revision: 1,
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      remaining_seconds: 3600,
    }

    it("displays error screen if task fetch returns 404", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: any) => {
        const urlStr = String(url)
        if (urlStr.includes("/analytics/events")) {
          return { ok: true, status: 200, json: async () => ({}) }
        }
        return {
          ok: false,
          status: 404,
          json: async () => ({ detail: "Not found" }),
        }
      })

      render(
        <MemoryRouter initialEntries={["/writing/tasks/invalid-task"]}>
          <Routes>
            <Route path="/writing/tasks/:id" element={<WritingEditorPage />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByText("Cette épreuve d'écriture n'est plus disponible.")
        ).toBeInTheDocument()
      })
      expect(screen.getByText("Retour aux entraînements")).toBeInTheDocument()
    })

    it("loads task and active attempt, mounts editor, and allows submission", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: any, options: any) => {
        const urlStr = String(url)
        if (urlStr.includes("/analytics/events")) {
          return { ok: true, status: 200, json: async () => ({}) }
        }
        if (urlStr.endsWith("/submit")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: "sub-123",
              attempt_id: "attempt-xyz",
              task_id: "task-abc",
              user_id: "user-1",
              status: "submitted",
              word_count: 8,
              submitted_at: new Date().toISOString(),
            }),
          }
        }
        if (options?.method === "PUT") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ...mockAttempt,
              current_revision: 2,
            }),
          }
        }
        if (options?.method === "POST" && urlStr.includes("/attempts")) {
          return {
            ok: true,
            status: 200,
            json: async () => mockAttempt,
          }
        }
        if (urlStr.includes("/tasks/task-abc")) {
          return {
            ok: true,
            status: 200,
            json: async () => mockTask,
          }
        }
        return { ok: true, status: 200, json: async () => ({}) }
      })

      render(
        <MemoryRouter initialEntries={["/writing/tasks/task-abc"]}>
          <Routes>
            <Route path="/writing/tasks/:id" element={<WritingEditorPage />} />
          </Routes>
        </MemoryRouter>
      )

      // Verify task loaded
      await waitFor(() => {
        expect(screen.getByText("Lettre au maire sur la piétonnisation")).toBeInTheDocument()
      })
      expect(screen.getByText("Section B")).toBeInTheDocument()
      expect(screen.getByText("Consigne officielle TEF")).toBeInTheDocument()

      const textarea = screen.getByLabelText("Rédigez votre réponse écrite")
      expect(textarea).toHaveValue("Monsieur le Maire, Je vous écris concernant...")

      // Open submit modal
      const submitTopBtn = screen.getByRole("button", { name: "Soumettre" })
      fireEvent.click(submitTopBtn)

      expect(screen.getByText("Confirmer la soumission de votre écrit")).toBeInTheDocument()

      // Confirm submit
      const confirmSubmitBtn = screen.getByRole("button", { name: "Confirmer et soumettre" })
      fireEvent.click(confirmSubmitBtn)

      await waitFor(() => {
        expect(screen.getByText("Essai soumis avec succès !")).toBeInTheDocument()
      })
    })

    it("opens exit dialog when clicking 'Quitter' button", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: any, options: any) => {
        const urlStr = String(url)
        if (urlStr.includes("/analytics/events")) {
          return { ok: true, status: 200, json: async () => ({}) }
        }
        if (options?.method === "POST" && urlStr.includes("/attempts")) {
          return {
            ok: true,
            status: 200,
            json: async () => mockAttempt,
          }
        }
        if (urlStr.includes("/tasks/task-abc")) {
          return {
            ok: true,
            status: 200,
            json: async () => mockTask,
          }
        }
        return { ok: true, status: 200, json: async () => ({}) }
      })

      render(
        <MemoryRouter initialEntries={["/writing/tasks/task-abc"]}>
          <Routes>
            <Route path="/writing/tasks/:id" element={<WritingEditorPage />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText("Lettre au maire sur la piétonnisation")).toBeInTheDocument()
      })

      const exitBtn = screen.getByRole("button", { name: /Quitter/i })
      fireEvent.click(exitBtn)

      expect(screen.getByText("Quitter l'épreuve d'écriture ?")).toBeInTheDocument()
      expect(screen.getByText("Poursuivre la rédaction")).toBeInTheDocument()
    })
  })
})
