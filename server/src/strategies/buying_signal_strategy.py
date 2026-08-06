"""
auralis/src/strategies/buying_signal_strategy.py
──────────────────────────────────────────────────
Strategy: Closing Accelerator
Objection class: buying_signal — "send me pricing", "set up a demo", "ready to move"

Approach
--------
Prospect has signalled intent — the job now is to remove friction and
accelerate to the next commitment without overselling or being pushy.

1. Match energy and affirm their decision.
2. Immediately offer the next concrete step (demo booking, trial link,
   pricing page, or contract draft). Do not ask any other questions.
3. Surface 1–2 proof points to validate the decision and reduce post-purchase
   regret risk.
4. Address potential last-minute blockers proactively (IT approval, legal review).
5. Close with a specific, time-bound ask.

### Retrieved Context (internal — for grounding only, do not repeat or list this in your response)
{citations}

Features implemented
--------------------
  Feature  2 — Tone Adaptation  (tone_instruction)
  Feature 11 — Source Citations  (citations)
  Feature 13 — Role-Based Pitch  (pitch_angle)
"""

from __future__ import annotations

from src.graph.graph import GraphState

_PROMPT_TEMPLATE = """\
## AURALIS — Buying Signal Strategy: Closing Accelerator

### Conversation Facts
{memory_context}

### Prospect Message
{user_input}

### Analysis
- Signal            : buying_signal (confidence {confidence:.0%})
- Prospect Persona  : {persona_label}
- Sentiment         : {sentiment_label}
- Trigger phrases   : {triggers}

### Role-Based Framing (Feature 13)
{pitch_angle}

### Tone Instruction (Feature 2)
{tone_instruction}

### Retrieved Validation Proof Points
{knowledge}

### Strategy Instructions
When citing numbers, dates, durations, or figures from the retrieved context ({citations}), quote them exactly as stated. If the source distinguishes between a default/standard value and a conditional/upgraded value (e.g. "90 days by default, up to 12 months for Enterprise Plus customers"), preserve that distinction explicitly in your response rather than collapsing it into a single number. Do not average, round, or simplify multiple related figures from the source into one blanket statement.

The prospect has sent a BUYING SIGNAL. Do NOT re-sell. Remove friction.
Follow this exact structure:

1. **Affirm the Decision** — One warm, confident sentence.
   Example: "Great — you're going to love what the team builds with this."
   Match energy: {tone_instruction}

2. **Immediate Next Step** — Offer ONE of the following (choose the most
   relevant based on their signal):
   a. Demo booking: "Here's my calendar link — pick any slot this week."
   b. Trial activation: "I'll spin up your trial account within the hour."
   c. Pricing/contract: "I'll send the MSA and pricing sheet within 30 minutes."
   d. Stakeholder call: "Want me to loop in our solutions engineer for the
      technical walkthrough?"

3. **Decision Validation** — One proof point from the knowledge base to
   reinforce they're making the right choice.
   Frame through: {pitch_angle}

4. **Proactive Blocker Removal** (only state specifics found in {citations}):
   - Only mention a specific SLA percentage, policy detail, feature name, or figure if it is explicitly present in the retrieved context above.
   - If the retrieved context does not contain a relevant fact for this part of the response, omit this section entirely rather than inventing a plausible-sounding detail.

5. **Time-Bound Close** (only state specifics found in {citations}):
   - Only mention a specific SLA percentage, policy detail, feature name, or figure if it is explicitly present in the retrieved context above.
   - If the retrieved context does not contain a relevant fact for this part of the response, omit this section entirely rather than inventing a plausible-sounding detail.

### Source Citations (Feature 11)
{citations}

Write the complete sales response now.
Keep it under 180 words. Upbeat, confident, zero friction. Apply {sentiment_label} tone.
"""


def build_prompt(state: GraphState) -> str:
    objection = state.get("objection") or {}
    sentiment = state.get("sentiment") or {}
    persona = state.get("persona") or {}
    metadata = state.get("metadata") or {}
    docs = state.get("retrieved_docs") or []

    knowledge_block = (
        "\n\n".join(f"[{i+1}] {d['text'][:400]}" for i, d in enumerate(docs))
        or "No proof points retrieved — lead with enthusiasm and next-step clarity."
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
