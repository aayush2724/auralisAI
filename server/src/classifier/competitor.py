"""
auralis/src/classifier/competitor.py
──────────────────────────────────────
Competitor name detector — Feature 4.

Strategy
--------
1. Regex-first: scan the input for known competitor names using a curated
   dictionary of canonical names + common aliases.  O(n) and zero model load.
2. Fallback to zero-shot LLM classifier (Gemini) when regex finds nothing but
   the text still looks like it could mention a competitor.

Public API
──────────
  detect_competitor(text: str) -> str | None
    Returns canonical competitor name (e.g. "HubSpot") or None.
"""

from __future__ import annotations

import logging
import re
from src.classifier.shared_model import get_zeroshot_pipeline

logger = logging.getLogger("auralis.classifier.competitor")

# ─── Curated competitor dictionary ────────────────────────────────────────────
# key   = canonical name returned to callers
# value = list of regex patterns (case-insensitive) that match that competitor

_COMPETITOR_ALIASES: dict[str, list[str]] = {
    "HubSpot": [r"hubspot", r"hub\s*spot"],
    "Salesforce": [r"salesforce", r"sfdc", r"sales\s*force", r"sf\.com"],
    "Pipedrive": [r"pipedrive", r"pipe\s*drive"],
    "Zoho": [r"zoho"],
    "Outreach": [r"outreach\.io", r"\boutreach\b"],
    "Gong": [r"\bgong\b", r"gong\.io"],
    "Chorus": [r"\bchorus\b", r"chorus\.ai"],
    "Intercom": [r"\bintercom\b"],
    "Drift": [r"\bdrift\b"],
    "Freshsales": [r"freshsales", r"freshworks\s*crm"],
    "Copper": [r"\bcopper\s*crm\b", r"\bcopper\b(?=\s*crm|\s*for)"],
    "Monday": [r"monday\.com", r"\bmonday\b(?=\s*crm|\s*sales)"],
    "Close": [r"\bclose\.io\b", r"\bclose\s*crm\b"],
    "ActiveCampaign": [r"activecampaign", r"active\s*campaign"],
}

# Pre-compile all patterns once at import time
_COMPILED: list[tuple[str, re.Pattern[str]]] = [
    (canonical, re.compile("|".join(patterns), re.IGNORECASE))
    for canonical, patterns in _COMPETITOR_ALIASES.items()
]

# Heuristic: if any of these words appear alongside a competitor context,
# we try the NLI fallback even without a regex hit.
_COMPETITOR_CONTEXT_WORDS = re.compile(
    r"\b(already use|currently use|using|switched to|evaluating|looking at|"
    r"considering|we have|compared to|vs\.?|versus|better than|instead of)\b",
    re.IGNORECASE,
)


# ─── Regex detector ───────────────────────────────────────────────────────────


def _regex_detect(text: str) -> str | None:
    """Return canonical competitor name if found by regex, else None."""
    for canonical, pattern in _COMPILED:
        if pattern.search(text):
            logger.debug("Regex matched competitor: %s", canonical)
            return canonical
    return None


# ─── NLI fallback ─────────────────────────────────────────────────────────────


def _get_nli_pipeline():
    return get_zeroshot_pipeline()


def _nli_detect(text: str) -> str | None:
    """
    Use zero-shot LLM classification to check if any known competitor is implied.
    Only called when regex finds nothing but context words suggest a competitor.
    """
    candidate_labels = list(_COMPETITOR_ALIASES.keys())

    clf = _get_nli_pipeline()
    result = clf(text, candidate_labels=candidate_labels)

    top_label: str = result["labels"][0]
    top_score: float = result["scores"][0]

    # Only accept result if it's confident enough
    if top_score >= 0.55:
        logger.debug("LLM detected competitor: %s (score=%.2f)", top_label, top_score)
        return top_label

    return None


# ─── Public API ───────────────────────────────────────────────────────────────


def detect_competitor(text: str) -> str | None:
    """
    Detect whether a competitor is mentioned in *text*.

    Strategy
    --------
    1. Regex scan over curated alias dictionary (fast, zero model load).
    2. If no regex hit but competitor-context words are present,
       fall back to zero-shot NLI for implicit mentions.

    Parameters
    ----------
    text : Sales utterance to analyse.

    Returns
    -------
    Canonical competitor name (e.g. "HubSpot", "Salesforce") or None.
    """
    if not text or not text.strip():
        return None

    # Fast path: regex
    hit = _regex_detect(text)
    if hit:
        return hit

    # Slower path: NLI — only if the text has competitor-context language
    if _COMPETITOR_CONTEXT_WORDS.search(text):
        return _nli_detect(text)

    return None
