"""
auralis/src/memory/cache.py
────────────────────────────
Async Redis cache layer for Auralis — Feature 10.

Uses redis-py async client (redis.asyncio).

Default TTL: 300 seconds (5 minutes).
Key convention: callers are responsible for namespacing keys,
e.g. "auralis:session:{session_id}:response".

Public API
──────────
  async get_cached(key: str) -> str | None
  async set_cached(key: str, value: str, ttl: int = 300) -> None
  async delete_cached(key: str) -> None
  async flush_prefix(prefix: str) -> int   (returns count of deleted keys)
"""

from __future__ import annotations

import logging
import os

import redis.asyncio as aioredis

logger = logging.getLogger("auralis.memory.cache")

# ─── Client (lazy singleton) ──────────────────────────────────────────────────

_client: aioredis.Redis | None = None


def _get_client() -> aioredis.Redis:
    global _client
    if _client is None:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _client = aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        logger.info("Redis async client created: %s", redis_url)
    return _client


# ─── Public API ───────────────────────────────────────────────────────────────


async def get_cached(key: str) -> str | None:
    """
    Retrieve a cached string value.

    Parameters
    ----------
    key : Redis key.

    Returns
    -------
    Cached string or None if missing / expired.
    """
    try:
        client = _get_client()
        value: str | None = await client.get(key)
        logger.debug("cache GET %s → %s", key, "HIT" if value else "MISS")
        return value
    except Exception as exc:
        logger.warning("Redis GET failed for key '%s': %s", key, exc)
        return None


async def set_cached(key: str, value: str, ttl: int = 300) -> None:
    """
    Store a string value in Redis with an expiry.

    Parameters
    ----------
    key   : Redis key.
    value : String to store (callers should JSON-serialise complex objects).
    ttl   : Time-to-live in seconds (default 300 = 5 minutes).
    """
    try:
        client = _get_client()
        if ttl == 0:
            await client.set(key, value)
        else:
            await client.set(key, value, ex=ttl)
        logger.debug("cache SET %s (ttl=%ds)", key, ttl)
    except Exception as exc:
        logger.warning("Redis SET failed for key '%s': %s", key, exc)


async def delete_cached(key: str) -> None:
    """Remove a specific key from the cache."""
    try:
        client = _get_client()
        await client.delete(key)
        logger.debug("cache DEL %s", key)
    except Exception as exc:
        logger.warning("Redis DEL failed for key '%s': %s", key, exc)


async def flush_prefix(prefix: str) -> int:
    """
    Delete all keys matching a prefix pattern.

    Uses SCAN to avoid blocking the Redis server.

    Returns
    -------
    Number of keys deleted.
    """
    deleted = 0
    try:
        client = _get_client()
        async for key in client.scan_iter(f"{prefix}*"):
            await client.delete(key)
            deleted += 1
        logger.info("Flushed %d key(s) with prefix '%s'", deleted, prefix)
    except Exception as exc:
        logger.warning("Redis flush_prefix failed for '%s': %s", prefix, exc)
    return deleted
