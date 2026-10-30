from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_permissions
from app.db.session import get_db
from app.models.catalogs import Customer, ProductCategory, Supplier, Warehouse
from app.models.user import User
from app.schemas.catalogs import (
    CategoryCreate,
    CategoryOut,
    CustomerCreate,
    CustomerOut,
    SupplierCreate,
    SupplierOut,
    WarehouseCreate,
    WarehouseOut,
)


router = APIRouter(prefix="/catalogs", tags=["Catálogos"])


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("inventory.view")),
) -> list[ProductCategory]:
    return db.scalars(select(ProductCategory).order_by(ProductCategory.name.asc())).all()


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("inventory.manage")),
) -> ProductCategory:
    obj = ProductCategory(name=payload.name.strip(), description=payload.description)
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo crear la categoría") from exc
    db.refresh(obj)
    return obj


@router.get("/suppliers", response_model=list[SupplierOut])
def list_suppliers(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("inventory.view")),
) -> list[Supplier]:
    return db.scalars(select(Supplier).order_by(Supplier.name.asc())).all()


@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("inventory.manage")),
) -> Supplier:
    obj = Supplier(
        name=payload.name.strip(),
        document_number=payload.document_number,
        contact_name=payload.contact_name,
        phone=payload.phone,
        email=str(payload.email) if payload.email else None,
        address=payload.address,
    )
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo crear el proveedor") from exc
    db.refresh(obj)
    return obj


@router.get("/customers", response_model=list[CustomerOut])
def list_customers(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("inventory.view")),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
) -> list[Customer]:
    stmt = select(Customer).order_by(Customer.name.asc()).offset(offset).limit(limit)
    return db.scalars(stmt).all()


@router.post("/customers", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("sales.create")),
) -> Customer:
    obj = Customer(
        name=payload.name.strip(),
        document_number=payload.document_number,
        phone=payload.phone,
        email=str(payload.email) if payload.email else None,
        address=payload.address,
    )
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo crear el cliente") from exc
    db.refresh(obj)
    return obj


@router.get("/warehouses", response_model=list[WarehouseOut])
def list_warehouses(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("inventory.view")),
) -> list[Warehouse]:
    return db.scalars(select(Warehouse).order_by(Warehouse.id.asc())).all()


@router.post("/warehouses", response_model=WarehouseOut, status_code=status.HTTP_201_CREATED)
def create_warehouse(
    payload: WarehouseCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("settings.manage")),
) -> Warehouse:
    if payload.is_default:
        existing_defaults = db.scalars(select(Warehouse).where(Warehouse.is_default.is_(True))).all()
        for warehouse in existing_defaults:
            warehouse.is_default = False

    obj = Warehouse(
        code=payload.code.strip().upper(),
        name=payload.name.strip(),
        description=payload.description,
        is_default=payload.is_default,
        is_active=True,
    )
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo crear la bodega") from exc
    db.refresh(obj)
    return obj
