from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, desc, func, or_, select, true
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_permissions
from app.db.session import get_db
from app.models.catalogs import Customer, Supplier, Warehouse
from app.models.company import CompanyProfile
from app.models.enums import AdjustmentType, DocStatus
from app.models.inventory import InventoryAdjustment, InventoryAdjustmentItem, InventoryBalance, InventoryMovement
from app.models.product import Product
from app.models.purchase import Purchase, PurchaseItem
from app.models.sale import Sale, SaleItem
from app.models.user import User
from app.schemas.inventory import (
    CurrentStockOut,
    InventoryAdjustmentCreate,
    InventoryDocumentOut,
    KardexOut,
    PosQuoteLineOut,
    PosQuoteRequest,
    PosQuoteResponse,
    PurchaseCreate,
    SaleCreate,
    SaleReceiptItemOut,
    SaleReceiptOut,
)
from app.services.numbering import generate_document_number


router = APIRouter(prefix="/inventory", tags=["Inventario"])

ALLOWED_VAT_RATES = {Decimal("0"), Decimal("0.05"), Decimal("0.19")}

try:
    BOGOTA_TZ = ZoneInfo("America/Bogota")
except ZoneInfoNotFoundError:  # Windows sin tzdata
    BOGOTA_TZ = timezone(timedelta(hours=-5))


def _bogota_range_bounds(date_from: date | None, date_to: date | None) -> tuple[datetime | None, datetime | None]:
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(status_code=400, detail="La fecha inicial no puede ser mayor que la fecha final")

    start = datetime.combine(date_from, time.min, tzinfo=BOGOTA_TZ) if date_from else None
    end = datetime.combine(date_to, time.max, tzinfo=BOGOTA_TZ) if date_to else None
    return start, end


def _extract_db_error(exc: Exception) -> str:
    root = getattr(exc, "orig", exc)
    return str(root)


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _validate_vat_rate(vat_rate: Decimal) -> None:
    if vat_rate not in ALLOWED_VAT_RATES:
        raise HTTPException(status_code=400, detail="IVA inválido. Permitidos: 0, 0.05, 0.19")


def _build_document_out(document: Purchase | Sale | InventoryAdjustment, number_field: str) -> InventoryDocumentOut:
    return InventoryDocumentOut(
        id=document.id,
        number=getattr(document, number_field),
        status=document.status,
        subtotal=getattr(document, "subtotal", None),
        tax_total=getattr(document, "tax_total", None),
        total=getattr(document, "total", None),
        created_at=document.created_at,
    )


@router.post("/purchases", response_model=InventoryDocumentOut, status_code=status.HTTP_201_CREATED)
def create_purchase(
    payload: PurchaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("inventory.manage")),
) -> InventoryDocumentOut:
    if not payload.items:
        raise HTTPException(status_code=400, detail="La compra debe tener al menos un ítem")

    supplier = db.get(Supplier, payload.supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    warehouse = db.get(Warehouse, payload.warehouse_id)
    if not warehouse:
        raise HTTPException(status_code=404, detail="Bodega no encontrada")

    purchase = Purchase(
        purchase_number=payload.purchase_number or generate_document_number("COMP"),
        supplier_id=payload.supplier_id,
        warehouse_id=payload.warehouse_id,
        purchased_at=payload.purchased_at or _now_utc(),
        status=DocStatus.DRAFT,
        note=payload.note,
        created_by=current_user.id,
        updated_by=current_user.id,
    )

    db.add(purchase)
    db.flush()

    product_ids = {item.product_id for item in payload.items}
    existing_product_ids = set(db.scalars(select(Product.id).where(Product.id.in_(product_ids))).all())
    missing = sorted(product_ids - existing_product_ids)
    if missing:
        raise HTTPException(status_code=404, detail=f"Productos no encontrados: {', '.join(map(str, missing))}")

    for item in payload.items:
        _validate_vat_rate(item.vat_rate)
        db.add(
            PurchaseItem(
                purchase_id=purchase.id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
                vat_rate=item.vat_rate,
            )
        )

    # Importante: los ítems deben existir en la BD antes de confirmar el documento,
    # porque el trigger de inventario valida que la compra tenga ítems.
    db.flush()

    if payload.confirm:
        purchase.status = DocStatus.CONFIRMED
        purchase.updated_by = current_user.id
        db.flush()

    try:
        db.commit()
    except (IntegrityError, DBAPIError) as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"No se pudo registrar la compra: {_extract_db_error(exc)}") from exc

    db.refresh(purchase)
    return _build_document_out(purchase, "purchase_number")


