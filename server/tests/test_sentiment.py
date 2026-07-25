"""
tests/test_sentiment.py
────────────────────────
Pytest suite for src/classifier/sentiment.py

Covers:
  - Schema validation (all required keys, correct types)
  - Label mapping (positive / neutral / negative)
  - Tone instructions are non-empty strings
  - Score is a float in [0, 1]
  - Empty input raises ValueError
  - Positive text → positive label
  - Negative/frustrated text → negative label

Run with:
    pytest tests/test_sentiment.py -v
"""

from __future__ import annotations

import pytest

from src.classifier.sentiment import SentimentResult, _TONE_INSTRUCTIONS, analyze

# ─── Constants ────────────────────────────────────────────────────────────────

REQUIRED_KEYS    = {"label", "score", "tone_instruction"}
VALID_LABELS     = {"positive", "neutral", "negative"}
VALID_TONE_KEYS  = set(_TONE_INSTRUCTIONS.keys())


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _assert_schema(result: SentimentResult) -> None:
    assert REQUIRED_KEYS.issubset(result.keys()), (
        f"Missing keys: {REQUIRED_KEYS - result.keys()}"
    )
    assert result["label"] in VALID_LABELS, f"Unknown label: {result['label']}"
    assert isinstance(result["score"], float), "score must be a float"
    assert 0.0 <= result["score"] <= 1.0, f"score out of range: {result['score']}"
    assert isinstance(result["tone_instruction"], str), "tone_instruction must be str"
    assert result["tone_instruction"], "tone_instruction must not be empty"


# ─── Schema tests ─────────────────────────────────────────────────────────────

class TestSchema:
    SAMPLES = [
        "This is amazing, I love it!",
        "I'm not sure about this.",
        "This is terrible and I'm very frustrated.",
        "Okay.",
        "We already use Salesforce and are happy with it.",
    ]

    @pytest.mark.parametrize("text", SAMPLES)
    def test_schema_valid(self, text: str):
        result = analyze(text)
        _assert_schema(result)


# ─── Label mapping ────────────────────────────────────────────────────────────

class TestLabelMapping:
    def test_clearly_positive(self):
        result = analyze("This is exactly what we needed — absolutely love it!")
        assert result["label"] == "positive", (
            f"Expected 'positive', got '{result['label']}' (score={result['score']:.2f})"
        )

    def test_clearly_negative(self):
        result = analyze("This product is terrible and a complete waste of money.")
        assert result["label"] == "negative", (
            f"Expected 'negative', got '{result['label']}' (score={result['score']:.2f})"
        )

    def test_label_is_lowercase(self):
        """Labels must be lowercase (not 'POSITIVE'/'NEGATIVE')."""
        result = analyze("I like this product.")
        assert result["label"] == result["label"].lower()


# ─── Tone instructions ────────────────────────────────────────────────────────

class TestToneInstructions:
    def test_positive_tone_instruction(self):
        result = analyze("Fantastic product, ready to sign up!")
        if result["label"] == "positive":
            assert "enthusiastic" in result["tone_instruction"].lower()

    def test_negative_tone_instruction(self):
        result = analyze("I am really disappointed with the support.")
        if result["label"] == "negative":
            assert "empathetic" in result["tone_instruction"].lower()

    def test_all_tone_instructions_non_empty(self):
        """Every label in _TONE_INSTRUCTIONS must map to a non-empty string."""
        for label, instruction in _TONE_INSTRUCTIONS.items():
            assert instruction, f"tone_instruction for '{label}' is empty"

    def test_tone_matches_label(self):
        """tone_instruction must be the one registered for the returned label."""
        text = "I'm very happy with the demo — let's move forward."
        result = analyze(text)
        expected_tone = _TONE_INSTRUCTIONS[result["label"]]
        assert result["tone_instruction"] == expected_tone


# ─── Edge cases ───────────────────────────────────────────────────────────────

class TestEdgeCases:
    def test_empty_string_raises(self):
        with pytest.raises(ValueError, match="non-empty"):
            analyze("")

    def test_whitespace_only_raises(self):
        with pytest.raises(ValueError, match="non-empty"):
            analyze("   \t\n")

    def test_very_long_input(self):
        """Should not crash on long inputs (model truncates to 512 tokens)."""
        long_text = ("The product is great and we love using it every day! " * 30).strip()
        result = analyze(long_text)
        _assert_schema(result)

    def test_single_word(self):
        result = analyze("Excellent!")
        _assert_schema(result)
