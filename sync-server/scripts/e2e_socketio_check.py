#!/usr/bin/env python3
"""Two-client Socket.IO smoke: connect config + vault namespaces, receive broadcast."""
from __future__ import annotations

import asyncio
import json
import sys
import uuid

import socketio
import urllib.request

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"


def http_json(method: str, path: str, body=None, token=None):
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        f"{BASE_URL}{path}", data=data, headers=headers, method=method
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())


async def main() -> int:
    email = f"sio-{uuid.uuid4().hex[:8]}@example.com"
    password = "e2e-pass-123"
    try:
        http_json("POST", "/api/auth/register", {"email": email, "password": password})
    except Exception:
        pass
    login = http_json("POST", "/api/auth/login", {"email": email, "password": password})
    token = login["accessToken"]
    vault_id = str(uuid.uuid4())
    http_json(
        "POST",
        "/api/v1/vaults",
        {"id": vault_id, "name": "SIO", "type": "remote", "clientId": "sio-a"},
        token=token,
    )

    received: asyncio.Queue = asyncio.Queue()

    client_b = socketio.AsyncClient(logger=False, engineio_logger=False)

    @client_b.on("document", namespace=f"/vault-{vault_id}")
    async def on_document(data):
        await received.put(data)

    # Polling is enough for contract smoke; websocket upgrade needs a matching aiohttp.
    await client_b.connect(
        BASE_URL,
        socketio_path="socket.io",
        namespaces=["/acreom-config", f"/vault-{vault_id}"],
        auth={"clientId": "sio-b", "token": token},
        transports=["polling"],
        wait_timeout=10,
    )

    # Client A creates a document via REST (broadcast should skip client-a only)
    doc_id = str(uuid.uuid4())
    http_json(
        "POST",
        f"/api/v1/{vault_id}/documents",
        {
            "id": doc_id,
            "title": "socket doc",
            "content": "via rest",
            "clientId": "sio-a",
        },
        token=token,
    )

    try:
        payload = await asyncio.wait_for(received.get(), timeout=5)
    except asyncio.TimeoutError:
        print("FAIL: client B did not receive document Socket.IO event")
        await client_b.disconnect()
        return 1

    parsed = json.loads(payload) if isinstance(payload, str) else payload
    ok = (
        isinstance(parsed, dict)
        and parsed.get("action") == "create"
        and isinstance(parsed.get("document"), dict)
        and parsed["document"].get("id") == doc_id
    )
    await client_b.disconnect()
    if ok:
        print(f"PASS: Socket.IO document create broadcast to client B ({doc_id})")
        return 0
    print(f"FAIL: unexpected payload: {parsed}")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
