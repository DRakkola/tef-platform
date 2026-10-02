import asyncio
from app.core.database import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        res = await conn.execute(text("""
            SELECT tc.table_name, kcu.column_name, tc.constraint_name, rc.delete_rule
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.referential_constraints AS rc
              ON tc.constraint_name = rc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND kcu.column_name = 'skill_id';
        """))
        for r in res.fetchall():
            print(f"Table: {r[0]}, Column: {r[1]}, Constraint: {r[2]}, Delete Rule: {r[3]}")

if __name__ == "__main__":
    asyncio.run(main())
