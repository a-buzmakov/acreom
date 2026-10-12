from __future__ import annotations

import re

import socketio

from app.auth_utils import decode_token, get_user_by_id
from app.database import SessionLocal
from app.models import Vault
from app.realtime import sio, track_session, untrack_session

VAULT_NS_RE = re.compile(r"^/vault-([0-9a-fA-F-]{36})$")
_registered_vault_ns: set[str] = set()


def _authenticate(auth: dict | None) -> tuple[str, str | None] | None:
    if not auth or not isinstance(auth, dict):
        return None
    token = auth.get("token")
    client_id = auth.get("clientId")
    if not token:
        return None
    try:
        payload = decode_token(token, expected_type="access")
    except Exception:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    db = SessionLocal()
    try:
        user = get_user_by_id(db, user_id)
        if not user:
            return None
        return user.id, client_id
    finally:
        db.close()


class AcreomConfigNamespace(socketio.AsyncNamespace):
    async def on_connect(self, sid, environ, auth):  # noqa: ARG002
        result = _authenticate(auth)
        if not result:
            return False
        user_id, client_id = result
        track_session(sid, self.namespace, user_id, client_id)
        return True

    async def on_disconnect(self, sid):
        untrack_session(sid)


class VaultNamespace(socketio.AsyncNamespace):
    async def on_connect(self, sid, environ, auth):  # noqa: ARG002
        result = _authenticate(auth)
        if not result:
            return False
        user_id, client_id = result
        match = VAULT_NS_RE.match(self.namespace)
        if not match:
            return False
        vault_id = match.group(1)
        db = SessionLocal()
        try:
            vault = db.get(Vault, vault_id)
            if not vault or vault.owner_id != user_id or vault.deleted_at is not None:
                return False
        finally:
            db.close()
        track_session(sid, self.namespace, user_id, client_id)
        return True

    async def on_disconnect(self, sid):
        untrack_session(sid)


def register_vault_namespace(vault_id: str) -> None:
    ns = f"/vault-{vault_id}"
    if ns in _registered_vault_ns:
        return
    sio.register_namespace(VaultNamespace(ns))
    _registered_vault_ns.add(ns)


def setup_socketio() -> None:
    sio.register_namespace(AcreomConfigNamespace("/acreom-config"))

    # Auto-register /vault-{uuid} namespaces on first connect attempt
    original_handle_connect = sio._handle_connect  # noqa: SLF001

    async def _handle_connect(eio_sid, namespace, data):
        if (
            isinstance(namespace, str)
            and VAULT_NS_RE.match(namespace)
            and namespace not in _registered_vault_ns
        ):
            vault_id = namespace.replace("/vault-", "", 1)
            register_vault_namespace(vault_id)
        return await original_handle_connect(eio_sid, namespace, data)

    sio._handle_connect = _handle_connect  # noqa: SLF001