@router.post("/pos/quote", response_model=PosQuoteResponse)
def pos_quote(
    payload: PosQuoteRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("sales.create")),
) -> PosQuoteResponse:
    if not payload.items:
        raise HTTPException(status_code=400, detail="Debes enviar al menos un ítem")

    product_ids = {item.product_id for item in payload.items}
    products = db.scalars(select(Product).where(Product.id.in_(product_ids), Product.is_active.is_(True))).all()
    product_map = {product.id: product for product in products}

    missing = sorted(product_ids - set(product_map.keys()))
    if missing:
        raise HTTPException(status_code=404, detail=f"Productos no encontrados o inactivos: {', '.join(map(str, missing))}")

    lines: list[PosQuoteLineOut] = []
    subtotal = Decimal("0")
    tax_total = Decimal("0")
    total = Decimal("0")

    for item in payload.items:
        product = product_map[item.product_id]
        unit_price = item.unit_price_excl_tax if item.unit_price_excl_tax is not None else product.sale_price_excl_tax
        vat_rate = product.vat_rate

        line_subtotal = (item.quantity * unit_price).quantize(Decimal("0.01"))
        line_tax = (line_subtotal * vat_rate).quantize(Decimal("0.01"))
        line_total = (line_subtotal + line_tax).quantize(Decimal("0.01"))

        lines.append(
            PosQuoteLineOut(
                product_id=product.id,
                sku=product.sku,
                name=product.name,
                image_path=product.image_path,
                quantity=item.quantity,
                unit_price_excl_tax=unit_price,
                vat_rate=vat_rate,
                line_subtotal=line_subtotal,
                line_tax=line_tax,
                line_total=line_total,
            )
        )

        subtotal += line_subtotal
        tax_total += line_tax
        total += line_total

    return PosQuoteResponse(lines=lines, subtotal=subtotal, tax_total=tax_total, total=total)


