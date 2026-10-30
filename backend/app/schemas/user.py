from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    module: str
    name: str
    description: str | None = None


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    description: str | None = None
    is_system: bool = False


class RoleDetailOut(RoleOut):
    permissions: list[PermissionOut] = Field(default_factory=list)
    user_count: int = 0


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    username: str
    is_active: bool
    created_at: datetime
    roles: list[RoleOut] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)


class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=3, max_length=120)
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=60)
    password: str = Field(..., min_length=8, max_length=128)
    role_codes: list[str] = Field(..., min_length=1)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=120)
    email: EmailStr | None = None
    username: str | None = Field(default=None, min_length=3, max_length=60)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    is_active: bool | None = None
    role_codes: list[str] | None = Field(default=None, min_length=1)


class RoleCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=30)
    name: str = Field(..., min_length=3, max_length=60)
    description: str | None = Field(default=None, max_length=500)
    permission_codes: list[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=60)
    description: str | None = Field(default=None, max_length=500)
    permission_codes: list[str] | None = None
