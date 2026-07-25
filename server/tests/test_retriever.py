"""
tests/test_retriever.py
────────────────────────
End-to-end test: ingests a sample .md file → asserts retrieve() works.

Run with:
    pytest tests/test_retriever.py -v
"""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import pytest
from unittest.mock import patch
from langchain_community.embeddings import FakeEmbeddings

from src.rag.ingest import ingest_directory
from src.rag.retriever import _get_vectorstore, _reset_cache, format_citations, retrieve


@pytest.fixture(autouse=True)
def mock_embeddings():
    with patch("src.rag.retriever._get_embeddings") as mock:
        mock.return_value = FakeEmbeddings(size=768)
        yield mock, _reset_cache


# ─── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def tmp_dirs():
    """Create isolated data and vectorstore directories for the test run."""
    tmp = Path(tempfile.mkdtemp(prefix="auralis_test_"))
    data_dir = tmp / "data"
    vs_dir = tmp / "vectorstore"
    data_dir.mkdir()
    vs_dir.mkdir()
    yield data_dir, vs_dir
    shutil.rmtree(tmp, ignore_errors=True)


@pytest.fixture(scope="module")
def sample_md(tmp_dirs):
    """Write a sample markdown file with sales knowledge-base content."""
    data_dir, _ = tmp_dirs
    md_path = data_dir / "sales_cases.md"
    md_path.write_text(
        """
# Auralis Sales Knowledge Base

## Objection: Price too high
When a prospect says the price is too high, acknowledge their concern and pivot
to value. Ask which specific features they are unsure about and offer a ROI
calculation. Case Study: Acme Corp reduced churn by 40 % after adopting the
premium tier, yielding a 3× return in 6 months.

## Objection: Need more time
Urgency objections can often be defused by offering a limited-time pilot.
Reference the prospect's stated timeline and align a short proof-of-concept
that fits within their planning window.

## Competitive Differentiation
Auralis outperforms competitors on response latency (<200 ms) and offers
native PostgreSQL-backed conversation memory, a feature absent in all
evaluated alternatives.
        """,
        encoding="utf-8",
    )
    return md_path


@pytest.fixture(scope="module")
def built_vectorstore(tmp_dirs, sample_md):
    """Ingest the sample markdown and return the vectorstore path."""
    data_dir, vs_dir = tmp_dirs
    _reset_cache()
    n_chunks = ingest_directory(data_dir, vectorstore_path=vs_dir)
    assert n_chunks >= 1, "Ingestion should produce at least one chunk"
    return vs_dir


# ─── Tests ────────────────────────────────────────────────────────────────────


class TestRetrieve:
    def test_returns_at_least_one_result(self, built_vectorstore):
        """Core contract: retrieve() must return ≥ 1 result for a relevant query."""
        _reset_cache()
        results = retrieve(
            "price objection handling",
            top_k=3,
            vectorstore_path=built_vectorstore,
        )
        assert len(results) >= 1, "Expected at least one result from the retriever"

    def test_result_schema(self, built_vectorstore):
        """Each result must contain the required keys."""
        _reset_cache()
        results = retrieve(
            "urgency objection",
            top_k=3,
            vectorstore_path=built_vectorstore,
        )
        required_keys = {"text", "source_file", "chunk_index", "score"}
        for res in results:
            assert required_keys.issubset(res.keys()), (
                f"Result missing keys. Got: {set(res.keys())}"
            )

    def test_source_file_matches(self, built_vectorstore):
        """Returned source_file should reference the ingested markdown file."""
        _reset_cache()
        results = retrieve(
            "Auralis competitive differentiation",
            top_k=5,
            vectorstore_path=built_vectorstore,
        )
        sources = {r["source_file"] for r in results}
        assert "sales_cases.md" in sources, (
            f"Expected 'sales_cases.md' in sources, got: {sources}"
        )

    def test_score_is_numeric(self, built_vectorstore):
        """Score field must be a float."""
        _reset_cache()
        results = retrieve("ROI calculation", top_k=2, vectorstore_path=built_vectorstore)
        for res in results:
            assert isinstance(res["score"], float), "Score must be a float"

    def test_empty_query_raises(self, built_vectorstore):
        """An empty query string should raise ValueError."""
        _reset_cache()
        with pytest.raises(ValueError, match="non-empty"):
            retrieve("", vectorstore_path=built_vectorstore)


class TestFormatCitations:
    def test_format_basic(self):
        """format_citations should return numbered lines."""
        docs = [
            {"text": "...", "source_file": "sales_cases.pdf", "chunk_index": 4},
            {"text": "...", "source_file": "faq.md", "chunk_index": 0},
        ]
        result = format_citations(docs)
        assert "[1]" in result
        assert "[2]" in result
        assert "sales_cases.pdf" in result
        assert "faq.md" in result

    def test_format_empty(self):
        """Empty doc list returns empty string."""
        assert format_citations([]) == ""

    def test_chunk_index_in_output(self):
        """Chunk index must appear in the citation string."""
        docs = [{"text": "x", "source_file": "deck.pdf", "chunk_index": 7}]
        result = format_citations(docs)
        assert "chunk 7" in result
