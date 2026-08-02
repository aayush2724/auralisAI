"""
auralis/src/rag/kb_store.py
─────────────────────────
PostgreSQL persistence layer for the FAISS knowledge base.
"""

import io
import logging
import zipfile
from pathlib import Path

from sqlalchemy import text

from src.memory.db import _get_engine, _session_factory

logger = logging.getLogger("auralis.rag.kb_store")

_CREATE_KB_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS kb_vectorstore (
    id          INTEGER PRIMARY KEY DEFAULT 1,
    index_data  BYTEA        NOT NULL,
    metadata    JSONB        NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);
"""


async def init_kb_db() -> None:
    """Create the kb_vectorstore table if it does not already exist."""
    engine = _get_engine()
    async with engine.begin() as conn:
        await conn.execute(text(_CREATE_KB_TABLE_SQL))
    logger.info("kb_vectorstore table initialised.")


def serialize_faiss_dir(vectorstore_path: Path) -> bytes:
    """Zip the contents of the FAISS vectorstore directory into a byte buffer."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in vectorstore_path.rglob("*"):
            if file_path.is_file():
                arcname = file_path.relative_to(vectorstore_path)
                zf.write(file_path, arcname)
    return buf.getvalue()


def deserialize_faiss_dir(data: bytes, vectorstore_path: Path) -> None:
    """Unzip the byte buffer into the FAISS vectorstore directory."""
    buf = io.BytesIO(data)
    with zipfile.ZipFile(buf, "r") as zf:
        vectorstore_path.mkdir(parents=True, exist_ok=True)
        zf.extractall(vectorstore_path)


async def save_kb_to_postgres(vectorstore_path: Path) -> None:
    """Read local FAISS dir, zip it, and persist to Postgres."""
    if not vectorstore_path.exists() or not any(vectorstore_path.iterdir()):
        logger.warning("No files in %s to save to Postgres.", vectorstore_path)
        return

    data = serialize_faiss_dir(vectorstore_path)
    upsert_sql = text("""
        INSERT INTO kb_vectorstore (id, index_data, updated_at)
        VALUES (1, :data, now())
        ON CONFLICT (id) DO UPDATE SET
            index_data = EXCLUDED.index_data,
            updated_at = EXCLUDED.updated_at
    """)
    async with _session_factory() as session, session.begin():
        await session.execute(upsert_sql, {"data": data})
    logger.info("Saved FAISS index to Postgres (%d bytes).", len(data))


async def load_kb_from_postgres_on_startup(vectorstore_path: Path) -> None:
    """On startup, load the zipped FAISS index from Postgres and extract it locally."""
    # Ensure engine is initialised
    _get_engine()

    select_sql = text("SELECT index_data FROM kb_vectorstore WHERE id = 1")
    async with _session_factory() as session:
        result = await session.execute(select_sql)
        row = result.fetchone()

    if row is None:
        logger.info("No persisted KB index found in Postgres — starting with empty KB.")
        return

    logger.info("Restoring KB index from Postgres...")
    deserialize_faiss_dir(row.index_data, vectorstore_path)
    logger.info("KB index restored from Postgres to local disk.")


async def delete_kb_from_postgres() -> None:
    delete_sql = text("DELETE FROM kb_vectorstore WHERE id = 1")
    async with _session_factory() as session, session.begin():
        await session.execute(delete_sql)
