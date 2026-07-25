"""
auralis/src/api/auth.py
────────────────────────
JWT authentication and authorisation layer for Auralis.

Design
------
  - Tokens  : HS256 JWTs signed with JWT_SECRET_KEY (env-var).
  - Hashing : bcrypt via passlib.
  - DB      : `users` table in the same PostgreSQL instance used by memory.db,
               sharing the same async engine / session-factory.
  - Roles   : admin | sales_rep | viewer  (stored as VARCHAR in the DB).

Public API
----------
  create_access_token(data, expires_delta)  → str
  get_current_user(token)                   → User          [FastAPI dependency]
  require_roles(*roles)                     → Callable      [role-guard factory]

  # DB helpers (called from lifespan)
  init_users_db()                           → None   (creates table if needed)
  seed_admin()                              → None   (inserts default admin if table is empty)

  # Used by POST /auth/token
  authenticate_user(email, password)        → User | None
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import text

# Re-use the shared async engine from memory.db to avoid creating a second pool.
from src.memory.db import _get_engine  # noqa: WPS436 (intentional shared engine)

logger = logging.getLogger("auralis.auth")

# ─── Configuration ────────────────────────────────────────────────────────────

JWT_SECRET_KEY: str | None = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Default admin seeded when the users table is empty
_ADMIN_EMAIL: str | None = os.getenv("ADMIN_EMAIL")
_ADMIN_PASSWORD: str | None = os.getenv("ADMIN_PASSWORD")

if not JWT_SECRET_KEY:
    logger.critical("SECURITY ERROR: JWT_SECRET_KEY environment variable is missing.")

if not _ADMIN_EMAIL or not _ADMIN_PASSWORD:
    logger.warning(
        "ADMIN_EMAIL or ADMIN_PASSWORD is not set in the environment. "
        "The default admin user cannot be seeded."
    )

# ─── Roles ────────────────────────────────────────────────────────────────────

Role = Literal["admin", "sales_rep", "viewer"]
_VALID_ROLES: tuple[str, ...] = ("admin", "sales_rep", "viewer")

# ─── Crypto ───────────────────────────────────────────────────────────────────

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=4)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def hash_password(plain: str) -> str:
    """Return the bcrypt hash of *plain*."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches *hashed*."""
    return _pwd_context.verify(plain, hashed)


# ─── User dataclass ───────────────────────────────────────────────────────────


@dataclass(frozen=True)
class User:
    """
    Authenticated user injected by the ``get_current_user`` dependency.

    Fields
    ------
    id    : UUID primary key (as str) from the users table.
    email : Unique email address.
    role  : One of "admin" | "sales_rep" | "viewer".
    """

    id: str
    email: str
    role: str


# ─── DDL ──────────────────────────────────────────────────────────────────────

_CREATE_USERS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(320) NOT NULL UNIQUE,
    hashed_password TEXT         NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'viewer'
                        CHECK (role IN ('admin', 'sales_rep', 'viewer')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
"""


async def init_users_db() -> None:
    """Create the ``users`` table if it does not already exist."""
    engine = _get_engine()
    async with engine.begin() as conn:
        for stmt in _CREATE_USERS_TABLE_SQL.split(";"):
            if stmt.strip():
                await conn.execute(text(stmt))
    logger.info("users table initialised.")


async def seed_admin() -> None:
    """
    Insert a default admin user when the users table is empty.

    Credentials are read from ADMIN_EMAIL / ADMIN_PASSWORD env vars.
    This runs once on startup and is a no-op if any user already exists.
    """
    if not _ADMIN_EMAIL or not _ADMIN_PASSWORD:
        return

    engine = _get_engine()
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT COUNT(*) FROM users"))
        count = result.scalar()
        if count and count > 0:
            logger.info("seed_admin: %d user(s) already exist — skipping seed.", count)
            return

        hashed = hash_password(_ADMIN_PASSWORD)
        await conn.execute(
            text(
                "INSERT INTO users (email, hashed_password, role) "
                "VALUES (:email, :hashed, 'admin')"
            ),
            {"email": _ADMIN_EMAIL, "hashed": hashed},
        )
        logger.info("seed_admin: default admin seeded (%s).", _ADMIN_EMAIL)


# ─── DB helpers ───────────────────────────────────────────────────────────────


async def get_user_by_email(email: str) -> dict | None:
    """
    Fetch a user row by email.

    Returns a dict with keys: id, email, hashed_password, role.
    Returns None if the user does not exist.
    """
    engine = _get_engine()
    sql = text(
        "SELECT id::text, email, hashed_password, role "
        "FROM users WHERE email = :email LIMIT 1"
    )
    async with engine.connect() as conn:
        result = await conn.execute(sql, {"email": email})
        row = result.fetchone()

    if row is None:
        return None
    return {
        "id": row.id,
        "email": row.email,
        "hashed_password": row.hashed_password,
        "role": row.role,
    }


async def authenticate_user(email: str, password: str) -> User | None:
    """
    Verify *email* + *password* against the database.

    Returns a ``User`` on success, or ``None`` if credentials are invalid.
    """
    row = await get_user_by_email(email)
    if not row:
        return None
    if not verify_password(password, row["hashed_password"]):
        return None
    return User(id=row["id"], email=row["email"], role=row["role"])


# ─── JWT helpers ──────────────────────────────────────────────────────────────


def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a signed HS256 JWT.

    Parameters
    ----------
    data          : Payload to encode; must include a ``sub`` key (user id).
    expires_delta : Token lifetime. Defaults to ACCESS_TOKEN_EXPIRE_MINUTES.

    Returns
    -------
    Encoded JWT string.
    """
    to_encode = data.copy()
    expire = datetime.now(tz=timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


# ─── FastAPI dependency: get_current_user ─────────────────────────────────────

_credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    FastAPI dependency that decodes the Bearer JWT and returns the active ``User``.

    Raises 401 if the token is missing, malformed, expired, or the user no
    longer exists in the database.

    Usage
    -----
    ::

        @router.get("/protected")
        async def endpoint(user: User = Depends(get_current_user)):
            ...
    """
    return await get_current_user_from_token(token)


async def get_current_user_from_token(token: str) -> User:
    """
    Decode and validate a bearer token outside dependency injection contexts.

    This helper is used by WebSocket handlers where FastAPI's OAuth2 dependency
    mechanism is not available.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id: str | None = payload.get("sub")
        email: str | None = payload.get("email")
        role: str | None = payload.get("role")
        if not user_id or not email or not role:
            raise _credentials_exception
    except JWTError:
        raise _credentials_exception

    # Confirm user still exists in the DB (prevents stale tokens for deleted users)
    row = await get_user_by_email(email)
    if row is None:
        raise _credentials_exception

    return User(id=user_id, email=email, role=role)


# ─── Role-guard factory ───────────────────────────────────────────────────────


def require_roles(*allowed: str):
    """
    Return a FastAPI dependency that enforces role-based access control.

    Parameters
    ----------
    *allowed : One or more role strings (``"admin"``, ``"sales_rep"``, ``"viewer"``).

    Raises
    ------
    HTTP 403 Forbidden if the authenticated user's role is not in *allowed*.

    Usage
    -----
    ::

        @router.post("/chat", dependencies=[Depends(require_roles("sales_rep", "admin"))])
        async def chat(...):
            ...
    """

    async def _guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Required role(s): {', '.join(allowed)}. "
                    f"Your role: {user.role}."
                ),
            )
        return user

    # Give the inner dependency a readable name for Swagger's security section
    _guard.__name__ = f"require_{'_or_'.join(allowed)}"
    return Depends(_guard)
