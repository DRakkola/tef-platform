"""Synchronize existing public.users into Supabase auth.users and auth.identities.

Enables seamless password authentication via Supabase GoTrue for pre-existing
seed and demo accounts without breaking existing UUID foreign key references.
"""

import asyncio
import datetime
import json
import uuid

import asyncpg
import bcrypt
import structlog

from app.core.config import settings

logger = structlog.get_logger("tef-api.supabase-sync")

# Default password for migrated demo accounts
DEFAULT_SEED_PASSWORD = "ValidPassword123!"


def hash_for_gotrue(password: str) -> str:
    """Generate a bcrypt hash compatible with Supabase GoTrue."""
    salt = bcrypt.gensalt(rounds=10)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


async def sync_users():
    """Migrate all public.users records into auth.users and auth.identities."""
    db_url = settings.DIRECT_DATABASE_URL or settings.DATABASE_URL
    # Ensure standard postgresql:// format for asyncpg
    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://", 1)

    print("Connecting to database to sync users to Supabase Auth...")
    conn = await asyncpg.connect(db_url)

    try:
        # Check if auth schema exists
        schema_exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users')"
        )
        if not schema_exists:
            print("Supabase auth.users table not found. Skipping migration.")
            return

        # Fetch public users that are not in auth.users
        users_to_sync = await conn.fetch(
            """
            SELECT u.id, u.email, u.role, u.is_active, u.created_at, u.updated_at
            FROM public.users u
            LEFT JOIN auth.users a ON u.id = a.id
            WHERE a.id IS NULL
            """
        )

        print(f"Found {len(users_to_sync)} users to sync into auth.users.")

        hashed_password = hash_for_gotrue(DEFAULT_SEED_PASSWORD)
        now = datetime.datetime.now(datetime.UTC)

        for u in users_to_sync:
            user_id = u["id"]
            email = u["email"]
            role = str(u["role"]).lower()

            app_metadata = json.dumps({"provider": "email", "providers": ["email"]})
            user_metadata = json.dumps({"role": role, "sub": str(user_id)})

            # 1. Insert into auth.users
            await conn.execute(
                """
                INSERT INTO auth.users (
                    id,
                    instance_id,
                    aud,
                    role,
                    email,
                    encrypted_password,
                    email_confirmed_at,
                    raw_app_meta_data,
                    raw_user_meta_data,
                    created_at,
                    updated_at,
                    is_super_admin
                )
                VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    encrypted_password = EXCLUDED.encrypted_password,
                    email_confirmed_at = EXCLUDED.email_confirmed_at,
                    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
                    updated_at = EXCLUDED.updated_at
                """,
                user_id,
                email,
                hashed_password,
                now,
                app_metadata,
                user_metadata,
                u["created_at"] or now,
                u["updated_at"] or now,
                (role == "admin"),
            )

            # 2. Insert into auth.identities
            identity_id = uuid.uuid4()
            identity_data = json.dumps({"sub": str(user_id), "email": email, "email_verified": True})
            await conn.execute(
                """
                INSERT INTO auth.identities (
                    id,
                    user_id,
                    identity_data,
                    provider,
                    provider_id,
                    last_sign_in_at,
                    created_at,
                    updated_at
                )
                VALUES ($1, $2, $3::jsonb, 'email', $4, $5, $6, $7)
                ON CONFLICT (provider, provider_id) DO UPDATE SET
                    identity_data = EXCLUDED.identity_data,
                    updated_at = EXCLUDED.updated_at
                """,
                identity_id,
                user_id,
                identity_data,
                email,  # provider_id for email provider is email or sub
                now,
                u["created_at"] or now,
                u["updated_at"] or now,
            )

            print(f"Synced user: {email} ({role}) [ID: {user_id}]")

        print("Successfully synchronized all users into Supabase Auth!")

    finally:
        await conn.close()


def main():
    asyncio.run(sync_users())


if __name__ == "__main__":
    main()
