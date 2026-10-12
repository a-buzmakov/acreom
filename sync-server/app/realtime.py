from __future__ import annotations

import json
from typing import Any

import socketio

from app.entity_map import event_name_for

# sid -> {user_id, client_id, namespace}
_sessions: dict[str, dict[str, Any]] = {}

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)


def track_session(sid: str, namespace: str, user_id: str, client_id: str | None) -> None:
    _sessions[sid] = {
        "user_id": user_id,
        "client_id": client_id,
        "namespace": namespace,
    }


def untrack_session(sid: str) -> None:
    _sessions.pop(sid, None)


def get_session(sid: str) -> dict[str, Any] | None:
    return _sessions.get(sid)


async def broadcast_entity(
    *,
    entity_type: str,
    action: str,
    entity: dict[str, Any] | list[dict[str, Any]],
    vault_id: str | None,
    skip_client_id: str | None = None,
) -> None:
    """Emit Socket.IO event matching frontend websockets.ts / protocol listeners.

    Payload is a JSON string: { action, <eventName>: entity | entity[] }.
    """
    event = event_name_for(entity_type)
    payload = {
        "action": action,
        event: entity,
    }
    data = json.dumps(payload, default=str)

    namespace = f"/vault-{vault_id}" if vault_id else "/acreom-config"

    targets = [
        sid
        for sid, meta in _sessions.items()
        if meta.get("namespace") == namespace
        and (not skip_client_id or meta.get("client_id") != skip_client_id)
    ]
    for sid in targets:
        await sio.emit(event, data, to=sid, namespace=namespace)
