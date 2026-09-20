import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TeacherDetailPage } from "@/features/teachers/TeacherDetailPage"
import { TeacherProfileHeader } from "@/features/teachers/components/TeacherProfileHeader"
import { TeacherServicesSection } from "@/features/teachers/components/TeacherServicesSection"
import { TeacherBookingPanel } from "@/features/teachers/components/TeacherBookingPanel"
import { TeacherBookingModal } from "@/features/teachers/components/TeacherBookingModal"
import { TeacherInactiveBanner } from "@/features/teachers/components/TeacherInactiveBanner"
import type { TeacherSummary, StudentEntitlements, TimeSlot, TeacherServiceItem } from "@/features/teachers/types"

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
  credits_balance: 4,
  has_subscription: true,
  subscription_tier: "premium",
}

const mockSlots: TimeSlot[] = [
  {
    id: "slot-1",
    start_time: "2026-09-21T14:00:00Z",
    end_time: "2026-09-21T15:00:00Z",
    start_time_local: "10:00",
    end_time_local: "11:00",
    duration_minutes: 60,
    is_available: true,
  },
  {
    id: "slot-2",
    start_time: "2026-09-21T16:00:00Z",
    end_time: "2026-09-21T17:00:00Z",
    start_time_local: "12:00",
    end_time_local: "13:00",
    duration_minutes: 60,
    is_available: false,
  },
]

