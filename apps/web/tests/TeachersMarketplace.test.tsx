import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TeachersDirectoryPage } from "@/features/teachers/TeachersDirectoryPage"
import { TeacherCard } from "@/features/teachers/components/TeacherCard"
import { TeacherFilterBar } from "@/features/teachers/components/TeacherFilterBar"
import { TeacherFiltersSheet } from "@/features/teachers/components/TeacherFiltersSheet"
import { TeacherAvailabilityPreview } from "@/features/teachers/components/TeacherAvailabilityPreview"
import type { TeacherSummary, StudentEntitlements } from "@/features/teachers/types"

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

const mockTeachers: TeacherSummary[] = [
  {
    id: "t-1",
    user_id: "u-1",
    display_name: "Prof. Alexandre Mercier",
    headline: "Examinateur certifié TEF Canada / DFP",
    bio: "12 ans d'expérience dans la préparation intensive aux épreuves d'expression orale.",
    expertise: ["Expression orale", "Méthodologie TEF"],
    teaching_levels: ["B1", "B2", "C1"],
    hourly_price: 6500,
    verification_status: "approved",
    timezone: "America/Montreal",
  },
  {
    id: "t-2",
    user_id: "u-2",
    display_name: "Mme Élodie Laurent",
    headline: "Spécialiste de la fluidité orale et de l'argumentation",
    bio: "Docteure en linguistique appliquée. Aide les candidats à surmonter l'hésitation.",
    expertise: ["Expression orale", "Phonétique"],
    teaching_levels: ["B2", "C1"],
    hourly_price: 7000,
    verification_status: "approved",
    timezone: "Europe/Paris",
  },
  {
    id: "t-3",
    user_id: "u-3",
    display_name: "Prof. Marc Bouchard",
    headline: "Formateur accrédité Québec & Canada Fédéral",
    bio: "Spécialisé dans les stratégies d'optimisation de score pour l'immigration canadienne.",
    expertise: ["Méthodologie TEF", "Expression écrite"],
    teaching_levels: ["A2", "B1"],
    hourly_price: 4500,
    verification_status: "approved",
    timezone: "America/Toronto",
  },
]

