"""Actualiza razon social y NIT de la empresa

Revision ID: 20261104_07
Revises: 20261104_06
Create Date: 2026-11-04
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20261104_07"
down_revision: str | None = "20261104_06"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO ccp.company_profile (id, name, nit)
            VALUES (1, 'CAMARA DE COMERCIO DE PEREIRA', '891400669-6')
            ON CONFLICT (id) DO UPDATE
            SET name = EXCLUDED.name,
                nit = EXCLUDED.nit,
                updated_at = now()
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE ccp.company_profile
            SET name = 'FUNDACION NUESTRO FUTURO',
                nit = '902103270-7',
                updated_at = now()
            WHERE id = 1
            """
        )
    )
