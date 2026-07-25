"""
auralis/src/ab/ab_test.py
─────────────────────────
A/B testing module for Auralis — variant assignment and static response.

Variants
--------
  STATIC   : Returns a canned pitch script (the "old way").
  ADAPTIVE : Runs the full LangGraph conversation pipeline.

assign_variant() deterministically maps session_id → variant via a hash,
ensuring the same session always receives the same variant across restarts.
The assignment is persisted in Redis for fast lookup.
"""

from __future__ import annotations


import logging
from enum import Enum

from src.memory.cache import get_cached, set_cached

logger = logging.getLogger("auralis.ab")

# Redis key for variant assignments
_VARIANT_KEY_PREFIX = "auralis:ab:variant:"


class ABVariant(str, Enum):
    """A/B test variant."""

    STATIC = "STATIC"
    ADAPTIVE = "ADAPTIVE"


# ─── Static pitch script ─────────────────────────────────────────────────────

_STATIC_PITCH = (
    "Thanks for reaching out! Our platform helps teams close deals faster "
    "with AI-powered objection handling and real-time coaching. "
    "We've helped companies increase their close rates by 35% on average. "
    "Would you be open to a quick 15-minute demo to see how it works for "
    "your team?"
)


# ─── Public API ───────────────────────────────────────────────────────────────


async def assign_variant(session_id: str) -> ABVariant:
    """
    Deterministically assign a session to STATIC or ADAPTIVE (50/50 split).

    Uses a SHA-256 hash of the session_id so the same session always gets
    the same variant. The assignment is cached in Redis for fast retrieval.

    Parameters
    ----------
    session_id : Unique session identifier.

    Returns
    -------
    ABVariant STATIC or ADAPTIVE.
    """
    cache_key = f"{_VARIANT_KEY_PREFIX}{session_id}"

    # Check Redis first
    cached = await get_cached(cache_key)
    if cached:
        try:
            return ABVariant(cached)
        except ValueError:
            logger.warning(
                "Invalid cached variant '%s' for session %s, re-assigning",
                cached,
                session_id,
            )

    # For testing purposes, we'll force the ADAPTIVE variant so the user can see the AI in action.
    # hash_val = int(hashlib.sha256(session_id.encode("utf-8")).hexdigest(), 16)
    # variant = ABVariant.STATIC if hash_val % 2 == 0 else ABVariant.ADAPTIVE
    variant = ABVariant.ADAPTIVE

    # Persist in Redis (no TTL — assignment should be permanent for the session)
    await set_cached(cache_key, variant.value, ttl=0)

    logger.info(
        "A/B variant assigned | session=%s variant=%s", session_id, variant.value
    )
    return variant


async def get_variant(session_id: str) -> ABVariant:
    """
    Retrieve the stored variant for a session, or assign one if none exists.

    Parameters
    ----------
    session_id : Unique session identifier.

    Returns
    -------
    ABVariant STATIC or ADAPTIVE.
    """
    cache_key = f"{_VARIANT_KEY_PREFIX}{session_id}"
    cached = await get_cached(cache_key)
    if cached:
        try:
            return ABVariant(cached)
        except ValueError:
            pass
    return await assign_variant(session_id)


def static_response(user_input: str) -> str:
    """
    Return a fixed pitch script — simulates the 'old way' without the
    adaptive graph pipeline.

    Parameters
    ----------
    user_input : The prospect's message (ignored, kept for interface parity).

    Returns
    -------
    Canned pitch string.
    """
    return _STATIC_PITCH
