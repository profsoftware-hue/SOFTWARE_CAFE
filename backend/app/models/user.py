from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = {"schema": "ccp"}

    user_id: Mapped[int] = mapped_column(ForeignKey("ccp.users.id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("ccp.roles.id", ondelete="RESTRICT"), primary_key=True)


class Role(Base):
    __tablename__ = "roles"
    __table_args__ = {"schema": "ccp"}

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    users: Mapped[list[User]] = relationship(
        secondary=lambda: UserRole.__table__,
        back_populates="roles",
        lazy="selectin",
    )


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "ccp"}

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text(), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    roles: Mapped[list[Role]] = relationship(
        secondary=lambda: UserRole.__table__,
        back_populates="users",
        lazy="selectin",
    )
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    __table_args__ = {"schema": "ccp"}

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("ccp.users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(Text(), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped[User] = relationship(back_populates="refresh_tokens")
