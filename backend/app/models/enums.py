from __future__ import annotations

from enum import Enum

from sqlalchemy import Enum as SAEnum


class DocStatus(str, Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class PaymentMethod(str, Enum):
    CASH = "CASH"
    CARD = "CARD"
    TRANSFER = "TRANSFER"
    QR = "QR"
    MIXED = "MIXED"
    CREDIT = "CREDIT"


class MovementType(str, Enum):
    PURCHASE = "PURCHASE"
    CUSTOMER_RETURN = "CUSTOMER_RETURN"
    ADJUSTMENT_IN = "ADJUSTMENT_IN"
    SALE = "SALE"
    SHRINKAGE = "SHRINKAGE"
    DAMAGE = "DAMAGE"
    ADJUSTMENT_OUT = "ADJUSTMENT_OUT"


class AdjustmentType(str, Enum):
    CUSTOMER_RETURN = "CUSTOMER_RETURN"
    ADJUSTMENT_IN = "ADJUSTMENT_IN"
    SHRINKAGE = "SHRINKAGE"
    DAMAGE = "DAMAGE"
    ADJUSTMENT_OUT = "ADJUSTMENT_OUT"


DOC_STATUS_ENUM = SAEnum(
    DocStatus,
    name="doc_status",
    schema="ccp",
    create_type=False,
    validate_strings=True,
)

PAYMENT_METHOD_ENUM = SAEnum(
    PaymentMethod,
    name="payment_method",
    schema="ccp",
    create_type=False,
    validate_strings=True,
)

MOVEMENT_TYPE_ENUM = SAEnum(
    MovementType,
    name="movement_type",
    schema="ccp",
    create_type=False,
    validate_strings=True,
)

ADJUSTMENT_TYPE_ENUM = SAEnum(
    AdjustmentType,
    name="adjustment_type",
    schema="ccp",
    create_type=False,
    validate_strings=True,
)
