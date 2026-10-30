"""Baseline CCP schema

Revision ID: 20261028_01
Revises:
Create Date: 2026-10-28

Aplica el esquema aprobado en Fase 1 cuando la base está vacía.
Si el esquema ya existe (instalaciones previas), no hace cambios.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Sequence

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20261028_01"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    schema_exists = bind.execute(sa.text("SELECT to_regclass('ccp.roles')")).scalar()
    if schema_exists is not None:
        return

    sql_path = Path(__file__).resolve().parents[3] / "fase1_sql_postgresql_ccp_pereira.sql"
    if not sql_path.exists():
        raise RuntimeError(f"No se encontró el esquema base: {sql_path}")

    sql = sql_path.read_text(encoding="utf-8")
    sql = re.sub(r"^\s*(BEGIN|COMMIT)\s*;\s*$", "", sql, flags=re.MULTILINE)
    op.execute(sql)


def downgrade() -> None:
    """El esquema base no se elimina automáticamente."""
