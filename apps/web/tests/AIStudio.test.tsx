import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import {
  OverviewPage,
  AssessmentWritingPage,
  AssessmentSpeakingPage,
  ExaminerStudioPage,
  PromptLabPage,
  RunsPage,
  TemplatesPage,
  AIStudioAdminPage,
} from "@/features/admin/ai-studio";
import { AppRoutes } from "@/routes/AppRoutes";

describe("TEF AI Studio Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockBenchmarks = {
    samples: [
      {
        id: "bench-writing-sec-b-b2",
        title: "Section B — Interdiction des voitures (B2)",
        feature_type: "writing",
        section: "section_b",
        cefr_level: "B2",
        task_prompt: "La mairie veut interdire les voitures.",
        sample_content: "Monsieur le Rédacteur, Je vous écris pour soutenir ce projet écologique indispensable.",
        description: "Bonne production B2.",
        expected_score_range: "480-520 pts",
      },
      {
        id: "bench-speaking-sec-a",
        title: "Section A Oral — Atelier de cuisine",
        feature_type: "speaking",
        section: "section_a",
        cefr_level: "B2",
        task_prompt: "Renseignements pour un atelier de cuisine.",
        sample_content: "Bonjour, quels sont vos tarifs ?",
        description: "Section A formelle.",
        expected_score_range: "10 questions attendues",
      },
    ],
  };

  const mockTemplates = [
    {
      id: "tpl-1",
      name: "Correcteur TEF Écrit — Standard B2",
      description: "Prompt officiel d'évaluation",
      feature_type: "writing",
      system_prompt: "Tu es un examinateur expert officiel du TEF.",
      user_prompt_template: null,
      default_model: "models/gemini-3.5-flash",
      default_temperature: 0.3,
      is_system_preset: true,
      created_at: new Date().toISOString(),
    },
  ];

  const mockConfigs = [
    {
      id: "cfg-1",
      section: "section_a",
      model: "models/gemini-3.8-live",
      voice_persona: "Aoede",
      scepticism_level: 0.3,
      temperature: 0.7,
      top_p: 0.95,
      system_prompt: "Consigne officielle A",
      updated_at: new Date().toISOString(),
    },
    {
      id: "cfg-2",
      section: "section_b",
      model: "models/gemini-3.8-live",
      voice_persona: "Aoede",
      scepticism_level: 0.65,
      temperature: 0.7,
      top_p: 0.95,
      system_prompt: "Consigne officielle B",
      updated_at: new Date().toISOString(),
    },
  ];

  const mockRuns = {
    items: [
      {
        id: "run-1",
        feature_type: "writing",
        template_id: "tpl-1",
        model: "models/gemini-3.5-flash",
        temperature: 0.3,
        system_prompt: "Tu es un évaluateur.",
        user_prompt: "Corrige cette copie.",
        input_context: {},
        raw_output: "Bonne copie.",
        parsed_result: {
          score: 85,
          tef_points: 520,
          cefr_level: "B2",
        },
        latency_ms: 1200,
        prompt_tokens: 450,
        completion_tokens: 180,
        total_tokens: 630,
        estimated_cost_usd: 0.00035,
        is_simulation: false,
        created_at: new Date().toISOString(),
      },
      {
        id: "run-2",
        feature_type: "raw",
        template_id: null,
        model: "models/gemini-3.5-flash",
        temperature: 0.7,
        system_prompt: "Prompt test.",
        user_prompt: "Donne des conseils.",
        input_context: {},
        raw_output: "1. Vocabulaire 2. Grammaire",
        parsed_result: null,
        latency_ms: 800,
        prompt_tokens: 120,
        completion_tokens: 80,
        total_tokens: 200,
        estimated_cost_usd: 0.0001,
        is_simulation: true,
        created_at: new Date().toISOString(),
      },
    ],
    total: 2,
    page: 1,
    page_size: 25,
  };

  const setupFetchMock = () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/admin/ai-sandbox/benchmarks")) {
        return {
          ok: true,
          json: async () => mockBenchmarks,
        } as Response;
      }
      if (urlStr.includes("/admin/ai-sandbox/templates")) {
        return {
          ok: true,
          json: async () => mockTemplates,
        } as Response;
      }
      if (urlStr.includes("/admin/ai-sandbox/speaking/config")) {
        return {
          ok: true,
          json: async () => mockConfigs,
        } as Response;
      }
      if (urlStr.includes("/admin/ai-sandbox/runs")) {
        return {
          ok: true,
          json: async () => mockRuns,
        } as Response;
      }
      if (urlStr.includes("/admin/ai-sandbox/run/writing")) {
        return {
          ok: true,
          json: async () => ({
            result: {
              score: 88,
              tef_points: 540,
              cefr_level: "B2",
              criteria: {
                task_completion: 22,
                coherence_cohesion: 23,
                vocabulary_range_accuracy: 21,
                grammatical_range_accuracy: 22,
              },
              strengths: ["Bonne cohérence globale"],
              weaknesses: ["Quelques répétitions"],
              errors: [
                {
                  error_text: "des nuisances sonores",
                  start_index: 0,
                  end_index: 20,
                  error_type: "lexique",
                  suggestion: "nuisances acoustiques",
                  explanation: "Précision du registre.",
                },
              ],
              corrected_text: "Texte corrigé",
              recommendations: ["Varier les connecteurs"],
              overall_feedback: "Très bonne copie de niveau B2.",
            },
            run: mockRuns.items[0],
          }),
        } as Response;
      }
      if (urlStr.includes("/admin/ai-sandbox/run/speaking/evaluate")) {
        return {
          ok: true,
          json: async () => ({
            result: {
              tef_points: 490,
              cefr_level: "B2",
              score: 80,
              pronunciation_fluency: 20,
              lexical_resource: 20,
              grammatical_accuracy: 20,
              interaction_coherence: 20,
              strengths: ["Bon débit"],
              weaknesses: ["Hésitations mineures"],
              recommendations: ["Travailler l'intonation"],
              examiner_feedback: "Échange fluide et dynamique.",
            },
            run: mockRuns.items[0],
          }),
        } as Response;
      }
      if (urlStr.includes("/admin/ai-sandbox/compare")) {
        return {
          ok: true,
          json: async () => ({
            run_a: mockRuns.items[0],
            run_b: mockRuns.items[1],
            score_difference: 5,
            latency_difference_ms: -400,
            token_difference: -430,
            prompt_diff_summary: "Température passée de 0.3 à 0.7",
            evaluation_diff_summary: "Variation de score minime (+5 pts)",
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    });
  };

  it("renders the OverviewPage with active production examiner configurations and quick action cards", async () => {
    setupFetchMock();
    render(
      <BrowserRouter>
        <OverviewPage />
      </BrowserRouter>
    );

    expect(screen.getByText("Vue d'ensemble — TEF AI Studio")).toBeInTheDocument();
    expect(screen.getByText("Tester l'Écrit")).toBeInTheDocument();
    expect(screen.getByText("Examinateur Vocal Live")).toBeInTheDocument();
    expect(screen.getAllByText("Prompt Lab").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Runs & Comparateur").length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(screen.getByText("Section A (5 min)")).toBeInTheDocument();
      expect(screen.getByText("Section B (10 min)")).toBeInTheDocument();
    });
  });

  it("executes writing evaluation and displays official TEF criteria breakdown", async () => {
    setupFetchMock();
    render(
      <BrowserRouter>
        <AssessmentWritingPage />
      </BrowserRouter>
    );

    expect(screen.getByText("Atelier Écrit — Calibration & Grille TEF")).toBeInTheDocument();

    // Click benchmark
    await waitFor(() => {
      expect(screen.getByText("B2 — SECTION_B")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("B2 — SECTION_B"));

    // Run evaluation
    const evaluateBtn = screen.getByTestId("run-writing-evaluation-btn");
    fireEvent.click(evaluateBtn);

    await waitFor(() => {
      expect(screen.getByText("Score Officiel TEF Écrit")).toBeInTheDocument();
      expect(screen.getByText("540")).toBeInTheDocument();
      expect(screen.getByText("Niveau B2")).toBeInTheDocument();
      expect(screen.getByText("Adéquation à la Consigne")).toBeInTheDocument();
      expect(screen.getAllByText("22 / 25").length).toBe(2);
    });
  });

  it("renders ExaminerStudioPage with split layout, live session controls, and production deployment modal", async () => {
    setupFetchMock();
    render(
      <BrowserRouter>
        <ExaminerStudioPage />
      </BrowserRouter>
    );

    expect(screen.getByText("Examinateur Studio — Simulation & Calibration Live")).toBeInTheDocument();
    expect(screen.getByText("Miroir Candidat (Student POV)")).toBeInTheDocument();
    expect(screen.getByText("Cockpit & Réglages Examinateur")).toBeInTheDocument();

    // Open deployment modal
    const deployBtn = screen.getByTestId("deploy-speaking-config-btn");
    fireEvent.click(deployBtn);

    expect(screen.getByText(/Déploiement en Production/i)).toBeInTheDocument();
    expect(screen.getByTestId("confirm-deploy-prod-btn")).toBeInTheDocument();
  });

  it("renders RunsPage and triggers A/B comparison modal when two runs are selected", async () => {
    setupFetchMock();
    render(
      <BrowserRouter>
        <RunsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Runs & Benchmarks — Historique & Comparateur")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    const compareBtn = screen.getByTestId("compare-runs-btn");
    expect(compareBtn).not.toBeDisabled();
    fireEvent.click(compareBtn);

    await waitFor(() => {
      expect(screen.getByText("Rapport Comparatif Différentiel A / B")).toBeInTheDocument();
      expect(screen.getByText("Écart de Score")).toBeInTheDocument();
    });
  });

  it("renders AIStudioAdminPage with simulation toggle and BYOK key manager", async () => {
    setupFetchMock();
    render(
      <BrowserRouter>
        <AIStudioAdminPage />
      </BrowserRouter>
    );

    expect(screen.getByText("Administration & Clés — Gouvernance IA")).toBeInTheDocument();
    expect(screen.getByText("Clé d'API Personnelle (BYOK)")).toBeInTheDocument();

    const simBtn = screen.getByTestId("toggle-simulation-btn");
    fireEvent.click(simBtn);
  });

  it("redirects legacy /admin/ai-sandbox to /admin/ai-studio", async () => {
    setupFetchMock();
    window.history.pushState({}, "Legacy Sandbox", "/admin/ai-sandbox");
    render(<AppRoutes />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/admin/ai-studio");
      expect(screen.getByText("Vue d'ensemble — TEF AI Studio")).toBeInTheDocument();
    });
  });
});
