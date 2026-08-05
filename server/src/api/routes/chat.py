"""
auralis/src/api/routes/chat.py
───────────────────────────────────
Route handlers for POST /chat, WS /ws/chat and GET /session/{session_id}.

Authorization
-------------
  POST /chat               → requires role: sales_rep | admin
  WS   /ws/chat            → requires role: sales_rep | admin
  GET  /session/{id}       → requires role: admin

POST /chat
----------
  Request  : ChatRequest(session_id, message)
  Response : ChatResponse

  Handler steps (per spec):
    1. Load or create ConversationMemory for session_id.
    2. Call run_graph(message, memory)  →  GraphState.
    3. Call explain(state)              →  ExplanationResult; attach to response.
    4. Persist session via save_session().
    5. Build and return ChatResponse.

GET /session/{session_id}
--------------------------
  Returns all persisted facts for the session from PostgreSQL as
  SessionFactsResponse. Returns found=False (HTTP 200) if no session exists.

OpenAPI docs
------------
  Both endpoints are fully documented and visible at /docs (Feature 14).
  The Authorize button in Swagger UI accepts the JWT issued by POST /auth/token.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from typing import Any

from fastapi import (
    APIRouter,
    HTTPException,
    Path,
    Request,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from pydantic import ValidationError

from src.analytics.tracker import log_event
from src.api.auth import User, get_current_user_from_token, require_roles
from src.api.schemas import (
    ChatRequest,
    ChatResponse,
    ExplanationResponse,
    RetrievedDoc,
    SessionFactsResponse,
)
from src.classifier.shared_model import GeminiRateLimitError
from src.graph.graph import run_graph
from src.memory.db import delete_session, list_sessions, load_session, save_session
from src.memory.memory import ConversationMemory
from src.utils.explainability import explain
from src.utils.limiter import limiter
from src.utils.logger import log_request
from src.utils.webhooks import fire_webhooks

logger = logging.getLogger("auralis.api.chat")
router = APIRouter()


async def _run_chat_turn(
    session_id: str,
    message: str,
    owner_id: str | None = None,
    user_email: str | None = None,
    workspace_id: str = "default_tenant",
) -> tuple[ChatResponse, dict, ConversationMemory]:
    # ── Step 1: Load or create ConversationMemory ─────────────────────────────
    memory = await ConversationMemory.from_session(session_id, owner_id)

    # ── Run the full graph pipeline ───────────────────────────────────────────
    state = run_graph(message, memory)

    # When handoff triggered, use the handoff_message as the response.
    do_handoff = bool(state.get("should_handoff", False))
    if do_handoff:
        response_text = state.get("handoff_message") or state.get("response", "")
    else:
        response_text = state.get("response", "")

    exp_dict = explain(state)
    explanation = ExplanationResponse(
        objection_reason=exp_dict["objection_reason"],
        persona_reason=exp_dict["persona_reason"],
        sentiment_reason=exp_dict["sentiment_reason"],
        strategy_reason=exp_dict["strategy_reason"],
        trigger_phrases=exp_dict["trigger_phrases"],
        confidence_note=exp_dict["confidence_note"],
        handoff_reason=exp_dict["handoff_reason"],
    )

    facts = memory.get_facts()
    persona_dict = state.get("persona") or {}
    persona_label = persona_dict.get("label")
    if persona_label:
        facts["persona_label"] = persona_label

    objection_dict = state.get("objection") or {}
    sentiment_dict = state.get("sentiment") or {}

    retrieved_docs = [
        RetrievedDoc(
            text=d.get("text", ""),
            source_file=d.get("source_file", ""),
            chunk_index=d.get("chunk_index", -1),
            score=d.get("score", 0.0),
        )
        for d in (state.get("retrieved_docs") or [])
    ]

    response = ChatResponse(
        response=response_text,
        objection_label=objection_dict.get("label", "neutral"),
        confidence=float(state.get("confidence", 1.0)),
        sentiment=sentiment_dict.get("label", "neutral"),
        persona=persona_dict.get("label", "Unknown"),
        strategy=state.get("strategy", "discovery_questions"),
        citations=state.get("citations", ""),
        should_handoff=do_handoff,
        handoff_trigger=state.get("handoff_trigger"),
        explanation=explanation,
        retrieved_docs=retrieved_docs,
        session_id=session_id,
        memory_context=memory.get_context_string(),
    )

    asyncio.create_task(
        log_event(
            session_id=session_id,
            state=state,
            did_convert=bool(response.should_handoff),
        )
    )
    if response.should_handoff:
        asyncio.create_task(
            fire_webhooks(
                session_id=session_id,
                state=state,
                user_email=user_email,
            )
        )
    return response, state, memory


def _extract_ws_token(websocket: WebSocket) -> str | None:
    token = websocket.query_params.get("token")
    if token:
        return token

    auth_header = websocket.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        if token:
            return token

    return None


# ─── POST /chat ───────────────────────────────────────────────────────────────


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Process a customer utterance and generate a sales response.",
    description=(
        "Runs the utterance through parallel objection / sentiment / persona "
        "classifiers, retrieves supporting evidence from the knowledge base, "
        "selects a negotiation strategy, generates a persona-targeted response, "
        "and returns a full decision audit trail.\n\n"
        "**Required role**: `sales_rep` or `admin`.\n\n"
        "**Session memory** is loaded from PostgreSQL on each request and "
        "persisted after the graph completes (Feature 10)."
    ),
    responses={
        400: {"description": "Invalid request — empty session_id or message."},
        401: {"description": "Missing or invalid Bearer token."},
        403: {"description": "Insufficient role. Requires sales_rep or admin."},
        500: {"description": "Internal server error during graph execution."},
    },
)
@limiter.limit("20/minute")
async def chat(
    request: Request,
    payload: ChatRequest,
    current_user: User = require_roles("sales_rep", "admin"),
) -> ChatResponse:
    session_id = payload.session_id.strip()
    message = payload.message.strip()

    if not session_id:
        raise HTTPException(
            status_code=400, detail="`session_id` must be a non-empty string."
        )
    if not message:
        raise HTTPException(
            status_code=400, detail="`message` must be a non-empty string."
        )

    start_time = time.perf_counter()
    logger.info(
        "POST /chat | user=%s role=%s session=%s",
        current_user.email,
        current_user.role,
        session_id,
    )

    try:
        response, state, memory = await _run_chat_turn(
            session_id=session_id,
            message=message,
            owner_id=current_user.id,
            user_email=current_user.email,
            workspace_id=current_user.workspace_id,
        )

        facts = memory.get_facts()
        persona_dict = state.get("persona") or {}
        persona_label = persona_dict.get("label")
        if persona_label:
            facts["persona_label"] = persona_label

        messages_list = [
            {
                "role": m.role,
                "content": m.content,
                "metadata": m.metadata,
                "turn": m.turn,
            }
            for m in memory._messages
        ]

        await save_session(session_id, facts, current_user.id, current_user.workspace_id, messages=messages_list)

        # ── Log handoff event if triggered ────────────────────────────────────
        if response.should_handoff:
            logger.info(
                "Handoff triggered | session=%s trigger=%s",
                session_id,
                state.get("handoff_trigger", "unknown"),
            )

        # ── Emit structured request log ─────────────────────────────────────
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        log_request(
            {
                "session_id": session_id,
                "user_input_length": len(message),
                "objection_label": response.objection_label,
                "objection_confidence": response.confidence,
                "sentiment_label": response.sentiment,
                "persona_label": response.persona,
                "strategy_chosen": response.strategy,
                "response_length": len(response.response),
                "latency_ms": latency_ms,
                "should_handoff": response.should_handoff,
                "handoff_trigger": state.get("handoff_trigger"),
            }
        )

        return response

    except GeminiRateLimitError as e:
        logger.warning(f"Rate limit exceeded: {e}")
        raise HTTPException(
            status_code=429,
            detail=str(e),
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except HTTPException:
        raise  # Re-raise 400/401/403/429 unchanged
    except Exception:
        logger.exception("Error in POST /chat for session %s", session_id)
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again or contact support.",
        )


# ─── WS /ws/chat ───────────────────────────────────────────────────────────────

_ws_rate_limits = {}


@router.websocket("/ws/chat")
async def chat_websocket(websocket: WebSocket) -> None:
    token = _extract_ws_token(websocket)
    if not token:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Missing bearer token.",
        )
        return

    try:
        user = await get_current_user_from_token(token)
    except HTTPException:
        await websocket.close(code=4401, reason="Invalid or expired token.")
        return

    if user.role not in {"sales_rep", "admin"}:
        await websocket.close(code=4403, reason="Insufficient role.")
        return

    await websocket.accept()
    logger.info("WS /ws/chat connected | user=%s role=%s", user.email, user.role)

    try:
        while True:
            payload = await websocket.receive_json()
            try:
                request = ChatRequest.model_validate(payload)
            except ValidationError as exc:
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": "Invalid payload. Expected: {session_id, message}.",
                        "errors": exc.errors(),
                    }
                )
                continue

            session_id = request.session_id.strip()
            message = request.message.strip()
            if not session_id or not message:
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": "Both `session_id` and `message` must be non-empty.",
                    }
                )
                continue

            # Manual Rate Limiting: 20 per minute
            now = time.time()
            if user.id not in _ws_rate_limits:
                _ws_rate_limits[user.id] = deque()

            user_timestamps = _ws_rate_limits[user.id]
            while user_timestamps and user_timestamps[0] < now - 60:
                user_timestamps.popleft()

            if len(user_timestamps) >= 20:
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": "Rate limit exceeded: 20 per 1 minute. Please wait before sending more messages.",
                    }
                )
                continue

            user_timestamps.append(now)

            start_time = time.perf_counter()
            try:
                response, state, memory = await _run_chat_turn(
                    session_id=session_id,
                    message=message,
                    owner_id=user.id,
                    user_email=user.email,
                    workspace_id=user.workspace_id,
                )
                
                facts = memory.get_facts()
                persona_dict = state.get("persona") or {}
                persona_label = persona_dict.get("label")
                if persona_label:
                    facts["persona_label"] = persona_label
        
                messages_list = [
                    {
                        "role": m.role,
                        "content": m.content,
                        "metadata": m.metadata,
                        "turn": m.turn,
                    }
                    for m in memory._messages
                ]
        
                await save_session(session_id, facts, user.id, user.workspace_id, messages=messages_list)
            except PermissionError as e:
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": str(e),
                    }
                )
                continue

            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

            log_request(
                {
                    "transport": "websocket",
                    "session_id": session_id,
                    "user_input_length": len(message),
                    "objection_label": response.objection_label,
                    "objection_confidence": response.confidence,
                    "sentiment_label": response.sentiment,
                    "persona_label": response.persona,
                    "strategy_chosen": response.strategy,
                    "response_length": len(response.response),
                    "latency_ms": latency_ms,
                    "should_handoff": response.should_handoff,
                    "handoff_trigger": state.get("handoff_trigger"),
                }
            )

            await websocket.send_json(
                {
                    "type": "chat_response",
                    "data": response.model_dump(),
                }
            )
    except WebSocketDisconnect:
        logger.info("WS /ws/chat disconnected | user=%s", user.email)
    except Exception:
        logger.exception("WS /ws/chat failed for user=%s", user.email)
        await websocket.send_json(
            {
                "type": "error",
                "detail": "An internal error occurred. Please try again or contact support.",
            }
        )
        await websocket.close(code=1011, reason="Server error")


# ─── GET /session/{session_id} ────────────────────────────────────────────────


@router.get(
    "/session/{session_id}",
    response_model=SessionFactsResponse,
    summary="Retrieve the full persisted session facts for a customer from PostgreSQL.",
    description=(
        "Returns all extracted profile facts (company, persona, tools, objection "
        "history, budget signal) for the given session_id.\n\n"
        "**Required role**: `admin`.\n\n"
        "Returns `found=false` (HTTP 200) rather than 404 if no session exists, "
        "so callers can distinguish 'no data yet' from a genuine error."
    ),
    responses={
        400: {"description": "Invalid request — empty session_id."},
        401: {"description": "Missing or invalid Bearer token."},
        403: {"description": "Insufficient role. Requires admin."},
        500: {"description": "Internal server error during DB lookup."},
    },
)
async def get_session_facts(
    session_id: str = Path(
        ...,
        description="The unique session identifier used in POST /chat.",
        examples=["user_abc123", "conv_2024_001"],
    ),
    current_user: User = require_roles("admin"),
) -> SessionFactsResponse:
    session_id = session_id.strip()
    if not session_id:
        raise HTTPException(
            status_code=400, detail="`session_id` must be a non-empty string."
        )

    logger.info(
        "GET /session/%s | user=%s role=%s",
        session_id,
        current_user.email,
        current_user.role,
    )

    try:
        facts = await load_session(session_id, workspace_id=current_user.workspace_id)

        if not facts:
            # Session not found — return a valid response with found=False
            return SessionFactsResponse(
                session_id=session_id,
                company_name=None,
                persona_label=None,
                tools_mentioned=[],
                objections_raised=[],
                budget_signal=None,
                found=False,
            )

        return SessionFactsResponse(
            session_id=session_id,
            company_name=facts.get("company_name"),
            persona_label=facts.get("persona_label"),
            tools_mentioned=facts.get("tools_mentioned") or [],
            objections_raised=facts.get("objections_raised") or [],
            budget_signal=facts.get("budget_signal"),
            found=True,
        )

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error in GET /session/%s", session_id)
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again or contact support.",
        )


@router.get(
    "/chat/sessions",
    summary="List all past chat sessions for the current user.",
    description="Returns a list of all chat sessions created by the current user.",
)
async def get_chat_sessions(
    current_user: User = require_roles("sales_rep", "admin"),
) -> list[dict[str, Any]]:
    try:
        return await list_sessions(
            owner_id=current_user.id, workspace_id=current_user.workspace_id
        )
    except Exception:
        logger.exception("Error listing chat sessions for user %s", current_user.id)
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again or contact support.",
        )


@router.get(
    "/chat/history/{session_id}",
    summary="Retrieve the chat message history for a given session.",
    description="Returns the full list of messages for the given session_id if owned by the user.",
)
async def get_chat_history(
    session_id: str,
    current_user: User = require_roles("sales_rep", "admin"),
) -> list[dict[str, Any]]:
    try:
        facts = await load_session(
            session_id, owner_id=current_user.id, workspace_id=current_user.workspace_id
        )
        if not facts:
            raise HTTPException(status_code=404, detail="Session not found.")
        return facts.get("messages") or []
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error fetching history for session %s", session_id)
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again or contact support.",
        )


@router.delete(
    "/chat/session/{session_id}",
    summary="Delete a chat session.",
    description="Deletes the specified chat session from the database.",
)
async def delete_chat_session(
    session_id: str,
    current_user: User = require_roles("sales_rep", "admin"),
) -> dict[str, Any]:
    try:
        # Load first to verify permissions
        await load_session(
            session_id, owner_id=current_user.id, workspace_id=current_user.workspace_id
        )
        await delete_session(session_id)
        return {
            "status": "success",
            "message": f"Session {session_id} deleted successfully.",
        }
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception:
        logger.exception("Error deleting session %s", session_id)
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again or contact support.",
        )
