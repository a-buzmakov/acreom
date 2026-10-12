"""Maps between REST entity paths (plural) and Socket.IO event names (singular)."""

from __future__ import annotations

# REST path segment -> socket event name
ENTITY_EVENT_NAMES: dict[str, str] = {
    "documents": "document",
    "tasks": "task",
    "projects": "project",
    "events": "event",
    "views": "view",
    "images": "image",
    "versions": "version",
    "integrations": "integration",
    "tasklists": "tasklist",
    "vaults": "vault",
    "users": "user",
    "app-settings": "app-settings",
    "recovery-keys": "recovery-keys",
}

# Socket / initialize type -> REST entity type
EVENT_TO_ENTITY: dict[str, str] = {v: k for k, v in ENTITY_EVENT_NAMES.items()}

VAULT_ENTITIES = frozenset(
    {
        "documents",
        "tasks",
        "projects",
        "events",
        "views",
        "images",
        "versions",
        "integrations",
        "tasklists",
    }
)

CONFIG_ENTITIES = frozenset(
    {
        "vaults",
        "app-settings",
        "recovery-keys",
    }
)


def event_name_for(entity_type: str) -> str:
    return ENTITY_EVENT_NAMES.get(entity_type, entity_type)


def entity_type_for_event(event_type: str) -> str:
    return EVENT_TO_ENTITY.get(event_type, event_type)
