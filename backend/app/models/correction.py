from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class QuantityCorrection(Base):
    __tablename__ = "quantity_corrections"
    __table_args__ = {"schema": "ccp"}

    id: Mapped[int] = mapped_column(primary_key=True)
    correction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    sale_id: Mapped[int | None] = mapped_column(ForeignKey("ccp.sales.id", ondelete="SET NULL"))
    sale_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("ccp.sale_items.id", ondelete="SET NULL")
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("ccp.products.id", ondelete="RESTRICT"), nullable=False
    )
    warehouse_id: Mapped[int] = mapped_column(
        ForeignKey("ccp.warehouses.id", ondelete="RESTRICT"), nullable=False
    )
    previous_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    corrected_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    difference: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    reason: Mapped[str] = mapped_column(Text(), nullable=False)
    adjustment_id: Mapped[int | None] = mapped_column(
        ForeignKey("ccp.inventory_adjustments.id", ondelete="SET NULL")
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("ccp.users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
