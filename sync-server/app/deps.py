from __future__ import annotations

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth_utils import decode_token, get_user_by_id
from app.database import get_db
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> User:
    raw = None
    if credentials and credentials.credentials:
        raw = credentials.credentials
    elif token:
        raw = token
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = decode_token(raw, expected_type="access")
    user = get_user_by_id(db, payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user
