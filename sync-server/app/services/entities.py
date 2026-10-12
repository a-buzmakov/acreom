from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import EntityRow, User, Vault, utcnow
from app.realtime import broadcast_entity
from app.serializers import dumps_json, merge_entity_data, parse_json


def _ms_to_dt(timestamp_ms: int | None) -> datetime | None:
    if timestamp_ms is None or timestamp_ms <= 0:
        return None
    # Client may send seconds or ms; treat small values as seconds.
    if timestamp_ms < 1_000_000_000_000:
        return datetime.fromtimestamp(timestamp_ms, tz=timezone.utc)
    return datetime.fromtimestamp(timestamp_ms / 1000.0, tz=timezone.utc)


def _parse_updated_at(value: Any) -> datetime:
    if value is None:
        return utcnow()
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return _ms_to_dt(int(value)) or utcnow()
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return utcnow()
    return utcnow()


def assert_vault_access(db: Session, user: User, vault_id: str) -> Vault:
    vault = db.get(Vault, vault_id)
    if not vault or vault.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vault not found")
    if vault.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return vault


def _entity_query(
    *,
    entity_type: str,
    entity_id: str,
    vault_id: str | None,
    owner_id: str,
    include_deleted: bool = False,
):
    stmt = select(EntityRow).where(
        EntityRow.id == entity_id,
        EntityRow.entity_type == entity_type,
        EntityRow.owner_id == owner_id,
    )
    if not include_deleted:
        stmt = stmt.where(EntityRow.deleted_at.is_(None))
    if vault_id is None:
        stmt = stmt.where(EntityRow.vault_id.is_(None))
    else:
        stmt = stmt.where(EntityRow.vault_id == vault_id)
    return stmt


def get_active_entity(
    db: Session,
    *,
    entity_type: str,
    entity_id: str,
    vault_id: str | None,
    owner_id: str,
) -> EntityRow | None:
    return db.execute(
        _entity_query(
            entity_type=entity_type,
            entity_id=entity_id,
            vault_id=vault_id,
            owner_id=owner_id,
        )
    ).scalar_one_or_none()


def get_any_entity(
    db: Session,
    *,
    entity_type: str,
    entity_id: str,
    vault_id: str | None,
    owner_id: str,
) -> EntityRow | None:
    return db.execute(
        _entity_query(
            entity_type=entity_type,
            entity_id=entity_id,
            vault_id=vault_id,
            owner_id=owner_id,
            include_deleted=True,
        )
    ).scalar_one_or_none()


def list_entities(
    db: Session,
    *,
    entity_type: str,
    owner_id: str,
    vault_id: str | None = None,
    timestamp: int | None = None,
) -> list[dict[str, Any]]:
    stmt = select(EntityRow).where(
        EntityRow.entity_type == entity_type,
        EntityRow.owner_id == owner_id,
        EntityRow.deleted_at.is_(None),
    )
    if vault_id is None:
        stmt = stmt.where(EntityRow.vault_id.is_(None))
    else:
        stmt = stmt.where(EntityRow.vault_id == vault_id)

    since = _ms_to_dt(timestamp)
    if since is not None:
        stmt = stmt.where(EntityRow.updated_at > since)

    rows = db.execute(stmt.order_by(EntityRow.updated_at.asc())).scalars().all()
    return [parse_json(row.data_json, {}) for row in rows]


def list_delete_changes(
    db: Session,
    *,
    entity_type: str,
    owner_id: str,
    vault_id: str | None,
    timestamp: int,
) -> list[dict[str, Any]]:
    since = _ms_to_dt(timestamp) or datetime.fromtimestamp(0, tz=timezone.utc)
    stmt = select(EntityRow).where(
        EntityRow.entity_type == entity_type,
        EntityRow.owner_id == owner_id,
        EntityRow.deleted_at.is_not(None),
        EntityRow.deleted_at > since,
    )
    if vault_id is None:
        stmt = stmt.where(EntityRow.vault_id.is_(None))
    else:
        stmt = stmt.where(EntityRow.vault_id == vault_id)

    rows = db.execute(stmt).scalars().all()
    return [
        {
            "id": row.id,
            "type": entity_type,
            "vaultId": row.vault_id,
        }
        for row in rows
    ]


async def upsert_entity(
    db: Session,
    *,
    entity_type: str,
    owner_id: str,
    vault_id: str | None,
    payload: dict[str, Any],
    create: bool,
    broadcast: bool = True,
) -> dict[str, Any]:
    client_id = payload.pop("clientId", None) if "clientId" in payload else None
    # Keep clientId inside stored data if client also sent it as a field after spread —
    # ServiceBase puts clientId at top level; entity may also include it.
    entity_id = payload.get("id") or str(uuid4())
    payload["id"] = entity_id
    if vault_id and "vaultId" not in payload:
        payload["vaultId"] = vault_id

    updated_at = _parse_updated_at(payload.get("updatedAt"))
    payload["updatedAt"] = updated_at.isoformat()

    existing = get_any_entity(
        db,
        entity_type=entity_type,
        entity_id=entity_id,
        vault_id=vault_id,
        owner_id=owner_id,
    )

    if existing:
        was_deleted = existing.deleted_at is not None
        data = merge_entity_data(parse_json(existing.data_json, {}), payload)
        if client_id is not None:
            data["clientId"] = client_id
        existing.data_json = dumps_json(data)
        existing.updated_at = updated_at
        existing.deleted_at = None
        db.add(existing)
        action = "create" if (create or was_deleted) else "update"
        result = data
    else:
        data = dict(payload)
        if client_id is not None:
            data["clientId"] = client_id
        row = EntityRow(
            id=entity_id,
            entity_type=entity_type,
            vault_id=vault_id,
            owner_id=owner_id,
            data_json=dumps_json(data),
            updated_at=updated_at,
        )
        db.add(row)
        action = "create"
        result = data

    db.commit()

    if broadcast:
        await broadcast_entity(
            entity_type=entity_type,
            action=action,
            entity=result,
            vault_id=vault_id,
            skip_client_id=client_id,
        )
    return result


