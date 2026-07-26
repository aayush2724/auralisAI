import asyncio
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger("auralis.utils.webhooks")


async def fire_webhooks(session_id: str, state: dict[str, Any], user_email: str | None = None) -> None:
    """
    Asynchronously fire webhooks to Slack and/or CRM endpoints when a conversion
    or handoff event is triggered.
    """
    slack_url = os.environ.get("SLACK_WEBHOOK_URL")
    crm_url = os.environ.get("CRM_WEBHOOK_URL")

    if not slack_url and not crm_url:
        logger.debug("No webhook URLs configured (SLACK_WEBHOOK_URL / CRM_WEBHOOK_URL). Skipping.")
        return

    objection = state.get("objection", {}).get("label", "neutral")
    persona = state.get("persona", {}).get("label", "Unknown")
    sentiment = state.get("sentiment", {}).get("label", "neutral")
    trigger = state.get("handoff_trigger", "Handoff threshold met")

    payload = {
        "event": "lead_handoff",
        "session_id": session_id,
        "user_email": user_email,
        "objection": objection,
        "persona": persona,
        "sentiment": sentiment,
        "trigger": trigger,
        "user_input": state.get("user_input", ""),
        "response": state.get("response", ""),
    }

    slack_payload = {
        "text": f"🚀 *Auralis Lead Handoff Triggered!*\n"
                f"• *Session*: `{session_id}`\n"
                f"• *User*: {user_email or 'Anonymous'}\n"
                f"• *Persona*: {persona}\n"
                f"• *Objection*: {objection}\n"
                f"• *Trigger*: _{trigger}_"
    }

    async with httpx.AsyncClient(timeout=5.0) as client:
        tasks = []
        if slack_url:
            tasks.append(client.post(slack_url, json=slack_payload))
        if crm_url:
            tasks.append(client.post(crm_url, json=payload))

        if tasks:
            logger.info("Firing %d webhook request(s) for session %s", len(tasks), session_id)
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for res in results:
                if isinstance(res, Exception):
                    logger.error("Error delivering webhook: %s", res)
                elif res.status_code >= 400:
                    logger.warning("Webhook endpoint returned status %d: %s", res.status_code, res.text)
