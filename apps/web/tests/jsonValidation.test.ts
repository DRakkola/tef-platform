import { describe, it, expect } from "vitest";
import {
  normalizePastedQuestionsJson,
  validateQuestionItemsClientSide,
} from "@/features/admin/questions/jsonValidation";

describe("jsonValidation utility", () => {
  describe("normalizePastedQuestionsJson", () => {
    it("handles array of questions directly", () => {
      const json = JSON.stringify([{ prompt: "Q1" }, { prompt: "Q2" }]);
      const res = normalizePastedQuestionsJson(json);
      expect(res.error).toBeUndefined();
      expect(res.items).toHaveLength(2);
    });

    it("handles wrapped { items: [...] }", () => {
      const json = JSON.stringify({ items: [{ prompt: "Q1" }] });
      const res = normalizePastedQuestionsJson(json);
      expect(res.error).toBeUndefined();
      expect(res.items).toHaveLength(1);
    });

    it("handles wrapped { questions: [...] }", () => {
      const json = JSON.stringify({ questions: [{ prompt: "Q1" }] });
      const res = normalizePastedQuestionsJson(json);
      expect(res.error).toBeUndefined();
      expect(res.items).toHaveLength(1);
    });

    it("normalizes standalone single multi-gap cloze question object", () => {
      const singleCloze = {
        stimulus_title: "Aménagement urbain",
        stimulus_text: "Le vélo [1] les déplacements.",
        prompt: "Complétez le texte.",
        task_type_code: "text_gap",
        gaps: [
          {
            gap_id: "1",
            options: [
              { content: "facilite", is_correct: true },
              { content: "bloque", is_correct: false },
            ],
          },
        ],
      };
      const res = normalizePastedQuestionsJson(JSON.stringify(singleCloze));
      expect(res.error).toBeUndefined();
      expect(res.items).toHaveLength(1);
      expect(res.items[0].prompt).toBe("Complétez le texte.");
      expect(res.items[0].gaps).toHaveLength(1);
    });

    it("returns error for invalid JSON syntax", () => {
      const res = normalizePastedQuestionsJson("{ unclosed json: ");
      expect(res.error).toContain("Erreur de syntaxe JSON");
      expect(res.items).toHaveLength(0);
    });
  });

  describe("validateQuestionItemsClientSide", () => {
    it("validates a compliant multi-gap cloze question without errors", () => {
      const items = [
        {
          stimulus_text: "Texte avec trou [1] et trou [2].",
          prompt: "Complétez le texte.",
          task_type_code: "text_gap",
          gaps: [
            {
              gap_id: "1",
              options: [
                { content: "En effet", is_correct: true },
                { content: "Néanmoins", is_correct: false },
              ],
            },
            {
              gap_id: "2",
              options: [
                { content: "facilitée", is_correct: true },
                { content: "retardée", is_correct: false },
              ],
            },
          ],
        },
      ];
      const res = validateQuestionItemsClientSide(items);
      expect(res.is_valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.warnings).toHaveLength(0);
    });

    it("catches multi-gap question where a gap has no correct answer marked", () => {
      const items = [
        {
          stimulus_text: "Texte [1].",
          prompt: "Complétez.",
          task_type_code: "text_gap",
          gaps: [
            {
              gap_id: "1",
              options: [
                { content: "Option A", is_correct: false },
                { content: "Option B", is_correct: false },
              ],
            },
          ],
        },
      ];
      const res = validateQuestionItemsClientSide(items);
      expect(res.is_valid).toBe(false);
      expect(res.errors.some((e) => e.message.includes("aucune réponse correcte marquée"))).toBe(true);
    });

    it("catches multi-gap question where a gap has fewer than 2 choices", () => {
      const items = [
        {
          stimulus_text: "Texte [1].",
          prompt: "Complétez.",
          task_type_code: "text_gap",
          gaps: [
            {
              gap_id: "1",
              options: [{ content: "Seule option", is_correct: true }],
            },
          ],
        },
      ];
      const res = validateQuestionItemsClientSide(items);
      expect(res.is_valid).toBe(false);
      expect(res.errors.some((e) => e.message.includes("moins de 2 options"))).toBe(true);
    });

    it("warns if gap marker [1] is absent from stimulus and prompt", () => {
      const items = [
        {
          stimulus_text: "Texte sans repère explicite.",
          prompt: "Complétez.",
          task_type_code: "text_gap",
          gaps: [
            {
              gap_id: "1",
              options: [
                { content: "A", is_correct: true },
                { content: "B", is_correct: false },
              ],
            },
          ],
        },
      ];
      const res = validateQuestionItemsClientSide(items);
      expect(res.is_valid).toBe(true);
      expect(res.warnings.some((w) => w.message.includes("n'a pas été détecté"))).toBe(true);
    });

    it("validates multi-gap cloze with singular gap and option aliases", () => {
      const items = [
        {
          stimulus_text: "Texte avec [1].",
          prompt: "Complétez.",
          task_type_code: "text_gap",
          gap: [
            {
              id: "1",
              option: [
                { text: "Option A", is_correct: true },
                { text: "Option B", is_correct: false },
              ],
            },
          ],
        },
      ];
      const res = validateQuestionItemsClientSide(items);
      expect(res.is_valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("validates multi-gap cloze with flat gap options (option_a..option_b) and gap-level correct_option", () => {
      const items = [
        {
          stimulus_text: "Texte avec [1].",
          prompt: "Complétez.",
          task_type_code: "text_gap",
          gaps: [
            {
              gap_id: "1",
              option_a: "Première option",
              option_b: "Deuxième option",
              correct_option: "A",
            },
          ],
        },
      ];
      const res = validateQuestionItemsClientSide(items);
      expect(res.is_valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("validates multi-gap cloze with dict options and response_metadata container", () => {
      const items = [
        {
          stimulus_text: "Texte avec [1].",
          prompt: "Complétez.",
          task_type_code: "text_gap",
          response_metadata: {
            gaps: [
              {
                gap_id: "1",
                options: {
                  A: "Option A",
                  B: "Option B",
                },
                solution: "B",
              },
            ],
          },
        },
      ];
      const res = validateQuestionItemsClientSide(items);
      expect(res.is_valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("reports specific missing gaps error when cloze question has neither gaps nor options", () => {
      const items = [
        {
          stimulus_text: "Texte sans lacunes configurées [1].",
          prompt: "Complétez.",
          task_type_code: "text_gap",
        },
      ];
      const res = validateQuestionItemsClientSide(items);
      expect(res.is_valid).toBe(false);
      expect(
        res.errors.some((e) =>
          e.message.includes("cette question de type texte à trous ne comporte aucun trou configuré (champ 'gaps')")
        )
      ).toBe(true);
    });
  });
});

