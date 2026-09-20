import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BookingPage } from "@/features/bookings/BookingPage"
import { BookingHeader } from "@/features/bookings/components/BookingHeader"
import { BookingProgress } from "@/features/bookings/components/BookingProgress"
import { BookingServiceSelection } from "@/features/bookings/components/BookingServiceSelection"
import { BookingDateSelector } from "@/features/bookings/components/BookingDateSelector"
import { BookingTimeSlots } from "@/features/bookings/components/BookingTimeSlots"
import { BookingReview } from "@/features/bookings/components/BookingReview"
import { BookingSuccess } from "@/features/bookings/components/BookingSuccess"
import type { TeacherSummary, StudentEntitlements, TimeSlot, TeacherServiceItem } from "@/features/bookings/types"

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

const mockTeacher: TeacherSummary = {
  id: "t-martin",
  user_id: "u-martin",
  display_name: "Prof. Martin Dufresne",
  headline: "Examinateur certifié TEF Canada & Formateur CCI",
  bio: "12 ans d'expérience dans la préparation aux épreuves du TEF Canada.",
  expertise: ["Expression orale (Section A & B)", "Expression écrite", "Méthodologie TEF"],
  teaching_levels: ["B1", "B2", "C1"],
  hourly_price: 4500,
  verification_status: "approved",
  timezone: "America/Montreal",
}

const mockEntitlements: StudentEntitlements = {
  credits_balance: 6,
  has_subscription: false,
  subscription_tier: "free",
}

const mockSlots: TimeSlot[] = [
  {
    id: "slot-1",
    start_time: "2026-09-22T14:00:00Z",
    end_time: "2026-09-22T15:00:00Z",
    start_time_local: "10:00",
    end_time_local: "11:00",
    duration_minutes: 60,
    is_available: true,
  },
  {
    id: "slot-2",
    start_time: "2026-09-22T16:00:00Z",
    end_time: "2026-09-22T17:00:00Z",
    start_time_local: "12:00",
    end_time_local: "13:00",
    duration_minutes: 60,
    is_available: false,
  },
  {
    id: "slot-3",
    start_time: "2026-09-22T18:00:00Z",
    end_time: "2026-09-22T19:00:00Z",
    start_time_local: "14:00",
    end_time_local: "15:00",
    duration_minutes: 60,
    is_available: true,
  },
]

