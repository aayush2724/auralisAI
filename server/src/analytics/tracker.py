"""
auralis/src/analytics/tracker.py
──────────────────────────────────
Conversation event tracker for Auralis — analytics persistence and aggregation.

Responsibilities
----------------
1. Persist one row per conversation turn to ``conversation_events`` in PostgreSQL.
2. Aggregate those rows into a ``DashboardData`` snapshot for the admin dashboard.

Table: conversation_events
--------------------------
  id             UUID PRIMARY KEY (auto)
  session_id     VARCHAR  — matches customer_sessions.session_id
  turn_number    INT      — monotonic counter within the session
  objection_label VARCHAR — from GraphState["objection"]["label"]
  sentiment_label VARCHAR — from GraphState["sentiment"]["label"]
  persona_label   VARCHAR — from GraphState["persona"]["label"]
  confidence      FLOAT   — objection classifier confidence (0–1)
  did_convert     BOOL    — True when the caller signals a conversion event
  created_at      TIMESTAMPTZ

Public API
----------
  async init_analytics_db() -> None
      Create the table + index if they do not exist. Called in lifespan.

  async log_event(session_id, state, did_convert=False) -> None
      Insert one event row. Silently swallows all DB errors so a metrics
      failure never degrades the live /chat endpoint.

  async get_dashboard_data() -> DashboardData
      Run aggregation SQL and return a fully populated DashboardData dict.

DashboardData TypedDict
-----------------------
  total_sessions          : int
  conversion_rate         : float   (converting sessions / total sessions)
  objection_distribution  : dict    label  → count
  sentiment_trend         : list[dict]  each entry = {date, positive, neutral, negative}
  persona_distribution    : dict    label  → count
  avg_confidence          : float
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, TypedDict

from sqlalchemy import text

# Share the existing engine — no second connection pool
from src.memory.db import _get_engine  # noqa: WPS436
from src.graph.graph import GraphState

logger = logging.getLogger("auralis.analytics")

# ─── DDL ──────────────────────────────────────────────────────────────────────

_CREATE_EVENTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS conversation_events (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      VARCHAR(255) NOT NULL,
    turn_number     INTEGER      NOT NULL DEFAULT 0,
    objection_label VARCHAR(64)  NOT NULL DEFAULT 'neutral',
    sentiment_label VARCHAR(32)  NOT NULL DEFAULT 'neutral',
    persona_label   VARCHAR(64)  NOT NULL DEFAULT 'Unknown',
    confidence      FLOAT        NOT NULL DEFAULT 0.0,
    did_convert     BOOLEAN      NOT NULL DEFAULT FALSE,
    variant         VARCHAR(16)  NOT NULL DEFAULT 'ADAPTIVE',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_session_id
    ON conversation_events (session_id);

CREATE INDEX IF NOT EXISTS idx_events_created_at
    ON conversation_events (created_at);
"""


async def init_analytics_db() -> None:
    """Create the ``conversation_events`` table and indexes if they don't exist."""
    engine = _get_engine()
    async with engine.begin() as conn:
        for stmt in _CREATE_EVENTS_TABLE_SQL.split(";"):
            if stmt.strip():
                await conn.execute(text(stmt))
        # Ensure 'variant' column exists if table was already created
        try:
            await conn.execute(
                text(
                    "ALTER TABLE conversation_events ADD COLUMN IF NOT EXISTS variant VARCHAR(16) NOT NULL DEFAULT 'ADAPTIVE'"
                )
            )
        except Exception as exc:
            logger.warning(
                "Could not add variant column to conversation_events: %s", exc
            )
    logger.info("conversation_events table initialised.")


# ─── TypedDict ────────────────────────────────────────────────────────────────


class DashboardData(TypedDict):
    """
    Aggregated analytics snapshot returned by get_dashboard_data().

    Fields
    ------
    total_sessions          Total distinct sessions in the events table.
    conversion_rate         Fraction of sessions with at least one did_convert=True event.
    objection_distribution  Mapping of objection label → total event count.
    sentiment_trend         List of daily sentiment counts, newest-first.
                            Each entry: {date, positive, neutral, negative}.
    persona_distribution    Mapping of persona label → total event count.
    avg_confidence          Mean objection classifier confidence across all events.
    """

    total_sessions: int
    conversion_rate: float
    objection_distribution: dict[str, int]
    sentiment_trend: list[dict[str, Any]]
    persona_distribution: dict[str, int]
    avg_confidence: float


# ─── log_event ────────────────────────────────────────────────────────────────


async def _insert_event(
    session_id: str,
    state: GraphState,
    did_convert: bool,
    turn_number: int,
) -> None:
    """Core insert logic, separated so log_event can wrap it safely."""
    objection = state.get("objection") or {}
    sentiment = state.get("sentiment") or {}
    persona = state.get("persona") or {}

    engine = _get_engine()
    sql = text("""
        INSERT INTO conversation_events
            (session_id, turn_number, objection_label, sentiment_label,
             persona_label, confidence, did_convert, variant, created_at)
        VALUES
            (:session_id, :turn_number, :objection_label, :sentiment_label,
             :persona_label, :confidence, :did_convert, :variant, :now)
    """)
    params = {
        "session_id": session_id,
        "turn_number": turn_number,
        "objection_label": objection.get("label", "neutral"),
        "sentiment_label": sentiment.get("label", "neutral"),
        "persona_label": persona.get("label", "Unknown"),
        "confidence": float(objection.get("confidence", 0.0)),
        "did_convert": did_convert,
        "variant": state.get("variant", "ADAPTIVE"),
        "now": datetime.now(tz=timezone.utc),
    }
    async with engine.begin() as conn:
        await conn.execute(sql, params)

    logger.debug(
        "event logged | session=%s turn=%d obj=%s sentiment=%s convert=%s",
        session_id,
        turn_number,
        params["objection_label"],
        params["sentiment_label"],
        did_convert,
    )


