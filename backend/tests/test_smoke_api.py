import os
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

if not os.getenv("TEST_DATABASE_URL"):
    pytest.skip("Requiere PostgreSQL de pruebas (TEST_DATABASE_URL)", allow_module_level=True)

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import app
from app.models.user import Role, User


client = TestClient(app)


def _ensure_admin() -> None:
    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.username == "smokeadmin"))
        if existing is not None:
            return

        admin_role = db.scalar(select(Role).where(Role.code == "ADMIN"))
        assert admin_role is not None, "La migración debe crear el rol ADMIN"

        user = User(
            full_name="Smoke Admin",
            email="smoke@example.com",
            username="smokeadmin",
            password_hash=hash_password("Smoke12345*"),
            is_active=True,
        )
        user.roles = [admin_role]
        db.add(user)
        db.commit()


def _login_headers(username: str = "smokeadmin", password: str = "Smoke12345*") -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200, response.text
    # El TestClient comparte cookies; se limpian para que cada usuario use su Bearer.
    client.cookies.clear()
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_health_database() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_cookie_session_flow() -> None:
    _ensure_admin()
    cookie_client = TestClient(app)

    login = cookie_client.post(
        "/api/v1/auth/login",
        json={"username": "smokeadmin", "password": "Smoke12345*"},
    )
    assert login.status_code == 200, login.text
    assert "ccp_access_token" in cookie_client.cookies

    me = cookie_client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["username"] == "smokeadmin"

    logout = cookie_client.post("/api/v1/auth/logout")
    assert logout.status_code == 200
    after_logout = cookie_client.get("/api/v1/auth/me")
    assert after_logout.status_code == 401


