"""
auralis/src/rag/retriever.py
────────────────────────────
Retrieval layer — loads the FAISS index and surfaces ranked results
with source-level citations.

Public API
----------
    retrieve(query, top_k=5) -> list[dict]
    format_citations(docs)   -> str

Implements:
  - Feature 11 — Source Citations in Responses
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

# pyrefly: ignore [missing-import]
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings

# ─── Logging ──────────────────────────────────────────────────────────────────

logger = logging.getLogger("auralis.retriever")

# ─── Config ───────────────────────────────────────────────────────────────────

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "models/text-embedding-004")
VECTORSTORE_PATH = Path(os.getenv("VECTORSTORE_PATH", "vectorstore"))

# ─── Module-level singletons (lazy-loaded) ────────────────────────────────────

_embeddings: GoogleGenerativeAIEmbeddings | None = None
_vectorstore: FAISS | None = None


def _get_embeddings() -> GoogleGenerativeAIEmbeddings:
    global _embeddings
    if _embeddings is None:
        logger.info("Loading embedding model: %s", EMBEDDING_MODEL)
        _embeddings = GoogleGenerativeAIEmbeddings(
            model=EMBEDDING_MODEL,
            google_api_key=os.getenv("GEMINI_API_KEY"),
        )
    return _embeddings


def _get_vectorstore(vectorstore_path: Path | None = None) -> FAISS:
    """Load (and cache) the FAISS index from disk."""
    global _vectorstore
    vs_path = vectorstore_path or VECTORSTORE_PATH

    if _vectorstore is None:
        index_file = vs_path / "index.faiss"
        if not index_file.exists():
            raise FileNotFoundError(
                f"FAISS index not found at {index_file}. "
                "Run `python -m src.rag.ingest --dir data/` first."
            )
        logger.info("Loading FAISS index from %s", vs_path)
        _vectorstore = FAISS.load_local(
            str(vs_path),
            _get_embeddings(),
            allow_dangerous_deserialization=True,
        )
    return _vectorstore


def _reset_cache() -> None:
    """Force reload on next call — used in tests after fresh ingestion."""
    global _vectorstore, _embeddings
    _vectorstore = None
    _embeddings = None


# ─── Public API ───────────────────────────────────────────────────────────────


def retrieve(
    query: str,
    top_k: int = 5,
    vectorstore_path: Path | None = None,
) -> list[dict[str, Any]]:
    """
    Retrieve the *top_k* most relevant chunks for *query*.

    Parameters
    ----------
    query           : natural-language search string
    top_k           : number of results to return (default 5)
    vectorstore_path: override for FAISS path (mainly used in tests)

    Returns
    -------
    List of dicts, each with keys:
        text        — chunk content
        source_file — originating filename
        chunk_index — position within source document
        score       — similarity score (higher = more similar)
    """
    if not query.strip():
        raise ValueError("`query` must be a non-empty string.")

    vs = _get_vectorstore(vectorstore_path)

    # FAISS similarity_search_with_score returns (Document, score) pairs.
    # Langchain FAISS uses L2 distance by default; lower = closer.
    results_with_scores = vs.similarity_search_with_score(query, k=top_k)

    output: list[dict[str, Any]] = []
    for doc, score in results_with_scores:
        meta = doc.metadata or {}
        output.append(
            {
                "text": doc.page_content,
                "source_file": meta.get("source_file", "unknown"),
                "chunk_index": meta.get("chunk_index", -1),
                "score": float(score),
            }
        )

    logger.debug("retrieve('%s') → %d result(s)", query[:60], len(output))
    return output


def format_citations(docs: list[dict[str, Any]]) -> str:
    """
    Format a numbered citation string from retrieval results.

    Example output:
        [1] Case Study #12 (sales_cases.pdf, chunk 4)
        [2] Pricing FAQ (faq.md, chunk 0)

    Implements Feature 11 — Source Citations in Responses.

    Parameters
    ----------
    docs : list of dicts as returned by `retrieve()`

    Returns
    -------
    A multi-line numbered citation string, or empty string if *docs* is empty.
    """
    if not docs:
        return ""

    lines: list[str] = []
    for i, doc in enumerate(docs, start=1):
        source = doc.get("source_file", "unknown source")
        chunk = doc.get("chunk_index", "?")
        # Derive a human-readable label from the filename (strip extension).
        stem = Path(source).stem.replace("_", " ").replace("-", " ").title()
        lines.append(f"[{i}] {stem} ({source}, chunk {chunk})")

    return "\n".join(lines)
