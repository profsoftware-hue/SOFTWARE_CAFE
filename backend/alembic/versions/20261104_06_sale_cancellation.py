"""Anulación de ventas y nota crédito

Revision ID: 20261104_06
Revises: 20261103_05
Create Date: 2026-11-04
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20261104_06"
down_revision: str | None = "20261103_05"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text("ALTER TABLE ccp.sales ADD COLUMN IF NOT EXISTS cancellation_number varchar(40)"))
    bind.execute(sa.text("ALTER TABLE ccp.sales ADD COLUMN IF NOT EXISTS cancellation_type varchar(20)"))
    bind.execute(sa.text("ALTER TABLE ccp.sales ADD COLUMN IF NOT EXISTS cancellation_reason text"))
    bind.execute(sa.text("ALTER TABLE ccp.sales ADD COLUMN IF NOT EXISTS cancelled_at timestamptz"))
    bind.execute(sa.text("ALTER TABLE ccp.sales ADD COLUMN IF NOT EXISTS cancelled_by bigint"))

    bind.execute(
        sa.text(
            """
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sales_cancelled_by'
                ) THEN
                    ALTER TABLE ccp.sales
                    ADD CONSTRAINT fk_sales_cancelled_by
                    FOREIGN KEY (cancelled_by) REFERENCES ccp.users(id) ON DELETE SET NULL;
                END IF;
            END $$;
            """
        )
    )

    bind.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_cancellation_number
            ON ccp.sales (cancellation_number)
            WHERE cancellation_number IS NOT NULL
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("DROP INDEX IF EXISTS ccp.ux_sales_cancellation_number"))
    bind.execute(sa.text("ALTER TABLE ccp.sales DROP CONSTRAINT IF EXISTS fk_sales_cancelled_by"))
    for column in (
        "cancelled_by",
        "cancelled_at",
        "cancellation_reason",
        "cancellation_type",
        "cancellation_number",
    ):
        bind.execute(sa.text(f"ALTER TABLE ccp.sales DROP COLUMN IF EXISTS {column}"))
