from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.security import decode_access_token, password_fingerprint
from app.db.session import get_db
from app.models.user import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login", auto_error=False)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autorizado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = request.cookies.get(settings.auth_cookie_name) or token
    if not token:
        raise credentials_exception

    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        if subject is None:
            raise credentials_exception
        user_id = int(subject)
    except Exception as exc:  # noqa: BLE001
        raise credentials_exception from exc

    stmt = select(User).options(selectinload(User.roles)).where(User.id == user_id)
    user = db.scalar(stmt)
    if not user or not user.is_active:
        raise credentials_exception

    if payload.get("pwd") != password_fingerprint(user.password_hash):
        raise credentials_exception

    return user


PERMISSION_IMPLICATIONS: dict[str, set[str]] = {
    "inventory.manage": {"inventory.view"},
    "sales.create": {"inventory.view"},
    "users.manage": {"users.view"},
    "roles.manage": {"roles.view"},
    "settings.manage": {"settings.view"},
}


def _role_codes(user: User) -> set[str]:
    return {role.code.upper() for role in user.roles}


def effective_permission_codes(user: User) -> set[str]:
    granted = {permission.code.lower() for role in user.roles for permission in role.permissions}
    for code in list(granted):
        granted.update(PERMISSION_IMPLICATIONS.get(code, set()))
    return granted


def require_permissions(*required_permissions: str) -> Callable[[User], User]:
    """Exige todos los permisos indicados. El rol ADMIN siempre tiene acceso total."""
    required = {code.lower() for code in required_permissions}

    def _checker(current_user: User = Depends(get_current_user)) -> User:
        if "ADMIN" in _role_codes(current_user):
            return current_user
        missing = sorted(required - effective_permission_codes(current_user))
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No tienes permisos para esta acción: {', '.join(missing)}",
            )
        return current_user

    return _checker


def require_any_permission(*allowed_permissions: str) -> Callable[[User], User]:
    """Exige al menos uno de los permisos indicados. El rol ADMIN siempre tiene acceso total."""
    allowed = {code.lower() for code in allowed_permissions}

    def _checker(current_user: User = Depends(get_current_user)) -> User:
        if "ADMIN" in _role_codes(current_user):
            return current_user
        if not allowed.intersection(effective_permission_codes(current_user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para esta acción")
        return current_user

    return _checker


def require_roles(*allowed_roles: str) -> Callable[[User], User]:
    """Compatibilidad con módulos antiguos basados en rol."""
    allowed = {role.upper() for role in allowed_roles}

    def _checker(current_user: User = Depends(get_current_user)) -> User:
        if not _role_codes(current_user).intersection(allowed):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para esta acción")
        return current_user

    return _checker
