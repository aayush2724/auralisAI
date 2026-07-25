"""
tests/test_explainability.py
──────────────────────────────
Pytest suite for src/utils/explainability.py

Covers:
  - ExplanationResult schema (all required keys, correct types)
  - objection_reason includes label, confidence %, and trigger phrases
  - persona_reason includes persona label and confidence
  - sentiment_reason includes sentiment label
  - strategy_reason includes strategy name
  - trigger_phrases match objection.triggers
  - confidence_note is populated for low-confidence inputs
  - handoff_reason is None when should_handoff=False, non-None otherwise
  - Empty / minimal state does not crash

Run with:
    pytest tests/test_explainability.py -v
"""

from __future__ import annotations

import pytest

from src.graph.graph import GraphState
from src.utils.explainability import explain

# ─── Required keys ────────────────────────────────────────────────────────────

REQUIRED_KEYS = {
    "objection_reason",
    "persona_reason",
    "sentiment_reason",
    "strategy_reason",
    "trigger_phrases",
    "confidence_note",
    "handoff_reason",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_state(**overrides) -> GraphState:
    state: GraphState = {
        "user_input":     "This is too expensive and out of our budget.",
        "memory_context": "Customer context: tools=Salesforce.",
        "citations":      "[1] Cases (cases.pdf, chunk 0)",
        "strategy":       "roi_business_case",
        "confidence":     0.91,
        "should_handoff": False,
        "retrieved_docs": [],
        "objection": {
            "label":      "price",
            "confidence": 0.91,
            "all_scores": {"price": 0.91, "neutral": 0.09},
            "triggers":   ["too expensive", "out of our budget"],
        },
        "sentiment": {
            "label":            "negative",
            "score":            0.72,
            "tone_instruction": "Be empathetic, slow down, acknowledge frustration first.",
        },
        "persona": {
            "label":       "CTO",
            "confidence":  0.83,
            "pitch_angle": "Lead with architecture, scalability, and API quality.",
        },
        "metadata": {
            "pitch_angle":      "Lead with architecture, scalability, and API quality.",
            "tone_instruction": "Be empathetic.",
        },
    }
    state.update(overrides)
    return state


# ─── Schema validation ────────────────────────────────────────────────────────

class TestSchema:
    def test_all_required_keys_present(self):
        result = explain(_make_state())
        assert REQUIRED_KEYS.issubset(result.keys()), (
            f"Missing keys: {REQUIRED_KEYS - result.keys()}"
        )

    def test_all_string_fields_are_strings(self):
        result = explain(_make_state())
        for key in ("objection_reason", "persona_reason", "sentiment_reason",
                    "strategy_reason", "confidence_note"):
            assert isinstance(result[key], str), f"{key} must be str"

    def test_trigger_phrases_is_list(self):
        result = explain(_make_state())
        assert isinstance(result["trigger_phrases"], list)
        for t in result["trigger_phrases"]:
            assert isinstance(t, str)

    def test_handoff_reason_none_or_str(self):
        result = explain(_make_state())
        assert result["handoff_reason"] is None or isinstance(result["handoff_reason"], str)


# ─── objection_reason ─────────────────────────────────────────────────────────

class TestObjectionReason:
    def test_contains_label(self):
        result = explain(_make_state())
        assert "price" in result["objection_reason"].lower()

    def test_contains_confidence_percentage(self):
        result = explain(_make_state())
        assert "91%" in result["objection_reason"]

    def test_contains_trigger_phrases(self):
        result = explain(_make_state())
        assert "too expensive" in result["objection_reason"]
        assert "out of our budget" in result["objection_reason"]

    def test_no_triggers_handled(self):
        state = _make_state()
        state["objection"]["triggers"] = []  # type: ignore[index]
        result = explain(state)
        assert "no explicit trigger" in result["objection_reason"]

    def test_competitor_label(self):
        state = _make_state()
        state["objection"] = {  # type: ignore[typeddict-item]
            "label": "competitor", "confidence": 0.88,
            "all_scores": {}, "triggers": ["HubSpot"],
        }
        result = explain(state)
        assert "competitor" in result["objection_reason"].lower()
        assert "HubSpot" in result["objection_reason"]


# ─── persona_reason ───────────────────────────────────────────────────────────

class TestPersonaReason:
    def test_contains_persona_label(self):
        result = explain(_make_state())
        assert "CTO" in result["persona_reason"]

    def test_contains_confidence(self):
        result = explain(_make_state())
        assert "83%" in result["persona_reason"]

    def test_contains_pitch_angle(self):
        result = explain(_make_state())
        assert "architecture" in result["persona_reason"].lower() or \
               "pitch angle" in result["persona_reason"].lower()

    def test_unknown_persona(self):
        state = _make_state()
        state["persona"] = {"label": "Unknown", "confidence": 0.20, "pitch_angle": ""}  # type: ignore[typeddict-item]
        result = explain(state)
        assert "Unknown" in result["persona_reason"]


# ─── sentiment_reason ─────────────────────────────────────────────────────────

class TestSentimentReason:
    def test_negative_sentiment(self):
        result = explain(_make_state())
        reason = result["sentiment_reason"]
        assert "frustrated" in reason.lower() or "negative" in reason.lower() or "resistant" in reason.lower()

    def test_positive_sentiment(self):
        state = _make_state()
        state["sentiment"] = {  # type: ignore[typeddict-item]
            "label": "positive", "score": 0.88,
            "tone_instruction": "Match the customer energy, be enthusiastic.",
        }
        result = explain(state)
        assert "engaged" in result["sentiment_reason"].lower() or \
               "receptive" in result["sentiment_reason"].lower() or \
               "positive" in result["sentiment_reason"].lower()

    def test_neutral_sentiment(self):
        state = _make_state()
        state["sentiment"] = {  # type: ignore[typeddict-item]
            "label": "neutral", "score": 0.55,
            "tone_instruction": "Stay professional and informative.",
        }
        result = explain(state)
        assert "professional" in result["sentiment_reason"].lower() or \
               "neutral" in result["sentiment_reason"].lower() or \
               "measured" in result["sentiment_reason"].lower()


# ─── strategy_reason ──────────────────────────────────────────────────────────

class TestStrategyReason:
    def test_contains_strategy_name(self):
        result = explain(_make_state())
        assert "roi_business_case" in result["strategy_reason"].lower() or \
               "applied" in result["strategy_reason"].lower()

    def test_contains_objection_label(self):
        result = explain(_make_state())
        assert "price" in result["strategy_reason"].lower()

    @pytest.mark.parametrize("obj_label,persona,expected_keyword", [
        ("price",   "CEO",       "roi"),
        ("price",   "Founder",   "roi"),
        ("trust",   "CTO",       "technical proof"),
        ("trust",   "Developer", "technical proof"),
        ("timing",  "CEO",       "strategic timing"),
        ("competitor", "Developer", "technical differentiation"),
        ("fit",     "Product_Manager", "use-case mapping"),
        ("buying_signal", "Unknown", "closing accelerator"),
    ])
    def test_strategy_reason_per_combination(self, obj_label, persona, expected_keyword):
        state = _make_state(
            objection={"label": obj_label, "confidence": 0.88, "all_scores": {}, "triggers": []},
            persona={"label": persona, "confidence": 0.80, "pitch_angle": ""},
            strategy="test_strategy",
        )
        result = explain(state)
        assert expected_keyword.lower() in result["strategy_reason"].lower(), (
            f"Expected '{expected_keyword}' in strategy_reason for "
            f"{obj_label}+{persona}: {result['strategy_reason']}"
        )


# ─── trigger_phrases ──────────────────────────────────────────────────────────

class TestTriggerPhrases:
    def test_matches_objection_triggers(self):
        result = explain(_make_state())
        assert result["trigger_phrases"] == ["too expensive", "out of our budget"]

    def test_empty_triggers(self):
        state = _make_state()
        state["objection"]["triggers"] = []  # type: ignore[index]
        result = explain(state)
        assert result["trigger_phrases"] == []


# ─── confidence_note ──────────────────────────────────────────────────────────

class TestConfidenceNote:
    def test_no_note_for_high_confidence(self):
        """High confidence and non-frustrated sentiment → empty confidence note."""
        state = _make_state(
            confidence=0.92,
            sentiment={"label": "neutral", "score": 0.55, "tone_instruction": ""},
        )
        state["objection"]["confidence"] = 0.92  # type: ignore[index]
        result = explain(state)
        assert result["confidence_note"] == ""

    def test_low_confidence_triggers_note(self):
        state = _make_state(confidence=0.30)
        state["objection"]["confidence"] = 0.30  # type: ignore[index]
        result = explain(state)
        assert result["confidence_note"] != ""
        assert "low" in result["confidence_note"].lower() or "uncertain" in result["confidence_note"].lower()

    def test_high_frustration_triggers_note(self):
        state = _make_state(
            confidence=0.88,
            sentiment={"label": "negative", "score": 0.92, "tone_instruction": ""},
        )
        result = explain(state)
        assert result["confidence_note"] != ""
        assert "escalation" in result["confidence_note"].lower() or "frustrat" in result["confidence_note"].lower()


# ─── handoff_reason ───────────────────────────────────────────────────────────

class TestHandoffReason:
    def test_no_handoff_returns_none(self):
        state = _make_state(should_handoff=False)
        result = explain(state)
        assert result["handoff_reason"] is None

    def test_handoff_returns_non_empty_string(self):
        state = _make_state(should_handoff=True, confidence=0.25)
        state["objection"]["confidence"] = 0.25  # type: ignore[index]
        result = explain(state)
        assert isinstance(result["handoff_reason"], str)
        assert len(result["handoff_reason"]) > 0

    def test_handoff_reason_mentions_confidence(self):
        state = _make_state(should_handoff=True, confidence=0.20)
        state["objection"]["confidence"] = 0.20  # type: ignore[index]
        result = explain(state)
        assert "confidence" in result["handoff_reason"].lower()

    def test_handoff_reason_mentions_frustration(self):
        state = _make_state(
            should_handoff=True,
            confidence=0.88,
            sentiment={"label": "negative", "score": 0.92, "tone_instruction": ""},
        )
        result = explain(state)
        assert result["handoff_reason"] is not None
        assert "sentiment" in result["handoff_reason"].lower() or \
               "frustrat" in result["handoff_reason"].lower()


# ─── Edge cases ───────────────────────────────────────────────────────────────

class TestEdgeCases:
    def test_minimal_state_no_crash(self):
        """Completely minimal state must not raise."""
        result = explain({"user_input": "Hello", "should_handoff": False})
        assert REQUIRED_KEYS.issubset(result.keys())

    def test_none_values_in_state(self):
        state: GraphState = {
            "user_input": "Hi",
            "should_handoff": False,
            "objection": None,   # type: ignore[typeddict-item]
            "sentiment": None,   # type: ignore[typeddict-item]
            "persona":   None,   # type: ignore[typeddict-item]
        }
        result = explain(state)
        assert REQUIRED_KEYS.issubset(result.keys())

    def test_all_string_fields_non_none(self):
        result = explain(_make_state())
        for key in ("objection_reason", "persona_reason", "sentiment_reason",
                    "strategy_reason", "confidence_note"):
            assert result[key] is not None
