import pytest

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    password_fingerprint,
    verify_password,
)


def test_password_hash_roundtrip() -> None:
    hashed = hash_password("ClaveSegura123*")
    assert hashed != "ClaveSegura123*"
    assert verify_password("ClaveSegura123*", hashed)
    assert not verify_password("OtraClave", hashed)


def test_access_token_roundtrip() -> None:
    token, expires_in = create_access_token("42", {"roles": ["ADMIN"], "permissions": ["users.view"]})
    payload = decode_access_token(token)
    assert payload["sub"] == "42"
    assert payload["roles"] == ["ADMIN"]
    assert payload["permissions"] == ["users.view"]
    assert expires_in > 0


def test_invalid_token_is_rejected() -> None:
    with pytest.raises(ValueError):
        decode_access_token("token-invalido")


def test_password_fingerprint_is_stable_and_changes_with_hash() -> None:
    first_hash = hash_password("ClaveSegura123*")
    second_hash = hash_password("OtraClave123*")

    first = password_fingerprint(first_hash)
    assert first == password_fingerprint(first_hash)
    assert len(first) == 16
    assert first != password_fingerprint(second_hash)
