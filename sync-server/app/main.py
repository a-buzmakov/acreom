from __future__ import annotations

from pathlib import Path

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.realtime import sio
from app.routers import auth, config_entities, health, initialize, users, vault_entities
from app.socketio_server import setup_socketio

settings = get_settings()
Path(settings.data_dir).mkdir(parents=True, exist_ok=True)

fastapi_app = FastAPI(
    title="Acreom Sync Server",
    description="Self-hosted config + vault sync compatible with acreom cloud workers",
    version="0.1.0",
)

# Browsers forbid Access-Control-Allow-Origin: * together with credentials.
# Bearer-token clients (acreom cloud worker) do not need credentialed CORS.
_cors_origins = settings.cors_origin_list
_allow_credentials = _cors_origins != ["*"]
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

fastapi_app.include_router(health.router)
fastapi_app.include_router(auth.router)
fastapi_app.include_router(users.router)
fastapi_app.include_router(config_entities.router)
fastapi_app.include_router(initialize.router)
fastapi_app.include_router(vault_entities.router)


@fastapi_app.on_event("startup")
def on_startup() -> None:
    init_db()
    setup_socketio()


# Combined ASGI app: Socket.IO + FastAPI
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="socket.io")


def run() -> None:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    run()
