import asyncio
from app.core.database import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        print("=== SKILLS ===")
        skills = (await conn.execute(text("SELECT id, code, name, category, parent_id, is_active FROM skills ORDER BY code;"))).fetchall()
        for s in skills:
            print(f"ID: {s[0]} | Code: {s[1]:<30} | Cat: {str(s[3]):<25} | Parent: {str(s[4]):<36} | Active: {s[5]}")

        print("\n=== SUB_SKILLS ===")
        sub_skills = (await conn.execute(text("SELECT id, skill_id, code, name FROM sub_skills ORDER BY code;"))).fetchall()
        for sub in sub_skills:
            print(f"ID: {sub[0]} | Parent Skill ID: {sub[1]} | Code: {sub[2]:<30} | Name: {sub[3]}")

        print("\n=== QUESTION SKILL TAGS ===")
        q_tags = (await conn.execute(text("SELECT id, question_id, skill_id, subskill, weight FROM question_skill_tags;"))).fetchall()
        for q in q_tags:
            print(f"ID: {q[0]} | Q_ID: {q[1]} | Skill_ID: {q[2]} | Subskill: {q[3]} | Weight: {q[4]}")

        print("\n=== EXERCISE SKILLS ===")
        ex_skills = (await conn.execute(text("SELECT id, exercise_id, skill_id, subskill, weight FROM exercise_skills;"))).fetchall()
        for e in ex_skills:
            print(f"ID: {e[0]} | Ex_ID: {e[1]} | Skill_ID: {e[2]} | Subskill: {e[3]} | Weight: {e[4]}")

if __name__ == "__main__":
    asyncio.run(main())