def test_product_sale_and_closing() -> None:
    _ensure_admin()
    headers = _login_headers()

    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["username"] == "smokeadmin"
    assert "users.manage" in me.json()["permissions"]

    product = client.post(
        "/api/v1/products/quick",
        json={
            "name": "Producto smoke",
            "quantity": 10,
            "cost_price": 500,
            "sale_price_excl_tax": 1000,
            "sku": "SMOKE-001",
        },
        headers=headers,
    )
    assert product.status_code == 201, product.text
    product_id = product.json()["id"]

    sale = client.post(
        "/api/v1/inventory/sales",
        json={
            "warehouse_id": 1,
            "payment_method": "CASH",
            "items": [{"product_id": product_id, "quantity": 1}],
            "confirm": True,
        },
        headers=headers,
    )
    assert sale.status_code == 201, sale.text
    sale_id = sale.json()["id"]

    receipt = client.get(f"/api/v1/inventory/sales/{sale_id}/receipt", headers=headers)
    assert receipt.status_code == 200
    assert receipt.json()["items"][0]["product_name"] == "Producto smoke"

    today = datetime.now(ZoneInfo("America/Bogota")).date().isoformat()
    closing = client.get(
        f"/api/v1/reports/daily-closing?date_from={today}&date_to={today}",
        headers=headers,
    )
    assert closing.status_code == 200, closing.text
    assert closing.json()["tickets"] >= 1
    assert float(closing.json()["total"]) >= 0
    payment_methods = {item["payment_method"]: item for item in closing.json()["payment_methods"]}
    assert set(payment_methods) == {"CASH", "CARD", "TRANSFER", "QR", "MIXED", "CREDIT"}
    assert payment_methods["CASH"]["tickets"] >= 1
    assert float(payment_methods["CASH"]["total"]) >= 1190.0

    stock = client.get("/api/v1/inventory/stock/current", headers=headers)
    assert stock.status_code == 200
    row = next(item for item in stock.json() if item["product_id"] == product_id)
    assert float(row["current_stock"]) == 9.0
    assert float(row["sold_quantity"]) == 1.0
    assert float(row["sold_total"]) == 1190.0

    filtered = client.get(
        f"/api/v1/inventory/stock/current?date_from={today}&date_to={today}",
        headers=headers,
    )
    assert filtered.status_code == 200
    filtered_row = next(item for item in filtered.json() if item["product_id"] == product_id)
    assert float(filtered_row["sold_quantity"]) == 1.0
    assert float(filtered_row["sold_total"]) == 1190.0

    outside_range = client.get(
        "/api/v1/inventory/stock/current?date_from=2020-01-01&date_to=2020-01-31",
        headers=headers,
    )
    assert outside_range.status_code == 200
    outside_row = next(item for item in outside_range.json() if item["product_id"] == product_id)
    assert float(outside_row["sold_quantity"]) == 0.0
    assert float(outside_row["sold_total"]) == 0.0

    qr_sale = client.post(
        "/api/v1/inventory/sales",
        json={
            "warehouse_id": 1,
            "payment_method": "QR",
            "items": [{"product_id": product_id, "quantity": 1}],
            "confirm": True,
        },
        headers=headers,
    )
    assert qr_sale.status_code == 201, qr_sale.text

    closing_with_qr = client.get(
        f"/api/v1/reports/daily-closing?date_from={today}&date_to={today}",
        headers=headers,
    )
    assert closing_with_qr.status_code == 200, closing_with_qr.text
    qr_methods = {item["payment_method"]: item for item in closing_with_qr.json()["payment_methods"]}
    assert qr_methods["QR"]["tickets"] >= 1
    assert float(qr_methods["QR"]["total"]) >= 1190.0

    customers = client.get("/api/v1/catalogs/customers", headers=headers).json()
    customer = next((item for item in customers if item["document_number"] == "TEST-INV-001"), None)
    if customer is None:
        created_customer = client.post(
            "/api/v1/catalogs/customers",
            json={
                "customer_type": "NATURAL",
                "first_name": "Ana",
                "last_name": "Pérez",
                "document_type": "CC",
                "document_number": "TEST-INV-001",
                "email": "ana.factura@example.com",
                "phone": "3001234567",
            },
            headers=headers,
        )
        assert created_customer.status_code == 201, created_customer.text
        customer = created_customer.json()
    assert customer["name"] == "Ana Pérez"

    lookup = client.get(
        "/api/v1/catalogs/customers/lookup",
        params={"document_type": "CC", "document_number": "TEST-INV-001"},
        headers=headers,
    )
    assert lookup.status_code == 200, lookup.text
    assert lookup.json()["id"] == customer["id"]

    lookup_missing = client.get(
        "/api/v1/catalogs/customers/lookup",
        params={"document_type": "CC", "document_number": "NO-EXISTE-E2E"},
        headers=headers,
    )
    assert lookup_missing.status_code == 404

    duplicate = client.post(
        "/api/v1/catalogs/customers",
        json={
            "customer_type": "NATURAL",
            "first_name": "Otra",
            "last_name": "Persona",
            "document_type": "CC",
            "document_number": "TEST-INV-001",
            "email": "otra@example.com",
            "phone": "3000000000",
        },
        headers=headers,
    )
    assert duplicate.status_code == 409

    missing_customer = client.post(
        "/api/v1/inventory/sales",
        json={
            "warehouse_id": 1,
            "payment_method": "CASH",
            "invoice_requested": True,
            "items": [{"product_id": product_id, "quantity": 1}],
            "confirm": True,
        },
        headers=headers,
    )
    assert missing_customer.status_code == 400

    invoice_sale = client.post(
        "/api/v1/inventory/sales",
        json={
            "warehouse_id": 1,
            "customer_id": customer["id"],
            "payment_method": "TRANSFER",
            "invoice_requested": True,
            "items": [{"product_id": product_id, "quantity": 1}],
            "confirm": True,
        },
        headers=headers,
    )
    assert invoice_sale.status_code == 201, invoice_sale.text
    invoice_sale_id = invoice_sale.json()["id"]

    invoice_receipt = client.get(
        f"/api/v1/inventory/sales/{invoice_sale_id}/receipt",
        headers=headers,
    )
    assert invoice_receipt.status_code == 200
    receipt_data = invoice_receipt.json()
    assert receipt_data["invoice_requested"] is True
    assert receipt_data["invoice_customer_document_number"] == "TEST-INV-001"
    assert receipt_data["invoice_customer_email"] == "ana.factura@example.com"

    third_parties = client.get(
        f"/api/v1/reports/third-parties?date_from={today}&date_to={today}",
        headers=headers,
    )
    assert third_parties.status_code == 200, third_parties.text
    third_party = next(item for item in third_parties.json() if item["customer_id"] == customer["id"])
    assert third_party["invoice_count"] >= 1
    assert float(third_party["total_invoiced"]) >= 1190.0

    invoice_requests = client.get(
        f"/api/v1/reports/invoice-requests?date_from={today}&date_to={today}",
        headers=headers,
    )
    assert invoice_requests.status_code == 200, invoice_requests.text
    assert any(item["sale_id"] == invoice_sale_id for item in invoice_requests.json())

    recent = client.get("/api/v1/inventory/sales/recent?limit=10", headers=headers)
    assert recent.status_code == 200, recent.text
    recent_sale = next(item for item in recent.json() if item["id"] == invoice_sale_id)
    assert recent_sale["customer_name"] == "Ana Pérez"
    assert recent_sale["invoice_requested"] is True
    assert recent_sale["sale_number"] == invoice_sale.json()["number"]

    # El administrador puede editar un producto existente y conservar decimales.
    updated = client.patch(
        f"/api/v1/products/{product_id}",
        json={
            "sale_price_excl_tax": "1000.75",
            "cost_price": "500.25",
            "min_stock": "2.5",
        },
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    updated_product = updated.json()
    assert float(updated_product["sale_price_excl_tax"]) == 1000.75
    assert float(updated_product["cost_price"]) == 500.25
    assert float(updated_product["min_stock"]) == 2.5
    assert float(updated_product["final_price_incl_tax"]) == 1190.89

    stock_before = next(
        item for item in client.get("/api/v1/inventory/stock/current", headers=headers).json()
        if item["product_id"] == product_id
    )
    cancelled = client.post(
        f"/api/v1/inventory/sales/{invoice_sale_id}/cancel",
        json={"cancellation_type": "ERROR", "reason": "Facturación equivocada"},
        headers=headers,
    )
    assert cancelled.status_code == 200, cancelled.text
    cancelled_data = cancelled.json()
    assert cancelled_data["status"] == "CANCELLED"
    assert cancelled_data["cancellation_number"].startswith("ANUL-")
    assert float(cancelled_data["returned_quantity"]) == 1.0

    stock_after = next(
        item for item in client.get("/api/v1/inventory/stock/current", headers=headers).json()
        if item["product_id"] == product_id
    )
    assert float(stock_after["current_stock"]) == float(stock_before["current_stock"]) + 1.0

    cancelled_receipt = client.get(
        f"/api/v1/inventory/sales/{invoice_sale_id}/receipt",
        headers=headers,
    )
    assert cancelled_receipt.status_code == 200
    assert cancelled_receipt.json()["status"] == "CANCELLED"
    assert cancelled_receipt.json()["cancellation_number"] == cancelled_data["cancellation_number"]

    recent_without_cancelled = client.get(
        "/api/v1/inventory/sales/recent?limit=20",
        headers=headers,
    )
    assert all(item["id"] != invoice_sale_id for item in recent_without_cancelled.json())

    recent_with_cancelled = client.get(
        "/api/v1/inventory/sales/recent?limit=20&include_cancelled=true",
        headers=headers,
    )
    cancelled_recent = next(item for item in recent_with_cancelled.json() if item["id"] == invoice_sale_id)
    assert cancelled_recent["status"] == "CANCELLED"
    assert cancelled_recent["cancellation_number"] == cancelled_data["cancellation_number"]

    invoice_requests_after_cancel = client.get(
        f"/api/v1/reports/invoice-requests?date_from={today}&date_to={today}",
        headers=headers,
    )
    assert all(item["sale_id"] != invoice_sale_id for item in invoice_requests_after_cancel.json())

    blocked_delete = client.delete(f"/api/v1/products/{product_id}", headers=headers)
    assert blocked_delete.status_code == 409

    forced_delete = client.delete(f"/api/v1/products/{product_id}?force=true", headers=headers)
    assert forced_delete.status_code == 200, forced_delete.text
    assert client.get(f"/api/v1/products/{product_id}", headers=headers).status_code == 404


def test_shared_sale_requires_cancellation_before_force_delete() -> None:
    _ensure_admin()
    headers = _login_headers()

    product_a = client.post(
        "/api/v1/products/quick",
        json={
            "name": "Producto compartido A",
            "quantity": 5,
            "cost_price": 500,
            "sale_price_excl_tax": 1000,
            "sku": "SMOKE-SHARED-A",
        },
        headers=headers,
    )
    assert product_a.status_code == 201, product_a.text
    product_a_id = product_a.json()["id"]

    product_b = client.post(
        "/api/v1/products/quick",
        json={
            "name": "Producto compartido B",
            "quantity": 5,
            "cost_price": 800,
            "sale_price_excl_tax": 2000,
            "sku": "SMOKE-SHARED-B",
        },
        headers=headers,
    )
    assert product_b.status_code == 201, product_b.text
    product_b_id = product_b.json()["id"]

    sale = client.post(
        "/api/v1/inventory/sales",
        json={
            "warehouse_id": 1,
            "payment_method": "CASH",
            "items": [
                {"product_id": product_a_id, "quantity": 1},
                {"product_id": product_b_id, "quantity": 1},
            ],
            "confirm": True,
        },
        headers=headers,
    )
    assert sale.status_code == 201, sale.text
    sale_id = sale.json()["id"]
    sale_number = sale.json()["number"]

    blocked = client.delete(f"/api/v1/products/{product_a_id}?force=true", headers=headers)
    assert blocked.status_code == 409
    assert sale_number in blocked.json()["detail"]

    cancelled = client.post(
        f"/api/v1/inventory/sales/{sale_id}/cancel",
        json={"cancellation_type": "ERROR", "reason": "Venta de prueba compartida"},
        headers=headers,
    )
    assert cancelled.status_code == 200, cancelled.text

    deleted_a = client.delete(f"/api/v1/products/{product_a_id}?force=true", headers=headers)
    assert deleted_a.status_code == 200, deleted_a.text
    assert client.get(f"/api/v1/products/{product_a_id}", headers=headers).status_code == 404
    assert client.get(f"/api/v1/products/{product_b_id}", headers=headers).status_code == 200

    cancelled_receipt = client.get(f"/api/v1/inventory/sales/{sale_id}/receipt", headers=headers)
    assert cancelled_receipt.status_code == 200
    assert cancelled_receipt.json()["status"] == "CANCELLED"
    assert len(cancelled_receipt.json()["items"]) == 1

    deleted_b = client.delete(f"/api/v1/products/{product_b_id}?force=true", headers=headers)
    assert deleted_b.status_code == 200, deleted_b.text


def test_admin_quantity_corrections() -> None:
    _ensure_admin()
    headers = _login_headers()

    product = client.post(
        "/api/v1/products/quick",
        json={
            "name": "Producto corrección",
            "quantity": 20,
            "cost_price": 500,
            "sale_price_excl_tax": 1000,
            "sku": "SMOKE-CORR-001",
        },
        headers=headers,
    )
    assert product.status_code == 201, product.text
    product_id = product.json()["id"]

    sale = client.post(
        "/api/v1/inventory/sales",
        json={
            "warehouse_id": 1,
            "payment_method": "CASH",
            "items": [{"product_id": product_id, "quantity": 10}],
            "confirm": True,
        },
        headers=headers,
    )
    assert sale.status_code == 201, sale.text
    sale_id = sale.json()["id"]
    assert float(sale.json()["total"]) == 11900.0

    detail = client.get(f"/api/v1/corrections/sales/{sale_id}", headers=headers)
    assert detail.status_code == 200, detail.text
    item = detail.json()["items"][0]
    sale_item_id = item["sale_item_id"]
    assert float(item["quantity"]) == 10.0
    assert float(item["effective_quantity"]) == 10.0

    corrected = client.post(
        f"/api/v1/corrections/sales/{sale_id}/items/{sale_item_id}",
        json={"corrected_quantity": 2, "reason": "Se digitaron 10 y eran 2"},
        headers=headers,
    )
    assert corrected.status_code == 200, corrected.text
    corrected_data = corrected.json()
    assert float(corrected_data["difference"]) == -8.0
    assert float(corrected_data["stock_quantity"]) == 18.0
    assert float(corrected_data["effective_quantity"]) == 2.0

    receipt = client.get(f"/api/v1/inventory/sales/{sale_id}/receipt", headers=headers)
    assert receipt.status_code == 200
    assert float(receipt.json()["total"]) == 11900.0
    assert float(receipt.json()["items"][0]["quantity"]) == 10.0

    stock = client.get("/api/v1/inventory/stock/current", headers=headers)
    assert stock.status_code == 200
    row = next(item for item in stock.json() if item["product_id"] == product_id)
    assert float(row["sold_quantity"]) == 2.0
    assert float(row["sold_total"]) == 11900.0
    assert float(row["current_stock"]) == 18.0

    detail_after = client.get(f"/api/v1/corrections/sales/{sale_id}", headers=headers)
    assert detail_after.status_code == 200
    assert len(detail_after.json()["history"]) == 1
    assert float(detail_after.json()["items"][0]["effective_quantity"]) == 2.0

    cancelled = client.post(
        f"/api/v1/inventory/sales/{sale_id}/cancel",
        json={"cancellation_type": "ERROR", "reason": "Venta corregida y anulada"},
        headers=headers,
    )
    assert cancelled.status_code == 200, cancelled.text
    assert float(cancelled.json()["returned_quantity"]) == 2.0

    stock_after_cancel = client.get("/api/v1/inventory/stock/current", headers=headers)
    row_after_cancel = next(
        item for item in stock_after_cancel.json() if item["product_id"] == product_id
    )
    assert float(row_after_cancel["current_stock"]) == 20.0

    inventory_corrected = client.post(
        "/api/v1/corrections/inventory",
        json={
            "product_id": product_id,
            "warehouse_id": 1,
            "corrected_quantity": 15,
            "reason": "Conteo físico",
        },
        headers=headers,
    )
    assert inventory_corrected.status_code == 200, inventory_corrected.text
    assert float(inventory_corrected.json()["difference"]) == -5.0
    assert float(inventory_corrected.json()["stock_quantity"]) == 15.0

    deleted = client.delete(f"/api/v1/products/{product_id}?force=true", headers=headers)
    assert deleted.status_code == 200, deleted.text


def test_roles_and_permissions_are_enforced() -> None:
    _ensure_admin()
    admin_headers = _login_headers()

    roles = client.get("/api/v1/roles", headers=admin_headers)
    assert roles.status_code == 200, roles.text
    role = next((item for item in roles.json() if item["code"] == "REPORTS_ONLY"), None)
    if role is None:
        created = client.post(
            "/api/v1/roles",
            json={
                "code": "REPORTS_ONLY",
                "name": "Solo reportes",
                "description": "Rol de prueba para validar permisos",
                "permission_codes": ["reports.view"],
            },
            headers=admin_headers,
        )
        assert created.status_code == 201, created.text
        role_id = created.json()["id"]
    else:
        role_id = role["id"]

    user = client.post(
        "/api/v1/users",
        json={
            "full_name": "Usuario Reportes",
            "email": "reportes@example.com",
            "username": "reportsuser",
            "password": "Reports12345*",
            "role_codes": ["REPORTS_ONLY"],
        },
        headers=admin_headers,
    )
    assert user.status_code in (201, 400), user.text

    user_headers = _login_headers("reportsuser", "Reports12345*")

    allowed = client.get("/api/v1/reports/inventory-value", headers=user_headers)
    assert allowed.status_code == 200, allowed.text

    denied_users = client.get("/api/v1/users", headers=user_headers)
    assert denied_users.status_code == 403

    denied_product = client.post(
        "/api/v1/products/quick",
        json={
            "name": "Producto no permitido",
            "quantity": 1,
            "cost_price": 100,
            "sale_price_excl_tax": 100,
        },
        headers=user_headers,
    )
    assert denied_product.status_code == 403

    granted = client.put(
        f"/api/v1/roles/{role_id}",
        json={"permission_codes": ["reports.view", "inventory.view"]},
        headers=admin_headers,
    )
    assert granted.status_code == 200, granted.text
    now_allowed = client.get("/api/v1/products?limit=1", headers=user_headers)
    assert now_allowed.status_code == 200

    restored = client.put(
        f"/api/v1/roles/{role_id}",
        json={"permission_codes": ["reports.view"]},
        headers=admin_headers,
    )
    assert restored.status_code == 200, restored.text


def test_admin_guard_and_permission_hierarchy() -> None:
    _ensure_admin()
    admin_headers = _login_headers()
    admin = client.get("/api/v1/auth/me", headers=admin_headers).json()
    admin_id = admin["id"]

    self_deactivate = client.put(
        f"/api/v1/users/{admin_id}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert self_deactivate.status_code == 400

    users = client.get("/api/v1/users?limit=200", headers=admin_headers).json()
    active_admins = [
        item
        for item in users
        if item["is_active"] and any(role["code"] == "ADMIN" for role in item["roles"])
    ]
    if len(active_admins) == 1:
        self_demote = client.put(
            f"/api/v1/users/{admin_id}",
            json={"role_codes": ["SELLER"]},
            headers=admin_headers,
        )
        assert self_demote.status_code == 400

    changed_password = client.put(
        f"/api/v1/users/{admin_id}",
        json={"password": "SmokeChanged123*"},
        headers=admin_headers,
    )
    assert changed_password.status_code == 200
    old_token = client.get("/api/v1/auth/me", headers=admin_headers)
    assert old_token.status_code == 401

    admin_headers = _login_headers(password="SmokeChanged123*")
    restored_password = client.put(
        f"/api/v1/users/{admin_id}",
        json={"password": "Smoke12345*"},
        headers=admin_headers,
    )
    assert restored_password.status_code == 200
    admin_headers = _login_headers()

    roles = client.get("/api/v1/roles", headers=admin_headers).json()
    manager_role = next((item for item in roles if item["code"] == "USER_MANAGER"), None)
    if manager_role is None:
        created_role = client.post(
            "/api/v1/roles",
            json={
                "code": "USER_MANAGER",
                "name": "Gestor de usuarios",
                "permission_codes": ["users.view", "users.manage", "roles.view", "roles.manage"],
            },
            headers=admin_headers,
        )
        assert created_role.status_code in (201, 400), created_role.text

    manager_user = client.post(
        "/api/v1/users",
        json={
            "full_name": "Gestor Usuarios",
            "email": "manager@example.com",
            "username": "manageruser",
            "password": "Manager12345*",
            "role_codes": ["USER_MANAGER"],
        },
        headers=admin_headers,
    )
    assert manager_user.status_code in (201, 400), manager_user.text

    manager_headers = _login_headers("manageruser", "Manager12345*")
    escalated = client.post(
        "/api/v1/users",
        json={
            "full_name": "Admin infiltrado",
            "email": "infiltrado@example.com",
            "username": "infiltrado",
            "password": "Infiltrado123*",
            "role_codes": ["ADMIN"],
        },
        headers=manager_headers,
    )
    assert escalated.status_code == 403

    touching_admin = client.put(
        f"/api/v1/users/{admin_id}",
        json={"full_name": "Admin cambiado"},
        headers=manager_headers,
    )
    assert touching_admin.status_code == 403

    inv_role = next((item for item in roles if item["code"] == "INV_MANAGER"), None)
    if inv_role is None:
        created_inv = client.post(
            "/api/v1/roles",
            json={
                "code": "INV_MANAGER",
                "name": "Gestor de inventario",
                "permission_codes": ["inventory.manage"],
            },
            headers=admin_headers,
        )
        assert created_inv.status_code in (201, 400), created_inv.text

    inv_user = client.post(
        "/api/v1/users",
        json={
            "full_name": "Gestor Inventario",
            "email": "invmanager@example.com",
            "username": "invmanager",
            "password": "Inventory123*",
            "role_codes": ["INV_MANAGER"],
        },
        headers=admin_headers,
    )
    assert inv_user.status_code in (201, 400), inv_user.text

    inv_headers = _login_headers("invmanager", "Inventory123*")
    products = client.get("/api/v1/products?limit=1", headers=inv_headers)
    reports = client.get("/api/v1/reports/inventory-value", headers=inv_headers)
    corrections = client.get("/api/v1/corrections/sales", headers=inv_headers)
    assert products.status_code == 200
    assert reports.status_code == 403
    assert corrections.status_code == 403
