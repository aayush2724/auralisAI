"""
auralis/src/strategies/timing_strategy.py
───────────────────────────────────────────
Strategy: Urgency Creation / Strategic Timing
Objection: timing — "not the right time", "come back next quarter", "too busy"

Approach
--------
1. Respect the stated timeline — never pressure aggressively.
2. Surface the cost-of-delay: what they are losing each month/quarter.
3. Offer a low-friction next step that fits inside their current window
   (e.g., 15-min scoping call, async demo, 30-day pilot).
4. Create soft urgency via limited availability or seasonal pricing.
5. Plant a re-engagement hook if they truly cannot move now.

Features implemented
--------------------
  Feature  2 — Tone Adaptation  (tone_instruction)
  Feature 11 — Source Citations  (citations)
  Feature 13 — Role-Based Pitch  (pitch_angle)
"""

from __future__ import annotations

from src.graph.graph import GraphState

_PROMPT_TEMPLATE = """\
## AURALIS — Timing Objection Strategy: Urgency Creation

### Conversation Facts
{memory_context}

### Prospect Message
{user_input}

### Analysis
- Objection         : timing (confidence {confidence:.0%})
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

You are handling a TIMING objection. Follow this exact structure:

1. **Respect Their Timeline** — Acknowledge it's not a "no" in one sentence.
   Example: "Timing matters — I wouldn't want you to rush a decision."

2. **Cost of Delay** — Quantify what they lose per month/quarter by waiting.
   - Pull from proof points above (e.g., "companies that started Q1 saw X by Q3").
   - Frame through {pitch_angle}

3. **Low-Friction Next Step** — Propose the smallest possible commitment:
   - "Would a 20-minute async walkthrough work while your team finalises plans?"
   - Or: "We can reserve a pilot slot for Q[next] now, no cost to start."

4. **Soft Urgency Trigger** (only state specifics found in {citations}):
   - Only mention a specific SLA percentage, policy detail, feature name, or figure if it is explicitly present in the retrieved context above.
   - If the retrieved context does not contain a relevant fact for this part of the response, omit this section entirely rather than inventing a plausible-sounding detail.

5. **Re-engagement Hook** — If they truly cannot move:
   - Agree a specific follow-up date/trigger.
   - "Shall I reach out when your Q[N] budget planning begins?"

### Retrieved Context (internal — for grounding only, do not repeat or list this in your response)
{citations}

Write the complete sales response now, following the structure above.
Keep it under 200 words. Apply {sentiment_label} tone.
"""


def build_prompt(state: GraphState) -> str:
    objection = state.get("objection") or {}
    sentiment = state.get("sentiment") or {}
    persona = state.get("persona") or {}
    metadata = state.get("metadata") or {}
    docs = state.get("retrieved_docs") or []

    knowledge_block = (
        "\n\n".join(f"[{i+1}] {d['text']}" for i, d in enumerate(docs))
        or "No timing proof points retrieved — use general cost-of-delay framing."
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
