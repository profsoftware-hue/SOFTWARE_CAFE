from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select, text
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.company import CompanyProfile
from app.models.enums import DocStatus
from app.models.inventory import InventoryBalance
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.user import User
from app.schemas.inventory import CurrentStockOut
from app.schemas.reports import (
    DailyClosingItemOut,
    DailyClosingOut,
    InventoryValueOut,
    SalesRangeOut,
    TopProductOut,
)


router = APIRouter(prefix="/reports", tags=["Reportes"])


@router.get("/inventory-value", response_model=InventoryValueOut)
def inventory_value(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "SELLER", "WAREHOUSE")),
) -> InventoryValueOut:
    total = db.scalar(
        select(func.coalesce(func.sum(InventoryBalance.quantity * Product.cost_price), 0))
        .select_from(InventoryBalance)
        .join(Product, Product.id == InventoryBalance.product_id)
    )
    return InventoryValueOut(total_inventory_value=total or Decimal("0"))


@router.get("/low-stock", response_model=list[CurrentStockOut])
def low_stock(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "SELLER", "WAREHOUSE")),
    warehouse_id: int | None = Query(default=None),
) -> list[CurrentStockOut]:
    query = """
    SELECT
      p.id AS product_id,
      p.sku,
      p.barcode,
      p.name AS product_name,
      p.image_path,
      w.id AS warehouse_id,
      w.code AS warehouse_code,
      w.name AS warehouse_name,
      COALESCE(b.quantity, 0) AS current_stock,
      p.min_stock,
      (COALESCE(b.quantity, 0) <= p.min_stock) AS is_low_stock,
      p.cost_price,
      p.sale_price_excl_tax,
      p.vat_rate,
      ROUND(COALESCE(b.quantity, 0) * p.cost_price, 2) AS stock_value
    FROM ccp.products p
    CROSS JOIN ccp.warehouses w
    LEFT JOIN ccp.inventory_balances b
      ON b.product_id = p.id
     AND b.warehouse_id = w.id
    WHERE p.is_active = TRUE
      AND w.is_active = TRUE
      AND (COALESCE(b.quantity, 0) <= p.min_stock)
    """

    params: dict[str, int] = {}
    if warehouse_id is not None:
        query += " AND w.id = :warehouse_id"
        params["warehouse_id"] = warehouse_id

    query += " ORDER BY w.id, p.name"

    rows = db.execute(text(query), params).mappings().all()
    return [CurrentStockOut(**row) for row in rows]


@router.get("/top-products", response_model=list[TopProductOut])
def top_products(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "SELLER", "WAREHOUSE")),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=100),
) -> list[TopProductOut]:
    stmt = (
        select(
            SaleItem.product_id,
            Product.sku,
            Product.name.label("product_name"),
            func.sum(SaleItem.quantity).label("units_sold"),
            func.sum(SaleItem.line_subtotal).label("subtotal"),
            func.sum(SaleItem.line_tax).label("tax_total"),
            func.sum(SaleItem.line_total).label("total"),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .join(Product, Product.id == SaleItem.product_id)
        .where(Sale.status == DocStatus.CONFIRMED)
    )

    if date_from is not None:
        dt_from = datetime.combine(date_from, time.min)
        stmt = stmt.where(Sale.sold_at >= dt_from)
    if date_to is not None:
        dt_to = datetime.combine(date_to, time.max)
        stmt = stmt.where(Sale.sold_at <= dt_to)

    stmt = (
        stmt.group_by(SaleItem.product_id, Product.sku, Product.name)
        .order_by(func.sum(SaleItem.quantity).desc())
        .limit(limit)
    )

    rows = db.execute(stmt).mappings().all()
    return [TopProductOut(**row) for row in rows]


@router.get("/sales-range", response_model=SalesRangeOut)
def sales_range(
    date_from: date,
    date_to: date,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "SELLER", "WAREHOUSE")),
) -> SalesRangeOut:
    dt_from = datetime.combine(date_from, time.min)
    dt_to = datetime.combine(date_to, time.max)

    row = db.execute(
        select(
            func.count(Sale.id).label("tickets"),
            func.coalesce(func.sum(Sale.subtotal), 0).label("subtotal"),
            func.coalesce(func.sum(Sale.tax_total), 0).label("tax_total"),
            func.coalesce(func.sum(Sale.total), 0).label("total"),
        ).where(and_(Sale.status == DocStatus.CONFIRMED, Sale.sold_at >= dt_from, Sale.sold_at <= dt_to))
    ).mappings().one()

    return SalesRangeOut(
        date_from=date_from,
        date_to=date_to,
        tickets=int(row["tickets"]),
        subtotal=row["subtotal"],
        tax_total=row["tax_total"],
        total=row["total"],
    )


@router.get("/daily-closing", response_model=DailyClosingOut)
def daily_closing(
    date_from: date,
    date_to: date,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "SELLER", "WAREHOUSE")),
) -> DailyClosingOut:
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="La fecha inicial no puede ser mayor a la final")

    dt_from = datetime.combine(date_from, time.min)
    dt_to = datetime.combine(date_to, time.max)

    totals = db.execute(
        select(
            func.count(Sale.id).label("tickets"),
            func.coalesce(func.sum(Sale.subtotal), 0).label("subtotal"),
            func.coalesce(func.sum(Sale.tax_total), 0).label("tax_total"),
            func.coalesce(func.sum(Sale.total), 0).label("total"),
        ).where(
            and_(
                Sale.status == DocStatus.CONFIRMED,
                Sale.sold_at >= dt_from,
                Sale.sold_at <= dt_to,
            )
        )
    ).mappings().one()

    item_rows = db.execute(
        select(
            SaleItem.product_name_snapshot.label("product_name"),
            Product.sku,
            func.sum(SaleItem.quantity).label("quantity"),
            func.sum(SaleItem.line_subtotal).label("subtotal"),
            func.sum(SaleItem.line_tax).label("tax_total"),
            func.sum(SaleItem.line_total).label("total"),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .join(Product, Product.id == SaleItem.product_id)
        .where(
            and_(
                Sale.status == DocStatus.CONFIRMED,
                Sale.sold_at >= dt_from,
                Sale.sold_at <= dt_to,
            )
        )
        .group_by(SaleItem.product_id, SaleItem.product_name_snapshot, Product.sku)
        .order_by(func.sum(SaleItem.line_total).desc())
    ).mappings().all()

    company = db.get(CompanyProfile, 1)

    return DailyClosingOut(
        date_from=date_from,
        date_to=date_to,
        tickets=int(totals["tickets"]),
        subtotal=totals["subtotal"],
        tax_total=totals["tax_total"],
        total=totals["total"],
        company_name=company.name if company else "FUNDACION NUESTRO FUTURO",
        items=[
            DailyClosingItemOut(
                product_name=row["product_name"],
                sku=row["sku"],
                quantity=row["quantity"],
                subtotal=row["subtotal"],
                tax_total=row["tax_total"],
                total=row["total"],
            )
            for row in item_rows
        ],
    )
