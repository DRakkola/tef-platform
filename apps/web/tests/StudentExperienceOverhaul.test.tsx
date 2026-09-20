import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/common/EmptyState"
import { MetricCard } from "@/components/common/MetricCard"
import { ListeningPlayer } from "@/components/common/ListeningPlayer"
import { PracticePage } from "@/features/practice/PracticePage"
import { TeachersDirectoryPage } from "@/features/teachers/TeachersDirectoryPage"
import { TeacherDetailPage } from "@/features/teachers/TeacherDetailPage"
import { WritingEditorPage } from "@/features/writing/WritingEditorPage"
import { SpeakingSessionPage } from "@/features/speaking/SpeakingSessionPage"

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

describe("Student Design System & Experience Overhaul", () => {
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
      if (url.includes("/api/v1/teachers")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "t-martin",
                display_name: "Prof. Martin Dufresne",
                headline: "Examinateur certifié TEF Canada",
                bio: "Spécialiste de l'expression orale.",
                expertise: ["Expression orale", "Méthodologie"],
                teaching_levels: ["B1", "B2", "C1"],
                hourly_price: 4500,
                timezone: "America/Montreal",
              },
            ],
          }),
        } as Response
      }
      if (url.includes("/api/v1/exercises")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "ex-test-1",
                title: "Pronoms relatifs (lequel, auquel)",
                category: "grammar",
                level: "B2",
                difficulty: 3,
                question_type: "multiple_choice",
                estimated_minutes: 10,
              },
            ],
          }),
        } as Response
      }
      if (url.includes("/api/v1/recommendations")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "rec-test-1",
                title: "Compréhension Orale Express",
                reason: "Comble un déficit identifié.",
                category: "listening",
                level: "B2",
                entity_id: "ex-test-1",
                priority: 95,
              },
            ],
          }),
        } as Response
      }
      if (url.includes("/api/v1/writing/tasks")) {
        return {
          ok: true,
          json: async () => ({
            id: "w-1",
            title: "Expression Écrite — Section B (Lettre d'opinion formelle)",
            task_type: "section_b",
            prompt:
              "Vous avez lu dans un journal que la mairie de votre ville souhaite interdire totalement la circulation automobile dans le centre-ville dès l'année prochaine. Vous écrivez au courrier des lecteurs pour exprimer votre point de vue argumenté sur ce projet en présentant des avantages, des inconvénients et des propositions concrètes d'aménagement.",
            min_words: 200,
            max_words: 250,
            duration_minutes: 60,
            target_level: "B2",
          }),
        } as Response
      }
      if (url.includes("/api/v1/writing/attempts")) {
        return {
          ok: true,
          json: async () => ({
            id: "att-w-1",
            task_id: "w-1",
            status: "draft",
            content: "",
            word_count: 0,
            current_revision: 1,
            started_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            remaining_seconds: 3600,
          }),
        } as Response
      }
      return { ok: true, json: async () => ({ items: [] }) } as Response
    })
  })

  afterEach(() => {
    cleanup()
  })

  describe("UI Primitives & Common Components", () => {
    it("renders Card with header and content", () => {
      render(
        <Card className="test-card">
          <CardHeader>
            <CardTitle>Compréhension Écrite</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Exercice de lecture rapide</p>
          </CardContent>
        </Card>
      )
      expect(screen.getByText("Compréhension Écrite")).toBeInTheDocument()
      expect(screen.getByText("Exercice de lecture rapide")).toBeInTheDocument()
    })

    it("renders Badge with various semantic variants", () => {
      const { rerender } = render(<Badge variant="success">Réussi</Badge>)
      expect(screen.getByText("Réussi")).toBeInTheDocument()

      rerender(<Badge variant="warning">À réviser</Badge>)
      expect(screen.getByText("À réviser")).toBeInTheDocument()

      rerender(<Badge variant="outline">Niveau B2</Badge>)
      expect(screen.getByText("Niveau B2")).toBeInTheDocument()
    })

    it("renders EmptyState with clear action button callback", () => {
      const handleAction = vi.fn()
      render(
        <EmptyState
          title="Aucun devoir en cours"
          description="Vous êtes à jour dans vos révisions."
          actionLabel="Commencer un exercice"
          onAction={handleAction}
        />
      )
      expect(screen.getByText("Aucun devoir en cours")).toBeInTheDocument()
      expect(screen.getByText("Vous êtes à jour dans vos révisions.")).toBeInTheDocument()
      const btn = screen.getByRole("button", { name: "Commencer un exercice" })
      fireEvent.click(btn)
      expect(handleAction).toHaveBeenCalledTimes(1)
    })

    it("renders MetricCard with calm typography, label, and delta", () => {
      render(
        <MetricCard
          label="Score Moyen NCLC"
          value="78%"
          subtext="Objectif B2 : 70%"
          delta={{ value: "+4.5%", isPositive: true }}
        />
      )
      expect(screen.getByText("Score Moyen NCLC")).toBeInTheDocument()
      expect(screen.getByText("78%")).toBeInTheDocument()
      expect(screen.getByText("Objectif B2 : 70%")).toBeInTheDocument()
      expect(screen.getByText("+4.5%")).toBeInTheDocument()
    })

    it("renders ListeningPlayer and enforces replay policy restrictions", () => {
      render(
        <ListeningPlayer
          mediaUrl="/mock/sample.mp3"
          title="Audio d'évaluation B2"
          replayAllowed={false}
          maxPlays={1}
        />
      )
      expect(screen.getByText("Audio d'évaluation B2")).toBeInTheDocument()
      expect(screen.getByText("1 seule écoute")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Lancer l'écoute audio/i })).toBeInTheDocument()
    })
  })

  describe("Practice Feature (/practice)", () => {
    it("renders PracticePage with recommendations and category filters", async () => {
      const queryClient = createTestQueryClient()
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <PracticePage />
          </MemoryRouter>
        </QueryClientProvider>
      )

      expect(await screen.findByText(/Espace d'entraînement & Pratique ciblée/i)).toBeInTheDocument()
      expect(screen.getByText("Recommandé pour vous")).toBeInTheDocument()
      expect(screen.getByText("Compréhension Orale Express")).toBeInTheDocument()
      expect(screen.getByText("Comble un déficit identifié.")).toBeInTheDocument()
      expect(screen.getByText("Pronoms relatifs (lequel, auquel)")).toBeInTheDocument()
    })
  })

  describe("Teachers Directory & Booking Flow (/teachers)", () => {
    it("renders TeachersDirectoryPage with teacher profiles and pricing", async () => {
      const queryClient = createTestQueryClient()
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TeachersDirectoryPage />
          </MemoryRouter>
        </QueryClientProvider>
      )

      expect(await screen.findByText("Prof. Martin Dufresne")).toBeInTheDocument()
      expect(screen.getByText("Examinateur certifié TEF Canada")).toBeInTheDocument()
      expect(screen.getByText("45.00 CAD / heure")).toBeInTheDocument()
      expect(screen.getByText(/Voir le profil/i)).toBeInTheDocument()
    })

    it("renders TeacherDetailPage with slots selector and booking modal", async () => {
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

      expect(await screen.findByText(/Prof. Martin Dufresne/i)).toBeInTheDocument()
      expect(screen.getByText(/Réserver un créneau/i)).toBeInTheDocument()
      expect(screen.getByText(/1\. Choisissez une date/i)).toBeInTheDocument()
      expect(screen.getByText(/2\. Choisissez une heure/i)).toBeInTheDocument()
    })
  })

  describe("Writing Editor Flow (/writing/tasks/:id)", () => {
    it("renders WritingEditorPage with prompt, live word count, and submission dialog", async () => {
      render(
        <MemoryRouter initialEntries={["/writing/tasks/w-1"]}>
          <Routes>
            <Route path="/writing/tasks/:id" element={<WritingEditorPage />} />
          </Routes>
        </MemoryRouter>
      )

      expect(await screen.findByText(/Expression Écrite — Section B/i)).toBeInTheDocument()
      expect(screen.getByText(/Consigne officielle TEF/i)).toBeInTheDocument()
      expect(screen.getByText(/Cible : 200 à 250 mots/i)).toBeInTheDocument()

      const textarea = screen.getByPlaceholderText(/Rédigez votre réponse ici/i)
      expect(textarea).toBeInTheDocument()

      // Type text and verify word counter updates
      fireEvent.change(textarea, { target: { value: "Madame, Monsieur, je vous écris afin d'exprimer mon point de vue." } })
      expect(screen.getByText(/(11|12) \/ 200-250 mots/i)).toBeInTheDocument()

      // Open submit dialog
      const submitBtn = screen.getByRole("button", { name: /Soumettre/i })
      fireEvent.click(submitBtn)
      expect(screen.getByText(/Confirmer la soumission de votre écrit/i)).toBeInTheDocument()
      expect(screen.getByText(/Évaluation IA/i)).toBeInTheDocument()
    })
  })

  describe("Speaking Simulation Flow (/speaking)", () => {
    it("renders SpeakingSessionPage with launcher and simulation options", async () => {
      render(
        <MemoryRouter initialEntries={["/speaking"]}>
          <SpeakingSessionPage />
        </MemoryRouter>
      )

      expect(await screen.findByText(/Speaking Workspace/i)).toBeInTheDocument()
      expect(screen.getByText(/Nouvelle Simulation/i)).toBeInTheDocument()
      expect(screen.getByText(/Section A · Renseignements/i)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Démarrer la simulation/i })).toBeInTheDocument()
    })
  })
})
