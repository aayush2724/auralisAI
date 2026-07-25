"""
tests/test_persona_templates.py
─────────────────────────────────
Pytest suite for the PERSONA_TEMPLATES and _get_system_prompt() added to
src/graph/graph.py for Feature 13 (Role-Based Response Generation).

These tests are intentionally lightweight — they verify the dispatch logic
and content markers without invoking the LLM.

Run with:
    pytest tests/test_persona_templates.py -v
"""

from __future__ import annotations

import pytest

from src.graph.graph import PERSONA_TEMPLATES, _get_system_prompt

# ─── All personas that must have a template ───────────────────────────────────

EXPECTED_PERSONAS = {"CEO", "CTO", "Developer", "Product_Manager", "Founder", "Unknown"}

# ─── Content markers expected in each template ────────────────────────────────

_CONTENT_MARKERS: dict[str, list[str]] = {
    "CEO":             ["revenue", "cost", "board", "dollar", "risk"],
    "CTO":             ["architecture", "scalab", "security", "sla", "api"],
    "Developer":       ["rest api", "sdk", "webhook", "self-serve", "documentation"],
    "Product_Manager": ["feature velocity", "user", "roadmap", "outcome"],
    "Founder":         ["speed-to-market", "competitive", "unit economics", "gtm"],
    "Unknown":         ["professional", "discovery", "balanced"],
}


# ─── Registry completeness ────────────────────────────────────────────────────

class TestTemplateRegistry:
    def test_all_personas_registered(self):
        assert EXPECTED_PERSONAS.issubset(PERSONA_TEMPLATES.keys()), (
            f"Missing personas: {EXPECTED_PERSONAS - PERSONA_TEMPLATES.keys()}"
        )

    def test_all_templates_non_empty(self):
        for persona, template in PERSONA_TEMPLATES.items():
            assert isinstance(template, str) and len(template) > 50, (
                f"Template for '{persona}' is too short or not a string"
            )

    def test_all_templates_contain_auralis(self):
        """Every template should identify the assistant as Auralis."""
        for persona, template in PERSONA_TEMPLATES.items():
            assert "auralis" in template.lower(), (
                f"Template for '{persona}' does not mention 'Auralis'"
            )


# ─── Content marker tests ─────────────────────────────────────────────────────

class TestTemplateContent:
    @pytest.mark.parametrize("persona,markers", _CONTENT_MARKERS.items())
    def test_template_contains_relevant_markers(self, persona, markers):
        template = PERSONA_TEMPLATES.get(persona, "")
        for marker in markers:
            assert marker.lower() in template.lower(), (
                f"Template for '{persona}' missing marker: '{marker}'"
            )

    def test_ceo_template_mentions_numbers(self):
        """CEO template must emphasise metrics and numbers."""
        template = PERSONA_TEMPLATES["CEO"]
        assert any(w in template.lower() for w in ["dollar", "percentage", "figures", "numbers"])

    def test_cto_template_mentions_compliance(self):
        """CTO template must mention at least one compliance standard."""
        template = PERSONA_TEMPLATES["CTO"]
        assert any(w in template for w in ["SOC 2", "GDPR", "HIPAA", "compliance"])

    def test_developer_template_mentions_no_sales_call(self):
        """Developer template should note that self-serve is key."""
        template = PERSONA_TEMPLATES["Developer"]
        assert "self-serve" in template.lower() or "sales call" in template.lower()

    def test_founder_template_mentions_competitive_moat(self):
        template = PERSONA_TEMPLATES["Founder"]
        assert "competitive" in template.lower() and "moat" in template.lower()


# ─── _get_system_prompt() ─────────────────────────────────────────────────────

class TestGetSystemPrompt:
    @pytest.mark.parametrize("persona", list(EXPECTED_PERSONAS))
    def test_returns_non_empty_string(self, persona):
        prompt = _get_system_prompt(persona)
        assert isinstance(prompt, str) and len(prompt) > 100

    def test_shared_guidelines_appended(self):
        """Every persona prompt must include the shared guidelines section."""
        for persona in EXPECTED_PERSONAS:
            prompt = _get_system_prompt(persona)
            assert "Shared guidelines" in prompt, (
                f"Shared guidelines missing for persona '{persona}'"
            )

    def test_unknown_fallback(self):
        """Unrecognised persona falls back to 'Unknown' template."""
        prompt = _get_system_prompt("SomeRandomRole")
        assert "Auralis" in prompt
        assert "Shared guidelines" in prompt

    def test_persona_template_is_prefix(self):
        """
        _get_system_prompt should return the persona template + shared guidelines,
        so the template text should appear at the start.
        """
        for persona in EXPECTED_PERSONAS:
            template  = PERSONA_TEMPLATES[persona]
            full_prompt = _get_system_prompt(persona)
            assert full_prompt.startswith(template), (
                f"Persona template for '{persona}' is not a prefix of _get_system_prompt output"
            )

    @pytest.mark.parametrize("persona_a,persona_b", [
        ("CEO",   "CTO"),
        ("CTO",   "Developer"),
        ("Founder", "Product_Manager"),
    ])
    def test_different_personas_produce_different_prompts(self, persona_a, persona_b):
        """Each persona must produce a meaningfully different system prompt."""
        prompt_a = _get_system_prompt(persona_a)
        prompt_b = _get_system_prompt(persona_b)
        assert prompt_a != prompt_b, (
            f"Prompts for '{persona_a}' and '{persona_b}' are identical"
        )
