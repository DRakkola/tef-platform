"""Create billing, subscriptions, orders, credits, ledger, and monetization tables.

Revision ID: 0016_billing_and_monetization
Revises: 0015_practice_pool_enhancements
Create Date: 2026-09-18 17:00:00.000000

"""

import datetime
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0016_billing_and_monetization"
down_revision: str | None = "0015_practice_pool_enhancements"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Deterministic Seed Product UUIDs
PROD_FREE_ID = uuid.UUID("11111111-1111-4111-8111-111111111111")
PROD_PREMIUM_ID = uuid.UUID("22222222-2222-4222-8222-222222222222")
PROD_CREDIT_SM_ID = uuid.UUID("33333333-3333-4333-8333-333333333333")
PROD_CREDIT_MD_ID = uuid.UUID("44444444-4444-4444-8444-444444444444")
PROD_CREDIT_LG_ID = uuid.UUID("55555555-5555-4555-8555-555555555555")
PROD_TEACHER_ID = uuid.UUID("66666666-6666-4666-8666-666666666666")
PROD_WRITING_ID = uuid.UUID("77777777-7777-4777-8777-777777777777")


def upgrade() -> None:
    # 1. products
    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sku", sa.String(length=64), nullable=False, unique=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("product_type", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("metadata", postgresql.JSON(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_products_sku", "products", ["sku"])
    op.create_index("ix_products_type", "products", ["product_type"])

    # 2. product_prices
    op.create_table(
        "product_prices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="EUR", nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("billing_interval", sa.String(length=20), server_default="one_time", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("provider_price_id", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_product_prices_product_id", "product_prices", ["product_id"])

    # 3. product_entitlements
    op.create_table(
        "product_entitlements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("feature_key", sa.String(length=64), nullable=False),
        sa.Column("entitlement_type", sa.String(length=32), server_default="boolean", nullable=False),
        sa.Column("limit_units", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_unlimited", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_product_entitlements_prod_feat", "product_entitlements", ["product_id", "feature_key"])

    # 4. subscriptions
    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("price_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("product_prices.id"), nullable=False),
        sa.Column("provider", sa.String(length=32), server_default="stripe", nullable=False),
        sa.Column("provider_subscription_id", sa.String(length=128), nullable=False, unique=True),
        sa.Column("provider_customer_id", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), server_default="active", nullable=False),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cancel_at_period_end", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])
    op.create_index("ix_subscriptions_prov_sub_id", "subscriptions", ["provider_subscription_id"])
    op.create_index("ix_subscriptions_status", "subscriptions", ["status"])

    # 5. orders
    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_number", sa.String(length=64), nullable=False, unique=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="EUR", nullable=False),
        sa.Column("subtotal_cents", sa.Integer(), nullable=False),
        sa.Column("tax_cents", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_cents", sa.Integer(), nullable=False),
        sa.Column("refunded_amount_cents", sa.Integer(), server_default="0", nullable=False),
        sa.Column("provider", sa.String(length=32), server_default="stripe", nullable=False),
        sa.Column("provider_order_reference", sa.String(length=128), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata", postgresql.JSON(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_orders_order_number", "orders", ["order_number"])
    op.create_index("ix_orders_user_id", "orders", ["user_id"])
    op.create_index("ix_orders_status", "orders", ["status"])
    op.create_index("ix_orders_prov_ref", "orders", ["provider_order_reference"])

    # 6. order_items
    op.create_table(
        "order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("price_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("product_prices.id"), nullable=False),
        sa.Column("quantity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("unit_price_cents", sa.Integer(), nullable=False),
        sa.Column("total_price_cents", sa.Integer(), nullable=False),
        sa.Column("metadata", postgresql.JSON(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"])

    # 7. credit_accounts
    op.create_table(
        "credit_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("balance", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_credit_accounts_user_id", "credit_accounts", ["user_id"])

    # 8. credit_grants
    op.create_table(
        "credit_grants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initial_credits", sa.Integer(), nullable=False),
        sa.Column("remaining_credits", sa.Integer(), nullable=False),
        sa.Column("grant_type", sa.String(length=32), server_default="purchase", nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("granted_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_credit_grants_user_id", "credit_grants", ["user_id"])
    op.create_index("ix_credit_grants_remaining", "credit_grants", ["remaining_credits"])
    op.create_index("ix_credit_grants_expires_at", "credit_grants", ["expires_at"])
    op.create_index("ix_credit_grants_user_rem_exp", "credit_grants", ["user_id", "remaining_credits", "expires_at"])

    # 9. credit_consumptions
    op.create_table(
        "credit_consumptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("credits_consumed", sa.Integer(), nullable=False),
        sa.Column("feature_key", sa.String(length=64), nullable=False),
        sa.Column("reference_id", sa.String(length=128), nullable=True),
        sa.Column("reference_type", sa.String(length=64), nullable=True),
        sa.Column("grant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("credit_grants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_credit_consumptions_user_id", "credit_consumptions", ["user_id"])
    op.create_index("ix_credit_consumptions_feature_key", "credit_consumptions", ["feature_key"])

    # 10. billing_ledger_entries
    op.create_table(
        "billing_ledger_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entry_type", sa.String(length=32), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="EUR", nullable=False),
        sa.Column("reference_type", sa.String(length=64), nullable=False),
        sa.Column("reference_id", sa.String(length=128), nullable=False),
        sa.Column("provider", sa.String(length=32), server_default="stripe", nullable=False),
        sa.Column("provider_reference", sa.String(length=128), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_billing_ledger_user_id", "billing_ledger_entries", ["user_id"])
    op.create_index("ix_billing_ledger_entry_type", "billing_ledger_entries", ["entry_type"])
    op.create_index("ix_billing_ledger_ref_type_id", "billing_ledger_entries", ["reference_type", "reference_id"])

    # 11. payment_webhook_events
    op.create_table(
        "payment_webhook_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("provider", sa.String(length=32), server_default="stripe", nullable=False),
        sa.Column("provider_event_id", sa.String(length=128), nullable=False, unique=True),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=32), server_default="received", nullable=False),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("raw_payload", postgresql.JSON(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_payment_webhooks_prov_event", "payment_webhook_events", ["provider", "provider_event_id"])
    op.create_index("ix_payment_webhooks_status", "payment_webhook_events", ["status"])

    # 12. booking_reservations
    op.create_table(
        "booking_reservations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slot_identifier", sa.String(length=128), nullable=False, unique=True),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("teacher_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teacher_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="held", nullable=False),
        sa.Column("checkout_session_id", sa.String(length=128), nullable=True),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teacher_bookings.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_booking_res_slot_id", "booking_reservations", ["slot_identifier"])
    op.create_index("ix_booking_res_teacher_id", "booking_reservations", ["teacher_id"])
    op.create_index("ix_booking_res_student_id", "booking_reservations", ["student_id"])
    op.create_index("ix_booking_res_status_exp", "booking_reservations", ["status", "expires_at"])

    # 13. teacher_earnings
    op.create_table(
        "teacher_earnings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("teacher_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teacher_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teacher_bookings.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("gross_amount_cents", sa.Integer(), nullable=False),
        sa.Column("platform_fee_cents", sa.Integer(), nullable=False),
        sa.Column("net_amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="EUR", nullable=False),
        sa.Column("commission_rate_bps", sa.Integer(), server_default="2000", nullable=False),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_teacher_earnings_teacher_id", "teacher_earnings", ["teacher_id"])
    op.create_index("ix_teacher_earnings_booking_id", "teacher_earnings", ["booking_id"])
    op.create_index("ix_teacher_earnings_status", "teacher_earnings", ["status"])

    # 14. ai_usage_records
    op.create_table(
        "ai_usage_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("feature", sa.String(length=64), nullable=False),
        sa.Column("provider", sa.String(length=64), server_default="anthropic", nullable=False),
        sa.Column("model", sa.String(length=64), nullable=False),
        sa.Column("units", sa.Integer(), server_default="1", nullable=False),
        sa.Column("audio_seconds", sa.Integer(), nullable=True),
        sa.Column("credits_consumed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ai_usage_user_feature", "ai_usage_records", ["user_id", "feature"])

    # 15. coupons
    op.create_table(
        "coupons",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(length=32), nullable=False, unique=True),
        sa.Column("discount_type", sa.String(length=20), server_default="percentage", nullable=False),
        sa.Column("discount_value", sa.Integer(), nullable=False),
        sa.Column("max_redemptions", sa.Integer(), nullable=True),
        sa.Column("times_redeemed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_coupons_code", "coupons", ["code"])

    # 16. user_entitlement_grants
    op.create_table(
        "user_entitlement_grants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("feature_key", sa.String(length=64), nullable=False),
        sa.Column("source", sa.String(length=32), server_default="admin_grant", nullable=False),
        sa.Column("granted_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_user_entitlements_user_key", "user_entitlement_grants", ["user_id", "feature_key"])

    # ----------------------------------------------------
    # SEED DEFAULT PRODUCTS & PRICES
    # ----------------------------------------------------
    now = datetime.datetime.now(datetime.UTC)

    # Products seed
    products_table = sa.table(
        "products",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("sku", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("product_type", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("metadata", postgresql.JSON),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    prices_table = sa.table(
        "product_prices",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("product_id", postgresql.UUID(as_uuid=True)),
        sa.column("currency", sa.String),
        sa.column("amount_cents", sa.Integer),
        sa.column("billing_interval", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("provider_price_id", sa.String),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    entitlements_table = sa.table(
        "product_entitlements",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("product_id", postgresql.UUID(as_uuid=True)),
        sa.column("feature_key", sa.String),
        sa.column("entitlement_type", sa.String),
        sa.column("limit_units", sa.Integer),
        sa.column("is_unlimited", sa.Boolean),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )

    op.bulk_insert(
        products_table,
        [
            {
                "id": PROD_FREE_ID,
                "sku": "tef-free",
                "name": "TEF Découverte (Gratuit)",
                "description": "Accès d'initiation aux épreuves TEF avec simulations limitées et exercices de base.",
                "product_type": "subscription",
                "is_active": True,
                "metadata": {"badge": "Gratuit", "highlight": False},
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": PROD_PREMIUM_ID,
                "sku": "tef-premium",
                "name": "TEF Réussite Pro",
                "description": "Préparation complète : simulations d'examens illimitées, corrections IA avancées, et studio de révision.",
                "product_type": "subscription",
                "is_active": True,
                "metadata": {"badge": "Recommandé", "highlight": True},
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": PROD_CREDIT_SM_ID,
                "sku": "credit-pack-small",
                "name": "Pack Crédits Découverte (10 crédits)",
                "description": "Idéal pour 10 évaluations écrites IA ou 5 sessions orales guidées.",
                "product_type": "credit_pack",
                "is_active": True,
                "metadata": {"credits": 10},
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": PROD_CREDIT_MD_ID,
                "sku": "credit-pack-medium",
                "name": "Pack Crédits Avancé (25 crédits)",
                "description": "Le pack le plus populaire pour un entraînement régulier aux épreuves d'expression.",
                "product_type": "credit_pack",
                "is_active": True,
                "metadata": {"credits": 25},
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": PROD_CREDIT_LG_ID,
                "sku": "credit-pack-large",
                "name": "Pack Crédits Intensif (60 crédits)",
                "description": "Volume maximal de crédits pour candidats en phase finale d'examen intensif.",
                "product_type": "credit_pack",
                "is_active": True,
                "metadata": {"credits": 60},
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": PROD_TEACHER_ID,
                "sku": "teacher-lesson-1h",
                "name": "Session Particulière Professeur (1 Heure)",
                "description": "Entraînement individuel 1-à-1 avec un professeur certifié TEF.",
                "product_type": "teacher_lesson",
                "is_active": True,
                "metadata": {"duration_minutes": 60},
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": PROD_WRITING_ID,
                "sku": "writing-correction-human",
                "name": "Correction Écrite par Examinateur Certifié",
                "description": "Correction humaine approfondie avec grille officielle CCI Paris Île-de-France et conseils personnalisés.",
                "product_type": "writing_correction",
                "is_active": True,
                "metadata": {"type": "human_writing"},
                "created_at": now,
                "updated_at": now,
            },
        ],
    )

    # Prices seed
    op.bulk_insert(
        prices_table,
        [
            # Free tier price (0 EUR)
            {
                "id": uuid.uuid4(),
                "product_id": PROD_FREE_ID,
                "currency": "EUR",
                "amount_cents": 0,
                "billing_interval": "monthly",
                "is_active": True,
                "provider_price_id": "price_free_tier",
                "created_at": now,
                "updated_at": now,
            },
            # Premium Monthly (29 EUR)
            {
                "id": uuid.UUID("22222222-2222-4222-8222-222222222223"),
                "product_id": PROD_PREMIUM_ID,
                "currency": "EUR",
                "amount_cents": 2900,
                "billing_interval": "monthly",
                "is_active": True,
                "provider_price_id": "price_premium_monthly",
                "created_at": now,
                "updated_at": now,
            },
            # Premium Annual (240 EUR)
            {
                "id": uuid.UUID("22222222-2222-4222-8222-222222222224"),
                "product_id": PROD_PREMIUM_ID,
                "currency": "EUR",
                "amount_cents": 24000,
                "billing_interval": "annual",
                "is_active": True,
                "provider_price_id": "price_premium_annual",
                "created_at": now,
                "updated_at": now,
            },
            # Credit Pack Small (15 EUR)
            {
                "id": uuid.UUID("33333333-3333-4333-8333-333333333334"),
                "product_id": PROD_CREDIT_SM_ID,
                "currency": "EUR",
                "amount_cents": 1500,
                "billing_interval": "one_time",
                "is_active": True,
                "provider_price_id": "price_credits_sm",
                "created_at": now,
                "updated_at": now,
            },
            # Credit Pack Medium (30 EUR)
            {
                "id": uuid.UUID("44444444-4444-4444-8444-444444444445"),
                "product_id": PROD_CREDIT_MD_ID,
                "currency": "EUR",
                "amount_cents": 3000,
                "billing_interval": "one_time",
                "is_active": True,
                "provider_price_id": "price_credits_md",
                "created_at": now,
                "updated_at": now,
            },
            # Credit Pack Large (60 EUR)
            {
                "id": uuid.UUID("55555555-5555-4555-8555-555555555556"),
                "product_id": PROD_CREDIT_LG_ID,
                "currency": "EUR",
                "amount_cents": 6000,
                "billing_interval": "one_time",
                "is_active": True,
                "provider_price_id": "price_credits_lg",
                "created_at": now,
                "updated_at": now,
            },
            # Teacher Lesson 1h (40 EUR)
            {
                "id": uuid.UUID("66666666-6666-4666-8666-666666666667"),
                "product_id": PROD_TEACHER_ID,
                "currency": "EUR",
                "amount_cents": 4000,
                "billing_interval": "one_time",
                "is_active": True,
                "provider_price_id": "price_teacher_lesson",
                "created_at": now,
                "updated_at": now,
            },
            # Human Writing Correction (12 EUR)
            {
                "id": uuid.UUID("77777777-7777-4777-8777-777777777778"),
                "product_id": PROD_WRITING_ID,
                "currency": "EUR",
                "amount_cents": 1200,
                "billing_interval": "one_time",
                "is_active": True,
                "provider_price_id": "price_human_writing",
                "created_at": now,
                "updated_at": now,
            },
        ],
    )

    # Entitlements seed
    op.bulk_insert(
        entitlements_table,
        [
            # Free tier entitlements
            {
                "id": uuid.uuid4(),
                "product_id": PROD_FREE_ID,
                "feature_key": "mock_tests",
                "entitlement_type": "quota",
                "limit_units": 2,
                "is_unlimited": False,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": uuid.uuid4(),
                "product_id": PROD_FREE_ID,
                "feature_key": "exercises",
                "entitlement_type": "quota",
                "limit_units": 10,
                "is_unlimited": False,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": uuid.uuid4(),
                "product_id": PROD_FREE_ID,
                "feature_key": "ai_writing",
                "entitlement_type": "quota",
                "limit_units": 3,
                "is_unlimited": False,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": uuid.uuid4(),
                "product_id": PROD_FREE_ID,
                "feature_key": "ai_speaking",
                "entitlement_type": "quota",
                "limit_units": 3,
                "is_unlimited": False,
                "created_at": now,
                "updated_at": now,
            },
            # Premium entitlements
            {
                "id": uuid.uuid4(),
                "product_id": PROD_PREMIUM_ID,
                "feature_key": "unlimited_mock_tests",
                "entitlement_type": "boolean",
                "limit_units": 0,
                "is_unlimited": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": uuid.uuid4(),
                "product_id": PROD_PREMIUM_ID,
                "feature_key": "premium_exercises",
                "entitlement_type": "boolean",
                "limit_units": 0,
                "is_unlimited": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": uuid.uuid4(),
                "product_id": PROD_PREMIUM_ID,
                "feature_key": "progress_dashboard",
                "entitlement_type": "boolean",
                "limit_units": 0,
                "is_unlimited": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": uuid.uuid4(),
                "product_id": PROD_PREMIUM_ID,
                "feature_key": "ai_writing_monthly_limit",
                "entitlement_type": "quota",
                "limit_units": 50,
                "is_unlimited": False,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": uuid.uuid4(),
                "product_id": PROD_PREMIUM_ID,
                "feature_key": "ai_speaking_monthly_limit",
                "entitlement_type": "quota",
                "limit_units": 30,
                "is_unlimited": False,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": uuid.uuid4(),
                "product_id": PROD_PREMIUM_ID,
                "feature_key": "speaking_practice",
                "entitlement_type": "boolean",
                "limit_units": 0,
                "is_unlimited": True,
                "created_at": now,
                "updated_at": now,
            },
            # Credit packs entitlements
            {
                "id": uuid.uuid4(),
                "product_id": PROD_CREDIT_SM_ID,
                "feature_key": "credits",
                "entitlement_type": "quota",
                "limit_units": 10,
                "is_unlimited": False,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": uuid.uuid4(),
                "product_id": PROD_CREDIT_MD_ID,
                "feature_key": "credits",
                "entitlement_type": "quota",
                "limit_units": 25,
                "is_unlimited": False,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": uuid.uuid4(),
                "product_id": PROD_CREDIT_LG_ID,
                "feature_key": "credits",
                "entitlement_type": "quota",
                "limit_units": 60,
                "is_unlimited": False,
                "created_at": now,
                "updated_at": now,
            },
            # Teacher lesson entitlement
            {
                "id": uuid.uuid4(),
                "product_id": PROD_TEACHER_ID,
                "feature_key": "teacher_lesson",
                "entitlement_type": "quota",
                "limit_units": 1,
                "is_unlimited": False,
                "created_at": now,
                "updated_at": now,
            },
            # Writing correction entitlement
            {
                "id": uuid.uuid4(),
                "product_id": PROD_WRITING_ID,
                "feature_key": "human_writing_correction",
                "entitlement_type": "quota",
                "limit_units": 1,
                "is_unlimited": False,
                "created_at": now,
                "updated_at": now,
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("user_entitlement_grants")
    op.drop_table("coupons")
    op.drop_table("ai_usage_records")
    op.drop_table("teacher_earnings")
    op.drop_table("booking_reservations")
    op.drop_table("payment_webhook_events")
    op.drop_table("billing_ledger_entries")
    op.drop_table("credit_consumptions")
    op.drop_table("credit_grants")
    op.drop_table("credit_accounts")
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("subscriptions")
    op.drop_table("product_entitlements")
    op.drop_table("product_prices")
    op.drop_table("products")
