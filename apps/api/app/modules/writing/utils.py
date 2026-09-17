"""Utilities for writing assessment module, including French word counting."""

import re


def count_words_french(text: str) -> int:
    """Calculate word count according to standard French examination counting rules.

    In TEF and French language assessments:
    - Words separated by whitespace are counted as words.
    - Elided forms with apostrophes (e.g. "l'arbre", "c'est", "qu'il", "d'accord")
      count as two distinct words ("l'" + "arbre", "c'" + "est").
    - Compound words with hyphens (e.g. "peut-être", "grand-mère") count as one token.
    - Punctuation marks are not counted as words.
    """
    if not text or not text.strip():
        return 0

    # Replace apostrophes (ASCII ' and typographical ’) with space to separate elisions
    normalized = re.sub(r"['’]", " ", text)

    # Find word tokens including unicode French accents and hyphens within words
    tokens = re.findall(r"\b[\w-]+\b", normalized, flags=re.UNICODE)

    # Filter out pure dashes or non-alphanumeric tokens
    valid_words = [t for t in tokens if any(c.isalnum() for c in t)]
    return len(valid_words)
