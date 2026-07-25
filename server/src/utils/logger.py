"""
auralis/src/utils/logger.py
───────────────────────────
Structured JSON logging, request log schema, and Prometheus counters for Auralis.
"""

from __future__ import annotations

import logging
import sys
from typing import TypedDict

import structlog
from prometheus_client import Counter


def _setup_structlog() -> None:
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.BoundLogger:
    _setup_structlog()
    return structlog.get_logger(name)


class RequestLog(TypedDict, total=False):
    session_id: str
    user_input_length: int
    objection_label: str
    objection_confidence: float
    sentiment_label: str
    persona_label: str
    strategy_chosen: str
    response_length: int
    latency_ms: float
    should_handoff: bool
    handoff_trigger: str | None


def log_request(data: RequestLog) -> None:
    logger = get_logger("auralis.request")
    logger.info("chat_request", **data)


# ─── Prometheus counters ──────────────────────────────────────────────────────

auralis_handoffs_total = Counter(
    "auralis_handoffs_total",
    "Total handoff escalations",
    ["trigger"],
)

auralis_objections_total = Counter(
    "auralis_objections_total",
    "Total objection classifications",
    ["objection_label"],
)
