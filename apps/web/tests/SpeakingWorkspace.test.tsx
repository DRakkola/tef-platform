/**
 * Test suite for Student Speaking Workspace & Real-Time Speaking Experience.
 * Verifies microphone permissions, server-authoritative countdown timer,
 * WebRTC audio states, AI vs. Teacher participants, turn-taking, and completion.
 */

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { SpeakingSessionPage } from "@/features/speaking/SpeakingSessionPage"
import { SpeakingTimer } from "@/features/speaking/components/SpeakingTimer"
import { SessionConnectionStatus } from "@/features/speaking/components/SessionConnectionStatus"
import { MicrophonePermission } from "@/features/speaking/components/MicrophonePermission"
import { MicrophoneControl } from "@/features/speaking/components/MicrophoneControl"
import { AudioLevelIndicator } from "@/features/speaking/components/AudioLevelIndicator"
import { SpeakingParticipant } from "@/features/speaking/components/SpeakingParticipant"
import { SpeakingPrompt } from "@/features/speaking/components/SpeakingPrompt"
import { SpeakingTurnIndicator } from "@/features/speaking/components/SpeakingTurnIndicator"
import { SpeakingControls } from "@/features/speaking/components/SpeakingControls"
import { LeaveSpeakingDialog } from "@/features/speaking/components/LeaveSpeakingDialog"
import { SpeakingSessionComplete } from "@/features/speaking/components/SpeakingSessionComplete"
import type { SpeakingSessionDetail, SpeakingEvaluation } from "@/features/speaking/types"

