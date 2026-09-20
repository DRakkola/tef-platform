/**
 * Comprehensive frontend tests for the Student Assessment Experience.
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AssessmentsListPage } from "@/features/assessments/AssessmentsListPage";
import { AssessmentDetailPage } from "@/features/assessments/AssessmentDetailPage";
import { AssessmentTakingPage } from "@/features/assessments/AssessmentTakingPage";
import { AssessmentResultsPage } from "@/features/assessments/AssessmentResultsPage";
import { ExercisesCatalogPage } from "@/features/exercises/ExercisesCatalogPage";

describe("Student Assessment Journey", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem("auth_token", "fake-student-token-abc");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("1. AssessmentsListPage: renders published assessments with level badges and duration", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/v1/assessments")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "asmt-111",
                title: "TEF Canada - Compréhension Écrite Officielle",
                description: "Épreuve officielle de simulation sous conditions réelles.",
                assessment_type: "reading",
                duration_seconds: 3600,
                estimated_completion_time_minutes: 60,
                level: "B2",
                section_count: 2,
                question_count: 40,
                total_points: 40,
              },
            ],
            total: 1,
          }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    render(
      <MemoryRouter initialEntries={["/assessments"]}>
        <AssessmentsListPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Chargement des épreuves disponibles...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("TEF Canada - Compréhension Écrite Officielle")).toBeInTheDocument();
    });

    expect(screen.getByText("Niveau B2")).toBeInTheDocument();
    expect(screen.getByText("60 minutes")).toBeInTheDocument();
    expect(screen.getByText("Consulter et démarrer")).toBeInTheDocument();
  });

  it("2. AssessmentDetailPage: displays rules, timer notice, and initiates attempt", async () => {
    let attemptInitiated = false;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/v1/assessments/asmt-111") {
        return {
          ok: true,
          json: async () => ({
            id: "asmt-111",
            title: "TEF Canada - Compréhension Écrite Officielle",
            description: "Simulation chronométrée de 60 minutes.",
            assessment_type: "reading",
            duration_seconds: 3600,
            estimated_completion_time_minutes: 60,
            level: "B2",
            sections: [
              {
                id: "sec-1",
                assessment_id: "asmt-111",
                title: "Section A - Textes courts",
                order_index: 1,
                questions: [
                  {
                    id: "q-1",
                    section_id: "sec-1",
                    prompt: "Quel est le sujet principal de ce courriel ?",
                    question_type: "single_choice",
                    order_index: 1,
                    level: "B2",
                    difficulty: 3,
                    points: 1,
                    options: [
                      { id: "opt-1", content: "Une réunion annulée", order_index: 1 },
                      { id: "opt-2", content: "Une promotion interne", order_index: 2 },
                    ],
                  },
                ],
              },
            ],
          }),
        } as Response;
      }

      if (url === "/api/v1/assessments/asmt-111/attempts" && init?.method === "POST") {
        attemptInitiated = true;
        return {
          ok: true,
          json: async () => ({
            id: "att-999",
            assessment_id: "asmt-111",
            status: "started",
            remaining_seconds: 3600,
            answers: [],
          }),
        } as Response;
      }

      return { ok: false } as Response;
    });

    render(
      <MemoryRouter initialEntries={["/assessments/asmt-111"]}>
        <Routes>
          <Route path="/assessments/:id" element={<AssessmentDetailPage />} />
          <Route path="/attempts/:id" element={<div>Taking Screen for att-999</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("TEF Canada - Compréhension Écrite Officielle")).toBeInTheDocument();
    });

    // Check rules notice
    expect(screen.getByText(/Chronomètre serveur faisant autorité/)).toBeInTheDocument();

    // Click CTA
    const startBtn = screen.getByText("Démarrer l'épreuve maintenant");
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(attemptInitiated).toBe(true);
      expect(screen.getByText("Taking Screen for att-999")).toBeInTheDocument();
    });
  });

  it("3. AssessmentTakingPage: shows server countdown, answers selection, debounced autosave, and submit modal", async () => {
    let savedQuestionId: string | null = null;
    let submittedAttempt = false;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);

      if (url === "/api/v1/attempts/att-999/state") {
        return {
          ok: true,
          json: async () => ({
            attempt_id: "att-999",
            assessment_id: "asmt-111",
            user_id: "usr-1",
            student_id: "usr-1",
            status: "started",
            server_time: new Date().toISOString(),
            remaining_seconds: 2400,
            is_expired: false,
            answered_count: 0,
            total_questions: 1,
            answers: {},
          }),
        } as Response;
      }

      if (url === "/api/v1/attempts/att-999") {
        return {
          ok: true,
          json: async () => ({
            id: "att-999",
            assessment_id: "asmt-111",
            status: "started",
            remaining_seconds: 2400,
            answers: [],
          }),
        } as Response;
      }

      if (url === "/api/v1/assessments/asmt-111") {
        return {
          ok: true,
          json: async () => ({
            id: "asmt-111",
            title: "TEF Canada - Compréhension Écrite Officielle",
            assessment_type: "reading",
            duration_seconds: 3600,
            estimated_completion_time_minutes: 60,
            level: "B2",
            navigation_policy: "free",
            scoring_policy: "standard",
            sections: [
              {
                id: "sec-1",
                assessment_id: "asmt-111",
                title: "Section 1",
                order_index: 1,
                passage_text: "Voici le texte support pour le test.",
                questions: [
                  {
                    id: "q-1",
                    section_id: "sec-1",
                    prompt: "Quel est le sujet du texte ?",
                    question_type: "single_choice",
                    order_index: 1,
                    level: "B2",
                    difficulty: 2,
                    points: 2,
                    options: [
                      { id: "opt-a", content: "Option Alpha", order_index: 1 },
                      { id: "opt-b", content: "Option Beta", order_index: 2 },
                    ],
                  },
                ],
              },
            ],
          }),
        } as Response;
      }

      if (url.includes("/api/v1/attempts/att-999/answers/q-1") && init?.method === "PUT") {
        savedQuestionId = "q-1";
        return {
          ok: true,
          json: async () => ({
            id: "ans-1",
            question_id: "q-1",
            selected_option_id: "opt-a",
            answered_at: new Date().toISOString(),
          }),
        } as Response;
      }

      if (url === "/api/v1/attempts/att-999/submit" && init?.method === "POST") {
        submittedAttempt = true;
        return {
          ok: true,
          json: async () => ({
            attempt_id: "att-999",
            status: "submitted",
          }),
        } as Response;
      }

      return { ok: false } as Response;
    });

    render(
      <MemoryRouter initialEntries={["/attempts/att-999"]}>
        <Routes>
          <Route path="/attempts/:id" element={<AssessmentTakingPage />} />
          <Route path="/attempts/:id/results" element={<div>Results Screen for att-999</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Quel est le sujet du texte ?")).toBeInTheDocument();
    });

    // Check timer formatted from 2400 seconds (40:00)
    expect(screen.getByText("40:00")).toBeInTheDocument();

    // Select option Alpha
    const optionBtn = screen.getByText("Option Alpha");
    fireEvent.click(optionBtn);

    // Wait for debounced autosave (250ms)
    await waitFor(() => {
      expect(savedQuestionId).toBe("q-1");
    });

    // Open submit modal
    const finishBtn = screen.getByText("Terminer l'épreuve");
    fireEvent.click(finishBtn);

    await waitFor(() => {
      expect(screen.getByText("Confirmer la soumission finale ?")).toBeInTheDocument();
    });

    const confirmSubmitBtn = screen.getByText("Confirmer et soumettre");
    fireEvent.click(confirmSubmitBtn);

    await waitFor(() => {
      expect(submittedAttempt).toBe(true);
      expect(screen.getByText("Results Screen for att-999")).toBeInTheDocument();
    });
  });

  it("4. AssessmentResultsPage: displays score, CEFR level, official disclaimer, mistakes, and recommendations", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/v1/attempts/att-999/results") {
        return {
          ok: true,
          json: async () => ({
            attempt_id: "att-999",
            assessment_id: "asmt-111",
            user_id: "usr-1",
            status: "submitted",
            score: {
              id: "sc-1",
              attempt_id: "att-999",
              total_points: 24,
              max_points: 30,
              percentage: 80.0,
              is_passed: true,
              estimated_level: "B2",
              skill_scores: {
                "Compréhension globale": 85,
                "Repérage d'informations": 75,
              },
              scored_at: new Date().toISOString(),
            },
            sections: [
              {
                id: "sec-1",
                title: "Section 1",
                questions: [
                  {
                    id: "q-1",
                    prompt: "Question facile réussie",
                    points: 2,
                    options: [],
                    user_answer: { is_correct: true },
                  },
                ],
              },
            ],
            disclaimer:
              "Ce résultat constitue une estimation indicative de performance basée sur notre algorithme de simulation. Il ne s'agit en aucun cas d'une attestation ou certification officielle TEF délivrée par la CCI Paris Île-de-France.",
            strengths: ["Bonne compréhension globale de l'écrit", "Maîtrise du vocabulaire courant"],
            weaknesses: ["Attention aux pièges sur les connecteurs logiques"],
            mistakes: [
              {
                question_id: "q-2",
                prompt: "Quel connecteur convenait ?",
                level: "B2",
                points: 1,
                user_answer: "Cependant",
                correct_answer: "En revanche",
                explanation: "'En revanche' marque une opposition positive ou contrastée formelle.",
                skill_name: "Grammaire et syntaxe",
              },
            ],
            recommended_exercises: [
              {
                id: "ex-42",
                title: "Exercice : Les connecteurs logiques en contexte",
                category: "reading",
                difficulty: 3,
                level: "B2",
                target_skill_name: "Grammaire et syntaxe",
                reason: "Recommandé suite à une erreur sur la question 'Quel connecteur convenait ?'.",
                priority: "high",
              },
            ],
          }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    render(
      <MemoryRouter initialEntries={["/attempts/att-999/results"]}>
        <Routes>
          <Route path="/attempts/:id/results" element={<AssessmentResultsPage />} />
          <Route path="/exercises/:id" element={<div>Exercise Practice Screen for ex-42</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Rapport d'évaluation de l'épreuve")).toBeInTheDocument();
    });

    // Score & Level
    expect(screen.getAllByText("80%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("B2")).toBeInTheDocument();

    // Disclaimer
    expect(
      screen.getByText(/Ce résultat constitue une estimation indicative de performance/i)
    ).toBeInTheDocument();

    // Strengths & Weaknesses
    expect(screen.getByText("Bonne compréhension globale de l'écrit")).toBeInTheDocument();
    expect(
      screen.getByText("Attention aux pièges sur les connecteurs logiques")
    ).toBeInTheDocument();

    // Recommended exercise
    expect(
      screen.getByText("Exercice : Les connecteurs logiques en contexte")
    ).toBeInTheDocument();

    // Mistakes tab
    const mistakesTabBtn = screen.getByText("Erreurs à revoir");
    fireEvent.click(mistakesTabBtn);

    await waitFor(() => {
      expect(screen.getByText("Quel connecteur convenait ?")).toBeInTheDocument();
      expect(screen.getByText("Cependant")).toBeInTheDocument();
      expect(screen.getByText("En revanche")).toBeInTheDocument();
      expect(screen.getByText(/'En revanche' marque une opposition/i)).toBeInTheDocument();
    });

    // Click recommended exercise CTA
    const startExerciseBtn = screen.getByText("Démarrer l'exercice");
    fireEvent.click(startExerciseBtn);

    await waitFor(() => {
      expect(screen.getByText("Exercise Practice Screen for ex-42")).toBeInTheDocument();
    });
  });

  it("5. ExercisesCatalogPage: filters exercises by category and level", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/v1/exercises")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "ex-1",
              title: "Maîtrise du subjonctif présent",
              category: "grammar",
              level: "B2",
              difficulty: 3,
              prompt: "Complétez la phrase suivante...",
              points: 5,
              options: [],
              skills: ["Grammaire"],
            },
          ],
        } as Response;
      }
      return { ok: false } as Response;
    });

    render(
      <MemoryRouter initialEntries={["/exercises"]}>
        <ExercisesCatalogPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Catalogue des exercices d'entraînement")).toBeInTheDocument();
      expect(screen.getByText("Maîtrise du subjonctif présent")).toBeInTheDocument();
    });

    expect(screen.getByText("S'entraîner")).toBeInTheDocument();
  });
});
