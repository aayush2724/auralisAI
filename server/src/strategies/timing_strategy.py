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
You are handling a TIMING objection. Follow this exact structure:

1. **Respect Their Timeline** — Acknowledge it's not a "no" in one sentence.
   Example: "Timing matters — I wouldn't want you to rush a decision."

2. **Cost of Delay** — Quantify what they lose per month/quarter by waiting.
   - Pull from proof points above (e.g., "companies that started Q1 saw X by Q3").
   - Frame through {pitch_angle}

3. **Low-Friction Next Step** — Propose the smallest possible commitment:
   - "Would a 20-minute async walkthrough work while your team finalises plans?"
   - Or: "We can reserve a pilot slot for Q[next] now, no cost to start."

4. **Soft Urgency Trigger** — Choose ONE of:
   - Limited pilot slots: "We have 3 onboarding slots left this quarter."
   - Pricing lock: "Our current pricing is locked until [month-end]."
   - Implementation lead time: "Onboarding takes 3 weeks — starting now means
     you're live by [date]."

5. **Re-engagement Hook** — If they truly cannot move:
   - Agree a specific follow-up date/trigger.
   - "Shall I reach out when your Q[N] budget planning begins?"

### Source Citations (Feature 11)
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
        "\n\n".join(f"[{i+1}] {d['text'][:400]}" for i, d in enumerate(docs))
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
