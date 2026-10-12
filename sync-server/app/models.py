from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    private_keys: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    passphrase_salt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    hkdf_salt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    compatibility: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extra_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    vaults: Mapped[List["Vault"]] = relationship(back_populates="owner")


class Vault(Base):
    __tablename__ = "vaults"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(512), default="")
    type: Mapped[str] = mapped_column(String(32), default="remote")
    data_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    owner: Mapped["User"] = relationship(back_populates="vaults")


class EntityRow(Base):
    """Opaque entity storage for vault-scoped and config-scoped entities."""

    __tablename__ = "entities"
    __table_args__ = (
        Index("ix_entities_vault_type_updated", "vault_id", "entity_type", "updated_at"),
        Index("ix_entities_owner_type", "owner_id", "entity_type"),
        UniqueConstraint("id", "entity_type", "vault_id", name="uq_entity_id_type_vault"),
    )

    pk: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id: Mapped[str] = mapped_column(String(64), index=True)
    entity_type: Mapped[str] = mapped_column(String(64), index=True)
    vault_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    data_json: Mapped[str] = mapped_column(Text, default="{}")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )


class ImageBlob(Base):
    __tablename__ = "image_blobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    vault_id: Mapped[str] = mapped_column(String(36), index=True)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    content_type: Mapped[str] = mapped_column(String(128), default="application/octet-stream")
    file_path: Mapped[str] = mapped_column(Text)
    meta_json: Mapped[str] = mapped_column(Text, default="{}")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
