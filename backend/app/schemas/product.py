from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku: str
    barcode: str | None
    name: str
    description: str | None
    category_id: int | None
    supplier_id: int | None
    unit: str
    cost_price: Decimal
    sale_price_excl_tax: Decimal
    vat_rate: Decimal
    final_price_incl_tax: Decimal
    min_stock: Decimal
    image_path: str | None
    image_url: str | None = None
    image_mime_type: str | None
    image_size_bytes: int | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class QuickProductCreate(BaseModel):
    """Alta rápida: solo nombre y cantidad son obligatorios."""

    name: str = Field(..., min_length=2, max_length=180)
    quantity: Decimal = Field(..., gt=0)
    sku: str | None = Field(default=None, max_length=40)
    barcode: str | None = Field(default=None, max_length=60)
    cost_price: Decimal = Field(default=Decimal("0"), ge=0)
    sale_price_excl_tax: Decimal = Field(default=Decimal("0"), ge=0)
    vat_rate: Decimal = Field(default=Decimal("0.19"))
    min_stock: Decimal = Field(default=Decimal("0"), ge=0)
    warehouse_id: int | None = None


class StockEntryCreate(BaseModel):
    """Agregar unidades a un producto existente (el costo ya está registrado)."""

    quantity: Decimal = Field(..., gt=0)
    warehouse_id: int | None = None


class ProductPatch(BaseModel):
    """Edición parcial: solo cambia los campos enviados, sin tocar el stock."""

    name: str | None = Field(default=None, min_length=2, max_length=180)
    sku: str | None = Field(default=None, max_length=40)
    barcode: str | None = Field(default=None, max_length=60)
    cost_price: Decimal | None = Field(default=None, ge=0)
    sale_price_excl_tax: Decimal | None = Field(default=None, ge=0)
    vat_rate: Decimal | None = None
    min_stock: Decimal | None = Field(default=None, ge=0)
    is_active: bool | None = None
