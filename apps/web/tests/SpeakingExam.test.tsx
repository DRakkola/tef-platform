/**
 * Tests for the TEF Speaking Exam hook, section transitions, and exam state machine.
 */

import { renderHook, act, render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { useSpeakingExam } from "@/features/speaking/useSpeakingExam"
import { SpeakingSessionPage } from "@/features/speaking/SpeakingSessionPage"
import * as api from "@/features/speaking/api"
import type { SpeakingExam, SpeakingSessionDetail } from "@/features/speaking/types"

vi.mock("@/features/speaking/api")

const mockExam: SpeakingExam = {
  id: "exam-123",
  session_id: "session-456",
  student_id: "student-789",
  state: "created",
  level: "B2",
  title: "TEF Expression Orale — Épreuve Officielle",
  active_section: "section_a",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sections: [
    {
      id: "sec-a-1",
      exam_id: "exam-123",
      section_type: "section_a",
      sequence: 1,
      title: "Section A : Demande d'informations formelle",
      state: "pending",
      target_duration_seconds: 600,
      topic: "Cours de voile en Bretagne",
      prompt_context: "Renseignez-vous sur les tarifs et les dates.",
      created_at: new Date().toISOString(),
    },
    {
      id: "sec-b-2",
      exam_id: "exam-123",
      section_type: "section_b",
      sequence: 2,
      title: "Section B : Argumentation et persuasion",
      state: "pending",
      target_duration_seconds: 900,
      topic: "Partir en voyage humanitaire",
      prompt_context: "Convainquez votre ami(e).",
      created_at: new Date().toISOString(),
    },
  ],
}

describe("useSpeakingExam Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getSpeakingExam).mockResolvedValue(mockExam)
  })

  it("loads exam and identifies active Section A with 600s target duration", async () => {
    const { result } = renderHook(() => useSpeakingExam({ examId: "exam-123" }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.exam).toEqual(mockExam)
    expect(result.current.activeSection?.section_type).toBe("section_a")
    expect(result.current.remainingSeconds).toBe(600)
    expect(result.current.prepRemainingSeconds).toBeNull()
  })

  it("starts exam and activates Section A", async () => {
    const activeExam: SpeakingExam = {
      ...mockExam,
      state: "section_a_active",
      sections: [
        {
          ...mockExam.sections[0],
          state: "active",
          remaining_seconds: 595,
        },
        mockExam.sections[1],
      ],
    }
    vi.mocked(api.startSpeakingExam).mockResolvedValue(activeExam)

    const { result } = renderHook(() => useSpeakingExam({ examId: "exam-123" }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.start()
    })

    expect(api.startSpeakingExam).toHaveBeenCalledWith("exam-123")
    expect(result.current.exam?.state).toBe("section_a_active")
    expect(result.current.remainingSeconds).toBe(595)
  })

  it("completes Section A and enters 60-second preparation state for Section B", async () => {
    const preparingExam: SpeakingExam = {
      ...mockExam,
      state: "section_b_preparing",
      active_section: "section_b",
      sections: [
        { ...mockExam.sections[0], state: "completed" },
        { ...mockExam.sections[1], state: "pending" },
      ],
    }
    vi.mocked(api.completeSpeakingSection).mockResolvedValue(preparingExam)

    const { result } = renderHook(() => useSpeakingExam({ examId: "exam-123" }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.completeSection("section_a")
    })

    expect(api.completeSpeakingSection).toHaveBeenCalledWith("exam-123", "section_a")
    expect(result.current.exam?.state).toBe("section_b_preparing")
    expect(result.current.prepRemainingSeconds).toBe(60)
    expect(result.current.activeSection?.section_type).toBe("section_b")
  })

  it("starts Section B and sets 900s countdown timer", async () => {
    const activeBExam: SpeakingExam = {
      ...mockExam,
      state: "section_b_active",
      active_section: "section_b",
      sections: [
        { ...mockExam.sections[0], state: "completed" },
        { ...mockExam.sections[1], state: "active", remaining_seconds: 900 },
      ],
    }
    vi.mocked(api.startSpeakingSection).mockResolvedValue(activeBExam)

    const { result } = renderHook(() => useSpeakingExam({ examId: "exam-123" }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.startSectionB()
    })

    expect(api.startSpeakingSection).toHaveBeenCalledWith("exam-123", "section_b")
    expect(result.current.exam?.state).toBe("section_b_active")
    expect(result.current.prepRemainingSeconds).toBeNull()
    expect(result.current.remainingSeconds).toBe(900)
  })

  it("records conversational turns idempotently", async () => {
    const mockTurn = {
      id: "turn-1",
      section_id: "sec-a-1",
      turn_number: 1,
      speaker: "examiner" as const,
      state: "completed" as const,
      content_text: "Bonjour !",
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }
    vi.mocked(api.createSpeakingSectionTurn).mockResolvedValue(mockTurn)

    const { result } = renderHook(() => useSpeakingExam({ examId: "exam-123" }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.recordTurn({
        speaker: "examiner",
        content_text: "Bonjour !",
        duration_seconds: 2.1,
      })
    })

    expect(api.createSpeakingSectionTurn).toHaveBeenCalledWith("exam-123", "section_a", {
      speaker: "examiner",
      content_text: "Bonjour !",
      duration_seconds: 2.1,
    })
    expect(result.current.turns).toContainEqual(mockTurn)
  })
})

