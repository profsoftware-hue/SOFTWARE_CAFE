from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import DocStatus


class SaleQuantityCorrectionRequest(BaseModel):
    corrected_quantity: Decimal = Field(..., ge=0)
    reason: str = Field(..., min_length=3, max_length=500)


class InventoryQuantityCorrectionRequest(BaseModel):
    product_id: int
    warehouse_id: int
    corrected_quantity: Decimal = Field(..., ge=0)
    reason: str = Field(..., min_length=3, max_length=500)


class CorrectionSaleItemOut(BaseModel):
    sale_item_id: int
    product_id: int
    product_name: str
    quantity: Decimal
    quantity_correction: Decimal
    effective_quantity: Decimal
    unit_price_excl_tax: Decimal
    line_total: Decimal


class QuantityCorrectionOut(BaseModel):
    id: int
    correction_type: Literal["SALE", "INVENTORY"]
    sale_id: int | None
    sale_item_id: int | None
    product_id: int
    warehouse_id: int
    previous_quantity: Decimal
    corrected_quantity: Decimal
    difference: Decimal
    reason: str
    adjustment_id: int | None
    created_by: int | None
    created_by_name: str | None = None
    created_at: datetime


class CorrectionSaleOut(BaseModel):
    sale_id: int
    sale_number: str
    sold_at: datetime
    status: DocStatus
    total: Decimal
    customer_name: str | None
    items: list[CorrectionSaleItemOut]
    history: list[QuantityCorrectionOut]


class QuantityCorrectionResultOut(BaseModel):
    correction_id: int
    correction_type: Literal["SALE", "INVENTORY"]
    sale_id: int | None
    sale_item_id: int | None
    product_id: int
    warehouse_id: int
    previous_quantity: Decimal
    corrected_quantity: Decimal
    difference: Decimal
    stock_quantity: Decimal
    effective_quantity: Decimal | None = None
    adjustment_id: int | None
    reason: str
    created_at: datetime
