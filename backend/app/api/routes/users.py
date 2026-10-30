from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import Role, User
from app.schemas.user import UserCreate, UserOut, UserUpdate


router = APIRouter(prefix="/users", tags=["Usuarios"])


def _resolve_roles(db: Session, role_codes: list[str] | None) -> list[Role]:
    if not role_codes:
        return []

    normalized = [code.upper() for code in role_codes]
    roles = db.scalars(select(Role).where(Role.code.in_(normalized))).all()
    found = {role.code for role in roles}
    missing = sorted(set(normalized) - found)
    if missing:
        raise HTTPException(status_code=400, detail=f"Roles inválidos: {', '.join(missing)}")
    return roles


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN")),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[User]:
    stmt = select(User).options(selectinload(User.roles)).offset(offset).limit(limit).order_by(User.id.desc())
    return db.scalars(stmt).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN"))) -> User:
    user = User(
        full_name=payload.full_name,
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    user.roles = _resolve_roles(db, payload.role_codes)
    db.add(user)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo crear el usuario") from exc

    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN"))) -> User:
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
    _: User = Depends(require_roles("ADMIN")),
) -> User:
    stmt = select(User).options(selectinload(User.roles)).where(User.id == user_id)
    user = db.scalar(stmt)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.email is not None:
        user.email = payload.email
    if payload.username is not None:
        user.username = payload.username
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.role_codes is not None:
        user.roles = _resolve_roles(db, payload.role_codes)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo actualizar el usuario") from exc

    db.refresh(user)
    return user