describe("Speaking Workspace Unit & Component Tests", () => {
  describe("SpeakingTimer", () => {
    it("renders normal countdown timer with formatted minutes and seconds", () => {
      render(<SpeakingTimer remainingSeconds={1458} />)
      expect(screen.getByRole("timer")).toHaveTextContent("24:18")
    })

    it("displays warning state when remaining seconds is under 5 minutes", () => {
      render(<SpeakingTimer remainingSeconds={290} />)
      const timer = screen.getByRole("timer")
      expect(timer).toHaveTextContent("04:50")
      expect(timer.className).toContain("text-amber-600")
    })

    it("displays critical state when remaining seconds is under 1 minute", () => {
      render(<SpeakingTimer remainingSeconds={45} />)
      const timer = screen.getByRole("timer")
      expect(timer).toHaveTextContent("00:45")
      expect(timer.className).toContain("text-destructive")
    })

    it("displays 00:00 when remaining time is 0 or expired", () => {
      render(<SpeakingTimer remainingSeconds={0} />)
      const timer = screen.getByRole("timer")
      expect(timer).toHaveTextContent("00:00")
      expect(timer.className).toContain("bg-destructive")
    })
  })

  describe("SessionConnectionStatus", () => {
    it("renders connecting state", () => {
      render(<SessionConnectionStatus connectionState="connecting" />)
      expect(screen.getByRole("status")).toHaveTextContent("Connexion...")
    })

    it("renders connected state", () => {
      render(<SessionConnectionStatus connectionState="connected" />)
      expect(screen.getByRole("status")).toHaveTextContent("Connecté")
    })

    it("renders reconnecting state when isReconnecting is true", () => {
      render(<SessionConnectionStatus connectionState="reconnecting" isReconnecting={true} />)
      expect(screen.getByRole("status")).toHaveTextContent("Reconnexion...")
    })

    it("renders failed state", () => {
      render(<SessionConnectionStatus connectionState="failed" />)
      expect(screen.getByRole("status")).toHaveTextContent("Connexion perdue")
    })
  })

  describe("MicrophonePermission", () => {
    it("renders request state and triggers callback on click", async () => {
      const onRequest = vi.fn().mockResolvedValue(true)
      const onContinue = vi.fn()

      render(
        <MicrophonePermission
          hasPermission={null}
          onRequestPermission={onRequest}
          onContinue={onContinue}
        />
      )

      expect(screen.getByText("Accès au microphone requis")).toBeInTheDocument()
      const button = screen.getByRole("button", { name: /Autoriser le microphone/i })
      fireEvent.click(button)
      expect(onRequest).toHaveBeenCalledTimes(1)
    })

    it("renders denied state with clear browser recovery steps", () => {
      const onRequest = vi.fn().mockResolvedValue(false)
      const onContinue = vi.fn()

      render(
        <MicrophonePermission
          hasPermission={false}
          onRequestPermission={onRequest}
          onContinue={onContinue}
        />
      )

      expect(screen.getByText("Autorisation microphone refusée")).toBeInTheDocument()
      expect(screen.getByText(/Comment réactiver votre microphone/i)).toBeInTheDocument()
      expect(screen.getByText(/Cliquez sur l'icône de cadenas/i)).toBeInTheDocument()
    })

    it("renders granted state with continue button", () => {
      const onRequest = vi.fn().mockResolvedValue(true)
      const onContinue = vi.fn()

      render(
        <MicrophonePermission
          hasPermission={true}
          onRequestPermission={onRequest}
          onContinue={onContinue}
        />
      )

      expect(screen.getByText("Microphone activé et validé")).toBeInTheDocument()
      const continueBtn = screen.getByRole("button", { name: /Rejoindre la session/i })
      fireEvent.click(continueBtn)
      expect(onContinue).toHaveBeenCalledTimes(1)
    })
  })

  describe("MicrophoneControl & AudioLevelIndicator", () => {
    it("toggles mute state and updates label", () => {
      const onToggle = vi.fn()
      const { rerender } = render(<MicrophoneControl isMuted={false} onToggleMute={onToggle} />)

      expect(screen.getByRole("button")).toHaveTextContent("Microphone actif")
      fireEvent.click(screen.getByRole("button"))
      expect(onToggle).toHaveBeenCalledTimes(1)

      rerender(<MicrophoneControl isMuted={true} onToggleMute={onToggle} />)
      expect(screen.getByRole("button")).toHaveTextContent("Microphone coupé")
    })

    it("renders audio level indicator detecting sound", () => {
      render(<AudioLevelIndicator level={60} isMuted={false} showCheckText />)
      expect(screen.getByRole("status")).toHaveTextContent("Nous entendons votre microphone.")
    })
  })

  describe("SpeakingParticipant & TurnTaking", () => {
    it("renders AI participant with states and turn indicator", () => {
      render(
        <div>
          <SpeakingParticipant sessionType="ai" aiState="speaking" activeTurn="ai" />
          <SpeakingTurnIndicator sessionType="ai" activeTurn="ai" isMicMuted={false} />
        </div>
      )

      expect(screen.getByText("Examinateur Virtuel TEF")).toBeInTheDocument()
      expect(screen.getByText("L'examinateur parle... Écoutez attentivement")).toBeInTheDocument()
    })

    it("renders student turn clearly in AI mode", () => {
      render(
        <div>
          <SpeakingParticipant sessionType="ai" aiState="listening" activeTurn="student" />
          <SpeakingTurnIndicator sessionType="ai" activeTurn="student" isMicMuted={false} />
        </div>
      )

      expect(screen.getByText("À votre écoute...")).toBeInTheDocument()
      expect(screen.getByText(/À vous de parler · Votre micro est actif/i)).toBeInTheDocument()
    })

    it("renders Teacher participant with name and does not render artificial turn banner", () => {
      const teacher = {
        id: "teach-1",
        role: "teacher" as const,
        display_name: "Professeur Pierre",
        is_connected: true,
      }

      render(
        <div>
          <SpeakingParticipant sessionType="teacher" participant={teacher} />
          <SpeakingTurnIndicator sessionType="teacher" activeTurn="student" isMicMuted={false} />
        </div>
      )

      expect(screen.getByText("Professeur Pierre")).toBeInTheDocument()
      expect(screen.getByText("Examinateur certifié TEF")).toBeInTheDocument()
      expect(screen.getByText("En ligne")).toBeInTheDocument()
      // No turn indicator in teacher mode
      expect(screen.queryByText(/À vous de parler/i)).not.toBeInTheDocument()
    })
  })

  describe("LeaveSpeakingDialog", () => {
    it("handles leave confirmation modal open, close, and confirm", () => {
      const onClose = vi.fn()
      const onConfirm = vi.fn()

      render(
        <LeaveSpeakingDialog
          isOpen={true}
          onClose={onClose}
          onConfirmLeave={onConfirm}
          isTeacherSession={false}
        />
      )

      expect(screen.getByText("Quitter la session d'expression orale ?")).toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: /Poursuivre la session/i }))
      expect(onClose).toHaveBeenCalled()

      fireEvent.click(screen.getByRole("button", { name: /Quitter la session/i }))
      expect(onConfirm).toHaveBeenCalled()
    })
  })

  describe("SpeakingSessionComplete", () => {
    it("renders final diagnostic evaluation results with CEFR level and criteria", () => {
      const mockEval: SpeakingEvaluation = {
        id: "eval-1",
        session_id: "sess-1",
        student_id: "stud-1",
        evaluator_type: "mock",
        estimated_level: "B2",
        fluency: 75,
        vocabulary: 78,
        grammar: 72,
        coherence: 76,
        pronunciation: 74,
        overall_score: 75,
        strengths: ["Bonne aisance communicative", "Vocabulaire varié"],
        weaknesses: ["Attention aux accords"],
        recommendations: ["S'entraîner au subjonctif"],
        detailed_feedback: "Très bonne prestation orale globale.",
        is_official_tef: false,
        created_at: new Date().toISOString(),
      }

      render(
        <MemoryRouter>
          <SpeakingSessionComplete evaluation={mockEval} isExpired={false} />
        </MemoryRouter>
      )

      expect(screen.getByText("Session terminée avec succès")).toBeInTheDocument()
      expect(screen.getByText("B2")).toBeInTheDocument()
      expect(screen.getByText("75/100")).toBeInTheDocument()
      expect(screen.getByText(/Non officiel TEF/i)).toBeInTheDocument()
      expect(screen.getByText("75%")).toBeInTheDocument() // Fluency
      expect(screen.getByText("78%")).toBeInTheDocument() // Vocab
      expect(screen.getByText("Bonne aisance communicative")).toBeInTheDocument()
      expect(screen.getByText("S'entraîner au subjonctif")).toBeInTheDocument()
      expect(screen.getByText("Très bonne prestation orale globale.")).toBeInTheDocument()
    })
  })
})

