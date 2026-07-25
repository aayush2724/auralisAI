"""
auralis/src/classifier/persona.py
──────────────────────────────────
Zero-shot customer persona detector (Feature 3).

Uses a Gemini LLM classifier (shared with other classifiers) to
identify the most likely buyer persona from a sales utterance, then maps
that persona to a one-sentence pitch angle instruction for the strategy
selection node.

Persona labels
--------------
  CEO, CTO, Developer, Product_Manager, Founder, Unknown

Public API
----------
  detect(text: str) -> PersonaResult

CLI smoke-test
--------------
  python -m src.classifier.persona "Our CTO is worried about integration complexity"
"""

from __future__ import annotations

import logging
import os
import sys
from typing import TypedDict
from src.classifier.shared_model import get_zeroshot_pipeline

# ─── Logging ──────────────────────────────────────────────────────────────────

logger = logging.getLogger("auralis.classifier.persona")

# ─── Constants ────────────────────────────────────────────────────────────────

MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

# Minimum confidence below which we fall back to "Unknown"
_UNKNOWN_THRESHOLD = 0.25

# Persona labels (canonical casing used in all return values)
PERSONAS: list[str] = [
    "CEO",
    "CTO",
    "Developer",
    "Product_Manager",
    "Founder",
    "Unknown",
]

# Full hypothesis sentences fed to the NLI model.
# More descriptive hypotheses dramatically improve BART zero-shot accuracy.
_HYPOTHESES: dict[str, str] = {
    "CEO": (
        "The speaker is a CEO or Chief Executive who cares about "
        "revenue, cost savings, ROI, and company-wide strategy."
    ),
    "CTO": (
        "The speaker is a CTO or Chief Technology Officer who cares about "
        "technical architecture, scalability, security, and engineering teams."
    ),
    "Developer": (
        "The speaker is a software developer or engineer who cares about "
        "APIs, SDKs, code quality, documentation, and developer experience."
    ),
    "Product_Manager": (
        "The speaker is a Product Manager who cares about roadmaps, "
        "user stories, feature prioritisation, and product-market fit."
    ),
    "Founder": (
        "The speaker is a startup founder who cares about speed to market, "
        "competitive differentiation, and building a sustainable business."
    ),
    "Unknown": (
        "The speaker's role is unclear and does not match any known "
        "business persona."
    ),
}

# One-sentence pitch angle per persona.
_PITCH_ANGLES: dict[str, str] = {
    "CEO": "Lead with ROI and operational cost savings.",
    "CTO": "Lead with architecture, scalability, and API quality.",
    "Developer": "Lead with REST APIs, SDKs, and developer experience.",
    "Product_Manager": "Lead with workflow integration and measurable user outcomes.",
    "Founder": "Lead with speed-to-market and competitive moat.",
    "Unknown": "Lead with a broad value overview and ask discovery questions.",
}


# ─── TypedDict ────────────────────────────────────────────────────────────────


class PersonaResult(TypedDict):
    """Return type of detect()."""

    label: str  # one of PERSONAS
    confidence: float  # softmax score of winning persona (0.0–1.0)
    pitch_angle: str  # one-sentence pitch instruction for this persona


# ─── Model (lazy-loaded singleton) ────────────────────────────────────────────


def _get_pipeline():
    return get_zeroshot_pipeline()


# ─── Public API ───────────────────────────────────────────────────────────────


def detect(text: str) -> PersonaResult:
    """
    Detect the buyer persona from a sales utterance.

    Strategy
    --------
    Run NLI against all persona hypotheses.  If the top persona's confidence
    is below *_UNKNOWN_THRESHOLD*, override to "Unknown" — it is better to
    admit uncertainty than to mis-classify and serve a wrong pitch angle.

    Parameters
    ----------
    text : Sales utterance (prospect statement, intro, or context note).

    Returns
    -------
    PersonaResult with label, confidence, and pitch_angle.

    Raises
    ------
    ValueError : if *text* is empty or whitespace-only.
    """
    text = text.strip()
    if not text:
        raise ValueError("`text` must be a non-empty string.")

    clf = _get_pipeline()

    # Exclude "Unknown" from candidate labels — it will be applied as a
    # threshold fallback rather than letting the model "choose" unknown.
    candidate_personas = [p for p in PERSONAS if p != "Unknown"]

    descriptions = [_HYPOTHESES[p] for p in candidate_personas]
    result = clf(text, candidate_labels=candidate_personas, descriptions=descriptions)

    winning_label: str = result["labels"][0]
    confidence: float = round(float(result["scores"][0]), 4)

    # Apply unknown threshold
    if confidence < _UNKNOWN_THRESHOLD:
        winning_label = "Unknown"
        # confidence stays as the model's raw top score (informational)

    pitch_angle = _PITCH_ANGLES[winning_label]

    logger.debug("detect | label=%s confidence=%.3f", winning_label, confidence)

    return PersonaResult(
        label=winning_label,
        confidence=confidence,
        pitch_angle=pitch_angle,
    )


# ─── CLI smoke-test ───────────────────────────────────────────────────────────


def _main() -> None:
    if len(sys.argv) < 2:
        print('Usage: python -m src.classifier.persona "<utterance>"')
        sys.exit(1)

    text = " ".join(sys.argv[1:])
    result = detect(text)

    print(f"\n{'─'*60}")
    print(f"  Input       : {text}")
    print(f"  Persona     : {result['label']}")
    print(f"  Confidence  : {result['confidence']:.1%}")
    print(f"  Pitch angle : {result['pitch_angle']}")
    print(f"{'─'*60}\n")


if __name__ == "__main__":
    _main()
