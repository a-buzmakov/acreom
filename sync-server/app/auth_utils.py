from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _expires_at_ms(delta: timedelta) -> int:
    return int((datetime.now(timezone.utc) + delta).timestamp() * 1000)


def create_access_token(
    user_id: str,
    settings: Settings | None = None,
) -> tuple[str, int]:
    settings = settings or get_settings()
    expire_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expires_at = _expires_at_ms(expire_delta)
    payload = {
        "sub": user_id,
        "type": "access",
        "exp": datetime.now(timezone.utc) + expire_delta,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid4()),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
    return token, expires_at


def create_refresh_token(
    user_id: str,
    settings: Settings | None = None,
) -> str:
    settings = settings or get_settings()
    expire_delta = timedelta(days=settings.refresh_token_expire_days)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + expire_delta,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc
    if expected_type and payload.get("type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    return payload


def issue_token_pair(user_id: str) -> dict[str, Any]:
    access_token, expires_at = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    return {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "expiresAt": expires_at,
    }


def get_user_by_id(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    token_query: str | None = None,
    db: Session = Depends(get_db),
) -> User:
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    elif token_query:
        token = token_query
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = decode_token(token, expected_type="access")
    user = get_user_by_id(db, payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    if not credentials or not credentials.credentials:
        return None
    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except HTTPException:
        return None
    return get_user_by_id(db, payload["sub"])
