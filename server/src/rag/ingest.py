"""
auralis/src/rag/ingest.py
─────────────────────────
Knowledge-base ingestion pipeline.

Supports: .pdf (PyMuPDF), .csv (pandas), .md (pathlib)
Chunking : RecursiveCharacterTextSplitter — 512 tokens / 64-token overlap
Embedding: models/text-embedding-004 (Google GenAI)
Storage  : FAISS index persisted to vectorstore/

CLI usage
---------
    python -m src.rag.ingest --dir data/

Implements Feature 12 — PDF/CSV Knowledge Base Ingestion.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import Any

# pyrefly: ignore [missing-import]
import fitz  # PyMuPDF

# pyrefly: ignore [missing-import]
import pandas as pd

# pyrefly: ignore [missing-import]
from langchain_text_splitters import RecursiveCharacterTextSplitter

# pyrefly: ignore [missing-import]
from langchain_community.vectorstores import FAISS

# pyrefly: ignore [missing-import]
from langchain_google_genai import GoogleGenerativeAIEmbeddings

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("auralis.ingest")

# ─── Constants ────────────────────────────────────────────────────────────────

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "models/text-embedding-004")
VECTORSTORE_PATH = Path(os.getenv("VECTORSTORE_PATH", "vectorstore"))
CHUNK_SIZE = 512  # tokens (approx. characters / 4)
CHUNK_OVERLAP = 64

# ─── Document loaders ─────────────────────────────────────────────────────────


def _load_pdf(path: Path) -> list[dict[str, Any]]:
    """Extract text pages from a PDF using PyMuPDF."""
    docs: list[dict[str, Any]] = []
    with fitz.open(str(path)) as pdf:
        for page_num, page in enumerate(pdf):
            text = page.get_text("text").strip()
            if text:
                docs.append(
                    {
                        "text": text,
                        "source_file": path.name,
                        "doc_type": "pdf",
                        "page": page_num + 1,
                    }
                )
    logger.info("  PDF  | %s | %d page(s) extracted", path.name, len(docs))
    return docs


def _load_csv(path: Path) -> list[dict[str, Any]]:
    """Concatenate all string columns of a CSV row into a single text block."""
    df = pd.read_csv(path)
    docs: list[dict[str, Any]] = []
    for row_idx, row in df.iterrows():
        text = " | ".join(str(v) for v in row.values if pd.notna(v))
        if text.strip():
            docs.append(
                {
                    "text": text,
                    "source_file": path.name,
                    "doc_type": "csv",
                    "row": int(row_idx),
                }
            )
    logger.info("  CSV  | %s | %d row(s) loaded", path.name, len(docs))
    return docs


def _load_md(path: Path) -> list[dict[str, Any]]:
    """Read a Markdown file as a single document block."""
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []
    logger.info("  MD   | %s | loaded", path.name)
    return [{"text": text, "source_file": path.name, "doc_type": "md"}]


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

    logger.info("Loading embedding model: %s", EMBEDDING_MODEL)
    embeddings = GoogleGenerativeAIEmbeddings(
        model=EMBEDDING_MODEL,
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )

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
    logger.info("FAISS index saved → %s", vectorstore_path / "index.faiss")


# ─── Public API ───────────────────────────────────────────────────────────────


def ingest_directory(
    data_dir: str | Path, vectorstore_path: str | Path | None = None
) -> int:
    """
    Ingest all .pdf, .csv, and .md files in *data_dir*.

    Parameters
    ----------
    data_dir        : directory containing raw knowledge-base files
    vectorstore_path: override for FAISS output path (defaults to VECTORSTORE_PATH)

    Returns
    -------
    Number of chunks ingested.
    """
    data_dir = Path(data_dir)
    vs_path = Path(vectorstore_path) if vectorstore_path else VECTORSTORE_PATH

    if not data_dir.exists():
        raise FileNotFoundError(f"Data directory not found: {data_dir}")

    raw_docs: list[dict[str, Any]] = []

    loaders = {
        ".pdf": _load_pdf,
        ".csv": _load_csv,
        ".md": _load_md,
    }

    files_found = list(data_dir.rglob("*"))
    for file_path in files_found:
        if file_path.suffix.lower() in loaders:
            try:
                raw_docs.extend(loaders[file_path.suffix.lower()](file_path))
            except Exception as exc:
                logger.error("Failed to load %s: %s", file_path, exc)

    if not raw_docs:
        logger.warning("No supported files found in %s", data_dir)
        return 0

    logger.info("Chunking %d document sections…", len(raw_docs))
    chunks = _chunk_documents(raw_docs)
    logger.info("Total chunks: %d", len(chunks))

    _embed_and_persist(chunks, vs_path)
    return len(chunks)


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
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = _parse_args(argv)
    try:
        n = ingest_directory(args.dir, args.vectorstore)
        logger.info("Ingestion complete. %d chunk(s) stored.", n)
    except Exception as exc:
        logger.critical("Ingestion failed: %s", exc, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
