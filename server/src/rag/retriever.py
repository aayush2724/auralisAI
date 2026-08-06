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

# ─── Logging ──────────────────────────────────────────────────────────────────

logger = logging.getLogger("auralis.retriever")

# ─── Config ───────────────────────────────────────────────────────────────────

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "models/gemini-embedding-001")
VECTORSTORE_PATH = Path(os.getenv("VECTORSTORE_PATH", "vectorstore"))

# ─── Module-level singletons (lazy-loaded) ────────────────────────────────────

_embeddings: Any | None = None
_vectorstore: FAISS | None = None


def _get_embeddings() -> Any:
    global _embeddings
    if _embeddings is None:
        from src.rag.embeddings import get_embeddings

        _embeddings = get_embeddings()
        logger.info("Loading embedding model: %s", type(_embeddings).__name__)
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

        import json

        meta_file = vs_path / "metadata.json"
        if meta_file.exists():
            try:
                meta = json.loads(meta_file.read_text())
                built_with = meta.get("embedding_model")
                current = type(_get_embeddings()).__name__
                if built_with and built_with != current:
                    logger.warning(
                        "Embedding backend mismatch! Index built with %s but querying with %s. "
                        "Search results will be invalid. Please rebuild the index.",
                        built_with,
                        current,
                    )
            except Exception as e:
                logger.warning("Failed to read metadata.json for safety check: %s", e)

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
        score       — L2 distance from FAISS (LOWER = more similar; this is a distance, not a similarity score)
    """
    if not query.strip():
        raise ValueError("`query` must be a non-empty string.")

    vs = _get_vectorstore(vectorstore_path)

    # Use MMR (Maximal Marginal Relevance) to increase diversity and prevent
    # redundant chunks from crowding out other relevant context.
    embedding = vs.embeddings.embed_query(query)
    results_with_scores = vs.max_marginal_relevance_search_with_score_by_vector(
        embedding, k=top_k, fetch_k=20, lambda_mult=0.5
    )

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
