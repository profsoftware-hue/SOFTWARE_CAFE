"""Roles y permisos (RBAC)

Revision ID: 20261030_02
Revises: 20261028_01
Create Date: 2026-10-30

Agrega el catálogo de permisos, la relación rol-permiso y los permisos
predeterminados de los roles del sistema. Es idempotente para instalaciones
existentes que ya tienen el esquema base.
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20261030_02"
down_revision: str | None = "20261028_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


PERMISSIONS = [
    ("dashboard.view", "General", "Ver dashboard", "Acceso al resumen general del sistema."),
    ("inventory.view", "Inventario", "Ver inventario", "Consultar productos, existencias, kardex y movimientos."),
    (
        "inventory.manage",
        "Inventario",
        "Gestionar inventario",
        "Crear y editar productos, compras, entradas y ajustes.",
    ),
    ("sales.create", "Ventas", "Registrar ventas", "Usar el POS, registrar ventas y consultar recibos."),
    ("reports.view", "Reportes", "Ver reportes", "Consultar reportes, indicadores y cierres diarios."),
    ("users.view", "Seguridad", "Ver usuarios", "Consultar el listado de usuarios del sistema."),
    (
        "users.manage",
        "Seguridad",
        "Gestionar usuarios",
        "Crear, editar y activar o desactivar usuarios.",
    ),
    ("roles.view", "Seguridad", "Ver roles y permisos", "Consultar roles, permisos y su asignación."),
    (
        "roles.manage",
        "Seguridad",
        "Gestionar roles y permisos",
        "Crear roles y modificar sus permisos.",
    ),
    ("settings.view", "Configuración", "Ver configuración", "Consultar la configuración del sistema."),
    (
        "settings.manage",
        "Configuración",
        "Gestionar configuración",
        "Modificar parámetros operativos del sistema.",
    ),
]

DEFAULT_ROLE_PERMISSIONS = {
    "ADMIN": [code for code, _, _, _ in PERMISSIONS],
    "SELLER": ["dashboard.view", "inventory.view", "sales.create", "reports.view", "settings.view"],
    "WAREHOUSE": [
        "dashboard.view",
        "inventory.view",
        "inventory.manage",
        "reports.view",
        "settings.view",
    ],
}


def upgrade() -> None:
    bind = op.get_bind()

    bind.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS ccp.permissions (
                id serial PRIMARY KEY,
                code varchar(80) NOT NULL UNIQUE,
                module varchar(40) NOT NULL,
                name varchar(100) NOT NULL,
                description text,
                created_at timestamptz NOT NULL DEFAULT now()
            )
            """
        )
    )
    bind.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS ccp.role_permissions (
                role_id integer NOT NULL REFERENCES ccp.roles(id) ON DELETE CASCADE,
                permission_id integer NOT NULL REFERENCES ccp.permissions(id) ON DELETE CASCADE,
                PRIMARY KEY (role_id, permission_id)
            )
            """
        )
    )
    bind.execute(sa.text("ALTER TABLE ccp.roles ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false"))
    bind.execute(sa.text("UPDATE ccp.roles SET is_system = true WHERE code IN ('ADMIN', 'SELLER', 'WAREHOUSE')"))

    bind.execute(
        sa.text(
            """
            INSERT INTO ccp.permissions (code, module, name, description)
            VALUES (:code, :module, :name, :description)
            ON CONFLICT (code) DO UPDATE SET
                module = EXCLUDED.module,
                name = EXCLUDED.name,
                description = EXCLUDED.description
            """
        ),
        [
            {"code": code, "module": module, "name": name, "description": description}
            for code, module, name, description in PERMISSIONS
        ],
    )

    for role_code, permission_codes in DEFAULT_ROLE_PERMISSIONS.items():
        for permission_code in permission_codes:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO ccp.role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM ccp.roles r, ccp.permissions p
                    WHERE r.code = :role_code AND p.code = :permission_code
                    ON CONFLICT DO NOTHING
                    """
                ),
                {"role_code": role_code, "permission_code": permission_code},
            )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("DROP TABLE IF EXISTS ccp.role_permissions"))
    bind.execute(sa.text("DROP TABLE IF EXISTS ccp.permissions"))
    bind.execute(sa.text("ALTER TABLE ccp.roles DROP COLUMN IF EXISTS is_system"))
