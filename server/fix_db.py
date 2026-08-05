import asyncio
import os
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def main():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ ERROR: DATABASE_URL environment variable is not set.")
        print("Please set it to your Render External Database URL and try again.")
        sys.exit(1)

    # Render gives URLs starting with postgres:// or postgresql://
    # We need postgresql+asyncpg:// for our driver
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    print("🔌 Connecting to database...")
    try:
        engine = create_async_engine(db_url, echo=False)
        async with engine.begin() as conn:
            print("🗑️  Deleting stuck admin and demo rows...")
            result = await conn.execute(
                text(
                    "DELETE FROM users WHERE email IN ('admin@auralis.ai', 'demo@auralis.ai')"
                )
            )
            print(f"✅ Successfully deleted {result.rowcount} row(s)!")

        await engine.dispose()
        print("🎉 Database fix complete! You can now redeploy on Render.")
    except Exception as e:
        print(f"❌ Failed to execute: {e}")
        print("Make sure you copied the correct External Database URL.")


if __name__ == "__main__":
    asyncio.run(main())
