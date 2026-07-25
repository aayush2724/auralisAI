"""
tests/test_api.py
─────────────────
Pytest suite for the FastAPI endpoints in src/api/main.py and src/api/routes/chat.py.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

import src.api.main

# Mock the database init so we don't connect to a real PostgreSQL on import/lifespan startup
with patch("src.api.main.init_db", new_callable=AsyncMock) as mock_startup_init, \
     patch("src.api.main.init_users_db", new_callable=AsyncMock), \
     patch("src.api.main.seed_admin", new_callable=AsyncMock), \
     patch("src.api.main.init_analytics_db", new_callable=AsyncMock):
    from src.api.main import app

# ─── Auth helpers ──────────────────────────────────────────────────────────────
from src.api.auth import User, create_access_token, get_current_user

_FAKE_ADMIN = User(id="00000000-0000-0000-0000-000000000001", email="admin@test.ai", role="admin")
_FAKE_SALES_REP = User(id="00000000-0000-0000-0000-000000000002", email="rep@test.ai", role="sales_rep")

# Override auth for the default client so existing tests pass without real JWT/DB
app.dependency_overrides[get_current_user] = lambda: _FAKE_ADMIN
client = TestClient(app)

# Separate client WITHOUT auth override for testing 401 responses
_no_auth_app = app  # same app instance, but we'll override per-test


# ─── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def get_auth_token() -> str:
    """Get an access token for the seeded admin user."""
    return create_access_token(
        data={
            "sub":   _FAKE_ADMIN.id,
            "email": _FAKE_ADMIN.email,
            "role":  _FAKE_ADMIN.role,
        }
    )


@pytest.fixture(scope="module")
def get_sales_rep_token() -> str:
    """Get an access token for a sales_rep user."""
    return create_access_token(
        data={
            "sub":   _FAKE_SALES_REP.id,
            "email": _FAKE_SALES_REP.email,
            "role":  _FAKE_SALES_REP.role,
        }
    )


# ─── Mock Data Generators ─────────────────────────────────────────────────────

def _mock_graph_state() -> dict[str, Any]:
    return {
        "user_input": "We use HubSpot.",
        "objection": {
            "label": "competitor",
            "confidence": 0.95,
            "all_scores": {"competitor": 0.95, "neutral": 0.05},
            "triggers": ["HubSpot"],
        },
        "sentiment": {
            "label": "neutral",
            "score": 0.80,
            "tone_instruction": "Stay professional.",
        },
        "persona": {
            "label": "CEO",
            "confidence": 0.90,
            "pitch_angle": "Focus on ROI and strategic moat.",
        },
        "retrieved_docs": [
            {
                "text": "HubSpot integration features...",
                "source_file": "hubspot.md",
                "chunk_index": 2,
                "score": 0.15,
            }
        ],
        "citations": "[1] HubSpot Comparison (hubspot.md, chunk 2)",
        "memory_context": "Customer context: tools=HubSpot.",
        "strategy": "competitor_strategy",
        "response": "Here is how we compare to HubSpot...",
        "confidence": 0.95,
        "should_handoff": False,
        "metadata": {"competitor_mentioned": "HubSpot"},
    }


def _mock_handoff_state() -> dict[str, Any]:
    state = _mock_graph_state()
    state["should_handoff"] = True
    state["handoff_trigger"] = "USER_REQUESTED"
    state["handoff_message"] = "Connecting you with a specialist now..."
    return state


def _mock_explanation() -> dict[str, Any]:
    return {
        "objection_reason": "Detected competitor objection (confidence 95%) because...",
        "persona_reason": "Identified CEO because of domain-specific framing...",
        "sentiment_reason": "Customer tone is measured...",
        "strategy_reason": "Applied competitor_strategy because...",
        "trigger_phrases": ["HubSpot"],
        "confidence_note": "",
        "handoff_reason": None,
    }


def _mock_handoff_explanation() -> dict[str, Any]:
    exp = _mock_explanation()
    exp["handoff_reason"] = "User explicitly requested a human agent."
    return exp


# ─── Health check tests ────────────────────────────────────────────────────────

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


# ─── POST /chat requires auth ──────────────────────────────────────────────────

def test_chat_requires_auth():
    """POST /chat should return 401 when no Authorization header is provided."""
    # Use a fresh app without auth override
    with patch("src.api.main.init_db", new_callable=AsyncMock), \
         patch("src.api.main.init_users_db", new_callable=AsyncMock), \
         patch("src.api.main.seed_admin", new_callable=AsyncMock), \
         patch("src.api.main.init_analytics_db", new_callable=AsyncMock):
        from fastapi import FastAPI
        from src.api.routes.chat import router as chat_router

        fresh_app = FastAPI()
        fresh_app.include_router(chat_router)
        fresh_client = TestClient(fresh_app, raise_server_exceptions=False)

        response = fresh_client.post(
            "/chat",
            json={"session_id": "test", "message": "hi"},
        )
        assert response.status_code == 401


# ─── POST /chat returns valid response shape ──────────────────────────────────

class TestPostChatEndpoint:
    @patch("src.api.routes.chat.ConversationMemory.from_session", new_callable=AsyncMock)
    @patch("src.api.routes.chat.run_graph")
    @patch("src.api.routes.chat.explain")
    @patch("src.api.routes.chat.save_session", new_callable=AsyncMock)
    @patch("src.api.routes.chat.log_event", new_callable=AsyncMock)
    @patch("src.api.routes.chat.assign_variant", new_callable=AsyncMock)
    def test_chat_returns_valid_shape(
        self, mock_variant, mock_log_event, mock_save, mock_explain, mock_run_graph, mock_from_session,
        get_auth_token: str,
    ):
        """POST /chat returns a ChatResponse with all expected fields."""
        mock_variant.return_value = "ADAPTIVE"

        mock_mem = MagicMock()
        mock_mem.get_context_string.return_value = "Customer context: tools=HubSpot."
        mock_mem.get_facts.return_value = {
            "company_name": None,
            "tools_mentioned": ["HubSpot"],
            "budget_signal": None,
            "objections_raised": [],
        }
        mock_from_session.return_value = mock_mem

        state = _mock_graph_state()
        mock_run_graph.return_value = state
        mock_explain.return_value = _mock_explanation()

        headers = {"Authorization": f"Bearer {get_auth_token}"}
        response = client.post(
            "/chat",
            json={"session_id": "test-123", "message": "Tell me about pricing"},
            headers=headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert "response" in body
        assert "objection_label" in body
        assert "confidence" in body
        assert "should_handoff" in body
        assert "explanation" in body

    @patch("src.api.routes.chat.ConversationMemory.from_session", new_callable=AsyncMock)
    @patch("src.api.routes.chat.run_graph")
    @patch("src.api.routes.chat.explain")
    @patch("src.api.routes.chat.save_session", new_callable=AsyncMock)
    @patch("src.api.routes.chat.log_event", new_callable=AsyncMock)
    @patch("src.api.routes.chat.assign_variant", new_callable=AsyncMock)
    def test_handoff_in_response(
        self, mock_variant, mock_log_event, mock_save, mock_explain, mock_run_graph, mock_from_session,
        get_auth_token: str,
    ):
        """When should_handoff=True, response text equals handoff_message."""
        mock_variant.return_value = "ADAPTIVE"

        mock_mem = MagicMock()
        mock_mem.get_context_string.return_value = ""
        mock_mem.get_facts.return_value = {
            "company_name": None,
            "tools_mentioned": [],
            "budget_signal": None,
            "objections_raised": [],
        }
        mock_from_session.return_value = mock_mem

        state = _mock_handoff_state()
        mock_run_graph.return_value = state
        mock_explain.return_value = _mock_handoff_explanation()

        headers = {"Authorization": f"Bearer {get_auth_token}"}
        response = client.post(
            "/chat",
            json={"session_id": "test-handoff", "message": "I want to talk to a real person"},
            headers=headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["should_handoff"] is True
        assert body["response"] == state["handoff_message"]

    def test_validation_missing_fields(self):
        response = client.post("/chat", json={"session_id": "session_123"})
        assert response.status_code == 422

        response = client.post("/chat", json={"message": "Hello"})
        assert response.status_code == 422

    def test_validation_empty_fields(self):
        response = client.post("/chat", json={"session_id": "session_123", "message": ""})
        assert response.status_code == 422

        response = client.post("/chat", json={"session_id": "   ", "message": "Hello"})
        assert response.status_code == 400
        assert "must be a non-empty string" in response.json()["detail"]

    @patch("src.api.routes.chat.ConversationMemory.from_session", side_effect=Exception("DB Down"))
    def test_internal_server_error_propagation(self, mock_from_session):
        payload = {"session_id": "session_123", "message": "Hello"}
        response = client.post("/chat", json=payload)
        assert response.status_code == 500
        assert "An error occurred while processing" in response.json()["detail"]


# ─── GET /session/{session_id} tests ───────────────────────────────────────────

class TestGetSessionEndpoint:
    @patch("src.api.routes.chat.load_session", new_callable=AsyncMock)
    def test_session_found(self, mock_load):
        mock_load.return_value = {
            "company_name": "Acme Corp",
            "persona_label": "CEO",
            "tools_mentioned": ["HubSpot", "Salesforce"],
            "objections_raised": [{"turn": 1, "label": "price", "confidence": 0.88}],
            "budget_signal": "$50k",
        }

        response = client.get("/session/session_123")
        assert response.status_code == 200
        json_data = response.json()
        assert json_data["session_id"] == "session_123"
        assert json_data["company_name"] == "Acme Corp"
        assert json_data["persona_label"] == "CEO"
        assert "HubSpot" in json_data["tools_mentioned"]
        assert len(json_data["objections_raised"]) == 1
        assert json_data["found"] is True

    @patch("src.api.routes.chat.load_session", new_callable=AsyncMock)
    def test_session_not_found(self, mock_load):
        mock_load.return_value = None

        response = client.get("/session/session_unknown")
        assert response.status_code == 200
        json_data = response.json()
        assert json_data["session_id"] == "session_unknown"
        assert json_data["found"] is False
        assert json_data["company_name"] is None

    def test_session_invalid_id(self):
        response = client.get("/session/%20")
        assert response.status_code == 400
        assert "must be a non-empty string" in response.json()["detail"]


# ─── Analytics endpoint role guard ─────────────────────────────────────────────

def test_analytics_endpoint_requires_admin(get_sales_rep_token: str):
    """GET /analytics/dashboard should return 403 for non-admin users."""
    # Create a client that uses the sales_rep token
    with patch("src.api.main.init_db", new_callable=AsyncMock), \
         patch("src.api.main.init_users_db", new_callable=AsyncMock), \
         patch("src.api.main.seed_admin", new_callable=AsyncMock), \
         patch("src.api.main.init_analytics_db", new_callable=AsyncMock):
        from fastapi import FastAPI
        from src.api.routes.analytics import router as analytics_router

        analytics_app = FastAPI()
        analytics_app.include_router(analytics_router)

        # Override auth to return sales_rep user
        analytics_app.dependency_overrides[get_current_user] = lambda: _FAKE_SALES_REP
        analytics_client = TestClient(analytics_app)

        response = analytics_client.get("/analytics/dashboard")
        assert response.status_code == 403
