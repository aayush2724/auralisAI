"""
auralis/src/rag/ingest.py
─────────────────────────
Knowledge-base ingestion pipeline.

Supports: .pdf (PyMuPDF), .csv (pandas), .md (pathlib)
Chunking : RecursiveCharacterTextSplitter — 512 tokens / 64-token overlap
Embedding: models/gemini-embedding-001 (Google GenAI)
Storage  : FAISS index persisted to vectorstore/

CLI usage
---------
    python -m src.rag.ingest --dir data/

Implements Feature 12 — PDF/CSV Knowledge Base Ingestion.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF

# pyrefly: ignore [missing-import]
import pandas as pd

# pyrefly: ignore [missing-import]
import pdfplumber

# pyrefly: ignore [missing-import]
from langchain_community.vectorstores import FAISS

# pyrefly: ignore [missing-import]
# pyrefly: ignore [missing-import]
from langchain_text_splitters import RecursiveCharacterTextSplitter

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("auralis.ingest")

# ─── Constants ────────────────────────────────────────────────────────────────

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "models/gemini-embedding-001")
VECTORSTORE_PATH = Path(os.getenv("VECTORSTORE_PATH", "vectorstore"))
CHUNK_SIZE = 128  # tokens (~512 characters) — smaller chunks for better topic separation on short docs
CHUNK_OVERLAP = 24  # ~96 characters

_INTERNAL_MARKERS = ["do not forward externally", "internal only", "confidential", "distributed to sales"]

def _check_override(text: str, requested_audience: str) -> tuple[str, bool]:
    if requested_audience != "external":
        return requested_audience, False
    prefix = text[:500].lower()
    for marker in _INTERNAL_MARKERS:
        if marker in prefix:
            return "internal", True
    return requested_audience, False

# ─── Document loaders ─────────────────────────────────────────────────────────


def _load_pdf(path: Path, audience: str = "internal") -> tuple[list[dict[str, Any]], bool]:
    """Extract text pages from a PDF using PyMuPDF and tables using pdfplumber."""
    docs: list[dict[str, Any]] = []
    file_overridden = False
    with fitz.open(str(path)) as pdf:
        for page_num, page in enumerate(pdf):
            text = page.get_text("text").strip()
            if text:
                final_audience, overridden = _check_override(text, audience)
                if overridden:
                    file_overridden = True
                docs.append(
                    {
                        "text": text,
                        "source_file": path.name,
                        "doc_type": "pdf",
                        "page": page_num + 1,
                        "audience": final_audience,
                    }
                )

    try:
        with pdfplumber.open(path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                for table in page.extract_tables():
                    if not table or len(table) < 2:
                        continue
                    header = table[0]
                    rows = table[1:]
                    md_lines = [
                        "| "
                        + " | ".join(str(c or "").replace("\n", " ") for c in header)
                        + " |",
                        "| " + " | ".join("---" for _ in header) + " |",
                    ]
                    for row in rows:
                        md_lines.append(
                            "| "
                            + " | ".join(str(c or "").replace("\n", " ") for c in row)
                            + " |"
                        )
                    
                    text = "\n".join(md_lines)
                    final_audience, overridden = _check_override(text, audience)
                    if overridden:
                        file_overridden = True
                    docs.append(
                        {
                            "text": text,
                            "source_file": path.name,
                            "doc_type": "pdf_table",
                            "page": page_num + 1,
                            "audience": final_audience,
                        }
                    )
    except Exception as e:
        logger.warning("Table extraction failed for %s: %s", path.name, e)

    logger.info("  PDF  | %s | %d page/table chunk(s) extracted", path.name, len(docs))
    return docs, file_overridden


def _load_csv(path: Path, audience: str = "internal") -> tuple[list[dict[str, Any]], bool]:
    """Concatenate all string columns of a CSV row into a single text block."""
    df = pd.read_csv(path)
    docs: list[dict[str, Any]] = []
    file_overridden = False
    for row_idx, row in df.iterrows():
        text = " | ".join(str(v) for v in row.values if pd.notna(v))
        if text.strip():
            final_audience, overridden = _check_override(text, audience)
            if overridden:
                file_overridden = True
            docs.append(
                {
                    "text": text,
                    "source_file": path.name,
                    "doc_type": "csv",
                    "row": int(row_idx),
                    "audience": final_audience,
                }
            )
    logger.info("  CSV  | %s | %d row(s) loaded", path.name, len(docs))
    return docs, file_overridden


def _load_md(path: Path, audience: str = "internal") -> tuple[list[dict[str, Any]], bool]:
    """Read a Markdown file as a single document block."""
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return [], False
    final_audience, overridden = _check_override(text, audience)
    logger.info("  MD   | %s | loaded", path.name)
    return [{"text": text, "source_file": path.name, "doc_type": "md", "audience": final_audience}], overridden


# ─── Chunking ─────────────────────────────────────────────────────────────────

_splitter = RecursiveCharacterTextSplitter(
    # MiniLM tokeniser ≈ 1 token per ~4 chars; multiply to get char sizes.
    chunk_size=CHUNK_SIZE * 4,
    chunk_overlap=CHUNK_OVERLAP * 4,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def _chunk_documents(raw_docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Split raw document pages/rows into fixed-size chunks with metadata."""
    chunks: list[dict[str, Any]] = []
    for doc in raw_docs:
        splits = _splitter.split_text(doc["text"])
        for idx, chunk_text in enumerate(splits):
            meta = {k: v for k, v in doc.items() if k != "text"}
            meta["chunk_index"] = idx
            chunks.append({"text": chunk_text, "metadata": meta})
    return chunks


