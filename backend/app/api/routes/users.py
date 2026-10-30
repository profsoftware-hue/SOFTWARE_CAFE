from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import effective_permission_codes, require_permissions
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import Role, User, UserRole
from app.schemas.user import UserCreate, UserOut, UserUpdate


router = APIRouter(prefix="/users", tags=["Usuarios"])


def _resolve_roles(db: Session, role_codes: list[str] | None) -> list[Role]:
    if not role_codes:
        raise HTTPException(status_code=400, detail="Selecciona al menos un rol para el usuario")

    normalized = sorted({code.strip().upper() for code in role_codes if code.strip()})
    roles = db.scalars(select(Role).where(Role.code.in_(normalized))).all()
    found = {role.code for role in roles}
    missing = sorted(set(normalized) - found)
    if missing:
        raise HTTPException(status_code=400, detail=f"Roles inválidos: {', '.join(missing)}")
    return list(roles)


def _is_admin(user: User) -> bool:
    return any(role.code.upper() == "ADMIN" for role in user.roles)


def _roles_permission_codes(roles: list[Role]) -> set[str]:
    return {permission.code.lower() for role in roles for permission in role.permissions}


def _ensure_actor_can_manage(
    actor: User,
    target: User | None,
    new_roles: list[Role] | None,
) -> None:
    """Evita que un gestor de usuarios se asigne permisos superiores o tome cuentas ADMIN."""
    if _is_admin(actor):
        return

    if target is not None:
        target_permissions = _roles_permission_codes(target.roles)
        if _is_admin(target) or not target_permissions.issubset(effective_permission_codes(actor)):
            raise HTTPException(
                status_code=403,
                detail="Solo un administrador puede modificar usuarios con permisos superiores",
            )

    if new_roles is not None:
        if any(role.code.upper() == "ADMIN" for role in new_roles):
            raise HTTPException(status_code=403, detail="Solo un administrador puede asignar el rol ADMIN")
        if not _roles_permission_codes(new_roles).issubset(effective_permission_codes(actor)):
            raise HTTPException(
                status_code=403,
                detail="No puedes asignar roles con permisos que tú no tienes",
            )


def _lock_admin_guard(db: Session) -> None:
    """Serializa los cambios de administradores para no quedarse sin ningún ADMIN activo."""
    db.execute(text("SELECT pg_advisory_xact_lock(:lock_key)"), {"lock_key": 77120304})


def _other_active_admins(db: Session, user_id: int) -> int:
    return (
        db.scalar(
            select(func.count(func.distinct(User.id)))
            .select_from(User)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                Role.code == "ADMIN",
                User.is_active.is_(True),
                User.id != user_id,
            )
        )
        or 0
    )


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("users.view")),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[User]:
    stmt = select(User).options(selectinload(User.roles)).offset(offset).limit(limit).order_by(User.id.desc())
    return list(db.scalars(stmt).all())


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("users.manage")),
) -> User:
    roles = _resolve_roles(db, payload.role_codes)
    _ensure_actor_can_manage(current_user, None, roles)

    user = User(
        full_name=payload.full_name.strip(),
        email=str(payload.email),
        username=payload.username.strip(),
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    user.roles = roles
    db.add(user)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="El usuario o correo ya existe") from exc

    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("users.view")),
) -> User:
    stmt = select(User).options(selectinload(User.roles)).where(User.id == user_id)
    user = db.scalar(stmt)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("users.manage")),
) -> User:
    stmt = select(User).options(selectinload(User.roles)).where(User.id == user_id)
    user = db.scalar(stmt)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    new_roles = _resolve_roles(db, payload.role_codes) if payload.role_codes is not None else None
    _ensure_actor_can_manage(current_user, user, new_roles)

    removes_admin = (
        _is_admin(user)
        and new_roles is not None
        and all(role.code.upper() != "ADMIN" for role in new_roles)
    )
    deactivates = payload.is_active is False and user.is_active

    if user.id == current_user.id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propio usuario")

    if _is_admin(user) and (removes_admin or deactivates):
        _lock_admin_guard(db)
        if _other_active_admins(db, user.id) == 0:
            raise HTTPException(
                status_code=400,
                detail="Debe quedar al menos un administrador activo en el sistema",
            )

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.email is not None:
        user.email = str(payload.email)
    if payload.username is not None:
        user.username = payload.username.strip()
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if new_roles is not None:
        user.roles = new_roles

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="El usuario o correo ya existe") from exc

    db.refresh(user)
    return user
