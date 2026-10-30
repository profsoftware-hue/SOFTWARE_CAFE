from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select, true
from sqlalchemy.orm import Session

from app.api.deps import require_permissions
from app.db.session import get_db
from app.models.catalogs import Warehouse
from app.models.company import CompanyProfile
from app.models.enums import DocStatus, PaymentMethod
from app.models.inventory import InventoryBalance
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.user import User
from app.schemas.inventory import CurrentStockOut
from app.schemas.reports import (
    DailyClosingItemOut,
    DailyClosingOut,
    DailyClosingPaymentOut,
    InventoryValueOut,
    SalesRangeOut,
    TopProductOut,
)


router = APIRouter(prefix="/reports", tags=["Reportes"])

PAYMENT_METHOD_ORDER = (
    PaymentMethod.CASH,
    PaymentMethod.TRANSFER,
    PaymentMethod.QR,
    PaymentMethod.CARD,
    PaymentMethod.MIXED,
    PaymentMethod.CREDIT,
)
try:
    BOGOTA_TZ = ZoneInfo("America/Bogota")
except ZoneInfoNotFoundError:  # Windows sin tzdata
    BOGOTA_TZ = timezone(timedelta(hours=-5))


def _range_bounds(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    """Límites del día en hora de Colombia, convertidos a UTC por PostgreSQL."""
    return (
        datetime.combine(date_from, time.min, tzinfo=BOGOTA_TZ),
        datetime.combine(date_to, time.max, tzinfo=BOGOTA_TZ),
    )


@router.get("/inventory-value", response_model=InventoryValueOut)
def inventory_value(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("reports.view")),
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
    _: User = Depends(require_permissions("reports.view")),
    warehouse_id: int | None = Query(default=None),
) -> list[CurrentStockOut]:
    stock = func.coalesce(InventoryBalance.quantity, 0)
    sold = (
        select(
            SaleItem.product_id.label("product_id"),
            func.coalesce(func.sum(SaleItem.quantity), 0).label("sold_quantity"),
            func.coalesce(func.sum(SaleItem.line_total), 0).label("sold_total"),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .where(Sale.status == DocStatus.CONFIRMED)
        .group_by(SaleItem.product_id)
    ).subquery()

    stmt = (
        select(
            Product.id.label("product_id"),
            Product.sku,
            Product.barcode,
            Product.name.label("product_name"),
            Product.image_path,
            Warehouse.id.label("warehouse_id"),
            Warehouse.code.label("warehouse_code"),
            Warehouse.name.label("warehouse_name"),
            stock.label("current_stock"),
            Product.min_stock,
            (stock <= Product.min_stock).label("is_low_stock"),
            Product.cost_price,
            Product.sale_price_excl_tax,
            Product.vat_rate,
            func.round(stock * Product.cost_price, 2).label("stock_value"),
            func.coalesce(sold.c.sold_quantity, 0).label("sold_quantity"),
            func.coalesce(sold.c.sold_total, 0).label("sold_total"),
        )
        .select_from(Product)
        .join(Warehouse, true())
        .outerjoin(
            InventoryBalance,
            and_(
                InventoryBalance.product_id == Product.id,
                InventoryBalance.warehouse_id == Warehouse.id,
            ),
        )
        .outerjoin(sold, sold.c.product_id == Product.id)
        .where(
            Product.is_active.is_(True),
            Warehouse.is_active.is_(True),
            stock <= Product.min_stock,
        )
    )

    if warehouse_id is not None:
        stmt = stmt.where(Warehouse.id == warehouse_id)

    stmt = stmt.order_by(Warehouse.id.asc(), Product.name.asc())
    rows = db.execute(stmt).mappings().all()
    return [CurrentStockOut(**row) for row in rows]


@router.get("/top-products", response_model=list[TopProductOut])
def top_products(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("reports.view")),
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
        start, _ = _range_bounds(date_from, date_from)
        stmt = stmt.where(Sale.sold_at >= start)
    if date_to is not None:
        _, end = _range_bounds(date_to, date_to)
        stmt = stmt.where(Sale.sold_at <= end)

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
    _: User = Depends(require_permissions("reports.view")),
) -> SalesRangeOut:
    start, end = _range_bounds(date_from, date_to)
    row = db.execute(
        select(
            func.count(Sale.id).label("tickets"),
            func.coalesce(func.sum(Sale.subtotal), 0).label("subtotal"),
            func.coalesce(func.sum(Sale.tax_total), 0).label("tax_total"),
            func.coalesce(func.sum(Sale.total), 0).label("total"),
        ).where(and_(Sale.status == DocStatus.CONFIRMED, Sale.sold_at >= start, Sale.sold_at <= end))
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
    _: User = Depends(require_permissions("reports.view")),
) -> DailyClosingOut:
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="La fecha inicial no puede ser mayor a la final")

    start, end = _range_bounds(date_from, date_to)
    totals = db.execute(
        select(
            func.count(Sale.id).label("tickets"),
            func.coalesce(func.sum(Sale.subtotal), 0).label("subtotal"),
            func.coalesce(func.sum(Sale.tax_total), 0).label("tax_total"),
            func.coalesce(func.sum(Sale.total), 0).label("total"),
        ).where(and_(Sale.status == DocStatus.CONFIRMED, Sale.sold_at >= start, Sale.sold_at <= end))
    ).mappings().one()

    payment_rows = db.execute(
        select(
            Sale.payment_method,
            func.count(Sale.id).label("tickets"),
            func.coalesce(func.sum(Sale.subtotal), 0).label("subtotal"),
            func.coalesce(func.sum(Sale.tax_total), 0).label("tax_total"),
            func.coalesce(func.sum(Sale.total), 0).label("total"),
        )
        .where(and_(Sale.status == DocStatus.CONFIRMED, Sale.sold_at >= start, Sale.sold_at <= end))
        .group_by(Sale.payment_method)
    ).mappings().all()
    payment_map = {
        (row["payment_method"].value if isinstance(row["payment_method"], PaymentMethod) else str(row["payment_method"])): row
        for row in payment_rows
    }

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
        .where(and_(Sale.status == DocStatus.CONFIRMED, Sale.sold_at >= start, Sale.sold_at <= end))
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
        payment_methods=[
            DailyClosingPaymentOut(
                payment_method=method,
                tickets=int(payment_map.get(method.value, {}).get("tickets", 0) or 0),
                subtotal=payment_map.get(method.value, {}).get("subtotal", Decimal("0")) or Decimal("0"),
                tax_total=payment_map.get(method.value, {}).get("tax_total", Decimal("0")) or Decimal("0"),
                total=payment_map.get(method.value, {}).get("total", Decimal("0")) or Decimal("0"),
            )
            for method in PAYMENT_METHOD_ORDER
        ],
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
