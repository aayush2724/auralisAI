"""
auralis/server/scripts/backfill_kb_audience.py
─────────────────────────────────────────────
Script to backfill `audience` metadata into the existing FAISS index.

Run this script first in dry-run mode to see which chunks will be tagged as 'internal'.
After reviewing the output, you can run with --execute to commit the changes.

Usage:
  python -m scripts.backfill_kb_audience         # Dry run
  python -m scripts.backfill_kb_audience --execute # Commit changes
"""

import argparse
import logging
import sys
from pathlib import Path

# Add project root to path if running directly
sys.path.append(str(Path(__file__).resolve().parent.parent))

from src.rag.retriever import VECTORSTORE_PATH, _get_vectorstore
from src.rag.ingest import _INTERNAL_MARKERS, _check_override

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description="Backfill audience metadata in FAISS index")
    parser.add_argument("--execute", action="store_true", help="Apply changes and save to disk")
    args = parser.parse_args()

    index_file = VECTORSTORE_PATH / "index.faiss"
    if not index_file.exists():
        logger.error(f"Vectorstore not found at {index_file}")
        return

    logger.info(f"Loading vectorstore from {VECTORSTORE_PATH}...")
    vs = _get_vectorstore()
    
    total_chunks = len(vs.docstore._dict)
    updates_internal = 0
    updates_external = 0
    files_overridden = set()
    files_external = set()

    logger.info(f"Scanning {total_chunks} chunks for content markers...")
    
    for doc_id, doc in vs.docstore._dict.items():
        text = doc.page_content
        source_file = doc.metadata.get("source_file", "unknown")
        
        # Determine audience based on content markers, defaulting to external for existing content
        final_audience, overridden = _check_override(text, "external")
        
        if final_audience == "internal":
            updates_internal += 1
            files_overridden.add(source_file)
        else:
            updates_external += 1
            files_external.add(source_file)
            
        if args.execute:
            doc.metadata["audience"] = final_audience

    logger.info("\n=== Dry Run Report ===" if not args.execute else "\n=== Execution Report ===")
    logger.info(f"Total chunks scanned: {total_chunks}")
    logger.info(f"Chunks to be marked 'internal': {updates_internal}")
    logger.info(f"Chunks to be marked 'external': {updates_external}")
    
    logger.info("\nFiles with at least one 'internal' chunk:")
    for f in sorted(files_overridden):
        logger.info(f"  - {f}")
        
    logger.info("\nFiles with all 'external' chunks:")
    pure_external = files_external - files_overridden
    for f in sorted(pure_external):
        logger.info(f"  - {f}")

    if args.execute:
        logger.info(f"\nSaving updated index to {VECTORSTORE_PATH}...")
        vs.save_local(str(VECTORSTORE_PATH))
        # Optional: Save to PG
        import asyncio
        from src.rag.kb_store import save_kb_to_postgres
        asyncio.run(save_kb_to_postgres(VECTORSTORE_PATH))
        logger.info("Changes committed and saved to Postgres.")
    else:
        logger.info("\nThis was a DRY RUN. No changes were saved.")
        logger.info("Run with --execute to commit these changes.")

if __name__ == "__main__":
    main()
