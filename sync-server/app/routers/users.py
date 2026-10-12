from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import current_user
from app.models import User, utcnow
from app.realtime import broadcast_entity
from app.schemas import TimezoneRequest, pro_subscription
from app.serializers import dumps_json, parse_json, user_to_dict

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("")
@router.get("/")
def get_users(user: User = Depends(current_user)) -> dict[str, Any]:
    """Client expects a single user object from GET /api/v1/users."""
    return user_to_dict(user)


@router.post("/timezone")
def set_timezone(
    body: TimezoneRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    user.timezone = body.timezone
    user.updated_at = utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_to_dict(user)


@router.get("/subscription")
def subscription(user: User = Depends(current_user)) -> dict[str, Any]:
    sub = pro_subscription()
    sub["id"] = sub["subscriptionId"]
    sub["userId"] = user.id
    return sub


@router.delete("")
@router.delete("/")
def delete_user(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    db.delete(user)
    db.commit()
    return {"status": "deleted"}


@router.put("/{user_id}")
async def update_user(
    user_id: str,
    body: dict[str, Any],
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    client_id = body.pop("clientId", None)
    body.pop("id", None)
    body.pop("email", None)
    body.pop("subscription", None)
    body.pop("credentials", None)

    if "privateKeys" in body:
        value = body.pop("privateKeys")
        user.private_keys = value if isinstance(value, str) else dumps_json(value)
    if "passphraseSalt" in body:
        user.passphrase_salt = body.pop("passphraseSalt")
    if "hkdfSalt" in body:
        user.hkdf_salt = body.pop("hkdfSalt")
    if "compatibility" in body:
        value = body.pop("compatibility")
        user.compatibility = value if isinstance(value, str) else dumps_json(value)
    if "timezone" in body:
        user.timezone = body.pop("timezone")

    extra = parse_json(user.extra_json, {})
    extra.update(body)
    user.extra_json = dumps_json(extra)
    user.updated_at = utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)

    result = user_to_dict(user)
    await broadcast_entity(
        entity_type="users",
        action="update",
        entity=result,
        vault_id=None,
        skip_client_id=client_id,
    )
    return result
