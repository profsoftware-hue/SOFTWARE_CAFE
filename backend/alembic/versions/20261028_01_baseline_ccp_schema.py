"""Baseline CCP schema

Revision ID: 20261028_01
Revises:
Create Date: 2026-10-28
"""

from typing import Sequence


# revision identifiers, used by Alembic.
revision: str = "20261028_01"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Baseline no-op: el esquema fue creado previamente vía SQL aprobado en Fase 1."""


def downgrade() -> None:
    """No-op para baseline."""
