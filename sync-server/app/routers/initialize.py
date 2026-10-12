from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import current_user
from app.entity_map import entity_type_for_event
from app.models import User
from app.schemas import InitializeRequestItem, InitializeResponseItem
from app.services import entities as entity_service

router = APIRouter(prefix="/api/v1/{vault_id}", tags=["initialize"])


@router.post("/initialize", response_model=list[InitializeResponseItem])
def initialize(
    vault_id: str,
    body: list[InitializeRequestItem],
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Bulk load vault entities. Client sends [{type: eventName, timestamp}]."""
    entity_service.assert_vault_access(db, user, vault_id)
    results: list[dict[str, Any]] = []
    for item in body:
        entity_type = entity_type_for_event(item.type)
        entries = entity_service.list_entities(
            db,
            entity_type=entity_type,
            owner_id=user.id,
            vault_id=vault_id,
            timestamp=item.timestamp,
        )
        results.append({"type": item.type, "entries": entries})
    return results


@router.post("/initialize/deletechanges", response_model=list[InitializeResponseItem])
def initialize_delete_changes(
    vault_id: str,
    body: list[InitializeRequestItem],
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    entity_service.assert_vault_access(db, user, vault_id)
    results: list[dict[str, Any]] = []
    for item in body:
        entity_type = entity_type_for_event(item.type)
        entries = entity_service.list_delete_changes(
            db,
            entity_type=entity_type,
            owner_id=user.id,
            vault_id=vault_id,
            timestamp=item.timestamp,
        )
        # Normalize type to event name for client consistency
        for entry in entries:
            entry["type"] = item.type
        results.append({"type": item.type, "entries": entries})
    return results
