import { render, screen, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { PageShell } from "@/components/layout/PageShell"
import { Section, SectionHeader } from "@/components/layout/Section"
import { StatCard } from "@/components/common/StatCard"
import { SkillCard } from "@/components/common/SkillCard"
import { RecommendationCard } from "@/components/common/RecommendationCard"
import { ErrorState } from "@/components/common/ErrorState"

describe("AppShell & Layout Architecture", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({ items: [] }),
      } as Response
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("renders AppShell with brand header, 5 primary pillars, and account info", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppShell studentName="Claire Martin" targetExam="TEF Canada">
          <div>Workspace Content</div>
        </AppShell>
      </MemoryRouter>
    )

    // Brand and Exam target
    expect(screen.getByText("Portail TEF")).toBeInTheDocument()

    // 5 Primary Navigation Pillars in Sidebar
    expect(screen.getAllByText("Tableau de bord")[0]).toBeInTheDocument()
    expect(screen.getAllByText("Pratique")[0]).toBeInTheDocument()
    expect(screen.getAllByText("Progression")[0]).toBeInTheDocument()
    expect(screen.getByText("Professeurs")).toBeInTheDocument()
    expect(screen.getByText("Practice Pool")).toBeInTheDocument()

    // Secondary items
    expect(screen.getByText("Simulations TEF")).toBeInTheDocument()
    expect(screen.getByText("Atelier d'écriture")).toBeInTheDocument()

    // User Account
    expect(screen.getByText("Claire Martin")).toBeInTheDocument()

    // Workspace content
    expect(screen.getByText("Workspace Content")).toBeInTheDocument()

    // Skip link
    expect(screen.getByText("Aller au contenu principal")).toBeInTheDocument()
  })

  it("renders PageShell and Section with structured headers", () => {
    render(
      <PageShell>
        <Section>
          <SectionHeader
            title="Entraînements recommandés"
            description="Prescriptions basées sur vos erreurs récentes"
            action={<button>Voir tout</button>}
          />
          <div>Section Content</div>
        </Section>
      </PageShell>
    )

    expect(screen.getByText("Entraînements recommandés")).toBeInTheDocument()
    expect(screen.getByText(/Prescriptions basées sur vos erreurs récentes/i)).toBeInTheDocument()
    expect(screen.getByText("Voir tout")).toBeInTheDocument()
    expect(screen.getByText("Section Content")).toBeInTheDocument()
  })

  it("renders StatCard with value and delta badge", () => {
    render(
      <StatCard
        label="Niveau actuel"
        value="B2"
        subtext="Estimation calculée"
        change={5.2}
      />
    )

    expect(screen.getByText("Niveau actuel")).toBeInTheDocument()
    expect(screen.getByText("B2")).toBeInTheDocument()
    expect(screen.getByText("+5.2%")).toBeInTheDocument()
    expect(screen.getByText("Estimation calculée")).toBeInTheDocument()
  })

  it("renders RecommendationCard with priority badge and CTA", () => {
    const handleStart = vi.fn()
    render(
      <RecommendationCard
        id="rec-1"
        title="Inférences orales complexes"
        category="listening"
        level="B2"
        estimatedMinutes={15}
        reason="Comble un écart identifié de 12%."
        priority="critical"
        onStart={handleStart}
      />
    )

    expect(screen.getByText("Inférences orales complexes")).toBeInTheDocument()
    expect(screen.getByText("Prioritaire")).toBeInTheDocument()
    expect(screen.getByText(/Comble un écart identifié/i)).toBeInTheDocument()
    expect(screen.getByText(/15/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Pratiquer/i })).toBeInTheDocument()
  })

  it("renders SkillCard with score and mastery status", () => {
    render(
      <SkillCard
        name="Pronoms relatifs composés"
        score={80}
        category="grammar"
        status="mastered"
      />
    )

    expect(screen.getByText("Pronoms relatifs composés")).toBeInTheDocument()
    expect(screen.getByText("80%")).toBeInTheDocument()
    expect(screen.getByText("Maîtrisé")).toBeInTheDocument()
  })

  it("renders ErrorState without technical stack dumps and provides retry action", () => {
    const handleRetry = vi.fn()
    render(
      <ErrorState
        title="Service temporairement indisponible"
        description="Une vérification de connexion est nécessaire."
        actionLabel="Recharger"
        onRetry={handleRetry}
      />
    )

    expect(screen.getByText("Service temporairement indisponible")).toBeInTheDocument()
    expect(screen.getByText("Une vérification de connexion est nécessaire.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Recharger/i })).toBeInTheDocument()
  })
})
