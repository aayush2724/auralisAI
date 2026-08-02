import asyncio
from sqlalchemy import text
from src.memory.db import _get_engine

async def main():
    engine = _get_engine()
    try:
        conn = await engine.connect()
        result = await conn.execute(text('SELECT count(*) FROM customer_sessions WHERE user_id IS NULL;'))
        print(f'COUNT: {result.scalar()}')
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(main())
