"""
auralis/src/api/routes/analytics.py
─────────────────────────────────────
GET /analytics/dashboard — admin-only aggregated analytics endpoint.

Returns a DashboardData snapshot aggregated from the conversation_events
table by src.analytics.tracker.get_dashboard_data().

Authorization
-------------
  GET /analytics/dashboard   → requires role: admin
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

from src.analytics.tracker import get_dashboard_data
from src.api.auth import User, require_roles
from src.api.schemas import DashboardResponse, SentimentDaySnapshot

logger = logging.getLogger("auralis.api.analytics")
router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    summary="Aggregated conversation analytics dashboard.",
    description=(
        "Returns a real-time snapshot of all conversation events recorded in "
        "PostgreSQL.\n\n"
        "**Required role**: `admin`.\n\n"
        "**Fields**\n\n"
        "| Field | Description |\n"
        "|-------|-------------|\n"
        "| `total_sessions` | Distinct sessions ever recorded |\n"
        "| `conversion_rate` | Sessions with ≥1 conversion / total (0–1) |\n"
        "| `objection_distribution` | Objection label → event count |\n"
        "| `sentiment_trend` | Daily sentiment counts, last 30 days (newest first) |\n"
        "| `persona_distribution` | Persona label → event count |\n"
        "| `avg_confidence` | Mean objection classifier confidence (0–1) |\n"
    ),
    responses={
        401: {"description": "Missing or invalid Bearer token."},
        403: {"description": "Insufficient role. Requires admin."},
        500: {"description": "Internal server error during DB aggregation."},
    },
)
async def get_dashboard(
    current_user: User = require_roles("admin"),
) -> DashboardResponse:
    logger.info("GET /analytics/dashboard | user=%s", current_user.email)

    data = await get_dashboard_data()

    # Convert the raw list[dict] sentiment_trend to typed SentimentDaySnapshot models.
    sentiment_trend = [
        SentimentDaySnapshot(
            date=entry["date"],
            positive=entry["positive"],
            neutral=entry["neutral"],
            negative=entry["negative"],
        )
        for entry in data["sentiment_trend"]
    ]

    return DashboardResponse(
        total_sessions=data["total_sessions"],
        conversion_rate=data["conversion_rate"],
        objection_distribution=data["objection_distribution"],
        sentiment_trend=sentiment_trend,
        persona_distribution=data["persona_distribution"],
        avg_confidence=data["avg_confidence"],
    )
