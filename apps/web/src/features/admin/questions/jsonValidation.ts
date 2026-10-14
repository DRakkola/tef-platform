/**
 * Client-side validation and normalization utility for Bulk Question Import JSON payloads.
 * Provides resilient schema parsing, single-object normalization, and deep multi-gap cloze checks.
 */

export interface NormalizedJsonResult {
  items: any[];
  error?: string;
}

export interface ClientValidationError {
  item_index: number;
  message: string;
}

export interface ClientValidationWarning {
  item_index: number;
  message: string;
}

export interface ClientValidationResult {
  is_valid: boolean;
  errors: ClientValidationError[];
  warnings: ClientValidationWarning[];
}

/**
 * Parses raw JSON string and normalizes it into a standard array of question objects.
 * Supports:
 * - Direct array: `[...]`
 * - Wrapped object: `{ "items": [...] }` or `{ "questions": [...] }`
 * - Standalone question object: `{ "prompt": "...", "gaps": [...] }`
 */
export function normalizePastedQuestionsJson(text: string): NormalizedJsonResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { items: [], error: "Veuillez coller un contenu JSON valide." };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err: any) {
    return { items: [], error: `Erreur de syntaxe JSON : ${err.message}` };
  }

  if (Array.isArray(parsed)) {
    return { items: parsed };
  }

  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.items)) {
      return { items: parsed.items };
    }
    if (Array.isArray(parsed.questions)) {
      return { items: parsed.questions };
    }
    // Standalone single question object
    const isSingleQuestion = Boolean(
      parsed.prompt ||
        parsed.question ||
        parsed.gaps ||
        parsed.gap ||
        parsed.trous ||
        parsed.trou ||
        parsed.lacunes ||
        parsed.lacune ||
        parsed.blanks ||
        parsed.blank ||
        parsed.gap_items ||
        parsed.task_type_code ||
        parsed.stimulus_text
    );
    if (isSingleQuestion) {
      return { items: [parsed] };
    }
  }

  return {
    items: [],
    error:
      "Format JSON non reconnu. Le contenu doit être un tableau d'objets [...], un objet { \"items\": [...] }, ou un objet question individuel.",
  };
}

/**
 * Performs client-side structural validation on parsed question items with special focus
 * on multi-gap cloze questions (text_gap / sentence_gap).
 */
