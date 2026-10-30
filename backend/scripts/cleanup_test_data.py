"""Elimina todos los datos de prueba creados por seed_test_products.py.

Uso (desde la carpeta backend):

    python scripts/cleanup_test_data.py

Borra únicamente registros identificados como de prueba:
  - Productos con SKU que empieza en TEST-
  - Movimientos y saldos de inventario de esos productos
  - Ítems de ventas/compras/ajustes de esos productos
  - Documentos (venta/compra/ajuste) que queden sin ítems
  - Categoría y proveedor de prueba si ya no están en uso
"""

from __future__ import annotations

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import delete, func, select  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.catalogs import ProductCategory, Supplier  # noqa: E402
from app.models.inventory import (  # noqa: E402
    InventoryAdjustment,
    InventoryAdjustmentItem,
    InventoryBalance,
    InventoryMovement,
)
from app.models.product import Product  # noqa: E402
from app.models.purchase import Purchase, PurchaseItem  # noqa: E402
from app.models.sale import Sale, SaleItem  # noqa: E402
from app.services.images import remove_stored_image  # noqa: E402

TEST_PREFIX = "TEST-"
TEST_CATEGORY = "TEST - Productos de prueba"
TEST_SUPPLIER = "TEST - Proveedor de prueba"


def _delete_empty_documents(db, model, item_model, item_fk: str, document_ids: list[int]) -> int:
    deleted = 0
    for document_id in document_ids:
        remaining = db.scalar(
            select(func.count()).select_from(item_model).where(getattr(item_model, item_fk) == document_id)
        )
        if (remaining or 0) == 0:
            db.execute(delete(model).where(model.id == document_id))
            deleted += 1
    return deleted


def main() -> int:
    db = SessionLocal()

    try:
        products = db.scalars(select(Product).where(Product.sku.like(f"{TEST_PREFIX}%"))).all()
        if not products:
            print("No se encontraron productos de prueba con prefijo TEST-. Nada que borrar.")
            return 0

        product_ids = [product.id for product in products]
        image_paths = [product.image_path for product in products if product.image_path]

        sale_ids = db.scalars(
            select(SaleItem.sale_id).where(SaleItem.product_id.in_(product_ids)).distinct()
        ).all()
        purchase_ids = db.scalars(
            select(PurchaseItem.purchase_id).where(PurchaseItem.product_id.in_(product_ids)).distinct()
        ).all()
        adjustment_ids = db.scalars(
            select(InventoryAdjustmentItem.adjustment_id)
            .where(InventoryAdjustmentItem.product_id.in_(product_ids))
            .distinct()
        ).all()

        movements = db.execute(
            delete(InventoryMovement).where(InventoryMovement.product_id.in_(product_ids))
        ).rowcount or 0
        balances = db.execute(
            delete(InventoryBalance).where(InventoryBalance.product_id.in_(product_ids))
        ).rowcount or 0
        sale_items = db.execute(delete(SaleItem).where(SaleItem.product_id.in_(product_ids))).rowcount or 0
        purchase_items = db.execute(
            delete(PurchaseItem).where(PurchaseItem.product_id.in_(product_ids))
        ).rowcount or 0
        adjustment_items = db.execute(
            delete(InventoryAdjustmentItem).where(InventoryAdjustmentItem.product_id.in_(product_ids))
        ).rowcount or 0

        db.flush()

        deleted_sales = _delete_empty_documents(db, Sale, SaleItem, "sale_id", sale_ids)
        deleted_purchases = _delete_empty_documents(db, Purchase, PurchaseItem, "purchase_id", purchase_ids)
        deleted_adjustments = _delete_empty_documents(
            db, InventoryAdjustment, InventoryAdjustmentItem, "adjustment_id", adjustment_ids
        )

        deleted_products = db.execute(delete(Product).where(Product.id.in_(product_ids))).rowcount or 0
        db.flush()

        deleted_category = 0
        category = db.scalar(select(ProductCategory).where(ProductCategory.name == TEST_CATEGORY))
        if category and db.scalar(select(Product.id).where(Product.category_id == category.id).limit(1)) is None:
            db.delete(category)
            deleted_category = 1

        deleted_supplier = 0
        supplier = db.scalar(select(Supplier).where(Supplier.name == TEST_SUPPLIER))
        if supplier and db.scalar(select(Product.id).where(Product.supplier_id == supplier.id).limit(1)) is None:
            db.delete(supplier)
            deleted_supplier = 1

        db.commit()

        for image_path in image_paths:
            remove_stored_image(settings.upload_dir, image_path)

        print("Limpieza de datos de prueba completada:")
        print(f"  - Productos eliminados: {deleted_products}")
        print(f"  - Movimientos de inventario: {movements}")
        print(f"  - Saldos de inventario: {balances}")
        print(f"  - Ítems de venta: {sale_items} (ventas vacías eliminadas: {deleted_sales})")
        print(f"  - Ítems de compra: {purchase_items} (compras vacías eliminadas: {deleted_purchases})")
        print(
            f"  - Ítems de ajuste: {adjustment_items} "
            f"(ajustes vacíos eliminados: {deleted_adjustments})"
        )
        print(f"  - Categoría de prueba eliminada: {deleted_category}")
        print(f"  - Proveedor de prueba eliminado: {deleted_supplier}")
        return 0

    except Exception as exc:  # noqa: BLE001
        db.rollback()
        print(f"ERROR al limpiar datos de prueba: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
