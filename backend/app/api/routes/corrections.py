from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_permissions
from app.db.session import get_db
from app.models.catalogs import Customer, Warehouse
from app.models.correction import QuantityCorrection
from app.models.enums import AdjustmentType, DocStatus
from app.models.inventory import InventoryAdjustment, InventoryAdjustmentItem, InventoryBalance
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.user import User
from app.schemas.corrections import (
    CorrectionSaleItemOut,
    CorrectionSaleOut,
    InventoryQuantityCorrectionRequest,
    QuantityCorrectionOut,
    QuantityCorrectionResultOut,
    SaleQuantityCorrectionRequest,
)
from app.schemas.inventory import RecentSaleOut
from app.services.numbering import generate_document_number


router = APIRouter(prefix="/corrections", tags=["Correcciones"])


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _stock_quantity(db: Session, product_id: int, warehouse_id: int) -> Decimal:
    quantity = db.scalar(
        select(InventoryBalance.quantity).where(
            InventoryBalance.product_id == product_id,
            InventoryBalance.warehouse_id == warehouse_id,
        )
    )
    return quantity if quantity is not None else Decimal("0")


def _create_adjustment(
    db: Session,
    *,
    adjustment_type: AdjustmentType,
    product: Product,
    warehouse_id: int,
    quantity: Decimal,
    reference_sale_id: int | None,
    reason: str,
    note: str,
    user_id: int,
) -> InventoryAdjustment:
    adjustment = InventoryAdjustment(
        adjustment_number=generate_document_number("CORR"),
        adjustment_type=adjustment_type,
        warehouse_id=warehouse_id,
        reference_sale_id=reference_sale_id,
        adjusted_at=_now_utc(),
        status=DocStatus.DRAFT,
        reason=reason,
        note=note,
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(adjustment)
    db.flush()

    db.add(
        InventoryAdjustmentItem(
            adjustment_id=adjustment.id,
            product_id=product.id,
            quantity=quantity,
            unit_cost=product.cost_price,
            note=note,
        )
    )
    db.flush()

    # Los ítems deben existir antes de confirmar para que el trigger cree el movimiento.
    adjustment.status = DocStatus.CONFIRMED
    db.flush()
    return adjustment


def _correction_out(
    correction: QuantityCorrection,
    *,
    stock_quantity: Decimal,
    effective_quantity: Decimal | None,
) -> QuantityCorrectionResultOut:
    return QuantityCorrectionResultOut(
        correction_id=correction.id,
        correction_type=correction.correction_type,
        sale_id=correction.sale_id,
        sale_item_id=correction.sale_item_id,
        product_id=correction.product_id,
        warehouse_id=correction.warehouse_id,
        previous_quantity=correction.previous_quantity,
        corrected_quantity=correction.corrected_quantity,
        difference=correction.difference,
        stock_quantity=stock_quantity,
        effective_quantity=effective_quantity,
        adjustment_id=correction.adjustment_id,
        reason=correction.reason,
        created_at=correction.created_at,
    )


@router.get("/sales", response_model=list[RecentSaleOut])
def list_correction_sales(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("corrections.manage")),
    limit: int = Query(default=30, ge=1, le=100),
) -> list[RecentSaleOut]:
    stmt = (
        select(
            Sale.id,
            Sale.sale_number,
            Sale.sold_at,
            Sale.payment_method,
            Customer.name.label("customer_name"),
            Sale.invoice_requested,
            Sale.total,
            Sale.status,
            Sale.cancellation_number,
        )
        .outerjoin(Customer, Customer.id == Sale.customer_id)
        .where(Sale.status == DocStatus.CONFIRMED)
        .order_by(desc(Sale.sold_at), desc(Sale.id))
        .limit(limit)
    )
    return [RecentSaleOut(**row) for row in db.execute(stmt).mappings().all()]


@router.get("/sales/{sale_id}", response_model=CorrectionSaleOut)
def get_correction_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("corrections.manage")),
) -> CorrectionSaleOut:
    sale = db.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if sale.status != DocStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Solo se pueden corregir ventas confirmadas")

    customer = db.get(Customer, sale.customer_id) if sale.customer_id else None
    items = db.scalars(
        select(SaleItem).where(SaleItem.sale_id == sale_id).order_by(SaleItem.id.asc())
    ).all()

    history_rows = db.execute(
        select(QuantityCorrection, User.full_name.label("created_by_name"))
        .outerjoin(User, User.id == QuantityCorrection.created_by)
        .where(QuantityCorrection.sale_id == sale_id)
        .order_by(desc(QuantityCorrection.created_at), desc(QuantityCorrection.id))
    ).all()

    return CorrectionSaleOut(
        sale_id=sale.id,
        sale_number=sale.sale_number,
        sold_at=sale.sold_at,
        status=sale.status,
        total=sale.total,
        customer_name=customer.name if customer else None,
        items=[
            CorrectionSaleItemOut(
                sale_item_id=item.id,
                product_id=item.product_id,
                product_name=item.product_name_snapshot,
                quantity=item.quantity,
                quantity_correction=item.quantity_correction,
                effective_quantity=item.quantity + item.quantity_correction,
                unit_price_excl_tax=item.unit_price_excl_tax,
                line_total=item.line_total,
            )
            for item in items
        ],
        history=[
            QuantityCorrectionOut(
                id=correction.id,
                correction_type=correction.correction_type,
                sale_id=correction.sale_id,
                sale_item_id=correction.sale_item_id,
                product_id=correction.product_id,
                warehouse_id=correction.warehouse_id,
                previous_quantity=correction.previous_quantity,
                corrected_quantity=correction.corrected_quantity,
                difference=correction.difference,
                reason=correction.reason,
                adjustment_id=correction.adjustment_id,
                created_by=correction.created_by,
                created_by_name=created_by_name,
                created_at=correction.created_at,
            )
            for correction, created_by_name in history_rows
        ],
    )


