"""
auralis/src/strategies/competitor_strategy.py
───────────────────────────────────────────────
Strategy: Competitive Differentiation
Objection: competitor — "we already use X", "we're evaluating Y", "X is cheaper"

Approach
--------
1. Respect the existing relationship — never disparage the competitor.
2. Pull competitor-specific intel from the vectorstore using the competitor
   name from state.metadata['competitor_mentioned'].
3. Run a feature-level comparison: Auralis vs competitor, point by point.
4. Highlight switching ease (data export, migration support, onboarding time).
5. Propose a side-by-side evaluation / bake-off as the next step.

Features implemented
--------------------
  Feature  2 — Tone Adaptation  (tone_instruction)
  Feature 11 — Source Citations  (citations)
  Feature 13 — Role-Based Pitch  (pitch_angle)
"""

from __future__ import annotations

from src.graph.graph import GraphState

_PROMPT_TEMPLATE = """\
## AURALIS — Competitor Objection Strategy: Differentiation

### Conversation Facts
{memory_context}

### Prospect Message
{user_input}

### Analysis
- Objection          : competitor (confidence {confidence:.0%})
- Competitor detected: {competitor_name}
- Prospect Persona   : {persona_label}
- Sentiment          : {sentiment_label}
- Trigger phrases    : {triggers}

### Role-Based Framing (Feature 13)
{pitch_angle}

### Tone Instruction (Feature 2)
{tone_instruction}

### Retrieved Competitive Intel
{knowledge}

### Strategy Instructions
When citing numbers, dates, durations, or figures from the retrieved context ({citations}), quote them exactly as stated. If the source distinguishes between a default/standard value and a conditional/upgraded value (e.g. "90 days by default, up to 12 months for Enterprise Plus customers"), preserve that distinction explicitly in your response rather than collapsing it into a single number. Do not average, round, or simplify multiple related figures from the source into one blanket statement.

You are handling a COMPETITOR objection (vs. {competitor_name}).
Follow this exact structure — NEVER badmouth the competitor:

1. **Respect the Relationship** — One sentence acknowledging their investment.
   Example: "A lot of great teams run on {competitor_name} — it makes sense
   you've built workflows around it."

2. **Targeted Feature Comparison** — 3 bullet points, maximum:
   For each, use the format:
     • [Feature Area]: {competitor_name} does X. Auralis does Y → Benefit.
   Draw facts from the retrieved intel above.
   Frame through {pitch_angle}

3. **Switching Ease** (only state specifics found in {citations}):
   - Only mention a specific SLA percentage, policy detail, feature name, or figure if it is explicitly present in the retrieved context above.
   - If the retrieved context does not contain a relevant fact for this part of the response, omit this section entirely rather than inventing a plausible-sounding detail.

4. **Evaluation Proposal**
   - Propose a parallel pilot or bake-off: "Run Auralis alongside {competitor_name}
     for 30 days — no disruption to your current workflow."

5. **Soft Close**
   - "What would a fair evaluation look like for your team?"

### Retrieved Context (internal — for grounding only, do not repeat or list this in your response)
{citations}

Write the complete sales response now, following the structure above.
Keep it under 230 words. Apply {sentiment_label} tone.
"""


def _format_comparison_bullets(intel_docs: list[dict], competitor_name: str) -> str:
    """
    Format the top competitor intel docs as structured comparison bullets.
    Returns at most 3 bullets drawn from the knowledge base.
    """
    if not intel_docs:
        return f"No specific intel on {competitor_name} — use general differentiation messaging."

    lines: list[str] = []
    for i, doc in enumerate(intel_docs[:3]):
        text = doc.get("text", "").strip()[:300]
        lines.append(f"• [{doc.get('source_file', 'intel')}] {text}")
    return "\n".join(lines)


def build_prompt(state: GraphState) -> str:
    from src.classifier.competitor import detect_competitor
    from src.rag.retriever import retrieve

    objection = state.get("objection") or {}
    sentiment = state.get("sentiment") or {}
    persona = state.get("persona") or {}
    metadata = state.get("metadata") or {}
    user_input = state.get("user_input", "")

    # ── Step 1: resolve competitor name ───────────────────────────────────────
    # Priority: fresh detection from live text > metadata set by strategy_node
    # > first trigger phrase > generic fallback
    competitor_name = (
        detect_competitor(user_input)
        or metadata.get("competitor_mentioned")
        or metadata.get("competitor_name")
        or (objection.get("triggers") or [""])[0]
        or "the incumbent tool"
    )

    # ── Step 2: targeted competitor intel retrieval ────────────────────────────
    # Re-query FAISS with a competitor-specific query even if retrieve_node
    # already ran, to surface weaknesses/advantages from data/competitors/.
    intel_docs: list[dict] = []
    if competitor_name and competitor_name != "the incumbent tool":
        intel_query = f"competitor {competitor_name} weaknesses advantages pricing"
        try:
            intel_docs = retrieve(intel_query, top_k=3)
        except FileNotFoundError:
            intel_docs = []

    # Fall back to whatever retrieve_node already pulled
    if not intel_docs:
        intel_docs = state.get("retrieved_docs") or []

    knowledge_block = _format_comparison_bullets(intel_docs, competitor_name)

    # ── Step 3: render prompt ─────────────────────────────────────────────────
    return _PROMPT_TEMPLATE.format(
        memory_context=state.get("memory_context") or "No prior context.",
        user_input=user_input,
        confidence=objection.get("confidence", 0.0),
        competitor_name=competitor_name,
        persona_label=persona.get("label", "Unknown"),
        sentiment_label=sentiment.get("label", "neutral"),
        triggers=", ".join(objection.get("triggers", [])) or "none",
        pitch_angle=metadata.get("pitch_angle") or persona.get("pitch_angle", ""),
        tone_instruction=metadata.get("tone_instruction")
        or sentiment.get("tone_instruction", ""),
        knowledge=knowledge_block,
        citations=state.get("citations") or "No citations available.",
    )
