"""
auralis/src/handoff/handoff.py
──────────────────────────────
Handoff evaluation logic for Auralis — determines when to escalate to a
human agent and provides a user-facing handoff message.

Triggers
--------
  USER_REQUESTED   : user explicitly asks for a human
  LOW_CONFIDENCE   : objection classifier confidence < 0.40 (non-negative sentiment)
  ANGRY_CUSTOMER   : negative sentiment with score > 0.85

Public API
----------
  evaluate_handoff(state, user_input) -> HandoffDecision
"""

from __future__ import annotations

import logging
from enum import Enum
from typing import Any, TypedDict

logger = logging.getLogger("auralis.handoff")


class HandoffTrigger(str, Enum):
    """Reason for escalating to a human agent."""

    LOW_CONFIDENCE = "LOW_CONFIDENCE"
    ANGRY_CUSTOMER = "ANGRY_CUSTOMER"
    USER_REQUESTED = "USER_REQUESTED"


class HandoffDecision(TypedDict):
    """Result of handoff evaluation."""

    should_handoff: bool
    trigger: HandoffTrigger | None
    handoff_message: str


# ─── Thresholds ───────────────────────────────────────────────────────────────

_LOW_CONFIDENCE_THRESHOLD = 0.40
_ANGRY_SENTIMENT_THRESHOLD = 0.85

# Phrases that signal the user wants a human
_HUMAN_REQUEST_PHRASES: tuple[str, ...] = (
    "talk to a human",
    "real person",
    "speak to someone",
    "human agent",
    "talk to someone",
    "get a person",
    "speak to a representative",
    "connect me to",
)


# ─── Handoff messages ─────────────────────────────────────────────────────────

_HANDOFF_MESSAGES: dict[HandoffTrigger, str] = {
    HandoffTrigger.USER_REQUESTED: (
        "Of course — let me connect you with one of our team members right now. "
        "They will be with you shortly. [Connecting to human agent...]"
    ),
    HandoffTrigger.LOW_CONFIDENCE: (
        "I want to make sure you get the most accurate information. "
        "Let me bring in a specialist who can help you directly. "
        "[Escalating to specialist...]"
    ),
    HandoffTrigger.ANGRY_CUSTOMER: (
        "I hear you, and I completely understand your frustration. "
        "Let me get a senior member of our team to assist you immediately. "
        "[Escalating to senior agent...]"
    ),
}


# ─── Public API ───────────────────────────────────────────────────────────────


def evaluate_handoff(
    state: dict[str, Any],
    user_input: str,
) -> HandoffDecision:
    """
    Evaluate whether this conversation should be escalated to a human agent.

    Checks three trigger conditions in priority order:
      1. USER_REQUESTED  — explicit ask (checked first, highest priority)
      2. LOW_CONFIDENCE  — classifier unsure (but not negative sentiment)
      3. ANGRY_CUSTOMER — negative sentiment above threshold

    Parameters
    ----------
    state     : Current GraphState from the conversation graph.
    user_input : The prospect's latest message text.

    Returns
    -------
    HandoffDecision with should_handoff, trigger, and handoff_message.
    """
    # ── Check USER_REQUESTED first (highest priority) ─────────────────────
    user_lower = user_input.lower()
    for phrase in _HUMAN_REQUEST_PHRASES:
        if phrase in user_lower:
            msg = _HANDOFF_MESSAGES[HandoffTrigger.USER_REQUESTED]
            logger.info(
                "[evaluate_handoff] trigger=USER_REQUESTED phrase='%s'",
                phrase,
            )
            return HandoffDecision(
                should_handoff=True,
                trigger=HandoffTrigger.USER_REQUESTED,
                handoff_message=msg,
            )

    # ── Extract sentiment and objection confidence ────────────────────────
    sentiment = state.get("sentiment") or {}
    s_label = sentiment.get("label", "")
    s_score = sentiment.get("score", 0.0)

    objection = state.get("objection") or {}
    obj_label = objection.get("label", "")
    obj_confidence = objection.get("confidence", 1.0)

    # ── Check LOW_CONFIDENCE (skip if negative sentiment — ANGRY handles it)
    if obj_confidence < _LOW_CONFIDENCE_THRESHOLD and s_label != "negative":
        msg = _HANDOFF_MESSAGES[HandoffTrigger.LOW_CONFIDENCE]
        logger.info(
            "[evaluate_handoff] trigger=LOW_CONFIDENCE confidence=%.2f",
            obj_confidence,
        )
        return HandoffDecision(
            should_handoff=True,
            trigger=HandoffTrigger.LOW_CONFIDENCE,
            handoff_message=msg,
        )

    # ── Check ANGRY_CUSTOMER ─────────────────────────────────────────────
    # We exempt standard sales objections because negative sentiment is normal
    # in these cases and the AI is specifically designed to handle them.
    is_standard_objection = obj_label in ("price", "competitor", "timing", "fit")

    if (
        s_label == "negative"
        and s_score > _ANGRY_SENTIMENT_THRESHOLD
        and not is_standard_objection
    ):
        msg = _HANDOFF_MESSAGES[HandoffTrigger.ANGRY_CUSTOMER]
        logger.info(
            "[evaluate_handoff] trigger=ANGRY_CUSTOMER score=%.2f",
            s_score,
        )
        return HandoffDecision(
            should_handoff=True,
            trigger=HandoffTrigger.ANGRY_CUSTOMER,
            handoff_message=msg,
        )

    # ── No trigger — continue conversation ───────────────────────────────
    return HandoffDecision(
        should_handoff=False,
        trigger=None,
        handoff_message="",
    )


