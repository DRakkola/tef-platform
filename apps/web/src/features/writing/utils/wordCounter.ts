/**
 * Word counting utility adhering to standard French language examination rules.
 * Matches backend count_words_french in app/modules/writing/utils.py.
 */

/**
 * Calculates word count according to standard French examination counting rules:
 * - Words separated by whitespace count as words.
 * - Elisions with apostrophes (e.g. "l'arbre", "c'est", "qu'il") count as two distinct words ("l'" + "arbre", "c'" + "est").
 * - Compound words with hyphens (e.g. "peut-être", "grand-mère") count as one token.
 * - Punctuation marks and pure symbols are excluded.
 */
export function countWords(text: string): number {
  if (!text || !text.trim()) {
    return 0
  }

  // 1. Replace apostrophes (ASCII ' and typographical ’) with space to split elisions
  const normalized = text.replace(/['’]/g, " ")

  // 2. Match word tokens with Unicode support (letters, numbers, internal hyphens)
  // Matches \b[\w-]+\b where at least one alphanumeric character exists
  const tokens = normalized.match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) || []

  // 3. Filter out non-alphanumeric tokens (e.g., pure punctuation or isolated hyphens)
  const validWords = tokens.filter((t) => /[\p{L}\p{N}]/u.test(t))
  return validWords.length
}

export type WordCountCategory = "empty" | "below_min" | "in_range" | "above_max"

export function getWordCountCategory(
  count: number,
  minWords: number,
  maxWords: number
): WordCountCategory {
  if (count === 0) return "empty"
  if (count < minWords) return "below_min"
  if (count > maxWords) return "above_max"
  return "in_range"
}

export function getWordCountStatusMessage(
  count: number,
  minWords: number,
  maxWords: number
): string {
  if (count === 0) {
    return `Objectif : ${minWords} à ${maxWords} mots`
  }
  if (count < minWords) {
    const diff = minWords - count
    return `Encore ${diff} mot${diff > 1 ? "s" : ""} pour atteindre le minimum requis (${minWords})`
  }
  if (count > maxWords) {
    const diff = count - maxWords
    return `Dépassement de ${diff} mot${diff > 1 ? "s" : ""} au-delà de la limite (${maxWords})`
  }
  return `Longueur conforme aux exigences de l'épreuve (${minWords}–${maxWords} mots)`
}
