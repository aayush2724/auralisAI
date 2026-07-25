"""
auralis/src/strategies/trust_strategy.py
──────────────────────────────────────────
Strategy: Social Proof & Credibility Building
Objection: trust — "never heard of you", "need references", "security concerns"

Approach
--------
1. Acknowledge the credibility concern directly — never be defensive.
2. Lead with the strongest social proof from the knowledge base
   (named case studies, logos, analyst recognition).
3. Offer tangible proof actions: reference call, security docs, trial.
4. Frame guarantees and risk-reversal language.
5. Close with an invitation to verify independently.

Features implemented
--------------------
  Feature  2 — Tone Adaptation  (tone_instruction)
  Feature 11 — Source Citations  (citations)
  Feature 13 — Role-Based Pitch  (pitch_angle)
"""

from __future__ import annotations

from src.graph.graph import GraphState

_PROMPT_TEMPLATE = """\
## AURALIS — Trust Objection Strategy: Social Proof & Credibility

### Conversation Facts
{memory_context}

### Prospect Message
{user_input}

### Analysis
- Objection         : trust (confidence {confidence:.0%})
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
You are handling a TRUST objection. Follow this exact structure:

1. **Acknowledge** — Validate their caution in one sentence, never be defensive.
   Example: "That's a completely fair concern — you should only work with
   vendors you can verify."

2. **Social Proof (strongest asset first)**
   - Name a specific customer or case study from the proof points above.
   - Include a concrete metric (e.g., "reduced churn by 40%").
   - Tailor the example to the prospect's industry/role: {pitch_angle}

3. **Risk Reversal**
   - Offer a reference call, free security documentation, SOC 2 report,
     or a no-commitment pilot.
   - "We can arrange a 15-minute call with [similar customer] this week."

4. **Guarantee Language**
   - Mention SLA, money-back option, or data-portability if applicable.

5. **Verification Invitation**
   - Invite them to check G2/Capterra reviews or analyst reports.

### Source Citations (Feature 11)
{citations}

Write the complete sales response now, following the structure above.
Keep it under 220 words. Apply {sentiment_label} tone.
"""


def build_prompt(state: GraphState) -> str:
    objection = state.get("objection") or {}
    sentiment = state.get("sentiment") or {}
    persona = state.get("persona") or {}
    metadata = state.get("metadata") or {}
    docs = state.get("retrieved_docs") or []

    knowledge_block = (
        "\n\n".join(f"[{i+1}] {d['text'][:400]}" for i, d in enumerate(docs))
        or "No case studies retrieved — use generic credibility language."
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
