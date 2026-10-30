from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Computed, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ADJUSTMENT_TYPE_ENUM, DOC_STATUS_ENUM, MOVEMENT_TYPE_ENUM
from app.models.enums import AdjustmentType, DocStatus, MovementType


class InventoryAdjustment(Base):
    __tablename__ = "inventory_adjustments"
    __table_args__ = {"schema": "ccp"}

    id: Mapped[int] = mapped_column(primary_key=True)
    adjustment_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    adjustment_type: Mapped[AdjustmentType] = mapped_column(ADJUSTMENT_TYPE_ENUM, nullable=False)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("ccp.warehouses.id", ondelete="RESTRICT"), nullable=False)
    reference_sale_id: Mapped[int | None] = mapped_column(ForeignKey("ccp.sales.id", ondelete="SET NULL"))
    adjusted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    status: Mapped[DocStatus] = mapped_column(DOC_STATUS_ENUM, nullable=False, default=DocStatus.DRAFT)
    reason: Mapped[str] = mapped_column(Text(), nullable=False)
    note: Mapped[str | None] = mapped_column(Text())

    created_by: Mapped[int | None] = mapped_column(ForeignKey("ccp.users.id", ondelete="SET NULL"))
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("ccp.users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    items: Mapped[list[InventoryAdjustmentItem]] = relationship(
        back_populates="adjustment",
        cascade="all, delete-orphan",
    )


class InventoryAdjustmentItem(Base):
    __tablename__ = "inventory_adjustment_items"
    __table_args__ = {"schema": "ccp"}

    id: Mapped[int] = mapped_column(primary_key=True)
    adjustment_id: Mapped[int] = mapped_column(
        ForeignKey("ccp.inventory_adjustments.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[int] = mapped_column(ForeignKey("ccp.products.id", ondelete="RESTRICT"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    note: Mapped[str | None] = mapped_column(Text())

    adjustment: Mapped[InventoryAdjustment] = relationship(back_populates="items")


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    __table_args__ = {"schema": "ccp"}

    id: Mapped[int] = mapped_column(primary_key=True)
    moved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("ccp.warehouses.id", ondelete="RESTRICT"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("ccp.products.id", ondelete="RESTRICT"), nullable=False)
    movement_type: Mapped[MovementType] = mapped_column(MOVEMENT_TYPE_ENUM, nullable=False)
    direction: Mapped[str] = mapped_column(
        String(3),
        Computed(
            "CASE WHEN movement_type IN ('PURCHASE', 'CUSTOMER_RETURN', 'ADJUSTMENT_IN') "
            "THEN 'IN' ELSE 'OUT' END",
            persisted=True,
        ),
        nullable=False,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    signed_quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 3),
        Computed(
            "CASE WHEN movement_type IN ('PURCHASE', 'CUSTOMER_RETURN', 'ADJUSTMENT_IN') "
            "THEN quantity ELSE -quantity END",
            persisted=True,
        ),
        nullable=False,
    )
    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    reason: Mapped[str | None] = mapped_column(Text())
    note: Mapped[str | None] = mapped_column(Text())
    origin_type: Mapped[str] = mapped_column(String(30), nullable=False)
    origin_id: Mapped[int] = mapped_column(nullable=False)
    origin_item_id: Mapped[int | None] = mapped_column()
    created_by: Mapped[int | None] = mapped_column(ForeignKey("ccp.users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class InventoryBalance(Base):
    __tablename__ = "inventory_balances"
    __table_args__ = {"schema": "ccp"}

    product_id: Mapped[int] = mapped_column(ForeignKey("ccp.products.id", ondelete="RESTRICT"), primary_key=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("ccp.warehouses.id", ondelete="RESTRICT"), primary_key=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
