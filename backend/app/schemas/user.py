from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    username: str
    is_active: bool
    created_at: datetime
    roles: list[RoleOut] = Field(default_factory=list)


class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=3, max_length=120)
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=60)
    password: str = Field(..., min_length=8, max_length=128)
    role_codes: list[str] = Field(default_factory=list)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=120)
    email: EmailStr | None = None
    username: str | None = Field(default=None, min_length=3, max_length=60)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    is_active: bool | None = None
    role_codes: list[str] | None = None
