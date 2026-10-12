from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


def pro_subscription() -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    return {
        "customerId": "self-hosted",
        "from": now.isoformat(),
        "status": "active",
        "subscriptionId": "self-hosted-pro",
        "to": (now + timedelta(days=3650)).isoformat(),
        "type": "pro",
    }


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    accessToken: str
    refreshToken: str
    expiresAt: int
    user: Optional[Dict[str, Any]] = None


class TimezoneRequest(BaseModel):
    timezone: str


class BatchRequest(BaseModel):
    clientId: Optional[str] = None
    entities: List[Dict[str, Any]] = Field(default_factory=list)


class InitializeRequestItem(BaseModel):
    type: str
    timestamp: int = 1


class InitializeResponseItem(BaseModel):
    type: str
    entries: List[Any] = Field(default_factory=list)


class EntityPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: Optional[str] = None
    clientId: Optional[str] = None
