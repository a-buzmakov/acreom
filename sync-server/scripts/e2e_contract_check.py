#!/usr/bin/env python3
"""Contract smoke test: auth, vault CRUD, documents batch, initialize, two-client read.

Usage (server must be running on BASE_URL):
  python scripts/e2e_contract_check.py
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from typing import Any

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
failures: list[str] = []
passes: list[str] = []


def req(
    method: str,
    path: str,
    *,
    body: Any = None,
    token: str | None = None,
    headers: dict[str, str] | None = None,
    expect: int | None = 200,
) -> tuple[int, Any]:
    data = None
    hdrs = {"Accept": "application/json", **(headers or {})}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        hdrs["Content-Type"] = "application/json"
    if token:
        hdrs["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        f"{BASE_URL}{path}", data=data, headers=hdrs, method=method
    )
    def _parse(raw: str) -> Any:
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw

    try:
        with urllib.request.urlopen(request, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            status = resp.status
            payload = _parse(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        status = e.code
        payload = _parse(raw)
    if expect is not None and status != expect:
        failures.append(f"{method} {path} -> {status} (expected {expect}): {payload}")
    else:
        passes.append(f"{method} {path} -> {status}")
    return status, payload


def main() -> int:
    print(f"E2E contract check against {BASE_URL}")
    suffix = uuid.uuid4().hex[:8]
    email_a = f"client-a-{suffix}@example.com"
    email_b = f"client-b-{suffix}@example.com"
    password = "e2e-pass-123"

    # Health
    status, health = req("GET", "/health")
    if status == 200 and not (isinstance(health, dict) and health.get("status") in ("ok", "healthy", True)):
        # Accept any 200 JSON or plain ok shape
        if not isinstance(health, dict):
            failures.append(f"/health unexpected body: {health}")

    # Register client A
    _, reg_a = req(
        "POST",
        "/api/auth/register",
        body={"email": email_a, "password": password},
    )
    for key in ("accessToken", "refreshToken", "expiresAt", "user"):
        if not isinstance(reg_a, dict) or key not in reg_a:
            failures.append(f"register missing {key}: {reg_a}")
    if isinstance(reg_a, dict):
        sub = (reg_a.get("user") or {}).get("subscription") or {}
        if sub.get("type") != "pro" or sub.get("status") != "active":
            failures.append(f"subscription stub not pro/active: {sub}")

    # Login client A
    _, login_a = req(
        "POST",
        "/api/auth/login",
        body={"email": email_a, "password": password},
    )
    token_a = login_a["accessToken"] if isinstance(login_a, dict) else None
    refresh_a = login_a["refreshToken"] if isinstance(login_a, dict) else None

    # Refresh
    if token_a and refresh_a:
        _, refreshed = req(
            "GET",
            "/api/auth/refresh",
            token=token_a,
            headers={"X-Refresh-Token": refresh_a},
        )
        if isinstance(refreshed, dict) and refreshed.get("accessToken"):
            token_a = refreshed["accessToken"]
            refresh_a = refreshed.get("refreshToken", refresh_a)
        else:
            failures.append(f"refresh missing accessToken: {refreshed}")

    # Register client B (same vault owner = same user for MVP ownership;
    # simulate two devices as same account)
    # Also register a second account to ensure isolation doesn't break vault create
    req(
        "POST",
        "/api/auth/register",
        body={"email": email_b, "password": password},
    )
    _, login_b = req(
        "POST",
        "/api/auth/login",
        body={"email": email_a, "password": password},
    )
    token_b = login_b["accessToken"] if isinstance(login_b, dict) else token_a

    # Users + subscription
    req("GET", "/api/v1/users", token=token_a)
    _, sub = req("GET", "/api/v1/users/subscription", token=token_a)
    if isinstance(sub, dict) and sub.get("type") != "pro":
        failures.append(f"GET subscription type != pro: {sub}")

    # Vault create
    vault_id = str(uuid.uuid4())
    _, vault = req(
        "POST",
        "/api/v1/vaults",
        token=token_a,
        body={
            "id": vault_id,
            "name": "E2E Vault",
            "type": "remote",
            "clientId": "client-a",
        },
    )
    if isinstance(vault, dict) and vault.get("id") != vault_id:
        failures.append(f"vault id mismatch: {vault}")

    # App settings (config entity)
    settings_id = str(uuid.uuid4())
    _, settings = req(
        "POST",
        "/api/v1/app-settings",
        token=token_a,
        body={"id": settings_id, "theme": "DARK", "clientId": "client-a"},
    )
    if isinstance(settings, dict) and settings.get("id") != settings_id:
        failures.append(f"app-settings create mismatch: {settings}")
    req("GET", f"/api/v1/app-settings/{settings_id}", token=token_b)

    # Document create (client A)
    doc_id = str(uuid.uuid4())
    now = int(time.time() * 1000)
    _, doc = req(
        "POST",
        f"/api/v1/{vault_id}/documents",
        token=token_a,
        body={
            "id": doc_id,
            "title": "Hello from A",
            "content": "page content from client A",
            "updatedAt": now,
            "createdAt": now,
            "clientId": "client-a",
        },
    )
    if isinstance(doc, dict) and doc.get("id") != doc_id:
        failures.append(f"document create mismatch: {doc}")

    # Batch update (client A)
    req(
        "PUT",
        f"/api/v1/{vault_id}/documents/batch",
        token=token_a,
        body={
            "clientId": "client-a",
            "entities": [
                {
                    "id": doc_id,
                    "title": "Hello from A (edited)",
                    "content": "updated by A",
                    "updatedAt": now + 1,
                }
            ],
        },
    )

    # Client B reads document
    _, doc_b = req(
        "GET",
        f"/api/v1/{vault_id}/documents/{doc_id}",
        token=token_b,
    )
    if not isinstance(doc_b, dict) or doc_b.get("title") != "Hello from A (edited)":
        failures.append(f"client B did not see A update: {doc_b}")

    # Client B creates another doc; A sees via list/initialize
    doc2_id = str(uuid.uuid4())
    req(
        "POST",
        f"/api/v1/{vault_id}/documents",
        token=token_b,
        body={
            "id": doc2_id,
            "title": "From B",
            "content": "b",
            "updatedAt": now + 2,
            "clientId": "client-b",
        },
    )

    _, init = req(
        "POST",
        f"/api/v1/{vault_id}/initialize",
        token=token_a,
        body=[{"type": "document", "timestamp": 1}],
    )
    if not isinstance(init, list) or not init:
        failures.append(f"initialize unexpected: {init}")
    else:
        entries = init[0].get("entries") or []
        ids = {e.get("id") for e in entries if isinstance(e, dict)}
        if doc_id not in ids or doc2_id not in ids:
            failures.append(f"initialize missing docs: {ids}")

    # Delete + deletechanges
    req(
        "DELETE",
        f"/api/v1/{vault_id}/documents/{doc2_id}?clientId=client-b",
        token=token_b,
    )
    _, deletes = req(
        "GET",
        f"/api/v1/{vault_id}/documents/deletechanges?timestamp=1",
        token=token_a,
    )
    if not isinstance(deletes, list) or not any(
        isinstance(d, dict) and d.get("id") == doc2_id for d in deletes
    ):
        failures.append(f"deletechanges missing doc2: {deletes}")

    _, init_del = req(
        "POST",
        f"/api/v1/{vault_id}/initialize/deletechanges",
        token=token_a,
        body=[{"type": "document", "timestamp": 1}],
    )
    if not isinstance(init_del, list):
        failures.append(f"initialize/deletechanges unexpected: {init_del}")

    # CORS preflight-ish headers (OPTIONS)
    status, _ = req(
        "OPTIONS",
        "/api/auth/login",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
        expect=None,
        body=None,
    )
    if status not in (200, 204):
        failures.append(f"CORS OPTIONS /api/auth/login -> {status}")
    else:
        passes.append(f"OPTIONS /api/auth/login -> {status}")

    # Duplicate register shape
    status, dup = req(
        "POST",
        "/api/auth/register",
        body={"email": email_a, "password": password},
        expect=400,
    )
    if status == 400 and not (
        isinstance(dup, dict) and dup.get("error") == "user exists"
    ):
        failures.append(f"duplicate register shape: {dup}")

    print()
    print(f"PASS ({len(passes)}):")
    for p in passes:
        print(f"  ✓ {p}")
    if failures:
        print(f"\nFAIL ({len(failures)}):")
        for f in failures:
            print(f"  ✗ {f}")
        return 1
    print("\nAll contract checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
