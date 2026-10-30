from __future__ import annotations

from pathlib import Path
from urllib.parse import quote_plus

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", BACKEND_DIR / ".env", ".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "CCP Pereira API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"

    secret_key: str = "change-this-secret-key"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8

    db_host: str
    db_port: int = 5432
    db_name: str
    db_user: str
    db_password: str
    db_dialect: str = "postgresql"

    upload_dir: Path = BACKEND_DIR / "uploads"
    cors_origins: str = "*"

    @field_validator("secret_key", mode="before")
    @classmethod
    def _normalize_secret_key(cls, value: str | None) -> str:
        if value is None or (isinstance(value, str) and not value.strip()):
            return "change-this-secret-key"
        return value

    @field_validator("environment", mode="before")
    @classmethod
    def _normalize_environment(cls, value: str | None) -> str:
        if value is None or (isinstance(value, str) and not value.strip()):
            return "development"
        return value

    @field_validator("db_dialect", mode="before")
    @classmethod
    def _normalize_db_dialect(cls, value: str | None) -> str:
        if value is None or (isinstance(value, str) and not value.strip()):
            return "postgresql"
        return value

    @field_validator("upload_dir", mode="before")
    @classmethod
    def _normalize_upload_dir(cls, value: str | Path | None) -> Path:
        if value is None:
            return BACKEND_DIR / "uploads"
        if isinstance(value, str) and not value.strip():
            return BACKEND_DIR / "uploads"
        candidate = Path(value)
        return candidate if candidate.is_absolute() else BACKEND_DIR / candidate

    @property
    def database_url(self) -> str:
        dialect = self.db_dialect.lower()
        if dialect in {"postgres", "postgresql"}:
            driver = "postgresql+psycopg2"
        else:
            raise ValueError(f"DB_DIALECT no soportado: {self.db_dialect}")

        user = quote_plus(self.db_user)
        password = quote_plus(self.db_password)
        host = quote_plus(self.db_host)
        db_name = quote_plus(self.db_name)

        return f"{driver}://{user}:{password}@{host}:{self.db_port}/{db_name}"

    @property
    def cors_origins_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
