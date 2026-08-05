import asyncio
import shutil
from pathlib import Path

VECTORSTORE_PATH = Path("vectorstore")
UPLOAD_BASE = Path("data/uploads")


async def reset():
    if VECTORSTORE_PATH.exists():
        shutil.rmtree(VECTORSTORE_PATH)
        print(f"Removed local vectorstore at {VECTORSTORE_PATH}")

    if UPLOAD_BASE.exists():
        shutil.rmtree(UPLOAD_BASE)
        UPLOAD_BASE.mkdir(parents=True, exist_ok=True)
        print(f"Removed uploaded files at {UPLOAD_BASE}")

    try:
        from src.rag.kb_store import delete_kb_from_postgres

        await delete_kb_from_postgres()
        print("Cleared KB blob from Postgres")
    except Exception as e:
        print(f"Postgres delete failed or skipped: {e}")


if __name__ == "__main__":
    asyncio.run(reset())
