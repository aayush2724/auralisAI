"""
auralis/src/strategies/price_strategy.py
──────────────────────────────────────────
Strategy: Value Reframe / ROI Business Case
Objection: price — "too expensive", "over budget", "can't justify the cost"

Approach
--------
1. Acknowledge the budget concern empathetically.
2. Reframe cost as an investment using TCO reduction and ROI framing.
3. Surface relevant proof points from the knowledge base.
4. Offer payment flexibility options (monthly, annual, pilot).
5. Close with a value-anchored question tied to the prospect's specific pain.

Features implemented
--------------------
  Feature  2 — Tone Adaptation  (tone_instruction)
  Feature 11 — Source Citations  (citations)
  Feature 13 — Role-Based Pitch  (pitch_angle)
"""

from __future__ import annotations

from src.graph.graph import GraphState

_PROMPT_TEMPLATE = """\
## AURALIS — Price Objection Strategy: Value Reframe

### Conversation Facts
{memory_context}

### Prospect Message
{user_input}

### Analysis
- Objection         : price (confidence {confidence:.0%})
- Prospect Persona  : {persona_label}
- Sentiment         : {sentiment_label}
- Trigger phrases   : {triggers}

### Role-Based Framing (Feature 13)
{pitch_angle}

### Tone Instruction (Feature 2)
{tone_instruction}

### Retrieved Proof Points
{knowledge}

### Strategy Instructions
When citing numbers, dates, durations, or figures from the retrieved context ({citations}), quote them exactly as stated. If the source distinguishes between a default/standard value and a conditional/upgraded value (e.g. "90 days by default, up to 12 months for Enterprise Plus customers"), preserve that distinction explicitly in your response rather than collapsing it into a single number. Do not average, round, or simplify multiple related figures from the source into one blanket statement.

If the retrieved context discloses a caveat, limitation, or methodology note attached to a statistic (e.g. "self-reported," "not independently audited," "based on customer estimates") and the prospect's question is about that statistic's accuracy, source, or verification status, you must state the caveat plainly. Do not substitute a different, unrelated compliance or certification claim (e.g. SOC 2) as if it answers a question about a specific metric's methodology.

If the retrieved context contains a structured, multi-part breakdown (a numbered timeline, staged process, or itemized list), preserve every stage explicitly in your response. Do not collapse a multi-stage breakdown into a single aggregate number or generic paraphrase.

You are handling a PRICE objection. Follow this exact structure:

1. **Acknowledge** — Validate the budget concern in one sentence.
   Example: "I completely understand — budget scrutiny is at an all-time high."

2. **Reframe Cost → Investment**
   - Quote the TCO reduction and/or ROI figure from the proof points above.
   - Relate it specifically to the prospect's role: {pitch_angle}

3. **Payment Flexibility** (only state specifics found in {citations}):
   - Only mention a specific SLA percentage, policy detail, feature name, or figure if it is explicitly present in the retrieved context above.
   - If the retrieved context does not contain a relevant fact for this part of the response, omit this section entirely rather than inventing a plausible-sounding detail.

4. **Value Anchor Question**
   - End with one open question that ties cost to their stated goal.
   - Example: "If we could show a 3× return within 6 months, would that
     change how you're thinking about the investment?"

### Retrieved Context (internal — for grounding only, do not repeat or list this in your response)
{citations}

Write the complete sales response now, following the structure above.
Keep it under 200 words. Professional tone with the {sentiment_label} adaptation applied.
"""


def build_prompt(state: GraphState) -> str:
    """
    Build the price-objection prompt from the current graph state.

    Parameters
    ----------
    state : Current GraphState (post classify + retrieve nodes).

    Returns
    -------
    Fully rendered prompt string ready for the LLM.
    """
    objection = state.get("objection") or {}
    sentiment = state.get("sentiment") or {}
    persona = state.get("persona") or {}
    metadata = state.get("metadata") or {}
    docs = state.get("retrieved_docs") or []

    knowledge_block = (
        "\n\n".join(f"[{i+1}] {d['text']}" for i, d in enumerate(docs))
        or "No proof points retrieved — focus on general ROI and TCO messaging."
    )

    return _PROMPT_TEMPLATE.format(
        memory_context=state.get("memory_context") or "No prior context.",
        user_input=state.get("user_input", ""),
        confidence=objection.get("confidence", 0.0),
        persona_label=persona.get("label", "Unknown"),
        sentiment_label=sentiment.get("label", "neutral"),
        triggers=", ".join(objection.get("triggers", [])) or "none",
        pitch_angle=metadata.get("pitch_angle") or persona.get("pitch_angle", ""),
        tone_instruction=metadata.get("tone_instruction")
        or sentiment.get("tone_instruction", ""),
        knowledge=knowledge_block,
        citations=state.get("citations") or "No citations available.",
    )
