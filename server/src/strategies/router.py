"""
auralis/src/strategies/router.py
──────────────────────────────────
Strategy router — maps objection.label → strategy module.

Each strategy module exposes:
    build_prompt(state: GraphState) -> str

Usage
-----
    from src.strategies.router import get_strategy_prompt
    prompt = get_strategy_prompt(state)

Design
------
The router is a pure dispatch table (dict of callables).
Adding a new strategy requires only:
  1. Creating src/strategies/my_strategy.py with build_prompt().
  2. Inserting one line into _STRATEGY_REGISTRY below.
"""

from __future__ import annotations

import logging
from typing import Callable

from src.graph.graph import GraphState
from src.strategies import (
    buying_signal_strategy,
    competitor_strategy,
    fit_strategy,
    price_strategy,
    timing_strategy,
    trust_strategy,
)

logger = logging.getLogger("auralis.strategies.router")

# ─── Registry ─────────────────────────────────────────────────────────────────
# Maps every objection label to the build_prompt callable of its strategy.
# "neutral" falls through to the discovery fallback (same as fit).

_STRATEGY_REGISTRY: dict[str, Callable[[GraphState], str]] = {
    "price": price_strategy.build_prompt,
    "trust": trust_strategy.build_prompt,
    "timing": timing_strategy.build_prompt,
    "competitor": competitor_strategy.build_prompt,
    "fit": fit_strategy.build_prompt,
    "buying_signal": buying_signal_strategy.build_prompt,
    "neutral": fit_strategy.build_prompt,  # discovery fallback
}

# ─── Public API ───────────────────────────────────────────────────────────────


def get_strategy_prompt(state: GraphState) -> str:
    """
    Dispatch to the correct strategy and return the rendered prompt string.

    Parameters
    ----------
    state : Full GraphState after classify_node and retrieve_node have run.

    Returns
    -------
    Rendered prompt string ready to be sent to the LLM.

    Notes
    -----
    Falls back to fit_strategy (discovery questions) for any unknown label,
    which is the safest option when the classifier is uncertain.
    """
    obj_label = (state.get("objection") or {}).get("label", "neutral")
    build_fn = _STRATEGY_REGISTRY.get(obj_label)

    if build_fn is None:
        logger.warning(
            "[router] Unknown objection label '%s' — falling back to fit/discovery.",
            obj_label,
        )
        build_fn = fit_strategy.build_prompt

    logger.info("[router] label=%s → %s", obj_label, build_fn.__module__)
    return build_fn(state)


def list_strategies() -> list[str]:
    """Return the list of registered objection labels."""
    return list(_STRATEGY_REGISTRY.keys())
