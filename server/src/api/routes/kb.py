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

import asyncio
import json
import logging
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from src.api.auth import User, require_roles
from src.api.schemas import (
    ImageExtractionResult,
    ImageIngestRequest,
    KBIngestResponse,
    KBStatsResponse,
)
from src.services.image_processor import (
    extract_text_from_image,
    upload_image_to_cloudinary,
)

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
    ts = datetime.now(tz=UTC).strftime("%Y%m%dT%H%M%SZ")
    upload_dir = UPLOAD_BASE / ts
    upload_dir.mkdir(parents=True, exist_ok=True)

    files_saved = 0
    for upload_file in files:
        original_name = upload_file.filename or "unknown"
        ext = Path(original_name).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {ext}",
            )

        # Generate a safe filename using UUID
        safe_filename = f"{uuid.uuid4().hex}{ext}"
        dest = (upload_dir / safe_filename).resolve()

        # Defense in depth: Verify it's within the intended directory
        if upload_dir.resolve() not in dest.parents:
            raise HTTPException(status_code=400, detail="Invalid file path")

        try:
            content = await upload_file.read()
            dest.write_bytes(content)
            files_saved += 1
            logger.info("Saved: %s (%d bytes)", dest.name, len(content))
        except OSError:
            logger.exception("Failed to save %s", original_name)

    if files_saved == 0:
        raise HTTPException(
            status_code=400,
            detail=f"No supported files found. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Run ingestion pipeline
    try:
        from src.rag.ingest import ingest_directory

        chunks_added = ingest_directory(str(upload_dir), str(VECTORSTORE_PATH))

        from src.rag.kb_store import save_kb_to_postgres

        await save_kb_to_postgres(VECTORSTORE_PATH)

        logger.info(
            "Ingestion complete: %d chunks from %d files", chunks_added, files_saved
        )

        return KBIngestResponse(
            files_processed=files_saved,
            chunks_added=chunks_added,
            upload_dir=str(upload_dir),
            index_updated=True,
        )
    except Exception:
        # Broad exception caught because ingest_directory wraps multiple third-party loaders and operations
        logger.exception("Ingestion failed")
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again or contact support.",
        )


# ─── POST /kb/extract-image ──────────────────────────────────────────────────


async def _process_single_image(
    upload_file: UploadFile,
) -> ImageExtractionResult | None:
    ext = Path(upload_file.filename or "").suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp"}:
        return None

    try:
        content = await upload_file.read()
        text = await asyncio.to_thread(extract_text_from_image, content)
        if text:
            url = await asyncio.to_thread(
                upload_image_to_cloudinary, content, upload_file.filename or "image"
            )
            return ImageExtractionResult(
                filename=upload_file.filename or "image",
                cloudinary_url=url,
                extracted_text=text,
            )
        else:
            logger.warning(f"No text extracted from {upload_file.filename}")
            return None
    except Exception:
        logger.exception(f"Failed to process image {upload_file.filename}")
        return None


@router.post(
    "/extract-image",
    response_model=list[ImageExtractionResult],
    summary="Upload image(s) to Cloudinary and extract OCR text for preview.",
    description="Accepts image files, uploads to Cloudinary, runs Tesseract OCR, and returns the text.",
)
async def kb_extract_image(
    files: list[UploadFile] = File(...),
    current_user: User = require_roles("admin"),
) -> list[ImageExtractionResult]:
    raw_results = await asyncio.gather(*(_process_single_image(f) for f in files))
    results = [r for r in raw_results if r is not None]

    if not results:
        raise HTTPException(
            status_code=400,
            detail="No readable text could be extracted from the provided images.",
        )

    return results


# ─── POST /kb/ingest-image ───────────────────────────────────────────────────


