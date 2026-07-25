"""
auralis/src/classifier/objection.py
─────────────────────────────────────
Zero-shot objection classifier powered by Gemini LLM via shared_model.

Implements:
  - Feature 8  — Confidence Scoring (softmax score on every class)
  - Feature 9  — Explainability (trigger phrases extracted from input)

Classes
-------
  price        — cost / budget / pricing concerns
  trust        — credibility / proof / security doubts
  timing       — "not now" / need more time / bad moment
  competitor   — already using or evaluating a rival tool
  fit          — product doesn't match their workflow / use-case
  buying_signal— positive intent to move forward
  neutral      — no clear objection

Public API
----------
  classify(text: str) -> ObjectionResult

CLI smoke-test
--------------
  python -m src.classifier.objection "We already use HubSpot"
"""

from __future__ import annotations

import logging
import re
import sys
from typing import TypedDict
from src.classifier.shared_model import get_zeroshot_pipeline

# ─── Logging ──────────────────────────────────────────────────────────────────

logger = logging.getLogger("auralis.classifier.objection")

# ─── Constants ────────────────────────────────────────────────────────────────

CLASSES: list[str] = [
    "price",
    "trust",
    "timing",
    "competitor",
    "fit",
    "buying_signal",
    "neutral",
]

# Human-readable hypothesis templates fed to the NLI model.
# Written as statements the input text would *entail* if that class is true.
_HYPOTHESIS_TEMPLATES: dict[str, str] = {
    "price": "This statement is about the cost, price, or budget being too high.",
    "trust": "This statement expresses doubt about credibility, security, or proof.",
    "timing": "This statement says now is not the right time or they need more time.",
    "competitor": "This statement mentions already using or considering a competing product.",
    "fit": "This statement says the product does not fit their needs or workflow.",
    "buying_signal": "This statement expresses positive interest or readiness to buy.",
    "neutral": "This statement contains no clear sales objection or buying signal.",
}

# ─── Trigger-phrase patterns per class (Feature 9 — Explainability) ───────────
# Each pattern is a compiled regex that captures phrases associated with the class.
# Patterns are intentionally broad (case-insensitive) to maximise recall.

_TRIGGER_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    "price": [
        re.compile(r"too expensive", re.I),
        re.compile(r"(cost|price|pricing|fee|rate)s?\b", re.I),
        re.compile(r"(over|out of|tight)\s*(our\s*)?budget", re.I),
        re.compile(r"can['']?t afford", re.I),
        re.compile(r"(cheaper|lower.{0,10}price|discount|ROI)", re.I),
        re.compile(r"for our budget", re.I),
    ],
    "trust": [
        re.compile(r"(not sure|uncertain|unsure|doubt)", re.I),
        re.compile(r"(security|compliance|gdpr|hipaa|soc2?)", re.I),
        re.compile(r"(proof|case stud|reference|testimon|review)", re.I),
        re.compile(r"(trust|credib|reliab|track record)", re.I),
        re.compile(r"(never heard of|who are you|your company)", re.I),
    ],
    "timing": [
        re.compile(r"(not (the )?right time|bad timing)", re.I),
        re.compile(r"(not now|later|next (quarter|year|month|cycle))", re.I),
        re.compile(r"(need (more )?time|give us time)", re.I),
        re.compile(r"(too (busy|early|late)|come back)", re.I),
        re.compile(r"(planning|roadmap|budget cycle|Q[1-4])", re.I),
    ],
    "competitor": [
        re.compile(
            r"(already use|currently use|using|we have)\b.{0,40}\b(hubspot|salesforce|pipedrive|zoho|monday|notion|slack|microsoft|google|intercom)",
            re.I,
        ),
        re.compile(
            r"(competitor|alternative|rival|another (tool|solution|vendor|platform))",
            re.I,
        ),
        re.compile(r"(we('re| are) (happy|satisfied|good) with)", re.I),
        re.compile(
            r"(hubspot|salesforce|pipedrive|zoho|outreach|gong|chorus|drift)", re.I
        ),
    ],
    "fit": [
        re.compile(r"(doesn'?t? (fit|work|match)|not (a )?fit)", re.I),
        re.compile(r"(our (team|workflow|process|use.?case))", re.I),
        re.compile(r"(too (complex|simple|big|small|advanced|basic))", re.I),
        re.compile(r"(not what we (need|want|are looking for))", re.I),
        re.compile(r"(feature|functionality|capability).{0,30}(miss|lack|need)", re.I),
    ],
    "buying_signal": [
        re.compile(r"(interested|keen|excited|love (to|the))", re.I),
        re.compile(r"(send (me|us)|can (I|we) (get|have|see))", re.I),
        re.compile(r"(let'?s? (move|proceed|go ahead|set up|schedule))", re.I),
        re.compile(r"(sign (me|us) up|ready to (start|begin|buy|purchase))", re.I),
        re.compile(r"(demo|trial|pilot|proof.of.concept|POC)", re.I),
    ],
    "neutral": [],  # no triggers — neutral is the fallback
}


