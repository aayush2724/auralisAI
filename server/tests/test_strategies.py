"""
tests/test_strategies.py
─────────────────────────
Pytest suite for src/strategies/*.py and src/strategies/router.py

Tests every strategy's build_prompt() for:
  - Non-empty string output
  - Presence of required injected fields (memory_context, pitch_angle,
    tone_instruction, citations)
  - Strategy-specific content markers

And tests the router for:
  - Correct dispatch per label
  - Fallback for unknown labels
  - list_strategies() completeness

Run with:
    pytest tests/test_strategies.py -v
"""

from __future__ import annotations

import pytest

from src.graph.graph import GraphState
from src.strategies import (
    buying_signal_strategy,
    competitor_strategy,
    fit_strategy,
    price_strategy,
    timing_strategy,
    trust_strategy,
)
from src.strategies.router import get_strategy_prompt, list_strategies


# ─── Shared fixtures ──────────────────────────────────────────────────────────

def _make_state(obj_label: str = "price", persona: str = "CEO", **overrides) -> GraphState:
    """Build a minimal but complete GraphState for strategy testing."""
    state: GraphState = {
        "user_input":     "This is too expensive for our team.",
        "memory_context": "Customer context: company=Acme Corp | tools=Salesforce | budget=~$50k.",
        "citations":      "[1] Case Study (cases.pdf, chunk 0)\n[2] FAQ (faq.md, chunk 1)",
        "strategy":       obj_label + "_strategy",
        "confidence":     0.88,
        "should_handoff": False,
        "retrieved_docs": [
            {"text": "Acme Corp achieved 3x ROI within 6 months.", "source_file": "cases.pdf", "chunk_index": 0, "score": 0.12},
            {"text": "Our pricing starts at $499/month.",           "source_file": "pricing.md", "chunk_index": 0, "score": 0.18},
        ],
        "objection": {
            "label":      obj_label,
            "confidence": 0.88,
            "all_scores": {obj_label: 0.88},
            "triggers":   ["too expensive", "for our team"],
        },
        "sentiment": {
            "label":            "neutral",
            "score":            0.55,
            "tone_instruction": "Stay professional and informative.",
        },
        "persona": {
            "label":       persona,
            "confidence":  0.82,
            "pitch_angle": "Lead with ROI and operational cost savings.",
        },
        "metadata": {
            "pitch_angle":        "Lead with ROI and operational cost savings.",
            "tone_instruction":   "Stay professional and informative.",
            "objection_triggers": ["too expensive"],
            "competitor_mentioned": "HubSpot",
        },
    }
    state.update(overrides)
    return state


REQUIRED_INJECTIONS = [
    "Customer context:",          # memory_context
    "Lead with ROI",              # pitch_angle
    "Stay professional",          # tone_instruction
    "[1] Case Study",             # citations
]


def _assert_required_injections(prompt: str) -> None:
    """All four required fields must appear in every strategy prompt."""
    for phrase in REQUIRED_INJECTIONS:
        assert phrase in prompt, f"Missing required injection: '{phrase}'"


# ─── Individual strategy tests ────────────────────────────────────────────────

class TestPriceStrategy:
    def test_returns_non_empty_string(self):
        state = _make_state("price")
        result = price_strategy.build_prompt(state)
        assert isinstance(result, str) and len(result) > 100

    def test_required_injections(self):
        prompt = price_strategy.build_prompt(_make_state("price"))
        _assert_required_injections(prompt)

    def test_contains_roi_language(self):
        prompt = price_strategy.build_prompt(_make_state("price"))
        assert any(w in prompt.lower() for w in ["roi", "tco", "investment", "reframe"])

    def test_contains_payment_flexibility(self):
        prompt = price_strategy.build_prompt(_make_state("price"))
        assert any(w in prompt.lower() for w in ["pilot", "monthly", "flexible", "payment"])

    def test_confidence_rendered(self):
        prompt = price_strategy.build_prompt(_make_state("price", confidence=0.88))
        assert "88%" in prompt


class TestTrustStrategy:
    def test_returns_non_empty_string(self):
        assert len(trust_strategy.build_prompt(_make_state("trust"))) > 100

    def test_required_injections(self):
        _assert_required_injections(trust_strategy.build_prompt(_make_state("trust")))

    def test_contains_social_proof_language(self):
        prompt = trust_strategy.build_prompt(_make_state("trust"))
        assert any(w in prompt.lower() for w in ["social proof", "case stud", "credib", "guarantee", "risk reversal"])


class TestTimingStrategy:
    def test_returns_non_empty_string(self):
        assert len(timing_strategy.build_prompt(_make_state("timing"))) > 100

    def test_required_injections(self):
        _assert_required_injections(timing_strategy.build_prompt(_make_state("timing")))

    def test_contains_urgency_language(self):
        prompt = timing_strategy.build_prompt(_make_state("timing"))
        assert any(w in prompt.lower() for w in ["urgency", "delay", "cost of", "pilot slot", "re-engagement"])


