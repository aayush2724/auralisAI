"""
auralis/src/classifier/sentiment.py
──────────────────────────────────────
Sentiment classifier using DistilBERT fine-tuned on SST-2.

Model : distilbert-base-uncased-finetuned-sst-2-english
Labels: POSITIVE / NEGATIVE → mapped to positive / negative / neutral
         (neutral is inferred when the model's positive-score sits in the
          ambiguous band [0.40, 0.60], meaning it is uncertain either way)

Public API
----------
  analyze(text: str) -> SentimentResult

CLI smoke-test
--------------
  python -m src.classifier.sentiment "I love the product but it's a bit pricey"
"""

from __future__ import annotations

import logging
import sys
from typing import Literal, TypedDict

from src.classifier.shared_model import get_zeroshot_pipeline

# ─── Logging ──────────────────────────────────────────────────────────────────

logger = logging.getLogger("auralis.classifier.sentiment")

# ─── Constants ────────────────────────────────────────────────────────────────

# Tone instructions appended to the generation prompt downstream.
_TONE_INSTRUCTIONS: dict[str, str] = {
    "positive": "Match the customer energy, be enthusiastic.",
    "neutral": "Stay professional and informative.",
    "negative": "Be empathetic, slow down, acknowledge frustration first.",
}


# ─── TypedDict ────────────────────────────────────────────────────────────────


class SentimentResult(TypedDict):
    """Return type of analyze()."""

    label: Literal["positive", "neutral", "negative"]
    score: float  # confidence of the mapped label (0.0–1.0)
    tone_instruction: str  # prompt suffix for the generation node


# ─── Public API ───────────────────────────────────────────────────────────────


def analyze(text: str) -> SentimentResult:
    """
    Analyze the sentiment of a sales utterance.

    Parameters
    ----------
    text : Prospect or sales-rep utterance to analyze.

    Returns
    -------
    SentimentResult with label, score, and tone_instruction.

    Raises
    ------
    ValueError : if *text* is empty or whitespace-only.
    """
    text = text.strip()
    if not text:
        raise ValueError("`text` must be a non-empty string.")

    clf = get_zeroshot_pipeline()
    candidate_labels = ["positive", "neutral", "negative"]

    res = clf(text, candidate_labels)

    best_label = res["labels"][0]
    best_score = res["scores"][0]

    tone_instruction = _TONE_INSTRUCTIONS[best_label]

    logger.debug(
        "analyze | label=%s score=%.3f",
        best_label,
        best_score,
    )

    return SentimentResult(
        label=best_label,  # type: ignore
        score=round(best_score, 4),
        tone_instruction=tone_instruction,
    )


# ─── CLI smoke-test ───────────────────────────────────────────────────────────


def _main() -> None:
    if len(sys.argv) < 2:
        print('Usage: python -m src.classifier.sentiment "<utterance>"')
        sys.exit(1)

    text = " ".join(sys.argv[1:])
    result = analyze(text)

    print(f"\n{'─'*60}")
    print(f"  Input            : {text}")
    print(f"  Label            : {result['label']}")
    print(f"  Score            : {result['score']:.1%}")
    print(f"  Tone instruction : {result['tone_instruction']}")
    print(f"{'─'*60}\n")


if __name__ == "__main__":
    _main()
