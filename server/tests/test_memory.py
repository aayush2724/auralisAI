"""
tests/test_memory.py
─────────────────────
Pytest suite for src/memory/memory.py

Covers:
  - add() / get_messages() round-trip
  - Fact extraction: company_name, tools_mentioned, budget_signal
  - Objection recording from metadata
  - get_context_string() format and content
  - get_facts() returns a deep copy (mutation safety)
  - clear() resets everything
  - Edge cases: empty content, assistant turns not fact-extracted

Run with:
    pytest tests/test_memory.py -v
"""

from __future__ import annotations

import pytest

from src.memory.memory import ConversationMemory


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def mem() -> ConversationMemory:
    """Fresh ConversationMemory for each test."""
    return ConversationMemory()


# ─── add() / get_messages() ───────────────────────────────────────────────────

class TestAddAndMessages:
    def test_add_user_message(self, mem):
        mem.add("user", "Hello, we use Salesforce.")
        messages = mem.get_messages()
        assert len(messages) == 1
        assert messages[0].role == "user"
        assert messages[0].content == "Hello, we use Salesforce."

    def test_add_multiple_turns(self, mem):
        mem.add("user", "We use Salesforce.")
        mem.add("assistant", "Great, let me show you the integration.")
        mem.add("user", "How much does it cost?")
        assert len(mem) == 3

    def test_turn_numbers_are_sequential(self, mem):
        mem.add("user", "First message")
        mem.add("assistant", "Response")
        mem.add("user", "Second message")
        turns = [m.turn for m in mem.get_messages()]
        assert turns == [1, 2, 3]

    def test_empty_content_skipped(self, mem):
        mem.add("user", "")
        mem.add("user", "   ")
        assert len(mem) == 0

    def test_metadata_stored(self, mem):
        meta = {"custom_key": "custom_value"}
        mem.add("user", "Hello", metadata=meta)
        assert mem.get_messages()[0].metadata["custom_key"] == "custom_value"

    def test_get_messages_is_copy(self, mem):
        """Mutating the returned list should not affect internal state."""
        mem.add("user", "Hello")
        messages = mem.get_messages()
        messages.clear()
        assert len(mem) == 1


# ─── Tool extraction ──────────────────────────────────────────────────────────

class TestToolExtraction:
    def test_single_tool(self, mem):
        mem.add("user", "We currently use HubSpot for our CRM.")
        assert "HubSpot" in mem.get_facts()["tools_mentioned"]

    def test_multiple_tools_same_turn(self, mem):
        mem.add("user", "We use Salesforce and Zendesk together.")
        tools = mem.get_facts()["tools_mentioned"]
        assert "Salesforce" in tools
        assert "Zendesk" in tools

    def test_tools_accumulate_across_turns(self, mem):
        mem.add("user", "We use Salesforce.")
        mem.add("user", "We also use HubSpot.")
        tools = mem.get_facts()["tools_mentioned"]
        assert "Salesforce" in tools
        assert "HubSpot" in tools

    def test_no_duplicate_tools(self, mem):
        mem.add("user", "We use HubSpot.")
        mem.add("user", "HubSpot is our main CRM.")
        tools = mem.get_facts()["tools_mentioned"]
        assert tools.count("HubSpot") == 1

    def test_assistant_turn_not_extracted(self, mem):
        """Tool names in assistant replies should NOT be added to facts."""
        mem.add("assistant", "You should try Salesforce for your needs.")
        assert mem.get_facts()["tools_mentioned"] == []

    def test_case_insensitive_matching(self, mem):
        """'salesforce' (lowercase) should still match the canonical 'Salesforce'."""
        mem.add("user", "We use salesforce as our CRM.")
        # Canonical casing should be stored
        tools = mem.get_facts()["tools_mentioned"]
        assert "Salesforce" in tools


# ─── Company extraction ───────────────────────────────────────────────────────

class TestCompanyExtraction:
    def test_at_company_name(self, mem):
        mem.add("user", "Hi, I'm calling from Acme Corp.")
        assert mem.get_facts()["company_name"] is not None

    def test_company_not_overwritten(self, mem):
        """First detected company name should be kept."""
        mem.add("user", "We are at Acme Inc.")
        mem.add("user", "By the way, our subsidiary is Beta Ltd.")
        # Should still be the first detected company
        assert mem.get_facts()["company_name"] is not None

    def test_no_company_in_plain_text(self, mem):
        mem.add("user", "The price is too high for us.")
        assert mem.get_facts()["company_name"] is None


# ─── Budget extraction ────────────────────────────────────────────────────────

class TestBudgetExtraction:
    def test_dollar_amount(self, mem):
        mem.add("user", "Our budget is around $50k for this quarter.")
        assert mem.get_facts()["budget_signal"] is not None
        assert "$50k" in mem.get_facts()["budget_signal"]

    def test_dollar_with_comma(self, mem):
        mem.add("user", "We can spend up to $12,000.")
        assert mem.get_facts()["budget_signal"] is not None

    def test_budget_not_overwritten(self, mem):
        """First budget signal wins."""
        mem.add("user", "Our budget is $10k.")
        mem.add("user", "Actually we have $20k available.")
        assert "$10k" in mem.get_facts()["budget_signal"]

    def test_no_budget_in_plain_text(self, mem):
        mem.add("user", "We use Salesforce and HubSpot.")
        assert mem.get_facts()["budget_signal"] is None


