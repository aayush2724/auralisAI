"""
auralis/src/api/routes/ab.py
─────────────────────────────
Route handlers for A/B testing endpoints.

GET /ab-test/results
  Returns aggregated A/B test metrics: conversion rates, average confidence,
  and session counts per variant.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from src.api.auth import User, require_roles
from src.memory.db import _get_engine

logger = logging.getLogger("auralis.api.ab")
router = APIRouter()


# ─── Response schema ──────────────────────────────────────────────────────────


class ABTestResultsResponse(BaseModel):
    """Aggregated A/B test metrics from conversation_events."""

    static_conversion_rate: float = Field(
        description="Conversion rate for STATIC variant."
    )
    adaptive_conversion_rate: float = Field(
        description="Conversion rate for ADAPTIVE variant."
    )
    static_avg_confidence: float = Field(
        description="Mean confidence for STATIC variant."
    )
    adaptive_avg_confidence: float = Field(
        description="Mean confidence for ADAPTIVE variant."
    )
    sessions_per_variant: dict[str, int] = Field(
        description="Distinct session count per variant.",
    )


# ─── GET /ab-test/results ────────────────────────────────────────────────────


@router.get(
    "/ab-test/results",
    response_model=ABTestResultsResponse,
    summary="Aggregated A/B test comparison metrics.",
    description=(
        "Returns side-by-side metrics for STATIC vs ADAPTIVE variants:\n"
        "- Conversion rate per variant (fraction of sessions with did_convert=True)\n"
        "- Average classifier confidence per variant\n"
        "- Number of distinct sessions per variant\n\n"
        "**Required role**: `admin`."
    ),
    responses={
        401: {"description": "Missing or invalid Bearer token."},
        403: {"description": "Insufficient role. Requires admin."},
        500: {"description": "Internal server error during aggregation."},
    },
)
async def ab_test_results(
    current_user: User = require_roles("admin"),
) -> ABTestResultsResponse:
    logger.info(
        "GET /ab-test/results | user=%s role=%s",
        current_user.email,
        current_user.role,
    )

    try:
        engine = _get_engine()
        async with engine.connect() as conn:
            # Per-variant session counts
            r = await conn.execute(
                text(
                    "SELECT variant, COUNT(DISTINCT session_id) AS cnt "
                    "FROM conversation_events "
                    "GROUP BY variant"
                )
            )
            sessions_per_variant: dict[str, int] = {"STATIC": 0, "ADAPTIVE": 0}
            for row in r.fetchall():
                sessions_per_variant[row.variant] = int(row.cnt)

            # Per-variant conversion rate
            r = await conn.execute(
                text(
                    "SELECT variant, "
                    "  COUNT(DISTINCT session_id) FILTER (WHERE did_convert) AS converting, "
                    "  COUNT(DISTINCT session_id) AS total "
                    "FROM conversation_events "
                    "GROUP BY variant"
                )
            )
            static_conv = 0.0
            adaptive_conv = 0.0
            for row in r.fetchall():
                rate = (row.converting / row.total) if row.total > 0 else 0.0
                if row.variant == "STATIC":
                    static_conv = round(rate, 4)
                else:
                    adaptive_conv = round(rate, 4)

            # Per-variant average confidence
            r = await conn.execute(
                text(
                    "SELECT variant, AVG(confidence) AS avg_conf "
                    "FROM conversation_events "
                    "GROUP BY variant"
                )
            )
            static_conf = 0.0
            adaptive_conf = 0.0
            for row in r.fetchall():
                val = float(row.avg_conf) if row.avg_conf is not None else 0.0
                if row.variant == "STATIC":
                    static_conf = round(val, 4)
                else:
                    adaptive_conf = round(val, 4)

        return ABTestResultsResponse(
            static_conversion_rate=static_conv,
            adaptive_conversion_rate=adaptive_conv,
            static_avg_confidence=static_conf,
            adaptive_avg_confidence=adaptive_conf,
            sessions_per_variant=sessions_per_variant,
        )

    except Exception as exc:
        logger.exception("Error in GET /ab-test/results")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while computing A/B test results: {exc}",
        )
