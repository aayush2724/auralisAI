"""
conftest.py
──────────────────────────────────────────────────────────────────
Pytest configuration: load .env before any tests run so that
GEMINI_API_KEY and DATABASE_URL are available to the application code.
"""
from __future__ import annotations

import os
from pathlib import Path

# Load the .env file from the project root (two levels up from server/tests/)
_dotenv_path = Path(__file__).parent.parent.parent / ".env"

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=_dotenv_path, override=False)
except ImportError:
    pass  # python-dotenv not installed; rely on env vars being set externally

import pytest
from unittest.mock import patch

# Apply global mocks immediately if USE_MOCK_LLM is enabled.
if os.getenv("USE_MOCK_LLM", "").lower() in ("1", "true", "yes"):
    
    from src.classifier.shared_model import LLMZeroShotClassifier
    def fake_classify(self, text: str, candidate_labels: list[str], **kwargs):
        t = (text or "").lower()
        
        if candidate_labels and ("competitor" in candidate_labels or "price" in candidate_labels):
            if "hubspot" in t or "hub spot" in t or "competitor" in t or "pipedrive" in t or "salesforce" in t:
                label = "competitor"
            elif "time" in t or "quarter" in t:
                label = "timing"
            elif "heard" in t or "case studies" in t or "prove" in t:
                label = "trust"
            elif "complex" in t or "workflow" in t or "fit" in t or "integrate" in t:
                label = "fit"
            elif "trial" in t or "demo" in t or "buy" in t or "interested" in t or "contract" in t:
                label = "buying_signal"
            elif "$" in t or "price" in t or "cost" in t or "expensive" in t or "budget" in t:
                label = "price"
            else:
                label = "neutral"
                
        elif candidate_labels and ("CEO" in candidate_labels or "CTO" in candidate_labels):
            if "cto" in t or "technical" in t or "integration complexity" in t:
                label = "CTO"
            elif "developer" in t or "api" in t or "sdk" in t:
                label = "Developer"
            elif "founder" in t or "competitive moat" in t:
                label = "Founder"
            elif "ceo" in t or "roi" in t:
                label = "CEO"
            elif "product manager" in t or "roadmap" in t:
                label = "Product_Manager"
            else:
                label = candidate_labels[0]
                
        elif candidate_labels and ("positive" in candidate_labels or "negative" in candidate_labels):
            if any(w in t for w in ("not happy", "angry", "hate", "terrible", "bad", "worst", "frustrated", "problems")):
                label = "negative"
            elif "okay, i see" in t:
                label = "neutral"
            else:
                label = "positive"
        else:
            label = candidate_labels[0] if candidate_labels else "unknown"
            
        if candidate_labels and label not in candidate_labels:
            label = candidate_labels[0]
            
        return {"labels": [label], "scores": [0.99]}
        
    # Patch the LLM classification entrypoint
    patch.object(LLMZeroShotClassifier, "__call__", fake_classify).start()

    # 2. Patch Google Embeddings by replacing the class entirely where it is imported.
    # We inherit from LangChain's Embeddings ABC to pass internal isinstance() checks in FAISS,
    # which fixes the 'FakeEmbeddings object is not callable' error without relying on a specific
    # underlying Google SDK (google-generativeai vs google-genai) that might differ across Python versions.
    from langchain_core.embeddings import Embeddings
    
    class FakeEmbeddings(Embeddings):
        def __init__(self, *args, **kwargs):
            # Accept any init args that the real GoogleGenerativeAIEmbeddings would take
            pass
            
        def embed_documents(self, texts: list[str]) -> list[list[float]]:
            return [[float((i + 1) % 10) for _ in range(768)] for i, _ in enumerate(texts)]
            
        def embed_query(self, text: str) -> list[float]:
            return [0.1 for _ in range(768)]
            
    patch("src.rag.ingest.GoogleGenerativeAIEmbeddings", FakeEmbeddings).start()
    patch("src.rag.retriever.GoogleGenerativeAIEmbeddings", FakeEmbeddings).start()
