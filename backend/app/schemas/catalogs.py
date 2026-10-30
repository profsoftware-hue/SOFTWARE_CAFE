from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    is_active: bool
    created_at: datetime


class SupplierCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    document_number: str | None = Field(default=None, max_length=30)
    contact_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    email: EmailStr | None = None
    address: str | None = None


class SupplierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    document_number: str | None
    contact_name: str | None
    phone: str | None
    email: EmailStr | None
    address: str | None
    is_active: bool


class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    document_number: str | None = Field(default=None, max_length=30)
    phone: str | None = Field(default=None, max_length=40)
    email: EmailStr | None = None
    address: str | None = None


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    document_number: str | None
    phone: str | None
    email: EmailStr | None
    address: str | None
    is_active: bool


class WarehouseCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=30)
    name: str = Field(..., min_length=2, max_length=120)
    description: str | None = None
    is_default: bool = False


class WarehouseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    description: str | None
    is_default: bool
    is_active: bool
