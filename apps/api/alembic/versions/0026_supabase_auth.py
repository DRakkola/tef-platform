"""Supabase Auth Integration: nullable password_hash and auth.users sync trigger.

Revision ID: 0026_supabase_auth
Revises: 0025_speaking_scenarios
Create Date: 2026-09-29 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0026_supabase_auth"
down_revision: str | None = "0025_speaking_scenarios"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Allow password_hash to be null for Supabase GoTrue-managed users
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.String(length=255),
        nullable=True,
    )

    # 2. Deploy PostgreSQL trigger linking auth.users to public.users if auth schema exists
    trigger_sql = """
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'auth' AND table_name = 'users'
        ) THEN
            -- Create or replace trigger function
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

                -- 1. Upsert into public.users
                INSERT INTO public.users (
                    id,
                    email,
                    role,
                    is_active,
                    is_verified,
                    created_at,
                    updated_at
                )
                VALUES (
                    NEW.id,
                    NEW.email,
                    user_role_val,
                    TRUE,
                    (NEW.email_confirmed_at IS NOT NULL),
                    COALESCE(NEW.created_at, NOW()),
                    COALESCE(NEW.updated_at, NOW())
                )
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    is_verified = (NEW.email_confirmed_at IS NOT NULL),
                    updated_at = NOW();

                -- 2. Create student or teacher profile if not present
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

            -- Attach trigger to auth.users
            DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
            CREATE TRIGGER on_auth_user_created
                AFTER INSERT OR UPDATE ON auth.users
                FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
        END IF;
    END $$;
    """
    op.execute(trigger_sql)


def downgrade() -> None:
    drop_trigger_sql = """
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'auth' AND table_name = 'users'
        ) THEN
            DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
            DROP FUNCTION IF EXISTS public.handle_new_auth_user();
        END IF;
    END $$;
    """
    op.execute(drop_trigger_sql)

    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.String(length=255),
        nullable=False,
    )
