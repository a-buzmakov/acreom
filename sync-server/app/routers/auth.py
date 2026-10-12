from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth_utils import (
    decode_token,
    hash_password,
    issue_token_pair,
    verify_password,
)
from app.database import get_db
from app.models import User, utcnow
from app.schemas import LoginRequest, RegisterRequest, TokenResponse
from app.serializers import user_to_dict

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing:
        # Client checks response.data.error === 'user exists'
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "user exists"},
        )
    user = User(
        id=str(uuid4()),
        email=email,
        password_hash=hash_password(body.password),
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    tokens = issue_token_pair(user.id)
    return {**tokens, "user": user_to_dict(user)}


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> dict:
    email = body.email.lower().strip()
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    tokens = issue_token_pair(user.id)
    return {**tokens, "user": user_to_dict(user)}


@router.get("/refresh")
@router.post("/refresh")
def refresh(
    authorization: str | None = Header(default=None),
    x_refresh_token: str | None = Header(default=None, alias="X-Refresh-Token"),
    db: Session = Depends(get_db),
) -> dict:
    if not x_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing refresh token",
        )
    # Access token may be expired; still accept refresh if valid
    refresh_payload = decode_token(x_refresh_token, expected_type="refresh")
    user = db.get(User, refresh_payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid refresh token",
        )
    # Optional: validate access token header shape (client always sends it)
    if authorization and authorization.lower().startswith("bearer "):
        pass
    return issue_token_pair(user.id)
