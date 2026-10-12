from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import current_user
from app.models import User
from app.services import entities as entity_service

router = APIRouter(prefix="/api/v1", tags=["config"])


# ---- Vaults (dedicated table) ----


@router.get("/vaults")
def list_vaults(
    timestamp: int | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    return entity_service.list_vaults(db, user=user, timestamp=timestamp)


@router.get("/vaults/deletechanges")
def vault_delete_changes(
    timestamp: int = Query(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    return entity_service.list_vault_delete_changes(db, user=user, timestamp=timestamp)


@router.post("/vaults/batch")
async def create_vaults_batch(
    body: dict[str, Any],
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    client_id = body.get("clientId")
    results = []
    for entity in body.get("entities") or []:
        payload = dict(entity)
        if client_id is not None:
            payload.setdefault("clientId", client_id)
        results.append(
            await entity_service.upsert_vault(
                db, user=user, payload=payload, create=True
            )
        )
    return results


@router.put("/vaults/batch")
async def update_vaults_batch(
    body: dict[str, Any],
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    client_id = body.get("clientId")
    results = []
    for entity in body.get("entities") or []:
        payload = dict(entity)
        if client_id is not None:
            payload.setdefault("clientId", client_id)
        results.append(
            await entity_service.upsert_vault(
                db, user=user, payload=payload, create=False
            )
        )
    return results


@router.get("/vaults/{vault_id}")
def get_vault(
    vault_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    vault = entity_service.assert_vault_access(db, user, vault_id)
    return entity_service.vault_to_dict(vault)


@router.post("/vaults")
async def create_vault(
    body: dict[str, Any],
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return await entity_service.upsert_vault(db, user=user, payload=body, create=True)


@router.put("/vaults/{vault_id}")
async def update_vault(
    vault_id: str,
    body: dict[str, Any],
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    payload = dict(body)
    payload["id"] = vault_id
    return await entity_service.upsert_vault(
        db, user=user, payload=payload, create=False
    )


@router.delete("/vaults/{vault_id}")
async def delete_vault(
    vault_id: str,
    clientId: str | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return await entity_service.delete_vault(
        db, user=user, vault_id=vault_id, client_id=clientId
    )


def _config_entity_routes(entity_type: str) -> APIRouter:
    r = APIRouter()

    @r.get(f"/{entity_type}")
    def list_items(
        timestamp: int | None = Query(default=None),
        user: User = Depends(current_user),
        db: Session = Depends(get_db),
    ) -> list[dict[str, Any]]:
        return entity_service.list_entities(
            db,
            entity_type=entity_type,
            owner_id=user.id,
            vault_id=None,
            timestamp=timestamp,
        )

    @r.get(f"/{entity_type}/deletechanges")
    def delete_changes(
        timestamp: int = Query(...),
        user: User = Depends(current_user),
        db: Session = Depends(get_db),
    ) -> list[dict[str, Any]]:
        return entity_service.list_delete_changes(
            db,
            entity_type=entity_type,
            owner_id=user.id,
            vault_id=None,
            timestamp=timestamp,
        )

    @r.post(f"/{entity_type}/batch")
    async def create_batch(
        body: dict[str, Any],
        user: User = Depends(current_user),
        db: Session = Depends(get_db),
    ) -> list[dict[str, Any]]:
        return await entity_service.upsert_batch(
            db,
            entity_type=entity_type,
            owner_id=user.id,
            vault_id=None,
            entities=body.get("entities") or [],
            create=True,
            client_id=body.get("clientId"),
        )

    @r.put(f"/{entity_type}/batch")
    async def update_batch(
        body: dict[str, Any],
        user: User = Depends(current_user),
        db: Session = Depends(get_db),
    ) -> list[dict[str, Any]]:
        return await entity_service.upsert_batch(
            db,
            entity_type=entity_type,
            owner_id=user.id,
            vault_id=None,
            entities=body.get("entities") or [],
            create=False,
            client_id=body.get("clientId"),
        )

    @r.get(f"/{entity_type}/{{entity_id}}")
    def get_item(
        entity_id: str,
        user: User = Depends(current_user),
        db: Session = Depends(get_db),
    ) -> dict[str, Any]:
        from fastapi import HTTPException

        row = entity_service.get_active_entity(
            db,
            entity_type=entity_type,
            entity_id=entity_id,
            vault_id=None,
            owner_id=user.id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        from app.serializers import parse_json

        return parse_json(row.data_json, {})

    @r.post(f"/{entity_type}")
    async def create_item(
        body: dict[str, Any],
        user: User = Depends(current_user),
        db: Session = Depends(get_db),
    ) -> dict[str, Any]:
        return await entity_service.upsert_entity(
            db,
            entity_type=entity_type,
            owner_id=user.id,
            vault_id=None,
            payload=body,
            create=True,
        )

    @r.put(f"/{entity_type}/{{entity_id}}")
    async def update_item(
        entity_id: str,
        body: dict[str, Any],
        user: User = Depends(current_user),
        db: Session = Depends(get_db),
    ) -> dict[str, Any]:
        payload = dict(body)
        payload["id"] = entity_id
        return await entity_service.upsert_entity(
            db,
            entity_type=entity_type,
            owner_id=user.id,
            vault_id=None,
            payload=payload,
            create=False,
        )

    @r.delete(f"/{entity_type}/{{entity_id}}")
    async def delete_item(
        entity_id: str,
        clientId: str | None = Query(default=None),
        user: User = Depends(current_user),
        db: Session = Depends(get_db),
    ) -> dict[str, Any]:
        return await entity_service.delete_entity(
            db,
            entity_type=entity_type,
            owner_id=user.id,
            vault_id=None,
            entity_id=entity_id,
            client_id=clientId,
        )

    return r


router.include_router(_config_entity_routes("app-settings"))
router.include_router(_config_entity_routes("recovery-keys"))
