/**
 * Comprehensive unit test suite for StimulusRenderer component.
 * Validates:
 * 1. Plain text rendering & automatic word count calculation
 * 2. Multi-document bundles (tabs, tab switching, activeDocumentKey highlights)
 * 3. Markdown statistical tables parsing and rendering
 * 4. Listening audio transcripts (acoustic cues and speaker dialogue bubbles)
 * 5. In-place expansion toggle (Agrandir / Réduire)
 * 6. Empty content fallback handling
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { StimulusRenderer } from "@/features/admin/questions/components/StimulusRenderer";

describe("StimulusRenderer Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders plain text stimulus with title, CEFR badge, and word count", () => {
    render(
      <StimulusRenderer
        title="Chronique environnementale"
        content="La transition écologique dans les transports urbains progresse rapidement à travers le pays."
        sourceCitation="Le Monde, 2024"
        cefrLevel="B2"
      />
    );

    expect(screen.getByText("Chronique environnementale")).toBeDefined();
    expect(screen.getByText("B2")).toBeDefined();
    expect(screen.getByText(/Le Monde, 2024/)).toBeDefined();
    // Verify word count display
    expect(screen.getByText(/13 mots/)).toBeDefined();
    expect(
      screen.getByText("La transition écologique dans les transports urbains progresse rapidement à travers le pays.")
    ).toBeDefined();
  });

  it("renders multi-document bundles with interactive tabs and switches active tab", () => {
    const multiDocContent = `
=== DOCUMENT A : Règlements de copropriété ===
L'accès au parking souterrain est réservé aux résidents munis d'un badge sécurisé.

=== DOCUMENT B : Courriel du syndic ===
Veuillez noter que des travaux de maintenance auront lieu ce jeudi dès 8h.
    `.trim();

    const onSelectDocMock = vi.fn();

    render(
      <StimulusRenderer
        title="Dossier comparatif"
        content={multiDocContent}
        textFormat="multi_doc"
        activeDocumentKey="doc_b"
        onSelectDocument={onSelectDocMock}
      />
    );

    // Verify tabs rendered
    expect(screen.getByText(/Tous les documents/)).toBeDefined();
    expect(screen.getByText("Doc A")).toBeDefined();
    expect(screen.getByText("Doc B")).toBeDefined();

    // Verify document titles
    expect(screen.getByText("Document A")).toBeDefined();
    expect(screen.getByText("Règlements de copropriété")).toBeDefined();
    expect(screen.getByText("Document B")).toBeDefined();
    expect(screen.getByText("Courriel du syndic")).toBeDefined();

    // Click on Doc B tab
    fireEvent.click(screen.getByText("Doc B"));
    expect(onSelectDocMock).toHaveBeenCalledWith("doc_b");

    // In single Doc B view, Doc A body should not be rendered
    expect(screen.queryByText(/L'accès au parking souterrain/)).toBeNull();
    expect(screen.getByText(/Veuillez noter que des travaux de maintenance/)).toBeDefined();
  });

  it("renders markdown statistical table correctly", () => {
    const tableContent = `
| Mode de transport | Part modale (%) | Évolution 2020-2024 |
|-------------------|-----------------|---------------------|
| Vélo              | 14.5%           | +3.2%               |
| Transports en com | 42.0%           | +1.8%               |
| Voiture           | 43.5%           | -5.0%               |
    `.trim();

    render(
      <StimulusRenderer
        title="Données statistiques"
        content={tableContent}
        textFormat="table"
      />
    );

    expect(screen.getByText("Données statistiques")).toBeDefined();
    expect(screen.getByText("Mode de transport")).toBeDefined();
    expect(screen.getByText("Part modale (%)")).toBeDefined();
    expect(screen.getByText("Vélo")).toBeDefined();
    expect(screen.getByText("14.5%")).toBeDefined();
    expect(screen.getByText("Voiture")).toBeDefined();
  });

  it("renders acoustic sound cues and speaker dialogue in audio transcript mode", () => {
    const transcriptContent = `
[Sonnette de porte d'entrée]
Madame Dupont : Bonjour Monsieur, je viens pour la visite de l'appartement.
Agent immobilier : Bonjour Madame, entrez je vous en prie.
[Bruit de clés qui s'entrechoquent]
    `.trim();

    render(
      <StimulusRenderer
        title="Dialogue agence immobilière"
        content={transcriptContent}
        modality="listening"
      />
    );

    // Acoustic cues rendered as sound badges
    expect(screen.getByText(/Sonnette de porte d'entrée/)).toBeDefined();
    expect(screen.getByText(/Bruit de clés qui s'entrechoquent/)).toBeDefined();

    // Speaker turns
    expect(screen.getByText("Madame Dupont")).toBeDefined();
    expect(screen.getByText("Agent immobilier")).toBeDefined();
    expect(screen.getByText(/je viens pour la visite de l'appartement/)).toBeDefined();
  });

  it("toggles the in-place expansion mode", () => {
    render(
      <StimulusRenderer
        title="Texte pour expansion"
        content="Contenu textuel détaillé pour tester l'agrandissement."
        enableExpandModal={true}
      />
    );

    const expandButton = screen.getByTitle("Agrandir");
    expect(expandButton).toBeDefined();

    // Click expand
    fireEvent.click(expandButton);

    // Button title should now be "Réduire"
    const collapseButton = screen.getByTitle("Réduire");
    expect(collapseButton).toBeDefined();

    // Click collapse
    fireEvent.click(collapseButton);

    // Button title should revert to "Agrandir"
    expect(screen.getByTitle("Agrandir")).toBeDefined();
  });

  it("renders graceful empty state when content is missing", () => {
    render(
      <StimulusRenderer
        title="Document vide"
        content=""
      />
    );

    expect(screen.getByText("Aucun contenu de support disponible.")).toBeDefined();
  });
});
