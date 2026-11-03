"""Datos de terceros y facturación electrónica

Revision ID: 20261103_04
Revises: 20261030_03
Create Date: 2026-11-03
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20261103_04"
down_revision: str | None = "20261030_03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()

    bind.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE ccp.customer_type AS ENUM ('NATURAL', 'COMPANY');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )
    bind.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE ccp.document_type AS ENUM ('CC', 'NIT', 'CE', 'PASSPORT');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )

    bind.execute(sa.text("ALTER TABLE ccp.customers ADD COLUMN IF NOT EXISTS customer_type ccp.customer_type NOT NULL DEFAULT 'NATURAL'"))
    bind.execute(sa.text("ALTER TABLE ccp.customers ADD COLUMN IF NOT EXISTS first_name varchar(80)"))
    bind.execute(sa.text("ALTER TABLE ccp.customers ADD COLUMN IF NOT EXISTS last_name varchar(80)"))
    bind.execute(sa.text("ALTER TABLE ccp.customers ADD COLUMN IF NOT EXISTS business_name varchar(180)"))
    bind.execute(sa.text("ALTER TABLE ccp.customers ADD COLUMN IF NOT EXISTS document_type ccp.document_type NOT NULL DEFAULT 'CC'"))

    bind.execute(sa.text("ALTER TABLE ccp.sales ADD COLUMN IF NOT EXISTS invoice_requested boolean NOT NULL DEFAULT false"))
    bind.execute(sa.text("ALTER TABLE ccp.sales ADD COLUMN IF NOT EXISTS invoice_customer_name varchar(180)"))
    bind.execute(sa.text("ALTER TABLE ccp.sales ADD COLUMN IF NOT EXISTS invoice_customer_document_type ccp.document_type"))
    bind.execute(sa.text("ALTER TABLE ccp.sales ADD COLUMN IF NOT EXISTS invoice_customer_document_number varchar(40)"))
    bind.execute(sa.text("ALTER TABLE ccp.sales ADD COLUMN IF NOT EXISTS invoice_customer_email varchar(120)"))
    bind.execute(sa.text("ALTER TABLE ccp.sales ADD COLUMN IF NOT EXISTS invoice_customer_phone varchar(40)"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_sales_invoice_requested ON ccp.sales (invoice_requested)"))


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("DROP INDEX IF EXISTS ccp.ix_sales_invoice_requested"))
    for column in (
        "invoice_customer_phone",
        "invoice_customer_email",
        "invoice_customer_document_number",
        "invoice_customer_document_type",
        "invoice_customer_name",
        "invoice_requested",
    ):
        bind.execute(sa.text(f"ALTER TABLE ccp.sales DROP COLUMN IF EXISTS {column}"))
    for column in ("document_type", "business_name", "last_name", "first_name", "customer_type"):
        bind.execute(sa.text(f"ALTER TABLE ccp.customers DROP COLUMN IF EXISTS {column}"))
    bind.execute(sa.text("DROP TYPE IF EXISTS ccp.document_type"))
    bind.execute(sa.text("DROP TYPE IF EXISTS ccp.customer_type"))