describe("Page 15 — Teacher Booking Flow (/teachers/:teacherId/book)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)

      if (url.includes("/api/v1/notifications")) {
        return {
          ok: true,
          json: async () => ({ items: [] }),
        } as Response
      }

      if (url.includes("/api/v1/billing/entitlements")) {
        return {
          ok: true,
          json: async () => mockEntitlements,
        } as Response
      }

      if (url.includes("/slots")) {
        return {
          ok: true,
          json: async () => ({
            teacher_id: "t-martin",
            teacher_timezone: "America/Montreal",
            student_timezone: "America/Montreal",
            date_from: "2026-09-22",
            date_to: "2026-09-22",
            slots: mockSlots,
          }),
        } as Response
      }

      if (url.includes("/api/v1/teachers/t-martin")) {
        return {
          ok: true,
          json: async () => mockTeacher,
        } as Response
      }

      if (url.includes("/api/v1/bookings")) {
        return {
          ok: true,
          json: async () => ({
            id: "booking-999-confirmed",
            teacher_id: "t-martin",
            student_id: "student-1",
            teacher_display_name: "Prof. Martin Dufresne",
            start_time: "2026-09-22T14:00:00Z",
            end_time: "2026-09-22T15:00:00Z",
            status: "confirmed",
            timezone: "America/Montreal",
            meeting_link: "https://meet.tef-platform.internal/session-video-999",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response
    })
  })

  it("renders Step 1 Service Selection and progresses through full booking flow", async () => {
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/teachers/t-martin/book"]}>
          <Routes>
            <Route path="/teachers/:teacherId/book" element={<BookingPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    // 1. Verify Header and Step 1
    const teacherHeaders = await screen.findAllByText(/Prof. Martin Dufresne/i)
    expect(teacherHeaders.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Retour au profil enseignant/i)).toBeInTheDocument()
    expect(screen.getByText(/1\. Choisissez votre service/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Expression orale \(Section A & B\)/i).length).toBeGreaterThanOrEqual(1)

    // 2. Advance to Step 2: Date & Heure
    const continueBtn = screen.getByRole("button", { name: /Continuer vers la date & heure/i })
    fireEvent.click(continueBtn)

    // 3. Verify Step 2 Date & Time
    expect(await screen.findByText(/2\. Choisissez votre date et créneau horaire/i)).toBeInTheDocument()
    expect(screen.getByText(/Heures affichées sur votre fuseau/i)).toBeInTheDocument()

    // Pick slot 1 (10:00 - 11:00)
    const slot1Btn = await screen.findByRole("radio", { name: /10:00 - 11:00/i })
    fireEvent.click(slot1Btn)

    // Advance to Step 3: Review
    const reviewBtn = screen.getByRole("button", { name: /Continuer vers le récapitulatif/i })
    fireEvent.click(reviewBtn)

    // 4. Verify Step 3 Review
    expect(await screen.findByText(/3\. Vérifiez et confirmez votre réservation/i)).toBeInTheDocument()
    expect(screen.getByText(/Détails de la séance/i)).toBeInTheDocument()
    expect(screen.getByText(/Politique d'annulation/i)).toBeInTheDocument()
    expect(screen.getByText(/Crédits disponibles/i)).toBeInTheDocument()

    // 5. Confirm Booking
    const confirmBtn = screen.getByRole("button", { name: /Confirmer pour 2 crédits/i })
    fireEvent.click(confirmBtn)

    // 6. Verify Step 4 Success State
    expect(await screen.findByText(/Réservation confirmée !/i)).toBeInTheDocument()
    expect(screen.getByText(/Référence :/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Ajouter à mon agenda \(\.ics\)/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Voir mon tableau de bord/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Retour aux professeurs/i })).toBeInTheDocument()
  })

  it("handles preselection from query parameters and advances directly to Review", async () => {
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/teachers/t-martin/book?service=srv-0-expression-orale-section-a-b&date=2026-09-22&slot=10:00"]}>
          <Routes>
            <Route path="/teachers/:teacherId/book" element={<BookingPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Should preselect and jump to Step 3 Review
    expect(await screen.findByText(/3\. Vérifiez et confirmez votre réservation/i)).toBeInTheDocument()
    const teachers = await screen.findAllByText(/Prof. Martin Dufresne/i)
    expect(teachers.length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("10:00 - 11:00").length).toBeGreaterThanOrEqual(1)
  })

  it("handles 409 conflict when a slot is booked by someone else during the flow", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)

      if (url.includes("/api/v1/billing/entitlements")) {
        return { ok: true, json: async () => mockEntitlements } as Response
      }
      if (url.includes("/slots")) {
        return {
          ok: true,
          json: async () => ({
            teacher_id: "t-martin",
            teacher_timezone: "America/Montreal",
            student_timezone: "America/Montreal",
            date_from: "2026-09-22",
            date_to: "2026-09-22",
            slots: mockSlots,
          }),
        } as Response
      }
      if (url.includes("/api/v1/teachers/t-martin")) {
        return { ok: true, json: async () => mockTeacher } as Response
      }
      if (url.includes("/api/v1/bookings")) {
        return {
          ok: false,
          status: 409,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            error: {
              code: "SLOT_ALREADY_BOOKED",
              message: "This slot has already been booked or is pending confirmation",
            },
          }),
        } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/teachers/t-martin/book?service=srv-0-expression-orale-section-a-b&date=2026-09-22&slot=10:00"]}>
          <Routes>
            <Route path="/teachers/:teacherId/book" element={<BookingPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Advance to review and click confirm
    const confirmBtn = await screen.findByRole("button", { name: /Confirmer pour 2 crédits/i })
    fireEvent.click(confirmBtn)

    // Verify 409 conflict warning banner is displayed
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(screen.getAllByText(/Ce créneau n'est plus disponible/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole("button", { name: /Choisir un autre créneau/i })).toBeInTheDocument()
  })
})