async def delete_entity(
    db: Session,
    *,
    entity_type: str,
    owner_id: str,
    vault_id: str | None,
    entity_id: str,
    client_id: str | None = None,
    broadcast: bool = True,
) -> dict[str, Any]:
    row = get_active_entity(
        db,
        entity_type=entity_type,
        entity_id=entity_id,
        vault_id=vault_id,
        owner_id=owner_id,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    data = parse_json(row.data_json, {"id": entity_id})
    row.deleted_at = utcnow()
    row.updated_at = utcnow()
    db.add(row)
    db.commit()

    if broadcast:
        await broadcast_entity(
            entity_type=entity_type,
            action="delete",
            entity={"id": entity_id, "vaultId": vault_id},
            vault_id=vault_id,
            skip_client_id=client_id,
        )
    return data


async def upsert_batch(
    db: Session,
    *,
    entity_type: str,
    owner_id: str,
    vault_id: str | None,
    entities: list[dict[str, Any]],
    create: bool,
    client_id: str | None,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for entity in entities:
        payload = dict(entity)
        if client_id is not None:
            payload.setdefault("clientId", client_id)
        results.append(
            await upsert_entity(
                db,
                entity_type=entity_type,
                owner_id=owner_id,
                vault_id=vault_id,
                payload=payload,
                create=create,
                broadcast=False,
            )
        )
    if results:
        await broadcast_entity(
            entity_type=entity_type,
            action="create" if create else "update",
            entity=results,
            vault_id=vault_id,
            skip_client_id=client_id,
        )
    return results


# --- Vault helpers stored in Vault table but exposed like entities ---


def vault_to_dict(vault: Vault) -> dict[str, Any]:
    data = parse_json(vault.data_json, {})
    data.update(
        {
            "id": vault.id,
            "name": vault.name,
            "type": vault.type,
            "createdAt": vault.created_at.isoformat() if vault.created_at else None,
            "updatedAt": vault.updated_at.isoformat() if vault.updated_at else None,
            "modifiedAt": vault.updated_at.isoformat() if vault.updated_at else None,
        }
    )
    return data


async def upsert_vault(
    db: Session,
    *,
    user: User,
    payload: dict[str, Any],
    create: bool,
) -> dict[str, Any]:
    client_id = payload.pop("clientId", None)
    vault_id = payload.get("id") or str(uuid4())
    payload["id"] = vault_id
    updated_at = _parse_updated_at(payload.get("updatedAt") or payload.get("modifiedAt"))

    vault = db.get(Vault, vault_id)
    if vault and vault.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if vault and vault.deleted_at is None:
        data = merge_entity_data(parse_json(vault.data_json, {}), payload)
        vault.name = data.get("name") or vault.name
        vault.type = data.get("type") or vault.type
        vault.data_json = dumps_json(data)
        vault.updated_at = updated_at
        action = "update"
    else:
        if vault and vault.deleted_at is not None:
            vault.deleted_at = None
        data = dict(payload)
        vault = vault or Vault(id=vault_id, owner_id=user.id)
        vault.owner_id = user.id
        vault.name = data.get("name") or ""
        vault.type = data.get("type") or "remote"
        vault.data_json = dumps_json(data)
        vault.updated_at = updated_at
        action = "create"

    db.add(vault)
    db.commit()
    db.refresh(vault)
    from app.socketio_server import register_vault_namespace

    register_vault_namespace(vault.id)
    result = vault_to_dict(vault)
    await broadcast_entity(
        entity_type="vaults",
        action=action,
        entity=result,
        vault_id=None,
        skip_client_id=client_id,
    )
    return result


def list_vaults(
    db: Session,
    *,
    user: User,
    timestamp: int | None = None,
) -> list[dict[str, Any]]:
    from app.socketio_server import register_vault_namespace

    stmt = select(Vault).where(Vault.owner_id == user.id, Vault.deleted_at.is_(None))
    since = _ms_to_dt(timestamp)
    if since is not None:
        stmt = stmt.where(Vault.updated_at > since)
    rows = db.execute(stmt).scalars().all()
    for vault in rows:
        register_vault_namespace(vault.id)
    return [vault_to_dict(v) for v in rows]


async def delete_vault(
    db: Session,
    *,
    user: User,
    vault_id: str,
    client_id: str | None = None,
) -> dict[str, Any]:
    vault = assert_vault_access(db, user, vault_id)
    data = vault_to_dict(vault)
    vault.deleted_at = utcnow()
    vault.updated_at = utcnow()
    db.add(vault)
    db.commit()
    await broadcast_entity(
        entity_type="vaults",
        action="delete",
        entity={"id": vault_id},
        vault_id=None,
        skip_client_id=client_id,
    )
    return data


def list_vault_delete_changes(
    db: Session,
    *,
    user: User,
    timestamp: int,
) -> list[dict[str, Any]]:
    since = _ms_to_dt(timestamp) or datetime.fromtimestamp(0, tz=timezone.utc)
    stmt = select(Vault).where(
        Vault.owner_id == user.id,
        Vault.deleted_at.is_not(None),
        Vault.deleted_at > since,
    )
    rows = db.execute(stmt).scalars().all()
    return [{"id": v.id, "type": "vaults", "vaultId": None} for v in rows]
