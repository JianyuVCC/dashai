from __future__ import annotations
from dataclasses import dataclass

from fastapi import Header, HTTPException

from services.supabase_client import get_anon_client


@dataclass
class CurrentUser:
    id: str
    email: str | None


async def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(401, "Missing bearer token")

    try:
        resp = get_anon_client().auth.get_user(token)
    except Exception:
        raise HTTPException(401, "Invalid or expired token")

    user = getattr(resp, "user", None)
    if not user:
        raise HTTPException(401, "Invalid or expired token")

    return CurrentUser(id=user.id, email=user.email)
