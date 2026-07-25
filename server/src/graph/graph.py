"""
auralis/src/graph/graph.py
───────────────────────────
LangGraph conversation graph for Auralis.

Flow
----
START → classify_node → retrieve_node → strategy_node
      → generate_node → [conditional] → handoff_node → END
                                       ↘ END

Nodes
-----
  classify_node  — runs objection / sentiment / persona classifiers in parallel
  retrieve_node  — semantic retrieval + citation formatting
  strategy_node  — maps (objection × persona) → named strategy
  generate_node  — builds prompt and calls OpenAI
  handoff_node   — flags human escalation (Feature 7)

Exposed API
-----------
  run_graph(user_input: str, memory: ConversationMemory) -> GraphState
"""

from __future__ import annotations

import logging
import os
from typing import Any, TypedDict
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph

from src.classifier.objection import (
    ObjectionResult,
    CLASSES,
    _HYPOTHESIS_TEMPLATES,
    _extract_triggers,
)
from src.classifier.persona import (
    PersonaResult,
    PERSONAS,
    _HYPOTHESES,
    _PITCH_ANGLES,
    _UNKNOWN_THRESHOLD,
)
from src.classifier.sentiment import SentimentResult, analyze
from src.classifier.shared_model import get_zeroshot_pipeline
from src.handoff.handoff import evaluate_handoff

from src.memory.memory import ConversationMemory
from src.rag.retriever import format_citations, retrieve
from src.utils.logger import auralis_objections_total

# ─── Logging ──────────────────────────────────────────────────────────────────

logger = logging.getLogger("auralis.graph")


# ─── LLM (lazy singleton) ─────────────────────────────────────────────────────

_llm = None


def _get_llm():
    global _llm
    if _llm is None:
        _llm = ChatGoogleGenerativeAI(
            model=os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite"),
            temperature=float(os.getenv("LLM_TEMPERATURE", "0.2")),
            google_api_key=os.getenv("GEMINI_API_KEY"),
        )
    return _llm


# ─── Strategy map ─────────────────────────────────────────────────────────────
# Primary key: objection label.  Secondary key: persona label (optional override).
# Values are human-readable strategy module names used by generate_node.

_STRATEGY_MAP: dict[str, dict[str, str]] = {
    "price": {
        "_default": "value_reframe",
        "CEO": "roi_business_case",
        "Founder": "roi_business_case",
        "CTO": "value_reframe",
    },
    "trust": {
        "_default": "social_proof",
        "CTO": "technical_proof",
        "Developer": "technical_proof",
    },
    "timing": {
        "_default": "urgency_creation",
        "CEO": "strategic_timing",
        "Founder": "strategic_timing",
    },
    "competitor": {
        "_default": "competitive_differentiation",
        "Developer": "technical_differentiation",
        "CTO": "technical_differentiation",
    },
    "fit": {
        "_default": "needs_discovery",
        "Product_Manager": "use_case_mapping",
    },
    "buying_signal": {
        "_default": "closing_accelerator",
    },
    "neutral": {
        "_default": "discovery_questions",
    },
}

# ─── GraphState ───────────────────────────────────────────────────────────────


class GraphState(TypedDict, total=False):
    """Shared mutable state passed between every node in the graph."""

    user_input: str
    objection: ObjectionResult
    sentiment: SentimentResult
    persona: PersonaResult
    retrieved_docs: list[dict]
    citations: str
    memory_context: str
    strategy: str
    response: str
    confidence: float
    should_handoff: bool
    handoff_trigger: str | None
    handoff_message: str
    metadata: dict[str, Any]


# ─── Node: classify ───────────────────────────────────────────────────────────


