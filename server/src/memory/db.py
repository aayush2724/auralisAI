"""
auralis/src/memory/db.py
─────────────────────────
Async PostgreSQL persistence layer for Auralis — Feature 10.

Uses SQLAlchemy 2.0 async engine + asyncpg driver.

Table: customer_sessions
─────────────────────────
  id             UUID PRIMARY KEY (server-generated)
  session_id     VARCHAR  — caller-supplied, e.g. user_id or conversation_id
  company_name   VARCHAR  — extracted by ConversationMemory
  persona_label  VARCHAR  — detected persona label
  objections_json JSONB   — list of {turn, label, confidence} dicts
  tools_json      JSONB   — list of tool names
  budget_signal  VARCHAR  — raw budget string
  created_at     TIMESTAMP WITH TIME ZONE
  updated_at     TIMESTAMP WITH TIME ZONE (auto-updated on UPSERT)

Public API
──────────
  async save_session(session_id: str, facts_dict: dict) -> None
  async load_session(session_id: str) -> dict | None
  async init_db() -> None   (creates table if not exists)
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

logger = logging.getLogger("auralis.memory.db")

# ─── Engine (lazy singleton) ──────────────────────────────────────────────────

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker | None = None


def _get_engine() -> AsyncEngine:
    global _engine, _session_factory
    if _engine is None:
        database_url = os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://auralis:changeme@localhost:5432/auralis",
        )
        if database_url.startswith("postgres://"):
            database_url = database_url.replace(
                "postgres://", "postgresql+asyncpg://", 1
            )
        elif database_url.startswith("postgresql://"):
            database_url = database_url.replace(
                "postgresql://", "postgresql+asyncpg://", 1
            )

        # Parse and filter out query parameters unsupported by asyncpg
        parsed = urlparse(database_url)
        query_params = parse_qsl(parsed.query)
        filtered_params = [
            (k, v) for k, v in query_params if k not in ("channel_binding", "sslmode")
        ]
        database_url = urlunparse(parsed._replace(query=urlencode(filtered_params)))

        _engine = create_async_engine(
            database_url,
            echo=False,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
        )
        _session_factory = async_sessionmaker(
            _engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        logger.info("Async DB engine created: %s", database_url.split("@")[-1])
    return _engine


# ─── DDL ─────────────────────────────────────────────────────────────────────

_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS customer_sessions (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      VARCHAR(255) NOT NULL UNIQUE,
    company_name    VARCHAR(255),
    persona_label   VARCHAR(64),
    objections_json JSONB        NOT NULL DEFAULT '[]',
    tools_json      JSONB        NOT NULL DEFAULT '[]',
    budget_signal   VARCHAR(128),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_session_id
    ON customer_sessions (session_id);
"""


async def init_db() -> None:
    """Create the customer_sessions table if it does not already exist."""
    engine = _get_engine()
    async with engine.begin() as conn:
        for stmt in _CREATE_TABLE_SQL.split(";"):
            if stmt.strip():
                await conn.execute(text(stmt))
    logger.info("customer_sessions table initialised.")


# ─── Public API ───────────────────────────────────────────────────────────────


async def save_session(session_id: str, facts_dict: dict[str, Any]) -> None:
    """
    Upsert session facts into customer_sessions.

    Parameters
    ----------
    session_id : Unique session identifier (e.g. user_id or conversation UUID).
    facts_dict : Output of ConversationMemory.get_facts().
    """
    _get_engine()  # ensure engine is initialised

    now = datetime.now(tz=timezone.utc)
    objections_json = json.dumps(facts_dict.get("objections_raised", []))
    tools_json = json.dumps(facts_dict.get("tools_mentioned", []))

    upsert_sql = text("""
        INSERT INTO customer_sessions
            (session_id, company_name, persona_label,
             objections_json, tools_json, budget_signal,
             created_at, updated_at)
        VALUES
            (:session_id, :company_name, :persona_label,
             CAST(:objections_json AS jsonb), CAST(:tools_json AS jsonb),
             :budget_signal, :now, :now)
        ON CONFLICT (session_id) DO UPDATE SET
            company_name    = EXCLUDED.company_name,
            persona_label   = EXCLUDED.persona_label,
            objections_json = EXCLUDED.objections_json,
            tools_json      = EXCLUDED.tools_json,
            budget_signal   = EXCLUDED.budget_signal,
            updated_at      = EXCLUDED.updated_at
    """)

    params = {
        "session_id": session_id,
        "company_name": facts_dict.get("company_name"),
        "persona_label": facts_dict.get("persona_label"),
        "objections_json": objections_json,
        "tools_json": tools_json,
        "budget_signal": facts_dict.get("budget_signal"),
        "now": now,
    }

    async with _session_factory() as session:  # type: ignore[misc]
        async with session.begin():
            await session.execute(upsert_sql, params)

    logger.debug("Session saved: %s", session_id)


async def load_session(session_id: str) -> dict[str, Any] | None:
    """
    Load persisted session facts for a given session_id.

    Returns
    -------
    dict with same shape as ConversationMemory.get_facts(), or None if not found.
    """
    _get_engine()

    select_sql = text("""
        SELECT company_name, persona_label, objections_json, tools_json, budget_signal
        FROM   customer_sessions
        WHERE  session_id = :session_id
        LIMIT  1
    """)

    async with _session_factory() as session:  # type: ignore[misc]
        result = await session.execute(select_sql, {"session_id": session_id})
        row = result.fetchone()

    if row is None:
        logger.debug("No session found for: %s", session_id)
        return None

    facts: dict[str, Any] = {
        "company_name": row.company_name,
        "persona_label": row.persona_label,
        "objections_raised": row.objections_json or [],
        "tools_mentioned": row.tools_json or [],
        "budget_signal": row.budget_signal,
    }
    logger.debug("Session loaded: %s | facts=%s", session_id, facts)
    return facts


async def delete_session(session_id: str) -> None:
    """Hard-delete a session row (useful in tests and GDPR deletion flows)."""
    _get_engine()
    delete_sql = text("DELETE FROM customer_sessions WHERE session_id = :sid")
    async with _session_factory() as session:  # type: ignore[misc]
        async with session.begin():
            await session.execute(delete_sql, {"sid": session_id})
    logger.debug("Session deleted: %s", session_id)