@router.post("/sales", response_model=InventoryDocumentOut, status_code=status.HTTP_201_CREATED)
def create_sale(
    payload: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("sales.create")),
) -> InventoryDocumentOut:
    if not payload.items:
        raise HTTPException(status_code=400, detail="La venta debe tener al menos un ítem")

    warehouse = db.get(Warehouse, payload.warehouse_id)
    if not warehouse:
        raise HTTPException(status_code=404, detail="Bodega no encontrada")

    if payload.customer_id is not None:
        customer = db.get(Customer, payload.customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

    product_ids = {item.product_id for item in payload.items}
    products = db.scalars(select(Product).where(Product.id.in_(product_ids), Product.is_active.is_(True))).all()
    product_map = {product.id: product for product in products}
    missing_products = sorted(product_ids - set(product_map.keys()))
    if missing_products:
        raise HTTPException(status_code=404, detail=f"Productos no encontrados o inactivos: {', '.join(map(str, missing_products))}")

    requested_by_product: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    for item in payload.items:
        requested_by_product[item.product_id] += item.quantity

    if payload.confirm:
        stock_rows = db.execute(
            select(InventoryBalance.product_id, InventoryBalance.quantity)
            .where(
                InventoryBalance.warehouse_id == payload.warehouse_id,
                InventoryBalance.product_id.in_(requested_by_product.keys()),
            )
            .with_for_update()
        ).all()

        stock_map = {row.product_id: row.quantity for row in stock_rows}
        insufficient: list[str] = []
        for product_id, requested in requested_by_product.items():
            available = stock_map.get(product_id, Decimal("0"))
            if available < requested:
                insufficient.append(f"producto {product_id}: disponible {available}, solicitado {requested}")

        if insufficient:
            raise HTTPException(status_code=400, detail="Stock insuficiente: " + "; ".join(insufficient))

    sale = Sale(
        sale_number=payload.sale_number or generate_document_number("VENTA"),
        warehouse_id=payload.warehouse_id,
        customer_id=payload.customer_id,
        sold_at=payload.sold_at or _now_utc(),
        status=DocStatus.DRAFT,
        payment_method=payload.payment_method,
        note=payload.note,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(sale)
    db.flush()

    for item in payload.items:
        product = product_map[item.product_id]
        unit_price = item.unit_price_excl_tax if item.unit_price_excl_tax is not None else product.sale_price_excl_tax
        _validate_vat_rate(product.vat_rate)

        db.add(
            SaleItem(
                sale_id=sale.id,
                product_id=product.id,
                product_name_snapshot=product.name,
                barcode_snapshot=product.barcode,
                quantity=item.quantity,
                unit_price_excl_tax=unit_price,
                vat_rate=product.vat_rate,
            )
        )

    # Asegura que los ítems estén insertados antes de disparar el trigger de inventario.
    db.flush()

    if payload.confirm:
        sale.status = DocStatus.CONFIRMED
        sale.updated_by = current_user.id
        db.flush()

    try:
        db.commit()
    except (IntegrityError, DBAPIError) as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"No se pudo registrar la venta: {_extract_db_error(exc)}") from exc

    db.refresh(sale)
    return _build_document_out(sale, "sale_number")


@router.get("/sales/{sale_id}/receipt", response_model=SaleReceiptOut)
def get_sale_receipt(
    sale_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("sales.create")),
) -> SaleReceiptOut:
    sale = db.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    items = db.scalars(
        select(SaleItem).where(SaleItem.sale_id == sale_id).order_by(SaleItem.id.asc())
    ).all()

    warehouse = db.get(Warehouse, sale.warehouse_id)
    customer = db.get(Customer, sale.customer_id) if sale.customer_id else None
    seller = db.get(User, sale.created_by) if sale.created_by else None
    company = db.get(CompanyProfile, 1)

    return SaleReceiptOut(
        sale_id=sale.id,
        sale_number=sale.sale_number,
        sold_at=sale.sold_at,
        status=sale.status,
        payment_method=sale.payment_method,
        customer_name=customer.name if customer else None,
        warehouse_name=warehouse.name if warehouse else "Bodega principal",
        seller_name=(seller.full_name or seller.username) if seller else None,
        company_name=company.name if company else "FUNDACION NUESTRO FUTURO",
        company_nit=company.nit if company else None,
        company_address=company.address if company else None,
        company_phone=company.phone if company else None,
        subtotal=sale.subtotal,
        tax_total=sale.tax_total,
        total=sale.total,
        items=[
            SaleReceiptItemOut(
                product_name=item.product_name_snapshot,
                barcode=item.barcode_snapshot,
                quantity=item.quantity,
                unit_price_excl_tax=item.unit_price_excl_tax,
                vat_rate=item.vat_rate,
                line_subtotal=item.line_subtotal,
                line_tax=item.line_tax,
                line_total=item.line_total,
            )
            for item in items
        ],
    )


@router.post("/adjustments", response_model=InventoryDocumentOut, status_code=status.HTTP_201_CREATED)
def create_adjustment(
    payload: InventoryAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("inventory.manage")),
) -> InventoryDocumentOut:
    if not payload.items:
        raise HTTPException(status_code=400, detail="El ajuste debe incluir al menos un ítem")

    warehouse = db.get(Warehouse, payload.warehouse_id)
    if not warehouse:
        raise HTTPException(status_code=404, detail="Bodega no encontrada")

    if payload.adjustment_type in {AdjustmentType.SHRINKAGE, AdjustmentType.DAMAGE, AdjustmentType.ADJUSTMENT_OUT}:
        if not payload.reason or not payload.reason.strip():
            raise HTTPException(status_code=400, detail="Las salidas requieren motivo")

    product_ids = {item.product_id for item in payload.items}
    existing_product_ids = set(db.scalars(select(Product.id).where(Product.id.in_(product_ids))).all())
    missing_products = sorted(product_ids - existing_product_ids)
    if missing_products:
        raise HTTPException(status_code=404, detail=f"Productos no encontrados: {', '.join(map(str, missing_products))}")

    adjustment = InventoryAdjustment(
        adjustment_number=payload.adjustment_number or generate_document_number("AJUSTE"),
        adjustment_type=payload.adjustment_type,
        warehouse_id=payload.warehouse_id,
        reference_sale_id=payload.reference_sale_id,
        adjusted_at=payload.adjusted_at or _now_utc(),
        status=DocStatus.DRAFT,
        reason=payload.reason.strip(),
        note=payload.note,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(adjustment)
    db.flush()

    for item in payload.items:
        db.add(
            InventoryAdjustmentItem(
                adjustment_id=adjustment.id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
                note=item.note,
            )
        )

    # Asegura que los ítems estén insertados antes de confirmar (trigger de inventario).
    db.flush()

    if payload.confirm:
        adjustment.status = DocStatus.CONFIRMED
        adjustment.updated_by = current_user.id
        db.flush()

    try:
        db.commit()
    except (IntegrityError, DBAPIError) as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"No se pudo registrar el ajuste: {_extract_db_error(exc)}") from exc

    db.refresh(adjustment)
    return _build_document_out(adjustment, "adjustment_number")