export function validateQuestionItemsClientSide(items: any[]): ClientValidationResult {
  const errors: ClientValidationError[] = [];
  const warnings: ClientValidationWarning[] = [];

  if (!items || items.length === 0) {
    return {
      is_valid: false,
      errors: [{ item_index: 0, message: "Le fichier ne contient aucun élément de question." }],
      warnings: [],
    };
  }

  items.forEach((item, idx) => {
    const itemNum = idx + 1;

    if (!item || typeof item !== "object") {
      errors.push({ item_index: idx, message: `Question #${itemNum} : l'élément n'est pas un objet valide.` });
      return;
    }

    const prompt = String(item.prompt || item.question || "").trim();
    if (!prompt) {
      errors.push({ item_index: idx, message: `Question #${itemNum} : le champ 'prompt' (énoncé) est obligatoire.` });
    }

    // Detect multi-gap cloze structures across all common singular/plural and nested aliases
    let rawGaps =
      item.gaps ||
      item.gap ||
      item.trous ||
      item.trou ||
      item.lacunes ||
      item.lacune ||
      item.blanks ||
      item.blank ||
      item.gap_items ||
      item.gap_solutions;

    if (!rawGaps) {
      for (const containerKey of ["scoring_payload", "response_metadata", "metadata"]) {
        const container = item[containerKey];
        let parsedContainer = container;
        if (typeof container === "string") {
          try {
            parsedContainer = JSON.parse(container);
          } catch {
            parsedContainer = null;
          }
        }
        if (parsedContainer && typeof parsedContainer === "object") {
          rawGaps =
            parsedContainer.gaps ||
            parsedContainer.gap ||
            parsedContainer.trous ||
            parsedContainer.trou ||
            parsedContainer.lacunes ||
            parsedContainer.lacune ||
            parsedContainer.blanks ||
            parsedContainer.blank ||
            parsedContainer.gap_items ||
            parsedContainer.gap_solutions;
          if (rawGaps) break;
        }
      }
    }

    // Parse stringified JSON if needed
    if (typeof rawGaps === "string") {
      try {
        rawGaps = JSON.parse(rawGaps);
      } catch {
        rawGaps = [];
      }
    }

    // If rawGaps is a dictionary, unwrap recursively or convert key-value map to array
    while (rawGaps && typeof rawGaps === "object" && !Array.isArray(rawGaps)) {
      let foundInner = false;
      for (const k of [
        "gaps",
        "gap",
        "trous",
        "trou",
        "lacunes",
        "lacune",
        "blanks",
        "blank",
        "gap_items",
        "gap_solutions",
      ]) {
        if (rawGaps[k] && (Array.isArray(rawGaps[k]) || typeof rawGaps[k] === "object")) {
          rawGaps = rawGaps[k];
          foundInner = true;
          break;
        }
      }
      if (!foundInner) {
        const sortedVals: any[] = [];
        const sortedKeys = Object.keys(rawGaps).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true })
        );
        for (const k of sortedKeys) {
          const v = rawGaps[k];
          if (v && typeof v === "object") {
            if (!v.gap_id && !v.id) {
              sortedVals.push({ ...v, gap_id: String(k) });
            } else {
              sortedVals.push(v);
            }
          }
        }
        rawGaps = sortedVals;
        break;
      }
    }

    const taskTypeCode = String(item.task_type_code || item.task_type || "").trim().toLowerCase();
    const isGapQuestion =
      Boolean(rawGaps && (Array.isArray(rawGaps) ? rawGaps.length > 0 : true)) ||
      taskTypeCode === "text_gap" ||
      taskTypeCode === "sentence_gap" ||
      String(item.response_type).toLowerCase() === "gap_fill" ||
      String(item.question_type).toLowerCase() === "gap_fill" ||
      String(item.question_type).toLowerCase() === "text_gap";

    if (isGapQuestion) {
      const gapsList: any[] = Array.isArray(rawGaps) ? rawGaps : [];

      if (gapsList.length === 0) {
        // Check if top-level options contain bracketed gap markers (e.g. '[1] ...')
        const rawOptions = item.options || [];
        const hasBracketedOptions =
          Array.isArray(rawOptions) &&
          rawOptions.some((o) => typeof o === "object" && /^\s*[\[\(]\d+[\]\)]/.test(String(o.content || o.text || "")));

        if (!hasBracketedOptions && (!rawOptions || rawOptions.length === 0)) {
          errors.push({
            item_index: idx,
            message: `Question #${itemNum} : cette question de type texte à trous ne comporte aucun trou configuré (champ 'gaps').`,
          });
        }
      } else {
        // Validate each gap individually
        const stimulusAndPrompt = `${item.stimulus_text || ""} ${prompt}`;

        gapsList.forEach((gap, gIdx) => {
          if (!gap || typeof gap !== "object") return;
          const gapId = String(gap.gap_id || gap.id || gap.numero || gap.num || gap.trou || gIdx + 1);

          let rawGapOpts =
            gap.options ||
            gap.option ||
            gap.choices ||
            gap.choix ||
            gap.propositions ||
            gap.answers ||
            gap.reponses ||
            gap.réponses ||
            [];

          // Check flat options on gap dict (option_a..option_d)
          if (
            (!rawGapOpts || (Array.isArray(rawGapOpts) && rawGapOpts.length === 0)) &&
            ["a", "b", "c", "d"].some((k) => gap[`option_${k}`] || gap[`opt_${k}`] || gap[`choice_${k}`])
          ) {
            const flatOpts: any[] = [];
            for (const k of ["a", "b", "c", "d"]) {
              const val = gap[`option_${k}`] || gap[`opt_${k}`] || gap[`choice_${k}`];
              if (val) {
                flatOpts.push({ content: String(val).trim(), key: k.toUpperCase() });
              }
            }
            rawGapOpts = flatOpts;
          }

          // If options is a dict like {"A": "...", "B": "..."}
          if (rawGapOpts && typeof rawGapOpts === "object" && !Array.isArray(rawGapOpts)) {
            const dictOpts: any[] = [];
            const sortedOptKeys = Object.keys(rawGapOpts).sort();
            for (const optKey of sortedOptKeys) {
              const optVal = rawGapOpts[optKey];
              if (optVal && typeof optVal === "object") {
                dictOpts.push({ ...optVal, key: String(optKey).toUpperCase() });
              } else if (typeof optVal === "string" && optVal.trim()) {
                dictOpts.push({ content: optVal.trim(), key: String(optKey).toUpperCase() });
              }
            }
            rawGapOpts = dictOpts;
          }

          const gapOptions: any[] = Array.isArray(rawGapOpts) ? rawGapOpts : [];
          const expAnswers: any[] =
            gap.expected_answers || gap.accepted_answers || gap.reponses_attendues || [];

          // Gap-level correct answer indicator
          const gapCorrectRef = String(
            gap.correct_option ||
              gap.correct_answer ||
              gap.reponse_correcte ||
              gap.solution ||
              gap.bonne_reponse ||
              ""
          )
            .trim()
            .toUpperCase();

          if (gapOptions.length > 0) {
            if (gapOptions.length < 2) {
              errors.push({
                item_index: idx,
                message: `Question #${itemNum} : le trou [${gapId}] comporte moins de 2 options de réponse.`,
              });
            }
            const hasCorrect = gapOptions.some((o, oIdx) => {
              if (typeof o !== "object" || !o) return false;
              if (Boolean(o.is_correct || o.correct || o.est_correct)) return true;
              if (gapCorrectRef) {
                const optLetter = String.fromCharCode(65 + oIdx);
                const optNum = String(oIdx + 1);
                const optKey = String(o.key || "").trim().toUpperCase();
                const optContent = String(
                  o.content || o.text || o.texte || o.label || o.value || o.option || o.answer || ""
                )
                  .trim()
                  .toUpperCase();
                if (
                  gapCorrectRef === optLetter ||
                  gapCorrectRef === optNum ||
                  gapCorrectRef === optKey ||
                  gapCorrectRef === optContent
                ) {
                  return true;
                }
              }
              return false;
            });
            if (!hasCorrect) {
              errors.push({
                item_index: idx,
                message: `Question #${itemNum} : le trou [${gapId}] ne comporte aucune réponse correcte marquée (is_correct: true).`,
              });
            }
          } else if (!Array.isArray(expAnswers) || expAnswers.length === 0) {
            errors.push({
              item_index: idx,
              message: `Question #${itemNum} : le trou [${gapId}] doit définir soit une liste d'options, soit des réponses attendues.`,
            });
          }

          // Check for marker in text
          const markerPattern = new RegExp(`[\\[\\(]${gapId}[\\]\\)]`);
          if (!markerPattern.test(stimulusAndPrompt)) {
            warnings.push({
              item_index: idx,
              message: `Question #${itemNum} : le repère [${gapId}] n'a pas été détecté dans le document support ou l'énoncé.`,
            });
          }
        });
      }
    } else {
      // Standard single/multiple choice validation
      const opts = item.options || [];
      if (Array.isArray(opts)) {
        if (opts.length < 2 && !["short_text", "long_text", "spoken_response", "interaction"].includes(String(item.response_type))) {
          errors.push({
            item_index: idx,
            message: `Question #${itemNum} : au moins 2 options de réponse sont obligatoires.`,
          });
        }
      }
    }
  });

  return {
    is_valid: errors.length === 0,
    errors,
    warnings,
  };
}
