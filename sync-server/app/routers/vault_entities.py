from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import current_user
from app.entity_map import VAULT_ENTITIES
from app.models import ImageBlob, User, utcnow
from app.realtime import broadcast_entity
from app.serializers import dumps_json, parse_json
from app.services import entities as entity_service

router = APIRouter(prefix="/api/v1/{vault_id}", tags=["vault-entities"])


def _check_entity(entity: str) -> str:
    if entity not in VAULT_ENTITIES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown entity type: {entity}",
        )
    return entity


@router.get("/{entity}/deletechanges")
def delete_changes(
    vault_id: str,
    entity: str,
    timestamp: int = Query(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    entity = _check_entity(entity)
    entity_service.assert_vault_access(db, user, vault_id)
    return entity_service.list_delete_changes(
        db,
        entity_type=entity,
        owner_id=user.id,
        vault_id=vault_id,
        timestamp=timestamp,
    )


@router.post("/{entity}/batch")
async def create_batch(
    vault_id: str,
    entity: str,
    body: dict[str, Any],
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    entity = _check_entity(entity)
    entity_service.assert_vault_access(db, user, vault_id)
    return await entity_service.upsert_batch(
        db,
        entity_type=entity,
        owner_id=user.id,
        vault_id=vault_id,
        entities=body.get("entities") or [],
        create=True,
        client_id=body.get("clientId"),
    )


@router.put("/{entity}/batch")
async def update_batch(
    vault_id: str,
    entity: str,
    body: dict[str, Any],
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    entity = _check_entity(entity)
    entity_service.assert_vault_access(db, user, vault_id)
    return await entity_service.upsert_batch(
        db,
        entity_type=entity,
        owner_id=user.id,
        vault_id=vault_id,
        entities=body.get("entities") or [],
        create=False,
        client_id=body.get("clientId"),
    )


# ---- Images (multipart) ----


@router.post("/images/create")
@router.post("/images/update")
async def save_image(
    vault_id: str,
    clientId: str | None = Query(default=None),
    image: UploadFile | None = File(default=None),
    imageObject: str = Form(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    entity_service.assert_vault_access(db, user, vault_id)
    meta = json.loads(imageObject)
    client_id = clientId or meta.pop("clientId", None)
    entity_id = meta.get("id") or str(uuid4())
    meta["id"] = entity_id
    meta["vaultId"] = vault_id

    settings = get_settings()
    vault_dir = settings.images_dir / vault_id
    vault_dir.mkdir(parents=True, exist_ok=True)
    dest = vault_dir / entity_id

    if image is not None:
        content = await image.read()
        dest.write_bytes(content)
        content_type = image.content_type or "application/octet-stream"
    else:
        content_type = "application/octet-stream"

    # Client renders remoteUri as an absolute URL (+ ?token=)
    base = get_settings().public_base_url.rstrip("/")
    meta["remoteUri"] = f"{base}/api/v1/{vault_id}/images/{entity_id}"
    meta["updatedAt"] = utcnow().isoformat()

    blob = db.get(ImageBlob, entity_id)
    if blob:
        blob.meta_json = dumps_json(meta)
        blob.file_path = str(dest)
        blob.content_type = content_type
        blob.updated_at = utcnow()
        blob.deleted_at = None
        action = "update"
    else:
        blob = ImageBlob(
            id=entity_id,
            vault_id=vault_id,
            owner_id=user.id,
            content_type=content_type,
            file_path=str(dest),
            meta_json=dumps_json(meta),
            updated_at=utcnow(),
        )
        action = "create"
    db.add(blob)

    # Also store metadata in entities table for list/initialize
    await entity_service.upsert_entity(
        db,
        entity_type="images",
        owner_id=user.id,
        vault_id=vault_id,
        payload={**meta, "clientId": client_id},
        create=(action == "create"),
        broadcast=False,
    )
    db.commit()

    await broadcast_entity(
        entity_type="images",
        action=action,
        entity=meta,
        vault_id=vault_id,
        skip_client_id=client_id,
    )
    return meta


@router.get("/images/{image_id}")
def get_image(
    vault_id: str,
    image_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    entity_service.assert_vault_access(db, user, vault_id)
    blob = db.get(ImageBlob, image_id)
    if not blob or blob.vault_id != vault_id or blob.deleted_at is not None:
        # Fall back to entity meta only
        row = entity_service.get_active_entity(
            db,
            entity_type="images",
            entity_id=image_id,
            vault_id=vault_id,
            owner_id=user.id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        raise HTTPException(status_code=404, detail="Image binary not found")

    path = Path(blob.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Image binary not found")
    return FileResponse(path, media_type=blob.content_type)


# ---- Generic CRUD ----


@router.get("/{entity}")
def list_entities(
    vault_id: str,
    entity: str,
    timestamp: int | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    entity = _check_entity(entity)
    entity_service.assert_vault_access(db, user, vault_id)
    return entity_service.list_entities(
        db,
        entity_type=entity,
        owner_id=user.id,
        vault_id=vault_id,
        timestamp=timestamp,
    )


@router.get("/{entity}/{entity_id}")
def get_entity(
    vault_id: str,
    entity: str,
    entity_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    entity = _check_entity(entity)
    entity_service.assert_vault_access(db, user, vault_id)
    row = entity_service.get_active_entity(
        db,
        entity_type=entity,
        entity_id=entity_id,
        vault_id=vault_id,
        owner_id=user.id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return parse_json(row.data_json, {})


@router.post("/{entity}")
async def create_entity(
    vault_id: str,
    entity: str,
    body: dict[str, Any],
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    entity = _check_entity(entity)
    entity_service.assert_vault_access(db, user, vault_id)
    return await entity_service.upsert_entity(
        db,
        entity_type=entity,
        owner_id=user.id,
        vault_id=vault_id,
        payload=body,
        create=True,
    )


@router.put("/{entity}/{entity_id}")
async def update_entity(
    vault_id: str,
    entity: str,
    entity_id: str,
    body: dict[str, Any],
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    entity = _check_entity(entity)
    entity_service.assert_vault_access(db, user, vault_id)
    payload = dict(body)
    payload["id"] = entity_id
    return await entity_service.upsert_entity(
        db,
        entity_type=entity,
        owner_id=user.id,
        vault_id=vault_id,
        payload=payload,
        create=False,
    )


@router.delete("/{entity}/{entity_id}")
async def delete_entity(
    vault_id: str,
    entity: str,
    entity_id: str,
    clientId: str | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    entity = _check_entity(entity)
    entity_service.assert_vault_access(db, user, vault_id)

    if entity == "images":
        blob = db.get(ImageBlob, entity_id)
        if blob and blob.vault_id == vault_id:
            blob.deleted_at = utcnow()
            db.add(blob)
            db.commit()

    return await entity_service.delete_entity(
        db,
        entity_type=entity,
        owner_id=user.id,
        vault_id=vault_id,
        entity_id=entity_id,
        client_id=clientId,
    )
