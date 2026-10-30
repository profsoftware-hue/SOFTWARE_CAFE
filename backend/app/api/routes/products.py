from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_permissions
from app.core.config import settings
from app.db.session import get_db
from app.models.catalogs import ProductCategory, Supplier, Warehouse
from app.models.enums import AdjustmentType, DocStatus
from app.models.inventory import (
    InventoryAdjustment,
    InventoryAdjustmentItem,
    InventoryBalance,
    InventoryMovement,
)
from app.models.product import Product
from app.models.purchase import PurchaseItem
from app.models.sale import SaleItem
from app.models.user import User
from app.schemas.product import ProductOut, ProductPatch, QuickProductCreate, StockEntryCreate
from app.services.images import process_and_store_product_image, remove_stored_image
from app.services.numbering import generate_document_number


router = APIRouter(prefix="/products", tags=["Productos"])

ALLOWED_VAT_RATES = {Decimal("0"), Decimal("0.05"), Decimal("0.19")}


def _validate_vat_rate(vat_rate: Decimal) -> None:
    if vat_rate not in ALLOWED_VAT_RATES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tarifa de IVA inválida. Valores permitidos: 0, 0.05, 0.19",
        )


def _generate_sku(db: Session) -> str:
    """Genera un SKU legible cuando el usuario no lo suministra."""
    next_number = (db.scalar(select(func.max(Product.id))) or 0) + 1
    candidate = f"PROD-{next_number:05d}"
    while db.scalar(select(Product.id).where(Product.sku == candidate)) is not None:
        next_number += 1
        candidate = f"PROD-{next_number:05d}"
    return candidate


def _build_product_out(product: Product) -> ProductOut:
    payload = ProductOut.model_validate(product)
    if product.image_path:
        payload.image_url = f"{settings.api_v1_prefix}/uploads/{product.image_path}"
    return payload


def _ensure_refs_exist(db: Session, category_id: int | None, supplier_id: int | None) -> None:
    if category_id is not None:
        category_exists = db.scalar(select(ProductCategory.id).where(ProductCategory.id == category_id))
        if not category_exists:
            raise HTTPException(status_code=404, detail="Categoría no encontrada")

    if supplier_id is not None:
        supplier_exists = db.scalar(select(Supplier.id).where(Supplier.id == supplier_id))
        if not supplier_exists:
            raise HTTPException(status_code=404, detail="Proveedor no encontrado")


@router.get("", response_model=list[ProductOut])
def list_products(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("inventory.view")),
    search: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    supplier_id: int | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
) -> list[ProductOut]:
    stmt = select(Product)

    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(Product.name.ilike(term), Product.sku.ilike(term), Product.barcode.ilike(term)))

    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)

    if supplier_id is not None:
        stmt = stmt.where(Product.supplier_id == supplier_id)

    if is_active is not None:
        stmt = stmt.where(Product.is_active.is_(is_active))

    stmt = stmt.order_by(Product.id.desc()).offset(offset).limit(limit)
    rows = db.scalars(stmt).all()
    return [_build_product_out(row) for row in rows]


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("inventory.view")),
) -> ProductOut:
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return _build_product_out(product)


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    sku: str | None = Form(default=None),
    barcode: str | None = Form(default=None),
    name: str = Form(...),
    description: str | None = Form(default=None),
    category_id: int | None = Form(default=None),
    supplier_id: int | None = Form(default=None),
    unit: str = Form(default="UND"),
    cost_price: Decimal = Form(default=Decimal("0")),
    sale_price_excl_tax: Decimal = Form(default=Decimal("0")),
    vat_rate: Decimal = Form(default=Decimal("0.19")),
    min_stock: Decimal = Form(default=Decimal("0")),
    is_active: bool = Form(default=True),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("inventory.manage")),
) -> ProductOut:
    _validate_vat_rate(vat_rate)
    _ensure_refs_exist(db, category_id, supplier_id)

    product = Product(
        sku=(sku or "").strip() or _generate_sku(db),
        barcode=barcode.strip() if barcode else None,
        name=name.strip(),
        description=description,
        category_id=category_id,
        supplier_id=supplier_id,
        unit=unit.strip() or "UND",
        cost_price=cost_price,
        sale_price_excl_tax=sale_price_excl_tax,
        vat_rate=vat_rate,
        min_stock=min_stock,
        is_active=is_active,
        created_by=current_user.id,
        updated_by=current_user.id,
    )

    if image is not None:
        image_path, image_mime_type, image_size_bytes = await process_and_store_product_image(settings.upload_dir, image)
        product.image_path = image_path
        product.image_mime_type = image_mime_type
        product.image_size_bytes = image_size_bytes

    db.add(product)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if product.image_path:
            remove_stored_image(settings.upload_dir, product.image_path)
        raise HTTPException(status_code=400, detail="No se pudo crear el producto") from exc

    db.refresh(product)
    return _build_product_out(product)


