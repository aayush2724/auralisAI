"""
auralis/src/api/schemas.py
───────────────────────────
Shared Pydantic request/response models for the Auralis API.

Keeping schemas in a dedicated module avoids circular imports between
main.py and the route files.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

# ─── Request ──────────────────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    """Incoming chat request body."""

    session_id: str = Field(
        ...,
        description="Unique identifier for this user/conversation session. "
        "Reuse across turns to maintain conversation memory.",
        examples=["user_abc123", "conv_2024_001"],
    )
    message: str = Field(
        ...,
        min_length=1,
        max_length=4096,
        description="The prospect's latest utterance.",
        examples=["This is way too expensive for our budget."],
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "session_id": "user_abc123",
                    "message": "We already use HubSpot and are very happy with it.",
                }
            ]
        }
    }


# ─── Nested models ────────────────────────────────────────────────────────────


class ExplanationResponse(BaseModel):
    """Human-readable audit trail for every model decision (Feature 9)."""

    objection_reason: str
    persona_reason: str
    sentiment_reason: str
    strategy_reason: str
    trigger_phrases: list[str]
    confidence_note: str
    handoff_reason: str | None = None


class RetrievedDoc(BaseModel):
    """A single retrieved knowledge-base chunk."""

    text: str
    source_file: str
    chunk_index: int
    score: float


# ─── Response ─────────────────────────────────────────────────────────────────


class ChatResponse(BaseModel):
    """Full response returned by POST /chat."""

    # Core output
    response: str = Field(description="Generated sales response text.")
    objection_label: str = Field(description="Detected objection class.")
    confidence: float = Field(
        ge=0.0, le=1.0, description="Classifier confidence (0–1)."
    )
    sentiment: str = Field(
        description="Detected sentiment: positive | neutral | negative."
    )
    persona: str = Field(description="Detected buyer persona.")
    strategy: str = Field(description="Strategy module that built the response.")
    citations: str = Field(description="Numbered source citations (Feature 11).")
    should_handoff: bool = Field(
        description="True if human escalation is recommended (Feature 7)."
    )
    handoff_trigger: str | None = Field(
        default=None, description="Handoff trigger reason if escalated."
    )

    # Rich detail
    explanation: ExplanationResponse = Field(
        description="Decision audit trail (Feature 9)."
    )
    retrieved_docs: list[RetrievedDoc] = Field(
        default_factory=list, description="Top-k knowledge-base chunks used."
    )

    # Session context
    session_id: str = Field(description="Echo of the request session_id.")
    memory_context: str = Field(description="Current session fact summary (Feature 1).")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "response": "That's a fair concern — let me show you the ROI data...",
                    "objection_label": "price",
                    "confidence": 0.91,
                    "sentiment": "neutral",
                    "persona": "CTO",
                    "strategy": "roi_business_case",
                    "citations": "[1] Case Study (cases.pdf, chunk 0)",
                    "should_handoff": False,
                    "explanation": {
                        "objection_reason": "Detected price objection (confidence 91%) because...",
                        "persona_reason": "Identified CTO because of technical framing...",
                        "sentiment_reason": "Customer tone is measured...",
                        "strategy_reason": "Applied roi_business_case because...",
                        "trigger_phrases": ["too expensive"],
                        "confidence_note": "",
                        "handoff_reason": None,
                    },
                    "retrieved_docs": [],
                    "session_id": "user_abc123",
                    "memory_context": "Customer context: tools=HubSpot.",
                }
            ]
        }
    }


# ─── Session endpoint response ────────────────────────────────────────────────


class SessionFactsResponse(BaseModel):
    """Response for GET /session/{session_id}."""

    session_id: str
    company_name: str | None
    persona_label: str | None
    tools_mentioned: list[str]
    objections_raised: list[dict[str, Any]]
    budget_signal: str | None
    found: bool = Field(description="False if no session exists in the DB.")


# ─── Health ───────────────────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"


# ─── Auth ────────────────────────────────────────────────────────────────────


class TokenResponse(BaseModel):
    """Response body for POST /auth/token."""

    access_token: str = Field(
        description="Signed HS256 JWT. Include in Authorization: Bearer <token>."
    )
    token_type: str = Field(default="bearer", description='Always "bearer".')


class UserResponse(BaseModel):
    """Public user representation (no password)."""

    id: str = Field(description="UUID primary key from the users table.")
    email: str = Field(description="User email address.")
    role: str = Field(description="User role: admin | sales_rep | viewer.")


# ─── Analytics ────────────────────────────────────────────────────────────────


class SentimentDaySnapshot(BaseModel):
    """Daily sentiment counts for one calendar day."""

    date: str = Field(description="ISO date string, e.g. '2024-06-01'.")
    positive: int = Field(default=0)
    neutral: int = Field(default=0)
    negative: int = Field(default=0)


class DashboardResponse(BaseModel):
    """Aggregated analytics snapshot returned by GET /analytics/dashboard."""

    total_sessions: int = Field(description="Total distinct sessions recorded.")
    conversion_rate: float = Field(
        ge=0.0,
        le=1.0,
        description="Fraction of sessions with at least one conversion event (0–1).",
    )
    objection_distribution: dict[str, int] = Field(
        default_factory=dict,
        description="Objection label → total event count.",
    )
    sentiment_trend: list[SentimentDaySnapshot] = Field(
        default_factory=list,
        description="Daily sentiment counts for the last 30 days, newest-first.",
    )
    persona_distribution: dict[str, int] = Field(
        default_factory=dict,
        description="Persona label → total event count.",
    )
    avg_confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Mean objection classifier confidence across all events (0–1).",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "total_sessions": 42,
                    "conversion_rate": 0.31,
                    "objection_distribution": {
                        "price": 18,
                        "trust": 11,
                        "neutral": 8,
                        "timing": 5,
                    },
                    "sentiment_trend": [
                        {
                            "date": "2024-06-25",
                            "positive": 5,
                            "neutral": 12,
                            "negative": 3,
                        }
                    ],
                    "persona_distribution": {
                        "CEO": 15,
                        "CTO": 12,
                        "Founder": 9,
                        "Unknown": 6,
                    },
                    "avg_confidence": 0.84,
                }
            ]
        }
    }


# ─── Knowledge Base ───────────────────────────────────────────────────────────


class KBIngestResponse(BaseModel):
    """Response for POST /kb/ingest."""

    files_processed: int = Field(description="Number of files successfully ingested.")
    chunks_added: int = Field(
        description="Number of text chunks added to the FAISS index."
    )
    upload_dir: str = Field(
        description="Path to the directory where uploaded files were saved."
    )
    index_updated: bool = Field(description="True if the FAISS index was updated.")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "files_processed": 3,
                    "chunks_added": 47,
                    "upload_dir": "data/uploads/20240625T120000Z",
                    "index_updated": True,
                }
            ]
        }
    }


class KBStatsResponse(BaseModel):
    """Response for GET /kb/stats."""

    total_documents: int = Field(
        description="Number of source files in the vectorstore."
    )
    total_chunks: int = Field(description="Number of text chunks in the FAISS index.")
    index_path: str = Field(description="Filesystem path to the FAISS index.")
    last_updated: str | None = Field(
        description="ISO timestamp of the last ingestion, or None."
    )