# ─── Model (lazy-loaded singleton) ────────────────────────────────────────────


def _get_pipeline():
    return get_zeroshot_pipeline()


# ─── TypedDict ────────────────────────────────────────────────────────────────


class ObjectionResult(TypedDict):
    """Return type of classify()."""

    label: str  # winning class
    confidence: float  # softmax score of winning class (0.0–1.0)
    all_scores: dict[str, float]  # label -> score for every class
    triggers: list[str]  # exact phrases from input that fired the class


# ─── Trigger extraction ───────────────────────────────────────────────────────


def _extract_triggers(text: str, label: str) -> list[str]:
    """
    Return the substrings of *text* that match trigger patterns for *label*.

    Strategy
    --------
    1. Run every compiled regex for the winning class against the input.
    2. Collect unique, non-empty match strings (lowercased for dedup).
    3. Fall back to the first sentence if nothing matched (graceful degradation).
    """
    patterns = _TRIGGER_PATTERNS.get(label, [])
    seen: set[str] = set()
    triggers: list[str] = []

    for pattern in patterns:
        for match in pattern.finditer(text):
            phrase = match.group(0).strip()
            key = phrase.lower()
            if phrase and key not in seen:
                seen.add(key)
                triggers.append(phrase)

    # Graceful fallback: return first ~6 words if no pattern matched
    if not triggers and label != "neutral":
        first_words = " ".join(text.split()[:6])
        if first_words:
            triggers.append(first_words)

    return triggers


# ─── Public API ───────────────────────────────────────────────────────────────


def classify(text: str) -> ObjectionResult:
    """
    Classify a sales utterance into one of the seven objection classes.

    Parameters
    ----------
    text : The prospect's utterance to classify.

    Returns
    -------
    ObjectionResult TypedDict with label, confidence, all_scores, triggers.

    Raises
    ------
    ValueError : if *text* is empty or whitespace-only.
    """
    text = text.strip()
    if not text:
        raise ValueError("`text` must be a non-empty string.")

    clf = _get_pipeline()

    # Pass short class labels WITH their descriptions for LLM context
    descriptions = [_HYPOTHESIS_TEMPLATES[c] for c in CLASSES]
    result = clf(text, candidate_labels=CLASSES, descriptions=descriptions)

    winning_label: str = result["labels"][0]
    confidence: float = round(float(result["scores"][0]), 4)

    # Build all_scores dict: winning label gets the confidence, rest get 0.0
    all_scores: dict[str, float] = {label: 0.0 for label in CLASSES}
    all_scores[winning_label] = confidence

    triggers = _extract_triggers(text, winning_label)

    logger.debug(
        "classify | label=%s confidence=%.3f triggers=%s",
        winning_label,
        confidence,
        triggers,
    )

    return ObjectionResult(
        label=winning_label,
        confidence=confidence,
        all_scores=all_scores,
        triggers=triggers,
    )


# ─── CLI smoke-test ───────────────────────────────────────────────────────────


def _main() -> None:
    if len(sys.argv) < 2:
        print('Usage: python -m src.classifier.objection "<prospect utterance>"')
        sys.exit(1)

    text = " ".join(sys.argv[1:])
    result = classify(text)

    print(f"\n{'─'*55}")
    print(f"  Input      : {text}")
    print(f"  Label      : {result['label']}")
    print(f"  Confidence : {result['confidence']:.1%}")
    print(f"  Triggers   : {result['triggers']}")
    print("\n  All scores:")
    for lbl, score in sorted(result["all_scores"].items(), key=lambda x: -x[1]):
        bar = "█" * int(score * 30)
        print(f"    {lbl:<16} {score:.4f}  {bar}")
    print(f"{'─'*55}\n")


if __name__ == "__main__":
    _main()
