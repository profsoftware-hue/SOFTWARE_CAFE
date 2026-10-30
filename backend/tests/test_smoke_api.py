import os
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

if not os.getenv("TEST_DATABASE_URL"):
    pytest.skip("Requiere PostgreSQL de pruebas (TEST_DATABASE_URL)", allow_module_level=True)

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def _login_headers() -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "smokeadmin", "password": "Smoke12345*"},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_health_database() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_bootstrap_product_sale_and_closing() -> None:
    bootstrap = client.post(
        "/api/v1/auth/bootstrap-admin",
        json={
            "full_name": "Smoke Admin",
            "email": "smoke@example.com",
            "username": "smokeadmin",
            "password": "Smoke12345*",
        },
    )
    assert bootstrap.status_code in (201, 400), bootstrap.text

    headers = _login_headers()

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

    stock = client.get("/api/v1/inventory/stock/current", headers=headers)
    assert stock.status_code == 200
    row = next(item for item in stock.json() if item["product_id"] == product_id)
    assert float(row["current_stock"]) == 9.0