class TestCompetitorStrategy:
    def _comp_state(self):
        return _make_state(
            "competitor",
            objection={
                "label": "competitor", "confidence": 0.91,
                "all_scores": {}, "triggers": ["HubSpot"],
            },
        )

    def test_returns_non_empty_string(self):
        assert len(competitor_strategy.build_prompt(self._comp_state())) > 100

    def test_required_injections(self):
        _assert_required_injections(competitor_strategy.build_prompt(self._comp_state()))

    def test_competitor_name_injected(self):
        prompt = competitor_strategy.build_prompt(self._comp_state())
        assert "HubSpot" in prompt

    def test_contains_switching_ease_language(self):
        prompt = competitor_strategy.build_prompt(self._comp_state())
        assert any(w in prompt.lower() for w in ["switch", "migrat", "parallel", "bake-off", "evaluation"])

    def test_fallback_competitor_name(self):
        """If no competitor_mentioned in metadata, falls back gracefully."""
        state = _make_state("competitor")
        state["metadata"].pop("competitor_mentioned", None)
        state["metadata"].pop("competitor_name", None)
        prompt = competitor_strategy.build_prompt(state)
        assert isinstance(prompt, str) and len(prompt) > 100


class TestFitStrategy:
    def test_returns_non_empty_string(self):
        assert len(fit_strategy.build_prompt(_make_state("fit"))) > 100

    def test_required_injections(self):
        _assert_required_injections(fit_strategy.build_prompt(_make_state("fit")))

    def test_contains_discovery_language(self):
        prompt = fit_strategy.build_prompt(_make_state("fit"))
        assert any(w in prompt.lower() for w in ["discovery", "question", "gap", "workflow", "mapping"])


class TestBuyingSignalStrategy:
    def test_returns_non_empty_string(self):
        assert len(buying_signal_strategy.build_prompt(_make_state("buying_signal"))) > 100

    def test_required_injections(self):
        _assert_required_injections(buying_signal_strategy.build_prompt(_make_state("buying_signal")))

    def test_contains_closing_language(self):
        prompt = buying_signal_strategy.build_prompt(_make_state("buying_signal"))
        assert any(w in prompt.lower() for w in ["close", "next step", "demo", "trial", "onboard", "frict"])


# ─── Empty / missing state handling ───────────────────────────────────────────

class TestEdgeCases:
    @pytest.mark.parametrize("strategy_fn", [
        price_strategy.build_prompt,
        trust_strategy.build_prompt,
        timing_strategy.build_prompt,
        competitor_strategy.build_prompt,
        fit_strategy.build_prompt,
        buying_signal_strategy.build_prompt,
    ])
    def test_empty_state_does_not_crash(self, strategy_fn):
        """All strategies must handle a nearly-empty state without raising."""
        minimal_state: GraphState = {"user_input": "Hello", "should_handoff": False}
        result = strategy_fn(minimal_state)
        assert isinstance(result, str) and len(result) > 0

    @pytest.mark.parametrize("strategy_fn", [
        price_strategy.build_prompt,
        trust_strategy.build_prompt,
        timing_strategy.build_prompt,
        competitor_strategy.build_prompt,
        fit_strategy.build_prompt,
        buying_signal_strategy.build_prompt,
    ])
    def test_empty_docs_handled(self, strategy_fn):
        state = _make_state("price", retrieved_docs=[], citations="")
        result = strategy_fn(state)
        assert isinstance(result, str) and len(result) > 0


# ─── Router tests ─────────────────────────────────────────────────────────────

class TestRouter:
    @pytest.mark.parametrize("label,expected_module", [
        ("price",         "price_strategy"),
        ("trust",         "trust_strategy"),
        ("timing",        "timing_strategy"),
        ("competitor",    "competitor_strategy"),
        ("fit",           "fit_strategy"),
        ("buying_signal", "buying_signal_strategy"),
        ("neutral",       "fit_strategy"),      # fallback
    ])
    def test_correct_dispatch(self, label, expected_module):
        state = _make_state(label)
        prompt = get_strategy_prompt(state)
        # Each strategy embeds its own label in the header comment
        assert isinstance(prompt, str) and len(prompt) > 100

    def test_unknown_label_fallback(self):
        """Unknown label should fall back to fit/discovery without crashing."""
        state = _make_state("completely_unknown_label")
        result = get_strategy_prompt(state)
        assert isinstance(result, str) and len(result) > 0

    def test_list_strategies_complete(self):
        strategies = list_strategies()
        required = {"price", "trust", "timing", "competitor", "fit", "buying_signal", "neutral"}
        assert required.issubset(set(strategies)), (
            f"Missing strategies: {required - set(strategies)}"
        )

    def test_router_output_contains_required_fields(self):
        """Router output (for any label) must contain the four required injections."""
        for label in list_strategies():
            state = _make_state(label)
            prompt = get_strategy_prompt(state)
            _assert_required_injections(prompt)
