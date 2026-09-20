/**
 * Comprehensive Unit and Integration Tests for the Student Assessment Results Experience (/attempts/:id/results).
 * Tests AssessmentResultHero, ResultSummary, SectionResults, SkillBreakdown,
 * StrengthsSection, WeaknessesSection, MistakesSummary, MistakeReview,
 * NextStepCard, ProgressComparison, ResultHistory, ReadinessUpdateCard,
 * DailyPlanHandoffCard, and AssessmentResultsPage integration.
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { AssessmentResultHero } from "@/features/assessments/components/AssessmentResultHero"
import { ResultSummary } from "@/features/assessments/components/ResultSummary"
import { SectionResults } from "@/features/assessments/components/SectionResults"
import { SkillBreakdown } from "@/features/assessments/components/SkillBreakdown"
import { StrengthsSection } from "@/features/assessments/components/StrengthsSection"
import { WeaknessesSection } from "@/features/assessments/components/WeaknessesSection"
import { MistakesSummary } from "@/features/assessments/components/MistakesSummary"
import { MistakeReview } from "@/features/assessments/components/MistakeReview"
import { NextStepCard } from "@/features/assessments/components/NextStepCard"
import { ProgressComparison } from "@/features/assessments/components/ProgressComparison"
import { ResultHistory } from "@/features/assessments/components/ResultHistory"
import { ReadinessUpdateCard } from "@/features/assessments/components/ReadinessUpdateCard"
import { DailyPlanHandoffCard } from "@/features/assessments/components/DailyPlanHandoffCard"
import { AssessmentResultsPage } from "@/features/assessments/AssessmentResultsPage"
import type {
  SectionResult,
  MistakeItem,
  RecommendedExerciseResult,
  AssessmentHistoryItem,
  ProgressComparisonData,
  DailyPlanTaskSummary,
} from "@/features/assessments/types"

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("Student Assessment Results Experience (/attempts/:id/results)", () => {
  // 1. AssessmentResultHero
  describe("1. AssessmentResultHero", () => {
    it("renders score, CEFR level, points, confidence badge, and disclaimer", () => {
      render(
        <AssessmentResultHero
          scorePercentage={68.4}
          totalPoints={34}
          maxPoints={50}
          estimatedLevel="B1+"
          confidenceLabel="élevée"
          targetLevel="B2"
          targetGapExplanation="Progression à poursuivre vers le niveau B2"
          disclaimer="Notice d'évaluation indicative sans valeur de certification officielle."
        />
      )

      expect(screen.getAllByText("68%").length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText("B1+").length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/Points obtenus/i)).toBeInTheDocument()
      expect(screen.getByText("34")).toBeInTheDocument()
      expect(screen.getByText("50")).toBeInTheDocument()
      expect(screen.getByText(/Indice de confiance : Élevé/i)).toBeInTheDocument()
      expect(screen.getAllByText(/Notice d'évaluation indicative/i).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/sans valeur de certification officielle/i)).toBeInTheDocument()
      expect(screen.getByText(/Votre objectif :/i)).toBeInTheDocument()
      expect(screen.getByText("B2")).toBeInTheDocument()
      expect(screen.getByText("Progression à poursuivre vers le niveau B2")).toBeInTheDocument()
    })

    it("renders first diagnostic phrasing when isFirstDiagnostic is true", () => {
      render(
        <AssessmentResultHero
          scorePercentage={55}
          totalPoints={22}
          maxPoints={40}
          estimatedLevel="A2+"
          isFirstDiagnostic={true}
          disclaimer="Notice indicative."
        />
      )

      expect(screen.getByText("Votre première estimation de niveau")).toBeInTheDocument()
      expect(screen.getByText(/point de départ pour orienter vos priorités/i)).toBeInTheDocument()
      expect(screen.getByText(/Estimation préliminaire/i)).toBeInTheDocument()
    })
  })

  // 2. ResultSummary
  describe("2. ResultSummary", () => {
    it("renders comparative summary between sections when a significant delta exists", () => {
      render(
        <ResultSummary
          scorePercentage={68}
          sectionScores={[
            { title: "Compréhension écrite", percentage: 74 },
            { title: "Compréhension orale", percentage: 61 },
          ]}
        />
      )

      expect(screen.getByText(/Synthèse de performance/i)).toBeInTheDocument()
      expect(
        screen.getByText(
          /Votre performance en compréhension écrite \(74 %\) est actuellement plus solide que votre performance en compréhension orale \(61 %\)/i
        )
      ).toBeInTheDocument()
    })

    it("renders custom summaryText when provided by backend", () => {
      render(
        <ResultSummary
          scorePercentage={80}
          summaryText="Excellente régularité constatée sur l'ensemble des exercices."
        />
      )

      expect(
        screen.getByText("Excellente régularité constatée sur l'ensemble des exercices.")
      ).toBeInTheDocument()
    })
  })

  // 3. SectionResults
  describe("3. SectionResults", () => {
    const mockSections: SectionResult[] = [
      {
        id: "sec-1",
        title: "Compréhension écrite",
        order_index: 1,
        questions: [
          {
            id: "q-1",
            section_id: "sec-1",
            prompt: "Question 1",
            question_type: "single_choice",
            order_index: 1,
            level: "B2",
            difficulty: 2,
            points: 2,
            options: [],
            user_answer: {
              id: "ans-1",
              question_id: "q-1",
              selected_option_ids: [],
              is_correct: true,
              points_awarded: 2,
              answered_at: new Date().toISOString(),
            },
          },
          {
            id: "q-2",
            section_id: "sec-1",
            prompt: "Question 2",
            question_type: "single_choice",
            order_index: 2,
            level: "B2",
            difficulty: 3,
            points: 2,
            options: [],
            user_answer: {
              id: "ans-2",
              question_id: "q-2",
              selected_option_ids: [],
              is_correct: false,
              points_awarded: 0,
              answered_at: new Date().toISOString(),
            },
          },
        ],
      },
      {
        id: "sec-2",
        title: "Compréhension orale",
        order_index: 2,
        questions: [
          {
            id: "q-3",
            section_id: "sec-2",
            prompt: "Question 3",
            question_type: "single_choice",
            order_index: 1,
            level: "B2",
            difficulty: 2,
            points: 2,
            options: [],
            user_answer: {
              id: "ans-3",
              question_id: "q-3",
              selected_option_ids: [],
              is_correct: true,
              points_awarded: 2,
              answered_at: new Date().toISOString(),
            },
          },
        ],
      },
    ]

    it("renders sections with scores, points, and mastery badges", () => {
      render(<SectionResults sections={mockSections} />)

      expect(screen.getByText("Résultats par section d'épreuve")).toBeInTheDocument()
      expect(screen.getByText("Compréhension écrite")).toBeInTheDocument()
      expect(screen.getByText("50%")).toBeInTheDocument()
      expect(screen.getByText("En consolidation")).toBeInTheDocument()

      expect(screen.getByText("Compréhension orale")).toBeInTheDocument()
      expect(screen.getByText("100%")).toBeInTheDocument()
      expect(screen.getByText("Maîtrisé")).toBeInTheDocument()
    })
  })

  // 4. SkillBreakdown
  describe("4. SkillBreakdown", () => {
    it("renders skills and toggles expanded view when more than limit", () => {
      const skills = {
        "Grammaire et syntaxe": 75,
        "Vocabulaire en contexte": 60,
        "Inférences logiques": 45,
        "Idée principale": 85,
        "Repérage de détails": 50,
      }

      render(<SkillBreakdown skillScores={skills} initialLimit={3} />)

      expect(screen.getByText("Grammaire et syntaxe")).toBeInTheDocument()
      expect(screen.getByText("Vocabulaire en contexte")).toBeInTheDocument()
      expect(screen.getByText("Inférences logiques")).toBeInTheDocument()
      expect(screen.queryByText("Repérage de détails")).not.toBeInTheDocument()

      // Expand
      const expandBtn = screen.getByRole("button", { name: /Voir toutes les compétences/i })
      fireEvent.click(expandBtn)

      expect(screen.getByText("Repérage de détails")).toBeInTheDocument()
      expect(screen.getByText("50%")).toBeInTheDocument()

      // Collapse
      const collapseBtn = screen.getByRole("button", { name: /Réduire l'affichage/i })
      fireEvent.click(collapseBtn)
      expect(screen.queryByText("Repérage de détails")).not.toBeInTheDocument()
    })
  })

  // 5. StrengthsSection
  describe("5. StrengthsSection", () => {
    it("renders validated strengths and handles empty list", () => {
      const { rerender } = render(
        <StrengthsSection strengths={["Compréhension globale", "Vocabulaire courant"]} />
      )

      expect(screen.getByText("Vos points forts")).toBeInTheDocument()
      expect(screen.getByText("Compréhension globale")).toBeInTheDocument()
      expect(screen.getByText("Vocabulaire courant")).toBeInTheDocument()

      // Empty state
      rerender(<StrengthsSection strengths={[]} />)
      expect(screen.getByText(/Poursuivez vos entraînements réguliers/i)).toBeInTheDocument()
    })
  })

  // 6. WeaknessesSection
  describe("6. WeaknessesSection", () => {
    it("renders weaknesses and triggers onPracticeClick", () => {
      const onPractice = vi.fn()
      render(
        <WeaknessesSection
          weaknesses={["Inférences logiques B1", "Temps du passé"]}
          onPracticeClick={onPractice}
        />
      )

      expect(screen.getByText("À améliorer en priorité")).toBeInTheDocument()
      expect(screen.getByText("Inférences logiques B1")).toBeInTheDocument()
      expect(screen.getByText("Temps du passé")).toBeInTheDocument()

      const practiceBtns = screen.getAllByRole("button", { name: "Pratiquer" })
      fireEvent.click(practiceBtns[0])
      expect(onPractice).toHaveBeenCalledWith("Inférences logiques B1")
    })
  })

  // 7. MistakesSummary & 8. MistakeReview
  describe("7. MistakesSummary & 8. MistakeReview", () => {
    const mockMistakes: MistakeItem[] = [
      {
        question_id: "q-m1",
        prompt: "Quel connecteur convenait ?",
        level: "B2",
        points: 1,
        user_answer: "Cependant",
        correct_answer: "En revanche",
        explanation: "'En revanche' marque une opposition positive ou contrastée formelle.",
        skill_name: "Grammaire et syntaxe",
      },
      {
        question_id: "q-m2",
        prompt: "Quel est le ton de l'auteur ?",
        level: "B2",
        points: 1,
        user_answer: "Neutre",
        correct_answer: "Critique",
        explanation: "L'emploi des termes péjoratifs traduit une tonalité critique.",
        skill_name: "Inférences logiques",
      },
    ]

    it("MistakesSummary: aggregates count by skill and triggers review toggle", () => {
      const onToggle = vi.fn()
      render(
        <MistakesSummary
          mistakes={mockMistakes}
          isReviewOpen={false}
          onToggleReview={onToggle}
        />
      )

      expect(screen.getByText("Synthèse des erreurs")).toBeInTheDocument()
      expect(screen.getByText("Grammaire et syntaxe")).toBeInTheDocument()
      expect(screen.getByText("Inférences logiques")).toBeInTheDocument()

      const toggleBtn = screen.getByRole("button", { name: /Erreurs à revoir/i })
      fireEvent.click(toggleBtn)
      expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it("MistakeReview: displays prompt, student answer, correct answer, and explanation", () => {
      render(<MistakeReview mistakes={mockMistakes} />)

      expect(screen.getByText("Quel connecteur convenait ?")).toBeInTheDocument()
      expect(screen.getByText("Cependant")).toBeInTheDocument()
      expect(screen.getByText("En revanche")).toBeInTheDocument()
      expect(screen.getByText(/'En revanche' marque une opposition/i)).toBeInTheDocument()

      expect(screen.getByText("Quel est le ton de l'auteur ?")).toBeInTheDocument()
      expect(screen.getByText("Critique")).toBeInTheDocument()
    })
  })

  // 9. NextStepCard
  describe("9. NextStepCard", () => {
    const primaryRec: RecommendedExerciseResult = {
      id: "ex-101",
      title: "Exercice : Les connecteurs logiques en contexte",
      category: "reading",
      difficulty: 3,
      level: "B2",
      target_skill_name: "Grammaire et syntaxe",
      reason: "Recommandé suite à une erreur sur la question 'Quel connecteur convenait ?'.",
      priority: "high",
    }

    const secondaryRec: RecommendedExerciseResult = {
      id: "ex-102",
      title: "Exercice : Identifier l'implicite",
      category: "reading",
      difficulty: 3,
      level: "B2",
      target_skill_name: "Inférences",
      reason: "Priorité B2 identifiée.",
      priority: "medium",
    }

    it("renders primary recommendation and triggers onStartExercise", () => {
      const onStart = vi.fn()
      render(
        <NextStepCard
          primaryRecommendation={primaryRec}
          secondaryRecommendations={[secondaryRec]}
          onStartExercise={onStart}
          onExplorePractice={vi.fn()}
        />
      )

      expect(screen.getByText("Votre prochaine étape")).toBeInTheDocument()
      expect(screen.getByText("Exercice : Les connecteurs logiques en contexte")).toBeInTheDocument()
      expect(screen.getByText(/Recommandé suite à une erreur/i)).toBeInTheDocument()

      const startBtn = screen.getByRole("button", { name: /Démarrer l'exercice/i })
      fireEvent.click(startBtn)
      expect(onStart).toHaveBeenCalledWith("ex-101")

      // Secondary recommendation
      expect(screen.getByText("Exercice : Identifier l'implicite")).toBeInTheDocument()
      const commBtn = screen.getByRole("button", { name: "Commencer" })
      fireEvent.click(commBtn)
      expect(onStart).toHaveBeenCalledWith("ex-102")
    })

    it("renders fallback card when primary recommendation is null", () => {
      const onExplore = vi.fn()
      render(
        <NextStepCard
          primaryRecommendation={null}
          onStartExercise={vi.fn()}
          onExplorePractice={onExplore}
        />
      )

      expect(screen.getByText(/Poursuivez vos entraînements réguliers/i)).toBeInTheDocument()
      const exploreBtn = screen.getByRole("button", { name: /Voir les exercices/i })
      fireEvent.click(exploreBtn)
      expect(onExplore).toHaveBeenCalledTimes(1)
    })
  })

  // 10. ProgressComparison
  describe("10. ProgressComparison", () => {
    it("renders comparison delta when comparable previous attempt exists", () => {
      const comp: ProgressComparisonData = {
        previousAttempt: {
          id: "att-prev-1",
          assessment_id: "asmt-1",
          title: "Simulation TEF B1",
          assessment_type: "reading",
          level: "B1",
          score_percentage: 61,
          status: "submitted",
          started_at: "2026-09-12T10:00:00Z",
        },
        scoreDelta: 7,
        isImprovement: true,
        isComparable: true,
      }

      render(<ProgressComparison currentScorePercentage={68} comparison={comp} />)

      expect(screen.getByText("Votre progression")).toBeInTheDocument()
      expect(screen.getByText("+7 points")).toBeInTheDocument()
      expect(screen.getByText("61%")).toBeInTheDocument()
      expect(screen.getByText("68%")).toBeInTheDocument()
    })
  })

  // 11. ResultHistory
  describe("11. ResultHistory", () => {
    it("renders compact history excluding current attempt", () => {
      const history: AssessmentHistoryItem[] = [
        {
          id: "att-curr",
          assessment_id: "asmt-1",
          title: "Simulation B2 (Aujourd'hui)",
          assessment_type: "reading",
          level: "B2",
          score_percentage: 68,
          status: "submitted",
          started_at: "2026-09-19T10:00:00Z",
        },
        {
          id: "att-old",
          assessment_id: "asmt-1",
          title: "Simulation B1 (Semaine passée)",
          assessment_type: "reading",
          level: "B1",
          score_percentage: 61,
          status: "submitted",
          started_at: "2026-09-12T10:00:00Z",
        },
      ]

      const onAll = vi.fn()
      render(
        <ResultHistory
          history={history}
          currentAttemptId="att-curr"
          onViewAllHistory={onAll}
        />
      )

      expect(screen.getByText("Historique récent")).toBeInTheDocument()
      expect(screen.getByText("Simulation B1 (Semaine passée)")).toBeInTheDocument()
      expect(screen.queryByText("Simulation B2 (Aujourd'hui)")).not.toBeInTheDocument()

      const allBtn = screen.getByRole("button", { name: /Voir toute ma progression/i })
      fireEvent.click(allBtn)
      expect(onAll).toHaveBeenCalledTimes(1)
    })
  })

  // 12. ReadinessUpdateCard & 13. DailyPlanHandoffCard
  describe("12. ReadinessUpdateCard & 13. DailyPlanHandoffCard", () => {
    it("ReadinessUpdateCard: renders update notification and triggers onViewReadiness", () => {
      const onView = vi.fn()
      render(<ReadinessUpdateCard onViewReadiness={onView} />)

      expect(screen.getByText("Profil de préparation actualisé")).toBeInTheDocument()
      const btn = screen.getByRole("button", { name: "Voir votre préparation" })
      fireEvent.click(btn)
      expect(onView).toHaveBeenCalledTimes(1)
    })

    it("DailyPlanHandoffCard: renders pending tasks and triggers onViewPlan", () => {
      const tasks: DailyPlanTaskSummary[] = [
        {
          id: "task-1",
          title: "Quiz connecteurs logiques",
          task_type: "exercise",
          skill_name: "Grammaire",
          estimated_minutes: 10,
          priority: 1,
          is_completed: false,
        },
      ]
      const onView = vi.fn()
      render(<DailyPlanHandoffCard tasks={tasks} onViewPlan={onView} />)

      expect(screen.getByText("Continuer avec votre plan")).toBeInTheDocument()
      expect(screen.getByText("Quiz connecteurs logiques")).toBeInTheDocument()
      expect(screen.getByText("10 min")).toBeInTheDocument()

      const btn = screen.getByRole("button", { name: "Voir mon plan" })
      fireEvent.click(btn)
      expect(onView).toHaveBeenCalledTimes(1)
    })
  })

  // 14. Full Integration: AssessmentResultsPage
  describe("14. Full Integration: AssessmentResultsPage", () => {
    it("renders full results view and supports partial failure gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input)

        // Core results succeed
        if (url === "/api/v1/attempts/att-int-1/results") {
          return {
            ok: true,
            json: async () => ({
              attempt_id: "att-int-1",
              assessment_id: "asmt-full-1",
              user_id: "usr-1",
              status: "submitted",
              score: {
                id: "sc-int-1",
                attempt_id: "att-int-1",
                total_points: 28,
                max_points: 35,
                percentage: 80.0,
                is_passed: true,
                estimated_level: "B2",
                skill_scores: { "Compréhension globale": 85 },
                scored_at: new Date().toISOString(),
              },
              sections: [
                {
                  id: "sec-int-1",
                  title: "Section A - Lecture",
                  questions: [],
                },
              ],
              disclaimer: "Notice d'évaluation indicative.",
              strengths: ["Bonne compréhension globale"],
              weaknesses: ["Attention aux inférences"],
              mistakes: [
                {
                  question_id: "q-int-1",
                  prompt: "Question d'intégration",
                  level: "B2",
                  points: 1,
                  user_answer: "Option fausse",
                  correct_answer: "Option vraie",
                  explanation: "Explication pédagogique.",
                  skill_name: "Inférence",
                },
              ],
              recommended_exercises: [
                {
                  id: "ex-rec-1",
                  title: "Exercice de remédiation",
                  category: "reading",
                  difficulty: 3,
                  level: "B2",
                  target_skill_name: "Inférence",
                  reason: "Recommandé pour consolider.",
                  priority: "high",
                },
              ],
            }),
          } as Response
        }

        // Secondary services (simulate partial network failure for readiness and plan)
        if (url.includes("/readiness")) {
          return { ok: false, status: 503 } as Response
        }
        if (url.includes("/daily-plan")) {
          return { ok: false, status: 503 } as Response
        }
        if (url.includes("/history")) {
          return { ok: true, json: async () => [] } as Response
        }

        return { ok: false } as Response
      })

      render(
        <MemoryRouter initialEntries={["/attempts/att-int-1/results"]}>
          <Routes>
            <Route path="/attempts/:id/results" element={<AssessmentResultsPage />} />
          </Routes>
        </MemoryRouter>
      )

      // Score and core results still render despite secondary 503!
      await waitFor(() => {
        expect(screen.getAllByText("80%").length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText("B2").length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText("Exercice de remédiation")).toBeInTheDocument()
        expect(screen.getByText("Bonne compréhension globale")).toBeInTheDocument()
      })
    })

    it("renders normalized error state when core result fetch fails", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        return { ok: false, status: 404 } as Response
      })

      render(
        <MemoryRouter initialEntries={["/attempts/att-error/results"]}>
          <Routes>
            <Route path="/attempts/:id/results" element={<AssessmentResultsPage />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText("Résultats non disponibles")).toBeInTheDocument()
        expect(
          screen.getByText("Résultats introuvables pour cette session d'évaluation.")
        ).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Retour au tableau de bord" })).toBeInTheDocument()
      })
    })
  })
})