@router.get("/kardex", response_model=list[KardexOut])
def get_kardex(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("inventory.view")),
    product_id: int | None = Query(default=None),
    warehouse_id: int | None = Query(default=None),
    movement_type: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
) -> list[InventoryMovement]:
    stmt = select(InventoryMovement)

    if product_id is not None:
        stmt = stmt.where(InventoryMovement.product_id == product_id)
    if warehouse_id is not None:
        stmt = stmt.where(InventoryMovement.warehouse_id == warehouse_id)
    if movement_type:
        stmt = stmt.where(InventoryMovement.movement_type == movement_type)
    if date_from is not None:
        stmt = stmt.where(InventoryMovement.moved_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(InventoryMovement.moved_at <= date_to)

    stmt = stmt.order_by(desc(InventoryMovement.moved_at), desc(InventoryMovement.id)).offset(offset).limit(limit)
    return db.scalars(stmt).all()


@router.get("/stock/current", response_model=list[CurrentStockOut])
def current_stock(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("inventory.view")),
    search: str | None = Query(default=None),
    warehouse_id: int | None = Query(default=None),
    low_only: bool = Query(default=False),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
) -> list[CurrentStockOut]:
    current_stock_expr = func.coalesce(InventoryBalance.quantity, Decimal("0"))
    sold_from, sold_to = _bogota_range_bounds(date_from, date_to)

    sold_stmt = (
        select(
            SaleItem.product_id.label("product_id"),
            func.coalesce(func.sum(SaleItem.quantity), 0).label("sold_quantity"),
            func.coalesce(func.sum(SaleItem.line_total), 0).label("sold_total"),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .where(Sale.status == DocStatus.CONFIRMED)
    )
    if sold_from is not None:
        sold_stmt = sold_stmt.where(Sale.sold_at >= sold_from)
    if sold_to is not None:
        sold_stmt = sold_stmt.where(Sale.sold_at <= sold_to)

    sold = sold_stmt.group_by(SaleItem.product_id).subquery()

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
            current_stock_expr.label("current_stock"),
            Product.min_stock,
            (current_stock_expr <= Product.min_stock).label("is_low_stock"),
            Product.cost_price,
            Product.sale_price_excl_tax,
            Product.vat_rate,
            (current_stock_expr * Product.cost_price).label("stock_value"),
            func.coalesce(sold.c.sold_quantity, 0).label("sold_quantity"),
            func.coalesce(sold.c.sold_total, 0).label("sold_total"),
        )
        .select_from(Product)
        .join(Warehouse, true())
        .outerjoin(
            InventoryBalance,
            and_(InventoryBalance.product_id == Product.id, InventoryBalance.warehouse_id == Warehouse.id),
        )
        .outerjoin(sold, sold.c.product_id == Product.id)
        .where(Product.is_active.is_(True), Warehouse.is_active.is_(True))
    )

    if warehouse_id is not None:
        stmt = stmt.where(Warehouse.id == warehouse_id)

    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(Product.name.ilike(term), Product.sku.ilike(term), Product.barcode.ilike(term)))

    if low_only:
        stmt = stmt.where(current_stock_expr <= Product.min_stock)

    stmt = stmt.order_by(Warehouse.id.asc(), Product.name.asc())

    rows = db.execute(stmt).mappings().all()
    return [CurrentStockOut(**row) for row in rows]