@router.post("/quick", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_quick_product(
    payload: QuickProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("inventory.manage")),
) -> ProductOut:
    """Alta rápida de inventario: nombre + cantidad, sin exigir código."""
    _validate_vat_rate(payload.vat_rate)

    warehouse: Warehouse | None = None
    if payload.warehouse_id is not None:
        warehouse = db.get(Warehouse, payload.warehouse_id)
        if not warehouse:
            raise HTTPException(status_code=404, detail="Bodega no encontrada")
    else:
        warehouse = db.scalar(
            select(Warehouse)
            .where(Warehouse.is_active.is_(True))
            .order_by(Warehouse.is_default.desc(), Warehouse.id.asc())
        )
        if not warehouse:
            raise HTTPException(status_code=400, detail="No hay bodegas activas. Crea una bodega primero.")

    sku = (payload.sku or "").strip() or _generate_sku(db)
    if db.scalar(select(Product.id).where(Product.sku == sku)) is not None:
        raise HTTPException(status_code=400, detail=f"El SKU '{sku}' ya existe")

    product = Product(
        sku=sku,
        barcode=(payload.barcode or "").strip() or None,
        name=payload.name.strip(),
        unit="UND",
        cost_price=payload.cost_price,
        sale_price_excl_tax=payload.sale_price_excl_tax,
        vat_rate=payload.vat_rate,
        min_stock=payload.min_stock,
        is_active=True,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(product)
    db.flush()

    adjustment = InventoryAdjustment(
        adjustment_number=generate_document_number("ENTRADA"),
        adjustment_type=AdjustmentType.ADJUSTMENT_IN,
        warehouse_id=warehouse.id,
        status=DocStatus.DRAFT,
        reason="Entrada rápida de producto",
        note=f"Stock inicial de {payload.name.strip()}",
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(adjustment)
    db.flush()

    db.add(
        InventoryAdjustmentItem(
            adjustment_id=adjustment.id,
            product_id=product.id,
            quantity=payload.quantity,
            unit_cost=payload.cost_price,
        )
    )
    # El ítem debe existir antes de confirmar para que el trigger lo encuentre.
    db.flush()

    adjustment.status = DocStatus.CONFIRMED
    db.flush()

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo crear el producto rápido") from exc

    db.refresh(product)
    return _build_product_out(product)


@router.post("/{product_id}/stock", response_model=ProductOut)
def add_product_stock(
    product_id: int,
    payload: StockEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("inventory.manage")),
) -> ProductOut:
    """Agrega unidades a un producto existente sin volver a pedir el costo."""
    product = db.get(Product, product_id)
    if not product or not product.is_active:
        raise HTTPException(status_code=404, detail="Producto no encontrado o inactivo")

    if payload.warehouse_id is not None:
        warehouse = db.get(Warehouse, payload.warehouse_id)
        if not warehouse:
            raise HTTPException(status_code=404, detail="Bodega no encontrada")
    else:
        warehouse = db.scalar(
            select(Warehouse)
            .where(Warehouse.is_active.is_(True))
            .order_by(Warehouse.is_default.desc(), Warehouse.id.asc())
        )
        if not warehouse:
            raise HTTPException(status_code=400, detail="No hay bodegas activas.")

    adjustment = InventoryAdjustment(
        adjustment_number=generate_document_number("ENTRADA"),
        adjustment_type=AdjustmentType.ADJUSTMENT_IN,
        warehouse_id=warehouse.id,
        status=DocStatus.DRAFT,
        reason="Entrada de unidades",
        note=f"Unidades recibidas de {product.name}",
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(adjustment)
    db.flush()

    db.add(
        InventoryAdjustmentItem(
            adjustment_id=adjustment.id,
            product_id=product.id,
            quantity=payload.quantity,
            unit_cost=product.cost_price,
        )
    )
    db.flush()

    adjustment.status = DocStatus.CONFIRMED
    db.flush()

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudieron agregar las unidades") from exc

    db.refresh(product)
    return _build_product_out(product)


@router.patch("/{product_id}", response_model=ProductOut)
def patch_product(
    product_id: int,
    payload: ProductPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("inventory.manage")),
) -> ProductOut:
    """Edita precio, costo, nombre, IVA o SKU sin modificar el stock."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    data = payload.model_dump(exclude_unset=True)

    if data.get("vat_rate") is not None:
        _validate_vat_rate(data["vat_rate"])

    if "sku" in data:
        sku = (data.pop("sku") or "").strip()
        if sku and sku != product.sku:
            if db.scalar(select(Product.id).where(Product.sku == sku)) is not None:
                raise HTTPException(status_code=400, detail=f"El SKU '{sku}' ya existe")
            product.sku = sku

    if "barcode" in data:
        product.barcode = (data.pop("barcode") or "").strip() or None

    for field, value in data.items():
        if value is not None:
            setattr(product, field, value)

    product.updated_by = current_user.id

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo actualizar el producto") from exc

    db.refresh(product)
    return _build_product_out(product)


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    sku: str | None = Form(default=None),
    barcode: str | None = Form(default=None),
    name: str = Form(...),
    description: str | None = Form(default=None),
    category_id: int | None = Form(default=None),
    supplier_id: int | None = Form(default=None),
    unit: str = Form(default="UND"),
    cost_price: Decimal = Form(default=Decimal("0")),
    sale_price_excl_tax: Decimal = Form(default=Decimal("0")),
    vat_rate: Decimal = Form(default=Decimal("0.19")),
    min_stock: Decimal = Form(default=Decimal("0")),
    is_active: bool = Form(default=True),
    remove_image: bool = Form(default=False),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("inventory.manage")),
) -> ProductOut:
    _validate_vat_rate(vat_rate)
    _ensure_refs_exist(db, category_id, supplier_id)

    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    previous_image = product.image_path
    new_image_path = None
    new_image_mime = None
    new_image_size = None

    if image is not None:
        new_image_path, new_image_mime, new_image_size = await process_and_store_product_image(settings.upload_dir, image)

    product.sku = (sku or "").strip() or product.sku
    product.barcode = barcode.strip() if barcode else None
    product.name = name.strip()
    product.description = description
    product.category_id = category_id
    product.supplier_id = supplier_id
    product.unit = unit.strip() or "UND"
    product.cost_price = cost_price
    product.sale_price_excl_tax = sale_price_excl_tax
    product.vat_rate = vat_rate
    product.min_stock = min_stock
    product.is_active = is_active
    product.updated_by = current_user.id

    if remove_image:
        product.image_path = None
        product.image_mime_type = None
        product.image_size_bytes = None

    if new_image_path:
        product.image_path = new_image_path
        product.image_mime_type = new_image_mime
        product.image_size_bytes = new_image_size

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if new_image_path:
            remove_stored_image(settings.upload_dir, new_image_path)
        raise HTTPException(status_code=400, detail="No se pudo actualizar el producto") from exc

    if (remove_image or new_image_path) and previous_image and previous_image != product.image_path:
        remove_stored_image(settings.upload_dir, previous_image)

    db.refresh(product)
    return _build_product_out(product)


@router.post("/{product_id}/image", response_model=ProductOut)
async def replace_product_image(
    product_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("inventory.manage")),
) -> ProductOut:
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    old_image = product.image_path
    new_image_path, new_image_mime, new_image_size = await process_and_store_product_image(settings.upload_dir, image)

    product.image_path = new_image_path
    product.image_mime_type = new_image_mime
    product.image_size_bytes = new_image_size
    product.updated_by = current_user.id

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        remove_stored_image(settings.upload_dir, new_image_path)
        raise HTTPException(status_code=400, detail="No se pudo reemplazar la imagen") from exc

    if old_image and old_image != new_image_path:
        remove_stored_image(settings.upload_dir, old_image)

    db.refresh(product)
    return _build_product_out(product)


@router.delete("/{product_id}", status_code=status.HTTP_200_OK)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("inventory.manage")),
) -> dict[str, str]:
    """Elimina un producto solo si no tiene historial de inventario ni comercial.

    Para conservar la trazabilidad, los productos con movimientos, ventas o compras
    deben desactivarse en lugar de borrarse.
    """
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    blocking = [
        ("movimientos de inventario", select(InventoryMovement.id).where(InventoryMovement.product_id == product_id)),
        ("saldos de inventario", select(InventoryBalance.product_id).where(InventoryBalance.product_id == product_id)),
        ("ajustes de inventario", select(InventoryAdjustmentItem.id).where(InventoryAdjustmentItem.product_id == product_id)),
        ("ventas", select(SaleItem.id).where(SaleItem.product_id == product_id)),
        ("compras", select(PurchaseItem.id).where(PurchaseItem.product_id == product_id)),
    ]
    found = [label for label, stmt in blocking if db.scalar(stmt.limit(1)) is not None]
    if found:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "No se puede eliminar: el producto tiene "
                + ", ".join(found)
                + ". Desactívalo en su lugar para conservar la trazabilidad."
            ),
        )

    image_path = product.image_path
    db.delete(product)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo eliminar el producto") from exc

    if image_path:
        remove_stored_image(settings.upload_dir, image_path)

    return {"message": "Producto eliminado correctamente"}
