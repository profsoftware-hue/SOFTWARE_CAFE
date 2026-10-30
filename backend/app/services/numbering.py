from __future__ import annotations

from datetime import datetime
from uuid import uuid4


def generate_document_number(prefix: str) -> str:
    suffix = uuid4().hex[:6].upper()
    return f"{prefix}-{datetime.now():%Y%m%d%H%M%S}-{suffix}"