def classify_node(state: GraphState) -> dict[str, Any]:
    """
    Run objection, sentiment, and persona classifiers.
    Objection and Persona are run in a single LLM call.
    Returns partial state update.
    """
    text = state["user_input"]
    logger.info("[classify_node] text='%s'", text[:80])

    # Sentiment is independent (local model)
    sentiment = analyze(text)

    # Combined LLM call for Objection + Persona
    clf = get_zeroshot_pipeline()

    obj_descs = [_HYPOTHESIS_TEMPLATES[c] for c in CLASSES]
    candidate_personas = [p for p in PERSONAS if p != "Unknown"]
    per_descs = [_HYPOTHESES[p] for p in candidate_personas]

    combined_result = clf.classify_combined(
        text=text,
        objection_labels=CLASSES,
        objection_descriptions=obj_descs,
        persona_labels=candidate_personas,
        persona_descriptions=per_descs,
    )

    # Process Objection
    obj_label = combined_result["objection"]["label"]
    obj_conf = combined_result["objection"]["confidence"]
    obj_all_scores = {label: 0.0 for label in CLASSES}
    obj_all_scores[obj_label] = obj_conf
    objection: ObjectionResult = {
        "label": obj_label,
        "confidence": obj_conf,
        "all_scores": obj_all_scores,
        "triggers": _extract_triggers(text, obj_label),
    }

    # Process Persona
    per_label = combined_result["persona"]["label"]
    per_conf = combined_result["persona"]["confidence"]
    if per_conf < _UNKNOWN_THRESHOLD:
        per_label = "Unknown"

    persona: PersonaResult = {
        "label": per_label,
        "confidence": per_conf,
        "pitch_angle": _PITCH_ANGLES[per_label],
    }

    logger.info(
        "[classify_node] objection=%s(%.2f) sentiment=%s persona=%s",
        objection["label"],
        objection["confidence"],
        sentiment["label"],
        persona["label"],
    )

    # Increment Prometheus objection counter
    auralis_objections_total.labels(objection_label=objection["label"]).inc()

    return {
        "objection": objection,
        "sentiment": sentiment,
        "persona": persona,
        "confidence": objection["confidence"],
        "metadata": {
            "pitch_angle": persona["pitch_angle"],
            "objection_triggers": objection["triggers"],
            "tone_instruction": sentiment["tone_instruction"],
        },
    }


# ─── Node: retrieve ───────────────────────────────────────────────────────────


def retrieve_node(state: GraphState) -> dict[str, Any]:
    """
    Build a targeted query from user_input + objection label, then retrieve
    matching docs from the FAISS knowledge base.
    """
    user_input = state["user_input"]
    objection = state.get("objection", {})
    obj_label = objection.get("label", "")

    # Enrich query with the objection class for better retrieval precision
    query = f"{user_input} {obj_label} objection handling" if obj_label else user_input
    logger.info("[retrieve_node] query='%s'", query[:100])

    try:
        docs = retrieve(query, top_k=5)
        citations = format_citations(docs)
    except FileNotFoundError:
        logger.warning(
            "[retrieve_node] FAISS index not found — proceeding without retrieval."
        )
        docs = []
        citations = ""

    logger.info("[retrieve_node] %d docs retrieved", len(docs))
    return {
        "retrieved_docs": docs,
        "citations": citations,
    }


# ─── Node: strategy ───────────────────────────────────────────────────────────


def strategy_node(state: GraphState) -> dict[str, Any]:
    """
    Select the named strategy module based on (objection × persona).

    Falls back to the objection-level default if no persona override exists.
    """
    obj_label = state.get("objection", {}).get("label", "neutral")
    persona_label = state.get("persona", {}).get("label", "Unknown")

    persona_map = _STRATEGY_MAP.get(obj_label, {"_default": "discovery_questions"})
    strategy = persona_map.get(persona_label) or persona_map.get(
        "_default", "discovery_questions"
    )

    logger.info(
        "[strategy_node] objection=%s persona=%s → strategy=%s",
        obj_label,
        persona_label,
        strategy,
    )

    objection = state.get("objection", {})
    metadata = state.get("metadata", {}).copy()

    if objection.get("label") == "competitor":
        triggers = objection.get("triggers", [])
        if triggers:
            metadata["competitor_mentioned"] = triggers[0]

    return {
        "strategy": strategy,
        "metadata": metadata,
    }


# ─── Node: generate ───────────────────────────────────────────────────────────
# Feature 13 — Role-Based Response Generation
# Each persona gets a distinct system prompt that re-frames language, metrics,
# and structure for that buyer's worldview before the strategy prompt runs.