describe("Speaking Exam UI Integration in SpeakingSessionPage", () => {
  const mockSessionWithExam: SpeakingSessionDetail = {
    id: "session-456",
    exam_id: "exam-123",
    session_type: "ai",
    status: "active",
    topic: "Simulation Officielle TEF Expression Orale",
    level: "B2",
    duration_minutes: 25,
    starts_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 600000).toISOString(),
    remaining_seconds: 600,
    room_id: "room-exam-123",
    participants: [
      {
        id: "p1",
        display_name: "Candidat",
        role: "student",
        is_connected: true,
      },
      {
        id: "p2",
        display_name: "Examinateur Virtuel",
        role: "ai_assistant",
        is_connected: true,
      },
    ],
    ice_servers: [{ urls: "stun:stun.l.google.com:19302" }],
    created_at: new Date().toISOString(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getSpeakingSession).mockResolvedValue(mockSessionWithExam)
    vi.mocked(api.getSpeakingExam).mockResolvedValue({
      ...mockExam,
      state: "section_a_active",
      sections: [
        { ...mockExam.sections[0], state: "active", remaining_seconds: 600 },
        mockExam.sections[1],
      ],
    })
  })

  it("renders Section A badge, vouvoiement indicator, and advance button", async () => {
    const mockAudioTrack = { kind: "audio", enabled: true, stop: vi.fn() }
    const mockStream = {
      getTracks: () => [mockAudioTrack],
      getAudioTracks: () => [mockAudioTrack],
      getVideoTracks: () => [],
    }

    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
        writable: true,
        configurable: true,
      })
    } else {
      navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream)
    }

    render(
      <MemoryRouter initialEntries={["/speaking/sessions/session-456"]}>
        <Routes>
          <Route path="/speaking/sessions/:sessionId" element={<SpeakingSessionPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Accès au microphone requis")).toBeInTheDocument()
    })

    // Grant mic permission and continue to active workspace
    const authBtn = screen.getByRole("button", { name: /Autoriser le microphone/i })
    fireEvent.click(authBtn)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Rejoindre la session/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /Rejoindre la session/i }))

    await waitFor(() => {
      expect(screen.getByText("Section A · Renseignements (10 min)")).toBeInTheDocument()
      expect(screen.getByText("Vouvoiement formel")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Passer à la Section B/i })).toBeInTheDocument()
    })
  })
})
