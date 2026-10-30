import pytest
from pydantic import ValidationError

from app.api.routes.roles import ROLE_CODE_PATTERN
from app.schemas.product import QuickProductCreate, StockEntryCreate
from app.schemas.user import RoleCreate, RoleUpdate, UserCreate, UserUpdate


def test_user_create_requires_at_least_one_role() -> None:
    with pytest.raises(ValidationError):
        UserCreate(
            full_name="Usuario Prueba",
            email="usuario@example.com",
            username="usuario",
            password="Clave12345*",
            role_codes=[],
        )


def test_user_create_rejects_short_password() -> None:
    with pytest.raises(ValidationError):
        UserCreate(
            full_name="Usuario Prueba",
            email="usuario@example.com",
            username="usuario",
            password="corta",
            role_codes=["SELLER"],
        )


def test_user_update_rejects_empty_role_list() -> None:
    with pytest.raises(ValidationError):
        UserUpdate(role_codes=[])


def test_role_update_allows_clearing_permissions() -> None:
    payload = RoleUpdate(permission_codes=[])
    assert payload.permission_codes == []


def test_role_create_validates_name_length() -> None:
    with pytest.raises(ValidationError):
        RoleCreate(code="TEST", name="ab", permission_codes=[])


@pytest.mark.parametrize("code", ["ADMIN", "SELLER", "WAREHOUSE", "SUPERVISOR_2", "A1B"])
def test_role_code_pattern_accepts_valid_codes(code: str) -> None:
    assert ROLE_CODE_PATTERN.fullmatch(code)


@pytest.mark.parametrize("code", ["", "ab", "roles", "ROL-2", "2ROLE", "ROLE Ñ", "X" * 31])
def test_role_code_pattern_rejects_invalid_codes(code: str) -> None:
    assert ROLE_CODE_PATTERN.fullmatch(code) is None


def test_quick_product_rejects_non_positive_quantity() -> None:
    with pytest.raises(ValidationError):
        QuickProductCreate(name="Producto", quantity=0)


def test_stock_entry_requires_positive_quantity() -> None:
    with pytest.raises(ValidationError):
        StockEntryCreate(quantity=0)
