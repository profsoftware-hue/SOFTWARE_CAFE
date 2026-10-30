from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, Computed, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = {"schema": "ccp"}

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    barcode: Mapped[str | None] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text())

    category_id: Mapped[int | None] = mapped_column(ForeignKey("ccp.product_categories.id", ondelete="SET NULL"))
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("ccp.suppliers.id", ondelete="SET NULL"))
    unit: Mapped[str] = mapped_column(String(20), nullable=False, server_default="UND")

    cost_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")
    sale_price_excl_tax: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False, server_default="0.19")
    final_price_incl_tax: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        Computed("ROUND(sale_price_excl_tax * (1 + vat_rate), 2)", persisted=True),
        nullable=False,
    )
    min_stock: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False, server_default="0")

    image_path: Mapped[str | None] = mapped_column(Text())
    image_mime_type: Mapped[str | None] = mapped_column(String(80))
    image_size_bytes: Mapped[int | None] = mapped_column(Integer)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("ccp.users.id", ondelete="SET NULL"))
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("ccp.users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    category = relationship("ProductCategory", lazy="joined")
    supplier = relationship("Supplier", lazy="joined")
