"""
auralis/src/api/main.py
─────────────────────────
FastAPI application entry-point for Auralis.

Routes
------
  POST /auth/token            → issue JWT (public, no auth required)
  POST /chat                  → chat handler          (requires: sales_rep | admin)
  WS   /ws/chat               → realtime chat stream  (requires: sales_rep | admin)
  GET  /session/{id}          → session facts handler (requires: admin)
  GET  /analytics/dashboard   → aggregated analytics  (requires: admin)
  GET  /health                → {status: ok, version: ...}

Auto-generated OpenAPI docs (Feature 14)
-----------------------------------------
  /docs        → Swagger UI  (includes Authorize button for Bearer JWT)
  /redoc       → ReDoc
  /openapi.json → raw schema
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from src.analytics.tracker import init_analytics_db
from src.api.auth import init_users_db, seed_admin
from src.api.routes.ab import router as ab_router
from src.api.routes.analytics import router as analytics_router
from src.api.routes.auth import router as auth_router
from src.api.routes.chat import router as chat_router
from src.api.routes.kb import router as kb_router
from src.api.schemas import HealthResponse
from src.memory.db import init_db
from src.utils.logger import get_logger

# pyrefly: ignore [missing-import]
from prometheus_fastapi_instrumentator import Instrumentator

# ─── Logging Setup ────────────────────────────────────────────────────────────

logger = get_logger("auralis.api")


# ─── Lifespan (Startup / Shutdown) ────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan handler.

    On startup
    ----------
    1. customer_sessions table  — created by init_db() (Feature 10).
    2. users table              — created by init_users_db().
    3. Default admin user       — seeded by seed_admin() if the table is empty.

    On shutdown
    -----------
    Logs a clean shutdown message.
    """
    logger.info("Auralis API starting up — initialising database …")

    import os

    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key or gemini_key.startswith("your_"):
        logger.critical(
            "GEMINI_API_KEY is missing or set to default! Please configure it in .env."
        )
        raise RuntimeError("Missing GEMINI_API_KEY")

    try:
        await init_db()
        logger.info("customer_sessions table ready.")
    except Exception as exc:
        logger.error("customer_sessions init failed: %s", exc, exc_info=True)

    try:
        await init_users_db()
        logger.info("users table ready.")
        await seed_admin()
    except Exception as exc:
        logger.error("users init / seed failed: %s", exc, exc_info=True)

    try:
        await init_analytics_db()
        logger.info("conversation_events table ready.")
    except Exception as exc:
        logger.error("analytics init failed: %s", exc, exc_info=True)

    yield
    logger.info("Auralis API shutting down.")


# ─── FastAPI App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Auralis AI Sales Agent API",
    description=(
        "Production inference API for Auralis.\n\n"
        "## Authentication\n\n"
        "All endpoints except `GET /health` and `POST /auth/token` require a "
        "valid **Bearer JWT**.\n\n"
        "1. Call `POST /auth/token` with your email and password.\n"
        "2. Copy the `access_token` from the response.\n"
        "3. Click the **Authorize 🔒** button in Swagger UI and paste the token.\n\n"
        "## Roles\n\n"
        "| Role | Permitted endpoints |\n"
        "|------|---------------------|\n"
        "| `admin` | All endpoints |\n"
        "| `sales_rep` | `POST /chat` |\n"
        "| `viewer` | `GET /health` only |\n\n"
        "## Features implemented\n\n"
        "- Zero-shot sales objection classification (Feature 2)\n"
        "- Buyer persona detection (Feature 3)\n"
        "- Sentiment analysis with tone routing (Feature 4)\n"
        "- Strategy-aware, citation-honest response generation (Features 5, 11)\n"
        "- Human handoff escalation (Feature 7)\n"
        "- Decision explainability audit trail (Feature 9)\n"
        "- Cross-session PostgreSQL memory (Feature 10)\n"
        "- Role-based response generation (Feature 13)\n"
        "- Auto-generated OpenAPI documentation (Feature 14)\n"
    ),
    version="1.0.0",
    lifespan=lifespan,
    # Feature 14: interactive API documentation
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


# ─── CORS ─────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Structured logging middleware ────────────────────────────────────────────


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
        latency = (time.perf_counter() - start) * 1000
        logger.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            latency_ms=round(latency, 2),
        )
        return response
    except Exception as e:
        logger.error("unhandled_exception", error=str(e), path=request.url.path)
        raise


# ─── Prometheus auto-instrumentation (adds /metrics) ─────────────────────────

Instrumentator().instrument(app).expose(app)


# ─── Health Check ─────────────────────────────────────────────────────────────


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Observability"],
    summary="Liveness / readiness probe for container orchestrators.",
    description=(
        "Returns `{status: ok}` when the API process is running. "
        "No authentication required. "
        "Kubernetes liveness probes and uptime monitors should call this endpoint."
    ),
)
async def health() -> dict[str, str]:
    return {"status": "ok", "version": "1.0.0"}


# ─── Routers ──────────────────────────────────────────────────────────────────

# Public — no auth required on POST /auth/token itself
app.include_router(auth_router)

# Protected — role guards are declared per-endpoint in the route handlers
app.include_router(chat_router, tags=["Conversation & Memory"])
app.include_router(ab_router, tags=["A/B Testing"])
app.include_router(kb_router, prefix="/kb", tags=["Knowledge Base"])
app.include_router(analytics_router)


# ─── OpenAPI: inject BearerAuth security scheme ───────────────────────────────
# This makes the Authorize 🔒 button appear in Swagger UI so testers can
# paste a JWT without manually setting the header. (Feature 14)


def _custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    schema.setdefault("components", {}).setdefault("securitySchemes", {})
    schema["components"]["securitySchemes"]["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Paste the access_token returned by POST /auth/token.",
    }
    app.openapi_schema = schema
    return schema


app.openapi = _custom_openapi  # type: ignore[method-assign]


# ─── Dev server entrypoint ────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.api.main:app", host="0.0.0.0", port=8001, reload=True)