describe("Page 14 — Teacher Profile / Detail (/teachers/:id)", () => {
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
            date_from: "2026-09-21",
            date_to: "2026-09-21",
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
            id: "booking-123",
            teacher_id: "t-martin",
            student_id: "student-1",
            teacher_display_name: "Prof. Martin Dufresne",
            start_time: "2026-09-21T14:00:00Z",
            end_time: "2026-09-21T15:00:00Z",
            status: "confirmed",
            timezone: "America/Montreal",
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

  it("renders TeacherDetailPage with header, bio, services, approach, and booking panel", async () => {
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/teachers/t-martin"]}>
          <Routes>
            <Route path="/teachers/:id" element={<TeacherDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Header & Identity
    expect(await screen.findByText(/Prof. Martin Dufresne/i)).toBeInTheDocument()
    expect(screen.getByText(/Examinateur certifié TEF Canada/i)).toBeInTheDocument()
    expect(screen.getByText(/Profil vérifié/i)).toBeInTheDocument()

    // About & Qualifications
    expect(screen.getByText(/À propos de l'enseignant/i)).toBeInTheDocument()
    expect(screen.getByText(/12 ans d'expérience dans la préparation/i)).toBeInTheDocument()
    expect(screen.getByText(/Niveau B2/i)).toBeInTheDocument()

    // Services Section
    expect(screen.getByText(/Services proposés par l'enseignant/i)).toBeInTheDocument()

    // Teaching Approach
    expect(screen.getByText(/Déroulement d'une session de 60 minutes/i)).toBeInTheDocument()
    expect(screen.getByText(/Mise en situation d'examen/i)).toBeInTheDocument()
    expect(screen.getByText(/Débriefing & Grille officielle/i)).toBeInTheDocument()

    // Booking Panel
    expect(screen.getByText(/Réserver un créneau/i)).toBeInTheDocument()
    expect(screen.getByText(/1\. Choisissez une date/i)).toBeInTheDocument()
    expect(screen.getByText(/2\. Choisissez une heure/i)).toBeInTheDocument()
  })

  it("renders TeacherProfileHeader with verified status, timezone, and price", () => {
    const onBackClick = vi.fn()
    const onBookClick = vi.fn()

    render(
      <TeacherProfileHeader
        teacher={mockTeacher}
        entitlements={mockEntitlements}
        onBackClick={onBackClick}
        onBookClick={onBookClick}
      />
    )

    expect(screen.getByText("Prof. Martin Dufresne")).toBeInTheDocument()
    expect(screen.getByText(/Fuseau : America\/Montreal/i)).toBeInTheDocument()
    expect(screen.getByText("45.00 CAD")).toBeInTheDocument()
    expect(screen.getByText("Inclus dans votre forfait")).toBeInTheDocument()

    const bookBtn = screen.getByRole("button", { name: /Réserver une session/i })
    fireEvent.click(bookBtn)
    expect(onBookClick).toHaveBeenCalledTimes(1)

    const backBtn = screen.getByRole("button", { name: /Tous les professeurs/i })
    fireEvent.click(backBtn)
    expect(onBackClick).toHaveBeenCalledTimes(1)
  })

  it("renders TeacherServicesSection and allows selecting a service", () => {
    const services: TeacherServiceItem[] = [
      {
        id: "s1",
        title: "Expression orale",
        durationMinutes: 60,
        description: "Simulation Section A & B",
        priceCents: 4500,
        isCoveredByPlan: true,
      },
      {
        id: "s2",
        title: "Expression écrite",
        durationMinutes: 60,
        description: "Correction faits divers",
        priceCents: 4500,
        isCoveredByPlan: false,
      },
    ]
    const onSelect = vi.fn()

    render(
      <TeacherServicesSection
        services={services}
        selectedServiceId="s1"
        onSelectService={onSelect}
      />
    )

    expect(screen.getByText("Expression orale")).toBeInTheDocument()
    expect(screen.getByText("Expression écrite")).toBeInTheDocument()
    expect(screen.getByText("Inclus forfait")).toBeInTheDocument()

    const oralRadio = screen.getByRole("radio", { name: /Expression orale/i })
    expect(oralRadio).toBeChecked()

    const ecritRadio = screen.getByRole("radio", { name: /Expression écrite/i })
    fireEvent.click(ecritRadio)
    expect(onSelect).toHaveBeenCalledWith("s2")
  })

  it("handles slot selection and continues to confirmation modal", () => {
    const onSelectSlot = vi.fn()
    const onContinue = vi.fn()

    render(
      <TeacherBookingPanel
        teacher={mockTeacher}
        selectedDate="2026-09-21"
        onDateChange={vi.fn()}
        slots={mockSlots}
        selectedSlot={null}
        onSelectSlot={onSelectSlot}
        sessionNotes=""
        onSessionNotesChange={vi.fn()}
        userTimezone="America/Montreal"
        onContinue={onContinue}
      />
    )

    // Slot 1 available, Slot 2 disabled
    const slot1Btn = screen.getByText("10:00 - 11:00")
    fireEvent.click(slot1Btn)
    expect(onSelectSlot).toHaveBeenCalledWith(mockSlots[0])

    const slot2Btn = screen.getByText("12:00 - 13:00").closest("button")
    expect(slot2Btn).toBeDisabled()

    // Continue button is disabled when selectedSlot is null
    const continueBtn = screen.getByRole("button", { name: /Continuer vers la confirmation/i })
    expect(continueBtn).toBeDisabled()
  })

  it("handles stale slot conflict in TeacherBookingModal", () => {
    const onRefreshSlots = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <TeacherBookingModal
        isOpen={true}
        onOpenChange={onOpenChange}
        teacher={mockTeacher}
        selectedDate="2026-09-21"
        selectedSlot={mockSlots[0]}
        userTimezone="America/Montreal"
        isSubmitting={false}
        bookingSuccess={false}
        bookingConflict={true}
        confirmedBooking={null}
        onConfirm={vi.fn()}
        onRefreshSlots={onRefreshSlots}
        onNavigateDashboard={vi.fn()}
      />
    )

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText(/Ce créneau n'est plus disponible/i)).toBeInTheDocument()

    const refreshBtn = screen.getByRole("button", { name: /Choisir un autre créneau/i })
    fireEvent.click(refreshBtn)
    expect(onRefreshSlots).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("renders TeacherInactiveBanner when teacher is not approved", () => {
    const onBack = vi.fn()
    render(<TeacherInactiveBanner onBackToTeachers={onBack} />)

    expect(
      screen.getByText(/Cet enseignant n'accepte pas de réservations actuellement/i)
    ).toBeInTheDocument()

    const backBtn = screen.getByRole("button", { name: /Retour aux professeurs/i })
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
