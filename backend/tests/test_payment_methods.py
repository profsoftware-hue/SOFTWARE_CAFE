from app.api.routes.reports import PAYMENT_METHOD_ORDER
from app.models.enums import PaymentMethod


def test_payment_method_catalog_includes_business_methods() -> None:
    assert {method.value for method in PaymentMethod} == {
        "CASH",
        "CARD",
        "TRANSFER",
        "QR",
        "MIXED",
        "CREDIT",
    }
    assert PaymentMethod.QR.value == "QR"


def test_closing_payment_order_contains_every_method_once() -> None:
    assert set(PAYMENT_METHOD_ORDER) == set(PaymentMethod)
    assert len(PAYMENT_METHOD_ORDER) == len(set(PAYMENT_METHOD_ORDER))
    assert PAYMENT_METHOD_ORDER[0] is PaymentMethod.CASH
    assert PAYMENT_METHOD_ORDER[2] is PaymentMethod.QR
