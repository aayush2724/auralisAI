"""
auralis/src/memory/memory.py
─────────────────────────────
ConversationMemory — session-scoped conversation state for Auralis.

Responsibilities
----------------
1. Store every turn as a Message(role, content, metadata).
2. Automatically extract key facts from each user utterance:
     - company_name   : matched from "We use X", "at CompanyName", "I'm from X" etc.
     - tools_mentioned: known SaaS tools found anywhere in the text.
     - budget_signal  : any dollar-amount pattern (e.g. "$50k", "$1,200").
     - objections_raised: list of {turn, label, confidence} dicts built from
                          objection-classifier metadata passed via add().
3. Expose a context string injected into every generation prompt (Feature 1).
4. Persist / reload facts from PostgreSQL across conversations (Feature 10).

Usage (new session)
-------------------
    mem = ConversationMemory(session_id="user_42")
    mem.add("user", "We use Salesforce at Acme Corp.", metadata={"objection": result})

Usage (resume existing session)
--------------------------------
    mem = await ConversationMemory.from_session("user_42")

Public API
----------
    add(role, content, metadata)  -> None
    get_context_string()          -> str
    get_facts()                   -> dict
    clear()                       -> None
    async from_session(session_id) -> ConversationMemory  [classmethod]
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field
from typing import Any

# ─── Logging ──────────────────────────────────────────────────────────────────

logger = logging.getLogger("auralis.memory")

# ─── Known SaaS tools (Feature 1 — context enrichment) ───────────────────────
# Extend this list freely; matching is case-insensitive, whole-word.

KNOWN_TOOLS: list[str] = [
    "Salesforce",
    "HubSpot",
    "Pipedrive",
    "Zoho",
    "Zendesk",
    "Monday",
    "Notion",
    "Slack",
    "Intercom",
    "Drift",
    "Outreach",
    "Gong",
    "Chorus",
    "Marketo",
    "Pardot",
    "Freshsales",
    "Copper",
    "Close",
    "Streak",
    "ActiveCampaign",
    "Klaviyo",
    "Mailchimp",
    "Segment",
    "Mixpanel",
    "Amplitude",
    "Jira",
    "Linear",
    "Asana",
    "Trello",
    "ClickUp",
    "Figma",
    "Miro",
    "Loom",
    "Calendly",
    "Typeform",
    "Snowflake",
    "Databricks",
    "dbt",
    "Tableau",
    "Looker",
    "AWS",
    "Azure",
    "GCP",
    "Heroku",
    "Vercel",
    "GitHub",
    "GitLab",
    "Bitbucket",
    "Jenkins",
    "CircleCI",
    "Twilio",
    "Stripe",
    "Braintree",
    "Plaid",
    "Okta",
    "Microsoft Teams",
    "Google Workspace",
    "Dropbox",
    "Box",
]

# Pre-compile tool patterns once at import time
_TOOL_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (tool, re.compile(rf"\b{re.escape(tool)}\b", re.IGNORECASE)) for tool in KNOWN_TOOLS
]

# ─── Fact-extraction regexes ──────────────────────────────────────────────────

# Company name patterns — capture group 1 is the company name
_COMPANY_PATTERNS: list[re.Pattern[str]] = [
    # "at Acme Corp" / "at Acme"
    re.compile(r"\bat\s+([A-Z][A-Za-z0-9&\s\-'\.]{1,40}?)(?:\s*[,\.]|$)", re.MULTILINE),
    # "I work at / I'm at / work for"
    re.compile(
        r"(?:I work at|I'm at|working at|work for)\s+([A-Z][A-Za-z0-9&\s\-'\.]{1,40})(?:\s*[,\.]|$)",
        re.MULTILINE,
    ),
    # "from Acme Corp" / "from Acme"
    re.compile(
        r"\bfrom\s+([A-Z][A-Za-z0-9&\s\-'\.]{1,40})(?:\s*[,\.]|$)", re.MULTILINE
    ),
    # "our company is Acme" / "our company, Acme,"
    re.compile(
        r"(?:our company(?:\s+is)?[,\s]+)([A-Z][A-Za-z0-9&\s\-'\.]{1,40})(?:\s*[,\.]|$)",
        re.MULTILINE,
    ),
    # "we are Acme" at start of sentence
    re.compile(
        r"(?:we are|we're)\s+([A-Z][A-Za-z0-9&\s\-'\.]{1,30})(?:\s*[,\.]|$)",
        re.MULTILINE,
    ),
]

# Budget signal — "$50k", "$1,200", "$2M", "50 000 dollars", etc.
_BUDGET_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\$\s?[\d,]+(?:\.\d+)?(?:\s?[kKmMbB])?", re.IGNORECASE),
    re.compile(
        r"\b[\d,]+(?:\.\d+)?\s?(?:k|thousand|million|m)\s?(?:dollars?|usd|budget)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bbudget(?:\s+of)?\s+[\$£€]?\s?[\d,]+(?:\.\d+)?(?:\s?[kKmMbB])?\b",
        re.IGNORECASE,
    ),
]


# ─── Data model ───────────────────────────────────────────────────────────────


@dataclass
class Message:
    """A single conversation turn."""

    role: str  # "user" | "assistant" | "system"
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)
    turn: int = 0  # set by ConversationMemory.add()


# ─── Fact extraction helpers ──────────────────────────────────────────────────


def _extract_company(text: str) -> str | None:
    """Return the first company name found in *text*, or None."""
    for pattern in _COMPANY_PATTERNS:
        match = pattern.search(text)
        if match:
            name = match.group(1).strip().rstrip(".,")
            # Sanity check: ignore very short matches or all-lowercase (likely not a proper noun)
            if len(name) >= 2 and name[0].isupper():
                return name
    return None


def _extract_tools(text: str) -> list[str]:
    """Return unique tool names found in *text* (preserving canonical casing)."""
    found: list[str] = []
    for tool_name, pattern in _TOOL_PATTERNS:
        if pattern.search(text):
            found.append(tool_name)
    return found


def _extract_budget(text: str) -> str | None:
    """Return the first budget signal string found in *text*, or None."""
    for pattern in _BUDGET_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(0).strip()
    return None


# ─── ConversationMemory ───────────────────────────────────────────────────────


class ConversationMemory:
    """
    Session-scoped conversation state for Auralis.

    Parameters
    ----------
    session_id : Optional unique identifier for this session.
                 When provided, facts are persisted to PostgreSQL on every
                 user turn and can be reloaded across conversations (Feature 10).

    Thread-safety
    -------------
    Not thread-safe by default. Instantiate one per session/request.
    """

    def __init__(self, session_id: str | None = None) -> None:
        self._session_id: str | None = session_id
        self._messages: list[Message] = []
        self._facts: dict[str, Any] = {
            "company_name": None,
            "tools_mentioned": [],
            "budget_signal": None,
            "objections_raised": [],
        }

    # ── Core API ──────────────────────────────────────────────────────────────

    def add(
        self,
        role: str,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """
        Append a message and (for user turns) update extracted facts.

        After updating facts, schedules an async DB persist if a session_id
        is set and an asyncio event loop is running (Feature 10).

        Parameters
        ----------
        role     : "user" | "assistant" | "system"
        content  : The message text.
        metadata : Optional dict; may include an 'objection' key whose value
                   is an ObjectionResult TypedDict (from the classifier).
        """
        if not content or not content.strip():
            logger.warning(
                "add() called with empty content for role=%s — skipping.", role
            )
            return

        metadata = metadata or {}
        turn = len(self._messages) + 1
        msg = Message(role=role, content=content.strip(), metadata=metadata, turn=turn)
        self._messages.append(msg)

        if role == "user":
            self._update_facts(msg)
            self._schedule_persist()

        logger.debug("Memory | turn=%d role=%s | facts=%s", turn, role, self._facts)

    def get_context_string(self) -> str:
        """
        Return a compact context summary for injection into generation prompts.

        Format (Feature 1)
        ------------------
        Customer context: company=Acme Corp | tools=Salesforce, HubSpot |
        budget=~$50k | raised price objection (turn 2, conf 0.91),
        trust objection (turn 4, conf 0.78).

        Returns empty string if no facts have been collected yet.
        """
        facts = self._facts
        parts: list[str] = []

        if facts["company_name"]:
            parts.append(f"company={facts['company_name']}")

        if facts["tools_mentioned"]:
            tools_str = ", ".join(facts["tools_mentioned"])
            parts.append(f"tools={tools_str}")

        if facts["budget_signal"]:
            parts.append(f"budget=~{facts['budget_signal']}")

        if facts["objections_raised"]:
            obj_parts: list[str] = []
            for obj in facts["objections_raised"]:
                obj_parts.append(
                    f"{obj['label']} objection (turn {obj['turn']}, conf {obj['confidence']:.2f})"
                )
            parts.append(f"raised {', '.join(obj_parts)}")

        if not parts:
            return ""

        return "Customer context: " + " | ".join(parts) + "."

    def get_facts(self) -> dict[str, Any]:
        """
        Return a copy of all extracted facts.

        Returns
        -------
        dict with keys: company_name, tools_mentioned, budget_signal,
        objections_raised.
        """
        return {
            "company_name": self._facts["company_name"],
            "tools_mentioned": list(self._facts["tools_mentioned"]),
            "budget_signal": self._facts["budget_signal"],
            "objections_raised": [dict(o) for o in self._facts["objections_raised"]],
        }

    def get_messages(self) -> list[Message]:
        """Return a shallow copy of the message list."""
        return list(self._messages)

    def clear(self) -> None:
        """Reset all messages and extracted facts (does NOT delete DB record)."""
        self._messages.clear()
        self._facts = {
            "company_name": None,
            "tools_mentioned": [],
            "budget_signal": None,
            "objections_raised": [],
        }
        logger.debug("Memory cleared (session_id=%s).", self._session_id)

    # ── Async persistence (Feature 10) ────────────────────────────────────────

    def _schedule_persist(self) -> None:
        """
        Fire-and-forget: schedule _persist() as an asyncio background task.
        Silently skips if no session_id is set or no event loop is running.
        """
        if not self._session_id:
            return
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._persist())
        except RuntimeError:
            # No running event loop (e.g. sync test context) — skip silently.
            logger.debug("No event loop running — skipping DB persist.")

    async def _persist(self) -> None:
        """Async write of current facts to PostgreSQL via db.save_session()."""
        if not self._session_id:
            return
        try:
            from src.memory.db import save_session  # late import avoids circular dep

            facts = self.get_facts()
            # Persist detected persona if available in latest user message
            if self._messages:
                last_user = next(
                    (m for m in reversed(self._messages) if m.role == "user"), None
                )
                if last_user and last_user.metadata.get("persona"):
                    facts["persona_label"] = last_user.metadata["persona"].get("label")
            await save_session(self._session_id, facts)
            logger.debug("Session persisted: %s", self._session_id)
        except Exception as exc:
            logger.warning(
                "DB persist failed for session %s: %s", self._session_id, exc
            )

    @classmethod
    async def from_session(cls, session_id: str) -> "ConversationMemory":
        """
        Create a ConversationMemory pre-loaded with facts from PostgreSQL.

        If no session exists for *session_id*, returns a fresh empty instance.
        This enables cross-conversation memory of every customer (Feature 10).

        Parameters
        ----------
        session_id : The session/user identifier to look up.

        Returns
        -------
        ConversationMemory with _facts populated from the DB (if found).
        """
        instance = cls(session_id=session_id)
        try:
            from src.memory.db import load_session  # late import

            stored = await load_session(session_id)
            if stored:
                instance._facts["company_name"] = stored.get("company_name")
                instance._facts["tools_mentioned"] = stored.get("tools_mentioned") or []
                instance._facts["budget_signal"] = stored.get("budget_signal")
                instance._facts["objections_raised"] = (
                    stored.get("objections_raised") or []
                )
                logger.info(
                    "Loaded session %s from DB: company=%s tools=%s",
                    session_id,
                    stored.get("company_name"),
                    stored.get("tools_mentioned"),
                )
        except Exception as exc:
            logger.warning(
                "DB load failed for session %s: %s — starting fresh.", session_id, exc
            )
        return instance

    # ── Fact extraction (private) ─────────────────────────────────────────────

    def _update_facts(self, msg: Message) -> None:
        """Run all extractors against a user message and merge results."""
        text = msg.content

        # Company name — keep the first one found; don't overwrite with a later one
        if not self._facts["company_name"]:
            company = _extract_company(text)
            if company:
                self._facts["company_name"] = company
                logger.debug("Extracted company: %s", company)

        # Tools — union across all turns
        new_tools = _extract_tools(text)
        for tool in new_tools:
            if tool not in self._facts["tools_mentioned"]:
                self._facts["tools_mentioned"].append(tool)

        # Budget signal — keep the first concrete signal
        if not self._facts["budget_signal"]:
            budget = _extract_budget(text)
            if budget:
                self._facts["budget_signal"] = budget
                logger.debug("Extracted budget: %s", budget)

        # Objection — read from metadata if the caller already ran the classifier
        objection = msg.metadata.get("objection")
        if objection and isinstance(objection, dict):
            label = objection.get("label", "")
            confidence = objection.get("confidence", 0.0)
            if label and label != "neutral":
                self._facts["objections_raised"].append(
                    {
                        "turn": msg.turn,
                        "label": label,
                        "confidence": float(confidence),
                    }
                )
                logger.debug(
                    "Recorded objection: %s (conf=%.2f, turn=%d)",
                    label,
                    confidence,
                    msg.turn,
                )

    # ── Dunder helpers ────────────────────────────────────────────────────────

    def __len__(self) -> int:
        return len(self._messages)

    def __repr__(self) -> str:
        return (
            f"ConversationMemory("
            f"session_id={self._session_id!r}, "
            f"turns={len(self._messages)}, "
            f"facts={self._facts!r})"
        )
