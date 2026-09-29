"""Prune redundant auth fields (password_hash, refresh_tokens) and sync last_sign_in_at.

Revision ID: 0027_prune_redundant_auth_fields
Revises: 0026_supabase_auth
Create Date: 2026-09-29 11:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0027_prune_redundant_auth_fields"
down_revision: str | None = "0026_supabase_auth"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Drop refresh_tokens table (GoTrue auth.refresh_tokens is the authority)
    op.drop_table("refresh_tokens")

    # 2. Drop password_hash column from users (GoTrue auth.users.encrypted_password is the authority)
    op.drop_column("users", "password_hash")

    # 3. Update trigger function to also sync last_login_at from NEW.last_sign_in_at
    update_trigger_sql = """
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'auth' AND table_name = 'users'
        ) THEN
            CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
            RETURNS TRIGGER AS $func$
            DECLARE
                user_role_val text;
                target_exam_val text;
                target_level_val text;
                tz_val text;
                display_name_val text;
                hourly_price_val integer;
            BEGIN
                user_role_val := UPPER(COALESCE(NEW.raw_user_meta_data->>'role', 'STUDENT'));
                IF user_role_val NOT IN ('STUDENT', 'TEACHER', 'ADMIN') THEN
                    user_role_val := 'STUDENT';
                END IF;

                target_exam_val := COALESCE(NEW.raw_user_meta_data->>'target_exam', 'TEF Canada');
                target_level_val := COALESCE(NEW.raw_user_meta_data->>'target_level', 'B2');
                tz_val := COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC');
                display_name_val := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));
                hourly_price_val := COALESCE((NEW.raw_user_meta_data->>'hourly_price')::integer, 3500);

                -- Upsert into public.users (pruned of password_hash, syncing last_login_at)
                INSERT INTO public.users (
                    id,
                    email,
                    role,
                    is_active,
                    is_verified,
                    last_login_at,
                    created_at,
                    updated_at
                )
                VALUES (
                    NEW.id,
                    NEW.email,
                    user_role_val,
                    TRUE,
                    (NEW.email_confirmed_at IS NOT NULL),
                    NEW.last_sign_in_at,
                    COALESCE(NEW.created_at, NOW()),
                    COALESCE(NEW.updated_at, NOW())
                )
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    is_verified = (NEW.email_confirmed_at IS NOT NULL),
                    last_login_at = COALESCE(NEW.last_sign_in_at, public.users.last_login_at),
                    updated_at = NOW();

                -- Create student or teacher profile if not present
                IF user_role_val = 'STUDENT' THEN
                    INSERT INTO public.student_profiles (
                        id,
                        user_id,
                        target_exam,
                        target_level,
                        timezone,
                        learning_preferences,
                        daily_minutes_available,
                        onboarding_status,
                        onboarding_step,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        gen_random_uuid(),
                        NEW.id,
                        target_exam_val,
                        target_level_val,
                        tz_val,
                        '{}'::json,
                        30,
                        'incomplete',
                        1,
                        NOW(),
                        NOW()
                    )
                    ON CONFLICT (user_id) DO NOTHING;
                ELSIF user_role_val = 'TEACHER' THEN
                    INSERT INTO public.teacher_profiles (
                        id,
                        user_id,
                        display_name,
                        verification_status,
                        hourly_price,
                        timezone,
                        expertise,
                        teaching_levels,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        gen_random_uuid(),
                        NEW.id,
                        display_name_val,
                        'pending',
                        hourly_price_val,
                        tz_val,
                        '[]'::json,
                        '[]'::json,
                        NOW(),
                        NOW()
                    )
                    ON CONFLICT (user_id) DO NOTHING;
                END IF;

                RETURN NEW;
            END;
            $func$ LANGUAGE plpgsql SECURITY DEFINER;
        END IF;
    END $$;
    """
    op.execute(update_trigger_sql)


def downgrade() -> None:
    # 1. Re-add password_hash column
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(length=255), nullable=True),
    )

    # 2. Re-create refresh_tokens table
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_refresh_tokens_id", "refresh_tokens", ["id"])
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"])
    op.create_index("ix_refresh_tokens_expires_at", "refresh_tokens", ["expires_at"])
    op.create_index("ix_refresh_tokens_revoked_at", "refresh_tokens", ["revoked_at"])
