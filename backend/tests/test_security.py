import os

os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_PORT", "5432")
os.environ.setdefault("DB_NAME", "test")
os.environ.setdefault("DB_USER", "test")
os.environ.setdefault("DB_PASSWORD", "test")

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_password_hash_roundtrip() -> None:
    hashed = hash_password("ClaveSegura123*")
    assert hashed != "ClaveSegura123*"
    assert verify_password("ClaveSegura123*", hashed)
    assert not verify_password("OtraClave", hashed)


def test_access_token_roundtrip() -> None:
    token, expires_in = create_access_token("42", {"roles": ["ADMIN"]})
    payload = decode_access_token(token)
    assert payload["sub"] == "42"
    assert payload["roles"] == ["ADMIN"]
    assert expires_in > 0
