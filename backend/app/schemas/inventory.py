from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AdjustmentType, DocStatus, PaymentMethod


class PurchaseItemIn(BaseModel):
    product_id: int
    quantity: Decimal = Field(..., gt=0)
    unit_cost: Decimal = Field(..., ge=0)
    vat_rate: Decimal = Field(default=Decimal("0.19"))


class PurchaseCreate(BaseModel):
    purchase_number: str | None = None
    supplier_id: int
    warehouse_id: int
    purchased_at: datetime | None = None
    note: str | None = None
    items: list[PurchaseItemIn]
    confirm: bool = True


class SaleItemIn(BaseModel):
    product_id: int
    quantity: Decimal = Field(..., gt=0)
    unit_price_excl_tax: Decimal | None = Field(default=None, ge=0)


class SaleCreate(BaseModel):
    sale_number: str | None = None
    warehouse_id: int
    customer_id: int | None = None
    sold_at: datetime | None = None
    payment_method: PaymentMethod = PaymentMethod.CASH
    note: str | None = None
    items: list[SaleItemIn]
    confirm: bool = True


class AdjustmentItemIn(BaseModel):
    product_id: int
    quantity: Decimal = Field(..., gt=0)
    unit_cost: Decimal | None = Field(default=None, ge=0)
    note: str | None = None


class InventoryAdjustmentCreate(BaseModel):
    adjustment_number: str | None = None
    adjustment_type: AdjustmentType
    warehouse_id: int
    reference_sale_id: int | None = None
    adjusted_at: datetime | None = None
    reason: str = Field(..., min_length=3)
    note: str | None = None
    items: list[AdjustmentItemIn]
    confirm: bool = True


class InventoryDocumentOut(BaseModel):
    id: int
    number: str
    status: DocStatus
    subtotal: Decimal | None = None
    tax_total: Decimal | None = None
    total: Decimal | None = None
    created_at: datetime


class PosQuoteItemIn(BaseModel):
    product_id: int
    quantity: Decimal = Field(..., gt=0)
    unit_price_excl_tax: Decimal | None = Field(default=None, ge=0)


class PosQuoteRequest(BaseModel):
    items: list[PosQuoteItemIn]


class PosQuoteLineOut(BaseModel):
    product_id: int
    sku: str
    name: str
    image_path: str | None
    quantity: Decimal
    unit_price_excl_tax: Decimal
    vat_rate: Decimal
    line_subtotal: Decimal
    line_tax: Decimal
    line_total: Decimal


class PosQuoteResponse(BaseModel):
    lines: list[PosQuoteLineOut]
    subtotal: Decimal
    tax_total: Decimal
    total: Decimal


class KardexOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    moved_at: datetime
    warehouse_id: int
    product_id: int
    movement_type: str
    direction: str
    quantity: Decimal
    signed_quantity: Decimal
    unit_cost: Decimal | None
    reason: str | None
    note: str | None
    origin_type: str
    origin_id: int
    origin_item_id: int | None


class CurrentStockOut(BaseModel):
    product_id: int
    sku: str
    barcode: str | None
    product_name: str
    image_path: str | None
    warehouse_id: int
    warehouse_code: str
    warehouse_name: str
    current_stock: Decimal
    min_stock: Decimal
    is_low_stock: bool
    cost_price: Decimal
    sale_price_excl_tax: Decimal
    vat_rate: Decimal
    stock_value: Decimal


class SalesByDateOut(BaseModel):
    sale_date: date
    tickets: int
    subtotal: Decimal
    tax_total: Decimal
    total: Decimal


class SaleReceiptItemOut(BaseModel):
    product_name: str
    barcode: str | None
    quantity: Decimal
    unit_price_excl_tax: Decimal
    vat_rate: Decimal
    line_subtotal: Decimal
    line_tax: Decimal
    line_total: Decimal


class SaleReceiptOut(BaseModel):
    sale_id: int
    sale_number: str
    sold_at: datetime
    status: DocStatus
    payment_method: PaymentMethod
    customer_name: str | None
    warehouse_name: str
    seller_name: str | None
    company_name: str
    company_nit: str | None
    company_address: str | None
    company_phone: str | None
    subtotal: Decimal
    tax_total: Decimal
    total: Decimal
    items: list[SaleReceiptItemOut]
