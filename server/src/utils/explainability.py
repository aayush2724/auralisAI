from __future__ import annotations
from typing import TypedDict

PERSONA_PITCH_ANGLES = {
    "CEO": "Lead with ROI and operational cost savings.",
    "CTO": "Lead with architecture, scalability, and API quality.",
    "Developer": "Lead with REST APIs, SDKs, and developer experience.",
    "Product_Manager": "Lead with workflow integration and measurable user outcomes.",
    "Founder": "Lead with speed-to-market and competitive moat.",
    "Unknown": "Lead with a broad value overview and ask discovery questions.",
}


class ExplanationResult(TypedDict, total=False):
    """Human-readable audit trail of every model decision in the graph."""

    objection_reason: str
    persona_reason: str
    sentiment_reason: str
    strategy_reason: str
    trigger_phrases: list[str]
    confidence_note: str
    handoff_reason: str | None


def _get_confidence_note(state: dict) -> str:
    objection = state.get("objection") or {}
    obj_confidence = objection.get("confidence", 0)
    sentiment = state.get("sentiment") or {}
    sentiment_score = sentiment.get("score", 0)

    # High confidence + non-negative sentiment → no note
    if obj_confidence >= 0.85 and sentiment.get("label") != "negative":
        return ""

    # Low confidence → note
    if obj_confidence < 0.50:
        return (
            "Low confidence in objection classification — "
            "recommend verifying with customer."
        )

    # High negative sentiment → escalation note
    if sentiment.get("label") == "negative" and sentiment_score >= 0.90:
        return "High frustration detected — consider escalation."

    return ""


def explain(state: dict) -> ExplanationResult:
    """
    Build a human-readable explanation of every model decision from the GraphState.
    """
    # Safe extraction of nested objects or direct keys
    objection_dict = state.get("objection") or {}
    label = objection_dict.get("label") or state.get("objection label") or "neutral"
    conf = objection_dict.get("confidence") or state.get("objection confidence")
    if conf is None:
        conf = state.get("confidence") or 0.0
    triggers = (
        objection_dict.get("triggers") or state.get("objection triggers list") or []
    )

    # 1. objection_reason
    if not triggers:
        objection_reason = "Pattern matched from overall message tone (no explicit trigger phrases captured)."
    else:
        objection_reason = f"Detected {label} objection (confidence {conf:.0%}) because the prospect said: {triggers}."

    # 2. persona_reason
    persona_dict = state.get("persona") or {}
    persona_label = persona_dict.get("label") or state.get("persona label") or "Unknown"
    persona_conf = (
        persona_dict.get("confidence") or state.get("persona confidence") or 0.0
    )
    pitch_angle = PERSONA_PITCH_ANGLES.get(
        persona_label, PERSONA_PITCH_ANGLES["Unknown"]
    )

    persona_reason = f"Identified {persona_label} persona (confidence {persona_conf:.0%}). Pitch angle applied: {pitch_angle}."

    # 3. sentiment_reason
    sentiment_dict = state.get("sentiment") or {}
    sentiment_label = (
        sentiment_dict.get("label") or state.get("sentiment label") or "neutral"
    )
    sentiment_score = sentiment_dict.get("score") or state.get("sentiment score") or 0.0
    tone_instruction = (
        sentiment_dict.get("tone_instruction")
        or state.get("tone_instruction")
        or "Stay professional."
    )

    sentiment_reason = f"Sentiment detected as {sentiment_label} (score {sentiment_score:.0%}). Tone instruction injected: {tone_instruction}."

    # 4. strategy_reason
    strategy = (
        state.get("strategy")
        or state.get("strategy name chosen")
        or "discovery_questions"
    )

    # Rationale per strategy combo
    RATIONALES = {
        (
            "price",
            "CTO",
        ): "ROI framing is more persuasive than discounting for technical buyers.",
        (
            "price",
            "CEO",
        ): "CEOs need clear ROI framing and business case justifications to approve spend.",
        (
            "price",
            "Founder",
        ): "Founders want to understand the ROI and speed to market payback.",
        (
            "trust",
            "CTO",
        ): "CTOs require concrete technical proof like SOC2 compliance or architectural blueprints.",
        (
            "trust",
            "Developer",
        ): "Developers need technical proof including open source transparency and developer documentation.",
        (
            "timing",
            "CEO",
        ): "Strategic timing helps CEOs coordinate adoption with broader company roadmap goals.",
        (
            "competitor",
            "Developer",
        ): "Developers evaluate technical differentiation such as API design and SDK support.",
        (
            "competitor",
            "CEO",
        ): "Executive buyers need switching cost justification first.",
        (
            "fit",
            "Product_Manager",
        ): "Product Managers respond well to use-case mapping that targets specific workflow friction.",
        (
            "buying_signal",
            "Unknown",
        ): "Applied closing accelerator to capitalize on buying signals and streamline signup.",
    }

    rationale = RATIONALES.get((label, persona_label))
    if not rationale:
        if label == "buying_signal":
            rationale = "Applied closing accelerator to capitalize on buying signals and streamline signup."
        else:
            rationale = "Our strategy focuses on resolving the specific concern with the most relevant role-based value."

    strategy_reason = f"Applied {strategy} strategy because objection was {label} and persona was {persona_label}. {rationale}"

    # 5. confidence_note
    confidence_note = _get_confidence_note(state)

    # 6. trigger_phrases
    trigger_phrases = list(triggers)

    # 7. handoff_reason
    handoff_reason = None
    if state.get("should_handoff"):
        trigger = state.get("handoff_trigger", "")
        if trigger == "USER_REQUESTED":
            handoff_reason = "Human handoff triggered because the customer explicitly requested to speak with a human agent."
        elif trigger == "ANGRY_CUSTOMER":
            handoff_reason = f"Human handoff triggered due to high frustration signal ({sentiment_score:.0%} negative sentiment)."
        elif trigger == "LOW_CONFIDENCE":
            handoff_reason = f"Human handoff triggered due to low classifier confidence ({conf:.0%})."
        else:
            reasons = []
            if conf < 0.40:
                reasons.append(f"low classifier confidence ({conf:.0%})")
            if sentiment_label == "negative" and sentiment_score > 0.85:
                reasons.append(
                    f"high frustration signal ({sentiment_score:.0%} negative sentiment)"
                )
            if reasons:
                handoff_reason = (
                    f"Human handoff triggered due to: {' and '.join(reasons)}."
                )
            else:
                handoff_reason = "Human handoff triggered (threshold condition met)."

    return ExplanationResult(
        objection_reason=objection_reason,
        persona_reason=persona_reason,
        sentiment_reason=sentiment_reason,
        strategy_reason=strategy_reason,
        trigger_phrases=trigger_phrases,
        confidence_note=confidence_note,
        handoff_reason=handoff_reason,
    )