@router.post("/sales/{sale_id}/items/{sale_item_id}", response_model=QuantityCorrectionResultOut)
def correct_sale_item(
    sale_id: int,
    sale_item_id: int,
    payload: SaleQuantityCorrectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("corrections.manage")),
) -> QuantityCorrectionResultOut:
    sale = db.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if sale.status != DocStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Solo se pueden corregir ventas confirmadas")

    item = db.get(SaleItem, sale_item_id)
    if not item or item.sale_id != sale_id:
        raise HTTPException(status_code=404, detail="Ítem de venta no encontrado")

    product = db.get(Product, item.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    previous_effective = item.quantity + item.quantity_correction
    corrected = payload.corrected_quantity
    difference = corrected - previous_effective
    if difference == 0:
        raise HTTPException(status_code=400, detail="La cantidad corregida es igual a la actual")

    if difference > 0:
        available = _stock_quantity(db, item.product_id, sale.warehouse_id)
        if available < difference:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para aumentar lo vendido. Disponible: {available}",
            )

    reason = payload.reason.strip()
    adjustment = None
    if difference != 0:
        adjustment = _create_adjustment(
            db,
            adjustment_type=(
                AdjustmentType.ADJUSTMENT_IN
                if difference < 0
                else AdjustmentType.ADJUSTMENT_OUT
            ),
            product=product,
            warehouse_id=sale.warehouse_id,
            quantity=abs(difference),
            reference_sale_id=sale.id,
            reason=f"Corrección administrativa venta {sale.sale_number}: {reason}",
            note=(
                f"Cantidad vendida corregida de {previous_effective} "
                f"a {corrected} (valor de venta sin cambios)"
            ),
            user_id=current_user.id,
        )

    item.quantity_correction = item.quantity_correction + difference
    correction = QuantityCorrection(
        correction_type="SALE",
        sale_id=sale.id,
        sale_item_id=item.id,
        product_id=item.product_id,
        warehouse_id=sale.warehouse_id,
        previous_quantity=previous_effective,
        corrected_quantity=corrected,
        difference=difference,
        reason=reason,
        adjustment_id=adjustment.id if adjustment else None,
        created_by=current_user.id,
    )
    db.add(correction)

    try:
        db.commit()
    except (IntegrityError, DBAPIError) as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"No se pudo aplicar la corrección: {exc}",
        ) from exc

    db.refresh(correction)
    return _correction_out(
        correction,
        stock_quantity=_stock_quantity(db, item.product_id, sale.warehouse_id),
        effective_quantity=item.quantity + item.quantity_correction,
    )


@router.post("/inventory", response_model=QuantityCorrectionResultOut)
def correct_inventory(
    payload: InventoryQuantityCorrectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("corrections.manage")),
) -> QuantityCorrectionResultOut:
    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    warehouse = db.get(Warehouse, payload.warehouse_id)
    if not warehouse:
        raise HTTPException(status_code=404, detail="Bodega no encontrada")

    current = _stock_quantity(db, product.id, warehouse.id)
    difference = payload.corrected_quantity - current
    if difference == 0:
        raise HTTPException(status_code=400, detail="La cantidad corregida es igual al stock actual")

    reason = payload.reason.strip()
    adjustment = _create_adjustment(
        db,
        adjustment_type=(
            AdjustmentType.ADJUSTMENT_IN if difference > 0 else AdjustmentType.ADJUSTMENT_OUT
        ),
        product=product,
        warehouse_id=warehouse.id,
        quantity=abs(difference),
        reference_sale_id=None,
        reason=f"Corrección administrativa de inventario: {reason}",
        note=f"Stock corregido de {current} a {payload.corrected_quantity}",
        user_id=current_user.id,
    )

    correction = QuantityCorrection(
        correction_type="INVENTORY",
        sale_id=None,
        sale_item_id=None,
        product_id=product.id,
        warehouse_id=warehouse.id,
        previous_quantity=current,
        corrected_quantity=payload.corrected_quantity,
        difference=difference,
        reason=reason,
        adjustment_id=adjustment.id,
        created_by=current_user.id,
    )
    db.add(correction)

    try:
        db.commit()
    except (IntegrityError, DBAPIError) as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"No se pudo aplicar la corrección: {exc}",
        ) from exc

    db.refresh(correction)
    return _correction_out(
        correction,
        stock_quantity=_stock_quantity(db, product.id, warehouse.id),
        effective_quantity=None,
    )
