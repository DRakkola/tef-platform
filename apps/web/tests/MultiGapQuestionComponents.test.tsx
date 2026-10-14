/**
 * Comprehensive tests for Multi-Gap / Cloze Question UI Components.
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { QuestionQuickPreviewModal } from "@/features/admin/questions/QuestionQuickPreviewModal";
import { GapFillEditor } from "@/features/admin/questions/GapFillEditor";
import { PreviewTab } from "@/features/admin/questions/PreviewTab";
import { QuestionStudentSimulatorTab } from "@/features/admin/questions/redesign/QuestionStudentSimulatorTab";
import { QuestionMainEditorTab } from "@/features/admin/questions/redesign/QuestionMainEditorTab";
import type { QuestionItem } from "@/features/admin/types";

describe("Multi-Gap Question Components Suite", () => {
  afterEach(() => {
    cleanup();
  });

  const mockMultiGapQuestion: QuestionItem = {
    id: "mg-001-uuid",
    prompt: "Complétez le texte en choisissant la meilleure option pour chacune des deux lacunes.",
    question_type: "text_input",
    response_type: "gap_fill",
    points: 2,
    penalty_points: 0,
    difficulty: 2,
    level: "B1",
    target_cefr: "B1",
    status: "draft",
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stimulus: {
      id: "stim-mg-1",
      title: "Service client — Enquête de satisfaction",
      content: "Pour rester en permanence __________ (1) de ses clients, la société InfoPro réalise chaque trimestre une enquête. Un __________ (2) est envoyé à chaque client.",
      cefr_level: "B1",
      modality: "reading",
    },
    scoring_payload: {
      gaps: [
        {
          gap_id: "1",
          order_index: 0,
          cue_text: "Expression signifiant prêter attention",
          options: [
            { content: "au sens", is_correct: false, order_index: 0, distractor_rationale: "Sens inadapté" },
            { content: "à l'écoute", is_correct: true, order_index: 1, explanation: "Expression consacrée" },
          ],
        },
        {
          gap_id: "2",
          order_index: 1,
          cue_text: "Document envoyé aux clients",
          options: [
            { content: "examen", is_correct: false, order_index: 0, distractor_rationale: "Évaluation de connaissances" },
            { content: "questionnaire", is_correct: true, order_index: 1, explanation: "Document d'enquête" },
          ],
        },
      ],
    },
    options: [
      { id: "o1", content: "[1] au sens", is_correct: false },
      { id: "o2", content: "[1] à l'écoute", is_correct: true },
      { id: "o3", content: "[2] examen", is_correct: false },
      { id: "o4", content: "[2] questionnaire", is_correct: true },
    ],
  };

  it("renders QuestionQuickPreviewModal with multi-gap cards and highlighted stimulus", () => {
    render(
      <QuestionQuickPreviewModal
        question={mockMultiGapQuestion}
        isOpen={true}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    // Format badge
    expect(screen.getByText(/Texte à trous • 2 lacunes/i)).toBeInTheDocument();

    // Stimulus title
    expect(screen.getByText(/Service client — Enquête de satisfaction/i)).toBeInTheDocument();

    // Gap headers
    expect(screen.getByText("Trou [1]")).toBeInTheDocument();
    expect(screen.getByText("Trou [2]")).toBeInTheDocument();

    // Cue texts
    expect(screen.getByText("Expression signifiant prêter attention")).toBeInTheDocument();
    expect(screen.getByText("Document envoyé aux clients")).toBeInTheDocument();

    // Options inside gaps
    expect(screen.getByText("au sens")).toBeInTheDocument();
    expect(screen.getByText("à l'écoute")).toBeInTheDocument();
    expect(screen.getByText("questionnaire")).toBeInTheDocument();
  });

  it("renders GapFillEditor and synthesizes flattened options on modification", () => {
    const handleChange = vi.fn();

    render(
      <GapFillEditor
        metadata={mockMultiGapQuestion.scoring_payload || {}}
        stimulusText={mockMultiGapQuestion.stimulus?.content}
        onChange={handleChange}
      />
    );

    // Reference passage
    expect(screen.getByText(/Passage de référence \(issu du stimulus associé\)/i)).toBeInTheDocument();

    // Gap cards
    expect(screen.getByText("Trou [1]")).toBeInTheDocument();
    expect(screen.getByText("Trou [2]")).toBeInTheDocument();

    // Modify cue text of Trou [1]
    const cueInput = screen.getByDisplayValue("Expression signifiant prêter attention");
    fireEvent.change(cueInput, { target: { value: "Nouvelle description" } });

    expect(handleChange).toHaveBeenCalled();
    const [updatedMeta, synthesizedOptions] = handleChange.mock.calls[0];

    // Verify metadata
    expect(updatedMeta.gaps[0].cue_text).toBe("Nouvelle description");

    // Verify options synthesis
    expect(synthesizedOptions).toBeDefined();
    expect(synthesizedOptions.length).toBe(4);
    expect(synthesizedOptions[0].content).toBe("[1] au sens");
    expect(synthesizedOptions[1].content).toBe("[1] à l'écoute");
    expect(synthesizedOptions[1].is_correct).toBe(true);
    expect(synthesizedOptions[2].content).toBe("[2] examen");
    expect(synthesizedOptions[3].content).toBe("[2] questionnaire");
  });

  it("renders PreviewTab in student interactive mode and admin diagnostic mode", () => {
    const { rerender } = render(<PreviewTab question={mockMultiGapQuestion} />);

    // Default mode is student
    expect(screen.getByText(/Options par lacune \(2 trous à compléter\)/i)).toBeInTheDocument();
    expect(screen.getByText("0 / 2 sélectionné(s)")).toBeInTheDocument();

    // Click option in Trou [1]
    const optionNode = screen.getByText("à l'écoute");
    fireEvent.click(optionNode);
    expect(screen.getByText("1 / 2 sélectionné(s)")).toBeInTheDocument();

    // Switch to Admin review mode
    const adminModeBtn = screen.getByText(/Aperçu Révision Enseignant/i);
    fireEvent.click(adminModeBtn);

    // Check teacher breakdown
    expect(screen.getByText(/Grille des réponses et analyse des distracteurs par trou/i)).toBeInTheDocument();
    expect(screen.getAllByText(/RÉPONSE CORRECTE/i).length).toBe(2);
    expect(screen.getByText(/Document d'enquête/i)).toBeInTheDocument();
  });

  it("renders QuestionStudentSimulatorTab with authentic candidate mode and didactic correction mode", () => {
    render(<QuestionStudentSimulatorTab question={mockMultiGapQuestion} />);

    // Simulator Header and Controls
    expect(screen.getByText(/Vue Candidat \(Examen réel\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Vue Correction \(Didactique\)/i)).toBeInTheDocument();

    // Stimulus with highlighted gap badges
    expect(screen.getAllByText(/Trou/i).length).toBeGreaterThan(0);

    // Multi-gap response sections
    expect(screen.getByText("Lacune (1)")).toBeInTheDocument();
    expect(screen.getByText("Lacune (2)")).toBeInTheDocument();

    // Initial counter: 0 / 2 répondu(s)
    expect(screen.getByText("0 / 2 répondu(s)")).toBeInTheDocument();

    // Click option "à l'écoute" in Lacune 1
    const optToClick = screen.getByText("à l'écoute");
    fireEvent.click(optToClick);
    expect(screen.getByText("1 / 2 répondu(s)")).toBeInTheDocument();

    // Switch to Correction mode
    const correctionBtn = screen.getByText(/Vue Correction \(Didactique\)/i);
    fireEvent.click(correctionBtn);

    // Correct response badges
    expect(screen.getAllByText(/Bonne réponse/i).length).toBe(2);
    expect(screen.getByText(/Expression consacrée/i)).toBeInTheDocument();
  });

  it("renders QuestionMainEditorTab with effectiveType as gap_fill and renders GapFillEditor", () => {
    const handlePatch = vi.fn();
    render(<QuestionMainEditorTab question={mockMultiGapQuestion} onPatch={handlePatch} />);

    // Format select element should be gap_fill
    const formatSelect = screen.getByDisplayValue("Texte à trous (Gap fill)");
    expect(formatSelect).toBeInTheDocument();

    // GapFillEditor cards present
    expect(screen.getByText("Trou [1]")).toBeInTheDocument();
    expect(screen.getByText("Trou [2]")).toBeInTheDocument();
  });

  it("allows adding and removing options per gap in GapFillEditor", () => {
    const handleChange = vi.fn();
    render(
      <GapFillEditor
        metadata={mockMultiGapQuestion.scoring_payload || {}}
        onChange={handleChange}
      />
    );

    // Look for "Ajouter une proposition" buttons (one per gap)
    const addOptionButtons = screen.getAllByText(/Ajouter une proposition/i);
    expect(addOptionButtons.length).toBe(2);

    // Click to add option to Gap 1
    fireEvent.click(addOptionButtons[0]);

    expect(handleChange).toHaveBeenCalled();
    const [updatedMeta, synthesized] = handleChange.mock.calls[0];
    expect(updatedMeta.gaps[0].options.length).toBe(3);
    expect(synthesized.length).toBe(5);
  });
});
