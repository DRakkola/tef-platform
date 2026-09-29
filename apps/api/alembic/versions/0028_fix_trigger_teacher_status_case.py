"""Fix trigger teacher_verification_status case (pending → PENDING).

Revision ID: 0028_fix_trigger_teacher_status_case
Revises: 0027_prune_redundant_auth_fields
Create Date: 2026-09-29 14:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0028_fix_trigger_teacher_status_case"
down_revision: str | None = "0027_prune_redundant_auth_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Replace trigger function with fixed uppercase enum value for verification_status
    fix_trigger_sql = """
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
                native_language_val text;
            BEGIN
                user_role_val := UPPER(COALESCE(NEW.raw_user_meta_data->>'role', 'STUDENT'));
                IF user_role_val NOT IN ('STUDENT', 'TEACHER', 'ADMIN') THEN
                    user_role_val := 'STUDENT';
                END IF;

                target_exam_val    := COALESCE(NEW.raw_user_meta_data->>'target_exam', 'TEF Canada');
                target_level_val   := COALESCE(NEW.raw_user_meta_data->>'target_level', 'B2');
                tz_val             := COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC');
                display_name_val   := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));
                hourly_price_val   := COALESCE((NEW.raw_user_meta_data->>'hourly_price')::integer, 3500);
                native_language_val := NEW.raw_user_meta_data->>'native_language';

                -- Upsert into public.users
                INSERT INTO public.users (
                    id, email, role, is_active, is_verified, last_login_at, created_at, updated_at
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
                    email        = EXCLUDED.email,
                    is_verified  = (NEW.email_confirmed_at IS NOT NULL),
                    last_login_at = COALESCE(NEW.last_sign_in_at, public.users.last_login_at),
                    updated_at   = NOW();

                -- Create role-specific profile if not present
                IF user_role_val = 'STUDENT' THEN
                    INSERT INTO public.student_profiles (
                        id, user_id, target_exam, target_level, timezone,
                        native_language, learning_preferences,
                        daily_minutes_available, onboarding_status, onboarding_step,
                        created_at, updated_at
                    )
                    VALUES (
                        gen_random_uuid(),
                        NEW.id,
                        target_exam_val,
                        target_level_val,
                        tz_val,
                        native_language_val,
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
                        id, user_id, display_name, verification_status,
                        hourly_price, timezone, expertise, teaching_levels,
                        created_at, updated_at
                    )
                    VALUES (
                        gen_random_uuid(),
                        NEW.id,
                        display_name_val,
                        'PENDING',
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
    op.execute(fix_trigger_sql)

    # Also fix any existing rows with lowercase 'pending'
    op.execute("""
        UPDATE public.teacher_profiles
        SET verification_status = 'PENDING'
        WHERE verification_status = 'pending'
    """)


def downgrade() -> None:
    # Revert verification_status back to lowercase 'pending' in trigger
    revert_sql = """
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
                target_exam_val  := COALESCE(NEW.raw_user_meta_data->>'target_exam', 'TEF Canada');
                target_level_val := COALESCE(NEW.raw_user_meta_data->>'target_level', 'B2');
                tz_val           := COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC');
                display_name_val := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));
                hourly_price_val := COALESCE((NEW.raw_user_meta_data->>'hourly_price')::integer, 3500);

                INSERT INTO public.users (id, email, role, is_active, is_verified, last_login_at, created_at, updated_at)
                VALUES (NEW.id, NEW.email, user_role_val, TRUE, (NEW.email_confirmed_at IS NOT NULL),
                        NEW.last_sign_in_at, COALESCE(NEW.created_at, NOW()), COALESCE(NEW.updated_at, NOW()))
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    is_verified = (NEW.email_confirmed_at IS NOT NULL),
                    last_login_at = COALESCE(NEW.last_sign_in_at, public.users.last_login_at),
                    updated_at = NOW();

                IF user_role_val = 'STUDENT' THEN
                    INSERT INTO public.student_profiles (id, user_id, target_exam, target_level, timezone,
                        learning_preferences, daily_minutes_available, onboarding_status, onboarding_step, created_at, updated_at)
                    VALUES (gen_random_uuid(), NEW.id, target_exam_val, target_level_val, tz_val,
                        '{}'::json, 30, 'incomplete', 1, NOW(), NOW())
                    ON CONFLICT (user_id) DO NOTHING;
                ELSIF user_role_val = 'TEACHER' THEN
                    INSERT INTO public.teacher_profiles (id, user_id, display_name, verification_status,
                        hourly_price, timezone, expertise, teaching_levels, created_at, updated_at)
                    VALUES (gen_random_uuid(), NEW.id, display_name_val, 'pending', hourly_price_val,
                        tz_val, '[]'::json, '[]'::json, NOW(), NOW())
                    ON CONFLICT (user_id) DO NOTHING;
                END IF;

                RETURN NEW;
            END;
            $func$ LANGUAGE plpgsql SECURITY DEFINER;
        END IF;
    END $$;
    """
    op.execute(revert_sql)
