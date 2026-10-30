from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func, Computed
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import DOC_STATUS_ENUM, DocStatus


class Purchase(Base):
    __tablename__ = "purchases"
    __table_args__ = {"schema": "ccp"}

    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("ccp.suppliers.id", ondelete="RESTRICT"), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("ccp.warehouses.id", ondelete="RESTRICT"), nullable=False)
    purchased_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    status: Mapped[DocStatus] = mapped_column(DOC_STATUS_ENUM, nullable=False, default=DocStatus.DRAFT)

    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")
    tax_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")

    note: Mapped[str | None] = mapped_column(Text())
    created_by: Mapped[int | None] = mapped_column(ForeignKey("ccp.users.id", ondelete="SET NULL"))
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("ccp.users.id", ondelete="SET NULL"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    items: Mapped[list[PurchaseItem]] = relationship(back_populates="purchase", cascade="all, delete-orphan")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"
    __table_args__ = {"schema": "ccp"}

    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_id: Mapped[int] = mapped_column(ForeignKey("ccp.purchases.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("ccp.products.id", ondelete="RESTRICT"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False, server_default="0.19")

    line_subtotal: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        Computed("ROUND(quantity * unit_cost, 2)", persisted=True),
        nullable=False,
    )
    line_tax: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        Computed("ROUND(quantity * unit_cost * vat_rate, 2)", persisted=True),
        nullable=False,
    )
    line_total: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        Computed("ROUND(quantity * unit_cost * (1 + vat_rate), 2)", persisted=True),
        nullable=False,
    )

    purchase: Mapped[Purchase] = relationship(back_populates="items")