# ─── Objection metadata ────────────────────────────────────────────────────────

class TestObjectionMetadata:
    def _price_objection(self) -> dict:
        return {"label": "price", "confidence": 0.91, "all_scores": {}, "triggers": []}

    def _neutral_objection(self) -> dict:
        return {"label": "neutral", "confidence": 0.60, "all_scores": {}, "triggers": []}

    def test_objection_recorded(self, mem):
        mem.add("user", "Too expensive.", metadata={"objection": self._price_objection()})
        objs = mem.get_facts()["objections_raised"]
        assert len(objs) == 1
        assert objs[0]["label"] == "price"
        assert objs[0]["confidence"] == pytest.approx(0.91)
        assert objs[0]["turn"] == 1

    def test_neutral_objection_not_recorded(self, mem):
        """Neutral classifications should NOT be added to objections_raised."""
        mem.add("user", "Okay.", metadata={"objection": self._neutral_objection()})
        assert mem.get_facts()["objections_raised"] == []

    def test_multiple_objections(self, mem):
        mem.add("user", "Too expensive.", metadata={"objection": self._price_objection()})
        mem.add("user", "Never heard of you.", metadata={"objection": {"label": "trust", "confidence": 0.78, "all_scores": {}, "triggers": []}})
        objs = mem.get_facts()["objections_raised"]
        assert len(objs) == 2
        assert objs[0]["label"] == "price"
        assert objs[1]["label"] == "trust"

    def test_no_objection_key_in_metadata(self, mem):
        """If 'objection' key is absent, no crash and no objection recorded."""
        mem.add("user", "Hello.", metadata={"other_key": "value"})
        assert mem.get_facts()["objections_raised"] == []


# ─── get_context_string() ────────────────────────────────────────────────────

class TestContextString:
    def test_empty_when_no_facts(self, mem):
        mem.add("user", "Hello there.")
        assert mem.get_context_string() == ""

    def test_contains_tool(self, mem):
        mem.add("user", "We use Salesforce.")
        ctx = mem.get_context_string()
        assert "Salesforce" in ctx
        assert "Customer context:" in ctx

    def test_contains_budget(self, mem):
        mem.add("user", "Our budget is $50k.")
        ctx = mem.get_context_string()
        assert "$50k" in ctx

    def test_contains_objection(self, mem):
        mem.add(
            "user",
            "Too expensive.",
            metadata={"objection": {"label": "price", "confidence": 0.91, "all_scores": {}, "triggers": []}},
        )
        ctx = mem.get_context_string()
        assert "price objection" in ctx
        assert "turn 1" in ctx

    def test_full_context_string(self, mem):
        """All facts should appear in a combined context string."""
        mem.add(
            "user",
            "Hi, we use Salesforce at Acme Corp. Our budget is $50k.",
            metadata={"objection": {"label": "price", "confidence": 0.88, "all_scores": {}, "triggers": []}},
        )
        ctx = mem.get_context_string()
        assert "Salesforce" in ctx
        assert "$50k" in ctx
        assert "price objection" in ctx

    def test_ends_with_period(self, mem):
        mem.add("user", "We use HubSpot.")
        ctx = mem.get_context_string()
        assert ctx.endswith(".")


# ─── get_facts() mutation safety ──────────────────────────────────────────────

class TestGetFactsMutationSafety:
    def test_tools_list_is_copy(self, mem):
        mem.add("user", "We use Salesforce.")
        facts = mem.get_facts()
        facts["tools_mentioned"].append("FAKE_TOOL")
        assert "FAKE_TOOL" not in mem.get_facts()["tools_mentioned"]

    def test_objections_list_is_copy(self, mem):
        mem.add("user", "Too expensive.", metadata={"objection": {"label": "price", "confidence": 0.9, "all_scores": {}, "triggers": []}})
        facts = mem.get_facts()
        facts["objections_raised"].clear()
        assert len(mem.get_facts()["objections_raised"]) == 1


# ─── clear() ─────────────────────────────────────────────────────────────────

class TestClear:
    def test_clear_removes_messages(self, mem):
        mem.add("user", "We use Salesforce.")
        mem.add("assistant", "Great!")
        mem.clear()
        assert len(mem) == 0

    def test_clear_resets_facts(self, mem):
        mem.add("user", "We use Salesforce. Budget is $50k.")
        mem.clear()
        facts = mem.get_facts()
        assert facts["company_name"] is None
        assert facts["tools_mentioned"] == []
        assert facts["budget_signal"] is None
        assert facts["objections_raised"] == []

    def test_clear_then_add(self, mem):
        mem.add("user", "We use Salesforce.")
        mem.clear()
        mem.add("user", "Now we use HubSpot.")
        assert mem.get_facts()["tools_mentioned"] == ["HubSpot"]
        assert "Salesforce" not in mem.get_facts()["tools_mentioned"]


# ─── repr / len ───────────────────────────────────────────────────────────────

class TestDunders:
    def test_len(self, mem):
        assert len(mem) == 0
        mem.add("user", "Hello")
        assert len(mem) == 1

    def test_repr(self, mem):
        r = repr(mem)
        assert "ConversationMemory" in r
        assert "turns=0" in r
