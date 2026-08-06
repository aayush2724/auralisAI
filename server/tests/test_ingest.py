from unittest.mock import patch

from src.rag.ingest import _load_csv, _load_md, ingest_directory

# TODO: Add test_load_pdf for full coverage of _load_pdf


def test_load_md(tmp_path):
    md_file = tmp_path / "test.md"
    md_file.write_text("Hello World", encoding="utf-8")
    docs, overridden = _load_md(md_file, audience="external")
    assert len(docs) == 1
    assert docs[0]["text"] == "Hello World"
    assert docs[0]["doc_type"] == "md"
    assert docs[0]["audience"] == "external"
    assert overridden is False

def test_load_md_override(tmp_path):
    md_file = tmp_path / "test.md"
    md_file.write_text("Do not forward externally\nHello World", encoding="utf-8")
    docs, overridden = _load_md(md_file, audience="external")
    assert len(docs) == 1
    assert docs[0]["audience"] == "internal"
    assert overridden is True

def test_load_csv(tmp_path):
    csv_file = tmp_path / "test.csv"
    csv_file.write_text("col1,col2\nval1,val2\n", encoding="utf-8")
    docs, overridden = _load_csv(csv_file)
    assert len(docs) == 1
    assert docs[0]["text"] == "val1 | val2"
    assert docs[0]["doc_type"] == "csv"
    assert docs[0]["audience"] == "internal"


@patch("src.rag.ingest._embed_and_persist")
def test_ingest_directory_empty(mock_embed, tmp_path):
    result, overridden = ingest_directory(tmp_path, tmp_path / "vectorstore")
    assert result == 0
    mock_embed.assert_not_called()


@patch("src.rag.ingest._embed_and_persist")
def test_ingest_directory_md(mock_embed, tmp_path):
    (tmp_path / "test.md").write_text("Test markdown", encoding="utf-8")
    result, overridden = ingest_directory(tmp_path, tmp_path / "vectorstore")
    assert result > 0
    mock_embed.assert_called_once()