PERSONA_TEMPLATES: dict[str, str] = {
    "CEO": """\
You are Auralis, an elite AI sales assistant optimised for C-suite conversations.

Communication rules for CEO persona:
- Open with board-level business impact: revenue, cost savings, competitive risk.
- Use dollar figures and percentages wherever possible — executives think in numbers.
- Structure responses as 3 tight bullets followed by one strategic question.
- Avoid technical jargon; translate everything into business outcomes.
- Risk reduction language is highly effective: "de-risk", "protect margin",
  "defend market share".
- Keep the entire response under 150 words.
- End with a question tied to their strategic goals, not product features.
""",
    "CTO": """\
You are Auralis, an elite AI sales assistant optimised for technical leadership.

Communication rules for CTO persona:
- Lead with architecture, scalability, security, and SLA commitments.
- Reference specific technical specifications: latency figures, uptime %,
  compliance certifications (SOC 2, GDPR, HIPAA), API design patterns.
- Short code snippets or API examples are welcome when relevant.
- Acknowledge trade-offs honestly — CTOs respect intellectual honesty over spin.
- Frame decisions in terms of engineering team impact: onboarding time,
  maintenance overhead, integration surface area.
- Keep the response under 200 words.
- End with a technical discovery question: "What does your current stack look like?"
""",
    "Developer": """\
You are Auralis, an elite AI sales assistant optimised for developer audiences.

Communication rules for Developer persona:
- Lead with REST APIs, SDKs, webhook events, and developer documentation quality.
- Show, don't just tell: reference endpoint names, response schemas, or SDK methods
  if available in the retrieved context.
- Emphasise self-serve setup — developers distrust anything that requires a sales call.
- Mention open-source components, GitHub presence, and community size if relevant.
- Use plain, direct language — no corporate marketing speak.
- Keep it concise and scannable; use code formatting where possible.
- End with a practical question: "What's your current integration approach?"
""",
    "Product_Manager": """\
You are Auralis, an elite AI sales assistant optimised for Product Managers.

Communication rules for Product Manager persona:
- Lead with feature velocity, user feedback loops, and measurable product outcomes.
- Frame every capability as: Feature → User Problem Solved → Metric Improved.
- Reference roadmap alignment: "This maps directly to your [stated goal]."
- Acknowledge the PM's role as the bridge between business and engineering —
  show how Auralis reduces internal alignment friction.
- Use concrete before/after scenarios, not abstract promises.
- Keep the response under 180 words.
- End with a roadmap question: "Which user problem is your team most focused on this quarter?"
""",
    "Founder": """\
You are Auralis, an elite AI sales assistant optimised for startup founders.

Communication rules for Founder persona:
- Lead with speed-to-market, competitive moat, and unit economics.
- Founders think in leverage: "How does this make our team 10× more effective?"
- Reference payback period and CAC/LTV impact where possible.
- Acknowledge resource constraints — founders are allergic to solutions that need
  a full-time admin to maintain.
- Competitive differentiation language resonates strongly: "Your competitors
  who adopt this first will have a structural advantage."
- Keep it punchy and under 160 words.
- End with a GTM question: "What's your biggest bottleneck to closing deals faster?"
""",
    "Unknown": """\
You are Auralis, an adaptive AI sales assistant.

Communication rules for unknown persona:
- Use a balanced, professional tone that works for any seniority level.
- Lead with clear value — what problem is solved and what outcome is achieved.
- Ask a discovery question early to identify their role and priorities.
- Avoid jargon from any single domain (finance, engineering, or product).
- Keep the response under 180 words.
- End with an open discovery question to learn more about their context.
""",
}

# Shared closing guidelines appended to every persona template
_SHARED_GUIDELINES = """\

Shared guidelines (apply always):
- Never fabricate statistics; cite only information from the retrieved context.
- Match the tone instruction provided in the strategy prompt exactly.
- Respond to the actual objection — don't pivot without acknowledging their concern.
"""


def _get_system_prompt(persona_label: str) -> str:
    """Return the persona-specific system prompt + shared guidelines."""
    template = PERSONA_TEMPLATES.get(persona_label, PERSONA_TEMPLATES["Unknown"])
    return template + _SHARED_GUIDELINES


