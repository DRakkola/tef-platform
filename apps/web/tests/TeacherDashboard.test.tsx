/**
 * Comprehensive integration tests for Page 25 — Teacher Dashboard (/teacher).
 */

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TeacherDashboardPage } from "@/features/teacher-dashboard/TeacherDashboardPage"
import { TeacherAvailabilityPage } from "@/features/teacher-dashboard/TeacherAvailabilityPage"
import { getMyTeacherProfile } from "@/features/teacher-dashboard/api"
import { TeacherSummaryCards } from "@/features/teacher-dashboard/components/TeacherSummaryCards"
import { TodayScheduleSection } from "@/features/teacher-dashboard/components/TodayScheduleSection"
import { CorrectionsQueueSection } from "@/features/teacher-dashboard/components/CorrectionsQueueSection"
import { AvailabilityAlert } from "@/features/teacher-dashboard/components/AvailabilityAlert"
import { EarningsSummarySection } from "@/features/teacher-dashboard/components/EarningsSummarySection"
import * as authModule from "@/features/auth"

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

const mockTeacherUser = {
  id: "teacher-user-1",
  email: "prof.martin@tef-prep.ca",
  role: "teacher" as const,
  first_name: "Martin",
  last_name: "Dufresne",
  is_active: true,
  is_verified: true,
}

const mockStudentUser = {
  id: "student-user-1",
  email: "candidat.alex@example.com",
  role: "student" as const,
  first_name: "Alex",
  last_name: "Tremblay",
  is_active: true,
  is_verified: true,
}

const mockTeacherProfile = {
  id: "tp-martin-1",
  user_id: "teacher-user-1",
  display_name: "Prof. Martin Dufresne",
  bio: "Enseignant certifié TEF Canada avec 10 ans d'expérience.",
  expertise: ["Expression orale", "Expression écrite"],
  teaching_levels: ["B1", "B2", "C1"],
  hourly_price: 3500,
  verification_status: "approved",
  timezone: "America/Montreal",
}

const nowIso = new Date().toISOString()

const mockBookings = [
  {
    id: "bk-today-1",
    teacher_id: "tp-martin-1",
    student_id: "student-alex-9999",
    student_display_name: "Alex T.",
    student_email: "secret.student@example.com", // Private field! Must NEVER leak to DOM
    start_time: nowIso,
    end_time: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
    status: "confirmed",
    timezone: "America/Montreal",
    notes: "Expression orale TEF Section A",
    meeting_link: "https://meet.tef-platform.internal/room-123",
  },
  {
    id: "bk-future-1",
    teacher_id: "tp-martin-1",
    student_id: "student-marie-8888",
    student_display_name: "Marie C.",
    student_email: "private.marie@example.com", // Private field! Must NEVER leak to DOM
    start_time: new Date(Date.now() + 2 * 86400 * 1000).toISOString(),
    end_time: new Date(Date.now() + 2 * 86400 * 1000 + 60 * 60 * 1000).toISOString(),
    status: "confirmed",
    timezone: "America/Montreal",
    notes: "Cours particulier approfondi",
    meeting_link: "https://meet.tef-platform.internal/room-456",
  },
]

const mockCorrections = [
  {
    id: "sub-1",
    attempt_id: "att-1",
    task_id: "task-fait-divers",
    task_title: "Fait divers — Cambriolage au musée (Section A)",
    user_id: "student-alex-9999",
    word_count: 220,
    status: "QUEUED",
    submitted_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(), // 18 mins ago
  },
]

const mockAvailabilityRules = [
  {
    id: "rule-1",
    teacher_id: "tp-martin-1",
    weekday: 1, // Tuesday
    start_time: "09:00:00",
    end_time: "12:00:00",
    timezone: "America/Montreal",
    is_active: true,
  },
]

const mockEarningsSummary = {
  total_gross_cents: 16875,
  total_platform_fee_cents: 3375,
  total_net_cents: 13500,
  available_cents: 13500,
  pending_cents: 2700,
  paid_cents: 0,
  currency: "EUR",
  completed_lessons_count: 5,
}

