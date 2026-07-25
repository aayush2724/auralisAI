"""
auralis/src/api/routes/kb.py
────────────────────────────
Route handlers for knowledge-base management.

POST /kb/ingest
  Accept multipart/form-data with one or more files (.pdf, .csv, .md).
  Saves files to data/uploads/{timestamp}/, runs ingest, returns stats.

GET /kb/stats
  Returns current KB statistics: total documents, total chunks, last updated.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from src.api.auth import User, require_roles
from src.api.schemas import KBIngestResponse, KBStatsResponse

logger = logging.getLogger("auralis.api.kb")
router = APIRouter()

# ─── Config ───────────────────────────────────────────────────────────────────

UPLOAD_BASE = Path(os.getenv("KB_UPLOAD_DIR", "data/uploads"))
VECTORSTORE_PATH = Path(os.getenv("VECTORSTORE_PATH", "vectorstore"))
ALLOWED_EXTENSIONS = {".pdf", ".csv", ".md"}


# ─── POST /kb/ingest ─────────────────────────────────────────────────────────


@router.post(
    "/ingest",
    response_model=KBIngestResponse,
    summary="Upload and ingest sales collateral into the knowledge base.",
    description=(
        "Accepts one or more files (.pdf, .csv, .md) via multipart form-data. "
        "Files are saved to `data/uploads/{timestamp}/`, chunked, embedded, "
        "and merged into the FAISS vectorstore.\n\n"
        "**Required role**: `admin`."
    ),
    responses={
        400: {"description": "No valid files provided or unsupported file type."},
        401: {"description": "Missing or invalid Bearer token."},
        403: {"description": "Insufficient role. Requires admin."},
        500: {"description": "Internal server error during ingestion."},
    },
)
async def kb_ingest(
    files: list[UploadFile] = File(..., description="PDF, CSV, or MD files to ingest."),
    current_user: User = require_roles("admin"),
) -> KBIngestResponse:
    logger.info(
        "POST /kb/ingest | user=%s role=%s files=%d",
        current_user.email,
        current_user.role,
        len(files),
    )

    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    # Create timestamped upload directory
    ts = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    upload_dir = UPLOAD_BASE / ts
    upload_dir.mkdir(parents=True, exist_ok=True)

    files_saved = 0
    for upload_file in files:
        ext = Path(upload_file.filename or "").suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {ext}",
            )

        dest = upload_dir / upload_file.filename
        try:
            content = await upload_file.read()
            dest.write_bytes(content)
            files_saved += 1
            logger.info("Saved: %s (%d bytes)", dest.name, len(content))
        except Exception as exc:
            logger.error("Failed to save %s: %s", upload_file.filename, exc)

    if files_saved == 0:
        raise HTTPException(
            status_code=400,
            detail=f"No supported files found. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Run ingestion pipeline
    try:
        from src.rag.ingest import ingest_directory  # noqa: PLC0415

        chunks_added = ingest_directory(str(upload_dir), str(VECTORSTORE_PATH))
        logger.info(
            "Ingestion complete: %d chunks from %d files", chunks_added, files_saved
        )

        return KBIngestResponse(
            files_processed=files_saved,
            chunks_added=chunks_added,
            upload_dir=str(upload_dir),
            index_updated=True,
        )
    except Exception as exc:
        logger.exception("Ingestion failed")
        raise HTTPException(
            status_code=500,
            detail=f"Ingestion failed: {exc}",
        )


# ─── GET /kb/stats ───────────────────────────────────────────────────────────


@router.get(
    "/stats",
    response_model=KBStatsResponse,
    summary="Get current knowledge base statistics.",
    description=(
        "Returns the number of source documents, total chunks, and last "
        "ingestion timestamp from the FAISS vectorstore.\n\n"
        "**Required role**: `admin`."
    ),
    responses={
        401: {"description": "Missing or invalid Bearer token."},
        403: {"description": "Insufficient role. Requires admin."},
    },
)
async def kb_stats(
    current_user: User = require_roles("admin"),
) -> KBStatsResponse:
    logger.info(
        "GET /kb/stats | user=%s role=%s", current_user.email, current_user.role
    )

    index_file = VECTORSTORE_PATH / "index.faiss"
    if not index_file.exists():
        return KBStatsResponse(
            total_documents=0,
            total_chunks=0,
            index_path=str(VECTORSTORE_PATH / "index.faiss"),
            last_updated=None,
        )

    try:
        # Read FAISS metadata to count documents and chunks
        docstore_path = VECTORSTORE_PATH / "index.pkl"
        if docstore_path.exists():
            import pickle  # noqa: PLC0415

            with open(docstore_path, "rb") as f:
                docstore = pickle.load(f)  # noqa: S301

            # docstore is a dict-like mapping; count unique source files
            source_files: set[str] = set()
            total_chunks = 0
            for doc_id, doc in docstore.items():
                meta = getattr(doc, "metadata", None) or (
                    doc if isinstance(doc, dict) else {}
                )
                source = (
                    meta.get("source_file", "unknown")
                    if isinstance(meta, dict)
                    else "unknown"
                )
                source_files.add(source)
                total_chunks += 1

            total_documents = len(source_files)
        else:
            total_documents = 0
            total_chunks = 0

        # Last updated = mtime of the index file
        mtime = os.path.getmtime(index_file)
        last_updated = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()

        return KBStatsResponse(
            total_documents=total_documents,
            total_chunks=total_chunks,
            index_path=str(VECTORSTORE_PATH / "index.faiss"),
            last_updated=last_updated,
        )
    except Exception as exc:
        logger.warning("Could not read KB stats: %s", exc)
        return KBStatsResponse(
            total_documents=0,
            total_chunks=0,
            index_path=str(VECTORSTORE_PATH / "index.faiss"),
            last_updated=None,
        )
