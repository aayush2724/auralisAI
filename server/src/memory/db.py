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
from datetime import UTC, datetime
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
    user_id         VARCHAR(320),
    company_name    VARCHAR(255),
    persona_label   VARCHAR(64),
    objections_json JSONB        NOT NULL DEFAULT '[]',
    tools_json      JSONB        NOT NULL DEFAULT '[]',
    budget_signal   VARCHAR(128),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE customer_sessions ADD COLUMN IF NOT EXISTS user_id VARCHAR(320);
ALTER TABLE customer_sessions ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(64) DEFAULT 'default_tenant';
ALTER TABLE customer_sessions ADD COLUMN IF NOT EXISTS messages_json JSONB NOT NULL DEFAULT '[]';

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

    from src.rag.kb_store import init_kb_db

    await init_kb_db()


# ─── Public API ───────────────────────────────────────────────────────────────


async def save_session(
    session_id: str,
    facts_dict: dict[str, Any],
    owner_id: str | None = None,
    workspace_id: str = "default_tenant",
    messages: list[dict[str, Any]] | None = None,
) -> None:
    """
    Upsert session facts into customer_sessions.

    Parameters
    ----------
    session_id : Unique session identifier (e.g. user_id or conversation UUID).
    facts_dict : Output of ConversationMemory.get_facts().
    owner_id   : The user ID that owns this session.
    """
    _get_engine()  # ensure engine is initialised

    now = datetime.now(tz=UTC)
    objections_json = json.dumps(facts_dict.get("objections_raised", []))
    tools_json = json.dumps(facts_dict.get("tools_mentioned", []))
    messages_json = json.dumps(messages or [])

    upsert_sql = text("""
        INSERT INTO customer_sessions
            (session_id, user_id, workspace_id, company_name, persona_label,
             objections_json, tools_json, budget_signal, messages_json,
             created_at, updated_at)
        VALUES
            (:session_id, :user_id, :workspace_id, :company_name, :persona_label,
             CAST(:objections_json AS jsonb), CAST(:tools_json AS jsonb),
             :budget_signal, CAST(:messages_json AS jsonb), :now, :now)
        ON CONFLICT (session_id) DO UPDATE SET
            user_id         = COALESCE(customer_sessions.user_id, EXCLUDED.user_id),
            workspace_id    = EXCLUDED.workspace_id,
            company_name    = EXCLUDED.company_name,
            persona_label   = EXCLUDED.persona_label,
            objections_json = EXCLUDED.objections_json,
            tools_json      = EXCLUDED.tools_json,
            budget_signal   = EXCLUDED.budget_signal,
            messages_json   = EXCLUDED.messages_json,
            updated_at      = EXCLUDED.updated_at
    """)

    params = {
        "session_id": session_id,
        "user_id": owner_id,
        "workspace_id": workspace_id,
        "company_name": facts_dict.get("company_name"),
        "persona_label": facts_dict.get("persona_label"),
        "objections_json": objections_json,
        "tools_json": tools_json,
        "budget_signal": facts_dict.get("budget_signal"),
        "messages_json": messages_json,
        "now": now,
    }

    async with _session_factory() as session, session.begin():  # type: ignore[misc]
        await session.execute(upsert_sql, params)

    logger.debug("Session saved: %s", session_id)


async def load_session(
    session_id: str, owner_id: str | None = None, workspace_id: str | None = None
) -> dict[str, Any] | None:
    """
    Load persisted session facts for a given session_id.

    Returns
    -------
    dict with same shape as ConversationMemory.get_facts(), or None if not found.
    Raises PermissionError if the session belongs to a different owner.
    """
    _get_engine()

    select_sql = text("""
        SELECT user_id, workspace_id, company_name, persona_label, objections_json, tools_json, budget_signal, messages_json
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

    if workspace_id and row.workspace_id and row.workspace_id != workspace_id:
        raise PermissionError(
            "Access denied: session belongs to a different workspace."
        )

    if owner_id and row.user_id and row.user_id != owner_id:
        raise PermissionError("This session belongs to a different user.")

    facts: dict[str, Any] = {
        "company_name": row.company_name,
        "persona_label": row.persona_label,
        "objections_raised": row.objections_json or [],
        "tools_mentioned": row.tools_json or [],
        "budget_signal": row.budget_signal,
        "messages": row.messages_json or [],
    }
    logger.debug("Session loaded: %s | facts=%s", session_id, facts)
    return facts


async def list_sessions(owner_id: str, workspace_id: str) -> list[dict[str, Any]]:
    """List all sessions belonging to owner_id and workspace_id."""
    _get_engine()
    select_sql = text("""
        SELECT session_id, company_name, persona_label, updated_at, messages_json
        FROM   customer_sessions
        WHERE  user_id = :owner_id AND workspace_id = :workspace_id
        ORDER BY updated_at DESC
    """)
    async with _session_factory() as session:  # type: ignore[misc]
        result = await session.execute(
            select_sql, {"owner_id": owner_id, "workspace_id": workspace_id}
        )
        rows = result.fetchall()

    res = []
    for row in rows:
        title = row.company_name
        preview = "No messages yet"
        if row.messages_json and len(row.messages_json) > 0:
            msgs = row.messages_json
            # Use first user message as the conversation title if no company name
            first_user = next((m for m in msgs if m.get("role") == "user"), None)
            if first_user and not title:
                first_content = first_user.get("content", "")
                title = first_content[:60] + ("..." if len(first_content) > 60 else "")
            # Use last user message as preview
            last_user = next(
                (m for m in reversed(msgs) if m.get("role") == "user"), None
            )
            if last_user:
                last_content = last_user.get("content", "")
                preview = last_content[:120] + (
                    "..." if len(last_content) > 120 else ""
                )
        res.append(
            {
                "session_id": row.session_id,
                "company_name": title,
                "persona_label": row.persona_label,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
                "preview": preview,
            }
        )
    return res


async def delete_session(session_id: str) -> None:
    """Hard-delete a session row (useful in tests and GDPR deletion flows)."""
    _get_engine()
    delete_sql = text("DELETE FROM customer_sessions WHERE session_id = :sid")
    async with _session_factory() as session, session.begin():  # type: ignore[misc]
        await session.execute(delete_sql, {"sid": session_id})
    logger.debug("Session deleted: %s", session_id)
