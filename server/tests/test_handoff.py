"""
tests/test_handoff.py
─────────────────────
Pytest suite for src/handoff/handoff.py

Covers:
  - USER_REQUESTED trigger fires on human-agent phrases
  - LOW_CONFIDENCE trigger fires when objection confidence < 0.40
  - ANGRY_CUSTOMER trigger fires when negative sentiment > 0.85
  - No trigger on normal confident messages
  - USER_REQUESTED overrides LOW_CONFIDENCE and ANGRY_CUSTOMER

Run with:
    pytest tests/test_handoff.py -v
"""

from __future__ import annotations


from src.handoff.handoff import HandoffTrigger, evaluate_handoff


# ─── Helper ───────────────────────────────────────────────────────────────────

def make_state(
    confidence: float = 0.85,
    sentiment: str = "neutral",
    sentiment_score: float = 0.5,
) -> dict:
    """Return a minimal state dict matching the GraphState structure."""
    return {
        "objection": {"confidence": confidence},
        "sentiment": {"label": sentiment, "score": sentiment_score},
    }


# ─── Tests ────────────────────────────────────────────────────────────────────


def test_user_requested_trigger() -> None:
    state = make_state()
    result = evaluate_handoff(state, "I want to talk to a real person")
    assert result["should_handoff"] is True
    assert result["trigger"] == HandoffTrigger.USER_REQUESTED
    assert len(result["handoff_message"]) > 0


def test_low_confidence_trigger() -> None:
    state = make_state(confidence=0.30, sentiment="neutral")
    result = evaluate_handoff(state, "What are your pricing plans?")
    assert result["should_handoff"] is True
    assert result["trigger"] == HandoffTrigger.LOW_CONFIDENCE


def test_angry_customer_trigger() -> None:
    state = make_state(sentiment="negative", sentiment_score=0.92)
    result = evaluate_handoff(state, "This is completely unacceptable")
    assert result["should_handoff"] is True
    assert result["trigger"] == HandoffTrigger.ANGRY_CUSTOMER


def test_no_trigger_normal_message() -> None:
    state = make_state(confidence=0.88, sentiment="positive", sentiment_score=0.9)
    result = evaluate_handoff(state, "How does your pricing work?")
    assert result["should_handoff"] is False
    assert result["trigger"] is None
    assert result["handoff_message"] == ""


def test_user_requested_overrides_low_confidence() -> None:
    state = make_state(confidence=0.20, sentiment="negative", sentiment_score=0.95)
    result = evaluate_handoff(state, "please connect me to a human")
    assert result["trigger"] == HandoffTrigger.USER_REQUESTED
