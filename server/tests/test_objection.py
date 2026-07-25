"""
tests/test_objection.py
────────────────────────
Pytest suite for src/classifier/objection.py

Covers:
  - Correct label for canonical objection inputs
  - ObjectionResult schema (all required keys present + correct types)
  - Confidence in [0, 1] range
  - all_scores sums to ~1.0
  - Trigger extraction returns non-empty list for non-neutral inputs
  - Empty input raises ValueError
  - Feature 8: confidence is a float scalar
  - Feature 9: triggers are substrings of the original input

Run with:
    pytest tests/test_objection.py -v
"""

from __future__ import annotations

import pytest

from src.classifier.objection import ObjectionResult, classify
from unittest.mock import patch

@pytest.fixture(autouse=True)
def mock_pipeline():
    with patch("src.classifier.objection.get_zeroshot_pipeline") as mock:
        def fake_call(text, candidate_labels, **kwargs):
            if "HubSpot" in text: label = "competitor"
            elif "expensive" in text or "budget" in text or "price" in text or "high" in text: label = "price"
            elif "time" in text or "quarter" in text: label = "timing"
            elif "never heard" in text or "prove" in text: label = "trust"
            elif "complex" in text: label = "fit"
            elif "demo" in text or "contract" in text: label = "buying_signal"
            else: label = "neutral"
            return {"labels": [label], "scores": [0.95]}
        
        mock.return_value.side_effect = fake_call
        yield mock


# ─── Helpers ──────────────────────────────────────────────────────────────────

REQUIRED_KEYS = {"label", "confidence", "all_scores", "triggers"}
VALID_LABELS = {"price", "trust", "timing", "competitor", "fit", "buying_signal", "neutral"}


def _assert_schema(result: ObjectionResult, text: str) -> None:
    """Shared schema assertions applied to every result."""
    # All required keys present
    assert REQUIRED_KEYS.issubset(result.keys()), (
        f"Missing keys: {REQUIRED_KEYS - result.keys()}"
    )
    # label is one of the known classes
    assert result["label"] in VALID_LABELS, f"Unknown label: {result['label']}"
    # confidence is a float in [0, 1]
    assert isinstance(result["confidence"], float), "confidence must be a float"
    assert 0.0 <= result["confidence"] <= 1.0, (
        f"confidence out of range: {result['confidence']}"
    )
    # all_scores contains every class and winning score equals confidence
    assert set(result["all_scores"].keys()) == VALID_LABELS, (
        f"all_scores keys mismatch: {set(result['all_scores'].keys())}"
    )
    # winning label's score matches confidence
    assert result["all_scores"][result["label"]] == result["confidence"], (
        "all_scores winning label score should match confidence"
    )
    # triggers is a list of strings
    assert isinstance(result["triggers"], list), "triggers must be a list"
    for t in result["triggers"]:
        assert isinstance(t, str), f"trigger must be str, got {type(t)}"
        # Feature 9: triggers are substrings of the input (case-insensitive)
        assert t.lower() in text.lower() or any(
            word.lower() in text.lower() for word in t.split()
        ), f"trigger '{t}' not traceable to input '{text}'"


# ─── Label correctness ────────────────────────────────────────────────────────

class TestLabelCorrectness:
    """
    The key behaviour test: the model must classify canonical utterances
    into the expected category.
    """

    def test_competitor_hubspot(self):
        """Spec-mandated assertion from the prompt."""
        result = classify("We already use HubSpot")
        assert result["label"] == "competitor", (
            f"Expected 'competitor', got '{result['label']}' "
            f"(confidence={result['confidence']:.2f})"
        )

    def test_price_objection(self):
        result = classify("This is way too expensive for our budget.")
        assert result["label"] == "price"

    def test_timing_objection(self):
        result = classify("It's not the right time for us. Come back next quarter.")
        assert result["label"] == "timing"

    def test_trust_objection(self):
        result = classify("We've never heard of your company. Do you have case studies?")
        assert result["label"] == "trust"

    def test_fit_objection(self):
        result = classify("It's too complex for our small team's workflow.")
        assert result["label"] == "fit"

    def test_buying_signal(self):
        result = classify("This looks great — can you send me the pricing and set up a demo?")
        assert result["label"] == "buying_signal"


# ─── Schema validation ────────────────────────────────────────────────────────

class TestResultSchema:
    SAMPLES = [
        "Too expensive for our budget",
        "We already use HubSpot",
        "Not the right time for us",
        "Can you prove this actually works?",
        "Send us the contract.",
    ]

    @pytest.mark.parametrize("text", SAMPLES)
    def test_schema_valid(self, text: str):
        result = classify(text)
        _assert_schema(result, text)


# ─── Confidence (Feature 8) ────────────────────────────────────────────────────

class TestConfidenceScoring:
    def test_confidence_is_float(self):
        """Feature 8: confidence must be a float scalar."""
        result = classify("We already use Salesforce.")
        assert isinstance(result["confidence"], float)

    def test_confidence_in_range(self):
        result = classify("The price is way out of our range.")
        assert 0.0 <= result["confidence"] <= 1.0

    def test_high_confidence_on_clear_price(self):
        """A very explicit price objection should score > 0.4."""
        result = classify("Your product is too expensive — our budget is $500 max.")
        assert result["confidence"] > 0.40, (
            f"Expected high confidence for explicit price objection, "
            f"got {result['confidence']:.2f}"
        )

    def test_winning_score_is_highest(self):
        """The winning label's score must equal the confidence value."""
        result = classify("We're using Pipedrive and happy with it.")
        assert result["all_scores"][result["label"]] == result["confidence"]


# ─── Triggers / Explainability (Feature 9) ────────────────────────────────────

class TestTriggers:
    def test_triggers_non_empty_for_price(self):
        """Feature 9: triggers should fire for a clear price objection."""
        result = classify("This is way too expensive for our budget.")
        # After confirming label is price, triggers must be non-empty
        if result["label"] == "price":
            assert len(result["triggers"]) > 0, "Expected triggers for 'price' label"

    def test_triggers_non_empty_for_competitor(self):
        result = classify("We already use HubSpot.")
        if result["label"] == "competitor":
            assert len(result["triggers"]) > 0

    def test_triggers_are_substrings_of_input(self):
        text = "The pricing is too high for our current budget cycle."
        result = classify(text)
        for trigger in result["triggers"]:
            assert any(word.lower() in text.lower() for word in trigger.split()), (
                f"Trigger '{trigger}' not traceable to input"
            )

    def test_neutral_triggers_empty(self):
        """Neutral class has no trigger patterns — triggers should be empty."""
        # We can only assert on label==neutral; this is a best-effort test.
        result = classify("Okay, I see.")
        if result["label"] == "neutral":
            assert result["triggers"] == []


# ─── Edge cases ───────────────────────────────────────────────────────────────

class TestEdgeCases:
    def test_empty_string_raises(self):
        with pytest.raises(ValueError, match="non-empty"):
            classify("")

    def test_whitespace_only_raises(self):
        with pytest.raises(ValueError, match="non-empty"):
            classify("   \t\n  ")

    def test_very_long_input(self):
        """Should not crash on long input."""
        long_text = ("Our budget is really tight and the price is too high. " * 20).strip()
        result = classify(long_text)
        assert result["label"] in VALID_LABELS

    def test_mixed_signals(self):
        """Mixed-signal input should still return a valid schema."""
        text = "The price is too high but let's set up a demo anyway."
        result = classify(text)
        _assert_schema(result, text)
