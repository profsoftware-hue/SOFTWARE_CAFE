from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.models.enums import CustomerType, DocumentType


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
    name: str | None = Field(default=None, min_length=2, max_length=150)
    customer_type: CustomerType = CustomerType.NATURAL
    first_name: str | None = Field(default=None, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)
    business_name: str | None = Field(default=None, max_length=180)
    document_type: DocumentType = DocumentType.CC
    document_number: str | None = Field(default=None, max_length=30)
    phone: str | None = Field(default=None, max_length=40)
    email: EmailStr | None = None
    address: str | None = None

    @model_validator(mode="after")
    def _validate_identity(self) -> "CustomerCreate":
        if self.customer_type == CustomerType.NATURAL:
            if not (self.first_name and self.first_name.strip() and self.last_name and self.last_name.strip()):
                raise ValueError("Para persona natural ingresa nombres y apellidos")
        elif not (self.business_name and self.business_name.strip()) and not (self.name and self.name.strip()):
            raise ValueError("Para persona jurídica ingresa la razón social")
        return self

    def resolved_name(self) -> str:
        if self.customer_type == CustomerType.NATURAL:
            return f"{(self.first_name or '').strip()} {(self.last_name or '').strip()}".strip()
        return ((self.business_name or self.name or "").strip())


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    customer_type: CustomerType
    first_name: str | None
    last_name: str | None
    business_name: str | None
    document_type: DocumentType
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
