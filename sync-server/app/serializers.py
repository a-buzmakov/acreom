from __future__ import annotations

import json
from typing import Any

from app.models import User
from app.schemas import pro_subscription


def parse_json(raw: str | None, default: Any = None) -> Any:
    if raw is None:
        return default if default is not None else {}
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return default if default is not None else {}


def dumps_json(data: Any) -> str:
    return json.dumps(data, default=str)


def user_to_dict(user: User, include_sensitive: bool = True) -> dict[str, Any]:
    extra = parse_json(user.extra_json, {})
    payload: dict[str, Any] = {
        "id": user.id,
        "email": user.email,
        "subscription": pro_subscription(),
        "active": True,
        "timezone": user.timezone,
        "compatibility": parse_json(user.compatibility, None),
        "updatedAt": user.updated_at.isoformat() if user.updated_at else None,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
    }
    if include_sensitive:
        payload["privateKeys"] = parse_json(user.private_keys, user.private_keys)
        payload["passphraseSalt"] = user.passphrase_salt
        payload["hkdfSalt"] = user.hkdf_salt
    # Merge any extra client fields stored on update
    for key, value in extra.items():
        if key not in payload:
            payload[key] = value
    return payload


def merge_entity_data(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    merged = {**existing, **incoming}
    # clientId is transport metadata; keep last for broadcast skip but ok in payload
    return merged
