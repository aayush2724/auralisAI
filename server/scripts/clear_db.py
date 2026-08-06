import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    db_url = os.getenv("PROD_DATABASE_URL")
    if not db_url:
        print("Missing PROD_DATABASE_URL")
        sys.exit(1)
    
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
    parsed = urlparse(db_url)
    query_params = parse_qsl(parsed.query)
    filtered_params = [
        (k, v) for k, v in query_params if k not in ("channel_binding", "sslmode")
    ]
    db_url = urlunparse(parsed._replace(query=urlencode(filtered_params)))


    print(f"Connecting to {db_url.split('@')[-1]}...")
    engine = create_async_engine(db_url, echo=False)
    
    try:
        async with engine.begin() as conn:
            # Step 1: Count
            counts = {}
            for table in ['customer_sessions', 'conversation_events', 'users', 'kb_vectorstore']:
                try:
                    result = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    counts[table] = result.scalar()
                except Exception as e:
                    counts[table] = f"Error: {e}"
            
            print("--- BEFORE ---")
            for table, count in counts.items():
                print(f"{table}: {count}")
            
            # Step 2: Delete
            print("\nDeleting from conversation_events...")
            try:
                await conn.execute(text("DELETE FROM conversation_events"))
                print("Deleted conversation_events")
            except Exception as e:
                print(f"Failed to delete conversation_events: {e}")
                
            print("Deleting from customer_sessions...")
            try:
                await conn.execute(text("DELETE FROM customer_sessions"))
                print("Deleted customer_sessions")
            except Exception as e:
                print(f"Failed to delete customer_sessions: {e}")
            
            # Step 3: Verify
            after_counts = {}
            for table in ['customer_sessions', 'conversation_events', 'users', 'kb_vectorstore']:
                try:
                    result = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    after_counts[table] = result.scalar()
                except Exception as e:
                    after_counts[table] = f"Error: {e}"
            
            print("\n--- AFTER ---")
            for table, count in after_counts.items():
                print(f"{table}: {count}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