async def log_event(
    session_id: str,
    state: GraphState,
    did_convert: bool = False,
) -> None:
    """
    Persist one conversation-turn event row to PostgreSQL.

    Designed to be called as a **fire-and-forget** background task from the
    /chat handler — never raises, so a metrics failure never degrades the API.

    Parameters
    ----------
    session_id  : The active session identifier.
    state       : Completed GraphState returned by run_graph().
    did_convert : Pass True when the caller detects a conversion signal
                  (e.g. the customer agreed to a demo or signed up).
    """
    # Derive the turn number from the number of events already in this session.
    try:
        engine = _get_engine()
        async with engine.connect() as conn:
            result = await conn.execute(
                text(
                    "SELECT COUNT(*) FROM conversation_events WHERE session_id = :sid"
                ),
                {"sid": session_id},
            )
            turn_number = (result.scalar() or 0) + 1
    except Exception as exc:
        logger.warning(
            "log_event: could not fetch turn count for %s: %s", session_id, exc
        )
        turn_number = 1

    try:
        await _insert_event(session_id, state, did_convert, turn_number)
    except Exception as exc:
        # Never propagate — analytics failures must not affect the chat response.
        logger.warning("log_event: insert failed for session %s: %s", session_id, exc)


# ─── get_dashboard_data ───────────────────────────────────────────────────────


async def get_dashboard_data() -> DashboardData:
    """
    Aggregate ``conversation_events`` into a DashboardData snapshot.

    All six aggregations run inside a single read-only transaction to give
    a consistent point-in-time view of the data.

    Returns
    -------
    DashboardData with all six fields populated.
    Gracefully returns zero/empty values if the table is empty.
    """
    engine = _get_engine()

    async with engine.connect() as conn:

        # ── 1. Total distinct sessions ────────────────────────────────────────
        r = await conn.execute(
            text("SELECT COUNT(DISTINCT session_id) FROM conversation_events")
        )
        total_sessions: int = r.scalar() or 0

        # ── 2. Conversion rate ────────────────────────────────────────────────
        # converting_sessions / total_sessions
        r = await conn.execute(
            text(
                "SELECT COUNT(DISTINCT session_id) FROM conversation_events "
                "WHERE did_convert = TRUE"
            )
        )
        converting_sessions: int = r.scalar() or 0
        conversion_rate = (
            round(converting_sessions / total_sessions, 4)
            if total_sessions > 0
            else 0.0
        )

        # ── 3. Objection distribution ─────────────────────────────────────────
        r = await conn.execute(
            text(
                "SELECT objection_label, COUNT(*) AS cnt "
                "FROM conversation_events "
                "GROUP BY objection_label "
                "ORDER BY cnt DESC"
            )
        )
        objection_distribution: dict[str, int] = {
            row.objection_label: row.cnt for row in r.fetchall()
        }

        # ── 4. Sentiment trend (last 30 days, daily buckets) ──────────────────
        r = await conn.execute(text("""
                SELECT
                    DATE(created_at AT TIME ZONE 'UTC') AS day,
                    SUM(CASE WHEN sentiment_label = 'positive' THEN 1 ELSE 0 END) AS positive,
                    SUM(CASE WHEN sentiment_label = 'neutral'  THEN 1 ELSE 0 END) AS neutral,
                    SUM(CASE WHEN sentiment_label = 'negative' THEN 1 ELSE 0 END) AS negative
                FROM conversation_events
                WHERE created_at >= now() - INTERVAL '30 days'
                GROUP BY day
                ORDER BY day DESC
            """))
        sentiment_trend: list[dict[str, Any]] = [
            {
                "date": str(row.day),
                "positive": int(row.positive),
                "neutral": int(row.neutral),
                "negative": int(row.negative),
            }
            for row in r.fetchall()
        ]

        # ── 5. Persona distribution ───────────────────────────────────────────
        r = await conn.execute(
            text(
                "SELECT persona_label, COUNT(*) AS cnt "
                "FROM conversation_events "
                "GROUP BY persona_label "
                "ORDER BY cnt DESC"
            )
        )
        persona_distribution: dict[str, int] = {
            row.persona_label: row.cnt for row in r.fetchall()
        }

        # ── 6. Average confidence ─────────────────────────────────────────────
        r = await conn.execute(text("SELECT AVG(confidence) FROM conversation_events"))
        avg_raw = r.scalar()
        avg_confidence: float = round(float(avg_raw), 4) if avg_raw is not None else 0.0

    logger.info(
        "dashboard_data | sessions=%d conversion=%.1f%% avg_conf=%.2f",
        total_sessions,
        conversion_rate * 100,
        avg_confidence,
    )

    return DashboardData(
        total_sessions=total_sessions,
        conversion_rate=conversion_rate,
        objection_distribution=objection_distribution,
        sentiment_trend=sentiment_trend,
        persona_distribution=persona_distribution,
        avg_confidence=avg_confidence,
    )
