from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import Role, User
from app.schemas.auth import BootstrapAdminRequest, LoginRequest, TokenResponse
from app.schemas.user import UserOut


router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/bootstrap-admin", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def bootstrap_admin(payload: BootstrapAdminRequest, db: Session = Depends(get_db)) -> User:
    users_count = db.scalar(select(func.count(User.id))) or 0
    if users_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existen usuarios. Este endpoint solo aplica para primer arranque.",
        )

    admin_role = db.scalar(select(Role).where(Role.code == "ADMIN"))
    if not admin_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No existe el rol ADMIN. Verifica datos semilla.",
        )

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    user.roles.append(admin_role)
    db.add(user)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo crear el usuario administrador") from exc

    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user_stmt = (
        select(User)
        .options(selectinload(User.roles))
        .where(or_(User.username == payload.username, User.email == payload.username))
    )
    user = db.scalar(user_stmt)

    if not user or not verify_password(payload.password, user.password_hash) or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")

    role_codes = [role.code for role in user.roles]
    token, expires_in = create_access_token(subject=str(user.id), extra_claims={"roles": role_codes})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        user_id=user.id,
        username=user.username,
        roles=role_codes,
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
