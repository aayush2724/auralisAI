"""
auralis/src/strategies/fit_strategy.py
────────────────────────────────────────
Strategy: Needs Discovery & Use-Case Mapping
Objection: fit — "it doesn't match our workflow", "too complex/simple", "missing feature X"

Approach
--------
1. Validate the concern — never oversell into a bad fit.
2. Ask 2–3 precise discovery questions to uncover the real gap.
3. Map existing product features directly to the stated need using
   retrieved knowledge.
4. If a genuine gap exists, be honest and offer workarounds or roadmap info.
5. Close with a tailored demo proposal scoped to their exact use case.

Features implemented
--------------------
  Feature  2 — Tone Adaptation  (tone_instruction)
  Feature 11 — Source Citations  (citations)
  Feature 13 — Role-Based Pitch  (pitch_angle)
"""

from __future__ import annotations

from src.graph.graph import GraphState

_PROMPT_TEMPLATE = """\
## AURALIS — Fit Objection Strategy: Needs Discovery

### Conversation Facts
{memory_context}

### Prospect Message
{user_input}

### Analysis
- Objection         : fit (confidence {confidence:.0%})
- Prospect Persona  : {persona_label}
- Sentiment         : {sentiment_label}
- Trigger phrases   : {triggers}

### Role-Based Framing (Feature 13)
{pitch_angle}

### Tone Instruction (Feature 2)
{tone_instruction}

### Retrieved Product Capabilities
{knowledge}

### Strategy Instructions
You are handling a FIT objection. Follow this exact structure:

1. **Validate** — Acknowledge the concern genuinely in one sentence.
   Example: "That's exactly the right thing to pressure-test — fit matters
   more than features."

2. **Discovery Questions** — Ask 2 precise, open-ended questions to surface
   the specific gap:
   a. "Which part of your current workflow feels most at risk?"
   b. "What does [feature/capability they mentioned] need to do for your team
      that you're not seeing here?"
   (Tailor questions to persona: {pitch_angle})

3. **Feature-to-Need Mapping** — Using the retrieved capabilities above,
   map 2–3 product features directly to the objection:
   • Need: [stated need] → Auralis: [specific feature/capability] → Outcome.

4. **Honest Gap Acknowledgement** (only if there is a real gap):
   - "That specific feature is on our Q[N] roadmap — here's how teams handle
     it in the interim: [workaround]."

5. **Scoped Demo Offer**
   - "Can I show you a 20-minute demo scoped entirely to [their use case]?"

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
        or "No capability docs retrieved — use discovery questions to uncover the real need."
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