# ─── Embedding + FAISS ────────────────────────────────────────────────────────


def _embed_and_persist(chunks: list[dict[str, Any]], vectorstore_path: Path) -> None:
    """Embed chunks and persist (or update) the FAISS index."""
    if not chunks:
        logger.warning("No chunks to embed. Skipping FAISS build.")
        return

    texts = [c["text"] for c in chunks]
    metadatas = [c["metadata"] for c in chunks]

    from src.rag.embeddings import get_embeddings

    embeddings = get_embeddings()
    logger.info("Loading embedding model: %s", type(embeddings).__name__)

    index_file = vectorstore_path / "index.faiss"

    if index_file.exists():
        logger.info("Existing index found — merging new documents.")
        vectorstore = FAISS.load_local(
            str(vectorstore_path),
            embeddings,
            allow_dangerous_deserialization=True,
        )
        vectorstore.add_texts(texts, metadatas=metadatas)
    else:
        logger.info("Creating new FAISS index with %d chunks.", len(chunks))
        vectorstore = FAISS.from_texts(texts, embeddings, metadatas=metadatas)

    vectorstore_path.mkdir(parents=True, exist_ok=True)
    vectorstore.save_local(str(vectorstore_path))

    # Write metadata.json for safe stats reading
    unique_sources = set()
    for c in chunks:
        if "source_file" in c["metadata"]:
            unique_sources.add(c["metadata"]["source_file"])

    metadata_file = vectorstore_path / "metadata.json"
    if metadata_file.exists():
        try:
            with open(metadata_file) as f:
                existing_meta = json.load(f)
                existing_sources = set(existing_meta.get("sources", []))
                unique_sources.update(existing_sources)
                total_chunks = existing_meta.get("total_chunks", 0) + len(chunks)
        except Exception:
            total_chunks = len(chunks)
    else:
        total_chunks = len(chunks)

    with open(metadata_file, "w") as f:
        json.dump(
            {
                "total_documents": len(unique_sources),
                "total_chunks": total_chunks,
                "sources": list(unique_sources),
                "embedding_model": type(embeddings).__name__,
            },
            f,
        )

    logger.info("FAISS index saved → %s", vectorstore_path / "index.faiss")


# ─── Public API ───────────────────────────────────────────────────────────────


