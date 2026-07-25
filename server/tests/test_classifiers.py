"""
tests/test_classifiers.py
─────────────────────────
Pytest suite covering the three Auralis classifiers end-to-end:
  - src.classifier.objection  (classify)
  - src.classifier.sentiment  (analyze)
  - src.classifier.persona    (detect)

Run with:
    pytest tests/test_classifiers.py -v
"""

from __future__ import annotations


from src.classifier.objection import classify
from src.classifier.sentiment import analyze
from src.classifier.persona import detect


# ─── Objection classifier ────────────────────────────────────────────────────


class TestObjectionClassifier:
    def test_objection_price(self):
        result = classify(
            "This is way too expensive, it is completely out of our budget"
        )
        assert result["label"] in ("price", "pricing"), (
            f"Expected 'price' or 'pricing', got '{result['label']}'"
        )
        assert result["confidence"] > 0.7, (
            f"Expected confidence > 0.7, got {result['confidence']:.2f}"
        )
        assert len(result["triggers"]) >= 1, "Expected at least one trigger phrase"

    def test_objection_competitor(self):
        result = classify(
            "We are already using HubSpot and it works fine for us"
        )
        assert result["label"] == "competitor", (
            f"Expected 'competitor', got '{result['label']}'"
        )

    def test_objection_buying_signal(self):
        result = classify(
            "This looks great, how do we get started with the trial?"
        )
        assert result["label"] == "buying_signal", (
            f"Expected 'buying_signal', got '{result['label']}'"
        )


# ─── Sentiment classifier ────────────────────────────────────────────────────


class TestSentimentClassifier:
    def test_sentiment_negative(self):
        result = analyze(
            "I am really frustrated, we have had nothing but problems"
        )
        assert result["label"] == "negative", (
            f"Expected 'negative', got '{result['label']}'"
        )
        assert result["score"] > 0.7, (
            f"Expected score > 0.7, got {result['score']:.2f}"
        )
        tone = result["tone_instruction"].lower()
        assert "empathetic" in tone or "acknowledge" in tone, (
            f"Tone instruction should contain 'empathetic' or 'acknowledge', "
            f"got: {result['tone_instruction']}"
        )

    def test_sentiment_positive(self):
        result = analyze(
            "This is exactly what we were looking for, really impressive"
        )
        assert result["label"] == "positive", (
            f"Expected 'positive', got '{result['label']}'"
        )


# ─── Persona classifier ──────────────────────────────────────────────────────


class TestPersonaClassifier:
    def test_persona_cto(self):
        result = detect(
            "As CTO I need to understand the API architecture and scalability limits"
        )
        assert result["label"] == "CTO", (
            f"Expected 'CTO', got '{result['label']}'"
        )
        pitch = result["pitch_angle"].lower()
        assert "api" in pitch or "architect" in pitch, (
            f"Pitch angle should reference 'api' or 'architect', "
            f"got: {result['pitch_angle']}"
        )

    def test_persona_ceo(self):
        result = detect(
            "I am the CEO and I need to see the ROI numbers and cost savings"
        )
        assert result["label"] == "CEO", (
            f"Expected 'CEO', got '{result['label']}'"
        )
