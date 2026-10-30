"""Crea productos de prueba identificables con el prefijo TEST-.

Uso (desde la carpeta backend):

    python scripts/seed_test_products.py
    python scripts/seed_test_products.py --with-stock

Sin --with-stock los productos quedan sin movimientos de inventario, por lo que
se pueden eliminar directamente desde la interfaz (módulo Productos -> Eliminar).
Con --with-stock se crea una entrada de inventario para poder probar el POS; en
ese caso usa `python scripts/cleanup_test_data.py` para borrarlos después.
"""

from __future__ import annotations

import argparse
import sys
from decimal import Decimal
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import select  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.models.catalogs import ProductCategory, Supplier, Warehouse  # noqa: E402
from app.models.enums import AdjustmentType, DocStatus  # noqa: E402
from app.models.inventory import InventoryAdjustment, InventoryAdjustmentItem  # noqa: E402
from app.models.product import Product  # noqa: E402
from app.models.user import User  # noqa: E402

TEST_PREFIX = "TEST-"
TEST_CATEGORY = "TEST - Productos de prueba"
TEST_SUPPLIER = "TEST - Proveedor de prueba"

TEST_PRODUCTS = [
    {
        "sku": "TEST-001",
        "barcode": "7700000000011",
        "name": "[PRUEBA] Café molido 500 g",
        "description": "Producto de prueba - IVA 19%",
        "unit": "UND",
        "cost_price": Decimal("9000.00"),
        "sale_price_excl_tax": Decimal("12000.00"),
        "vat_rate": Decimal("0.19"),
        "min_stock": Decimal("5.000"),
    },
    {
        "sku": "TEST-002",
        "barcode": "7700000000028",
        "name": "[PRUEBA] Panela 1 kg",
        "description": "Producto de prueba - IVA 5%",
        "unit": "UND",
        "cost_price": Decimal("3500.00"),
        "sale_price_excl_tax": Decimal("5000.00"),
        "vat_rate": Decimal("0.05"),
        "min_stock": Decimal("10.000"),
    },
    {
        "sku": "TEST-003",
        "barcode": "7700000000035",
        "name": "[PRUEBA] Agua sin gas 600 ml",
        "description": "Producto de prueba - IVA 0%",
        "unit": "UND",
        "cost_price": Decimal("1200.00"),
        "sale_price_excl_tax": Decimal("2500.00"),
        "vat_rate": Decimal("0"),
        "min_stock": Decimal("12.000"),
    },
    {
        "sku": "TEST-004",
        "barcode": "7700000000042",
        "name": "[PRUEBA] Chocolate artesanal",
        "description": "Producto de prueba - IVA 19%",
        "unit": "UND",
        "cost_price": Decimal("4200.00"),
        "sale_price_excl_tax": Decimal("7000.00"),
        "vat_rate": Decimal("0.19"),
        "min_stock": Decimal("4.000"),
    },
    {
        "sku": "TEST-005",
        "barcode": "7700000000059",
        "name": "[PRUEBA] Bolsa reutilizable",
        "description": "Producto de prueba - IVA 19%",
        "unit": "UND",
        "cost_price": Decimal("800.00"),
        "sale_price_excl_tax": Decimal("2000.00"),
        "vat_rate": Decimal("0.19"),
        "min_stock": Decimal("20.000"),
    },
    {
        "sku": "TEST-006",
        "barcode": "7700000000066",
        "name": "[PRUEBA] Leche entera 1 L",
        "description": "Producto de prueba - IVA 0%",
        "unit": "UND",
        "cost_price": Decimal("2800.00"),
        "sale_price_excl_tax": Decimal("3800.00"),
        "vat_rate": Decimal("0"),
        "min_stock": Decimal("8.000"),
    },
]


def get_or_create_category(db) -> ProductCategory:
    category = db.scalar(select(ProductCategory).where(ProductCategory.name == TEST_CATEGORY))
    if category:
        return category

    category = ProductCategory(name=TEST_CATEGORY, description="Categoría creada para pruebas")
    db.add(category)
    db.flush()
    return category


