import asyncio
from app.core.database import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        print("=== TAXONOMY VERSIONS ===")
        tv = (await conn.execute(text("SELECT id, version, name, status FROM taxonomy_versions;"))).fetchall()
        for r in tv:
            print(r)

        print("\n=== TASK TYPES ===")
        tt = (await conn.execute(text("SELECT modality, code, name FROM task_types;"))).fetchall()
        for r in tt:
            print(f"Modality: {r[0]:<12} | Code: {r[1]:<25} | Name: {r[2]}")

        print("\n=== SKILLS STATS ===")
        total_skills = (await conn.execute(text("SELECT count(*) FROM skills;"))).scalar()
        by_dim = (await conn.execute(text("SELECT dimension, count(*) FROM skills GROUP BY dimension;"))).fetchall()
        by_domain = (await conn.execute(text("SELECT domain, count(*) FROM skills GROUP BY domain;"))).fetchall()
        print(f"Total skills: {total_skills}")
        print(f"By dimension: {by_dim}")
        print(f"By domain: {by_domain}")

        print("\n=== SKILL RELATIONS ===")
        sr = (await conn.execute(text("""
            SELECT s1.code, r.relation_type, s2.code
            FROM skill_relations r
            JOIN skills s1 ON r.from_skill_id = s1.id
            JOIN skills s2 ON r.to_skill_id = s2.id;
        """))).fetchall()
        for r in sr:
            print(f"{r[0]:<30} --[{r[1]}]--> {r[2]}")

        print("\n=== SKILL LEVEL DESCRIPTORS ===")
        sld = (await conn.execute(text("""
            SELECT s.code, d.level, d.descriptor
            FROM skill_level_descriptors d
            JOIN skills s ON d.skill_id = s.id;
        """))).fetchall()
        for r in sld:
            print(f"{r[0]:<25} | {r[1]} | {r[2][:50]}...")

        print("\n=== QUESTION SKILL TAGS ===")
        qst = (await conn.execute(text("""
            SELECT qst.id, qst.question_id, s.code, qst.subskill, sub.code, qst.role, qst.weight
            FROM question_skill_tags qst
            JOIN skills s ON qst.skill_id = s.id
            LEFT JOIN skills sub ON qst.subskill_id = sub.id;
        """))).fetchall()
        for r in qst:
            print(f"Skill: {r[2]:<22} | Legacy Sub: {str(r[3]):<22} | Resolved Sub: {str(r[4]):<22} | Role: {r[5]} | W: {r[6]}")

        print("\n=== FOREIGN KEY DELETE RULES ===")
        fks = (await conn.execute(text("""
            SELECT tc.table_name, kcu.column_name, tc.constraint_name, rc.delete_rule
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.referential_constraints AS rc
              ON tc.constraint_name = rc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND kcu.column_name = 'skill_id';
        """))).fetchall()
        for r in fks:
            print(f"Table: {r[0]:<25} | Constraint: {r[2]:<35} | Rule: {r[3]}")

if __name__ == "__main__":
    asyncio.run(main())
