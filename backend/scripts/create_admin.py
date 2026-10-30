"""Crea el primer usuario administrador sin exponer un endpoint público.

Uso:
    python scripts/create_admin.py --username admin --email admin@ccp.local --name "Admin CCP"

Si no se pasa --password, se solicita de forma interactiva.
"""

from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.user import Role, User  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Crea el administrador inicial de CCP Pereira")
    parser.add_argument("--username", required=True, help="Usuario de acceso")
    parser.add_argument("--email", required=True, help="Correo del administrador")
    parser.add_argument("--name", required=True, help="Nombre completo")
    parser.add_argument("--password", help="Contraseña (si se omite, se solicita de forma interactiva)")
    args = parser.parse_args()

    password = args.password or getpass.getpass("Contraseña: ")
    if len(password) < 8:
        print("La contraseña debe tener al menos 8 caracteres.", file=sys.stderr)
        return 1

    with SessionLocal() as db:
        admin_role = db.scalar(select(Role).where(Role.code == "ADMIN"))
        if not admin_role:
            print("No existe el rol ADMIN. Ejecuta primero las migraciones.", file=sys.stderr)
            return 1

        existing = db.scalar(
            select(User).where(
                (User.username == args.username.strip()) | (User.email == args.email.strip())
            )
        )
        if existing:
            print("Ya existe un usuario con ese nombre de usuario o correo.", file=sys.stderr)
            return 1

        user = User(
            full_name=args.name.strip(),
            email=args.email.strip(),
            username=args.username.strip(),
            password_hash=hash_password(password),
            is_active=True,
        )
        user.roles = [admin_role]
        db.add(user)
        db.commit()

    print(f"Administrador '{args.username}' creado correctamente.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
