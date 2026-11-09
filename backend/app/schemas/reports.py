from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import CustomerType, DocumentType, PaymentMethod


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
    units_sold: Decimal = Decimal("0")
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


class ThirdPartyOut(BaseModel):
    customer_id: int
    name: str
    customer_type: CustomerType
    document_type: DocumentType
    document_number: str | None
    email: str | None
    phone: str | None
    address: str | None
    total_sales: Decimal
    invoice_count: int
    total_invoiced: Decimal
    last_invoice_at: datetime | None


class InvoiceRequestOut(BaseModel):
    sale_id: int
    sale_number: str
    sold_at: datetime
    customer_name: str | None
    document_type: DocumentType | None
    document_number: str | None
    email: str | None
    phone: str | None
    payment_method: PaymentMethod
    total: Decimal


class DailyClosingPaymentOut(BaseModel):
    payment_method: PaymentMethod
    tickets: int
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
    payment_methods: list[DailyClosingPaymentOut] = Field(default_factory=list)
    items: list[DailyClosingItemOut]
