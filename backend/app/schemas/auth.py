from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    username: str = Field(..., description="Usuario o email")
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: int
    username: str
    roles: list[str]


class BootstrapAdminRequest(BaseModel):
    full_name: str = Field(..., min_length=3, max_length=120)
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=60)
    password: str = Field(..., min_length=8, max_length=128)
