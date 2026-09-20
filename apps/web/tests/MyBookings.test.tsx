import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MyBookingsPage } from "@/features/bookings/MyBookingsPage"
import { BookingsHeader } from "@/features/bookings/components/BookingsHeader"
import { BookingTabs } from "@/features/bookings/components/BookingTabs"
import { BookingCard } from "@/features/bookings/components/BookingCard"
import { BookingDetailModal } from "@/features/bookings/components/BookingDetailModal"
import { CancelBookingModal } from "@/features/bookings/components/CancelBookingModal"
import { RescheduleModal } from "@/features/bookings/components/RescheduleModal"
import type { TeacherBookingResponse } from "@/features/bookings/types"

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

const mockUpcomingBooking: TeacherBookingResponse = {
  id: "bk-upcoming-1",
  teacher_id: "t-martin",
  student_id: "student-1",
  teacher_display_name: "Prof. Martin Dufresne",
  start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
  end_time: new Date(Date.now() + 86400000 + 3600000).toISOString(),
  status: "confirmed",
  timezone: "America/Montreal",
  notes: "Session: Expression orale (Section A & B) - Focus argumentation",
  meeting_link: "https://meet.tef-platform.internal/session-oral-1",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const mockPastBooking: TeacherBookingResponse = {
  id: "bk-past-1",
  teacher_id: "t-sophie",
  student_id: "student-1",
  teacher_display_name: "Prof. Sophie Laurent",
  start_time: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
  end_time: new Date(Date.now() - 86400000 * 5 + 3600000).toISOString(),
  status: "completed",
  timezone: "America/Montreal",
  notes: "Session: Expression écrite - Analyse fait divers",
  meeting_link: "https://meet.tef-platform.internal/session-ecrit-1",
  created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
}

describe("Page 16 — My Bookings / Session Management (/bookings)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)

      if (url.includes("/api/v1/notifications")) {
        return { ok: true, json: async () => ({ items: [] }) } as Response
      }

      if (url.includes("/api/v1/bookings/bk-upcoming-1/cancel")) {
        return {
          ok: true,
          json: async () => ({
            ...mockUpcomingBooking,
            status: "cancelled",
            cancellation_reason: "Imprévu d'emploi du temps",
            cancelled_at: new Date().toISOString(),
          }),
        } as Response
      }

      if (url.includes("/api/v1/bookings")) {
        return {
          ok: true,
          json: async () => ({
            items: [mockUpcomingBooking, mockPastBooking],
            total: 2,
          }),
        } as Response
      }

      return { ok: true, json: async () => ({}) } as Response
    })
  })

  it("renders MyBookingsPage with header, tabs, and upcoming session card", async () => {
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/bookings"]}>
          <Routes>
            <Route path="/bookings" element={<MyBookingsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    // 1. Header
    expect(await screen.findByRole("heading", { name: /Mes réservations/i })).toBeInTheDocument()
    expect(screen.getByText(/Gérez vos sessions passées et à venir/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Trouver un professeur/i })).toBeInTheDocument()

    // 2. Tabs
    expect(screen.getByRole("tab", { name: /À venir/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Passées/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Toutes/i })).toBeInTheDocument()

    // 3. Upcoming booking item
    const teacherNames = await screen.findAllByText(/Prof. Martin Dufresne/i)
    expect(teacherNames.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Expression orale \(Section A & B\)/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Confirmée/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole("button", { name: /Détails/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Reprogrammer/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Annuler/i })).toBeInTheDocument()
  })

  it("switches to Past tab and displays completed sessions with review action", async () => {
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/bookings"]}>
          <Routes>
            <Route path="/bookings" element={<MyBookingsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Switch to "Passées" tab
    const pastTab = await screen.findByRole("tab", { name: /Passées/i })
    fireEvent.click(pastTab)

    // Verify past booking is displayed
    const pastTeacher = await screen.findAllByText(/Prof. Sophie Laurent/i)
    expect(pastTeacher.length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Expression écrite/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Terminée/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole("link", { name: /Voir la correction/i })).toBeInTheDocument()
  })

  it("opens BookingDetailModal when Détails is clicked", async () => {
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/bookings"]}>
          <Routes>
            <Route path="/bookings" element={<MyBookingsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Click Détails button
    const detailsBtn = await screen.findByRole("button", { name: /Détails/i })
    fireEvent.click(detailsBtn)

    // Verify Detail Dialog opens
    expect(await screen.findByText(/Détails de la session/i)).toBeInTheDocument()
    expect(screen.getByText(/TEF-BK-/i)).toBeInTheDocument()
    expect(screen.getByText(/Lien de visioconférence/i)).toBeInTheDocument()
    expect(screen.getByText(/Focus argumentation/i)).toBeInTheDocument()
  })

  it("cancels booking through CancelBookingModal and updates status", async () => {
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/bookings"]}>
          <Routes>
            <Route path="/bookings" element={<MyBookingsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Click Annuler button
    const cancelBtn = await screen.findByRole("button", { name: /Annuler/i })
    fireEvent.click(cancelBtn)

    // Verify Cancel Dialog opens
    expect(await screen.findByText(/Annuler votre réservation \?/i)).toBeInTheDocument()
    expect(screen.getByText(/Politique d'annulation/i)).toBeInTheDocument()

    // Select reason
    const reasonSelect = screen.getByLabelText(/Motif de l'annulation/i)
    fireEvent.change(reasonSelect, { target: { value: "Imprévu d'emploi du temps" } })

    // Click Confirm cancel
    const confirmCancelBtn = screen.getByRole("button", { name: /Confirmer l'annulation/i })
    fireEvent.click(confirmCancelBtn)

    // Verify cancellation is processed
    await waitFor(() => {
      expect(screen.getByText(/Annulée/i)).toBeInTheDocument()
    })
  })
})
