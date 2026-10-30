from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> tuple[str, int]:
    expire_minutes = settings.access_token_expire_minutes
    expires_at = datetime.now(UTC) + timedelta(minutes=expire_minutes)

    to_encode: dict[str, Any] = {
        "sub": str(subject),
        "exp": expires_at,
        "iat": datetime.now(UTC),
    }
    if extra_claims:
        to_encode.update(extra_claims)

    token = jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)
    return token, expire_minutes * 60


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:  # pragma: no cover - simple passthrough
        raise ValueError("Token inválido o expirado") from exc