def ingest_directory(
    data_dir: str | Path, vectorstore_path: str | Path | None = None, audience: str = "internal"
) -> tuple[int, list[str]]:
    """
    Ingest all .pdf, .csv, and .md files in *data_dir*.

    Parameters
    ----------
    data_dir        : directory containing raw knowledge-base files
    vectorstore_path: override for FAISS output path (defaults to VECTORSTORE_PATH)
    audience        : target audience ("internal" or "external")

    Returns
    -------
    Tuple of (Number of chunks ingested, List of files overridden to internal)
    """
    data_dir = Path(data_dir)
    vs_path = Path(vectorstore_path) if vectorstore_path else VECTORSTORE_PATH

    if not data_dir.exists():
        raise FileNotFoundError(f"Data directory not found: {data_dir}")

    raw_docs: list[dict[str, Any]] = []
    files_overridden: list[str] = []

    loaders = {
        ".pdf": _load_pdf,
        ".csv": _load_csv,
        ".md": _load_md,
    }

    files_found = list(data_dir.rglob("*"))
    for file_path in files_found:
        if file_path.suffix.lower() in loaders:
            try:
                docs, overridden = loaders[file_path.suffix.lower()](file_path, audience)
                raw_docs.extend(docs)
                if overridden:
                    files_overridden.append(file_path.name)
            except (
                OSError,
                RuntimeError,
                pd.errors.ParserError,
                pd.errors.EmptyDataError,
            ):
                logger.exception("Failed to load %s", file_path)

    if not raw_docs:
        logger.warning("No supported files found in %s", data_dir)
        return 0, []

    logger.info("Chunking %d document sections…", len(raw_docs))
    chunks = _chunk_documents(raw_docs)
    logger.info("Total chunks: %d", len(chunks))

    _embed_and_persist(chunks, vs_path)
    return len(chunks), files_overridden


def ingest_extracted_images(
    images_data: list[dict[str, Any]], vectorstore_path: str | Path | None = None, audience: str = "internal"
) -> tuple[int, list[str]]:
    """
    Ingest a list of extracted image data.

    Each dict should contain:
      - filename: original image filename
      - cloudinary_url: hosted image URL
      - extracted_text: OCR text

    Returns (number of chunks ingested, list of files overridden).
    """
    vs_path = Path(vectorstore_path) if vectorstore_path else VECTORSTORE_PATH

    raw_docs: list[dict[str, Any]] = []
    files_overridden: list[str] = []

    for img in images_data:
        text = img.get("extracted_text", "").strip()
        if not text:
            continue
            
        final_audience, overridden = _check_override(text, audience)
        if overridden:
            files_overridden.append(img.get("filename", "unknown_image"))

        raw_docs.append(
            {
                "text": text,
                "source_file": img.get("filename", "unknown_image"),
                "doc_type": "image",
                "cloudinary_url": img.get("cloudinary_url", ""),
                "ocr_engine": "tesseract",
                "audience": final_audience,
            }
        )

    if not raw_docs:
        logger.warning("No valid text found in the provided images.")
        return 0, []

    logger.info("Chunking %d image document(s)…", len(raw_docs))
    chunks = _chunk_documents(raw_docs)
    logger.info("Total chunks from images: %d", len(chunks))

    _embed_and_persist(chunks, vs_path)
    return len(chunks), files_overridden


# ─── CLI entry point ──────────────────────────────────────────────────────────


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m src.rag.ingest",
        description="Auralis — Knowledge-base ingestion pipeline",
    )
    parser.add_argument(
        "--dir",
        required=True,
        help="Path to directory containing .pdf / .csv / .md files",
    )
    parser.add_argument(
        "--vectorstore",
        default=str(VECTORSTORE_PATH),
        help=f"Path to persist the FAISS index (default: {VECTORSTORE_PATH})",
    )
    parser.add_argument(
        "--audience",
        default="internal",
        choices=["internal", "external"],
        help="Audience tag for ingested documents (default: internal)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = _parse_args(argv)
    try:
        n, overridden = ingest_directory(args.dir, args.vectorstore, args.audience)
        logger.info("Ingestion complete. %d chunk(s) stored. Overridden: %s", n, overridden)
    except Exception:
        # Broad exception caught because ingest_directory wraps multiple third-party loaders and operations
        logger.exception("Ingestion failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
