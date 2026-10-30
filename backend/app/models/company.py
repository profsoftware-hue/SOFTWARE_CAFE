from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CompanyProfile(Base):
    __tablename__ = "company_profile"
    __table_args__ = {"schema": "ccp"}

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, default=1)
    name: Mapped[str] = mapped_column(String(120), nullable=False, default="FUNDACION NUESTRO FUTURO")
    nit: Mapped[str | None] = mapped_column(String(30))
    address: Mapped[str | None] = mapped_column(Text())
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(120))
    logo_path: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
