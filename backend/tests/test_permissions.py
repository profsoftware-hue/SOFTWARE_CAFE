from app.api.deps import PERMISSION_IMPLICATIONS, effective_permission_codes
from app.models.user import Permission, Role, User


def _user(roles: list[Role]) -> User:
    return User(
        full_name="Usuario de prueba",
        email="permisos@example.com",
        username="permisos",
        password_hash="hash",
        roles=roles,
    )


def _role(code: str, permission_codes: list[str]) -> Role:
    permissions = [
        Permission(code=permission_code, module="Prueba", name=permission_code)
        for permission_code in permission_codes
    ]
    return Role(code=code, name=code, permissions=permissions)


def test_user_without_roles_has_no_permissions() -> None:
    assert effective_permission_codes(_user([])) == set()


def test_direct_permissions_are_returned() -> None:
    user = _user([_role("CUSTOM", ["reports.view", "inventory.view"])])
    assert effective_permission_codes(user) == {"reports.view", "inventory.view"}


def test_manage_permissions_imply_view_permissions() -> None:
    user = _user(
        [
            _role(
                "MANAGER",
                ["inventory.manage", "users.manage", "roles.manage", "settings.manage"],
            )
        ]
    )
    granted = effective_permission_codes(user)
    assert "inventory.view" in granted
    assert "users.view" in granted
    assert "roles.view" in granted
    assert "settings.view" in granted


def test_sales_permission_implies_inventory_view() -> None:
    user = _user([_role("SELLER", ["sales.create"])])
    assert effective_permission_codes(user) == {"sales.create", "inventory.view"}


def test_permissions_are_unioned_across_roles() -> None:
    user = _user(
        [
            _role("A", ["reports.view"]),
            _role("B", ["inventory.manage"]),
            _role("C", ["sales.create"]),
        ]
    )
    assert effective_permission_codes(user) == {
        "reports.view",
        "inventory.manage",
        "inventory.view",
        "sales.create",
    }


def test_implication_map_uses_known_permission_names() -> None:
    expected = {
        "inventory.manage": {"inventory.view"},
        "sales.create": {"inventory.view"},
        "users.manage": {"users.view"},
        "roles.manage": {"roles.view"},
        "settings.manage": {"settings.view"},
    }
    assert PERMISSION_IMPLICATIONS == expected