@router.post(
    "/ingest-image",
    response_model=KBIngestResponse,
    summary="Ingest extracted image OCR text into the KB.",
)
async def kb_ingest_image(
    req: ImageIngestRequest,
    current_user: User = require_roles("admin"),
) -> KBIngestResponse:
    if not req.images:
        raise HTTPException(status_code=400, detail="No images provided to ingest.")

    try:
        from src.rag.ingest import ingest_extracted_images

        chunks_added = ingest_extracted_images([img.dict() for img in req.images])

        from src.rag.kb_store import save_kb_to_postgres

        await save_kb_to_postgres(VECTORSTORE_PATH)

        return KBIngestResponse(
            files_processed=len(req.images),
            chunks_added=chunks_added,
            upload_dir="cloudinary",
            index_updated=True,
        )
    except Exception:
        logger.exception("Image ingestion failed")
        raise HTTPException(
            status_code=500, detail="Internal error during image ingestion."
        )


# ─── GET /kb/stats ───────────────────────────────────────────────────────────


@router.get(
    "/debug/chunks",
    summary="Temporary debug endpoint to dump chunks.",
    description="Returns all stored chunks for kb-demo-reference-sheet without auth.",
)
async def kb_debug_chunks() -> list[dict[str, Any]]:
    try:
        from src.rag.retriever import _get_vectorstore

        vs = _get_vectorstore()
        chunks = []
        for doc_id, doc in vs.docstore._dict.items():
            if "kb-demo-reference-sheet" in str(doc.metadata.get("source_file", "")):
                chunks.append(
                    {
                        "chunk_id": doc_id,
                        "metadata": doc.metadata,
                        "content": doc.page_content,
                    }
                )
        return chunks
    except Exception as e:
        logger.exception("Debug chunks failed")
        raise HTTPException(status_code=500, detail=str(e))


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
        metadata_file = VECTORSTORE_PATH / "metadata.json"
        if metadata_file.exists():
            with open(metadata_file) as f:
                meta = json.load(f)
                total_documents = meta.get("total_documents", 0)
                total_chunks = meta.get("total_chunks", 0)
        else:
            total_documents = 0
            total_chunks = 0

        # Last updated = mtime of the index file
        mtime = os.path.getmtime(index_file)
        last_updated = datetime.fromtimestamp(mtime, tz=UTC).isoformat()

        return KBStatsResponse(
            total_documents=total_documents,
            total_chunks=total_chunks,
            index_path=str(VECTORSTORE_PATH / "index.faiss"),
            last_updated=last_updated,
        )
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Could not read KB stats: %s", exc)
        return KBStatsResponse(
            total_documents=0,
            total_chunks=0,
            index_path=str(VECTORSTORE_PATH / "index.faiss"),
            last_updated=None,
        )


# ─── DELETE /kb/reset ────────────────────────────────────────────────────────


@router.delete(
    "/reset",
    summary="Delete all knowledge base content and reset the index.",
    description=(
        "Deletes the local FAISS vectorstore, clears the Postgres-persisted "
        "copy, and removes uploaded source files. This is irreversible — "
        "all ingested documents must be re-uploaded after this call.\n\n"
        "**Required role**: `admin`."
    ),
    responses={
        401: {"description": "Missing or invalid Bearer token."},
        403: {"description": "Insufficient role. Requires admin."},
        500: {"description": "Internal error during reset."},
    },
)
async def kb_reset(
    current_user: User = require_roles("admin"),
) -> dict:
    logger.info(
        "DELETE /kb/reset | user=%s role=%s", current_user.email, current_user.role
    )

    try:
        import shutil

        # 1. Remove local FAISS index directory
        if VECTORSTORE_PATH.exists():
            shutil.rmtree(VECTORSTORE_PATH)
            logger.info("Removed local vectorstore at %s", VECTORSTORE_PATH)

        # 2. Remove uploaded source files
        if UPLOAD_BASE.exists():
            shutil.rmtree(UPLOAD_BASE)
            UPLOAD_BASE.mkdir(parents=True, exist_ok=True)
            logger.info("Removed uploaded files at %s", UPLOAD_BASE)

        # 3. Clear the Postgres-persisted copy (added in the earlier persistence fix)
        from src.rag.kb_store import delete_kb_from_postgres

        await delete_kb_from_postgres()
        logger.info("Cleared KB blob from Postgres")

        return {"status": "ok", "detail": "Knowledge base reset. All content removed."}
    except Exception:
        logger.exception("KB reset failed")
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred during reset. Please try again or contact support.",
        )
