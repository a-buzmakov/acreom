# Acreom Sync Server

Self-hosted FastAPI server that approximates the acreom cloud REST + Socket.IO contract used by `frontend/workers/cloud`.

## Features

- `GET /health` — liveness for Sync settings Test
- JWT email/password auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET|POST /api/auth/refresh`
- User + always-active Pro subscription stub
- Config entities: vaults, recovery-keys, app-settings
- Vault entity CRUD + batch under `/api/v1/{vaultId}/{entity}`
- `POST /api/v1/{vaultId}/initialize` and delete-changes helpers
- Socket.IO namespaces `/acreom-config` and `/vault-{id}`

## Quick start (local)

```bash
cd sync-server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit SECRET_KEY in .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Smoke test:

```bash
curl -s http://localhost:8000/health
curl -s -X POST http://localhost:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"secret123"}'
```

Contract / two-client REST + Socket.IO checks (server must already be running):

```bash
python scripts/e2e_contract_check.py http://127.0.0.1:8000
python scripts/e2e_socketio_check.py http://127.0.0.1:8000
```

### Manual UI (Electron / Nuxt)

1. Register a user once via `POST /api/auth/register` (Sync settings only logs in; no register form yet).
2. In the app: **Settings → Vault → Sync**.
3. Server URL `http://localhost:8000` (or your LAN/VPS URL), email + password → **Test** then **Save**.
4. Enable **Enable cloud sync for this vault** if the vault is still local.
5. Create/edit a page; on a second client with the same server + account, open the same vault and confirm the page appears (realtime via Socket.IO, or after reconnect / initialize).

## Docker Compose

API is published on host port **9637** (container listens on 8000).

```bash
cd sync-server
cp .env.example .env
# set SECRET_KEY to a long random string (required in production)
# on a VPS, set PUBLIC_BASE_URL to http://YOUR_IP:9637 or https://sync.example.com
docker compose up -d --build
```

Smoke test:

```bash
curl -s http://localhost:9637/health
# on a VPS: curl -s http://HOST:9637/health
```

SQLite data persists in the `sync-data` Docker volume (`/data` in the container).

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | `dev-secret-change-me` | JWT signing key (required in production) |
| `DATABASE_URL` | `sqlite:///./data/sync.db` | SQLAlchemy URL; for Postgres install `psycopg2-binary` and set `postgresql://...` |
| `CORS_ORIGINS` | `*` | Comma-separated origins or `*` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Access JWT lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Refresh JWT lifetime |
| `DATA_DIR` | `./data` | SQLite + image blob storage |
| `HOST` / `PORT` | `0.0.0.0` / `8000` | Bind address (local runner; Docker uses container port 8000) |
| `PUBLIC_BASE_URL` | `http://localhost:9637` (Docker) / `http://localhost:8000` (local) | Absolute origin for image `remoteUri` values; set to your VPS URL when deploying |

## Auth contract

Login / register response:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresAt": 1710000000000,
  "user": { "id": "...", "email": "...", "subscription": { "type": "pro", "status": "active", ... } }
}
```

Refresh: `GET /api/auth/refresh` with headers:

- `Authorization: Bearer <accessToken>`
- `X-Refresh-Token: <refreshToken>`

## Socket.IO

- Path: `/socket.io`
- Query: client sends `version=v2`
- Auth handshake: `{ "clientId": "...", "token": "<accessToken>" }`
- Events: `document`, `task`, `project`, `event`, `view`, `image`, `version`, `integration`, `vault`, `user`, `app-settings`, `recovery-keys`
- Payload: JSON **string** `{ "action": "create|update|delete", "<event>": entity|entity[] }`

## Out of scope (v1)

Stripe, OAuth, Jira/GitHub/Linear/GCal proxies, acreom Assistant hosted endpoints.
