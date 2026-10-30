"""Agrega QR a los medios de pago

Revision ID: 20261030_03
Revises: 20261030_02
Create Date: 2026-10-30
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20261030_03"
down_revision: str | None = "20261030_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TYPE ccp.payment_method ADD VALUE IF NOT EXISTS 'QR'"))


def downgrade() -> None:
    """PostgreSQL no permite eliminar valores de un ENUM de forma sencilla."""
