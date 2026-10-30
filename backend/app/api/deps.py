from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.security import decode_access_token
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

    return user


def require_roles(*allowed_roles: str) -> Callable[[User], User]:
    allowed = {role.upper() for role in allowed_roles}

    def _checker(current_user: User = Depends(get_current_user)) -> User:
        role_codes = {role.code.upper() for role in current_user.roles}
        if not role_codes.intersection(allowed):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para esta acción")
        return current_user

    return _checker
