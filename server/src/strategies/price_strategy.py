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
You are handling a PRICE objection. Follow this exact structure:

1. **Acknowledge** — Validate the budget concern in one sentence.
   Example: "I completely understand — budget scrutiny is at an all-time high."

2. **Reframe Cost → Investment**
   - Quote the TCO reduction and/or ROI figure from the proof points above.
   - Relate it specifically to the prospect's role: {pitch_angle}

3. **Payment Flexibility**
   - Mention monthly billing, annual discount, or a time-boxed pilot/POC.
   - Example: "We offer a 30-day pilot at no risk so you can validate ROI
     before committing."

4. **Value Anchor Question**
   - End with one open question that ties cost to their stated goal.
   - Example: "If we could show a 3× return within 6 months, would that
     change how you're thinking about the investment?"

### Source Citations (Feature 11)
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
        "\n\n".join(f"[{i+1}] {d['text'][:400]}" for i, d in enumerate(docs))
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