# ─── CLI smoke-test ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    def _test(
        name: str, state: dict, user_input: str, expected_trigger: HandoffTrigger | None
    ) -> None:
        result = evaluate_handoff(state, user_input)
        status = "PASS" if result["trigger"] == expected_trigger else "FAIL"
        print(f"[{status}] {name}")
        if status == "FAIL":
            print(
                f"  expected trigger={expected_trigger}, got trigger={result['trigger']}"
            )
            print(
                f"  should_handoff={result['should_handoff']}, message={result['handoff_message']!r}"
            )
            sys.exit(1)
        else:
            print(
                f"  trigger={result['trigger']}, message={result['handoff_message'][:60]}..."
            )

    # Test 1: USER_REQUESTED
    _test(
        "USER_REQUESTED trigger",
        state={
            "objection": {"confidence": 0.9},
            "sentiment": {"label": "neutral", "score": 0.1},
        },
        user_input="I'd like to talk to a human please",
        expected_trigger=HandoffTrigger.USER_REQUESTED,
    )

    # Test 2: LOW_CONFIDENCE (negative sentiment present but label is not negative → fires)
    _test(
        "LOW_CONFIDENCE trigger",
        state={
            "objection": {"confidence": 0.25},
            "sentiment": {"label": "neutral", "score": 0.3},
        },
        user_input="I'm not sure about this pricing model",
        expected_trigger=HandoffTrigger.LOW_CONFIDENCE,
    )

    # Test 3: ANGRY_CUSTOMER
    _test(
        "ANGRY_CUSTOMER trigger",
        state={
            "objection": {"confidence": 0.9},
            "sentiment": {"label": "negative", "score": 0.92},
        },
        user_input="This is absolutely terrible service, I'm furious!",
        expected_trigger=HandoffTrigger.ANGRY_CUSTOMER,
    )

    # Test 4: No trigger on normal confident positive message
    _test(
        "No trigger (normal message)",
        state={
            "objection": {"confidence": 0.85},
            "sentiment": {"label": "positive", "score": 0.7},
        },
        user_input="Sounds great, I'd love to hear more about the product",
        expected_trigger=None,
    )

    # Test 5: LOW_CONFIDENCE does NOT fire when sentiment is negative (ANGRY takes priority)
    _test(
        "LOW_CONFIDENCE skipped when negative sentiment",
        state={
            "objection": {"confidence": 0.20},
            "sentiment": {"label": "negative", "score": 0.90},
        },
        user_input="I hate this, it's too expensive and I'm angry",
        expected_trigger=HandoffTrigger.ANGRY_CUSTOMER,
    )

    print("\nAll handoff tests passed.")
