/**
 * Comprehensive Unit and Integration Tests for the Student Active Listening Assessment Experience (/attempts/:id).
 * Tests ListeningAudioStatus, ListeningPlaybackProgress, ListeningQuestionContext,
 * ListeningPlayer, ListeningLayout, and AssessmentTakingPage listening flow.
 */

import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { ListeningAudioStatus } from "@/features/assessments/components/ListeningAudioStatus"
import {
  ListeningPlaybackProgress,
  formatAudioTime,
} from "@/features/assessments/components/ListeningPlaybackProgress"
import { ListeningQuestionContext } from "@/features/assessments/components/ListeningQuestionContext"
import { ListeningPlayer } from "@/features/assessments/components/ListeningPlayer"
import { ListeningLayout } from "@/features/assessments/components/ListeningLayout"
import { AssessmentTakingPage } from "@/features/assessments/AssessmentTakingPage"
import type { ActiveQuestionItem } from "@/features/assessments/types"

beforeEach(() => {
  vi.restoreAllMocks()
  window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve())
  window.HTMLMediaElement.prototype.pause = vi.fn()
  window.HTMLMediaElement.prototype.load = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("Student Active Listening Assessment Experience (/attempts/:id)", () => {
  // 1. ListeningAudioStatus: All 7 States
  describe("1. ListeningAudioStatus", () => {
    it("renders idle state accurately", () => {
      render(<ListeningAudioStatus status="idle" />)
      expect(screen.getByText("Prêt à écouter")).toBeInTheDocument()
    })

    it("renders loading state accurately", () => {
      render(<ListeningAudioStatus status="loading" />)
      expect(screen.getByText("Chargement de l'audio...")).toBeInTheDocument()
    })

    it("renders playing state with live pulsation", () => {
      render(<ListeningAudioStatus status="playing" />)
      expect(screen.getByText("Lecture en cours")).toBeInTheDocument()
    })

    it("renders paused state accurately", () => {
      render(<ListeningAudioStatus status="paused" />)
      expect(screen.getByText("En pause")).toBeInTheDocument()
    })

    it("renders ended state accurately", () => {
      render(<ListeningAudioStatus status="ended" />)
      expect(screen.getByText("Audio terminé")).toBeInTheDocument()
    })

    it("renders error state with retry action", () => {
      const onRetry = vi.fn()
      render(<ListeningAudioStatus status="error" onRetry={onRetry} />)
      expect(screen.getByText("Impossible de lire l'audio")).toBeInTheDocument()
      const retryBtn = screen.getByRole("button", { name: "Réessayer" })
      fireEvent.click(retryBtn)
      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it("renders unavailable state accurately", () => {
      render(<ListeningAudioStatus status="unavailable" />)
      expect(screen.getByText("Aucun enregistrement disponible")).toBeInTheDocument()
    })
  })

  // 2. ListeningPlaybackProgress: Timestamps & Seeking Rules
  describe("2. ListeningPlaybackProgress", () => {
    it("formats timestamps correctly for sub-minute and multi-minute audio", () => {
      expect(formatAudioTime(22)).toBe("00:22")
      expect(formatAudioTime(45)).toBe("00:45")
      expect(formatAudioTime(75)).toBe("01:15")
      expect(formatAudioTime(150)).toBe("02:30")
      expect(formatAudioTime(0)).toBe("00:00")

      const { rerender } = render(
        <ListeningPlaybackProgress currentTime={22} duration={45} allowSeek={false} />
      )
      expect(screen.getByText("00:22")).toBeInTheDocument()
      expect(screen.getByText("00:45")).toBeInTheDocument()

      rerender(<ListeningPlaybackProgress currentTime={75} duration={150} allowSeek={false} />)
      expect(screen.getByText("01:15")).toBeInTheDocument()
      expect(screen.getByText("02:30")).toBeInTheDocument()
    })

    it("renders non-interactive progress bar when allowSeek is false", () => {
      render(
        <ListeningPlaybackProgress currentTime={30} duration={60} allowSeek={false} />
      )
      const progressbar = screen.getByRole("progressbar")
      expect(progressbar).toHaveAttribute("aria-valuenow", "50")
      expect(screen.queryByRole("slider")).not.toBeInTheDocument()
    })

    it("allows seeking and invokes onSeek when allowSeek is true", () => {
      const onSeek = vi.fn()
      render(
        <ListeningPlaybackProgress currentTime={10} duration={100} allowSeek={true} onSeek={onSeek} />
      )
      const slider = screen.getByRole("slider", { name: "Déplacer la tête de lecture audio" })
      expect(slider).toBeInTheDocument()

      fireEvent.change(slider, { target: { value: "50" } })
      expect(onSeek).toHaveBeenCalledWith(50)
    })
  })

  // 3. ListeningQuestionContext: Modality, Rules & Shared Audio
  describe("3. ListeningQuestionContext", () => {
    it("renders modality header, section title, and instructions", () => {
      render(
        <ListeningQuestionContext
          sectionTitle="Section A - Annonces courtes"
          instructions="Écoutez attentivement le message diffusé dans la gare."
          questionNumber={3}
          totalQuestions={15}
          replayAllowed={false}
          maxPlays={1}
        />
      )

      expect(screen.getByText("Compréhension orale")).toBeInTheDocument()
      expect(screen.getByText("Section A - Annonces courtes")).toBeInTheDocument()
      expect(screen.getByText("Écoutez attentivement le message diffusé dans la gare.")).toBeInTheDocument()
      expect(screen.getByText("1 seule écoute (règle officielle)")).toBeInTheDocument()
    })

    it("renders multi-play badge when replay is allowed", () => {
      render(
        <ListeningQuestionContext
          sectionTitle="Section B - Reportages"
          instructions="Écoutez le reportage."
          questionNumber={5}
          totalQuestions={20}
          replayAllowed={true}
          playsRemaining={2}
          maxPlays={2}
        />
      )

      expect(screen.getByText("2 écoutes restantes")).toBeInTheDocument()
    })

    it("renders shared audio badge when question belongs to a shared audio group", () => {
      render(
        <ListeningQuestionContext
          sectionTitle="Section C - Débat radiophonique"
          instructions="Écoutez le débat."
          questionNumber={12}
          totalQuestions={30}
          sharedQuestionRange="Enregistrement commun • Questions 12 à 15"
          replayAllowed={false}
          maxPlays={1}
        />
      )

      expect(screen.getByText("Enregistrement commun • Questions 12 à 15")).toBeInTheDocument()
    })
  })

  // 4. ListeningPlayer: Playback Controls & Policy Enforcement
  describe("4. ListeningPlayer", () => {
    it("renders unavailable state if mediaUrl is missing", () => {
      render(<ListeningPlayer mediaUrl={null} />)
      expect(screen.getByText("Aucun enregistrement disponible")).toBeInTheDocument()
    })

    it("starts playback on play button click", async () => {
      const onStart = vi.fn()
      render(
        <ListeningPlayer
          mediaUrl="https://storage.example.com/audio/test1.mp3"
          title="Extrait 1"
          onPlaybackStart={onStart}
        />
      )

      expect(screen.getByText("Extrait 1")).toBeInTheDocument()
      expect(screen.getByText("Prêt à écouter")).toBeInTheDocument()

      const playBtn = screen.getByRole("button", { name: "Lancer l'écoute de l'enregistrement" })
      await act(async () => {
        fireEvent.click(playBtn)
      })

      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
      expect(screen.getByText("Lecture en cours")).toBeInTheDocument()
      expect(onStart).toHaveBeenCalledTimes(1)
    })

    it("pauses and resumes playback when allow_pause is true", async () => {
      const { container } = render(
        <ListeningPlayer
          mediaUrl="https://storage.example.com/audio/test2.mp3"
          playbackRules={{ allow_pause: true, allow_replay: false }}
        />
      )

      // Start playing
      const playBtn = screen.getByRole("button", { name: "Lancer l'écoute de l'enregistrement" })
      await act(async () => {
        fireEvent.click(playBtn)
      })
      expect(screen.getByText("Lecture en cours")).toBeInTheDocument()

      // Pause
      const pauseBtn = screen.getByRole("button", { name: "Mettre en pause l'écoute" })
      await act(async () => {
        fireEvent.click(pauseBtn)
      })
      expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1)
      expect(screen.getByText("En pause")).toBeInTheDocument()

      // Update time so button reflects resume state
      const audioElement = container.querySelector("audio")!
      Object.defineProperty(audioElement, "currentTime", { value: 12, writable: true })
      fireEvent.timeUpdate(audioElement)

      // Resume
      const resumeBtn = screen.getByRole("button", { name: "Reprendre l'écoute audio" })
      await act(async () => {
        fireEvent.click(resumeBtn)
      })
      expect(screen.getByText("Lecture en cours")).toBeInTheDocument()
    })

    it("locks playback permanently when single-play ends", async () => {
      const onEnd = vi.fn()
      const { container } = render(
        <ListeningPlayer
          mediaUrl="https://storage.example.com/audio/single-play.mp3"
          playbackRules={{ allow_replay: false, max_replays: 1 }}
          onPlaybackEnd={onEnd}
        />
      )

      const audioElement = container.querySelector("audio")!
      // Trigger ended event on the audio element
      await act(async () => {
        fireEvent.ended(audioElement)
      })

      expect(screen.getByText("Audio terminé")).toBeInTheDocument()
      expect(onEnd).toHaveBeenCalledTimes(1)

      // Play button should now be disabled
      const playBtn = screen.getByRole("button", { name: "Lancer l'écoute de l'enregistrement" })
      expect(playBtn).toBeDisabled()
      // No replay button should be rendered
      expect(screen.queryByRole("button", { name: /Réécouter/i })).not.toBeInTheDocument()
    })

    it("allows replay when allow_replay is true up to max_replays", async () => {
      const { container } = render(
        <ListeningPlayer
          mediaUrl="https://storage.example.com/audio/multi-play.mp3"
          playbackRules={{ allow_replay: true, max_replays: 2 }}
        />
      )

      const audioElement = container.querySelector("audio")!

      // First play ends
      await act(async () => {
        fireEvent.ended(audioElement)
      })

      // Replay button should appear with 1 replay remaining
      const replayBtn = screen.getByRole("button", { name: "Réécouter le document audio depuis le début" })
      expect(replayBtn).toBeInTheDocument()
      expect(screen.getByText("Réécouter (1)")).toBeInTheDocument()

      // Click replay
      await act(async () => {
        fireEvent.click(replayBtn)
      })
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
      expect(screen.getByText("Lecture en cours")).toBeInTheDocument()
    })

    it("stops audio immediately when exam expires or is submitted", () => {
      const { rerender } = render(
        <ListeningPlayer
          mediaUrl="https://storage.example.com/audio/test-expire.mp3"
          isExamExpired={false}
          isExamSubmitted={false}
        />
      )

      // Simulate exam expiration
      rerender(
        <ListeningPlayer
          mediaUrl="https://storage.example.com/audio/test-expire.mp3"
          isExamExpired={true}
          isExamSubmitted={false}
        />
      )

      expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled()
      expect(screen.getByText("Audio terminé")).toBeInTheDocument()
    })

    it("toggles audio mute status", () => {
      const { container } = render(
        <ListeningPlayer mediaUrl="https://storage.example.com/audio/mute.mp3" />
      )

      const audioElement = container.querySelector("audio")!
      expect(audioElement.muted).toBe(false)

      const muteBtn = screen.getByRole("button", { name: "Couper le son" })
      fireEvent.click(muteBtn)
      expect(audioElement.muted).toBe(true)

      const unmuteBtn = screen.getByRole("button", { name: "Activer le son du document audio" })
      fireEvent.click(unmuteBtn)
      expect(audioElement.muted).toBe(false)
    })

    it("cleans up audio on unmount to avoid memory leaks", () => {
      const { unmount } = render(
        <ListeningPlayer mediaUrl="https://storage.example.com/audio/unmount.mp3" />
      )
      unmount()
      expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    })
  })

  // 5. ListeningLayout: Question Rendering, Navigation & Shared Audio Range
  describe("5. ListeningLayout", () => {
    const mockQuestions: ActiveQuestionItem[] = [
      {
        question: {
          id: "q-oral-1",
          section_id: "sec-listen-1",
          prompt: "Où se déroule la scène ?",
          question_type: "single_choice",
          order_index: 1,
          level: "B2",
          difficulty: 2,
          points: 1,
          options: [
            { id: "opt-1", content: "Dans une gare", order_index: 1 },
            { id: "opt-2", content: "Dans un aéroport", order_index: 2 },
          ],
        },
        sectionIndex: 0,
        sectionTitle: "Section A - Messages courts",
        mediaUrl: "https://storage.example.com/audio/clip-1.mp3",
        instructions: "Écoutez le message audio.",
        globalIndex: 0,
      },
      {
        question: {
          id: "q-oral-2",
          section_id: "sec-listen-1",
          prompt: "Quelle est la consigne donnée aux voyageurs ?",
          question_type: "single_choice",
          order_index: 2,
          level: "B2",
          difficulty: 3,
          points: 1,
          options: [
            { id: "opt-3", content: "Changer de quai", order_index: 1 },
            { id: "opt-4", content: "Attendre le contrôleur", order_index: 2 },
          ],
        },
        sectionIndex: 0,
        sectionTitle: "Section A - Messages courts",
        mediaUrl: "https://storage.example.com/audio/clip-1.mp3",
        instructions: "Écoutez le message audio.",
        globalIndex: 1,
      },
    ]

    it("renders player, question panel, navigators, and computes shared audio badge across questions", () => {
      const onSelectOption = vi.fn()
      const onSelectQuestion = vi.fn()
      const onPrevious = vi.fn()
      const onNext = vi.fn()
      const onSubmit = vi.fn()
      const onToggleFlag = vi.fn()

      render(
        <ListeningLayout
          currentQuestionItem={mockQuestions[0]}
          activeQuestionIndex={0}
          totalQuestions={2}
          allQuestions={mockQuestions}
          answersMap={{ "q-oral-1": "opt-1" }}
          flaggedQuestions={new Set()}
          onSelectOption={onSelectOption}
          onSelectQuestion={onSelectQuestion}
          onPrevious={onPrevious}
          onNext={onNext}
          onSubmit={onSubmit}
          onToggleFlag={onToggleFlag}
          isFirstQuestion={true}
          isLastQuestion={false}
          isPaletteOpen={false}
          onClosePalette={vi.fn()}
        />
      )

      // Shared audio detection: both questions share clip-1.mp3
      expect(screen.getByText("Enregistrement commun • Questions 1 à 2")).toBeInTheDocument()
      expect(screen.getByText("Où se déroule la scène ?")).toBeInTheDocument()
      expect(screen.getByText("Dans une gare")).toBeInTheDocument()

      // Select option
      fireEvent.click(screen.getByText("Dans un aéroport"))
      expect(onSelectOption).toHaveBeenCalledWith("q-oral-1", "opt-2")

      // Next question navigation
      const nextBtn = screen.getByRole("button", { name: "Question suivante" })
      fireEvent.click(nextBtn)
      expect(onNext).toHaveBeenCalledTimes(1)
    })
  })

  // 6. AssessmentTakingPage: Full Listening Flow Integration
  describe("6. AssessmentTakingPage: Listening Exam Integration", () => {
    it("renders ListeningLayout automatically for listening assessment type", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = String(input)

        if (url.includes("/api/v1/attempts/att-listening-1/state")) {
          return {
            ok: true,
            json: async () => ({
              attempt_id: "att-listening-1",
              assessment_id: "asm-listening-1",
              status: "started",
              remaining_seconds: 2400,
              server_time: new Date().toISOString(),
              answers: {},
              answered_count: 0,
              total_questions: 1,
            }),
          } as Response
        }

        if (url === "/api/v1/attempts/att-listening-1") {
          return {
            ok: true,
            json: async () => ({
              id: "att-listening-1",
              assessment_id: "asm-listening-1",
              status: "started",
              remaining_seconds: 2400,
              answers: [],
            }),
          } as Response
        }

        if (url === "/api/v1/assessments/asm-listening-1") {
          return {
            ok: true,
            json: async () => ({
              id: "asm-listening-1",
              title: "Épreuve de Compréhension Orale TEF",
              assessment_type: "listening",
              duration_seconds: 2400,
              level: "B2",
              sections: [
                {
                  id: "sec-audio-1",
                  title: "Section A - Annonces publiques",
                  instructions: "Écoutez chaque document sonore une seule fois.",
                  media_url: "https://storage.example.com/audio/announcement.mp3",
                  questions: [
                    {
                      id: "q-audio-1",
                      section_id: "sec-audio-1",
                      prompt: "Quel train a du retard ?",
                      question_type: "single_choice",
                      order_index: 1,
                      level: "B2",
                      difficulty: 2,
                      points: 1,
                      options: [
                        { id: "opt-t1", content: "Le TGV 8421", order_index: 1 },
                        { id: "opt-t2", content: "Le TER 3410", order_index: 2 },
                      ],
                    },
                  ],
                },
              ],
            }),
          } as Response
        }

        if (url.includes("/api/v1/attempts/att-listening-1/answers/") && init?.method === "PUT") {
          return {
            ok: true,
            json: async () => ({
              id: "ans-oral-1",
              question_id: "q-audio-1",
              selected_option_id: "opt-t1",
            }),
          } as Response
        }

        return { ok: false } as Response
      })

      render(
        <MemoryRouter initialEntries={["/attempts/att-listening-1"]}>
          <Routes>
            <Route path="/attempts/:id" element={<AssessmentTakingPage />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText("Épreuve de Compréhension Orale TEF")).toBeInTheDocument()
        expect(screen.getByText("Compréhension orale")).toBeInTheDocument()
        expect(screen.getByText("Quel train a du retard ?")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Lancer l'écoute de l'enregistrement" })).toBeInTheDocument()
      })

      // Select an answer option
      const option = screen.getByText("Le TGV 8421")
      fireEvent.click(option)

      // Verify answer selection triggers update
      await waitFor(() => {
        expect(screen.getByRole("radio", { name: /Le TGV 8421/i })).toHaveAttribute("aria-checked", "true")
      })
    })
  })
})