describe("Speaking Workspace Integration & Journey Tests", () => {
  let originalFetch: typeof globalThis.fetch
  let originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia

  beforeEach(() => {
    originalFetch = globalThis.fetch
    localStorage.setItem("auth_token", "test-bearer-token")

    // Mock getUserMedia
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        value: {},
        writable: true,
      })
    }
    originalGetUserMedia = navigator.mediaDevices.getUserMedia
    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [
        {
          kind: "audio",
          enabled: true,
          stop: vi.fn(),
        },
      ],
      getAudioTracks: () => [
        {
          kind: "audio",
          enabled: true,
          stop: vi.fn(),
        },
      ],
      getVideoTracks: () => [],
    } as unknown as MediaStream)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalGetUserMedia) {
      navigator.mediaDevices.getUserMedia = originalGetUserMedia
    }
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("renders launcher on /speaking with quick start and session list", async () => {
    const mockSessions = [
      {
        id: "sess-100",
        session_type: "ai" as const,
        status: "active" as const,
        topic: "TEF Section A Simulation",
        level: "B2",
        duration_minutes: 25,
        room_id: "room-100",
        participants: [],
        created_at: new Date().toISOString(),
      },
    ]

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/speaking/sessions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: mockSessions, total: 1 }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }) as any

    render(
      <MemoryRouter initialEntries={["/speaking"]}>
        <Routes>
          <Route path="/speaking" element={<SpeakingSessionPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Speaking Workspace")).toBeInTheDocument()
      expect(screen.getByText("Nouvelle Simulation")).toBeInTheDocument()
      expect(screen.getByText("TEF Section A Simulation")).toBeInTheDocument()
    })
  })

  it("loads active session on /speaking/sessions/:sessionId with prompt, timer, and controls", async () => {
    const scheduledSession: SpeakingSessionDetail = {
      id: "sess-200",
      session_type: "ai",
      status: "scheduled",
      topic: "TEF Expression Orale — Section A (Prise d'information)",
      level: "B2",
      duration_minutes: 25,
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 1500 * 1000).toISOString(),
      remaining_seconds: 1500,
      room_id: "room-200",
      ice_servers: [{ urls: "stun:stun.l.google.com:19302" }],
      participants: [
        {
          id: "part-1",
          role: "student",
          display_name: "Candidat",
          is_connected: true,
        },
        {
          id: "part-2",
          role: "ai_assistant",
          display_name: "Examinateur Virtuel TEF",
          is_connected: true,
        },
      ],
      created_at: new Date().toISOString(),
    }

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/speaking/sessions/sess-200/start")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...scheduledSession,
              status: "active",
              starts_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 1500 * 1000).toISOString(),
              remaining_seconds: 1500,
            }),
        })
      }
      if (url.includes("/speaking/sessions/sess-200")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(scheduledSession),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }) as any

    render(
      <MemoryRouter initialEntries={["/speaking/sessions/sess-200"]}>
        <Routes>
          <Route path="/speaking/sessions/:sessionId" element={<SpeakingSessionPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Pre-session mic check view renders
    await waitFor(() => {
      expect(screen.getByText("Accès au microphone requis")).toBeInTheDocument()
    })

    // Grant permission
    const authorizeBtn = screen.getByRole("button", { name: /Autoriser le microphone/i })
    await act(async () => {
      fireEvent.click(authorizeBtn)
    })

    await waitFor(() => {
      expect(screen.getByText("Microphone activé et validé")).toBeInTheDocument()
    })

    // Join session
    const joinBtn = screen.getByRole("button", { name: /Rejoindre la session/i })
    await act(async () => {
      fireEvent.click(joinBtn)
    })

    // Active workspace renders
    await waitFor(() => {
      expect(screen.getAllByText("TEF Expression Orale — Section A (Prise d'information)")[0]).toBeInTheDocument()
      expect(screen.getByText("Examinateur Virtuel TEF")).toBeInTheDocument()
      expect(screen.getAllByRole("button", { name: /Couper le micro/i })[0]).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Terminer l'entretien/i })).toBeInTheDocument()
    })
  })
})