def generate_node(state: GraphState) -> dict[str, Any]:
    """
    Build a persona-specific system prompt (Feature 13), dispatch to the
    strategy router for the user-turn prompt (Feature 2/11), then call OpenAI.

    Flow
    ----
    1. Resolve persona label → select matching PERSONA_TEMPLATE as system msg.
    2. Call strategy router → build_prompt(state) as the user-turn message.
    3. Invoke LLM with [SystemMessage(persona), HumanMessage(strategy_prompt)].
    4. Append citations if not already embedded.
    """
    from src.strategies.router import get_strategy_prompt  # noqa: PLC0415

    citations = state.get("citations") or ""
    persona_label = (state.get("persona") or {}).get("label", "Unknown")

    logger.info(
        "[generate_node] strategy=%s | label=%s | persona=%s",
        state.get("strategy"),
        (state.get("objection") or {}).get("label", "?"),
        persona_label,
    )

    # Build the specialised user-turn prompt via the strategy router
    user_prompt = get_strategy_prompt(state)

    llm = _get_llm()
    # pyrefly: ignore [missing-import]
    from langchain_core.messages import HumanMessage, SystemMessage  # noqa: PLC0415

    system_prompt = _get_system_prompt(persona_label)
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]
    ai_msg_chunks = llm.stream(messages)

    response_parts = []
    for chunk in ai_msg_chunks:
        if isinstance(chunk.content, list):
            for part in chunk.content:
                if isinstance(part, dict) and "text" in part:
                    response_parts.append(part["text"])
                elif isinstance(part, str):
                    response_parts.append(part)
        else:
            response_parts.append(str(chunk.content))

    response_text = "".join(response_parts)

    # Append citations block if the strategy prompt didn't embed them
    if citations and citations not in response_text:
        response_text = response_text.rstrip() + f"\n\n---\n**Sources**\n{citations}"

    logger.info("[generate_node] response length=%d chars", len(response_text))
    return {"response": response_text}


# ─── Node: handoff ────────────────────────────────────────────────────────────


def handoff_node(state: GraphState) -> dict:
    decision = evaluate_handoff(state, state.get("user_input", ""))
    return {
        "should_handoff": decision["should_handoff"],
        "handoff_trigger": decision["trigger"].value if decision["trigger"] else None,
        "handoff_message": decision["handoff_message"],
    }


# ─── Conditional router ───────────────────────────────────────────────────────


def _should_handoff(state: GraphState) -> str:
    decision = evaluate_handoff(state, state.get("user_input", ""))
    return "handoff" if decision["should_handoff"] else "end"


# ─── Graph compilation ────────────────────────────────────────────────────────


def _build_graph() -> StateGraph:
    builder = StateGraph(GraphState)

    # Register nodes
    builder.add_node("classify_node", classify_node)
    builder.add_node("retrieve_node", retrieve_node)
    builder.add_node("strategy_node", strategy_node)
    builder.add_node("generate_node", generate_node)
    builder.add_node("handoff_node", handoff_node)

    # Linear backbone
    builder.add_edge(START, "classify_node")
    builder.add_edge("classify_node", "retrieve_node")
    builder.add_edge("retrieve_node", "strategy_node")
    builder.add_edge("strategy_node", "generate_node")

    # Conditional branch after generation
    builder.add_conditional_edges(
        "generate_node",
        _should_handoff,
        {
            "handoff": "handoff_node",
            "end": END,
        },
    )

    # Handoff always terminates
    builder.add_edge("handoff_node", END)

    return builder


# Compiled graph (module-level singleton)
_graph = _build_graph().compile()


# ─── Public API ───────────────────────────────────────────────────────────────


def run_graph(user_input: str, memory: ConversationMemory) -> GraphState:
    """
    Execute the full Auralis conversation graph for a single user turn.

    Parameters
    ----------
    user_input : The prospect's latest message.
    memory     : Live ConversationMemory instance for this session.

    Returns
    -------
    Final GraphState after all nodes have executed.

    Side-effects
    ------------
    - Adds the user turn + objection metadata to *memory*.
    - Adds the assistant response to *memory*.
    """
    if not user_input or not user_input.strip():
        raise ValueError("`user_input` must be a non-empty string.")

    # Seed the initial state
    initial_state: GraphState = {
        "user_input": user_input.strip(),
        "memory_context": memory.get_context_string(),
        "should_handoff": False,
        "metadata": {},
    }

    logger.info("run_graph | input='%s'", user_input[:80])

    final_state: GraphState = _graph.invoke(initial_state)

    # Persist this turn into memory (with objection metadata for fact extraction)
    memory.add(
        role="user",
        content=user_input,
        metadata={"objection": final_state.get("objection")},
    )
    memory.add(
        role="assistant",
        content=final_state.get("response", ""),
    )

    return final_state