describe("Page 13 — Teachers Marketplace (/teachers)", () => {
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
          json: async () => ({
            credits_balance: 5,
            has_subscription: true,
            subscription_tier: "premium",
          }),
        } as Response
      }

      if (url.includes("/slots")) {
        return {
          ok: true,
          json: async () => ({
            teacher_id: "t-1",
            teacher_timezone: "America/Montreal",
            student_timezone: "America/Montreal",
            date_from: "2026-09-20",
            date_to: "2026-09-27",
            slots: [
              {
                start_time: "2026-09-21T14:00:00Z",
                end_time: "2026-09-21T15:00:00Z",
                start_time_local: "10:00",
                end_time_local: "11:00",
                duration_minutes: 60,
              },
            ],
          }),
        } as Response
      }

      if (url.includes("/api/v1/teachers")) {
        return {
          ok: true,
          json: async () => ({
            items: mockTeachers,
            total: mockTeachers.length,
            page: 1,
            page_size: 12,
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response
    })
  })

  it("renders TeachersDirectoryPage with header, search, filter bar, and teacher cards", async () => {
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/teachers"]}>
          <TeachersDirectoryPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(screen.getByText(/Trouver un professeur/i)).toBeInTheDocument()
    expect(await screen.findByText("Prof. Alexandre Mercier")).toBeInTheDocument()
    expect(screen.getByText("Mme Élodie Laurent")).toBeInTheDocument()
    expect(screen.getByText("Prof. Marc Bouchard")).toBeInTheDocument()

    // Pricing format check
    expect(screen.getByText("65.00 CAD / heure")).toBeInTheDocument()
    expect(screen.getByText("70.00 CAD / heure")).toBeInTheDocument()
    expect(screen.getByText("45.00 CAD / heure")).toBeInTheDocument()

    // Primary CTA check
    const profileButtons = screen.getAllByRole("button", { name: /Voir le profil/i })
    expect(profileButtons.length).toBe(3)
  })

  it("filters teachers by search query", async () => {
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/teachers"]}>
          <TeachersDirectoryPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText("Prof. Alexandre Mercier")).toBeInTheDocument()

    const searchInput = screen.getByRole("searchbox", { name: /Recherche de professeurs/i })
    fireEvent.change(searchInput, { target: { value: "Bouchard" } })

    await waitFor(
      () => {
        expect(screen.getByText("Prof. Marc Bouchard")).toBeInTheDocument()
        expect(screen.queryByText("Prof. Alexandre Mercier")).not.toBeInTheDocument()
        expect(screen.queryByText("Mme Élodie Laurent")).not.toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })

  it("displays empty state when no teachers match and allows reset", async () => {
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/teachers"]}>
          <TeachersDirectoryPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText("Prof. Alexandre Mercier")).toBeInTheDocument()

    const searchInput = screen.getByRole("searchbox", { name: /Recherche de professeurs/i })
    fireEvent.change(searchInput, { target: { value: "NonExistentTeacherName123" } })

    await waitFor(() => {
      expect(screen.getByText(/Aucun enseignant correspondant/i)).toBeInTheDocument()
    })

    const resetButton = screen.getByRole("button", { name: /Réinitialiser les filtres/i })
    fireEvent.click(resetButton)

    await waitFor(() => {
      expect(screen.getByText("Prof. Alexandre Mercier")).toBeInTheDocument()
    })
  })

  it("renders TeacherCard with entitlement badge when student has subscription/credits", () => {
    const queryClient = createTestQueryClient()
    const entitlements: StudentEntitlements = {
      has_subscription: true,
      credits_balance: 4,
      subscription_tier: "premium",
    }
    const onViewProfile = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <TeacherCard
          teacher={mockTeachers[0]}
          entitlements={entitlements}
          onViewProfile={onViewProfile}
        />
      </QueryClientProvider>
    )

    expect(screen.getByText("Prof. Alexandre Mercier")).toBeInTheDocument()
    expect(screen.getByText("Inclus dans votre forfait")).toBeInTheDocument()

    const btn = screen.getByRole("button", { name: /Voir le profil/i })
    fireEvent.click(btn)
    expect(onViewProfile).toHaveBeenCalledWith("t-1")
  })

  it("renders live availability preview correctly", async () => {
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <TeacherAvailabilityPreview teacherId="t-1" />
      </QueryClientProvider>
    )

    // Wait for slot inspection fetch
    expect(await screen.findByText(/Prochain créneau :/i)).toBeInTheDocument()
  })

  it("opens mobile filter sheet when mobile trigger is clicked", () => {
    const onOpenMobileFilters = vi.fn()

    render(
      <TeacherFilterBar
        specialization="all"
        onSpecializationChange={vi.fn()}
        level="all"
        onLevelChange={vi.fn()}
        priceRange="all"
        onPriceRangeChange={vi.fn()}
        availability="all"
        onAvailabilityChange={vi.fn()}
        activeFiltersCount={2}
        onReset={vi.fn()}
        onOpenMobileFilters={onOpenMobileFilters}
      />
    )

    const mobileBtn = screen.getByRole("button", { name: /Filtres/i })
    fireEvent.click(mobileBtn)
    expect(onOpenMobileFilters).toHaveBeenCalledTimes(1)
  })

  it("allows selecting filters inside TeacherFiltersSheet", () => {
    const onSpecializationChange = vi.fn()
    const onLevelChange = vi.fn()
    const onClose = vi.fn()

    render(
      <TeacherFiltersSheet
        isOpen={true}
        onClose={onClose}
        specialization="all"
        onSpecializationChange={onSpecializationChange}
        level="all"
        onLevelChange={onLevelChange}
        priceRange="all"
        onPriceRangeChange={vi.fn()}
        availability="all"
        onAvailabilityChange={vi.fn()}
        onReset={vi.fn()}
      />
    )

    expect(screen.getByRole("dialog", { name: /Filtres de recherche/i })).toBeInTheDocument()

    const oralButton = screen.getByRole("button", { name: /Expression orale/i })
    fireEvent.click(oralButton)
    expect(onSpecializationChange).toHaveBeenCalledWith("Expression orale")

    const b2Button = screen.getByRole("button", { name: "B2" })
    fireEvent.click(b2Button)
    expect(onLevelChange).toHaveBeenCalledWith("B2")

    const applyButton = screen.getByRole("button", { name: /Appliquer/i })
    fireEvent.click(applyButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("navigates to /teachers/:id when clicking Voir le profil in TeachersDirectoryPage", async () => {
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/teachers"]}>
          <Routes>
            <Route path="/teachers" element={<TeachersDirectoryPage />} />
            <Route path="/teachers/:id" element={<div>Teacher Detail Mock</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText("Prof. Alexandre Mercier")).toBeInTheDocument()

    const firstButton = screen.getAllByRole("button", { name: /Voir le profil/i })[0]
    fireEvent.click(firstButton)

    await waitFor(() => {
      expect(screen.getByText("Teacher Detail Mock")).toBeInTheDocument()
    })
  })
})
