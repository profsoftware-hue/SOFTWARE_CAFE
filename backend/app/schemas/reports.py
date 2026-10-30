from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class InventoryValueOut(BaseModel):
    total_inventory_value: Decimal


class TopProductOut(BaseModel):
    product_id: int
    sku: str
    product_name: str
    units_sold: Decimal
    subtotal: Decimal
    tax_total: Decimal
    total: Decimal


class SalesRangeOut(BaseModel):
    date_from: date
    date_to: date
    tickets: int
    subtotal: Decimal
    tax_total: Decimal
    total: Decimal


class DailyClosingItemOut(BaseModel):
    product_name: str
    sku: str | None
    quantity: Decimal
    subtotal: Decimal
    tax_total: Decimal
    total: Decimal


class DailyClosingOut(BaseModel):
    date_from: date
    date_to: date
    tickets: int
    subtotal: Decimal
    tax_total: Decimal
    total: Decimal
    company_name: str
    items: list[DailyClosingItemOut]
