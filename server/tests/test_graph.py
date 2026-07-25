"""
tests/test_graph.py
────────────────────
Pytest suite for src/graph/graph.py

Strategy: mock the expensive I/O (LLM call, FAISS retrieval, HuggingFace
models) so the graph wiring, state propagation, and routing logic can be
tested fast and offline.

Run with:
    pytest tests/test_graph.py -v
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from src.graph.graph import (
    GraphState,
    _should_handoff,
    classify_node,
    generate_node,
    handoff_node,
    retrieve_node,
    run_graph,
    strategy_node,
)
from src.memory.memory import ConversationMemory


# ─── Shared mock factories ────────────────────────────────────────────────────

def _mock_combined(obj_label="price", obj_conf=0.88, per_label="CTO", per_conf=0.82) -> dict:
    return {
        "objection": {"label": obj_label, "confidence": obj_conf},
        "persona": {"label": per_label, "confidence": per_conf}
    }

def _mock_objection(label="price", confidence=0.88) -> dict:
    return {
        "label":      label,
        "confidence": confidence,
        "all_scores": {label: confidence, "neutral": 1 - confidence},
        "triggers":   ["too expensive"],
    }


def _mock_sentiment(label="neutral", score=0.55) -> dict:
    return {
        "label":            label,
        "score":            score,
        "tone_instruction": "Stay professional and informative.",
    }


def _mock_persona(label="CTO", confidence=0.82) -> dict:
    return {
        "label":       label,
        "confidence":  confidence,
        "pitch_angle": "Lead with architecture, scalability, and API quality.",
    }


def _mock_docs() -> list[dict]:
    return [
        {"text": "Case study: Acme reduced costs by 30%.", "source_file": "cases.pdf", "chunk_index": 0, "score": 0.12},
        {"text": "ROI calculator shows 3x return.",        "source_file": "faq.md",    "chunk_index": 1, "score": 0.18},
    ]


def _base_state(**overrides) -> GraphState:
    state: GraphState = {
        "user_input":     "This is too expensive for our budget.",
        "objection":      _mock_objection(),
        "sentiment":      _mock_sentiment(),
        "persona":        _mock_persona(),
        "retrieved_docs": _mock_docs(),
        "citations":      "[1] Cases (cases.pdf, chunk 0)\n[2] FAQ (faq.md, chunk 1)",
        "memory_context": "Customer context: tools=Salesforce.",
        "strategy":       "value_reframe",
        "response":       "",
        "confidence":     0.88,
        "should_handoff": False,
        "metadata": {
            "pitch_angle":      "Lead with architecture.",
            "tone_instruction": "Stay professional.",
            "objection_triggers": ["too expensive"],
        },
    }
    state.update(overrides)
    return state


# ─── classify_node ────────────────────────────────────────────────────────────

class TestClassifyNode:
    @patch("src.graph.graph.get_zeroshot_pipeline")
    @patch("src.graph.graph.analyze",  return_value=_mock_sentiment())
    def test_returns_all_classifier_results(self, mock_analyze, mock_pipeline):
        mock_pipeline.return_value.classify_combined.return_value = _mock_combined()
        state = {"user_input": "This is too expensive."}
        result = classify_node(state)

        assert "objection"  in result
        assert "sentiment"  in result
        assert "persona"    in result
        assert "confidence" in result
        assert "metadata"   in result

    @patch("src.graph.graph.get_zeroshot_pipeline")
    @patch("src.graph.graph.analyze",  return_value=_mock_sentiment())
    def test_confidence_mirrors_objection(self, mock_analyze, mock_pipeline):
        mock_pipeline.return_value.classify_combined.return_value = _mock_combined("competitor", 0.91)
        result = classify_node({"user_input": "We use HubSpot."})
        assert result["confidence"] == pytest.approx(0.91)

    @patch("src.graph.graph.get_zeroshot_pipeline")
    @patch("src.graph.graph.analyze",  return_value=_mock_sentiment())
    def test_metadata_contains_pitch_angle(self, mock_analyze, mock_pipeline):
        mock_pipeline.return_value.classify_combined.return_value = _mock_combined()
        result = classify_node({"user_input": "Explain your APIs."})
        assert "pitch_angle" in result["metadata"]

    @patch("src.graph.graph.get_zeroshot_pipeline")
    @patch("src.graph.graph.analyze",  return_value=_mock_sentiment())
    def test_classifier_failure_propagates(self, mock_analyze, mock_pipeline):
        mock_pipeline.return_value.classify_combined.side_effect = RuntimeError("Model down")
        with pytest.raises(RuntimeError, match="Model down"):
            classify_node({"user_input": "Hello"})


# ─── retrieve_node ────────────────────────────────────────────────────────────

class TestRetrieveNode:
    @patch("src.graph.graph.retrieve",         return_value=_mock_docs())
    @patch("src.graph.graph.format_citations", return_value="[1] Source A")
    def test_returns_docs_and_citations(self, mock_cit, mock_ret):
        state = _base_state()
        result = retrieve_node(state)

        assert "retrieved_docs" in result
        assert "citations"      in result
        assert len(result["retrieved_docs"]) == 2
        assert "[1]" in result["citations"]

    @patch("src.graph.graph.retrieve", side_effect=FileNotFoundError("No index"))
    def test_graceful_fallback_on_missing_index(self, _):
        state = _base_state()
        result = retrieve_node(state)

        assert result["retrieved_docs"] == []
        assert result["citations"] == ""

    @patch("src.graph.graph.retrieve",         return_value=_mock_docs())
    @patch("src.graph.graph.format_citations", return_value="[1] Source A")
    def test_query_enriched_with_objection_label(self, _, mock_ret):
        state = _base_state()
        retrieve_node(state)
        call_args = mock_ret.call_args[0][0]   # first positional arg = query string
        assert "price" in call_args.lower()


# ─── strategy_node ────────────────────────────────────────────────────────────

class TestStrategyNode:
    @pytest.mark.parametrize("obj_label,persona,expected_strategy", [
        ("price",      "CEO",      "roi_business_case"),
        ("price",      "CTO",      "value_reframe"),
        ("price",      "Developer","value_reframe"),
        ("trust",      "CTO",      "technical_proof"),
        ("trust",      "CEO",      "social_proof"),
        ("competitor", "Developer","technical_differentiation"),
        ("competitor", "Founder",  "competitive_differentiation"),
        ("timing",     "CEO",      "strategic_timing"),
        ("buying_signal", "Unknown", "closing_accelerator"),
        ("neutral",    "Unknown",  "discovery_questions"),
    ])
    def test_strategy_selection(self, obj_label, persona, expected_strategy):
        state = _base_state(
            objection=_mock_objection(obj_label),
            persona=_mock_persona(persona),
        )
        result = strategy_node(state)
        assert result["strategy"] == expected_strategy

    def test_competitor_adds_to_metadata(self):
        state = _base_state(
            objection={**_mock_objection("competitor"), "triggers": ["HubSpot"]},
            persona=_mock_persona("CEO"),
        )
        result = strategy_node(state)
        assert result["metadata"].get("competitor_mentioned") == "HubSpot"

    def test_unknown_objection_falls_back(self):
        state = _base_state(objection=_mock_objection("totally_unknown_label"))
        result = strategy_node(state)
        assert result["strategy"] == "discovery_questions"


# ─── generate_node ────────────────────────────────────────────────────────────

class TestGenerateNode:
    def _mock_llm_response(self, text="Here is the generated response."):
        mock_msg = MagicMock()
        mock_msg.content = text
        return mock_msg

    @patch("src.graph.graph._get_llm")
    def test_response_populated(self, mock_get_llm):
        mock_get_llm.return_value.invoke.return_value = self._mock_llm_response()
        state = _base_state()
        result = generate_node(state)
        assert "response" in result
        assert len(result["response"]) > 0

    @patch("src.graph.graph._get_llm")
    def test_citations_appended_if_not_in_response(self, mock_get_llm):
        mock_get_llm.return_value.invoke.return_value = self._mock_llm_response(
            "Here is the response without any citation markers."
        )
        state = _base_state(citations="[1] Source A (file.pdf, chunk 0)")
        result = generate_node(state)
        assert "[1] Source A" in result["response"]

    @patch("src.graph.graph._get_llm")
    def test_no_duplicate_citations(self, mock_get_llm):
        citations = "[1] Source A (file.pdf, chunk 0)"
        mock_get_llm.return_value.invoke.return_value = self._mock_llm_response(
            f"Response already includes: {citations}"
        )
        state = _base_state(citations=citations)
        result = generate_node(state)
        assert result["response"].count("[1] Source A") == 1

    @patch("src.graph.graph._get_llm")
    def test_empty_docs_handled(self, mock_get_llm):
        mock_get_llm.return_value.invoke.return_value = self._mock_llm_response()
        state = _base_state(retrieved_docs=[], citations="")
        result = generate_node(state)
        assert "response" in result


# ─── handoff_node ─────────────────────────────────────────────────────────────

class TestHandoffNode:
    def test_sets_should_handoff_true(self):
        state = _base_state(confidence=0.25, objection=_mock_objection(confidence=0.25))
        result = handoff_node(state)
        assert result["should_handoff"] is True

    def test_returns_handoff_message(self):
        state = _base_state(confidence=0.25, objection=_mock_objection(confidence=0.25))
        result = handoff_node(state)
        assert "handoff_message" in result
        assert len(result["handoff_message"]) > 0

    def test_empty_response_handled(self):
        state = _base_state(response="", confidence=0.25, objection=_mock_objection(confidence=0.25))
        result = handoff_node(state)
        assert result["should_handoff"] is True
        assert len(result["handoff_message"]) > 0
        assert len(result["handoff_message"]) > 0


# ─── _should_handoff router ───────────────────────────────────────────────────

class TestShouldHandoffRouter:
    def test_low_confidence_triggers_handoff(self):
        state = _base_state(confidence=0.25, objection=_mock_objection(confidence=0.25))
        assert _should_handoff(state) == "handoff"

    def test_confidence_at_threshold_does_not_trigger(self):
        state = _base_state(confidence=0.40, objection=_mock_objection(confidence=0.40))
        assert _should_handoff(state) == "end"

    def test_above_threshold_no_handoff(self):
        state = _base_state(confidence=0.80, objection=_mock_objection(confidence=0.80))
        assert _should_handoff(state) == "end"

    def test_high_negative_sentiment_triggers_handoff(self):
        state = _base_state(
            confidence=0.75,
            objection=_mock_objection(label="unknown", confidence=0.75),
            sentiment=_mock_sentiment("negative", 0.92),
        )
        assert _should_handoff(state) == "handoff"

    def test_negative_sentiment_below_threshold_no_handoff(self):
        state = _base_state(
            confidence=0.75,
            objection=_mock_objection(label="unknown", confidence=0.75),
            sentiment=_mock_sentiment("negative", 0.80),
        )
        assert _should_handoff(state) == "end"

    def test_positive_high_confidence_no_handoff(self):
        state = _base_state(
            confidence=0.92,
            objection=_mock_objection(confidence=0.92),
            sentiment=_mock_sentiment("positive", 0.95),
        )
        assert _should_handoff(state) == "end"


# ─── run_graph (integration, all I/O mocked) ─────────────────────────────────

class TestRunGraph:
    def _patch_all(self):
        """Context manager that patches all external I/O."""
        import unittest.mock as um
        patches = [
            um.patch("src.graph.graph.get_zeroshot_pipeline"),
            um.patch("src.graph.graph.analyze",  return_value=_mock_sentiment()),
            um.patch("src.graph.graph.retrieve", return_value=_mock_docs()),
            um.patch("src.graph.graph.format_citations", return_value="[1] Source"),
            um.patch("src.graph.graph._get_llm"),
        ]
        return patches

    def test_run_graph_returns_graphstate(self):
        patches = self._patch_all()
        mocks = [p.start() for p in patches]
        mocks[0].return_value.classify_combined.return_value = _mock_combined()
        llm_mock = mocks[-1]
        llm_mock.return_value.invoke.return_value = MagicMock(content="Test response.")

        try:
            mem = ConversationMemory()
            result = run_graph("This is too expensive.", mem)
            assert isinstance(result, dict)
            assert "response"  in result
            assert "objection" in result
            assert "strategy"  in result
        finally:
            for p in patches:
                p.stop()

    def test_run_graph_adds_to_memory(self):
        patches = self._patch_all()
        mocks = [p.start() for p in patches]
        mocks[0].return_value.classify_combined.return_value = _mock_combined()
        mocks[-1].return_value.invoke.return_value = MagicMock(content="Response text.")

        try:
            mem = ConversationMemory()
            run_graph("We use HubSpot.", mem)
            messages = mem.get_messages()
            assert len(messages) == 2           # user + assistant
            assert messages[0].role == "user"
            assert messages[1].role == "assistant"
        finally:
            for p in patches:
                p.stop()

    def test_empty_input_raises(self):
        mem = ConversationMemory()
        with pytest.raises(ValueError, match="non-empty"):
            run_graph("", mem)

    def test_whitespace_input_raises(self):
        mem = ConversationMemory()
        with pytest.raises(ValueError, match="non-empty"):
            run_graph("   ", mem)
