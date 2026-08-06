import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from src.rag.retriever import retrieve
from src.rag.kb_store import load_kb_from_postgres_on_startup
from src.memory.db import _get_engine

async def main():
    VECTORSTORE_PATH = Path(os.getenv("VECTORSTORE_PATH", "vectorstore"))
    _get_engine()
    print("Loading vectorstore from Postgres...")
    await load_kb_from_postgres_on_startup(VECTORSTORE_PATH)

    queries = [
        "is the 85% time-to-insight stat audited or self-reported",
        "how long does onboarding take from signed contract to going live",
        "Databricks integration setup time and plan availability"
    ]

    for q in queries:
        print(f"\n{'='*80}\nQuery: {q}\n{'='*80}")
        docs = retrieve(q)
        for i, doc in enumerate(docs):
            text = doc["text"]
            source = doc.get("source_file", "unknown")
            chunk_idx = doc.get("chunk_index", "unknown")
            
            print(f"\n--- Result {i+1} | Source: {source} | Chunk: {chunk_idx} ---")
            print(text)
            print("-" * 40)
            if len(text) > 400:
                print(f"[!] Length > 400. Characters after 400: {text[400:]}")
            else:
                print(f"Length: {len(text)} (<= 400)")

if __name__ == "__main__":
    asyncio.run(main())
