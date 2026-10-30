from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Computed, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import DOC_STATUS_ENUM, PAYMENT_METHOD_ENUM, DocStatus, PaymentMethod


class Sale(Base):
    __tablename__ = "sales"
    __table_args__ = {"schema": "ccp"}

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("ccp.warehouses.id", ondelete="RESTRICT"), nullable=False)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("ccp.customers.id", ondelete="SET NULL"))
    sold_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    status: Mapped[DocStatus] = mapped_column(DOC_STATUS_ENUM, nullable=False, default=DocStatus.DRAFT)
    payment_method: Mapped[PaymentMethod] = mapped_column(PAYMENT_METHOD_ENUM, nullable=False, default=PaymentMethod.CASH)

    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")
    tax_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")

    note: Mapped[str | None] = mapped_column(Text())
    created_by: Mapped[int | None] = mapped_column(ForeignKey("ccp.users.id", ondelete="SET NULL"))
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("ccp.users.id", ondelete="SET NULL"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    items: Mapped[list[SaleItem]] = relationship(back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"
    __table_args__ = {"schema": "ccp"}

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("ccp.sales.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("ccp.products.id", ondelete="RESTRICT"), nullable=False)
    product_name_snapshot: Mapped[str] = mapped_column(String(180), nullable=False)
    barcode_snapshot: Mapped[str | None] = mapped_column(String(60))
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_price_excl_tax: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False, server_default="0.19")

    line_subtotal: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        Computed("ROUND(quantity * unit_price_excl_tax, 2)", persisted=True),
        nullable=False,
    )
    line_tax: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        Computed("ROUND(quantity * unit_price_excl_tax * vat_rate, 2)", persisted=True),
        nullable=False,
    )
    line_total: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        Computed("ROUND(quantity * unit_price_excl_tax * (1 + vat_rate), 2)", persisted=True),
        nullable=False,
    )

    sale: Mapped[Sale] = relationship(back_populates="items")
