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
    assert products.status_code == 200
    assert reports.status_code == 403