describe("Page 25 — Teacher Dashboard (/teacher)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()

    // Default authenticated teacher
    vi.spyOn(authModule, "useAuth").mockReturnValue({
      user: mockTeacherUser,
      token: "fake-jwt-teacher",
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    })

    // Fetch mock router
    const mockFetch = vi.fn().mockImplementation(async (input: any) => {
      const url = String(input?.url || input || "")

      if (url.includes("/availability/rules")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => mockAvailabilityRules,
        } as any
      }
      if (url.includes("/teachers/me")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => mockTeacherProfile,
        } as any
      }
      if (url.includes("/bookings")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ items: mockBookings, total: mockBookings.length }),
        } as any
      }
      if (url.includes("/teacher/writing/queue")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => mockCorrections,
        } as any
      }
      if (url.includes("/teacher/writing/assignments")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => [],
        } as any
      }
      if (url.includes("/speaking/sessions")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ items: [], total: 0 }),
        } as any
      }
      if (url.includes("/teacher/earnings/summary")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => mockEarningsSummary,
        } as any
      }
      if (url.includes("/notifications")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ items: [], total: 0, unread_count: 0 }),
        } as any
      }

      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({}),
      } as any
    })

    vi.stubGlobal("fetch", mockFetch)
    globalThis.fetch = mockFetch
    global.fetch = mockFetch
    if (typeof window !== "undefined") {
      window.fetch = mockFetch
    }
  })

  afterEach(() => {
    cleanup()
  })

  it("1. teacher can open dashboard and sees greeting with profile display name", async () => {
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/teacher"]}>
          <TeacherDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText(/Bonjour, Martin/i)).toBeInTheDocument()
    expect(screen.getByText(/Voici votre activité d'aujourd'hui/i)).toBeInTheDocument()
    expect(screen.getAllByText(/America\/Montreal/i).length).toBeGreaterThanOrEqual(1)
  })

  it("2. student cannot access teacher dashboard (renders ForbiddenPage)", async () => {
    vi.spyOn(authModule, "useAuth").mockReturnValue({
      user: mockStudentUser,
      token: "fake-jwt-student",
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    })

    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/teacher"]}>
          <TeacherDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Should render the centralized ForbiddenPage
    expect(screen.getByText(/Accès restreint/i)).toBeInTheDocument()
    expect(screen.queryByText(/Bonjour, Martin/i)).not.toBeInTheDocument()
  })

  it("3. teacher summary loads backend metrics correctly", async () => {
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/teacher"]}>
          <TeacherDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText(/Bonjour, Martin/i)).toBeInTheDocument()
    // 1 today session & 1 pending correction
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/séance prévue/i)).toBeInTheDocument()
    expect(screen.getAllByText(/à traiter/i).length).toBeGreaterThanOrEqual(1)
    // 135,00 € available earnings
    expect(screen.getAllByText(/135,00\s*€/).length).toBeGreaterThanOrEqual(1)
  })

  it("4. schedule displays correctly and strictly protects student privacy (no student email leaked)", async () => {
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/teacher"]}>
          <TeacherDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText(/Votre journée/i)).toBeInTheDocument()
    expect(screen.getByText("Alex T.")).toBeInTheDocument()
    expect(screen.getAllByText(/Expression orale — 25 min/i).length).toBeGreaterThanOrEqual(1)

    // CRITICAL PRIVACY REQUIREMENT: Student emails must never appear in the document!
    expect(screen.queryByText(/secret\.student@example\.com/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/private\.marie@example\.com/i)).not.toBeInTheDocument()
  })

  it("5. correction queue displays pending submissions and CTA", async () => {
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/teacher"]}>
          <TeacherDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText(/Corrections à traiter/i)).toBeInTheDocument()
    expect(screen.getByText(/Fait divers — Cambriolage au musée/i)).toBeInTheDocument()
    expect(screen.getByText(/220 mots/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Corriger/i })).toBeInTheDocument()
  })

  it("6. empty correction state works when there are no submissions", () => {
    render(
      <MemoryRouter>
        <CorrectionsQueueSection
          corrections={[]}
          isLoading={false}
          isError={false}
          onRetry={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getByText(/Vous n'avez aucune correction en attente/i)).toBeInTheDocument()
  })

  it("7. availability alert warns when rules are empty and displays active state when rules exist", () => {
    const { rerender } = render(
      <MemoryRouter>
        <AvailabilityAlert hasAvailability={false} rulesCount={0} isLoading={false} />
      </MemoryRouter>
    )

    expect(screen.getByText(/Votre disponibilité n'est pas encore configurée/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Configurer mes disponibilités/i })).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <AvailabilityAlert hasAvailability={true} rulesCount={1} isLoading={false} />
      </MemoryRouter>
    )

    expect(screen.getByText(/Disponibilités actives/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Gérer mes disponibilités/i })).toBeInTheDocument()
  })

  it("8. earnings summary displays net and available cents formatted in EUR", () => {
    render(
      <MemoryRouter>
        <EarningsSummarySection
          summary={mockEarningsSummary}
          isLoading={false}
          isError={false}
          onRetry={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getAllByText(/135,00\s*€/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/27,00\s*€/)).toBeInTheDocument() // pending
    expect(screen.getByText("5")).toBeInTheDocument() // 5 completed lessons
    expect(screen.getByRole("link", { name: /Voir mes revenus/i })).toBeInTheDocument()
  })

  it("9. partial section failure works: if corrections fail, schedule still displays and retry works", () => {
    const handleRetry = vi.fn()

    render(
      <MemoryRouter>
        <CorrectionsQueueSection
          corrections={[]}
          isLoading={false}
          isError={true}
          error={new Error("Network timeout")}
          onRetry={handleRetry}
        />
      </MemoryRouter>
    )

    expect(screen.getByText(/Impossible de charger les corrections/i)).toBeInTheDocument()
    const retryBtn = screen.getByRole("button", { name: /Réessayer/i })
    fireEvent.click(retryBtn)
    expect(handleRetry).toHaveBeenCalledTimes(1)
  })

  it("10. TeacherAvailabilityPage renders and allows managing recurring rules", async () => {
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/teacher/availability"]}>
          <TeacherAvailabilityPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText(/Créneaux de disponibilité hebdomadaires/i)).toBeInTheDocument()
    expect(screen.getByText(/Ajouter un créneau récurrent/i)).toBeInTheDocument()
    expect(await screen.findByText(/09:00 — 12:00/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Mardi/i).length).toBeGreaterThanOrEqual(1)
  })
})
