"""Agrega tipos de documento TI y PPT

Revision ID: 20261103_05
Revises: 20261103_04
Create Date: 2026-11-03
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20261103_05"
down_revision: str | None = "20261103_04"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TYPE ccp.document_type ADD VALUE IF NOT EXISTS 'TI'"))
    op.execute(sa.text("ALTER TYPE ccp.document_type ADD VALUE IF NOT EXISTS 'PPT'"))


def downgrade() -> None:
    """PostgreSQL no permite quitar valores de un ENUM de forma sencilla."""