def get_or_create_supplier(db) -> Supplier:
    supplier = db.scalar(select(Supplier).where(Supplier.name == TEST_SUPPLIER))
    if supplier:
        return supplier

    supplier = Supplier(
        name=TEST_SUPPLIER,
        document_number="TEST-NIT",
        contact_name="Pruebas",
        phone="000-000-0000",
    )
    db.add(supplier)
    db.flush()
    return supplier


def main() -> int:
    parser = argparse.ArgumentParser(description="Crea productos de prueba CCP Pereira")
    parser.add_argument(
        "--with-stock",
        action="store_true",
        help="Carga stock inicial para probar el POS (luego requiere cleanup_test_data.py)",
    )
    parser.add_argument(
        "--stock",
        type=int,
        default=25,
        help="Cantidad inicial por producto cuando se usa --with-stock (default: 25)",
    )
    args = parser.parse_args()

    db = SessionLocal()
    created = 0
    updated = 0

    try:
        category = get_or_create_category(db)
        supplier = get_or_create_supplier(db)

        warehouse = db.scalar(select(Warehouse).order_by(Warehouse.is_default.desc(), Warehouse.id.asc()))
        if args.with_stock and not warehouse:
            print("ERROR: no existe ninguna bodega. Crea una bodega antes de cargar stock.")
            return 2

        admin_user = db.scalar(select(User).order_by(User.id.asc()))
        created_products: list[Product] = []

        for item in TEST_PRODUCTS:
            product = db.scalar(select(Product).where(Product.sku == item["sku"]))
            if product:
                product.name = item["name"]
                product.barcode = item["barcode"]
                product.description = item["description"]
                product.unit = item["unit"]
                product.cost_price = item["cost_price"]
                product.sale_price_excl_tax = item["sale_price_excl_tax"]
                product.vat_rate = item["vat_rate"]
                product.min_stock = item["min_stock"]
                product.category_id = category.id
                product.supplier_id = supplier.id
                product.is_active = True
                updated += 1
            else:
                product = Product(
                    sku=item["sku"],
                    barcode=item["barcode"],
                    name=item["name"],
                    description=item["description"],
                    unit=item["unit"],
                    cost_price=item["cost_price"],
                    sale_price_excl_tax=item["sale_price_excl_tax"],
                    vat_rate=item["vat_rate"],
                    min_stock=item["min_stock"],
                    category_id=category.id,
                    supplier_id=supplier.id,
                    is_active=True,
                    created_by=admin_user.id if admin_user else None,
                    updated_by=admin_user.id if admin_user else None,
                )
                db.add(product)
                created += 1

            created_products.append(product)

        db.flush()

        if args.with_stock:
            adjustment = InventoryAdjustment(
                adjustment_number="TEST-AJUSTE-INICIAL",
                adjustment_type=AdjustmentType.ADJUSTMENT_IN,
                warehouse_id=warehouse.id,
                status=DocStatus.DRAFT,
                reason="Carga inicial de productos de prueba",
                note="Generado por scripts/seed_test_products.py --with-stock",
                created_by=admin_user.id if admin_user else None,
                updated_by=admin_user.id if admin_user else None,
            )
            db.add(adjustment)
            db.flush()

            for product in created_products:
                db.add(
                    InventoryAdjustmentItem(
                        adjustment_id=adjustment.id,
                        product_id=product.id,
                        quantity=Decimal(args.stock),
                        unit_cost=product.cost_price,
                    )
                )

            adjustment.status = DocStatus.CONFIRMED

        db.commit()

        print("Productos de prueba listos:")
        print(f"  - Creados: {created}")
        print(f"  - Actualizados: {updated}")
        print(f"  - Categoría: {TEST_CATEGORY}")
        print(f"  - Proveedor: {TEST_SUPPLIER}")
        if args.with_stock:
            print(f"  - Stock inicial: {args.stock} unidades por producto en '{warehouse.name}'")
            print("  - Para borrarlos luego: python scripts/cleanup_test_data.py")
        else:
            print("  - Sin stock inicial: puedes eliminarlos desde la interfaz (Productos -> Eliminar)")
        return 0

    except Exception as exc:  # noqa: BLE001
        db.rollback()
        print(f"ERROR al crear productos de prueba: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
