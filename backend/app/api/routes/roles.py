from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import effective_permission_codes, require_any_permission, require_permissions
from app.db.session import get_db
from app.models.user import Permission, Role, User, UserRole
from app.schemas.user import (
    PermissionOut,
    RoleCreate,
    RoleDetailOut,
    RoleUpdate,
)


router = APIRouter(tags=["Seguridad"])

ROLE_CODE_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]{2,29}$")


def _resolve_permissions(db: Session, permission_codes: list[str] | None) -> list[Permission]:
    if not permission_codes:
        return []

    normalized = sorted({code.strip().lower() for code in permission_codes if code.strip()})
    permissions = db.scalars(select(Permission).where(Permission.code.in_(normalized))).all()
    found = {permission.code for permission in permissions}
    missing = sorted(set(normalized) - found)
    if missing:
        raise HTTPException(status_code=400, detail=f"Permisos inválidos: {', '.join(missing)}")
    return list(permissions)


def _user_counts(db: Session) -> dict[int, int]:
    rows = db.execute(
        select(UserRole.role_id, func.count(UserRole.user_id)).group_by(UserRole.role_id)
    ).all()
    return {role_id: total for role_id, total in rows}


def _role_detail(role: Role, user_counts: dict[int, int]) -> RoleDetailOut:
    detail = RoleDetailOut.model_validate(role)
    detail.user_count = user_counts.get(role.id, 0)
    return detail


def _is_admin(user: User) -> bool:
    return any(role.code.upper() == "ADMIN" for role in user.roles)


def _ensure_actor_can_grant(actor: User, permission_codes: list[str]) -> None:
    if _is_admin(actor):
        return
    requested = {code.strip().lower() for code in permission_codes if code.strip()}
    if not requested.issubset(effective_permission_codes(actor)):
        raise HTTPException(
            status_code=403,
            detail="No puedes asignar permisos que tú no tienes",
        )


def _ensure_actor_can_edit_role(actor: User, role: Role) -> None:
    if _is_admin(actor):
        return
    if role.is_system:
        raise HTTPException(status_code=403, detail="Solo un administrador puede modificar roles del sistema")
    if role.id in {item.id for item in actor.roles}:
        raise HTTPException(status_code=403, detail="No puedes modificar un rol asignado a tu propio usuario")
    role_permissions = {permission.code.lower() for permission in role.permissions}
    if not role_permissions.issubset(effective_permission_codes(actor)):
        raise HTTPException(
            status_code=403,
            detail="Solo un administrador puede modificar roles con permisos superiores",
        )


@router.get("/permissions", response_model=list[PermissionOut])
def list_permissions(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("roles.view")),
) -> list[Permission]:
    stmt = select(Permission).order_by(Permission.module.asc(), Permission.name.asc())
    return list(db.scalars(stmt).all())


@router.get("/roles", response_model=list[RoleDetailOut])
def list_roles(
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("roles.view", "users.view")),
) -> list[RoleDetailOut]:
    stmt = (
        select(Role)
        .options(selectinload(Role.permissions))
        .order_by(Role.is_system.desc(), Role.name.asc())
    )
    roles = db.scalars(stmt).all()
    counts = _user_counts(db)
    return [_role_detail(role, counts) for role in roles]


@router.post("/roles", response_model=RoleDetailOut, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("roles.manage")),
) -> RoleDetailOut:
    code = payload.code.strip().upper()
    if not ROLE_CODE_PATTERN.fullmatch(code):
        raise HTTPException(
            status_code=400,
            detail="El código del rol debe iniciar con letra y usar solo mayúsculas, números o guion bajo.",
        )

    if db.scalar(select(Role.id).where(Role.code == code)) is not None:
        raise HTTPException(status_code=400, detail=f"El rol '{code}' ya existe")

    role = Role(
        code=code,
        name=payload.name.strip(),
        description=(payload.description or "").strip() or None,
        is_system=False,
    )
    _ensure_actor_can_grant(current_user, payload.permission_codes)
    role.permissions = _resolve_permissions(db, payload.permission_codes)
    db.add(role)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo crear el rol") from exc

    db.refresh(role)
    return _role_detail(role, _user_counts(db))


@router.put("/roles/{role_id}", response_model=RoleDetailOut)
def update_role(
    role_id: int,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("roles.manage")),
) -> RoleDetailOut:
    stmt = select(Role).options(selectinload(Role.permissions)).where(Role.id == role_id)
    role = db.scalar(stmt)
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    _ensure_actor_can_edit_role(current_user, role)
    if payload.permission_codes is not None:
        _ensure_actor_can_grant(current_user, payload.permission_codes)

    data = payload.model_dump(exclude_unset=True)

    if "name" in data and data["name"] is not None:
        role.name = data["name"].strip()
    if "description" in data:
        role.description = (data["description"] or "").strip() or None

    if payload.permission_codes is not None:
        if role.code.upper() == "ADMIN":
            raise HTTPException(status_code=400, detail="El rol ADMIN siempre conserva todos los permisos")
        role.permissions = _resolve_permissions(db, payload.permission_codes)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo actualizar el rol") from exc

    db.refresh(role)
    return _role_detail(role, _user_counts(db))


@router.delete("/roles/{role_id}")
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("roles.manage")),
) -> dict[str, str]:
    stmt = select(Role).options(selectinload(Role.permissions)).where(Role.id == role_id)
    role = db.scalar(stmt)
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    _ensure_actor_can_edit_role(current_user, role)
    if role.is_system:
        raise HTTPException(status_code=400, detail="Los roles del sistema no se pueden eliminar")

    assigned = db.scalar(
        select(func.count(UserRole.user_id)).where(UserRole.role_id == role_id)
    ) or 0
    if assigned > 0:
        raise HTTPException(
            status_code=409,
            detail="El rol tiene usuarios asignados. Reasigna esos usuarios antes de eliminarlo.",
        )

    role.permissions.clear()
    db.delete(role)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo eliminar el rol") from exc

    return {"message": "Rol eliminado correctamente"}
