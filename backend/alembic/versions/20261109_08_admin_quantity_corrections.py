"""Correcciones administrativas de cantidades

Revision ID: 20261109_08
Revises: 20261104_07
Create Date: 2026-11-09
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20261109_08"
down_revision: str | None = "20261104_07"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()

    bind.execute(
        sa.text(
            "ALTER TABLE ccp.sale_items "
            "ADD COLUMN IF NOT EXISTS quantity_correction numeric(14,3) NOT NULL DEFAULT 0"
        )
    )

    bind.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS ccp.quantity_corrections (
                id bigserial PRIMARY KEY,
                correction_type varchar(20) NOT NULL,
                sale_id bigint REFERENCES ccp.sales(id) ON DELETE SET NULL,
                sale_item_id bigint REFERENCES ccp.sale_items(id) ON DELETE SET NULL,
                product_id bigint NOT NULL REFERENCES ccp.products(id) ON DELETE RESTRICT,
                warehouse_id bigint NOT NULL REFERENCES ccp.warehouses(id) ON DELETE RESTRICT,
                previous_quantity numeric(14,3) NOT NULL,
                corrected_quantity numeric(14,3) NOT NULL,
                difference numeric(14,3) NOT NULL,
                reason text NOT NULL,
                adjustment_id bigint REFERENCES ccp.inventory_adjustments(id) ON DELETE SET NULL,
                created_by bigint REFERENCES ccp.users(id) ON DELETE SET NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT chk_quantity_corrections_type
                    CHECK (correction_type IN ('SALE', 'INVENTORY')),
                CONSTRAINT chk_quantity_corrections_quantities
                    CHECK (previous_quantity >= 0 AND corrected_quantity >= 0)
            )
            """
        )
    )

    bind.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_quantity_corrections_sale_item "
            "ON ccp.quantity_corrections (sale_item_id)"
        )
    )
    bind.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_quantity_corrections_product_warehouse "
            "ON ccp.quantity_corrections (product_id, warehouse_id)"
        )
    )
    bind.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_quantity_corrections_created_at "
            "ON ccp.quantity_corrections (created_at DESC)"
        )
    )

    bind.execute(
        sa.text(
            """
            INSERT INTO ccp.permissions (code, module, name, description)
            VALUES (
                'corrections.manage',
                'Correcciones',
                'Corregir cantidades',
                'Corrige cantidades de ventas y stock sin modificar los valores facturados.'
            )
            ON CONFLICT (code) DO UPDATE
            SET module = EXCLUDED.module,
                name = EXCLUDED.name,
                description = EXCLUDED.description
            """
        )
    )
    bind.execute(
        sa.text(
            """
            INSERT INTO ccp.role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM ccp.roles r
            CROSS JOIN ccp.permissions p
            WHERE r.code = 'ADMIN' AND p.code = 'corrections.manage'
            ON CONFLICT DO NOTHING
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            DELETE FROM ccp.role_permissions
            WHERE permission_id IN (
                SELECT id FROM ccp.permissions WHERE code = 'corrections.manage'
            )
            """
        )
    )
    bind.execute(sa.text("DELETE FROM ccp.permissions WHERE code = 'corrections.manage'"))
    bind.execute(sa.text("DROP TABLE IF EXISTS ccp.quantity_corrections"))
    bind.execute(sa.text("ALTER TABLE ccp.sale_items DROP COLUMN IF EXISTS quantity_correction"))
